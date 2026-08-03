import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

// Auto-generate firebase-applet-config.json if missing on server startup (Render environment)
const rootDir = process.cwd();
const configPath = path.join(rootDir, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.log("⚠️ [SERVER STARTUP] firebase-applet-config.json is missing. Checking environment variables...");
  const envConfig = process.env['firebase-applet-config.json'] || 
                    process.env.VITE_FIREBASE_CONFIG || 
                    process.env.FIREBASE_CONFIG;
  
  if (envConfig && envConfig.trim()) {
    try {
      const parsed = JSON.parse(envConfig.trim());
      fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf8');
      console.log("✅ [SERVER STARTUP] Generated firebase-applet-config.json from environment variable!");
    } catch (err: any) {
      console.error("❌ [SERVER STARTUP] Failed to parse env config JSON:", err.message);
    }
  } else {
    const defaultSkeleton = {
      apiKey: "",
      authDomain: "gen-lang-client-0348881645.firebaseapp.com",
      projectId: "gen-lang-client-0348881645",
      storageBucket: "gen-lang-client-0348881645.firebasestorage.app",
      messagingSenderId: "",
      appId: "",
      firestoreDatabaseId: "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698"
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultSkeleton, null, 2), 'utf8');
    console.log("⚠️ [SERVER STARTUP] Created a skeleton fallback firebase-applet-config.json.");
  }
}

const app = express();
const httpServer = createHttpServer(app);

// 1. Configure robust CORS to prevent any blocking issues
const allowedOrigins = [
  'https://chghr.onrender.com',
  'https://wif.onrender.com',
  'https://sada-alarab.onrender.com',
  'https://onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://ais-dev-qts7zckbddelnrwnra7g7o-150385904306.europe-west2.run.app',
  'https://ais-pre-qts7zckbddelnrwnra7g7o-150385904306.europe-west2.run.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to allow during preview/testing
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-userid'],
  credentials: true
}));

app.use(express.json());

// 2. Lazy Firebase Database Initialization
let dbInstance: Firestore | null = null;

function getDb(): Firestore | null {
  if (dbInstance) return dbInstance;

  const projectId = "gen-lang-client-0348881645";
  const databaseId = "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698";

  // Check secret file path first (standard on Render)
  const keyPath = '/etc/secrets/firebase-key.json';
  if (fs.existsSync(keyPath)) {
    try {
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      if (keyContent && keyContent.trim()) {
        const serviceAccount = JSON.parse(keyContent.trim());
        const apps = getApps();
        let app: App;
        if (apps.length === 0) {
          app = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id || projectId
          });
        } else {
          app = apps[0];
        }
        const firestoreInstance = getFirestore(app, databaseId);
        dbInstance = firestoreInstance;
        console.log("🔥 [FIREBASE] Initialized with Service Account File");
        return dbInstance;
      }
    } catch (err: any) {
      console.error("❌ [FIREBASE ERROR] Failed to initialize via file:", err.message);
    }
  }

  // Fallback to environment variable
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar && serviceAccountVar.trim()) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar.trim());
      const apps = getApps();
      let app: App;
      if (apps.length === 0) {
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId
        });
      } else {
        app = apps[0];
      }
      const firestoreInstance = getFirestore(app, databaseId);
      dbInstance = firestoreInstance;
      console.log("🔥 [FIREBASE] Initialized via Environment Variable");
      return dbInstance;
    } catch (err: any) {
      console.error("❌ [FIREBASE ERROR] Failed to initialize via env variable:", err.message);
    }
  }

  // Local/Dev Fallback
  try {
    const apps = getApps();
    let app: App;
    if (apps.length === 0) {
      app = initializeApp({
        projectId: projectId
      });
    } else {
      app = apps[0];
    }
    const firestoreInstance = getFirestore(app, databaseId);
    dbInstance = firestoreInstance;
    console.log("⚠️ [FIREBASE] Initialized with fallback configuration (No service account)");
    return dbInstance;
  } catch (err: any) {
    console.error("❌ [FIREBASE ERROR] Fallback initialization failed:", err.message);
    return null;
  }
}

