import { collection, getDocs, query, limit, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface AlertaEstoque {
  sku: string;
  nome: string;
  qty: number;
  minQty: number;
  nivel: "CRITICO" | "MINIMO";
  fornecedores: { nome: string; contato: string }[];
}

export async function verificarEstoqueCritico(orgId: string): Promise<AlertaEstoque[]> {
  const [invSnap, supSnap] = await Promise.all([
    getDocs(query(collection(db, `organizations/${orgId}/inventory`), limit(300))),
    getDocs(collection(db, `organizations/${orgId}/suppliers`)),
  ]);

  const fornecedores = supSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const criticos: AlertaEstoque[] = [];

  for (const d of invSnap.docs) {
    const p = d.data();
    const qty = p.qty ?? 0;
    const minQty = p.minQty ?? 0;
    if (minQty === 0) continue;

    const nivel: "CRITICO" | "MINIMO" | null = qty === 0 ? "CRITICO" : qty <= minQty ? "MINIMO" : null;
    if (!nivel) continue;

    const fonsVinculados = fornecedores
      .filter(f =>
        (f.produtos && f.produtos.includes(d.id)) ||
        (f.category && p.category && f.category.toLowerCase() === p.category.toLowerCase())
      )
      .slice(0, 3)
      .map(f => ({ nome: f.name, contato: f.whatsapp ?? f.phone ?? "" }));

    criticos.push({ sku: d.id, nome: p.name, qty, minQty, nivel, fornecedores: fonsVinculados });
  }

  return criticos.sort((a, _b) => (a.nivel === "CRITICO" ? -1 : 1));
}

export async function verificarEAlertar(_orgId: string, item: any): Promise<{ nivel: string }> {
  if (!item || item.qty === undefined || item.minQty === undefined || item.minQty === 0) return { nivel: "" };
  if (item.qty === 0) return { nivel: "CRITICO" };
  if (item.qty <= item.minQty) return { nivel: "MINIMO" };
  return { nivel: "" };
}

export function gerarMensagemCorporativa(alertas: AlertaEstoque[], empresa = "Tecgas"): string {
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const criticos = alertas.filter(a => a.nivel === "CRITICO");
  const minimos = alertas.filter(a => a.nivel === "MINIMO");

  let msg = `*🏭 RELATÓRIO DE ESTOQUE — ${empresa}*\n📅 ${data}\n\n`;

  if (criticos.length > 0) {
    msg += `*🚨 ITENS ZERADOS (${criticos.length}):*\n`;
    criticos.forEach(a => {
      msg += `• *${a.nome}* (${a.sku})\n  Qtd: 0 | Mín: ${a.minQty}\n`;
      a.fornecedores.forEach(f => { msg += `  📞 ${f.nome}${f.contato ? `: ${f.contato}` : ""}\n`; });
      msg += "\n";
    });
  }

  if (minimos.length > 0) {
    msg += `*⚡ ESTOQUE BAIXO (${minimos.length}):*\n`;
    minimos.forEach(a => {
      msg += `• *${a.nome}* (${a.sku})\n  Qtd: ${a.qty} | Mín: ${a.minQty}\n`;
      a.fornecedores.forEach(f => { msg += `  📞 ${f.nome}${f.contato ? `: ${f.contato}` : ""}\n`; });
      msg += "\n";
    });
  }

  msg += `_Gerado automaticamente pelo AlmoxPro · LevtheDev_`;
  return msg;
}

export function abrirWhatsAppAlerta(mensagem: string, numero = "5591986181270") {
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
}

async function jaAlertouHoje(orgId: string): Promise<boolean> {
  const hoje = new Date().toISOString().split("T")[0];
  const snap = await getDoc(doc(db, `organizations/${orgId}/alertas_estoque`, `dia_${hoje}`));
  return snap.exists();
}

async function marcarAlertado(orgId: string) {
  const hoje = new Date().toISOString().split("T")[0];
  await setDoc(doc(db, `organizations/${orgId}/alertas_estoque`, `dia_${hoje}`), { em: serverTimestamp() });
}

export async function verificarEAlertarEstoque(orgId: string): Promise<{ alertas: AlertaEstoque[]; mensagem: string } | null> {
  if (await jaAlertouHoje(orgId)) return null;
  const alertas = await verificarEstoqueCritico(orgId);
  if (alertas.length === 0) return null;
  await marcarAlertado(orgId);
  return { alertas, mensagem: gerarMensagemCorporativa(alertas) };
}
