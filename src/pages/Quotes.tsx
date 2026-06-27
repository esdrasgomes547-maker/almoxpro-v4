import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  MessageSquare,
  Mail,
  Plus, 
  FileText, 
  Download, 
  Trash2, 
  Search, 
  User, 
  Scale, 
  Calculator, 
  Pencil,
  X, 
  CheckCircle2, 
  Clock,
  History,
  AlertTriangle,
  ScrollText,
  Eye,
  Package,
  Briefcase,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, limit, addDoc, updateDoc, doc, deleteDoc, orderBy, getDoc } from 'firebase/firestore';
import { useOrganization } from "../lib/tenant";
import { InventoryItem, Quote, CompanySettings, Service, QuoteItem } from "../types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from 'date-fns';

export function Quotes() {
  const { orgId, loading: orgLoading } = useOrganization();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'client' | 'items' | 'summary'>('client');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const normalize = (text: string) => 
    text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  // New Quote form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Quote>>({
    customerName: "",
    customerDocument: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    items: [],
    serviceDescription: "",
    laborValue: 0,
    taxRate: 0,
    notes: "Este orçamento tem validade de 15 dias. Os preços estão sujeitos a alterações baseadas na disponibilidade de estoque.",
    status: 'DRAFT',
    validUntil: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  });

  // Inventory/Service Selection state
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [serviceQty, setServiceQty] = useState(1);
  const [lastItemPreview, setLastItemPreview] = useState<QuoteItem | null>(null);

  useEffect(() => {
    if (!orgId || orgLoading) return;

    // Fetch Quotes
    const qQuotes = query(collection(db, `organizations/${orgId}/quotes`), orderBy('date', 'desc'), limit(100));
    const unsubQuotes = onSnapshot(qQuotes, (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'quotes'));

    // Fetch Inventory for selection
    const qInv = query(collection(db, `organizations/${orgId}/inventory`), limit(1000));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    });

    // Fetch Services for selection
    const qServs = query(collection(db, `organizations/${orgId}/services`), limit(500));
    const unsubServs = onSnapshot(qServs, (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    });

    // Fetch Company Settings for Header/Branding
    const fetchSettings = async () => {
      const sRef = doc(db, `organizations/${orgId}/settings`, "default");
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        setSettings(sSnap.data() as CompanySettings);
      }
    };
    fetchSettings();

    return () => {
      unsubQuotes();
      unsubInv();
      unsubServs();
    };
  }, [orgId, orgLoading]);

  const handleAddItem = (type: 'PRODUCT' | 'SERVICE') => {
    let newItem: QuoteItem | null = null;
    if (type === 'PRODUCT') {
      const product = inventory.find(i => i.id === selectedProduct);
      if (!product) return;

      newItem = { id: product.id, name: product.name, price: product.price, qty: productQty, type: 'PRODUCT' };
      const existingItem = formData.items?.find(i => i.id === product.id && i.type === 'PRODUCT');
      if (existingItem) {
        setFormData({
          ...formData,
          items: formData.items?.map(i => (i.id === product.id && i.type === 'PRODUCT') ? { ...i, qty: i.qty + productQty } : i)
        });
      } else {
        setFormData({
          ...formData,
          items: [...(formData.items || []), newItem]
        });
      }
      setSelectedProduct("");
      setProductQty(1);
    } else {
      const service = services.find(s => s.id === selectedService);
      if (!service) return;

      newItem = { id: service.id, name: service.name, price: service.basePrice, qty: serviceQty, type: 'SERVICE' };
      const existingItem = formData.items?.find(i => i.id === service.id && i.type === 'SERVICE');
      if (existingItem) {
        setFormData({
          ...formData,
          items: formData.items?.map(i => (i.id === service.id && i.type === 'SERVICE') ? { ...i, qty: i.qty + serviceQty } : i)
        });
      } else {
        setFormData({
          ...formData,
          items: [...(formData.items || []), newItem]
        });
      }
      setSelectedService("");
      setServiceQty(1);
    }

    if (newItem) {
      setLastItemPreview(newItem);
      // Auto-clear preview after 5 seconds
      setTimeout(() => setLastItemPreview(null), 5000);
    }
  };

  const removeItem = (id: string, type: 'PRODUCT' | 'SERVICE') => {
    setFormData({
      ...formData,
      items: formData.items?.filter(i => !(i.id === id && i.type === type))
    });
  };

  const calculateSubtotal = () => {
    return formData.items?.reduce((sum, i) => sum + (i.price * i.qty), 0) || 0;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const labor = Number(formData.laborValue) || 0;
    const tax = (subtotal + labor) * ((Number(formData.taxRate) || 0) / 100);
    return subtotal + labor + tax;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !formData.customerName) {
      toast.error("Preencha o nome do cliente.");
      return;
    }

    setLoading(true);
    const quoteData = {
      ...formData,
      total: calculateTotal(),
      date: formData.date || new Date().toISOString(),
      items: formData.items || []
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, `organizations/${orgId}/quotes`, editingId), quoteData);
        toast.success("Orçamento atualizado!");
      } else {
        await addDoc(collection(db, `organizations/${orgId}/quotes`), quoteData);
        toast.success("Orçamento criado!");
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'quotes');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerDocument: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      items: [],
      serviceDescription: "",
      laborValue: 0,
      taxRate: 0,
      notes: "Este orçamento tem validade de 15 dias. Os preços estão sujeitos a alterações baseadas na disponibilidade de estoque.",
      status: 'DRAFT',
      validUntil: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    });
    setEditingId(null);
    setIsDetailView(false);
    setActiveTab('client');
  };

  const handleView = (quote: Quote) => {
    setFormData(quote);
    setEditingId(quote.id);
    setIsDetailView(true);
    setIsModalOpen(true);
  };

  const handleEdit = (quote: Quote) => {
    setFormData(quote);
    setEditingId(quote.id);
    setIsDetailView(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!window.confirm("Deseja realmente excluir este orçamento?")) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/quotes`, id));
      toast.success("Orçamento excluído.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'quotes');
    }
  };

  const shareWhatsApp = (quote: Quote) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const text = `Olá ${quote.customerName}, aqui está o orçamento solicitado da ${settings?.companyName || 'AlmoxPro'}:
📌 *ID:* ${quote.id.slice(-8).toUpperCase()}
📅 *Data:* ${format(new Date(quote.date), 'dd/MM/yyyy')}
💰 *Total:* ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}
✅ *Validade:* ${format(new Date(quote.validUntil), 'dd/MM/yyyy')}

