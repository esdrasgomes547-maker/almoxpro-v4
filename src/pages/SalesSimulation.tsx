import { useEffect, useState, useMemo } from 'react';
import { Download, Plus, Trash2, Calculator, Receipt, User, Info, Sparkles, Trash, RefreshCw } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit, doc, getDoc } from 'firebase/firestore';
import { useOrganization } from "../lib/tenant";
import { HeroSuccessPopup } from "../components/HeroSuccessPopup";

export function SalesSimulation() {
  const { orgId } = useOrganization();
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ id: string, name: string, price: number, qty: number }[]>([]);
  const [currentItem, setCurrentItem] = useState("");
  const [qty, setQty] = useState(1);

  // Advanced customization parameters for professional simulation
  const [clientName, setClientName] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Prazo - Faturamento 30 Dias");
  
  // Custom item states
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState<number>(0);
  const [customItemQty, setCustomItemQty] = useState<number>(1);

  // Successful simulation generated modal feedback
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successConfig, setSuccessConfig] = useState({ title: "", subtitle: "" });

  // Organization settings loaded synchronously or asynchronously
  const [settings, setSettings] = useState({
    companyName: "AlmoxPro - Gestão",
    managerName: "Gestor Principal",
    cnpj: "00.000.000/0001-00",
    email: "contato@almoxpro.com.br",
    phone: "(11) 4002-8922",
    avatarUrl: ""
  });

  // Pull operational branding data in real-time
  useEffect(() => {
    const fetchSettings = async () => {
      if (!orgId) return;
      try {
        const docRef = doc(db, `organizations/${orgId}/settings`, "default");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        } else {
          const local = localStorage.getItem(`almox_settings_${orgId}`);
          if (local) {
            setSettings(JSON.parse(local));
          }
        }
      } catch (error) {
        console.warn("Could not load organization settings in Simulation page:", error);
        const local = localStorage.getItem(`almox_settings_${orgId}`);
        if (local) {
          setSettings(JSON.parse(local));
        }
      }
    };
    fetchSettings();
  }, [orgId]);

  // Pull live inventory values from production db
  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/inventory`), limit(2000));
    const unsub = onSnapshot(q, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/inventory`));
    return () => unsub();
  }, [orgId]);

  // Find info about current item if selected
  const activeProductMeta = useMemo(() => {
    return inventory.find(i => i.id === currentItem);
  }, [inventory, currentItem]);

  // Handle inventory add action
  const addItem = () => {
    if (!currentItem) return;
    const product = inventory.find(i => i.id === currentItem);
    if (product) {
      const priceVal = Number(product.price) || 0;
      const existingIdx = selectedItems.findIndex(item => item.id === product.id);
      if (existingIdx > -1) {
        const updated = [...selectedItems];
        updated[existingIdx].qty += qty;
        setSelectedItems(updated);
      } else {
        setSelectedItems([...selectedItems, { id: product.id, name: product.name, price: priceVal, qty }]);
      }
      setCurrentItem("");
      setQty(1);
    }
  };

  // Handle custom manual item add action
  const addCustomItem = () => {
    if (!customItemName.trim() || customItemPrice <= 0 || customItemQty <= 0) return;
    const customId = `custom_${Date.now()}`;
    setSelectedItems([
      ...selectedItems,
      {
        id: customId,
        name: customItemName.trim(),
        price: Number(customItemPrice),
        qty: customItemQty
      }
    ]);
    // Reset fields
    setCustomItemName("");
    setCustomItemPrice(0);
    setCustomItemQty(1);
    setIsCustomMode(false);
  };

  const removeItem = (id: string) => {
    setSelectedItems(selectedItems.filter(i => i.id !== id));
  };

  const clearSimulation = () => {
    setSelectedItems([]);
    setClientName("");
    setDiscount(0);
    setNotes("");
    setPaymentMethod("Prazo - Faturamento 30 Dias");
  };

  // Calculations for dynamic invoice preview
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }, [selectedItems]);

  const discountAmount = useMemo(() => {
    return (subtotal * discount) / 100;
  }, [subtotal, discount]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const totalItemsCount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.qty, 0);
  }, [selectedItems]);

  // High-fidelity dynamic PDF summary generator
  const downloadPDF = () => {
    if (selectedItems.length === 0) return;
    
    const doc = new jsPDF();
    
    // Header Corporate slate-box banner
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 42, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text(settings.companyName.toUpperCase(), 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`CNPJ: ${settings.cnpj}`, 14, 21);
    doc.text(`Telefone: ${settings.phone} | E-mail: ${settings.email}`, 14, 25);
    doc.text(`Gestor de Operações: ${settings.managerName}`, 14, 29);
    
    // Right accent metadata card block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235); // Blue primary brand
    doc.text("SIMULAÇÃO DE ORÇAMENTO", 120, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Identificador: #SIM-${Math.floor(100000 + Math.random() * 900000)}`, 120, 21);
    doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 120, 25);
    doc.text(`Validade operacional: 30 dias corridos`, 120, 29);

    // subtle horizontal line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46);
    
    // Recipient specifications block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("ESPECIFICAÇÕES DO REQUISITANTE / SETOR DESTINATÁRIO", 14, 53);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Cliente / Departamento: ${clientName || "Consumidor Geral / Setor Interno"}`, 14, 59);
    doc.text(`Condição de Faturamento: ${paymentMethod}`, 14, 64);
    if (notes) {
      doc.text(`Observações / Finalidade: ${notes}`, 14, 69);
    }

    const startYTable = notes ? 76 : 70;
    
    const tableData = selectedItems.map((item, index) => [
      (index + 1).toString(),
      item.name,
      item.qty.toString(),
      `R$ ${item.price.toFixed(2)}`,
      `R$ ${(item.qty * item.price).toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [['Item', 'Descrição Detalhada do Item / Material', 'Qtd', 'Preço Unitário', 'Total']],
      body: tableData,
      startY: startYTable,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235], // Almoxpro dynamic primary blue
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 105 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 27, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Finance alignment card on the bottom-right corner
    const calculationsStartPage = finalY;
    if (calculationsStartPage < 250) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(120, calculationsStartPage, 76, 32, "FD");
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Subtotal Bruto:`, 123, calculationsStartPage + 7);
      doc.text(`R$ ${subtotal.toFixed(2)}`, 192, calculationsStartPage + 7, { align: "right" });
      
      doc.text(`Desconto Aplicado (${discount}%):`, 123, calculationsStartPage + 14);
      doc.setTextColor(225, 29, 72); // Red alert tone for discounts
      doc.text(`- R$ ${discountAmount.toFixed(2)}`, 192, calculationsStartPage + 14, { align: "right" });
      
      doc.setDrawColor(226, 232, 240);
      doc.line(123, calculationsStartPage + 19, 193, calculationsStartPage + 19);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`VALOR LÍQUIDO SIMULADO:`, 123, calculationsStartPage + 25);
      doc.setTextColor(37, 99, 235); // primary text color
      doc.text(`R$ ${total.toFixed(2)}`, 192, calculationsStartPage + 25, { align: "right" });

      // digital signature lines
      const approvalLineY = calculationsStartPage + 48;
      if (approvalLineY < 275) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.5);
        doc.line(14, approvalLineY, 90, approvalLineY);
        doc.line(120, approvalLineY, 196, approvalLineY);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text("Responsável pela Emissão", 52, approvalLineY + 4, { align: "center" });
        doc.text("Cliente / Setor Beneficiário", 158, approvalLineY + 4, { align: "center" });
        
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.text(settings.managerName, 52, approvalLineY - 2, { align: "center" });
        doc.text(clientName || "(Assinatura Manual)", 158, approvalLineY - 2, { align: "center" });
      }
    } else {
      // Draw minimal layout directly on fallback structure
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Valor Simulado Total Líquido: R$ ${total.toFixed(2)}`, 14, finalY);
    }

    // Save formal file format
    const filenameFormated = `Simulacao_Orcamento_${(clientName || "Geral").toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filenameFormated);

    // Trigger feedback popup
    setSuccessConfig({
      title: "Orçamento Simulado com Sucesso! 📑",
      subtitle: `O arquivo PDF '${filenameFormated}' foi compilado e baixado no padrão corporativo da empresa ${settings.companyName}.`
    });
    setIsSuccessOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Dynamic 3D Header Card in Almoxpro style */}
      <div className="relative p-6 md:p-8 rounded-2xl bg-[hsl(var(--card))] border-2 border-primary/20 shadow-[4px_4px_0px_0px_hsl(var(--primary))] overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-extrabold tracking-widest uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Simulação e Orçamentos Live
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Simulador de Orçamentos</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Consulte seu inventário em tempo real, some itens avulsos e em estoque, aplique impostos/descontos e imprima relatórios sob medida.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border-2 border-primary/20 shadow-[2px_2px_0px_0px_rgba(var(--primary),0.1)] shrink-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-black leading-none text-primary uppercase tracking-wider">Unidade Ativa</p>
              <p className="text-[10px] font-bold text-foreground mt-1 truncate max-w-[150px]">
                {settings.companyName || "AlmoxPro - Gestão"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: CONFIGURATION AND ITEM ADDER */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] shadow-[5px_5px_0px_0px_hsl(var(--primary)_/_0.15)] p-5 space-y-5">
            
            <div className="flex items-center justify-between border-b pb-3 border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Inclusão de Itens</h3>
              </div>
              
              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-[10px] font-extrabold text-primary hover:underline uppercase tracking-wide flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3 animate-spin duration-[4000ms]" />
                {isCustomMode ? "Usar Inventário" : "Inserir Avulso"}
              </button>
            </div>

            {/* Inclusão Standard baseada no Inventário em Nuvem */}
            {!isCustomMode ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Selecionar Item do Estoque</span>
                    <span className="text-[9px] bg-primary/5 border border-primary/20 rounded px-1.5 py-0.5 text-primary font-mono tracking-tight font-medium">
                      {inventory.length} produtos
                    </span>
                  </label>
                  <select
                    value={currentItem}
                    onChange={e => setCurrentItem(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-bold focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner"
                  >
                    <option value="">-- Selecione o item do estoque --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id} className="font-sans font-bold text-sm">
                        {item.name} (R$ {(Number(item.price) || 0).toFixed(2)}) - Disp: {item.stock ?? 0}
                      </option>
                    ))}
                  </select>
                </div>

                {activeProductMeta && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/25 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] font-black text-primary uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Ficha rápida do Item Selecionado
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">ID do Estoque:</span>
                        <p className="font-mono font-bold text-foreground">#{activeProductMeta.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Preço Padrão:</span>
                        <p className="font-bold text-emerald-600">R$ {(Number(activeProductMeta.price) || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Disponibilidade:</span>
                        <p className={`font-bold ${activeProductMeta.stock > 0 ? "text-blue-600" : "text-amber-600"}`}>
                          {activeProductMeta.stock ?? 0} {activeProductMeta.unit || "unid"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Categoria:</span>
                        <p className="font-bold text-stone-600 truncate">{activeProductMeta.category || "Não definida"}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-center text-sm font-black focus:outline-none focus:border-primary focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={!currentItem}
                      className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest border-2 border-primary/20 shadow-[3px_3px_0px_0px_hsl(var(--primary))] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_hsl(var(--primary))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-4 w-4 stroke-[3px]" /> Adicionar Item
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Inclusão de Produto Avulso (Custom Item) no Orçamento */
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                    Nome do Item Avulso
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Serviço de Instalação Técnica"
                    value={customItemName}
                    onChange={e => setCustomItemName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                      Preço Unitário (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="89.90"
                      value={customItemPrice || ""}
                      onChange={e => setCustomItemPrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-mono font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={customItemQty}
                      onChange={e => setCustomItemQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-black text-center focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addCustomItem}
                  disabled={!customItemName.trim() || customItemPrice <= 0}
                  className="w-full h-10 rounded-lg bg-stone-900 dark:bg-stone-805 text-white font-black text-xs uppercase tracking-widest border-2 border-stone-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none transition-all duration-100 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3px]" /> Adicionar Avulso
                </button>
              </div>
            )}
          </div>

          {/* DADOS DE FATURAMENTO / CLIENTE CARD */}
          <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] shadow-[5px_5px_0px_0px_hsl(var(--primary)_/_0.15)] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2.5 border-border/60">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30">
                <User className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Configurações do Cliente</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                Nome do Cliente / Setor Destinatário
              </label>
              <input
                type="text"
                placeholder="Ex: Setor de Obras e Manutenção"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-bold focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                Condições de Pagamento / Repasse
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-bold focus:outline-none focus:border-primary transition-colors"
              >
                <option value="Prazo - Faturamento 30 Dias">Prazo - Faturamento 30 Dias</option>
                <option value="PIX Direcionado - Desconto Integrado">PIX Direcionado - Desconto Integrado</option>
                <option value="Boleto Bancário à Vista">Boleto Bancário à Vista</option>
                <option value="Cartão de Crédito Corporativo">Cartão de Crédito Corporativo</option>
                <option value="Ajuste Interno Sem Emissão Fiscal">Ajuste Interno Sem Emissão Fiscal</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex justify-between items-center">
                  <span>Percentual de Desconto</span>
                  <span className="font-mono text-xs font-black text-rose-600">{discount}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-[hsl(var(--muted))] appearance-none cursor-pointer accent-primary"
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                  Corte (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={discount}
                  onChange={e => setDiscount(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-full h-10 px-2 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-center text-sm font-black focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                Observações / Informações Complementares
              </label>
              <textarea
                rows={2}
                placeholder="Finalidade de uso, prazos adicionais de entrega ou referências do projeto..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: INTERACTIVE INVOICE LEDGER */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] shadow-[5px_5px_0px_0px_hsl(var(--primary)_/_0.15)] p-6 flex flex-col justify-between min-h-[480px]">
            
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30 animate-pulse">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Demonstrativo do Orçamento</h3>
                </div>

                {selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSimulation}
                    className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-extrabold uppercase border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash className="h-3.5 w-3.5" /> Limpar Lista
                  </button>
                )}
              </div>

              {/* EMPTY SIMULATION PLACEHOLDER STATE */}
              {selectedItems.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                  <div className="relative h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-inner group animate-smooth">
                    <Receipt className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 rounded-full bg-amber-500 text-[10px] font-bold text-white items-center justify-center animate-bounce">
                      !
                    </span>
                  </div>
                  <div className="max-w-md">
                    <h4 className="font-extrabold text-[13px] text-foreground uppercase tracking-wider">Simulador Pronto e Aguardando</h4>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                      Adicione itens do estoque ou crie um item avulso utilizando os controles laterais. O espelho do documento fiscal e o faturamento serão formatados em tempo de execução.
                    </p>
                  </div>
                </div>
              ) : (
                /* SELECTED ITEMS REAL-TIME TABLE */
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] shadow-inner bg-stone-50/20 max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[hsl(var(--muted))] border-b-2 border-[hsl(var(--border))]">
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground w-12 text-center">Nº</th>
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground">Material / Produto</th>
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground w-16 text-center">Quant.</th>
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground w-28 text-right">Unitário (R$)</th>
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground w-28 text-right">Total (R$)</th>
                        <th className="p-3 text-[10px] font-black uppercase text-muted-foreground w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/40 transition-colors font-semibold text-xs group animate-in slide-in-from-top-1 duration-100">
                          <td className="p-3 text-center text-[10px] font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="p-3 truncate max-w-[200px] text-foreground font-bold">{item.name}</td>
                          <td className="p-3 text-center text-foreground font-mono font-black bg-primary/[0.02]">{item.qty}</td>
                          <td className="p-3 text-right font-mono text-foreground font-bold">R$ {item.price.toFixed(2)}</td>
                          <td className="p-3 text-right font-mono text-primary font-black">R$ {(item.qty * item.price).toFixed(2)}</td>
                          <td className="p-3 text-center animate-smooth">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer animate-smooth"
                              title="Remover Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* LOWER FINANCIAL MATH PANEL */}
            {selectedItems.length > 0 && (
              <div className="mt-8 border-t border-border pt-5 space-y-5 animate-in fade-in duration-300">
                
                {/* Meta Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[hsl(var(--muted))]/50 p-3 rounded-xl border border-border/60 text-center font-bold">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Itens Totais</span>
                    <span className="text-sm font-black text-foreground">{totalItemsCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Subtotal Bruto</span>
                    <span className="text-sm font-black text-stone-700 dark:text-stone-300">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Desconto Especial</span>
                    <span className="text-sm font-black text-rose-600">- R$ {discountAmount.toFixed(2)} ({discount}%)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-primary uppercase tracking-wider block">Valor Líquido</span>
                    <span className="text-sm font-black text-primary">R$ {total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Additional Information details on the bottom */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-50/10 p-3.5 rounded-xl border border-dashed border-border text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>Todas as taxas, fórmulas matemáticas e campos de layout seguem as diretrizes AlmoxPro.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">✓ PDF Homologado</span>
                  </div>
                </div>

                {/* Active print configuration */}
                <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                  <button
                    type="button"
                    onClick={clearSimulation}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg border-2 border-stone-200 text-stone-600 font-extrabold text-xs hover:bg-stone-50 transition-all text-center cursor-pointer"
                  >
                    Resetar Calculadora
                  </button>
                  <button
                    type="button"
                    onClick={downloadPDF}
                    className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest border-2 border-primary/20 shadow-[4px_4px_0px_0px_hsl(var(--primary))] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_hsl(var(--primary))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="h-4 w-4 stroke-[3px]" />
                    Gerar Orçamento PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <HeroSuccessPopup
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        title={successConfig.title}
        subtitle={successConfig.subtitle}
      />
    </div>
  );
}
