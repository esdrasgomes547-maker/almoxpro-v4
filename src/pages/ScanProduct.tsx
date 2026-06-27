import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useOrganization } from "../lib/tenant";
import { registrarSaida, registrarRetorno } from "../lib/movementManager";
import { verificarEAlertar } from "../lib/alertManager";
import { InventoryItem, MovementItem } from "../types";
import { PackageSearch, LogOut, RotateCcw, AlertTriangle, CheckCircle, Scan, QrCode } from "lucide-react";
import { extrairSKU } from "../lib/utils";


type Modo = "MENU" | "SAIDA" | "RETORNO";
type NivelAcesso = "INTERNO" | "EXTERNO_CLIENTE" | "PUBLICO";

export function ScanProduct() {
  const [searchParams] = useSearchParams();
  const { orgId } = useOrganization();
  const user = auth.currentUser;

  function detectarNivel(): NivelAcesso {
    if (!user) return "PUBLICO";
    if (orgId === "tecgas-master" || orgId?.startsWith("tecgas")) return "INTERNO";
    return "EXTERNO_CLIENTE";
  }

  const nivel = detectarNivel();

  const [produto, setProduto] = useState<InventoryItem | null>(null);
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");
  const [sucesso, setSucesso]   = useState("");
  const [modo, setModo]         = useState<Modo>("MENU");
  const [qty, setQty]           = useState(1);
  const [destino, setDestino]   = useState("");
  const [employeeId, setEmployeeId]   = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  // const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Unused camera/device variables and functions commented out to ensure compile success
  // useEffect(() => {
  //   setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  // }, []);

  // const abrirCamera = async () => {
  //   setErro("");
  //   try {
  //     const scanner = new Html5Qrcode("qr-reader-scan");
  //     qrScannerRef.current = scanner;
  //     await scanner.start(
  //       { facingMode: "environment" },
  //       { fps: 15, qrbox: { width: 250, height: 250 } },
  //       (decodedText) => {
  //         const sku = extrairSKU(decodedText);
  //         if (sku) {
  //           buscarProduto(sku);
  //           navigator.vibrate?.(100);
  //           fecharCamera();
  //         }
  //       },
  //       () => {}
  //     );
  //     setScanning(true);
  //   } catch (e: any) {
  //     setErro("Não foi possível acessar a câmera: " + e.message);
  //   }
  // };

  // const fecharCamera = async () => {
  //   if (qrScannerRef.current) {
  //     await qrScannerRef.current.stop();
  //     qrScannerRef.current = null;
  //   }
  //   setScanning(false);
  // };

  const unsubMovementsRef = useRef<(() => void) | null>(null);

  // Busca produto no Firestore
  const buscarProduto = useCallback(async (sku: string) => {
    if (!orgId || !sku) return;
    setLoading(true);
    setErro("");
    setSucesso("");
    setModo("MENU");
    setProduto(null);
    if (unsubMovementsRef.current) {
      unsubMovementsRef.current();
      unsubMovementsRef.current = null;
    }
    try {
      const snap = await getDoc(doc(db, `organizations/${orgId}/inventory`, sku));
      if (!snap.exists()) {
        setErro(`Produto "${sku}" não encontrado no estoque.`);
      } else {
        const item = { id: snap.id, ...snap.data() } as InventoryItem;
        setProduto(item);
        // carrega movimentações recentes
        const q = query(collection(db, `organizations/${orgId}/inventory/${sku}/movements`), orderBy("date", "desc"), limit(5));
        unsubMovementsRef.current = onSnapshot(q, snap => setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() } as MovementItem))));
      }
    } catch (e: any) {
      setErro("Erro ao buscar produto: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Redireciona URLs do Studio para produção no Vercel
  useEffect(() => {
    const url = window.location.href;
    const isStudio = url.includes("run.app") || url.includes("aistudio");
    if (isStudio) {
      const params = new URLSearchParams(window.location.search);
      const sku = params.get("sku");
      if (sku) {
        if (!auth.currentUser) {
          window.location.replace(`https://almoxprov3.vercel.app/produto/${sku}`);
        } else {
          window.location.replace(`https://almoxprov3.vercel.app/scan?sku=${sku}`);
        }
      }
    }
  }, []);

  // Auto-busca pelo parâmetro da URL
  useEffect(() => {
    const sku = searchParams.get("sku");
    if (sku && orgId) buscarProduto(extrairSKU(sku));
  }, [searchParams, orgId]);

  // Listener do scanner USB (digita rápido + Enter)
  useEffect(() => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout>;

    const handle = (e: KeyboardEvent) => {
      if (["Shift","Control","Alt","Meta","CapsLock","ArrowLeft","ArrowRight"].includes(e.key)) return;

      if (e.key === "Enter") {
        if (buffer.length > 2) {
          const sku = extrairSKU(buffer.trim());
          if (sku) buscarProduto(sku);
        }
        buffer = "";
        clearTimeout(timer);
        return;
      }

      if (e.key.length === 1) buffer += e.key;
      clearTimeout(timer);
      timer = setTimeout(() => { buffer = ""; }, 300);
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [buscarProduto]);

  // Carrega funcionários
  useEffect(() => {
    return () => {
      if (unsubMovementsRef.current) {
        unsubMovementsRef.current();
        unsubMovementsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/employees`));
    const unsub = onSnapshot(q, snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [orgId]);

  // Confirma saída
  const confirmarSaida = async () => {
    if (!produto || !destino || !employeeId || qty < 1) return;
    if (qty > (produto.qty ?? 0)) { setErro("Quantidade maior que o estoque disponível!"); return; }
    setSalvando(true);
    try {
      await registrarSaida(orgId!, {
        sku: produto.id, qty, destination: destino,
        employeeId, employeeName,
        user: auth.currentUser?.displayName ?? "Almoxarife",
        userEmail: auth.currentUser?.email ?? "",
      });
      setSucesso(`${qty}x ${produto.name} enviado para "${destino}" sob responsabilidade de ${employeeName}`);
      
      const alerta = await verificarEAlertar(orgId!, {
        id: produto.id, name: produto.name,
        qty: (produto.qty ?? 0) - qty,
        minQty: produto.minQty,
      });
      if (alerta.nivel === "CRITICO") {
        setErro("ESTOQUE ZERADO! Solicite reposição imediata.");
      } else if (alerta.nivel === "MINIMO") {
        setErro("Estoque abaixo do mínimo. Considere repor em breve.");
      }
      
      setModo("MENU"); setQty(1); setDestino(""); setEmployeeId(""); setEmployeeName("");
      buscarProduto(produto.id); // recarrega estoque atualizado
    } catch (e: any) {
      setErro("Erro ao registrar saída: " + e.message);
    } finally { setSalvando(false); }
  };

  // Confirma retorno
  const confirmarRetorno = async () => {
    if (!produto || !employeeId || qty < 1) return;
    setSalvando(true);
    try {
      await registrarRetorno(orgId!, {
        sku: produto.id, qty,
        employeeId, employeeName,
        user: auth.currentUser?.displayName ?? "Almoxarife",
        userEmail: auth.currentUser?.email ?? "",
      });
      setSucesso(`${qty}x ${produto.name} retornado ao estoque por ${employeeName}`);
      
      const alerta = await verificarEAlertar(orgId!, {
        id: produto.id, name: produto.name,
        qty: (produto.qty ?? 0) + qty,
        minQty: produto.minQty,
      });
      if (alerta.nivel === "CRITICO") {
        setErro("ESTOQUE ZERADO! Solicite reposição imediata.");
      } else if (alerta.nivel === "MINIMO") {
        setErro("Estoque abaixo do mínimo. Considere repor em breve.");
      }

      setModo("MENU"); setQty(1); setEmployeeId(""); setEmployeeName("");
      buscarProduto(produto.id);
    } catch (e: any) {
      setErro("Erro ao registrar retorno: " + e.message);
    } finally { setSalvando(false); }
  };

  const estoqueDisponivel = (produto?.qty ?? 0);
  const estoqueBaixo = estoqueDisponivel > 0 && estoqueDisponivel <= (produto?.minQty ?? 3);
  const semEstoque   = estoqueDisponivel === 0;

  return (
  <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)" }}>

    {/* Header */}
    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid rgba(0,212,255,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1b365d, #0d1f3c)", border: "0.5px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Scan style={{ width: 18, height: 18, color: "#00d4ff" }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#e8f4ff", margin: 0 }}>Scanner</p>
          <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>AlmoxPro · Tecgas</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(55,138,221,0.1)", border: "0.5px solid rgba(55,138,221,0.3)", borderRadius: 20, padding: "4px 12px" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#378add" }} />
        <span style={{ fontSize: 11, color: "#378add", fontWeight: 500 }}>USB Ativo</span>
      </div>
    </div>

    <div style={{ flex: 1, padding: "20px", maxWidth: 480, width: "100%", margin: "0 auto" }}>

      {/* Aguardando */}
      {!produto && !loading && !erro && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 28 }}>
          <div style={{ position: "relative", width: 180, height: 180 }}>
            {[{ top:0,left:0,borderTop:"2px solid #00d4ff",borderLeft:"2px solid #00d4ff" },
              { top:0,right:0,borderTop:"2px solid #00d4ff",borderRight:"2px solid #00d4ff" },
              { bottom:0,left:0,borderBottom:"2px solid #00d4ff",borderLeft:"2px solid #00d4ff" },
              { bottom:0,right:0,borderBottom:"2px solid #00d4ff",borderRight:"2px solid #00d4ff" }
            ].map((s,i) => <div key={i} style={{ position:"absolute", width:24, height:24, ...s }} />)}
            <div style={{ position:"absolute", left:8, right:8, height:1.5, background:"linear-gradient(90deg,transparent,#00d4ff,transparent)", animation:"scanLine 2s ease-in-out infinite", boxShadow:"0 0 8px #00d4ff" }} />
            <div style={{ position:"absolute", inset:40, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <QrCode style={{ width:56, height:56, color:"rgba(0,212,255,0.15)" }} />
            </div>
          </div>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:18, fontWeight:600, color:"#e8f4ff", margin:"0 0 8px" }}>Aguardando leitura</p>
            <p style={{ fontSize:13, color:"#4a7a9b", margin:0, lineHeight:1.6 }}>Aponte o scanner USB para o QR code<br/>da etiqueta do produto</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:300, gap:16 }}>
          <div style={{ width:44, height:44, border:"2px solid rgba(0,212,255,0.2)", borderTop:"2px solid #00d4ff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
          <p style={{ fontSize:13, color:"#4a7a9b" }}>Identificando produto...</p>
        </div>
      )}

      {/* Erro */}
      {erro && !loading && (
        <div style={{ background:"rgba(226,75,74,0.08)", border:"0.5px solid rgba(226,75,74,0.3)", borderRadius:16, padding:"16px 20px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <AlertTriangle style={{ width:18, height:18, color:"#e24b4a", flexShrink:0 }} />
          <p style={{ fontSize:13, color:"#e24b4a", margin:0 }}>{erro}</p>
        </div>
      )}

      {/* Sucesso */}
      {sucesso && (
        <div style={{ background:"rgba(55,138,221,0.08)", border:"0.5px solid rgba(55,138,221,0.3)", borderRadius:16, padding:"16px 20px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <CheckCircle style={{ width:18, height:18, color:"#378add", flexShrink:0 }} />
          <p style={{ fontSize:13, color:"#378add", margin:0 }}>{sucesso}</p>
        </div>
      )}

      {/* Card produto INTERNO */}
      {produto && !loading && nivel === "INTERNO" && (
        <div style={{ background:"rgba(255,255,255,0.02)", border:"0.5px solid rgba(0,212,255,0.15)", borderRadius:20, overflow:"hidden", animation:"fadeUp 0.4s ease" }}>
          <div style={{ display:"flex", gap:14, padding:"18px", borderBottom:"0.5px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width:76, height:76, borderRadius:12, background:"#060f20", border:"0.5px solid rgba(0,212,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
              {produto.imageUrl
                ? <img src={produto.imageUrl} alt={produto.name} style={{ width:"100%", height:"100%", objectFit:"contain", padding:6 }} />
                : <PackageSearch style={{ width:28, height:28, color:"rgba(0,212,255,0.2)" }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:10, fontFamily:"monospace", color:"#2a4a7a", marginBottom:4, letterSpacing:"0.1em" }}>{produto.id}</p>
              <p style={{ fontSize:15, fontWeight:600, color:"#e8f4ff", lineHeight:1.3, margin:"0 0 3px" }}>{produto.name}</p>
              <p style={{ fontSize:11, color:"#4a7a9b", margin:0 }}>{(produto as any).category}</p>
            </div>
          </div>

          {/* Contadores */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderBottom:"0.5px solid rgba(255,255,255,0.06)" }}>
            {[
              { label:"Disponível", value:estoqueDisponivel, color: semEstoque?"#e24b4a": estoqueBaixo?"#00d4ff":"#378add" },
              { label:"Em Campo", value:(produto as any).qtyEmCampo??0, color:"#378add" },
              { label:"Mínimo", value:(produto as any).minQty??0, color:"#4a7a9b" },
            ].map((item,i) => (
              <div key={i} style={{ padding:"14px 10px", textAlign:"center", borderRight: i<2?"0.5px solid rgba(255,255,255,0.06)":"none" }}>
                <p style={{ fontSize:22, fontWeight:700, color:item.color, margin:"0 0 2px" }}>{item.value}</p>
                <p style={{ fontSize:10, color:"#4a7a9b", margin:0 }}>{item.label}</p>
              </div>
            ))}
          </div>

          {(estoqueBaixo || semEstoque) && (
            <div style={{ margin:"12px 16px", padding:"10px 14px", background: semEstoque?"rgba(226,75,74,0.08)":"rgba(0,212,255,0.08)", border:`0.5px solid ${semEstoque?"rgba(226,75,74,0.3)":"rgba(0,212,255,0.3)"}`, borderRadius:10, display:"flex", alignItems:"center", gap:8 }}>
              <AlertTriangle style={{ width:14, height:14, color: semEstoque?"#e24b4a":"#00d4ff", flexShrink:0 }} />
              <p style={{ fontSize:12, color: semEstoque?"#e24b4a":"#00d4ff", margin:0, fontWeight:500 }}>
                {semEstoque ? "Estoque zerado — solicite reposição imediata" : `Estoque baixo (mín: ${(produto as any).minQty})`}
              </p>
            </div>
          )}

          {/* MENU */}
          {modo === "MENU" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, padding:16 }}>
              <button onClick={() => { setModo("SAIDA"); setErro(""); setSucesso(""); }} disabled={semEstoque}
                style={{ padding:"13px", borderRadius:12, border:"none", cursor: semEstoque?"not-allowed":"pointer", background: semEstoque?"rgba(27,54,93,0.3)":"#1b365d", color: semEstoque?"#2a4a7a":"#e8f4ff", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <LogOut style={{ width:15, height:15 }} /> Saída
              </button>
              <button onClick={() => { setModo("RETORNO"); setErro(""); setSucesso(""); }} disabled={(produto as any).qtyEmCampo===0}
                style={{ padding:"13px", borderRadius:12, border:"0.5px solid rgba(55,138,221,0.3)", cursor:(produto as any).qtyEmCampo===0?"not-allowed":"pointer", background:"rgba(55,138,221,0.1)", color:(produto as any).qtyEmCampo===0?"rgba(55,138,221,0.3)":"#378add", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <RotateCcw style={{ width:15, height:15 }} /> Retorno
              </button>
            </div>
          )}

          {/* SAIDA */}
          {modo === "SAIDA" && (
            <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ fontSize:13, fontWeight:600, color:"#e8f4ff", margin:0 }}>Registrar Saída</p>
              <div style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 16px" }}>
                <button onClick={() => setQty(q=>Math.max(1,q-1))} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#e8f4ff",fontSize:18,cursor:"pointer" }}>−</button>
                <span style={{ flex:1,textAlign:"center",fontSize:24,fontWeight:700,color:"#e8f4ff" }}>{qty}</span>
                <button onClick={() => setQty(q=>Math.min(estoqueDisponivel,q+1))} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#e8f4ff",fontSize:18,cursor:"pointer" }}>+</button>
              </div>
              <input value={destino} onChange={e=>setDestino(e.target.value)} placeholder="Destino / Serviço"
                style={{ padding:"11px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",color:"#e8f4ff",fontSize:13,outline:"none" }} />
              <select value={employeeId} onChange={e=>{const emp=employees.find((f:any)=>f.id===e.target.value);setEmployeeId(e.target.value);setEmployeeName(emp?.name??emp?.nome??"");}}
                style={{ padding:"11px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",color:"#e8f4ff",fontSize:13,outline:"none" }}>
                <option value="">Selecione o responsável...</option>
                {employees.map((f:any)=><option key={f.id} value={f.id}>{f.name??f.nome}</option>)}
              </select>
              <div style={{ display:"flex",gap:10 }}>
                <button onClick={()=>setModo("MENU")} style={{ flex:1,padding:"11px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",color:"#4a7a9b",fontSize:13,cursor:"pointer" }}>Cancelar</button>
                <button onClick={confirmarSaida} disabled={salvando||!destino||!employeeId}
                  style={{ flex:2,padding:"11px",borderRadius:10,background: salvando||!destino||!employeeId?"rgba(27,54,93,0.4)":"#1b365d",border:"none",color:"#e8f4ff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  {salvando?<><div style={{width:14,height:14,border:"2px solid #e8f4ff",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Salvando...</>:<><LogOut style={{width:14,height:14}}/>Confirmar Saída</>}
                </button>
              </div>
            </div>
          )}

          {/* RETORNO */}
          {modo === "RETORNO" && (
            <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ fontSize:13, fontWeight:600, color:"#e8f4ff", margin:0 }}>Registrar Retorno</p>
              <div style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 16px" }}>
                <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#e8f4ff",fontSize:18,cursor:"pointer" }}>−</button>
                <span style={{ flex:1,textAlign:"center",fontSize:24,fontWeight:700,color:"#e8f4ff" }}>{qty}</span>
                <button onClick={()=>setQty(q=>Math.min((produto as any).qtyEmCampo??0,q+1))} style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.06)",border:"none",color:"#e8f4ff",fontSize:18,cursor:"pointer" }}>+</button>
              </div>
              <select value={employeeId} onChange={e=>{const emp=employees.find((f:any)=>f.id===e.target.value);setEmployeeId(e.target.value);setEmployeeName(emp?.name??emp?.nome??"");}}
                style={{ padding:"11px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",color:"#e8f4ff",fontSize:13,outline:"none" }}>
                <option value="">Quem está devolvendo...</option>
                {employees.map((f:any)=><option key={f.id} value={f.id}>{f.name??f.nome}</option>)}
              </select>
              <div style={{ display:"flex",gap:10 }}>
                <button onClick={()=>setModo("MENU")} style={{ flex:1,padding:"11px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",color:"#4a7a9b",fontSize:13,cursor:"pointer" }}>Cancelar</button>
                <button onClick={confirmarRetorno} disabled={salvando||!employeeId}
                  style={{ flex:2,padding:"11px",borderRadius:10,background: salvando||!employeeId?"rgba(55,138,221,0.08)":"rgba(55,138,221,0.15)",border:"0.5px solid rgba(55,138,221,0.4)",color:"#378add",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  {salvando?<><div style={{width:14,height:14,border:"2px solid #378add",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Salvando...</>:<><RotateCcw style={{width:14,height:14}}/>Confirmar Retorno</>}
                </button>
              </div>
            </div>
          )}

          {/* Histórico */}
          {movements.length > 0 && modo === "MENU" && (
            <div style={{ borderTop:"0.5px solid rgba(255,255,255,0.06)", padding:16 }}>
              <p style={{ fontSize:10, fontWeight:600, color:"#2a4a7a", textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 10px" }}>Últimas movimentações</p>
              {movements.slice(0,3).map((mov:any) => (
                <div key={mov.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:28,height:28,borderRadius:8,background: mov.type==="OUT"?"rgba(226,75,74,0.1)":"rgba(55,138,221,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    {mov.type==="OUT"?<LogOut style={{width:12,height:12,color:"#e24b4a"}}/>:<RotateCcw style={{width:12,height:12,color:"#378add"}}/>}
                  </div>
                  <div>
                    <p style={{ fontSize:12,color:"#e8f4ff",margin:0 }}>{mov.reason}</p>
                    <p style={{ fontSize:10,color:"#4a7a9b",margin:0 }}>{mov.qty} un · {mov.employeeName??mov.user}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tela PÚBLICA */}
      {produto && nivel === "PUBLICO" && (
        <div style={{ background:"rgba(255,255,255,0.02)", border:"0.5px solid rgba(0,212,255,0.15)", borderRadius:20, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:14, padding:"18px" }}>
            <div style={{ width:80,height:80,borderRadius:12,background:"#060f20",border:"0.5px solid rgba(0,212,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden" }}>
              {produto.imageUrl?<img src={produto.imageUrl} alt={produto.name} style={{width:"100%",height:"100%",objectFit:"contain",padding:6}}/>:<PackageSearch style={{width:28,height:28,color:"rgba(0,212,255,0.2)"}}/>}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:10,fontFamily:"monospace",color:"#2a4a7a",marginBottom:4 }}>{produto.id}</p>
              <p style={{ fontSize:16,fontWeight:600,color:"#e8f4ff",margin:"0 0 4px" }}>{produto.name}</p>
              {(produto as any).price && <p style={{ fontSize:20,fontWeight:700,color:"#00d4ff",margin:0 }}>R$ {((produto as any).price??0).toFixed(2).replace(".",",")}</p>}
            </div>
          </div>
          <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:8 }}>
            <a href="https://almoxprov3.vercel.app/catalog" style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",background:"#1b365d",borderRadius:10,fontSize:13,fontWeight:500,color:"#e8f4ff",textDecoration:"none" }}>Ver na Tecshop</a>
            <a href="https://wa.me/5591986181270?text=Ol%C3%A1!+Escaneei+um+QR+da+Tecgas+e+quero+conhecer+o+AlmoxPro!" style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",background:"rgba(55,138,221,0.1)",border:"0.5px solid rgba(55,138,221,0.3)",borderRadius:10,fontSize:13,fontWeight:500,color:"#378add",textDecoration:"none" }}>Quero o AlmoxPro</a>
            <p style={{ fontSize:10,color:"#2a4a7a",textAlign:"center",margin:0 }}>LevtheDev · Esdras Nunes · Belém, PA</p>
          </div>
        </div>
      )}
    </div>

    <style>{`
      @keyframes scanLine { 0%{top:8px;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:calc(100% - 8px);opacity:0} }
      @keyframes spin { to{transform:rotate(360deg)} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    `}</style>
  </div>
);

}
