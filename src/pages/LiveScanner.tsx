import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, increment, serverTimestamp, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useOrganization } from "../lib/tenant";
import { InventoryItem } from "../types";
import { Camera, CameraOff, Zap, Package, ArrowUpRight, ArrowDownRight, Target } from "lucide-react";
import { toast } from "sonner";
import { carregarMemoria, gerarEmbedding, buscarMaisSimilar, getVisionModelStatus } from "../lib/visionMemory";

const INTERVALO_MS = 1000;
const CONFIANCA_MINIMA = 0.85;

export function LiveScanner() {
  const { orgId } = useOrganization();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analisandoRef = useRef(false);

  const [ativo, setAtivo] = useState(false);
  const [inventario, setInventario] = useState<InventoryItem[]>([]);
  const [statusAtual, setStatusAtual] = useState("Aguardando câmera...");
  const [pausado, setPausado] = useState(false);
  
  // Estado de download da IA
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Estado para a detecção atual
  const [matchAtual, setMatchAtual] = useState<{ sku: string; label: string; score: number } | null>(null);
  const [produtoEncontrado, setProdutoEncontrado] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const status = getVisionModelStatus();
      setIsDownloading(status.isDownloading);
      setDownloadProgress(status.progress);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Carrega inventário e memória visual no mount
  useEffect(() => {
    if (!orgId) return;
    
    // Carrega dados do Firestore
    getDocs(collection(db, `organizations/${orgId}/inventory`))
      .then(snap => setInventario(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem))));
      
    // Pré-carrega embeddings locais
    carregarMemoria(orgId).catch(console.error);
  }, [orgId]);

  // Analisa frame via modelo local
  const analisarFrame = useCallback(async () => {
    if (analisandoRef.current || pausado) return;
    if (!videoRef.current || !canvasRef.current || !orgId) return;
    if (videoRef.current.readyState < 2) return;
    if (inventario.length === 0) return;

    analisandoRef.current = true;
    setStatusAtual("Analisando...");

    try {
      // Captura frame
      const canvas = canvasRef.current;
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

      const embedding = await gerarEmbedding(dataUrl);
      const match = await buscarMaisSimilar(orgId, embedding);

      if (match && match.score >= CONFIANCA_MINIMA) {
        const produto = inventario.find(i => i.id === match.sku);
        if (produto) {
          setStatusAtual(`Identificado: ${produto.name}`);
          setMatchAtual(match);
          setProdutoEncontrado(produto);
          setPausado(true);
        } else {
          setMatchAtual(match);
          setProdutoEncontrado(null);
        }
      } else {
        setStatusAtual("Aponte para uma peça...");
        setMatchAtual(match); // Pode ser null ou com score baixo
        setProdutoEncontrado(null);
      }
    } catch (e: any) {
      console.warn("[LiveScanner]", e?.message);
      setStatusAtual("Erro na análise...");
    } finally {
      analisandoRef.current = false;
    }
  }, [inventario, orgId, pausado]);

  // Registra Saída ou Retorno no estoque
  const registrarMovimento = async (tipo: "IN" | "OUT") => {
    if (!orgId || !produtoEncontrado) return;
    
    try {
      // Registra movimento no Firestore
      await addDoc(collection(db, `organizations/${orgId}/inventory/${produtoEncontrado.id}/movements`), {
        type: tipo,
        qty: 1,
        reason: `Scanner Visual Local (${Math.round(matchAtual?.score! * 100)}% confiança)`,
        date: new Date().toISOString(),
        user: auth.currentUser?.displayName ?? "Scanner IA",
        userEmail: auth.currentUser?.email ?? "",
        fonte: "live_scanner",
      });

      // Atualiza o estoque
      const change = tipo === "OUT" ? -1 : 1;
      await updateDoc(doc(db, `organizations/${orgId}/inventory`, produtoEncontrado.id), {
        qty: increment(change),
        qtyEmCampo: increment(-change),
        updatedAt: serverTimestamp(),
      });

      toast.success(`${tipo === "OUT" ? "Saída" : "Retorno"} registrada: ${produtoEncontrado.name}`);
    } catch (e: any) {
      toast.error(`Erro ao registrar movimento`);
    } finally {
      retomarAnalise();
    }
  };

  const retomarAnalise = () => {
    setMatchAtual(null);
    setProdutoEncontrado(null);
    setPausado(false);
    setStatusAtual("Aponte para o próximo item...");
  };

  // Liga câmera
  const ligarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setAtivo(true);
      setStatusAtual("Aponte para uma peça...");
      intervalRef.current = setInterval(analisarFrame, INTERVALO_MS);
    } catch (e: any) {
      toast.error("Câmera indisponível: " + e.message);
    }
  };

  const desligarCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setAtivo(false);
    setStatusAtual("Câmera desligada");
    setPausado(false);
    setMatchAtual(null);
    setProdutoEncontrado(null);
  };

  useEffect(() => () => desligarCamera(), []);

  return (
    <div style={{ minHeight: "100vh", background: "#050d1a", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(0,212,255,0.1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1b365d, #0d1f3c)", border: "0.5px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap style={{ width: 17, height: 17, color: "#00d4ff" }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#e8f4ff", margin: 0 }}>Scanner Visual On-Device</p>
            <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>Sem custos · {inventario.length} itens no catálogo</p>
          </div>
        </div>
        <button onClick={ativo ? desligarCamera : ligarCamera}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `0.5px solid ${ativo ? "rgba(226,75,74,0.3)" : "rgba(0,212,255,0.3)"}`, background: ativo ? "rgba(226,75,74,0.08)" : "rgba(0,212,255,0.08)", color: ativo ? "#e24b4a" : "#00d4ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {ativo ? <><CameraOff style={{ width: 14, height: 14 }} /> Desligar</> : <><Camera style={{ width: 14, height: 14 }} /> Ligar câmera</>}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Viewer da câmera */}
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${pausado ? "rgba(0,212,255,0.6)" : "rgba(0,212,255,0.15)"}`, transition: "border-color 0.3s", background: "#020810", maxWidth: 480, margin: "0 auto" }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: "100%", display: "block", aspectRatio: "4/3", objectFit: "cover", opacity: ativo ? 1 : 0.2 }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Cantos */}
            {ativo && [
              { top: 10, left: 10, borderTop: "2px solid #00d4ff", borderLeft: "2px solid #00d4ff" },
              { top: 10, right: 10, borderTop: "2px solid #00d4ff", borderRight: "2px solid #00d4ff" },
              { bottom: 10, left: 10, borderBottom: "2px solid #00d4ff", borderLeft: "2px solid #00d4ff" },
              { bottom: 10, right: 10, borderBottom: "2px solid #00d4ff", borderRight: "2px solid #00d4ff" },
            ].map((s, i) => <div key={i} style={{ position: "absolute", width: 18, height: 18, ...s }} />)}

            {/* Status overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 14px", background: "linear-gradient(to top, rgba(5,13,26,0.95), transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: pausado ? "#378add" : ativo ? "#00d4ff" : "#2a4a7a", animation: ativo && !pausado ? "pulseLive 1.5s ease infinite" : "none", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#e8f4ff", fontWeight: 500 }}>{statusAtual}</span>
              </div>
            </div>

            {isDownloading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(5,13,26,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, backdropFilter: "blur(4px)", zIndex: 10 }}>
                <Zap style={{ width: 32, height: 32, color: "#00d4ff", animation: "pulseLive 1.5s ease infinite" }} />
                <p style={{ fontSize: 14, color: "#e8f4ff", fontWeight: 600, margin: 0 }}>Carregando IA de visão...</p>
                <div style={{ width: "60%", height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ width: `${Math.max(5, downloadProgress)}%`, height: "100%", background: "#00d4ff", transition: "width 0.3s" }} />
                </div>
              </div>
            )}

            {!ativo && !isDownloading && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Camera style={{ width: 36, height: 36, color: "rgba(0,212,255,0.15)" }} />
                <p style={{ fontSize: 12, color: "#2a4a7a", margin: 0 }}>Clique em "Ligar câmera" para iniciar</p>
              </div>
            )}
          </div>
        </div>

        {/* Painel de ação */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {ativo && !pausado && matchAtual && matchAtual.score < CONFIANCA_MINIMA && (
            <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
              <Target style={{ width: 28, height: 28, color: "#4a7a9b", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 14, color: "#e8f4ff", margin: "0 0 4px" }}>Item não reconhecido ou baixa confiança</p>
              <p style={{ fontSize: 12, color: "#4a7a9b", margin: "0 0 16px" }}>
                {matchAtual.sku ? `Melhor chute: ${matchAtual.label} (${Math.round(matchAtual.score * 100)}%)` : "Nenhum match próximo."}
              </p>
              <button 
                onClick={() => toast.info("Fluxo de ensino será implementado na próxima etapa!")}
                style={{ background: "rgba(55,138,221,0.1)", border: "0.5px solid rgba(55,138,221,0.3)", color: "#378add", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                Ensinar este item
              </button>
            </div>
          )}

          {ativo && pausado && produtoEncontrado && matchAtual && (
            <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px", borderRadius: 12, background: "linear-gradient(135deg, rgba(6,15,32,0.9), rgba(4,11,21,0.9))", border: "1px solid rgba(0,212,255,0.3)", boxShadow: "0 10px 40px -10px rgba(0,212,255,0.15)", animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: "#060f20", border: "0.5px solid rgba(0,212,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {produtoEncontrado.imageUrl
                    ? <img src={produtoEncontrado.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                    : <Package style={{ width: 20, height: 20, color: "rgba(0,212,255,0.3)" }} />
                  }
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#2a4a7a" }}>{produtoEncontrado.id}</span>
                    <span style={{ fontSize: 11, color: "#00d4ff", background: "rgba(0,212,255,0.1)", border: "0.5px solid rgba(0,212,255,0.2)", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>
                      {Math.round(matchAtual.score * 100)}% match
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e8f4ff", margin: "0 0 4px", lineHeight: 1.3 }}>{produtoEncontrado.name}</h3>
                  <p style={{ fontSize: 12, color: "#4a7a9b", margin: 0 }}>Estoque: {produtoEncontrado.qty} (Campo: {produtoEncontrado.qtyEmCampo || 0})</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <button onClick={() => registrarMovimento("OUT")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(226,75,74,0.1)", border: "0.5px solid rgba(226,75,74,0.3)", color: "#e24b4a", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <ArrowUpRight style={{ width: 16, height: 16 }} />
                  Dar Saída
                </button>
                <button onClick={() => registrarMovimento("IN")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <ArrowDownRight style={{ width: 16, height: 16 }} />
                  Dar Retorno
                </button>
              </div>

              <button onClick={retomarAnalise}
                style={{ width: "100%", background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#4a7a9b", padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                Cancelar / Próximo Item
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulseLive { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
}

