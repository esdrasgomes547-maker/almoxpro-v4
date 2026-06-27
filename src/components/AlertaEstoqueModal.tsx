import { useState } from "react";
import { AlertTriangle, Send, X, Package } from "lucide-react";
import { AlertaEstoque } from "../lib/alertManager";
import { WhatsAppConfirmModal } from "./WhatsAppConfirmModal";
import { getWhatsAppConfig } from "../lib/whatsappService";
import { useOrganization } from "../lib/tenant";

interface Props {
  alertas: AlertaEstoque[];
  mensagem: string;
  onClose: () => void;
}

export function AlertaEstoqueModal({ alertas, mensagem, onClose }: Props) {
  const { orgId } = useOrganization();
  const [showConfirm, setShowConfirm] = useState(false);
  const [waConfig, setWaConfig] = useState<{ numero: string } | null>(null);

  const criticos = alertas.filter(a => a.nivel === "CRITICO");
  const minimos = alertas.filter(a => a.nivel === "MINIMO");

  const abrirConfirmacao = async () => {
    if (!orgId) return;
    const config = await getWhatsAppConfig(orgId);
    if (!config) {
      alert("Configure o WhatsApp nas Configurações do AlmoxPro primeiro.");
      return;
    }
    setWaConfig({ numero: config.numero });
    setShowConfirm(true);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)" }}>
      <div style={{ width:"100%", maxWidth:460, maxHeight:"85vh", background:"#0a1628", border:"0.5px solid rgba(226,75,74,0.3)", borderRadius:20, overflow:"hidden", display:"flex", flexDirection:"column", margin:16 }}>

        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(226,75,74,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <AlertTriangle style={{ width:18, height:18, color:"#e24b4a" }} />
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:"#e8f4ff", margin:0 }}>Alerta de Estoque</p>
              <p style={{ fontSize:11, color:"#e24b4a", margin:0 }}>{criticos.length} zerado(s) · {minimos.length} abaixo do mínimo</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#4a7a9b" }}>
            <X style={{ width:16, height:16 }} />
          </button>
        </div>

        <div style={{ flex:1, overflowY:"auto" }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ padding:"12px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.04)", display:"flex", gap:12 }}>
              <div style={{ width:32, height:32, borderRadius:8, background: a.nivel==="CRITICO"?"rgba(226,75,74,0.1)":"rgba(0,212,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Package style={{ width:14, height:14, color: a.nivel==="CRITICO"?"#e24b4a":"#00d4ff" }} />
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:10, fontFamily:"monospace", color:"#2a4a7a", margin:"0 0 2px" }}>{a.sku}</p>
                <p style={{ fontSize:13, fontWeight:500, color:"#e8f4ff", margin:"0 0 2px" }}>{a.nome}</p>
                <p style={{ fontSize:11, color: a.nivel==="CRITICO"?"#e24b4a":"#00d4ff", margin:"0 0 4px" }}>
                  {a.nivel==="CRITICO" ? "Zerado" : `${a.qty} un (mín: ${a.minQty})`}
                </p>
                {a.fornecedores.map((f, j) => (
                  <p key={j} style={{ fontSize:11, color:"#4a7a9b", margin:"1px 0" }}>
                    📞 {f.nome}{f.contato ? ` · ${f.contato}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:"14px 20px", borderTop:"0.5px solid rgba(255,255,255,0.06)", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.08)", color:"#4a7a9b", fontSize:13, cursor:"pointer" }}>
            Fechar
          </button>
          <button onClick={abrirConfirmacao}
            style={{ flex:2, padding:"11px", borderRadius:10, background:"rgba(55,138,221,0.15)", border:"0.5px solid rgba(55,138,221,0.4)", color:"#378add", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Send style={{ width:14, height:14 }} /> Enviar via WhatsApp
          </button>
        </div>
      </div>
      
      {showConfirm && waConfig && (
        <WhatsAppConfirmModal
          orgId={orgId!}
          numero={waConfig.numero}
          mensagem={mensagem}
          titulo="Alerta de Estoque"
          onClose={() => setShowConfirm(false)}
          onEnviado={onClose}
        />
      )}
    </div>
  );
}
