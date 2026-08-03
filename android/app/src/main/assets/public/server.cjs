var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_http = require("http");
var import_socket = require("socket.io");
import_dotenv.default.config();
var rootDir = process.cwd();
var configPath = import_path.default.join(rootDir, "firebase-applet-config.json");
if (!import_fs.default.existsSync(configPath)) {
  console.log("\u26A0\uFE0F [SERVER STARTUP] firebase-applet-config.json is missing. Checking environment variables...");
  const envConfig = process.env["firebase-applet-config.json"] || process.env.VITE_FIREBASE_CONFIG || process.env.FIREBASE_CONFIG;
  if (envConfig && envConfig.trim()) {
    try {
      const parsed = JSON.parse(envConfig.trim());
      import_fs.default.writeFileSync(configPath, JSON.stringify(parsed, null, 2), "utf8");
      console.log("\u2705 [SERVER STARTUP] Generated firebase-applet-config.json from environment variable!");
    } catch (err) {
      console.error("\u274C [SERVER STARTUP] Failed to parse env config JSON:", err.message);
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
    import_fs.default.writeFileSync(configPath, JSON.stringify(defaultSkeleton, null, 2), "utf8");
    console.log("\u26A0\uFE0F [SERVER STARTUP] Created a skeleton fallback firebase-applet-config.json.");
  }
}
var app = (0, import_express.default)();
var httpServer = (0, import_http.createServer)(app);
var allowedOrigins = [
  "https://chghr.onrender.com",
  "https://wif.onrender.com",
  "https://sada-alarab.onrender.com",
  "https://onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://ais-dev-qts7zckbddelnrwnra7g7o-150385904306.europe-west2.run.app",
  "https://ais-pre-qts7zckbddelnrwnra7g7o-150385904306.europe-west2.run.app"
];
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".onrender.com")) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-userid"],
  credentials: true
}));
app.use(import_express.default.json());
var dbInstance = null;
function getDb() {
  if (dbInstance) return dbInstance;
  const projectId = "gen-lang-client-0348881645";
  const databaseId = "ai-studio-sadaalarabvoiceb-5f452604-580f-4265-ab18-da9c404b3698";
  const keyPath = "/etc/secrets/firebase-key.json";
  if (import_fs.default.existsSync(keyPath)) {
    try {
      const keyContent = import_fs.default.readFileSync(keyPath, "utf8");
      if (keyContent && keyContent.trim()) {
        const serviceAccount = JSON.parse(keyContent.trim());
        const apps = (0, import_app.getApps)();
        let app2;
        if (apps.length === 0) {
          app2 = (0, import_app.initializeApp)({
            credential: (0, import_app.cert)(serviceAccount),
            projectId: serviceAccount.project_id || projectId
          });
        } else {
          app2 = apps[0];
        }
        const firestoreInstance = (0, import_firestore.getFirestore)(app2, databaseId);
        dbInstance = firestoreInstance;
        console.log("\u{1F525} [FIREBASE] Initialized with Service Account File");
        return dbInstance;
      }
    } catch (err) {
      console.error("\u274C [FIREBASE ERROR] Failed to initialize via file:", err.message);
    }
  }
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar && serviceAccountVar.trim()) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar.trim());
      const apps = (0, import_app.getApps)();
      let app2;
      if (apps.length === 0) {
        app2 = (0, import_app.initializeApp)({
          credential: (0, import_app.cert)(serviceAccount),
          projectId: serviceAccount.project_id || projectId
        });
      } else {
        app2 = apps[0];
      }
      const firestoreInstance = (0, import_firestore.getFirestore)(app2, databaseId);
      dbInstance = firestoreInstance;
      console.log("\u{1F525} [FIREBASE] Initialized via Environment Variable");
      return dbInstance;
    } catch (err) {
      console.error("\u274C [FIREBASE ERROR] Failed to initialize via env variable:", err.message);
    }
  }
  try {
    const apps = (0, import_app.getApps)();
    let app2;
    if (apps.length === 0) {
      app2 = (0, import_app.initializeApp)({
        projectId
      });
    } else {
      app2 = apps[0];
    }
    const firestoreInstance = (0, import_firestore.getFirestore)(app2, databaseId);
    dbInstance = firestoreInstance;
    console.log("\u26A0\uFE0F [FIREBASE] Initialized with fallback configuration (No service account)");
    return dbInstance;
  } catch (err) {
    console.error("\u274C [FIREBASE ERROR] Fallback initialization failed:", err.message);
    return null;
  }
}
try {
  const db = getDb();
  if (db) {
    db.collection("users").where("displayId", "==", "50505").get().then((snapshot) => console.log("\u{1F525} [STARTUP TEST] USERS FOUND:", snapshot.size)).catch((err) => console.log("\u26A0\uFE0F [STARTUP TEST] Skipped/Error (Quota likely exceeded)"));
  }
} catch (e) {
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var activeRoomPlayers = {};
var botPlayer = {
  id: "bot_1",
  name: "\u0627\u0644\u0645\u062D\u062A\u0631\u0641 \u{1F451}",
  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=bot_1",
  balance: 25e3,
  isBot: true
};
var gameState = {
  round: 1993,
  phase: "betting",
  timer: 15,
  winningFood: null,
  totalBets: {},
  userBets: {},
  allBetsList: [],
  history: ["pizza", "burger", "salad", "sushi", "chicken"]
};
var FOODS_LIST = ["chicken", "sushi", "salad", "burger", "steak", "watermelon", "cake", "pizza"];
var FOOD_MULTIPLIERS = {
  chicken: 45,
  sushi: 25,
  salad: 5,
  burger: 10,
  steak: 5,
  watermelon: 5,
  cake: 5,
  pizza: 15
};
var sseClients = /* @__PURE__ */ new Set();
function getCombinedRoomPlayers() {
  const players = Object.values(activeRoomPlayers);
  if (!players.some((p) => p.id === "bot_1")) {
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
      res.write(`data: ${payload}

`);
    } catch (err) {
      sseClients.delete(res);
    }
  }
}
setInterval(async () => {
  if (gameState.phase === "betting") {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      gameState.phase = "spinning";
      gameState.timer = 5;
      const randomIndex = Math.floor(Math.random() * FOODS_LIST.length);
      gameState.winningFood = FOODS_LIST[randomIndex];
      console.log(`\u{1F3A1} [GAME RESULT] Round: ${gameState.round} | Winning Food: ${gameState.winningFood}`);
    }
  } else if (gameState.phase === "spinning") {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      gameState.phase = "result";
      gameState.timer = 5;
      const winningFood = gameState.winningFood;
      const multiplier = FOOD_MULTIPLIERS[winningFood] || 1;
      console.log(`\u{1F3C1} [PROCESSING ROUND RESULT] Round: ${gameState.round} completed. Winning Food: ${winningFood}`);
      for (const [userId, bets] of Object.entries(gameState.userBets)) {
        const betAmount = bets[winningFood] || 0;
        if (betAmount > 0) {
          const reward = betAmount * multiplier;
          console.log(`\u{1F3C6} [WIN EVENT RECEIVED] User: ${userId} won! Bet on ${winningFood}: ${betAmount} | Reward: ${reward}`);
          const db = getDb();
          if (db) {
            try {
              let userDocRef;
              let usersSnapshot = await db.collection("users").where("displayId", "==", userId).get();
              if (usersSnapshot.empty) {
                const numId = Number(userId);
                if (!isNaN(numId)) {
                  usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
                }
              }
              if (usersSnapshot.empty) {
                userDocRef = db.collection("users").doc(userId);
              } else {
                userDocRef = usersSnapshot.docs[0].ref;
              }
              let finalBalance = 0;
              await db.runTransaction(async (transaction) => {
                const userSnap = await transaction.get(userDocRef);
                if (userSnap.exists) {
                  const currentCoins = userSnap.data()?.coins || 0;
                  finalBalance = currentCoins + reward;
                  transaction.update(userDocRef, { coins: finalBalance });
                }
              });
              console.log(`\u{1F4BE} [FIRESTORE BALANCE UPDATED] User: ${userId} balance updated in Firestore. Added: ${reward} | New Balance: ${finalBalance}`);
              if (activeRoomPlayers[userId]) {
                activeRoomPlayers[userId].balance = finalBalance;
              }
              console.log(`\u{1F4F2} [USER BALANCE SENT TO CLIENT] Streamed updated balance to User: ${userId}`);
            } catch (err) {
              console.error(`\u274C [PAYOUT ERROR] Failed to update user ${userId} in database:`, err.message);
            }
          }
        }
      }
    }
  } else if (gameState.phase === "result") {
    if (gameState.timer > 0) {
      gameState.timer--;
    } else {
      gameState.history.unshift(gameState.winningFood);
      if (gameState.history.length > 20) {
        gameState.history.pop();
      }
      gameState.round++;
      gameState.phase = "betting";
      gameState.timer = 15;
      gameState.winningFood = null;
      gameState.totalBets = {};
      gameState.userBets = {};
      gameState.allBetsList = [];
    }
  }
  broadcastState();
}, 1e3);
app.get("/api/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const userId = req.query.userId;
  const name = req.query.name || "Guest";
  const avatarUrl = req.query.avatarUrl || "";
  if (userId) {
    let balance = 0;
    const db = getDb();
    if (db) {
      try {
        let usersSnapshot = await db.collection("users").where("displayId", "==", userId).get();
        if (usersSnapshot.empty) {
          const numId = Number(userId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
          }
        }
        if (!usersSnapshot.empty) {
          balance = usersSnapshot.docs[0].data()?.coins || 0;
          console.log(`\u{1F4E1} [USER CONNECTED] Fetched balance from Firestore via displayId (${userId}): ${balance} coins`);
        } else {
          const docSnap = await db.collection("users").doc(userId).get();
          if (docSnap.exists) {
            balance = docSnap.data()?.coins || 0;
            console.log(`\u{1F4E1} [USER CONNECTED] Fetched balance from Firestore via docId (${userId}): ${balance} coins`);
          } else {
            console.warn(`\u26A0\uFE0F [USER CONNECTED] User not found in Firestore for id: ${userId}, defaulting to 0`);
          }
        }
      } catch (e) {
        console.error(`\u274C [USER CONNECTED ERROR] Failed to fetch balance for user ${userId}:`, e.message);
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
  res.write(`data: ${payload}

`);
  req.on("close", () => {
    sseClients.delete(res);
    if (userId) {
      delete activeRoomPlayers[userId];
    }
  });
});
app.post("/api/bet", async (req, res) => {
  const { userId, foodId, amount } = req.body;
  if (!userId || !foodId || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid bet parameters" });
    return;
  }
  if (gameState.phase !== "betting") {
    res.status(400).json({ error: "\u0627\u0644\u0645\u0631\u0627\u0647\u0646\u0627\u062A \u0645\u063A\u0644\u0642\u0629 \u062D\u0627\u0644\u064A\u0627\u064B!" });
    return;
  }
  const db = getDb();
  if (!db) {
    res.status(500).json({ error: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0635\u0644\u0629" });
    return;
  }
  try {
    let userDocRef;
    let usersSnapshot = await db.collection("users").where("displayId", "==", userId).get();
    if (usersSnapshot.empty) {
      const numId = Number(userId);
      if (!isNaN(numId)) {
        usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
      }
    }
    if (usersSnapshot.empty) {
      userDocRef = db.collection("users").doc(userId);
    } else {
      userDocRef = usersSnapshot.docs[0].ref;
    }
    let finalBalance = 0;
    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userDocRef);
      if (!userSnap.exists) {
        throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      }
      const currentCoins = userSnap.data()?.coins || 0;
      if (currentCoins < amount) {
        throw new Error("\u0631\u0635\u064A\u062F \u063A\u064A\u0631 \u0643\u0627\u0641\u064D");
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
      username: activeRoomPlayers[userId]?.name || "Guest",
      avatar: activeRoomPlayers[userId]?.avatar || "",
      foodId,
      amount
    });
    broadcastState();
    res.json({ success: true, balance: finalBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/sync-balance", (req, res) => {
  const { userId, balance } = req.body;
  if (!userId || balance === void 0) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  if (activeRoomPlayers[userId]) {
    activeRoomPlayers[userId].balance = balance;
  }
  broadcastState();
  res.json({ success: true, balance });
});
app.post("/api/add-balance", async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }
  const db = getDb();
  if (!db) {
    res.status(500).json({ error: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0635\u0644\u0629" });
    return;
  }
  try {
    let userDocRef;
    let usersSnapshot = await db.collection("users").where("displayId", "==", userId).get();
    if (usersSnapshot.empty) {
      const numId = Number(userId);
      if (!isNaN(numId)) {
        usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
      }
    }
    if (usersSnapshot.empty) {
      userDocRef = db.collection("users").doc(userId);
    } else {
      userDocRef = usersSnapshot.docs[0].ref;
    }
    let finalBalance = 0;
    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userDocRef);
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
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/send-gift", async (req, res) => {
  const { senderId, receiverId, giftCost, xpReward } = req.body;
  console.log(`[GIFT TRANSACTION] Sender: ${senderId}, Receiver: ${receiverId}, Cost: ${giftCost}, XP: ${xpReward}`);
  if (!senderId || !giftCost) {
    res.status(400).json({ error: "Missing gift parameters" });
    return;
  }
  res.json({ success: true, message: "Gift processed persistently on server" });
});
app.get("/api/admin/dashboard", (req, res) => {
  res.json({
    platformProfit: 1050,
    totalUsers: Object.keys(activeRoomPlayers).length + 1,
    totalRounds: gameState.round
  });
});
app.post("/api/admin/inject", (req, res) => {
  res.json({ success: true });
});
app.get("/api/logs", (req, res) => {
  res.json({ logs: [] });
});
var io = null;
io = new import_socket.Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});
io.on("connection", (socket) => {
  console.log("[SOCKET.IO] Client connected:", socket.id);
  socket.on("client:connect", async (data) => {
    console.log("[SOCKET.IO] Received client:connect from", socket.id, "with data:", data);
    if (!data) data = {};
    const displayId = data.displayId || data.userId || data.id;
    const name = data.name || data.username || "Player";
    const avatarUrl = data.avatarUrl || data.avatar || "";
    if (!displayId) {
      console.error("[SOCKET.IO] Missing displayId or userId in client:connect from socket", socket.id);
      socket.emit("error", { message: "Missing displayId or userId" });
      return;
    }
    const db = getDb();
    let userResult = {
      userId: displayId,
      name: name || "Player",
      avatar: avatarUrl || "",
      balance: 0
    };
    if (db) {
      try {
        let usersSnapshot = await db.collection("users").where("displayId", "==", displayId).get();
        if (usersSnapshot.empty) {
          const numId = Number(displayId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
          }
        }
        if (usersSnapshot.empty) {
          const docRef = db.collection("users").doc(displayId);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            const docData = docSnap.data();
            if (docData) {
              userResult = {
                userId: docSnap.id,
                name: docData.name || name || "Player",
                avatar: docData.avatar || avatarUrl || "",
                balance: docData.coins || 0
              };
            }
          }
        } else {
          const doc = usersSnapshot.docs[0];
          const docData = doc.data();
          userResult = {
            userId: doc.id,
            name: docData.name || name || "Player",
            avatar: docData.avatar || avatarUrl || "",
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
    socket.emit("game:connected", userResult);
    io.emit("server:status", {
      roomPlayers: getCombinedRoomPlayers()
    });
  });
  socket.on("win", async (data) => {
    console.log("[SOCKET.IO] Win event triggered! Data:", data);
    const { displayId, userId, amount } = data || {};
    const targetId = displayId || userId;
    const winAmount = Number(amount);
    if (!targetId || isNaN(winAmount) || winAmount <= 0) {
      console.error("\u274C [WIN EVENT ERROR] Invalid win payload received:", data);
      return;
    }
    console.log(`\u{1F3C6} [WIN EVENT RECEIVED] Socket win triggered. User: ${targetId} | Amount: ${winAmount}`);
    const db = getDb();
    if (db) {
      try {
        let userDocRef;
        let usersSnapshot = await db.collection("users").where("displayId", "==", targetId).get();
        if (usersSnapshot.empty) {
          const numId = Number(targetId);
          if (!isNaN(numId)) {
            usersSnapshot = await db.collection("users").where("displayId", "==", numId).get();
          }
        }
        if (usersSnapshot.empty) {
          userDocRef = db.collection("users").doc(targetId);
        } else {
          userDocRef = usersSnapshot.docs[0].ref;
        }
        let finalCoins = 0;
        await db.runTransaction(async (transaction) => {
          const userSnap = await transaction.get(userDocRef);
          if (!userSnap.exists) {
            throw new Error("User document does not exist");
          }
          const currentCoins = userSnap.data()?.coins || 0;
          finalCoins = currentCoins + winAmount;
          transaction.update(userDocRef, { coins: finalCoins });
        });
        console.log(`\u{1F4BE} [FIRESTORE BALANCE UPDATED] User: ${targetId} updated via win socket emit. Added: ${winAmount} | New Balance: ${finalCoins}`);
        if (activeRoomPlayers[targetId]) {
          activeRoomPlayers[targetId].balance = finalCoins;
        }
        console.log(`\u{1F4F2} [USER BALANCE SENT TO CLIENT] Broadcasting updated balance: ${finalCoins} to User: ${targetId}`);
        socket.emit("balance:updated", { userId: targetId, balance: finalCoins });
        io.emit("server:status", {
          roomPlayers: getCombinedRoomPlayers()
        });
      } catch (err) {
        console.error("\u274C [WIN EVENT ERROR] Failed to record socket win transaction:", err.message);
      }
    }
  });
  socket.on("disconnect", () => {
    console.log("[SOCKET.IO] Client disconnected:", socket.id);
  });
});
var isProd = process.env.NODE_ENV === "production";
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const PORT = 3e3;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} [SERVER] Running beautifully on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
