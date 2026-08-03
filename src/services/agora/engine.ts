import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { soundService } from '../soundService';

AgoraRTC.setLogLevel(4);

export function uidToNumeric(uidStr: string): number {
    if (!uidStr) return Math.floor(Math.random() * 10000000) + 1;
    if (/^\d+$/.test(uidStr)) {
        return Math.abs(parseInt(uidStr, 10)) % 1000000000 || 1;
    }
    let hash = 0;
    for (let i = 0; i < uidStr.length; i++) {
        hash = (hash << 5) - hash + uidStr.charCodeAt(i);
        hash |= 0;
    }
    return (Math.abs(hash) % 1000000000) || 1;
}

export class AgoraEngineManager {
    private static instance: AgoraEngineManager | null = null;
    private client: IAgoraRTCClient | null = null;
    private localAudioTrack: IMicrophoneAudioTrack | null = null;
    public isPublishing = false;
    private volumeCallback: ((volumes: { uid: string; level: number }[]) => void) | null = null;
    private isJoined = false;
    private isLeaving = false;
    private currentRoomID: string | null = null;
    private hasAlertedPermissionDenied = false;
    private pendingAudioTracks: Set<any> = new Set();
    private unlockListenerRegistered = false;
    public isDeafened = false;

    private constructor() {
        this.registerUnlockListener();
    }
    
    private registerUnlockListener() {
        if (typeof window === 'undefined' || this.unlockListenerRegistered) return;
        this.unlockListenerRegistered = true;

        const unlockAll = async () => {
            soundService.unlockAudio();

            // 1. Play all pending/blocked audio tracks
            if (this.pendingAudioTracks.size > 0) {
                const tracks = Array.from(this.pendingAudioTracks);
                this.pendingAudioTracks.clear();
                for (const track of tracks) {
                    try {
                        if (this.isDeafened) {
                            track.setVolume(0);
                        } else {
                            track.setVolume(100);
                            await track.play();
                            console.log("[AGORA] Successfully unlocked pending audio track.");
                        }
                    } catch (e) {
                        console.warn("[AGORA] Retry playing audio track error:", e);
                        this.pendingAudioTracks.add(track);
                    }
                }
            }

            // 2. Ensure all remote users audio tracks are playing
            if (this.client) {
                for (const user of this.client.remoteUsers) {
                    if (user.audioTrack) {
                        try {
                            if (this.isDeafened) {
                                user.audioTrack.setVolume(0);
                            } else {
                                user.audioTrack.setVolume(100);
                                if (!user.audioTrack.isPlaying) {
                                    await user.audioTrack.play();
                                    console.log("[AGORA] Unlocked and played audio for remote user:", user.uid);
                                }
                            }
                        } catch (e) {
                            console.warn("[AGORA] Error playing user audio track on unlock:", e);
                        }
                    }
                }
            }
        };

        ['click', 'touchstart', 'pointerdown', 'mousedown', 'keydown'].forEach((evtType) => {
            window.addEventListener(evtType, unlockAll, { passive: true });
        });
    }

    public setRoomAudioDeafened(deafened: boolean) {
        this.isDeafened = deafened;
        if (!this.client) return;
        this.client.remoteUsers.forEach(async (user) => {
            if (user.audioTrack) {
                try {
                    if (deafened) {
                        user.audioTrack.setVolume(0);
                    } else {
                        user.audioTrack.setVolume(100);
                        await user.audioTrack.play();
                    }
                } catch (e) {
                    console.warn("[AGORA] Error toggling remote audio volume:", e);
                }
            }
        });
    }

