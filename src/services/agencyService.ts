import { db } from '../lib/firebase';
import { collection, setDoc, updateDoc, doc } from 'firebase/firestore';

export const saveAgencyData = async (
  userId: string, 
  displayId: string,
  agencyName: string, 
  ownerName: string, 
  whatsappNumber: string
): Promise<string> => {
  const agencyData = {
    owner_id: userId,
    display_id: displayId,
    agency_name: agencyName,
    owner_name: ownerName,
    whatsapp_number: whatsappNumber,
    created_at: new Date().toISOString()
  };

  await setDoc(doc(db, "agencies", displayId), agencyData);
  await updateDoc(doc(db, "users", userId), {
    role: 'agency_owner',
    agencyId: displayId,
    agencyName: agencyName
  });
  return displayId;
};

export const toggleUserAgentStatus = async (userId: string, isAgent: boolean): Promise<void> => {
  await updateDoc(doc(db, "users", userId), {
    isAgent: isAgent
  });
};

export const updateUserWhatsapp = async (userId: string, whatsapp: string): Promise<void> => {
  await updateDoc(doc(db, "users", userId), {
    whatsapp: whatsapp
  });
};
