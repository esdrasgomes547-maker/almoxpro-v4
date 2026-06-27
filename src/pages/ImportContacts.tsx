import { useState, useRef } from "react";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useOrganization } from "../lib/tenant";
import { chamarLLM } from "../lib/llmRouter";
import { Upload, Check, X, Phone } from "lucide-react";

interface ContatoImportado {
  nome: string;
  telefone: string;
  empresa?: string;
  email?: string;
  categoria?: string;
  status: "pendente" | "importado" | "erro";
}

export function ImportContacts() {
  const { orgId } = useOrganization();
  const [contatos, setContatos] = useState<ContatoImportado[]>([]);
  const [processando, setProcessando] = useState(false);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"vcf" | "texto">("vcf");
  const fileRef = useRef<HTMLInputElement>(null);

  // Parser de VCF
  function parseVCF(conteudo: string): ContatoImportado[] {
    const contatos: ContatoImportado[] = [];
    const vcards = conteudo.split("BEGIN:VCARD");
    for (const vcard of vcards) {
      if (!vcard.trim()) continue;
      const nome = vcard.match(/FN:(.*)/)?.[1]?.trim() ?? "";
      const tel = vcard.match(/TEL[^:]*:(.*)/)?.[1]?.trim().replace(/\D/g, "") ?? "";
      const email = vcard.match(/EMAIL[^:]*:(.*)/)?.[1]?.trim() ?? "";
      const org = vcard.match(/ORG:(.*)/)?.[1]?.trim() ?? "";
      if (nome && tel) {
        contatos.push({ nome, telefone: tel, empresa: org || undefined, email: email || undefined, status: "pendente" });
      }
    }
    return contatos;
  }

  // Upload de arquivo VCF
  const handleVCF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseVCF(ev.target?.result as string);
      setContatos(parsed);
    };
    reader.readAsText(file);
  };

  // Interpretação de texto livre via Groq
  const interpretarTexto = async () => {
    if (!texto.trim()) return;
    setProcessando(true);
    try {
      const resultado = await chamarLLM([
        { role: "system", content: "Você extrai contatos de texto livre. Retorne APENAS JSON válido, sem markdown, no formato: [{\"nome\": \"\", \"telefone\": \"\", \"empresa\": \"\", \"email\": \"\"}]" },
        { role: "user", content: `Extraia todos os contatos deste texto:\n\n${texto}` }
      ], "analise_estoque");
      const parsed = JSON.parse(resultado.texto.replace(/```json|```/g, "").trim());
      setContatos(parsed.map((c: any) => ({ ...c, status: "pendente" as const })));
    } catch (e) {
      console.error(e);
    } finally {
      setProcessando(false);
    }
  };

  // Importa todos os contatos como fornecedores
  const importarTodos = async () => {
    if (!orgId) return;
    setProcessando(true);
    const atualizados = [...contatos];
    for (let i = 0; i < atualizados.length; i++) {
      const c = atualizados[i];
      if (c.status === "importado") continue;
      try {
        const id = `FOR-${Date.now().toString(36).toUpperCase().slice(-4)}${i}`;
        await setDoc(doc(db, `organizations/${orgId}/suppliers`, id), {
          name: c.nome,
          phone: c.telefone,
          whatsapp: c.telefone.startsWith("55") ? c.telefone : `55${c.telefone}`,
          email: c.email ?? "",
          category: c.categoria ?? "Outros",
          empresa: c.empresa ?? "",
          rating: 0,
          status: "REVIEW_NEEDED",
        });
        atualizados[i] = { ...c, status: "importado" };
      } catch {
        atualizados[i] = { ...c, status: "erro" };
      }
      setContatos([...atualizados]);
    }
    setProcessando(false);
  };

  const importados = contatos.filter(c => c.status === "importado").length;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8f4ff", margin: "0 0 4px" }}>Importar Contatos</h1>
        <p style={{ fontSize: 13, color: "#4a7a9b", margin: 0 }}>Importe contatos do WhatsApp ou texto como fornecedores</p>
      </div>

      {/* Toggle modo */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 20, border: "0.5px solid rgba(255,255,255,0.06)" }}>
        {[{ id: "vcf", label: "Arquivo VCF" }, { id: "texto", label: "Colar Texto" }].map(m => (
          <button key={m.id} onClick={() => setModo(m.id as any)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: modo === m.id ? 600 : 400, transition: "all 0.2s",
              background: modo === m.id ? "rgba(0,212,255,0.12)" : "transparent",
              color: modo === m.id ? "#00d4ff" : "#4a7a9b",
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* VCF Upload */}
      {modo === "vcf" && (
        <div>
          <input ref={fileRef} type="file" accept=".vcf" onChange={handleVCF} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ width: "100%", padding: "32px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(0,212,255,0.2)", color: "#4a7a9b", fontSize: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Upload style={{ width: 28, height: 28, color: "#1b365d" }} />
            <span style={{ color: "#e8f4ff", fontWeight: 500 }}>Selecionar arquivo .vcf</span>
            <span style={{ fontSize: 11 }}>Exporte seus contatos do WhatsApp ou celular</span>
          </button>
          <p style={{ fontSize: 11, color: "#2a4a7a", marginTop: 10, lineHeight: 1.6 }}>
            No WhatsApp: Contato → compartilhar → "Compartilhar como .vcf"
          </p>
        </div>
      )}

      {/* Texto livre */}
      {modo === "texto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea rows={8} value={texto} onChange={e => setTexto(e.target.value)}
            placeholder={"Cole aqui a lista de contatos...\nEx:\nJoão Silva - Distribuidora X\n(91) 99999-8888\njoao@distx.com.br"}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
          <button onClick={interpretarTexto} disabled={processando || !texto.trim()}
            style={{ padding: "11px", borderRadius: 10, background: "linear-gradient(135deg, #1b365d, #0d2a4a)", border: "0.5px solid rgba(0,212,255,0.3)", color: "#e8f4ff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: processando ? 0.6 : 1 }}>
            {processando ? "Interpretando..." : "Interpretar com IA"}
          </button>
        </div>
      )}

      {/* Lista de contatos */}
      {contatos.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: "#4a7a9b", margin: 0 }}>{contatos.length} contatos encontrados · {importados} importados</p>
            <button onClick={importarTodos} disabled={processando}
              style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #1b365d, #0d2a4a)", border: "0.5px solid rgba(0,212,255,0.3)", color: "#e8f4ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {processando ? "Importando..." : "Importar todos"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contatos.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${c.status === "importado" ? "rgba(0,212,255,0.2)" : c.status === "erro" ? "rgba(226,75,74,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(27,54,93,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Phone style={{ width: 15, height: 15, color: "#378add" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#e8f4ff", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</p>
                  <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>{c.telefone}{c.empresa ? ` · ${c.empresa}` : ""}</p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {c.status === "importado" && <Check style={{ width: 16, height: 16, color: "#378add" }} />}
                  {c.status === "erro" && <X style={{ width: 16, height: 16, color: "#e24b4a" }} />}
                  {c.status === "pendente" && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