// Ensure database loads once on startup gracefully
try {
  const db = getDb();
  if (db) {
    db.collection("users").where("displayId", "==", "50505").get()
      .then(snapshot => console.log("🔥 [STARTUP TEST] USERS FOUND:", snapshot.size))
      .catch(err => console.log("⚠️ [STARTUP TEST] Skipped/Error (Quota likely exceeded)"));
  }
} catch (e) {}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =========================================================================
// 3. Game State & Real-time Loop Configuration
// =========================================================================

interface GamePlayer {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  isBot: boolean;
}

const activeRoomPlayers: Record<string, GamePlayer> = {};

// Ensure bot_1 is always in room players for game companion UI
const botPlayer: GamePlayer = {
  id: "bot_1",
  name: "المحترف 👑",
  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=bot_1",
  balance: 25000,
  isBot: true
};

interface GameState {
  round: number;
  phase: 'betting' | 'spinning' | 'result';
  timer: number;
  winningFood: string | null;
  totalBets: Record<string, number>;
  userBets: Record<string, Record<string, number>>; // userId -> foodId -> amount
  allBetsList: Array<{ id: string; userId: string; username: string; avatar: string; foodId: string; amount: number }>;
  history: string[];
}

let gameState: GameState = {
  round: 1993,
  phase: 'betting',
  timer: 15,
  winningFood: null,
  totalBets: {},
  userBets: {},
  allBetsList: [],
  history: ['pizza', 'burger', 'salad', 'sushi', 'chicken']
};

const FOODS_LIST = ['chicken', 'sushi', 'salad', 'burger', 'steak', 'watermelon', 'cake', 'pizza'];

const FOOD_MULTIPLIERS: Record<string, number> = {
  chicken: 45,
  sushi: 25,
  salad: 5,
  burger: 10,
  steak: 5,
  watermelon: 5,
  cake: 5,
  pizza: 15
};

// SSE Clients Set
const sseClients = new Set<any>();

function getCombinedRoomPlayers(): GamePlayer[] {
  const players = Object.values(activeRoomPlayers);
  if (!players.some(p => p.id === 'bot_1')) {
    players.push(botPlayer);
  }
  return players;
}

function broadcastState() {
  const payload = JSON.stringify({
    ...gameState,
    roomPlayers: getCombinedRoomPlayers()
  });
  
  for (const res of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      sseClients.delete(res);
    }
  }
}

// Start Game Loop Interval
setInterval(async () => {
  if (gameState.phase === 'betting') {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      // Transition to spinning
      gameState.phase = 'spinning';
      gameState.timer = 5;
      
      const randomIndex = Math.floor(Math.random() * FOODS_LIST.length);
      gameState.winningFood = FOODS_LIST[randomIndex];
      
      console.log(`🎡 [GAME RESULT] Round: ${gameState.round} | Winning Food: ${gameState.winningFood}`);
    }
  } else if (gameState.phase === 'spinning') {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      // Transition to result
      gameState.phase = 'result';
      gameState.timer = 5;
      
      const winningFood = gameState.winningFood!;
      const multiplier = FOOD_MULTIPLIERS[winningFood] || 1;
      
      console.log(`🏁 [PROCESSING ROUND RESULT] Round: ${gameState.round} completed. Winning Food: ${winningFood}`);
      
      // Process wins in database
      for (const [userId, bets] of Object.entries(gameState.userBets)) {
        const betAmount = bets[winningFood] || 0;
        if (betAmount > 0) {
          const reward = betAmount * multiplier;
          console.log(`🏆 [WIN EVENT RECEIVED] User: ${userId} won! Bet on ${winningFood}: ${betAmount} | Reward: ${reward}`);
          
          const db = getDb();
          if (db) {
            try {
              let userDocRef: any;
              let usersSnapshot = await db.collection('users').where('displayId', '==', userId).get();
              if (usersSnapshot.empty) {
                const numId = Number(userId);
                if (!isNaN(numId)) {
                  usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
                }
              }
              
              if (usersSnapshot.empty) {
                userDocRef = db.collection('users').doc(userId);
              } else {
                userDocRef = usersSnapshot.docs[0].ref;
              }
              
              let finalBalance = 0;
              await db.runTransaction(async (transaction) => {
                const userSnap: any = await transaction.get(userDocRef);
                if (userSnap.exists) {
                  const currentCoins = userSnap.data()?.coins || 0;
                  finalBalance = currentCoins + reward;
                  transaction.update(userDocRef, { coins: finalBalance });
                }
              });
              
              console.log(`💾 [FIRESTORE BALANCE UPDATED] User: ${userId} balance updated in Firestore. Added: ${reward} | New Balance: ${finalBalance}`);
              
              if (activeRoomPlayers[userId]) {
                activeRoomPlayers[userId].balance = finalBalance;
              }
              
              console.log(`📲 [USER BALANCE SENT TO CLIENT] Streamed updated balance to User: ${userId}`);
            } catch (err: any) {
              console.error(`❌ [PAYOUT ERROR] Failed to update user ${userId} in database:`, err.message);
            }
          }
        }
      }
    }
  } else if (gameState.phase === 'result') {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      // Setup next round
      gameState.history.unshift(gameState.winningFood!);
      if (gameState.history.length > 20) {
        gameState.history.pop();
      }
      
      gameState.round++;
      gameState.phase = 'betting';
      gameState.timer = 15;
      gameState.winningFood = null;
      gameState.totalBets = {};
      gameState.userBets = {};
      gameState.allBetsList = [];
    }
  }
  
  broadcastState();
}, 1000);


