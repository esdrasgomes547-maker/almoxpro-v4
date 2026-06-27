import { useState } from "react";
import { FileText, Download, Plus, X, ChevronLeft } from "lucide-react";
import { gerarRegistroDesmontagem } from "../lib/generators/registroDesmontagem";

interface ItemDoc { qtd: string; unid: string; descricao: string; }

export function Documentos() {
  const [tela, setTela] = useState<"lista" | "form">("lista");
  const [cliente, setCliente] = useState("");
  const [responsavel, setResponsavel] = useState("TECGAS");
  const [itens, setItens] = useState<ItemDoc[]>([{ qtd: "", unid: "", descricao: "" }]);
  const [gerando, setGerando] = useState(false);

  const addLinha = () => setItens(p => [...p, { qtd: "", unid: "", descricao: "" }]);
  const remLinha = (i: number) => setItens(p => p.filter((_, j) => j !== i));
  const setItem = (i: number, k: keyof ItemDoc, v: string) =>
    setItens(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const gerar = async () => {
    setGerando(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/assets/logos/logo_tecgas.png"),
        fetch("/assets/logos/logo_nacional.png"),
      ]);
      const [b1, b2] = await Promise.all([
        r1.arrayBuffer().then(b => Buffer.from(b)),
        r2.arrayBuffer().then(b => Buffer.from(b)),
      ]);
      const buf = await gerarRegistroDesmontagem({ cliente, responsavel, itens }, b1, b2);
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registro_desmontagem_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGerando(false);
    }
  };

  const TEMPLATES_BREVE = [
    "Registro de Montagem",
    "Ordem de Serviço",
    "Entrada de Material",
    "Saída de Material",
    "Inventário Cíclico",
  ];

  if (tela === "lista") return (
    <div style={{ padding: "28px 20px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8f4ff", margin: "0 0 4px" }}>Documentos</h1>
        <p style={{ fontSize: 13, color: "#4a7a9b", margin: 0 }}>Templates oficiais Tecgas — preencha e baixe o .docx</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 14 }}>

        {/* Template ativo — Registro de Desmontagem */}
        <button
          onClick={() => { setTela("form"); setCliente(""); setItens([{ qtd: "", unid: "", descricao: "" }]); }}
          style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(0,212,255,0.2)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left", padding: 0, transition: "border-color 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.6)")}
          onMouseOut={e => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)")}
        >
          {/* Miniatura do documento */}
          <div style={{ height: 140, background: "#060f20", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "0.5px solid rgba(0,212,255,0.1)", padding: 12 }}>
            <div style={{ width: 88, background: "white", borderRadius: 3, padding: 6, fontSize: 5, fontFamily: "Arial", lineHeight: 1.5, color: "#111", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              <div style={{ background: "#1A3260", color: "white", textAlign: "center", padding: "2px 0", fontSize: 5, fontWeight: "bold", marginBottom: 2 }}>REGISTRO DE MATERIAL</div>
              <div style={{ background: "#1A3260", color: "white", textAlign: "center", padding: "1px 0", fontSize: 4, marginBottom: 3 }}>DESMONTAGEM</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginBottom: 3 }}>
                <div style={{ background: "#E8E8E8", padding: "1px 2px", fontSize: 4 }}>CLIENTE:</div>
                <div style={{ background: "#E8E8E8", padding: "1px 2px", fontSize: 4 }}>RESP:</div>
              </div>
              <div style={{ border: "0.5px solid #ccc" }}>
                <div style={{ display: "grid", gridTemplateColumns: "18px 18px 1fr", background: "#1A3260", color: "white", fontSize: 4, padding: "1px 2px" }}>
                  <span>QTD</span><span>UN</span><span>DESC</span>
                </div>
                {Array(7).fill(0).map((_, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "18px 18px 1fr", fontSize: 3, padding: "1px 2px", borderTop: "0.5px solid #eee", background: i % 2 === 0 ? "#F5F5F5" : "white", height: 5 }} />
                ))}
              </div>
              <div style={{ background: "#1A3260", color: "white", fontSize: 4, padding: "1px 2px", marginTop: 2 }}>OBSERVAÇÕES:</div>
              <div style={{ background: "#1A3260", color: "white", fontSize: 4, padding: "1px 2px", marginTop: 1 }}>RECIBO DE ENTRADA</div>
              <div style={{ background: "#1A3260", color: "white", fontSize: 3, padding: "1px 2px", marginTop: 1, textAlign: "center" }}>TEL: 91 9 9106-1011</div>
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#e8f4ff", margin: "0 0 3px", lineHeight: 1.3 }}>Registro de Desmontagem</p>
            <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>Entrada de materiais</p>
          </div>
        </button>

        {/* Templates em breve */}
        {TEMPLATES_BREVE.map(nome => (
          <div key={nome} style={{ background: "rgba(255,255,255,0.01)", border: "0.5px solid rgba(255,255,255,0.05)", borderRadius: 14, overflow: "hidden", opacity: 0.4 }}>
            <div style={{ height: 140, background: "#040b15", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
              <FileText style={{ width: 28, height: 28, color: "#2a4a7a" }} />
              <span style={{ fontSize: 10, color: "#2a4a7a", background: "rgba(255,255,255,0.04)", padding: "2px 10px", borderRadius: 10 }}>Em breve</span>
            </div>
            <div style={{ padding: "10px 12px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#2a4a7a", margin: "0 0 3px" }}>{nome}</p>
              <p style={{ fontSize: 11, color: "#1a3a5a", margin: 0 }}>Template Tecgas</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => setTela("lista")}
          style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft style={{ width: 16, height: 16, color: "#4a7a9b" }} />
        </button>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#e8f4ff", margin: 0 }}>Registro de Desmontagem</p>
          <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>Preencha e baixe o .docx</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Cliente</label>
          <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Responsável</label>
          <input value={responsavel} onChange={e => setResponsavel(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Itens</label>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "72px 72px 1fr 32px", background: "#1b365d", padding: "8px 10px", gap: 6 }}>
              {["QTD", "UNID", "DESCRIÇÃO", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "#e8f4ff", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {itens.map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 72px 1fr 32px", gap: 4, padding: "5px 10px", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                <input value={item.qtd} onChange={e => setItem(i, "qtd", e.target.value)}
                  style={{ background: "transparent", border: "none", color: "#e8f4ff", fontSize: 12, outline: "none", padding: "3px 4px" }} />
                <input value={item.unid} onChange={e => setItem(i, "unid", e.target.value)} placeholder="UN"
                  style={{ background: "transparent", border: "none", color: "#e8f4ff", fontSize: 12, outline: "none", padding: "3px 4px" }} />
                <input value={item.descricao} onChange={e => setItem(i, "descricao", e.target.value)}
                  style={{ background: "transparent", border: "none", color: "#e8f4ff", fontSize: 12, outline: "none", padding: "3px 4px" }} />
                <button onClick={() => remLinha(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#2a4a7a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
            <button onClick={addLinha}
              style={{ width: "100%", padding: "9px", background: "rgba(255,255,255,0.02)", border: "none", color: "#4a7a9b", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus style={{ width: 12, height: 12 }} /> Adicionar linha
            </button>
          </div>
        </div>

        <button onClick={gerar} disabled={gerando}
          style={{ width: "100%", padding: "13px", borderRadius: 12, background: "linear-gradient(135deg, #1b365d, #0d2a4a)", border: "0.5px solid rgba(0,212,255,0.3)", color: "#e8f4ff", fontSize: 14, fontWeight: 700, cursor: gerando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: gerando ? 0.7 : 1 }}>
          {gerando
            ? <><div style={{ width: 14, height: 14, border: "2px solid #e8f4ff", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Gerando...</>
            : <><Download style={{ width: 16, height: 16 }} /> Gerar e Baixar .docx</>
          }
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