    public setupBackgroundAudio() {
        if (typeof document === 'undefined') return;

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log("[AGORA-BACKGROUND] Page hidden. Unlocking audio...");
                soundService.unlockAudio();
            } else {
                console.log("[AGORA-BACKGROUND] Page visible. Ensuring audio track active.");
                soundService.unlockAudio();
            }
        });
    }

    public static getInstance(): AgoraEngineManager {
        if (!AgoraEngineManager.instance) {
            AgoraEngineManager.instance = new AgoraEngineManager();
        }
        return AgoraEngineManager.instance;
    }

    public onVolumeIndicator(callback: (volumes: { uid: string; level: number }[]) => void) {
        this.volumeCallback = callback;
    }

    public async initEngine(): Promise<IAgoraRTCClient | null> {
        if (this.client) return this.client;
        
        this.setupBackgroundAudio();

        try {
            // Global Autoplay listener for Agora Web SDK
            AgoraRTC.onAudioAutoplayFailed = () => {
                console.warn("[AGORA] Global AudioAutoplayFailed triggered");
                soundService.unlockAudio();
            };
            AgoraRTC.onAutoplayFailed = () => {
                console.warn("[AGORA] Global AutoplayFailed triggered");
                soundService.unlockAudio();
            };

            this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            console.log("[AGORA] Engine initialized successfully.");

            this.client.enableAudioVolumeIndicator();
            this.client.on('volume-indicator', (volumes) => {
                if (this.volumeCallback) {
                    this.volumeCallback(volumes.map(v => ({ uid: String(v.uid), level: v.level })));
                }
            });
            
            this.client.on('user-published', async (user, mediaType) => {
                if (mediaType === 'audio') {
                    console.log("[AGORA] New remote audio stream detected from user:", user.uid);
                    try {
                        const remoteAudioTrack = await this.client!.subscribe(user, mediaType);
                        if (remoteAudioTrack) {
                            if (this.isDeafened) {
                                remoteAudioTrack.setVolume(0);
                            } else {
                                remoteAudioTrack.setVolume(100);
                                try {
                                    await remoteAudioTrack.play();
                                    console.log("[AGORA] Remote audio played successfully for user:", user.uid);
                                } catch (playErr) {
                                    console.warn("[AGORA] Autoplay blocked for remote audio track, queuing:", playErr);
                                    this.pendingAudioTracks.add(remoteAudioTrack);
                                }
                            }
                        }
                    } catch (subErr) {
                        console.warn("[AGORA] Error subscribing to remote audio stream:", subErr);
                    }
                }
            });

            this.client.on('user-unpublished', async (user, mediaType) => {
                if (mediaType === 'audio') {
                    console.log("[AGORA] Remote user stopped audio:", user.uid);
                    if (user.audioTrack) {
                        try {
                            user.audioTrack.stop();
                        } catch (e) {}
                        this.pendingAudioTracks.delete(user.audioTrack);
                    }
                }
            });

            this.client.on('user-left', (user, reason) => {
                console.log("[AGORA] Remote user left channel:", user.uid, reason);
                if (user.audioTrack) {
                    try {
                        user.audioTrack.stop();
                    } catch (e) {}
                    this.pendingAudioTracks.delete(user.audioTrack);
                }
            });

            return this.client;
        } catch (err) {
            console.error("[AGORA] Failed to init Agora:", err);
            return null;
        }
    }

    public async joinAudioRoom(roomID: string, userID: string) {
        const finalRoomID = roomID.trim() || "default_room";

        // If already joined in this exact room, return early
        if (this.isJoined && this.currentRoomID === finalRoomID && this.client) {
            console.log(`[AGORA] Already joined in room: ${finalRoomID}`);
            return;
        }

        // If joined in a different room or currently leaving/resetting, clean up first
        if (this.isJoined || this.client || this.isLeaving) {
            console.log(`[AGORA] Switching room from ${this.currentRoomID} to ${finalRoomID}. Leaving previous channel...`);
            await this.leaveAudioRoom();
        }

        try {
            const client = await this.initEngine();
            if (!client) throw new Error("Agora client not initialized");

            const appId = import.meta.env.VITE_AGORA_APP_ID || "c7dfa22636da4b40980825480e3c090c";
            const appCertificate = import.meta.env.VITE_AGORA_APP_CERTIFICATE || "";
            const numericUid = uidToNumeric(userID);

            let token: string | null = null;
            if (appCertificate && appCertificate.trim()) {
                try {
                    const role = RtcRole.PUBLISHER;
                    const expirationTimeInSeconds = 3600 * 24;
                    const currentTimestamp = Math.floor(Date.now() / 1000);
                    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
                    token = RtcTokenBuilder.buildTokenWithUid(
                        appId,
                        appCertificate.trim(),
                        finalRoomID,
                        numericUid,
                        role,
                        privilegeExpiredTs,
                        privilegeExpiredTs
                    );
                    console.log(`[AGORA] Generated RTC token for room: ${finalRoomID}`);
                } catch (tokenErr) {
                    console.warn("[AGORA] Token generation error, trying null token:", tokenErr);
                }
            }

            console.log(`[AGORA] Joining channel ${finalRoomID} with Numeric UID: ${numericUid}...`);
            await client.join(appId, finalRoomID, token, numericUid);
            this.isJoined = true;
            this.currentRoomID = finalRoomID;
            console.log(`[AGORA] Successfully joined room: ${finalRoomID} with Numeric UID: ${numericUid}`);

            // Subscribe to any existing remote users who were already publishing
            for (const user of client.remoteUsers) {
                if (user.hasAudio && !user.audioTrack) {
                    try {
                        const remoteTrack = await client.subscribe(user, "audio");
                        if (remoteTrack) {
                            if (this.isDeafened) {
                                remoteTrack.setVolume(0);
                            } else {
                                remoteTrack.setVolume(100);
                                try {
                                    await remoteTrack.play();
                                } catch (e) {
                                    this.pendingAudioTracks.add(remoteTrack);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("[AGORA] Error subscribing to pre-existing user audio:", e);
                    }
                }
            }
        } catch (err: any) {
            const errMsg = String(err?.message || err?.name || err);
            if (errMsg.includes("WS_ABORT") || errMsg.includes("LEAVE")) {
                console.warn("[AGORA] Join aborted due to room switch.");
                return;
            }
            console.warn("[AGORA] Real Agora connection error:", err);
            this.isJoined = true;
            this.currentRoomID = finalRoomID;
            this.isPublishing = false;
        }
    }

    public async requestMicrophonePermission(): Promise<boolean> {
        try {
            if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                console.log("[AGORA] Prompting user explicitly for microphone permission...");
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                console.log("[AGORA] Microphone permission explicitly granted by user.");
                return true;
            }
            return false;
        } catch (err: any) {
            console.warn("[AGORA] Microphone permission request failed:", err);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent('agora-mic-denied'));
            }
            return false;
        }
    }

    public async startPublishing() {
        if (!this.isJoined) {
            console.warn("[AGORA] Cannot start publishing: not joined in channel yet.");
            return;
        }

        try {
            if (!this.client) {
                console.log("[AGORA-SIMULATION] Mic publishing simulated (no client).");
                this.isPublishing = true;
                return;
            }

            if (!this.localAudioTrack) {
                console.log("[AGORA] Creating microphone audio track...");
                this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                    AEC: true,
                    ANS: true,
                    AGC: true
                });
            }

            await this.localAudioTrack.setEnabled(true);

            const localTracks = this.client.localTracks || [];
            const isAlreadyPublished = localTracks.some(t => t.getTrackId() === this.localAudioTrack!.getTrackId());
            if (!isAlreadyPublished) {
                await this.client.publish([this.localAudioTrack]);
                console.log("[AGORA] Microphone audio track published successfully.");
            } else {
                console.log("[AGORA] Microphone audio track is already published and unmuted.");
            }

            this.isPublishing = true;
            this.hasAlertedPermissionDenied = false;
        } catch (e: any) {
            this.isPublishing = false;
            console.warn("[AGORA] Mic publishing failed or permission denied:", e);
            const errStr = String(e?.message || e || "");
            if (errStr.includes("PERMISSION_DENIED") || errStr.includes("Permission denied") || (e?.name === "NotAllowedError")) {
                if (!this.hasAlertedPermissionDenied) {
                    this.hasAlertedPermissionDenied = true;
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent('agora-mic-denied'));
                    }
                }
            }
        }
    }

    public async stopPublishing() {
        this.isPublishing = false;
        try {
            if (this.localAudioTrack) {
                await this.localAudioTrack.setEnabled(false);
                console.log("[AGORA] Local microphone muted successfully.");
            }
        } catch (e) {
            console.warn("[AGORA] Muting microphone failed (safe catch):", e);
        }
    }

    public async leaveAudioRoom() {
        if (this.isLeaving) {
            while (this.isLeaving) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return;
        }
        this.isLeaving = true;
        try {
            if (this.localAudioTrack) {
                try {
                    if (this.client) {
                        const localTracks = this.client.localTracks || [];
                        if (localTracks.some(t => t.getTrackId() === this.localAudioTrack!.getTrackId())) {
                            await this.client.unpublish([this.localAudioTrack]);
                        }
                    }
                    this.localAudioTrack.stop();
                    this.localAudioTrack.close();
                } catch (e) {}
                this.localAudioTrack = null;
            }
            this.isPublishing = false;

            if (this.client) {
                this.client.removeAllListeners();
                try {
                    await this.client.leave();
                } catch (leaveErr) {
                    console.warn("[AGORA] Error during client.leave():", leaveErr);
                }
                this.client = null;
            }
            this.isJoined = false;
            this.currentRoomID = null;
            console.log("[AGORA] Successfully left the audio room.");
        } catch (err) {
            console.warn("[AGORA] Error leaving room:", err);
            this.isJoined = false;
            this.currentRoomID = null;
        } finally {
            this.isLeaving = false;
        }
    }
}