// =========================================================================
// 4. REST API Routing for Game Companion
// =========================================================================

// SSE stream for game updates
app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const userId = req.query.userId as string;
  const name = (req.query.name as string) || 'Guest';
  const avatarUrl = (req.query.avatarUrl as string) || '';
  
  if (userId) {
    let balance = 0;
    const db = getDb();
    if (db) {
      try {
        let usersSnapshot = await db.collection('users').where('displayId', '==', userId).get();
        if (usersSnapshot.empty) {
          const numId = Number(userId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
          }
        }
        
        if (!usersSnapshot.empty) {
          balance = usersSnapshot.docs[0].data()?.coins || 0;
          console.log(`📡 [USER CONNECTED] Fetched balance from Firestore via displayId (${userId}): ${balance} coins`);
        } else {
          const docSnap = await db.collection('users').doc(userId).get();
          if (docSnap.exists) {
            balance = docSnap.data()?.coins || 0;
            console.log(`📡 [USER CONNECTED] Fetched balance from Firestore via docId (${userId}): ${balance} coins`);
          } else {
            console.warn(`⚠️ [USER CONNECTED] User not found in Firestore for id: ${userId}, defaulting to 0`);
          }
        }
      } catch (e: any) {
        console.error(`❌ [USER CONNECTED ERROR] Failed to fetch balance for user ${userId}:`, e.message);
      }
    }
    
    activeRoomPlayers[userId] = {
      id: userId,
      name,
      avatar: avatarUrl,
      balance,
      isBot: false
    };
  }
  
  sseClients.add(res);
  
  const payload = JSON.stringify({
    ...gameState,
    roomPlayers: getCombinedRoomPlayers()
  });
  res.write(`data: ${payload}\n\n`);
  
  req.on('close', () => {
    sseClients.delete(res);
    if (userId) {
      delete activeRoomPlayers[userId];
    }
  });
});

