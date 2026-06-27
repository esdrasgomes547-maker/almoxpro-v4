import { useState, useEffect } from "react";
import { useOrganization } from "../lib/tenant";
import { detectarInconsistencias, RelatorioInconsistencias } from "../lib/inconsistencyAgent";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, X } from "lucide-react";

export function InconsistencyPanel() {
  const { orgId } = useOrganization();
  const [relatorio, setRelatorio] = useState<RelatorioInconsistencias | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [filtro, setFiltro] = useState<"TODOS" | "ALTA" | "MEDIA" | "BAIXA">("TODOS");

  const analisar = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const r = await detectarInconsistencias(orgId);
      setRelatorio(r);
      setVisivel(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Roda automaticamente quando o componente monta
  useEffect(() => {
    analisar();
  }, [orgId]);

  if (!visivel || (!loading && relatorio?.total === 0)) return null;

  const itensFiltrados = relatorio?.itens.filter(i =>
    filtro === "TODOS" ? true : i.severidade === filtro
  ) ?? [];

  const corSeveridade = { ALTA: "#e24b4a", MEDIA: "#00d4ff", BAIXA: "#378add" };
  const bgSeveridade = { ALTA: "rgba(226,75,74,0.08)", MEDIA: "rgba(0,212,255,0.08)", BAIXA: "rgba(55,138,221,0.08)" };
  const labelSeveridade = { ALTA: "🔴 Crítico", MEDIA: "🟡 Atenção", BAIXA: "🔵 Info" };

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(0,212,255,0.3)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" }}
        onClick={() => setExpandido(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loading
            ? <RefreshCw style={{ width: 16, height: 16, color: "#00d4ff", animation: "spin 1s linear infinite" }} />
            : relatorio?.criticas
              ? <AlertTriangle style={{ width: 16, height: 16, color: "#e24b4a" }} />
              : <AlertTriangle style={{ width: 16, height: 16, color: "#00d4ff" }} />
          }
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#e8f4ff", margin: 0 }}>
              {loading ? "Pro analisando o estoque..." : `${relatorio?.total ?? 0} inconsistências encontradas`}
            </p>
            {!loading && relatorio && (
              <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>{relatorio.resumo}</p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); analisar(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#4a7a9b", padding: 4 }}>
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
          <button onClick={e => { e.stopPropagation(); setVisivel(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#4a7a9b", padding: 4 }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
          {expandido ? <ChevronUp style={{ width: 14, height: 14, color: "#4a7a9b" }} /> : <ChevronDown style={{ width: 14, height: 14, color: "#4a7a9b" }} />}
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expandido && relatorio && (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 6, padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
            {(["TODOS", "ALTA", "MEDIA", "BAIXA"] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500,
                  background: filtro === f ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                  color: filtro === f ? "#e8f4ff" : "#4a7a9b" }}>
                {f === "TODOS" ? `Todos (${relatorio.total})` : f === "ALTA" ? `🔴 Críticos (${relatorio.itens.filter(i => i.severidade === "ALTA").length})` : f === "MEDIA" ? `🟡 Atenção (${relatorio.itens.filter(i => i.severidade === "MEDIA").length})` : `🔵 Info (${relatorio.itens.filter(i => i.severidade === "BAIXA").length})`}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px 0" }}>
            {itensFiltrados.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: corSeveridade[item.severidade], flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "#2a4a7a" }}>{item.sku}</span>
                    <span style={{ fontSize: 10, color: corSeveridade[item.severidade], background: bgSeveridade[item.severidade], padding: "1px 6px", borderRadius: 10 }}>{labelSeveridade[item.severidade]}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#e8f4ff", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</p>
                  <p style={{ fontSize: 11, color: "#4a7a9b", margin: "0 0 2px" }}>{item.descricao}</p>
                  <p style={{ fontSize: 11, color: "#378add", margin: 0 }}>→ {item.sugestao}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="justify-between">
            <span style={{ fontSize: 11, color: "#2a4a7a" }}>Analisado às {relatorio.geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            <button onClick={analisar} style={{ fontSize: 11, color: "#378add", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw style={{ width: 11, height: 11 }} /> Reanalisar
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
