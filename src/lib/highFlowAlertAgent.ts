import { db } from "./firebase";
import { doc, getDoc, setDoc, arrayUnion } from "firebase/firestore";
import { detectarPadroesUso } from "./inconsistencyAgent";
import { InventoryItem } from "../types";

export const highFlowAlertAgent = {
  async verificar(orgId: string): Promise<void> {
    if (!orgId) return;

    try {
      // 1) Pega os top-15 SKUs de alto fluxo
      const padroes = await detectarPadroesUso(orgId);
      const skusAltoFluxo = padroes.frequentes.map(p => p.sku);

      if (skusAltoFluxo.length === 0) return;

      const hoje = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const diaRef = doc(db, `organizations/${orgId}/alertas_estoque/dia_${hoje}`);
      const diaSnap = await getDoc(diaRef);
      const diaData = diaSnap.exists() ? diaSnap.data() : { itensAlertados: [] };
      const jaAlertados: string[] = diaData.itensAlertados || [];

      const itensParaAlerta = [];
      const novosSkus = [];

      // 2) Checa o inventário para cada SKU
      for (const sku of skusAltoFluxo) {
        if (jaAlertados.includes(sku)) continue; // 3) Dedup
        
        const itemRef = doc(db, `organizations/${orgId}/inventory/${sku}`);
        const itemSnap = await getDoc(itemRef);
        
        if (itemSnap.exists()) {
          const item = itemSnap.data() as InventoryItem;
          const minQty = item.minQty || 0;
          if (item.qty <= minQty) {
            itensParaAlerta.push({
              sku: item.id || sku,
              nome: item.name,
              qty: item.qty,
              minQty: minQty
            });
            novosSkus.push(sku);
          }
        }
      }

      // 4) Para os novos, monta mensagem e dispara notify
      if (itensParaAlerta.length > 0) {
        const linhas = itensParaAlerta.map(i => `- ${i.nome} (SKU: ${i.sku}): Qtde Atual = ${i.qty}, Mínimo = ${i.minQty}`);
        const assunto = "AlmoxPro: itens de alto fluxo no minimo";
        const mensagem = `Os seguintes itens de alto fluxo atingiram o estoque mínimo ou estão abaixo dele:\n\n${linhas.join("\n")}`;
        
        const notifyUrl = import.meta.env?.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/api/notify` : "/api/notify";
        
        // Faz a chamada /api/notify
        await fetch(notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assunto, mensagem })
        }).catch(err => console.warn("[highFlowAlertAgent] erro no fetch notify:", err));

        // 5) Grava os SKUs alertados no doc do dia
        await setDoc(diaRef, {
          itensAlertados: arrayUnion(...novosSkus)
        }, { merge: true });
      }
    } catch (error) {
      console.warn("[highFlowAlertAgent] Erro na verificação:", error);
    }
  }
};
