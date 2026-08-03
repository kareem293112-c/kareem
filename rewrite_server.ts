import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Add activeRoomPlayers at the top
content = content.replace(
  "let platformProfit = 0;",
  `let platformProfit = 0;
interface GamePlayer {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  isBot: boolean;
}
const activeRoomPlayers: Record<string, GamePlayer> = {};`
);

// 2. Modify getGameStatePayload to include roomPlayers
content = content.replace(
  "    players: [],",
  "    players: [],\n    roomPlayers: Object.values(activeRoomPlayers),"
);

// 3. Modify sseHandler to register users and their balance
content = content.replace(
  "  sseClients.add(res);",
  `  sseClients.add(res);

  const userId = req.query.userId as string;
  if (userId) {
    activeRoomPlayers[userId] = {
      id: userId,
      name: (req.query.name as string) || 'Guest',
      avatar: (req.query.avatarUrl as string) || '',
      balance: parseInt((req.query.balance as string) || '0', 10),
      isBot: false
    };
    req.on('close', () => {
      delete activeRoomPlayers[userId];
    });
  }`
);

// 4. Modify placeBetHandler to deduct balance in-memory, removing Firestore transaction
const placeBetFirestoreLogic = `    const db = getDb();
    if (!db) {
      res.status(500).json({ error: "قاعدة بيانات الفايربيز غير متصلة بالسيرفر حالياً" });
      return;
    }

    const userRef = db.collection('users').doc(userId);
    let finalCoins = 0;

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("المستخدم غير موجود");
      }
      
      const userData = userDoc.data();
      const currentCoins = userData?.coins || 0;
      
      if (currentCoins < amount) {
        throw new Error("رصيد غير كافٍ");
      }

      finalCoins = currentCoins - amount;
      transaction.update(userRef, { coins: finalCoins });
    });`;

const newPlaceBetLogic = `    // In-memory balance deduction
    if (activeRoomPlayers[userId]) {
      if (activeRoomPlayers[userId].balance < amount) {
        res.status(400).json({ error: "رصيد غير كافٍ" });
        return;
      }
      activeRoomPlayers[userId].balance -= amount;
    }`;

content = content.replace(placeBetFirestoreLogic, newPlaceBetLogic);

// 5. Modify payout logic in setInterval (processRoundResult)
const payoutFirestoreLogic = `  const db = getDb();
  if (!db) {
    console.error("⚠️ [PAYOUTS] Database is not available. Skipping payout transactions.");
    return;
  }

  for (const bet of winners) {
    try {
      const userRef = db.collection('users').doc(bet.userId);
      const reward = bet.amount * multiplier;
      
      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const currentCoins = userDoc.data()?.coins || 0;
          transaction.update(userRef, { coins: currentCoins + reward });
          console.log(\`✅ [PAYOUT] Awarded \${reward} to \${bet.userId}\`);
        }
      });
    } catch (err: any) {
      console.error(\`❌ [PAYOUT ERROR] Failed for \${bet.userId}:\`, err.message);
    }
  }`;

const newPayoutLogic = `  // In-memory payouts
  for (const bet of winners) {
    const reward = bet.amount * multiplier;
    if (activeRoomPlayers[bet.userId]) {
      activeRoomPlayers[bet.userId].balance += reward;
      console.log(\`✅ [PAYOUT] Awarded \${reward} to \${bet.userId} (in-memory)\`);
    }
  }`;

content = content.replace(payoutFirestoreLogic, newPayoutLogic);

fs.writeFileSync('server.ts', content, 'utf8');
console.log("Rewrote server.ts successfully");