Entre em contato para aprovação.`;
    const url = `https://wa.me/${quote.customerPhone?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareEmail = (quote: Quote) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const subject = `Orçamento [${quote.id.slice(-8).toUpperCase()}] - ${settings?.companyName || "AlmoxPro"}`;
    const body = `Olá ${quote.customerName},\n\nSegue o resumo do seu orçamento:\n\nID: ${quote.id.slice(-8).toUpperCase()}\nData: ${format(new Date(quote.date), 'dd/MM/yyyy')}\nTotal: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}\nValidade: ${format(new Date(quote.validUntil), 'dd/MM/yyyy')}\n\nAtenciosamente,\n${settings?.companyName || "Equipe AlmoxPro"}`;
    const url = `mailto:${quote.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const generatePDF = async (quote: Quote) => {
    toast.info("Gerando documento...");
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 40);
      doc.text(settings?.companyName || "Almox PRO", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`CNPJ: ${settings?.cnpj || "N/A"}`, 14, 26);
      doc.text(`Email: ${settings?.email || "N/A"}`, 14, 30);
      doc.text(`Tel: ${settings?.phone || "N/A"}`, 14, 34);

      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text("ORÇAMENTO", pageWidth - 60, 25);
      doc.setFontSize(10);
      doc.text(`Nº: ${quote.id.slice(-6).toUpperCase()}`, pageWidth - 60, 31);
      doc.text(`Data: ${format(new Date(quote.date), 'dd/MM/yyyy')}`, pageWidth - 60, 35);
      doc.text(`Válido até: ${format(new Date(quote.validUntil), 'dd/MM/yyyy')}`, pageWidth - 60, 39);

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 45, pageWidth - 14, 45);

      // Customer Info
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("CLIENTE", 14, 55);
      doc.setFontSize(10);
      doc.text(`Nome: ${quote.customerName}`, 14, 61);
      if (quote.customerDocument) doc.text(`CPF/CNPJ: ${quote.customerDocument}`, 14, 66);
      if (quote.customerAddress) doc.text(`Endereço: ${quote.customerAddress}`, 14, 71);
      if (quote.customerPhone) doc.text(`Telefone: ${quote.customerPhone}`, 14, 76);

      autoTable(doc, {
        head: [['Tipo', 'Item / Produto', 'Qtd', 'Vlr. Unitário', 'Total']],
        body: quote.items.map(item => [
          item.type === 'SERVICE' ? 'Serviço' : 'Produto',
          item.name,
          item.qty.toString(),
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price),
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.qty * item.price)
        ]),
        startY: 85,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;

      // Service Description
      if (quote.serviceDescription) {
        doc.setFontSize(12);
        doc.text("DESCRIÇÃO DO SERVIÇO", 14, finalY);
        doc.setFontSize(9);
        const splitDesc = doc.splitTextToSize(quote.serviceDescription, pageWidth - 28);
        doc.text(splitDesc, 14, finalY + 6);
        finalY += (splitDesc.length * 5) + 15;
      }

      // Totals
      const subtotal = quote.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
      const labor = quote.laborValue || 0;
      const taxes = (subtotal + labor) * ((quote.taxRate || 0) / 100);
      
      doc.setFontSize(10);
      doc.text(`Subtotal Produtos:`, pageWidth - 80, finalY);
      doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal), pageWidth - 30, finalY, { align: 'right' });
      
      doc.text(`Mão de Obra / Serviços:`, pageWidth - 80, finalY + 6);
      doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(labor), pageWidth - 30, finalY + 6, { align: 'right' });

      if (taxes > 0) {
        doc.text(`Impostos (${quote.taxRate}%):`, pageWidth - 80, finalY + 12);
        doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(taxes), pageWidth - 30, finalY + 12, { align: 'right' });
        finalY += 6;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GERAL:`, pageWidth - 80, finalY + 15);
      doc.text(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total), pageWidth - 30, finalY + 15, { align: 'right' });

      // Notes/Legislation
      if (quote.notes) {
        finalY += 30;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("OBSERVAÇÕES E CONFORMIDADES LEGAIS", 14, finalY);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 28);
        doc.text(splitNotes, 14, finalY + 6);
      }

      // Signatures
      doc.line(14, 280, 80, 280);
      doc.text("Responsável AlmoxPro", 35, 285, { align: 'center' });
      
      doc.line(pageWidth - 80, 280, pageWidth - 14, 280);
      doc.text("Ciente do Cliente", pageWidth - 47, 285, { align: 'center' });

      doc.save(`orcamento_${quote.customerName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Erro ao gerar o PDF.");
    }
  };

  const filteredQuotes = useMemo(() => {
    const term = normalize(searchTerm);
    return quotes.filter(q => 
      normalize(q.customerName).includes(term) ||
      normalize(q.id).includes(term) ||
      q.items.some(item => normalize(item.name).includes(term))
    );
  }, [quotes, searchTerm]);

  const filteredInventory = useMemo(() => {
    const term = normalize(productSearch);
    if (!term) return inventory;
    return inventory.filter(item => 
      normalize(item.name).includes(term) ||
      normalize(item.id).includes(term)
    );
  }, [inventory, productSearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <Badge variant="outline" className="border-slate-300 text-slate-500 font-bold text-[10px] tracking-wider">RASCUNHO</Badge>;
      case 'SENT': return <Badge className="bg-blue-500 hover:bg-blue-600 font-bold text-[10px] tracking-wider">ENVIADO</Badge>;
      case 'APPROVED': return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-bold text-[10px] tracking-wider">APROVADO</Badge>;
      case 'REJECTED': return <Badge variant="destructive" className="font-bold text-[10px] tracking-wider">REJEITADO</Badge>;
      default: return <Badge variant="secondary" className="font-bold text-[10px] tracking-wider">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent italic">AlmoxPro Logística Profissional</h1>
          <p className="text-sm text-muted-foreground font-medium">Controle de Orçamentos e Serviços • Helielton Administrativo</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="mr-2 h-5 w-5" /> Novo Orçamento
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md w-full relative group">
        <Search 
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors cursor-pointer" 
          onClick={() => searchInputRef.current?.focus()}
        />
        <input 
          ref={searchInputRef}
          placeholder="Buscar por cliente, ID ou produto..." 
          className="w-full h-11 pl-10 pr-12 rounded-xl border border-primary/10 bg-background/50 backdrop-blur-sm px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-inner"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-primary/10 text-primary"
          onClick={() => {
            searchInputRef.current?.focus();
            toast.info(`Busca ativa: ${filteredQuotes.length} orçamentos encontrados.`);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <Card className="border-primary/10 overflow-hidden shadow-xl bg-background/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Emissão</TableHead>
                <TableHead className="hidden lg:table-cell">Validade</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right whitespace-nowrap px-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredQuotes.map((quote, index) => (
                  <motion.tr 
                    key={quote.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-primary/5 transition-colors group border-b border-primary/5"
                  >
                    <TableCell className="font-mono text-[10px] text-muted-foreground uppercase">{quote.id.slice(-8)}</TableCell>
                    <TableCell>
                      <div className="font-semibold truncate max-w-[150px] sm:max-w-none">{quote.customerName}</div>
                      <div className="text-[10px] text-muted-foreground md:hidden">{format(new Date(quote.date), 'dd/MM/yyyy')}</div>
                    </TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{format(new Date(quote.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">{format(new Date(quote.validUntil), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-bold text-primary whitespace-nowrap">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}</TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell className="text-right px-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(quote)} className="h-8 w-8 text-slate-600 hover:text-primary hover:bg-primary/10 transition-transform active:scale-95" title="Ver Detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <div className="hidden sm:flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => shareWhatsApp(quote)} className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-transform active:scale-95" title="WhatsApp">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => shareEmail(quote)} className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-transform active:scale-95" title="Email">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => generatePDF(quote)} className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-transform active:scale-95" title="PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(quote)} className="h-8 w-8 text-slate-600 hover:bg-muted transition-transform active:scale-95" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(quote.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 transition-transform active:scale-95" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filteredQuotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center px-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center text-muted-foreground"
                    >
                      <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="font-medium">Nenhum orçamento encontrado.</p>
                      <Button onClick={() => { resetForm(); setIsModalOpen(true); }} variant="link" className="mt-2 text-primary">
                        <Plus className="mr-1 h-3 w-3" /> Criar um agora
                      </Button>
                    </motion.div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Novo/Editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm scrollbar-hide">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 cursor-pointer"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl sm:max-h-[90vh] h-full sm:h-auto min-h-screen sm:min-h-0 flex flex-col overflow-hidden z-10"
            >
              <Card className="flex flex-col h-full sm:h-auto sm:max-h-[85vh] shadow-2xl border-primary/20 bg-background sm:rounded-xl rounded-none">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 px-6 py-4 sticky top-0 z-10">
                  <div className="flex flex-col">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calculator className="h-5 w-5 text-primary" />
                      </div>
                      {isDetailView ? "Detalhes do Orçamento" : (editingId ? "Editar Orçamento" : "Novo Orçamento")}
                    </CardTitle>
                    {editingId && <span className="text-[10px] text-muted-foreground uppercase ml-10">ID: {editingId.slice(-8)}</span>}
                  </div>
                  <button className="p-2 rounded-full hover:bg-muted transition-colors" onClick={() => setIsModalOpen(false)}>
                    <X className="h-5 w-5" />
                  </button>
                </CardHeader>
                
                {/* Tabs */}
                <div className="flex border-b bg-muted/20 px-6 overflow-x-auto scrollbar-hide py-1">
                  {[
                    { id: 'client', label: '1. Identificação', icon: User },
                    { id: 'items', label: '2. Composição', icon: Package },
                    { id: 'summary', label: '3. Fechamento', icon: CheckCircle2 }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`group px-5 py-4 text-xs font-bold uppercase tracking-widest transition-all relative whitespace-nowrap flex items-center gap-2 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/50 group-hover:bg-muted font-mono'}`}>
                          {isActive ? <Icon className="h-3 w-3" /> : tab.label.charAt(0)}
                        </div>
                        {tab.label.split('. ')[1]}
                        {isActive && <motion.div layoutId="modalTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                      </button>
                    )
                  })}
                </div>

                <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    <AnimatePresence mode="wait">
                      {activeTab === 'client' && (
                        <motion.div 
                          key="client"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> Nome do Cliente
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                value={formData.customerName}
                                onChange={e => setFormData({...formData, customerName: e.target.value})}
                                required
                                readOnly={isDetailView}
                                placeholder="Nome completo ou Razão Social"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" /> CPF / CNPJ
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                value={formData.customerDocument}
                                onChange={e => setFormData({...formData, customerDocument: e.target.value})}
                                readOnly={isDetailView}
                                placeholder="000.000.000-00"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Status do Orçamento
                              </label>
                              <select 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value as any})}
                                disabled={isDetailView}
                              >
                                <option value="DRAFT">Rascunho</option>
                                <option value="SENT">Enviado</option>
                                <option value="APPROVED">Aprovado</option>
                                <option value="REJECTED">Rejeitado</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> Telefone
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                value={formData.customerPhone}
                                onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                                readOnly={isDetailView}
                                placeholder="(00) 00000-0000"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> E-mail
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                type="email"
                                value={formData.customerEmail}
                                onChange={e => setFormData({...formData, customerEmail: e.target.value})}
                                readOnly={isDetailView}
                                placeholder="cliente@email.com"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Validade do Orçamento
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                type="date"
                                value={formData.validUntil}
                                onChange={e => setFormData({...formData, validUntil: e.target.value})}
                                readOnly={isDetailView}
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2 lg:col-span-3">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> Endereço de Entrega / Instalação
                              </label>
                              <input 
                                className="w-full h-10 px-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                                value={formData.customerAddress}
                                onChange={e => setFormData({...formData, customerAddress: e.target.value})}
                                readOnly={isDetailView}
                                placeholder="Logradouro, nº, Bairro, Cidade - UF"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pt-4">
                            <Button type="button" onClick={() => setActiveTab('items')} className="bg-primary hover:bg-primary/90 transition-all px-8">
                              Continuar para Itens <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'items' && (
                        <motion.div 
                          key="items"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Materials Selection */}
                            <div className="space-y-4">
                              {!isDetailView && (
                                <Card className="border-dashed bg-muted/5 border-primary/20">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                      <Package className="h-4 w-4 text-primary" /> Adicionar Produtos
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="relative group">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                      <input 
                                        ref={productSearchRef}
                                        placeholder="Filtrar por nome do produto..."
                                        className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                      <select 
                                        className="sm:col-span-8 h-10 rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={selectedProduct}
                                        onChange={e => setSelectedProduct(e.target.value)}
                                      >
                                        <option value="">{filteredInventory.length > 0 ? "Selecione um produto..." : "Nenhum disponível"}</option>
                                        {filteredInventory.map(item => (
                                          <option key={item.id} value={item.id}>
                                            {item.name} ({item.qty} un) - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="sm:col-span-4 flex gap-2">
                                        <input 
                                          type="text" 
                                          className="w-full h-10 px-2 rounded-md border border-input text-sm text-center font-mono"
                                          value={productQty || ""}
                                          onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setProductQty(val === "" ? 0 : Number(val));
                                          }}
                                          placeholder="Qtd"
                                        />
                                        <Button type="button" onClick={() => handleAddItem('PRODUCT')} variant="secondary" className="px-4 shadow-sm">
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}

                              <AnimatePresence>
                                {lastItemPreview && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    className="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-inner relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 right-0 p-1">
                                      <button onClick={() => setLastItemPreview(null)} className="text-muted-foreground hover:text-primary transition-colors">
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-start gap-4">
                                      <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                        {lastItemPreview.type === 'PRODUCT' ? <Package className="h-6 w-6" /> : <Briefcase className="h-6 w-6" />}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Item Adicionado</p>
                                            <h4 className="text-sm font-bold truncate max-w-[180px]">{lastItemPreview.name}</h4>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs font-mono font-bold text-primary">
                                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastItemPreview.price * lastItemPreview.qty)}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{lastItemPreview.qty} x {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastItemPreview.price)}</p>
                                          </div>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                           <div className="h-1 flex-1 bg-emerald-200 rounded-full overflow-hidden">
                                              <motion.div 
                                                initial={{ width: "100%" }}
                                                animate={{ width: "0%" }}
                                                transition={{ duration: 5, ease: "linear" }}
                                                className="h-full bg-emerald-500" 
                                              />
                                           </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Services Selection */}
                            <div className="space-y-4">
                              {!isDetailView && (
                                <Card className="border-dashed bg-muted/5 border-primary/20">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                      <Briefcase className="h-4 w-4 text-primary" /> Adicionar Serviços
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    <div className="relative group invisible h-10">
                                      {/* Spacer for alignment */}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                      <select 
                                        className="sm:col-span-8 h-10 rounded-md border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={selectedService}
                                        onChange={e => setSelectedService(e.target.value)}
                                      >
                                        <option value="">Selecione um serviço do catálogo...</option>
                                        {services.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.basePrice)} / {s.unit}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="sm:col-span-4 flex gap-2">
                                        <input 
                                          type="text" 
                                          className="w-full h-10 px-2 rounded-md border border-input text-sm text-center font-mono"
                                          value={serviceQty || ""}
                                          onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setServiceQty(val === "" ? 0 : Number(val));
                                          }}
                                          placeholder="Qtd"
                                        />
                                        <Button type="button" onClick={() => handleAddItem('SERVICE')} variant="secondary" className="px-4 shadow-sm">
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </div>

                          {/* Items Table */}
                          <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
                            <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Itens Listados</h4>
                              <span className="text-[10px] text-muted-foreground">{formData.items?.length || 0} itens adicionados</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                              <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                  <TableRow className="h-10 text-[11px] uppercase text-muted-foreground">
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Preço Unit.</TableHead>
                                    <TableHead>Qtd</TableHead>
                                    <TableHead>Subtotal</TableHead>
                                    {!isDetailView && <TableHead className="w-10"></TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {formData.items?.map((item, idx) => (
                                    <TableRow key={`${item.id}-${idx}`} className="h-12 hover:bg-muted/30 transition-colors group">

                                      <TableCell className="font-medium text-sm">
                                        <div className="flex items-center gap-2">
                                          {item.type === 'SERVICE' ? 
                                            <Briefcase className="h-3.5 w-3.5 text-primary/70" /> : 
                                            <Package className="h-3.5 w-3.5 text-emerald-600/70" />
                                          }
                                          <span className="truncate">{item.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-sm font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</TableCell>
                                      <TableCell className="text-sm">{item.qty}</TableCell>
                                      <TableCell className="text-sm font-bold text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.qty)}</TableCell>
                                      {!isDetailView && (
                                        <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.id, item.type)} className="text-destructive h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                  {(!formData.items || formData.items.length === 0) && (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic text-xs">
                                        Nenhum item adicionado ao orçamento.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="bg-primary/5 px-6 py-4 flex justify-between items-center border-t">
                              <span className="text-sm font-bold uppercase text-muted-foreground">Subtotal Itens</span>
                              <span className="text-xl font-bold font-mono text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateSubtotal())}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-4">
                            <Button type="button" variant="outline" onClick={() => setActiveTab('client')} className="px-6">
                              <ChevronLeft className="mr-2 h-4 w-4" /> Voltar para Cliente
                            </Button>
                            <Button type="button" onClick={() => setActiveTab('summary')} className="bg-primary hover:bg-primary/90 transition-all px-8">
                              Resumo Final <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'summary' && (
                        <motion.div 
                          key="summary"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                  <ScrollText className="h-3 w-3" /> Descritivo Técnico do Serviço
                                </label>
                                <textarea 
                                  className="w-full min-h-[140px] p-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                  placeholder="Descreva aqui o escopo do serviço, normas de segurança aplicáveis (NR-13, NR-10, etc) e observações técnicas..."
                                  value={formData.serviceDescription}
                                  onChange={e => setFormData({...formData, serviceDescription: e.target.value})}
                                  readOnly={isDetailView}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                  <History className="h-3 w-3" /> Termos, Condições e Observações
                                </label>
                                <textarea 
                                  className="w-full p-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                  rows={4}
                                  value={formData.notes}
                                  onChange={e => setFormData({...formData, notes: e.target.value})}
                                  readOnly={isDetailView}
                                  placeholder="Regras de faturamento, prazos de pagamento, validade de preços..."
                                />
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 px-1 italic">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Estas notas serão exibidas no rodapé do documento PDF.
                                </p>
                              </div>
                            </div>

                            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10 shadow-lg overflow-hidden rounded-2xl">
                              <div className="p-6 space-y-5">
                                <div className="flex items-center gap-3 border-b border-primary/10 pb-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Calculator className="h-5 w-5 text-primary" />
                                  </div>
                                  <h3 className="font-bold text-lg uppercase tracking-tight text-primary">Fechamento Financeiro</h3>
                                </div>
                                
                                <div className="space-y-4 pt-2">
                                  <div className="flex justify-between items-center text-sm group transition-transform hover:translate-x-1">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                      <Package className="h-4 w-4 opacity-50" /> Subtotal Produtos
                                    </span>
                                    <span className="font-mono font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateSubtotal())}</span>
                                  </div>
                                  
                                  <div className="flex justify-between items-center text-sm group transition-transform hover:translate-x-1">
                                    <label className="text-muted-foreground flex items-center gap-2 cursor-help" title="Custo fixo de mão de obra não vinculado a itens específicos">
                                      <Briefcase className="h-4 w-4 opacity-50" /> Mão de Obra
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">R$</span>
                                      <input 
                                        type="text" 
                                        className="w-28 h-9 pl-8 pr-2 rounded-lg border border-primary/10 bg-background/50 text-right font-mono text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                        value={formData.laborValue || ""}
                                        onChange={e => {
                                          const val = e.target.value.replace(/[^0-9.]/g, '');
                                          setFormData({...formData, laborValue: val === "" ? 0 : Number(val)});
                                        }}
                                        readOnly={isDetailView}
                                        placeholder="0,00"
                                      />
                                    </div>
                                  </div>
 
                                  <div className="flex justify-between items-center text-sm group transition-transform hover:translate-x-1">
                                    <label className="text-muted-foreground flex items-center gap-2">
                                      <Scale className="h-4 w-4 opacity-50" /> Impostos
                                    </label>
                                    <div className="relative">
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">%</span>
                                      <input 
                                        type="text" 
                                        className="w-20 h-9 px-3 pr-7 rounded-lg border border-primary/10 bg-background/50 text-right font-mono text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                        value={formData.taxRate || ""}
                                        onChange={e => {
                                          const val = e.target.value.replace(/[^0-9.]/g, '');
                                          setFormData({...formData, taxRate: val === "" ? 0 : Number(val)});
                                        }}
                                        readOnly={isDetailView}
                                        placeholder="0"
                                      />
                                    </div>
                                  </div>
                                </div>
 
                                <div className="pt-6 border-t border-primary/20 mt-4 relative">
                                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 bg-muted/20 rounded-full border border-primary/10 backdrop-blur-sm">
                                    <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest whitespace-nowrap">Cálculo Automático</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold uppercase text-muted-foreground/60 tracking-[0.2em]">Total Final</span>
                                    <span className="text-5xl font-black text-primary font-mono tracking-tighter drop-shadow-sm select-none">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="bg-amber-500/10 p-4 rounded-xl flex gap-3 items-start border border-amber-500/20 shadow-sm mt-6">
                                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                    Atenção: Revise as quantidades e normas aplicáveis. Erros técnicos podem comprometer a segurança e a rentabilidade do projeto.
                                  </p>
                                </div>
                              </div>
                            </Card>

                            <div className="space-y-4">
                              <div className="bg-muted/30 px-4 py-3 rounded-t-xl border border-b-0 flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                  <Package className="h-4 w-4" /> Itens para Conferência
                                </h4>
                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                  {formData.items?.length || 0} Itens
                                </span>
                              </div>
                              <div className="border rounded-b-xl overflow-hidden shadow-sm bg-background max-h-[400px] overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-10 text-[10px] uppercase text-muted-foreground bg-muted/20">
                                      <TableHead>Item</TableHead>
                                      <TableHead className="text-right">Vlr. Unit</TableHead>
                                      <TableHead className="text-center">Qtd</TableHead>
                                      <TableHead className="text-right">Subtotal</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {formData.items?.map((item, idx) => (
                                      <TableRow key={idx} className="h-12 hover:bg-muted/20 transition-colors">
                                        <TableCell className="font-medium text-xs max-w-[150px]">
                                          <div className="flex items-center gap-2">
                                            {item.type === 'SERVICE' ? 
                                              <Briefcase className="h-3 w-3 text-primary/60" /> : 
                                              <Package className="h-3 w-3 text-emerald-600/60" />
                                            }
                                            <span className="truncate">{item.name}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right text-[10px] font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</TableCell>
                                        <TableCell className="text-center text-xs font-bold">{item.qty}</TableCell>
                                        <TableCell className="text-right text-xs font-bold font-mono text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.qty)}</TableCell>
                                      </TableRow>
                                    ))}
                                    {(!formData.items || formData.items.length === 0) && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="h-20 text-center text-muted-foreground italic text-xs">
                                          Nenhum item para conferir.
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className="p-4 bg-muted/10 rounded-xl border border-dashed border-primary/20">
                                <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                  * Esta é a lista final de itens que constará no documento PDF. Certifique-se de que todas as quantidades e descrições estão corretas antes de finalizar.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-4">
                            <Button type="button" variant="outline" onClick={() => setActiveTab('items')} className="px-6">
                              <ChevronLeft className="mr-2 h-4 w-4" /> Voltar para Itens
                            </Button>
                            {!isDetailView && (
                              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all px-10 h-11 text-lg font-bold">
                                {loading ? (
                                  <span className="flex items-center gap-2"><Clock className="h-5 w-5 animate-spin" /> Processando...</span>
                                ) : (
                                  <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Finalizar & Emitir</span>
                                )}
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="bg-muted/50 p-4 shrink-0 border-t flex flex-wrap justify-center sm:justify-between items-center gap-4">
                    <div className="flex gap-2">
                      {editingId && (
                        <div className="flex bg-background rounded-lg border p-1 shadow-sm">
                          <Button variant="ghost" size="sm" type="button" onClick={() => {
                            const quote = quotes.find(q => q.id === editingId);
                            if (quote) shareWhatsApp(quote);
                          }} className="text-emerald-600 hover:bg-emerald-50 h-8 px-3 text-xs flex gap-1.5 items-center">
                            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                          <div className="w-px bg-muted mx-1 self-stretch" />
                          <Button variant="ghost" size="sm" type="button" onClick={() => {
                            const quote = quotes.find(q => q.id === editingId);
                            if (quote) shareEmail(quote);
                          }} className="text-amber-600 hover:bg-amber-50 h-8 px-3 text-xs flex gap-1.5 items-center">
                            <Mail className="h-3.5 w-3.5" /> E-mail
                          </Button>
                          <div className="w-px bg-muted mx-1 self-stretch" />
                          <Button variant="ghost" size="sm" type="button" onClick={() => {
                            const quote = quotes.find(q => q.id === editingId);
                            if (quote) generatePDF(quote);
                          }} className="text-blue-600 hover:bg-blue-50 h-8 px-3 text-xs flex gap-1.5 items-center">
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="h-9 px-4 text-xs font-semibold uppercase tracking-tighter">
                        {isDetailView ? "Fechar" : "Sair sem Salvar"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
