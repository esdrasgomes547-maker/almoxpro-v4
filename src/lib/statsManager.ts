import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const statsRef = (orgId: string) =>
  doc(db, `organizations/${orgId}/stats/summary`);

export interface ResumoEstoque {
  totalItens: number;        // qtd de SKUs distintos
  totalUnidades: number;     // soma de qty de todos itens
  totalValor: number;        // soma de qty * price
  totalEmCampo: number;      // soma de qtyEmCampo
  itensCriticos: number;     // qtd zerados ou abaixo do mínimo
  atualizadoEm: any;
}

// Atualiza o stats quando um item é CRIADO
export async function statsOnCreate(orgId: string, item: { qty: number; price?: number; minQty?: number; qtyEmCampo?: number }) {
  const ref = doc(db, `organizations/${orgId}/stats`, "summary");
  const isCritico = (item.qty ?? 0) === 0 || (item.qty ?? 0) <= (item.minQty ?? 0);
  try {
    await updateDoc(ref, {
      totalItens: increment(1),
      totalUnidades: increment(item.qty ?? 0),
      totalValor: increment((item.qty ?? 0) * (item.price ?? 0)),
      totalEmCampo: increment(item.qtyEmCampo ?? 0),
      itensCriticos: increment(isCritico ? 1 : 0),
      atualizadoEm: serverTimestamp(),
    });
  } catch {
    // Doc não existe ainda — cria
    await setDoc(ref, {
      totalItens: 1,
      totalUnidades: item.qty ?? 0,
      totalValor: (item.qty ?? 0) * (item.price ?? 0),
      totalEmCampo: item.qtyEmCampo ?? 0,
      itensCriticos: isCritico ? 1 : 0,
      atualizadoEm: serverTimestamp(),
    });
  }
}

// Atualiza o stats quando um item é DELETADO
export async function statsOnDelete(orgId: string, item: { qty: number; price?: number; minQty?: number; qtyEmCampo?: number }) {
  const ref = doc(db, `organizations/${orgId}/stats`, "summary");
  const isCritico = (item.qty ?? 0) === 0 || (item.qty ?? 0) <= (item.minQty ?? 0);
  await updateDoc(ref, {
    totalItens: increment(-1),
    totalUnidades: increment(-(item.qty ?? 0)),
    totalValor: increment(-((item.qty ?? 0) * (item.price ?? 0))),
    totalEmCampo: increment(-(item.qtyEmCampo ?? 0)),
    itensCriticos: increment(isCritico ? -1 : 0),
    atualizadoEm: serverTimestamp(),
  });
}

// Atualiza o stats quando um item é EDITADO (passa antes/depois)
export async function statsOnUpdate(orgId: string,
  antes: { qty: number; price?: number; minQty?: number; qtyEmCampo?: number },
  depois: { qty: number; price?: number; minQty?: number; qtyEmCampo?: number }
) {
  const ref = doc(db, `organizations/${orgId}/stats`, "summary");

  const diffUnidades = (depois.qty ?? 0) - (antes.qty ?? 0);
  const diffValor = (depois.qty ?? 0) * (depois.price ?? 0) - (antes.qty ?? 0) * (antes.price ?? 0);
  const diffEmCampo = (depois.qtyEmCampo ?? 0) - (antes.qtyEmCampo ?? 0);

  const eraCritico = (antes.qty ?? 0) === 0 || (antes.qty ?? 0) <= (antes.minQty ?? 0);
  const ehCritico = (depois.qty ?? 0) === 0 || (depois.qty ?? 0) <= (depois.minQty ?? 0);
  const diffCriticos = (ehCritico ? 1 : 0) - (eraCritico ? 1 : 0);

  await updateDoc(ref, {
    totalUnidades: increment(diffUnidades),
    totalValor: increment(diffValor),
    totalEmCampo: increment(diffEmCampo),
    itensCriticos: increment(diffCriticos),
    atualizadoEm: serverTimestamp(),
  });
}

// Reconstrói o stats do zero lendo todo o inventário (use só quando necessário)
export async function reconstruirStats(orgId: string): Promise<ResumoEstoque> {
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, `organizations/${orgId}/inventory`));
  let totalItens = 0, totalUnidades = 0, totalValor = 0, totalEmCampo = 0, itensCriticos = 0;
  snap.docs.forEach(d => {
    const p = d.data();
    totalItens++;
    totalUnidades += (p.qty ?? 0);
    totalValor += (p.qty ?? 0) * (p.price ?? 0);
    totalEmCampo += (p.qtyEmCampo ?? 0);
    if ((p.qty ?? 0) === 0 || (p.qty ?? 0) <= (p.minQty ?? 0)) itensCriticos++;
  });
  const resumo: ResumoEstoque = { totalItens, totalUnidades, totalValor, totalEmCampo, itensCriticos, atualizadoEm: serverTimestamp() };
  await setDoc(doc(db, `organizations/${orgId}/stats`, "summary"), resumo);
  return resumo;
}

// Aplica a variação de um item ao resumo (delta = diferença)
export async function aplicarDeltaEstoque(
  orgId: string,
  delta: { valor: number; volume: number; categoria: string; deltaItens: number }
) {
  const ref = statsRef(orgId);
  try {
    await updateDoc(ref, {
      totalValue:  increment(delta.valor),
      totalVolume: increment(delta.volume),
      totalItens:  increment(delta.deltaItens),
      [`categorias.${delta.categoria}`]: increment(delta.valor),
      atualizadoEm: Date.now(),
    });
  } catch {
    // Se o doc não existe ainda, cria do zero
    await setDoc(ref, {
      totalValue:  delta.valor,
      totalVolume: delta.volume,
      totalItens:  delta.deltaItens,
      categorias:  { [delta.categoria]: delta.valor },
      atualizadoEm: Date.now(),
    }, { merge: true });
  }
}

// Lê o resumo (1 única leitura)
export async function lerResumo(orgId: string) {
  const snap = await getDoc(statsRef(orgId));
  return snap.exists() ? snap.data() : null;
}

