import { doc, setDoc, getDoc, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { verificarEAlertar } from "./alertManager";
import { highFlowAlertAgent } from "./highFlowAlertAgent";

function gerarId(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
}

// SAÍDA para serviço: baixa do estoque, marca em campo
export async function registrarSaida(orgId: string, params: {
  sku: string; qty: number; destination: string;
  employeeId: string; employeeName: string;
  user: string; userEmail: string;
}) {
  const { sku, qty, destination, employeeId, employeeName, user, userEmail } = params;
  const batchId = gerarId("LOTE");
  const movId = gerarId("MOV");

  // registra movimento
  await setDoc(doc(db, `organizations/${orgId}/inventory/${sku}/movements`, movId), {
    id: movId, type: "OUT", qty, reason: `Saída p/ serviço: ${destination}`,
    date: new Date().toISOString(), user, userEmail,
    employeeId, employeeName, destination, batchId, status: "EM_CAMPO",
  });

  // baixa estoque e incrementa "em campo"
  const ref = doc(db, `organizations/${orgId}/inventory`, sku);
  await updateDoc(ref, {
    qty: increment(-qty),
    qtyEmCampo: increment(qty),
    updatedAt: serverTimestamp(),
  });

  const snapAtualizado = await getDoc(doc(db, `organizations/${orgId}/inventory`, sku));
  if (snapAtualizado.exists()) {
    const itemAtualizado = { id: sku, ...snapAtualizado.data() } as any;
    await verificarEAlertar(orgId, itemAtualizado);
  }

  // Hook fire-and-forget
  highFlowAlertAgent.verificar(orgId);

  return { batchId, movId };
}

// RETORNO do campo: soma ao estoque, reduz em campo
export async function registrarRetorno(orgId: string, params: {
  sku: string; qty: number; batchId?: string;
  employeeId: string; employeeName: string;
  user: string; userEmail: string;
}) {
  const { sku, qty, batchId, employeeId, employeeName, user, userEmail } = params;
  const movId = gerarId("MOV");

  await setDoc(doc(db, `organizations/${orgId}/inventory/${sku}/movements`, movId), {
    id: movId, type: "RETURN", qty, reason: "Retorno de serviço",
    date: new Date().toISOString(), user, userEmail,
    employeeId, employeeName, batchId: batchId ?? null, status: "CONCLUIDO",
  });

  const ref = doc(db, `organizations/${orgId}/inventory`, sku);
  await updateDoc(ref, {
    qty: increment(qty),
    qtyEmCampo: increment(-qty),
    updatedAt: serverTimestamp(),
  });

  const snapAtualizado = await getDoc(doc(db, `organizations/${orgId}/inventory`, sku));
  if (snapAtualizado.exists()) {
    const itemAtualizado = { id: sku, ...snapAtualizado.data() } as any;
    await verificarEAlertar(orgId, itemAtualizado);
  }

  return { movId };
}

// AJUSTE MANUAL: soma ou subtrai do estoque geral diretamente, sem "em campo"
export async function ajustarEstoque(orgId: string, params: {
  sku: string; tipo: "IN" | "OUT"; qty: number; motivo: string;
  user: string; userEmail: string;
}) {
  const { sku, tipo, qty, motivo, user, userEmail } = params;
  const movId = gerarId("MOV");

  // registra movimento
  await setDoc(doc(db, `organizations/${orgId}/inventory/${sku}/movements`, movId), {
    id: movId, type: tipo, qty, reason: motivo,
    date: new Date().toISOString(), user, userEmail,
    status: "CONCLUIDO", // ajuste direto concluído
  });

  // ajusta estoque
  const ref = doc(db, `organizations/${orgId}/inventory`, sku);
  const diff = tipo === "IN" ? qty : -qty;
  await updateDoc(ref, {
    qty: increment(diff),
    updatedAt: serverTimestamp(),
  });

  const snapAtualizado = await getDoc(doc(db, `organizations/${orgId}/inventory`, sku));
  if (snapAtualizado.exists()) {
    const itemAtualizado = { id: sku, ...snapAtualizado.data() } as any;
    await verificarEAlertar(orgId, itemAtualizado);
  }

  // Hook fire-and-forget
  highFlowAlertAgent.verificar(orgId);

  return { movId };
}
