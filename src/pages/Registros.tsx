import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useOrganization } from "../lib/tenant";
import { Download, Mail, FileText } from "lucide-react";

interface Registro {
  id: string;
  destino: string;
  employeeName: string;
  totalCusto: number;
  totalVenda: number;
  margem: number;
  data: any;
  itens: any[];
}

export function Registros() {
  const { orgId } = useOrganization();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<Registro | null>(null);

  useEffect(() => {
    if (!orgId) return;
    getDocs(query(
      collection(db, `organizations/${orgId}/relatorios_operacao`),
      orderBy("data", "desc"),
      limit(50)
    )).then(snap => {
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() } as Registro)));
      setLoading(false);
    });
  }, [orgId]);

  const fmtR = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace(".", ",")}`;
  const fmtData = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const gerarTexto = (r: Registro) => {
    const itens = r.itens?.map(i =>
      `• ${i.nome} (${i.sku}) × ${i.qty} — custo: ${fmtR(i.custoTotal)} | venda: ${fmtR(i.vendaTotal)}`
    ).join("\n") ?? "";
    return `RELATÓRIO DE OPERAÇÃO — AlmoxPro\n\nData: ${fmtData(r.data)}\nDestino: ${r.destino}\nResponsável: ${r.employeeName}\n\nPRODUTOS:\n${itens}\n\nTOTAL CUSTO: ${fmtR(r.totalCusto)}\nTOTAL VENDA: ${fmtR(r.totalVenda)}\nMARGEM: ${fmtR(r.margem)}\n\n— Gerado pelo AlmoxPro · LevtheDev`;
  };

  const exportarWhatsApp = (r: Registro) => {
    const texto = encodeURIComponent(gerarTexto(r));
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  };

  const exportarEmail = (r: Registro) => {
    const texto = gerarTexto(r);
    const assunto = encodeURIComponent(`Relatório AlmoxPro — ${r.destino}`);
    const corpo = encodeURIComponent(texto);
    window.open(`mailto:?subject=${assunto}&body=${corpo}`, "_blank");
  };

  const exportarPDF = (r: Registro) => {
    const janela = window.open("", "_blank");
    if (!janela) return;
    janela.document.write(`
      <html><head><title>Relatório AlmoxPro</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 20px; color: #1b365d; border-bottom: 2px solid #1b365d; padding-bottom: 8px; }
        .info { margin: 16px 0; }
        .info span { font-weight: bold; }
        .item { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .totais { margin-top: 20px; background: #f5f5f5; padding: 16px; border-radius: 8px; }
        .totais div { display: flex; justify-content: space-between; margin: 4px 0; }
        .margem { color: #16a34a; font-weight: bold; font-size: 18px; }
        .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: center; }
      </style></head><body>
      <h1>Relatório de Operação — AlmoxPro</h1>
      <div class="info"><p>Data: <span>${fmtData(r.data)}</span></p>
      <p>Destino: <span>${r.destino}</span></p>
      <p>Responsável: <span>${r.employeeName}</span></p></div>
      <h2 style="font-size:15px;color:#1b365d">Produtos</h2>
      ${r.itens?.map(i => `
        <div class="item">
          <span>${i.nome} (${i.sku}) × ${i.qty}</span>
          <span>Custo: ${fmtR(i.custoTotal)} | Venda: ${fmtR(i.vendaTotal)}</span>
        </div>`).join("") ?? ""}
      <div class="totais">
        <div><span>Total custo</span><span>${fmtR(r.totalCusto)}</span></div>
        <div><span>Total venda</span><span style="color:#16a34a">${fmtR(r.totalVenda)}</span></div>
        <div><span>Margem</span><span class="margem">${fmtR(r.margem)}</span></div>
      </div>
      <div class="footer">Gerado pelo AlmoxPro · Desenvolvido por LevtheDev · Esdras Nunes · Belém, PA</div>
      <script>window.print();</script>
      </body></html>
    `);
    janela.document.close();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-surface">Registros de Saída</h1>
        <span className="text-xs text-on-surface-variant">{registros.length} operações</span>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && registros.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum registro encontrado.</p>
          <p className="text-sm mt-1">As saídas em lote aparecerão aqui.</p>
        </div>
      )}

      <div className="space-y-3">
        {registros.map(r => (
          <div key={r.id}
            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden">
            <div
              className="p-4 cursor-pointer hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
              onClick={() => setSelecionado(selecionado?.id === r.id ? null : r)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface truncate">{r.destino}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {r.employeeName} · {fmtData(r.data)}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {r.itens?.length ?? 0} produto(s)
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-on-surface-variant">Custo: {fmtR(r.totalCusto)}</p>
                  <p className="text-sm font-bold text-[#378add]">Margem: {fmtR(r.margem)}</p>
                </div>
              </div>
            </div>

            {selecionado?.id === r.id && (
              <div className="border-t border-[hsl(var(--border))]">
                <div className="p-4 space-y-2">
                  {r.itens?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-[hsl(var(--border)/0.5)] last:border-0">
                      <div>
                        <p className="font-medium text-on-surface">{item.nome}</p>
                        <p className="text-xs text-on-surface-variant">{item.sku} × {item.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Custo: {fmtR(item.custoTotal)}</p>
                        <p className="text-xs font-medium text-[#378add]">Venda: {fmtR(item.vendaTotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-[hsl(var(--muted))] flex gap-2">
                  <button onClick={() => exportarPDF(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[hsl(var(--primary))] text-white text-xs font-bold active:scale-95 transition-transform">
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button onClick={() => exportarEmail(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-on-surface text-xs font-bold active:scale-95 transition-transform">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button onClick={() => exportarWhatsApp(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#378add]/10 text-white text-xs font-bold active:scale-95 transition-transform">
                    <Download className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
