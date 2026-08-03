import { db } from '../lib/firebase';
import { updateDoc, doc, runTransaction, collection, increment } from 'firebase/firestore';

export const updateAuthorizedCoinAgent = async (
  userId: string, 
  newInventory: number
): Promise<void> => {
  await updateDoc(doc(db, "users", userId), {
    role: 'authorized_coin_agent',
    isAgent: true,
    agent_coin_inventory: newInventory
  });
};

export const processAgentTransfer = async (
  agentId: string,
  agentName: string,
  receiverId: string,
  receiverName: string,
  amount: number
): Promise<void> => {
  const agentRef = doc(db, "users", agentId);
  const receiverRef = doc(db, "users", receiverId);

  await runTransaction(db, async (transaction) => {
    const agentDoc = await transaction.get(agentRef);
    const receiverDoc = await transaction.get(receiverRef);

    if (!agentDoc.exists()) throw new Error("حساب الوكيل غير موجود");
    if (!receiverDoc.exists()) throw new Error("حساب المستلم غير موجود");

    const agentBalance = agentDoc.data().coins || 0;
    const receiverBalance = receiverDoc.data().coins || 0;

    if (agentBalance < amount) throw new Error("رصيد الوكيل غير كافي");

    transaction.update(agentRef, { coins: agentBalance - amount });
    transaction.update(receiverRef, { coins: receiverBalance + amount });

    // Log transaction
    const logRef = doc(collection(db, "agent_transfer_logs"));
    transaction.set(logRef, {
      id: logRef.id,
      agent_id: agentId,
      agent_name: agentName,
      receiver_id: receiverId,
      receiver_name: receiverName,
      coins_amount: amount,
      timestamp: new Date().toISOString()
    });
  });
};

export const rechargeAgentCoins = async (userId: string, amount: number): Promise<void> => {
  await updateDoc(doc(db, "users", userId), {
    agent_coin_inventory: increment(amount)
  });
};