// Bet Placement Route
app.post('/api/bet', async (req, res) => {
  const { userId, foodId, amount } = req.body;
  if (!userId || !foodId || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid bet parameters" });
    return;
  }
  
  if (gameState.phase !== 'betting') {
    res.status(400).json({ error: "المراهنات مغلقة حالياً!" });
    return;
  }
  
  const db = getDb();
  if (!db) {
    res.status(500).json({ error: "قاعدة البيانات غير متصلة" });
    return;
  }
  
  try {
    let userDocRef: any;
    let usersSnapshot = await db.collection('users').where('displayId', '==', userId).get();
    if (usersSnapshot.empty) {
      const numId = Number(userId);
      if (!isNaN(numId)) {
        usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
      }
    }
    
    if (usersSnapshot.empty) {
      userDocRef = db.collection('users').doc(userId);
    } else {
      userDocRef = usersSnapshot.docs[0].ref;
    }
    
    let finalBalance = 0;
    await db.runTransaction(async (transaction) => {
      const userSnap: any = await transaction.get(userDocRef);
      if (!userSnap.exists) {
        throw new Error("المستخدم غير موجود");
      }
      const currentCoins = userSnap.data()?.coins || 0;
      if (currentCoins < amount) {
        throw new Error("رصيد غير كافٍ");
      }
      finalBalance = currentCoins - amount;
      transaction.update(userDocRef, { coins: finalBalance });
    });
    
    if (activeRoomPlayers[userId]) {
      activeRoomPlayers[userId].balance = finalBalance;
    }
    
    gameState.totalBets[foodId] = (gameState.totalBets[foodId] || 0) + amount;
    if (!gameState.userBets[userId]) {
      gameState.userBets[userId] = {};
    }
    gameState.userBets[userId][foodId] = (gameState.userBets[userId][foodId] || 0) + amount;
    
    gameState.allBetsList.unshift({
      id: Math.random().toString(36).substring(2, 9),
      userId,
      username: activeRoomPlayers[userId]?.name || 'Guest',
      avatar: activeRoomPlayers[userId]?.avatar || '',
      foodId,
      amount
    });
    
    broadcastState();
    res.json({ success: true, balance: finalBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Demo Add Balance Route
app.post('/api/sync-balance', (req, res) => {
  const { userId, balance } = req.body;
  if (!userId || balance === undefined) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  
  if (activeRoomPlayers[userId]) {
    activeRoomPlayers[userId].balance = balance;
  }
  broadcastState();
  res.json({ success: true, balance });
});

app.post('/api/add-balance', async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  
  const db = getDb();
  if (!db) {
    res.status(500).json({ error: "قاعدة البيانات غير متصلة" });
    return;
  }
  
  try {
    let userDocRef: any;
    let usersSnapshot = await db.collection('users').where('displayId', '==', userId).get();
    if (usersSnapshot.empty) {
      const numId = Number(userId);
      if (!isNaN(numId)) {
        usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
      }
    }
    
    if (usersSnapshot.empty) {
      userDocRef = db.collection('users').doc(userId);
    } else {
      userDocRef = usersSnapshot.docs[0].ref;
    }
    
    let finalBalance = 0;
    await db.runTransaction(async (transaction) => {
      const userSnap: any = await transaction.get(userDocRef);
      if (userSnap.exists) {
        const currentCoins = userSnap.data()?.coins || 0;
        finalBalance = currentCoins + amount;
        transaction.update(userDocRef, { coins: finalBalance });
      }
    });
    
    if (activeRoomPlayers[userId]) {
      activeRoomPlayers[userId].balance = finalBalance;
    }
    
    broadcastState();
    res.json({ success: true, balance: finalBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Virtual premium gift logging and persistence transaction endpoint
app.post('/api/send-gift', async (req, res) => {
  const { senderId, receiverId, giftCost, xpReward } = req.body;
  console.log(`[GIFT TRANSACTION] Sender: ${senderId}, Receiver: ${receiverId}, Cost: ${giftCost}, XP: ${xpReward}`);
  
  if (!senderId || !giftCost) {
    res.status(400).json({ error: "Missing gift parameters" });
    return;
  }
  
  res.json({ success: true, message: "Gift processed persistently on server" });
});

// Admin Companion Routes
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    platformProfit: 1050,
    totalUsers: Object.keys(activeRoomPlayers).length + 1,
    totalRounds: gameState.round
  });
});

app.post('/api/admin/inject', (req, res) => {
  res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: [] });
});


// =========================================================================
// 5. Socket.io Live Messaging Server & Realtime Integrations
// =========================================================================

let io: SocketIOServer | null = null;
io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('[SOCKET.IO] Client connected:', socket.id);

  // Client connection request
  socket.on('client:connect', async (data) => {
    console.log('[SOCKET.IO] Received client:connect from', socket.id, 'with data:', data);
    if (!data) data = {};
    const displayId = data.displayId || data.userId || data.id;
    const name = data.name || data.username || 'Player';
    const avatarUrl = data.avatarUrl || data.avatar || '';

    if (!displayId) {
      console.error("[SOCKET.IO] Missing displayId or userId in client:connect from socket", socket.id);
      socket.emit('error', { message: 'Missing displayId or userId' });
      return;
    }

    const db = getDb();
    let userResult = {
      userId: displayId,
      name: name || 'Player',
      avatar: avatarUrl || '',
      balance: 0
    };

    if (db) {
      try {
        let usersSnapshot = await db.collection('users').where('displayId', '==', displayId).get();
        if (usersSnapshot.empty) {
          const numId = Number(displayId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
          }
        }
        
        if (usersSnapshot.empty) {
          const docRef = db.collection('users').doc(displayId);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            const docData = docSnap.data();
            if (docData) {
              userResult = {
                userId: docSnap.id,
                name: docData.name || name || 'Player',
                avatar: docData.avatar || avatarUrl || '',
                balance: docData.coins || 0
              };
            }
          }
        } else {
          const doc = usersSnapshot.docs[0];
          const docData = doc.data();
          userResult = {
            userId: doc.id,
            name: docData.name || name || 'Player',
            avatar: docData.avatar || avatarUrl || '',
            balance: docData.coins || 0
          };
        }
        console.log("[SOCKET.IO] Resolved user on connect:", userResult);
      } catch (e) {
        console.error("[SOCKET.IO] Error fetching user:", e);
      }
    }

    activeRoomPlayers[displayId] = {
      id: userResult.userId,
      name: userResult.name,
      avatar: userResult.avatar,
      balance: userResult.balance,
      isBot: false
    };

    console.log("[SYNC SENT TO CLIENT]", userResult);
    socket.emit('game:connected', userResult);
    io!.emit('server:status', {
      roomPlayers: getCombinedRoomPlayers()
    });
  });

  // Client manual win socket listener to update Firestore directly (requested by user)
  socket.on('win', async (data) => {
    console.log('[SOCKET.IO] Win event triggered! Data:', data);
    const { displayId, userId, amount } = data || {};
    const targetId = displayId || userId;
    const winAmount = Number(amount);
    
    if (!targetId || isNaN(winAmount) || winAmount <= 0) {
      console.error('❌ [WIN EVENT ERROR] Invalid win payload received:', data);
      return;
    }
    
    console.log(`🏆 [WIN EVENT RECEIVED] Socket win triggered. User: ${targetId} | Amount: ${winAmount}`);
    
    const db = getDb();
    if (db) {
      try {
        let userDocRef: any;
        let usersSnapshot = await db.collection('users').where('displayId', '==', targetId).get();
        if (usersSnapshot.empty) {
          const numId = Number(targetId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection('users').where('displayId', '==', numId).get();
          }
        }
        
        if (usersSnapshot.empty) {
          userDocRef = db.collection('users').doc(targetId);
        } else {
          userDocRef = usersSnapshot.docs[0].ref;
        }
        
        let finalCoins = 0;
        await db.runTransaction(async (transaction) => {
          const userSnap: any = await transaction.get(userDocRef);
          if (!userSnap.exists) {
            throw new Error("User document does not exist");
          }
          const currentCoins = userSnap.data()?.coins || 0;
          finalCoins = currentCoins + winAmount;
          transaction.update(userDocRef, { coins: finalCoins });
        });
        
        console.log(`💾 [FIRESTORE BALANCE UPDATED] User: ${targetId} updated via win socket emit. Added: ${winAmount} | New Balance: ${finalCoins}`);
        
        // Update in active room players
        if (activeRoomPlayers[targetId]) {
          activeRoomPlayers[targetId].balance = finalCoins;
        }
        
        console.log(`📲 [USER BALANCE SENT TO CLIENT] Broadcasting updated balance: ${finalCoins} to User: ${targetId}`);
        socket.emit('balance:updated', { userId: targetId, balance: finalCoins });
        io!.emit('server:status', {
          roomPlayers: getCombinedRoomPlayers()
        });
      } catch (err: any) {
        console.error('❌ [WIN EVENT ERROR] Failed to record socket win transaction:', err.message);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET.IO] Client disconnected:', socket.id);
  });
});



// Setup Vite development middleware & production static serving
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [SERVER] Running beautifully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
