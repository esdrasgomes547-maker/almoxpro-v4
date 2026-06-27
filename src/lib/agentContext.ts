import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";

export async function montarContexto(orgId: string): Promise<string> {
  const [invSnap, supSnap, movSnap] = await Promise.all([
    getDocs(query(collection(db, `organizations/${orgId}/inventory`), orderBy("name"), limit(100))),
    getDocs(collection(db, `organizations/${orgId}/suppliers`)),
    getDocs(query(collection(db, `organizations/${orgId}/activity_log`), orderBy("timestamp", "desc"), limit(20))),
  ]);

  const itensPrioritarios = invSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(p => (p.qty ?? 0) <= (p.minQty ?? 99))
    .slice(0, 30); // só os 30 mais críticos

  const outrosItens = invSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(p => (p.qty ?? 0) > (p.minQty ?? 0))
    .slice(0, 20); // amostra de 20 itens normais

  const todosPrioritarios = [...itensPrioritarios, ...outrosItens];

  const itensEstoque = todosPrioritarios.map(data => {
    return `- ${data.id}: ${data.name} | qty: ${data.qty} | mín: ${data.minQty ?? 0} | em campo: ${data.qtyEmCampo ?? 0} | categoria: ${data.category}`;
  }).join("\n");

  const fornecedores = supSnap.docs.map(d => {
    const data = d.data();
    return `- ${d.id}: ${data.name} | categoria: ${data.category} | WhatsApp: ${data.whatsapp ?? data.phone ?? "não cadastrado"} | avaliação: ${data.rating}/5`;
  }).join("\n");

  const atividades = movSnap.docs.map(d => {
    const data = d.data();
    return `- ${data.action ?? data.type} | ${data.itemName ?? ""} | ${data.timestamp?.toDate?.()?.toLocaleDateString("pt-BR") ?? ""}`;
  }).join("\n");

  const itensCriticos = itensPrioritarios
    .filter(d => (d.qty ?? 0) <= (d.minQty ?? 0))
    .map(d => `${d.name} (${d.qty} un)`)
    .join(", ");

  return `
Você é o Pro — assistente de inteligência industrial do AlmoxPro.
Especialista em gestão de estoque, logística industrial e suprimentos de GLP.

DADOS ATUAIS DA OPERAÇÃO:
- Fornecedores ativos:
${fornecedores}
- Itens críticos:
${itensCriticos}
- Estoque visível (max 100 itens):
${itensEstoque}
- Atividades recentes:
${atividades}

PERSONALIDADE:
- Direto, preciso e sofisticado — como um consultor sênior, não um robô
- Respostas concisas mas completas
- Nunca genérico — sempre baseado nos dados reais do estoque
- Tom profissional mas humano

FORMATAÇÃO OBRIGATÓRIA das respostas:
- Use **negrito** para nomes de produtos e valores importantes
- Separe seções com uma linha em branco
- Listas sempre no formato:
  → SKU | Nome | Quantidade | Status
- Status sempre com indicador visual:
  🔴 CRÍTICO (zerado)
  🟡 ALERTA (abaixo do mínimo)
  🟢 OK
  🔵 EM CAMPO
- Termine sempre com uma ação sugerida clara
- Nunca despeje tudo de uma vez — priorize por urgência
`.trim();
}
