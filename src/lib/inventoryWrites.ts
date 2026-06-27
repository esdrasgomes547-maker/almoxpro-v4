import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { statsOnCreate, statsOnUpdate, statsOnDelete } from "./statsManager";

// Extrai apenas os campos seguros para exposição pública
function camposPublicos(data: Record<string, any>) {
  return {
    name:        data.name        ?? "",
    price:       data.price       ?? 0,
    imageUrl:    data.imageUrl    ?? data.image ?? "",
    description: data.description ?? "",
    category:    data.category    ?? "",
    // expõe só se TEM estoque, não a quantidade exata (não revela volume interno)
    emEstoque:   (data.qty ?? 0) > 0,
    updatedAt:   serverTimestamp(),
  };
}

// Cria/substitui item: grava no inventory (privado) e espelha no catalogo_publico
export async function saveInventoryItem(
  orgId: string,
  itemId: string,
  data: Record<string, any>
) {
  await setDoc(
    doc(db, `organizations/${orgId}/inventory`, itemId),
    { ...data, updatedAt: serverTimestamp() },
    { merge: false }
  );
  // Espelha versão pública
  await setDoc(
    doc(db, `organizations/${orgId}/catalogo_publico`, itemId),
    camposPublicos(data),
    { merge: true }
  );

  await statsOnCreate(orgId, data as any);
}

// Atualiza item: renova inventory e re-espelha o público
export async function updateInventoryItem(
  orgId: string,
  itemId: string,
  updates: Record<string, any>
) {
  const ref = doc(db, `organizations/${orgId}/inventory`, itemId);
  const antesSnap = await getDoc(ref);
  const antes = antesSnap.exists() ? antesSnap.data() : {};

  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
  
  // Lê o item completo para re-espelhar o público corretamente
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const depois = snap.data();
    await setDoc(
      doc(db, `organizations/${orgId}/catalogo_publico`, itemId),
      camposPublicos(depois),
      { merge: true }
    );
    await statsOnUpdate(orgId, antes as any, depois as any);
  }
}

// Remove item dos dois lugares
export async function deleteInventoryItem(orgId: string, itemId: string) {
  const ref = doc(db, `organizations/${orgId}/inventory`, itemId);
  const dadosSnap = await getDoc(ref);
  const dados = dadosSnap.exists() ? dadosSnap.data() : null;

  await deleteDoc(ref);
  await deleteDoc(doc(db, `organizations/${orgId}/catalogo_publico`, itemId));

  if (dados) {
    await statsOnDelete(orgId, dados as any);
  }
}

