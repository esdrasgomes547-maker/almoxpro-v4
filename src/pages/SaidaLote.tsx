import { useState, useEffect, useRef, useCallback } from "react";
import { collection, getDocs, doc, getDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useOrganization } from "../lib/tenant";
import { registrarSaida } from "../lib/movementManager";
import { InventoryItem } from "../types";
import { Plus, Minus, Trash2, CheckCircle, X, Camera, Usb } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { extrairSKU } from "../lib/utils";

interface ItemLote {
  produto: InventoryItem;
  qty: number;
  custoUnit: number;
  vendaUnit: number;
}

export function SaidaLote() {
  const { orgId } = useOrganization();
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [destino, setDestino] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Carrega funcionários
  useEffect(() => {
    if (!orgId) return;
    getDocs(collection(db, `organizations/${orgId}/employees`))
      .then(snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [orgId]);

  // Scanner USB — listener de teclado
  const buscarProduto = useCallback(async (sku: string) => {
    if (!orgId || !sku) return;
    setErro("");
    try {
      const snap = await getDoc(doc(db, `organizations/${orgId}/inventory`, sku.toUpperCase()));
      if (!snap.exists()) {
        const todos = await getDocs(collection(db, `organizations/${orgId}/inventory`));
        const encontrado = todos.docs.find(d =>
          d.id.toUpperCase() === sku.toUpperCase()
        );
        if (encontrado) {
          const produto = { id: encontrado.id, ...encontrado.data() } as InventoryItem;
          const custoUnit = produto.price ?? 0;
          setItens(prev => {
            const existe = prev.find(i => i.produto.id === produto.id);
            if (existe) return prev.map(i => i.produto.id === produto.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { produto, qty: 1, custoUnit, vendaUnit: custoUnit * 2 }];
          });
          return;
        }
        setErro(`Produto "${sku}" não encontrado.`);
        return;
      }
      const produto = { id: snap.id, ...snap.data() } as InventoryItem;
      const custoUnit = produto.price ?? 0;
      setItens(prev => {
        const existe = prev.find(i => i.produto.id === produto.id);
        if (existe) return prev.map(i => i.produto.id === produto.id ? { ...i, qty: i.qty + 1 } : i);
        return [...prev, { produto, qty: 1, custoUnit, vendaUnit: custoUnit * 2 }];
      });
    } catch (e: any) {
      setErro("Erro ao buscar: " + e.message);
    }
  }, [orgId]);

  useEffect(() => {
    if (!scanning || isMobile) return;
    let buffer = "";
    let timer: ReturnType<typeof setTimeout>;
    const handle = (e: KeyboardEvent) => {
      if (["Shift","Control","Alt","Meta","CapsLock"].includes(e.key)) return;
      if (e.key === "Enter") {
        if (buffer.length > 2) {
          const skuExtraido = extrairSKU(buffer.trim());
          if (skuExtraido) buscarProduto(skuExtraido);
        }
        buffer = ""; clearTimeout(timer); return;
      }
      if (e.key.length === 1) buffer += e.key;
      clearTimeout(timer);
      timer = setTimeout(() => { buffer = ""; }, 300);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [scanning, isMobile, buscarProduto]);

  // Câmera mobile
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  const abrirCamera = async () => {
    setErro("");
    try {
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;
  
      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };
      
      const onScanSuccess = (decodedText: string) => {
        const sku = extrairSKU(decodedText);
        if (sku) {
          buscarProduto(sku);
          navigator.vibrate?.([100, 50, 100]);
        }
      };

      try {
        await scanner.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          () => {}
        );
        setScanning(true);
      } catch (err) {
        console.warn("Falha ao usar câmera traseira, tentando fallback:", err);
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await scanner.start(
              cameras[0].id,
              config,
              onScanSuccess,
              () => {}
            );
            setScanning(true);
          } else {
            throw new Error("Nenhuma câmera encontrada no dispositivo.");
          }
        } catch (fallbackErr: any) {
          throw fallbackErr || err;
        }
      }
    } catch (e: any) {
      console.error("Erro no scanner:", e);
      let errorMsg = "Erro desconhecido.";
      if (typeof e === 'string') {
        errorMsg = e;
      } else if (e instanceof Error) {
        errorMsg = e.message;
      } else if (e && e.name) {
        errorMsg = e.name;
      }
      
      if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
        setErro("Permissão negada. Por favor, permita o acesso à câmera no seu navegador. Se estiver no preview, tente abrir em uma nova aba.");
      } else {
        setErro("Câmera indisponível: " + errorMsg + ". Tente abrir o app em uma nova guia.");
      }
    }
  };

  const fecharCamera = async () => {
    if (qrScannerRef.current) {
      await qrScannerRef.current.stop();
      qrScannerRef.current = null;
    }
    setScanning(false);
  };

  // Totais
  const totalCusto = itens.reduce((acc, i) => acc + i.custoUnit * i.qty, 0);
  const totalVenda = itens.reduce((acc, i) => acc + i.vendaUnit * i.qty, 0);
  const margem = totalVenda - totalCusto;

  const fmtR = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  // Confirmar saída em lote
  const confirmar = async () => {
    if (!destino || !employeeId || itens.length === 0) {
      setErro("Preencha destino, responsável e adicione pelo menos um produto.");
      return;
    }
    setSalvando(true);
    try {
      const user = auth.currentUser;
      const batchId = `LOTE-${Date.now().toString(36).toUpperCase()}`;

      // Registra saída de cada item
      await Promise.all(itens.map(item =>
        registrarSaida(orgId!, {
          sku: item.produto.id,
          qty: item.qty,
          destination: destino,
          employeeId,
          employeeName,
          user: user?.displayName ?? "Almoxarife",
          userEmail: user?.email ?? "",
        })
      ));

      // Salva relatório financeiro da operação
      await addDoc(collection(db, `organizations/${orgId}/relatorios_operacao`), {
        batchId,
        destino,
        employeeId,
        employeeName,
        itens: itens.map(i => ({
          sku: i.produto.id,
          nome: i.produto.name,
          qty: i.qty,
          custoUnit: i.custoUnit,
          vendaUnit: i.vendaUnit,
          custoTotal: i.custoUnit * i.qty,
          vendaTotal: i.vendaUnit * i.qty,
        })),
        totalCusto,
        totalVenda,
        margem,
        data: serverTimestamp(),
        user: user?.email ?? "",
      });

      setSucesso(`Saída registrada! ${itens.length} produtos despachados. Custo: ${fmtR(totalCusto)} | Valor: ${fmtR(totalVenda)}`);
      setItens([]);
      setDestino("");
      setEmployeeId("");
      setEmployeeName("");
      fecharCamera();
    } catch (e: any) {
      setErro("Erro ao registrar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-surface">Saída em Lote</h1>
        <span className="text-xs font-mono text-on-surface-variant bg-surface-low px-3 py-1 rounded-full">
          {itens.length} produto(s)
        </span>
      </div>

      {/* Erro / Sucesso */}
      {erro && (
        <div className="bg-[#e24b4a]/10 border border-[#e24b4a]/20 rounded-xl p-3 flex items-center gap-3">
          <X className="w-4 h-4 text-[#e24b4a] flex-shrink-0" />
          <p className="text-sm text-[#e24b4a]">{erro}</p>
        </div>
      )}
      {sucesso && (
        <div className="bg-[#378add]/10 border border-[#378add]/20 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-[#378add] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#378add]">{sucesso}</p>
        </div>
      )}

      {/* Dados da operação */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-on-surface">Dados da operação</h2>
        <input value={destino} onChange={e => setDestino(e.target.value)}
          placeholder="Destino / Serviço (ex: Obra Rua das Flores)"
          className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors" />
        <select value={employeeId}
          onChange={e => {
            const emp = employees.find(f => f.id === e.target.value);
            setEmployeeId(e.target.value);
            setEmployeeName(emp?.name ?? emp?.nome ?? "");
          }}
          className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors appearance-none">
          <option value="">Selecione o responsável...</option>
          {employees.map(f => (
            <option key={f.id} value={f.id}>{f.name ?? f.nome}</option>
          ))}
        </select>
      </div>

      {/* Scanner */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface">Adicionar produtos</h2>
          {scanning && !isMobile && (
            <span className="flex items-center gap-1.5 text-xs text-[#378add] font-medium">
              <span className="w-2 h-2 bg-[#378add]/10 rounded-full animate-pulse" />
              Scanner USB ativo
            </span>
          )}
        </div>

        {isMobile ? (
          <>
            <div id="qr-reader" style={{ width: "100%" }} />
            {!scanning ? (
              <button onClick={abrirCamera}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-bold active:scale-95 transition-transform">
                <Camera className="w-4 h-4" /> Abrir câmera e escanear
              </button>
            ) : (
              <button onClick={fecharCamera}
                className="w-full py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm text-on-surface-variant active:scale-95">
                Fechar câmera
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setScanning(s => !s)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${scanning ? "bg-[#378add]/10 text-white" : "bg-[hsl(var(--primary))] text-white"}`}>
            <Usb className="w-4 h-4" />
            {scanning ? "Scanner ativo — aponte o leitor" : "Ativar scanner USB"}
          </button>
        )}
      </div>

      {/* Lista de itens */}
      {itens.length > 0 && (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[hsl(var(--border))]">
            <h2 className="text-sm font-bold text-on-surface">Produtos escaneados</h2>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {itens.map((item, i) => (
              <div key={item.produto.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-on-surface-variant">{item.produto.id}</p>
                    <p className="text-sm font-medium text-on-surface line-clamp-1">{item.produto.name}</p>
                  </div>
                  <button onClick={() => setItens(prev => prev.filter((_, j) => j !== i))}
                    className="text-[#e24b4a] hover:text-[#e24b4a] flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setItens(prev => prev.map((it, j) => j === i && it.qty > 1 ? { ...it, qty: it.qty - 1 } : it))}
                      className="w-7 h-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-bold">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                    <button onClick={() => setItens(prev => prev.map((it, j) => j === i ? { ...it, qty: it.qty + 1 } : it))}
                      className="w-7 h-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center text-sm font-bold">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant">Custo: {fmtR(item.custoUnit * item.qty)}</p>
                    <p className="text-xs font-medium text-[#378add]">Venda: {fmtR(item.vendaUnit * item.qty)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totais */}
          <div className="p-4 bg-[hsl(var(--muted))] space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Total custo</span>
              <span className="font-medium text-on-surface">{fmtR(totalCusto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Total venda (2×)</span>
              <span className="font-medium text-[#378add]">{fmtR(totalVenda)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[hsl(var(--border))] pt-1.5">
              <span className="font-bold text-on-surface">Margem da operação</span>
              <span className="font-bold text-[#378add]">{fmtR(margem)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Botão confirmar */}
      {itens.length > 0 && (
        <button onClick={confirmar} disabled={salvando || !destino || !employeeId}
          className="w-full py-4 rounded-2xl bg-[hsl(var(--primary))] text-white font-bold text-base disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2">
          {salvando
            ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
            : <><CheckCircle className="w-5 h-5" /> Confirmar saída — {itens.length} produto(s)</>
          }
        </button>
      )}
    </div>
  );
}
