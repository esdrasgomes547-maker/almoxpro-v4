import { useState } from "react";
import { Send, X, MessageCircle, Phone } from "lucide-react";
import { enviarWhatsApp } from "../lib/whatsappService";

interface Props {
  orgId: string;
  numero: string;
  mensagem: string;
  titulo: string;
  onClose: () => void;
  onEnviado?: () => void;
}

export function WhatsAppConfirmModal({ orgId, numero, mensagem, titulo, onClose, onEnviado }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: boolean; msg: string } | null>(null);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const r = await enviarWhatsApp(orgId, mensagem);
      if (r.sucesso) {
        setResultado({ sucesso: true, msg: "Mensagem enviada com sucesso!" });
        onEnviado?.();
        setTimeout(onClose, 2000);
      } else {
        setResultado({ sucesso: false, msg: r.erro ?? "Erro ao enviar" });
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)" }}>
      <div style={{ width:"100%", maxWidth:440, background:"#0a1628", border:"0.5px solid rgba(0,196,122,0.3)", borderRadius:20, overflow:"hidden", margin:16 }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(0,196,122,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <MessageCircle style={{ width:18, height:18, color:"#00c47a" }} />
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:"#e8f4ff", margin:0 }}>{titulo}</p>
              <p style={{ fontSize:11, color:"#00c47a", margin:0, display:"flex", alignItems:"center", gap:4 }}>
                <Phone style={{ width:10, height:10 }} /> {numero}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a7a9b" }}>
            <X style={{ width:16, height:16 }} />
          </button>
        </div>

        {/* Preview da mensagem */}
        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize:11, color:"#4a7a9b", margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Preview da mensagem:</p>
          <div style={{ background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"12px 14px", maxHeight:200, overflowY:"auto" }}>
            <pre style={{ fontSize:12, color:"#e8f4ff", margin:0, whiteSpace:"pre-wrap", fontFamily:"var(--font-sans)", lineHeight:1.6 }}>{mensagem}</pre>
          </div>
        </div>

        {/* Resultado */}
        {resultado && (
          <div style={{ padding:"12px 20px", background: resultado.sucesso ? "rgba(0,196,122,0.08)" : "rgba(226,75,74,0.08)", borderBottom:"0.5px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize:13, color: resultado.sucesso ? "#00c47a" : "#e24b4a", margin:0, textAlign:"center" }}>
              {resultado.sucesso ? "✅" : "❌"} {resultado.msg}
            </p>
          </div>
        )}

        {/* Botões */}
        {!resultado && (
          <div style={{ padding:"14px 20px", display:"flex", gap:10 }}>
            <button onClick={onClose}
              style={{ flex:1, padding:"11px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.08)", color:"#4a7a9b", fontSize:13, cursor:"pointer" }}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={enviando}
              style={{ flex:2, padding:"11px", borderRadius:10, background:"rgba(0,196,122,0.15)", border:"0.5px solid rgba(0,196,122,0.4)", color:"#00c47a", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: enviando ? 0.6 : 1 }}>
              {enviando
                ? <><div style={{ width:14, height:14, border:"2px solid #00c47a", borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> Enviando...</>
                : <><Send style={{ width:14, height:14 }} /> Confirmar e Enviar</>
              }
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
