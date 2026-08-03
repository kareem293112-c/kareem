// Web Audio Sound Service for Sada Al-Arab (صدى العرب)
// Generates high-fidelity synthesized sound effects for room entrance, gifts, mic toggle, and audio unlocking

class SoundService {
  private static instance: SoundService | null = null;
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.getAudioContext();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            this.isUnlocked = true;
          }).catch(() => {});
        } else if (this.ctx && this.ctx.state === 'running') {
          this.isUnlocked = true;
        }
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Play a pleasant room entrance sound chime (Disabled per user request)
   */
  public playRoomJoinSound(): void {
    // Disabled
  }

  /**
   * Play a grand VIP entrance chime (Disabled per user request)
   */
  public playVipEntranceSound(): void {
    // Disabled
  }

  /**
   * Play gift sound chime effect (Disabled per user request)
   */
  public playGiftSound(): void {
    // Disabled
  }

  /**
   * Play mic toggle sound (Disabled per user request)
   */
  public playMicToggleSound(_isUnmuted: boolean): void {
    // Disabled
  }

  /**
   * Play seat join/leave sound (Disabled per user request)
   */
  public playSeatSound(_isJoining: boolean): void {
    // Disabled
  }

  /**
   * Play private or match message receive/send chime (Disabled)
   */
  public playMessageSound(): void {
    // Disabled
  }

  /**
   * Play call connection chime (Disabled)
   */
  public playCallConnectSound(): void {
    // Disabled
  }
}

export const soundService = SoundService.getInstance();
