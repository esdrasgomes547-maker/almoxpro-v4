import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Upload, 
  Search, 
  Phone, 
  Mail, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  X, 
  CheckCircle2,
  Loader2,
  Package,
  TrendingUp,
  Target,
  UserPlus,
  ArrowRight,
  LayoutGrid,
  List as ListIcon
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, orderBy, writeBatch } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { Lead } from "../types";
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from "motion/react";

export function Leads() {
  const { orgId } = useOrganization();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    status: "NEW" as Lead['status'],
    notes: ""
  });

  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [newlyImportedLeads, setNewlyImportedLeads] = useState<Lead[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Activity logging
  const logActivity = async (action: string, entity: string, message: string, type: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE') => {
    if (!orgId) return;
    try {
      const user = auth.currentUser;
      const logRef = doc(collection(db, `organizations/${orgId}/activity_log`));
      await setDoc(logRef, {
        action,
        entity,
        message,
        type,
        date: new Date().toISOString(),
        userId: user?.uid || "system",
        userName: user?.displayName || user?.email?.split('@')[0] || "Sistema",
        userEmail: user?.email || "system"
      });
    } catch (e) {
      console.error("Failed to log activity:", e);
    }
  };

  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, `organizations/${orgId}/leads`),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
    }, err => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/leads`));

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400); // 400ms debounce to prevent excessive updates/renders
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter(l => l.status === 'NEW').length;
    const contatados = leads.filter(l => l.status === 'CONTACTED').length;
    const qualificados = leads.filter(l => l.status === 'QUALIFIED').length;
    const conversionRate = total > 0 ? ((qualificados / total) * 100).toFixed(1) : 0;

    return { total, novos, contatados, qualificados, conversionRate };
  }, [leads]);

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !formData.name || !formData.phone) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, `organizations/${orgId}/leads`, editingId), {
          ...formData
        });
        logActivity('lead_update', 'Leads', `Lead "${formData.name}" atualizado`, 'UPDATE');
        toast.success("Lead atualizado com sucesso");
      } else {
        const newId = `LEAD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const newLead: Lead = {
          id: newId,
          ...formData,
          source: 'MANUAL',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, `organizations/${orgId}/leads`, newId), newLead);
        logActivity('lead_add', 'Leads', `Novo lead "${formData.name}" adicionado manualmente`, 'CREATE');
        toast.success("Lead adicionado com sucesso");
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", status: "NEW", notes: "" });
    } catch (e) {
      toast.error("Erro ao salvar lead");
    }
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;
    if (!confirm(`Tem certeza que deseja excluir o lead ${name}?`)) return;

    try {
      await deleteDoc(doc(db, `organizations/${orgId}/leads`, id));
      logActivity('lead_delete', 'Leads', `Lead "${name}" excluído`, 'DELETE');
      toast.success("Lead excluído");
    } catch (e) {
      toast.error("Erro ao excluir lead");
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingId(lead.id);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      notes: lead.notes || ""
    });
    setIsAddModalOpen(true);
  };

  // CSV Import handling
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: async (results) => {
        const data = results.data;
        if (data.length === 0) {
          toast.error("Arquivo vázio");
          return;
        }

        setImportPreview(data);
        setIsMappingModalOpen(true);
        setIsProcessingAI(true);
        
        try {
          const { chamarGeminiBackend } = await import("../lib/llmRouter");
          const responseText = await chamarGeminiBackend({
            mensagens: [{
               role: "user",
               text: `As colunas são: ${JSON.stringify(Object.keys(data[0]))}\nDado de exemplo: ${JSON.stringify(data[0])}\nMapeie as chaves 'name', 'email', 'phone' e 'notes' para as respectivas colunas. Retorne um JSON válido.`
            }]
          });
          
          let mapping = {};
          if (responseText) {
             mapping = JSON.parse(responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim());
          }
          const leadMapping = {
            name: (mapping as any).name || "",
            email: (mapping as any).email || "",
            phone: (mapping as any).phone || "",
            notes: (mapping as any).notes || ""
          };
          setColumnMapping(leadMapping);
        } catch (error) {
          console.warn("AI Mapping fallback triggered.");
          const headers = Object.keys(data[0]);
          const fallback: any = {};
          headers.forEach(h => {
            const lower = h.toLowerCase();
            if (lower.includes('nome') || lower.includes('name') || lower.includes('cliente')) fallback.name = h;
            if (lower.includes('email') || lower.includes('mail') || lower.includes('correio')) fallback.email = h;
            if (lower.includes('tel') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('celular') || lower.includes('fone')) fallback.phone = h;
            if (lower.includes('obs') || lower.includes('note') || lower.includes('desc') || lower.includes('info')) fallback.notes = h;
          });
          setColumnMapping(fallback);
        } finally {
          setIsProcessingAI(false);
        }
      },
      error: (err) => {
        toast.error("Erro ao processar arquivo CSV");
        console.error(err);
      }
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const handleConfirmMapping = () => {
    setIsMappingModalOpen(false);
    setIsImportModalOpen(true);
  };

  const handleProcessImport = async () => {
    if (!orgId || importPreview.length === 0) return;

    const loadingToast = toast.loading(`Importando ${importPreview.length} leads...`);
    let successCount = 0;
    const allImported: Lead[] = [];
    
    try {
      const chunks = [];
      for (let i = 0; i < importPreview.length; i += 500) {
        chunks.push(importPreview.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const item of chunk) {
          const name = (item[columnMapping.name] || item.name || item.Nome || item.nome || item.full_name || "").toString().trim();
          const email = (item[columnMapping.email] || item.email || item.Email || item['e-mail'] || "").toString().trim();
          const phone = (item[columnMapping.phone] || item.phone || item.Phone || item.Telefone || item.telefone || item.whatsapp || "").toString().trim();

          if (name && phone) {
            const newId = `LEAD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const leadRef = doc(db, `organizations/${orgId}/leads`, newId);
            const newLead: Lead = {
              id: newId,
              name, email, phone,
              source: 'IMPORT',
              status: 'NEW',
              createdAt: new Date().toISOString(),
              notes: String(item[columnMapping.notes] || item.notes || "").trim()
            };
            batch.set(leadRef, newLead);
            allImported.push(newLead);
            successCount++;
          }
        }
        await batch.commit();
      }
      
      if (successCount > 0) {
        logActivity('lead_import', 'Leads', `Importação massiva realizada: ${successCount} leads adicionados`, 'CREATE');
      }
      
      toast.dismiss(loadingToast);
      toast.success(`${successCount} leads importados com sucesso!`);
      setIsImportModalOpen(false);
      setImportPreview([]);
      setNewlyImportedLeads(allImported);
      setIsReviewOpen(true);
    } catch (e) {
      toast.dismiss(loadingToast);
      toast.error("Erro durante a importação");
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                          l.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                          l.phone.includes(debouncedSearchTerm);
    const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'NEW': return <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Novo</Badge>;
      case 'CONTACTED': return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">Em Contato</Badge>;
      case 'QUALIFIED': return <Badge variant="default" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Qualificado</Badge>;
      case 'LOST': return <Badge variant="destructive">Perdido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${name}, tudo bem? Sou da AlmoxPro e gostaríamos de bater um papo sobre seu interesse.`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const openEmail = (email: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (email) window.location.href = `mailto:${email}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">CRM & Leads</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Gerencie o seu funil de vendas e oportunidades estrategicamente.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" {...getRootProps()} className={cn(
            "cursor-pointer",
            isDragActive && "border-primary bg-primary/5"
          )}>
            <input {...getInputProps()} />
            <Upload className="h-4 w-4 mr-2" />
            Importar Base
          </Button>
          <Button size="sm" onClick={() => {
            setEditingId(null);
            setFormData({ name: "", email: "", phone: "", status: "NEW", notes: "" });
            setIsAddModalOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Prospecção
          </Button>
        </div>
      </div>

      {/* Tabs Layout - Standardized */}
      <div className="flex border-b border-border">
        <Link 
          to="/app/inventory"
          className="px-6 py-2 border-b-2 border-transparent hover:border-border font-medium text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-all"
        >
          <Package className="h-4 w-4" />
          Estoque
        </Link>
        <button className="px-6 py-2 border-b-2 border-primary font-bold text-sm text-primary flex items-center gap-2 transition-all">
          <MessageSquare className="h-4 w-4" />
          Leads (CRM)
        </button>
      </div>

      {/* Stats Cards - Standardized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contatos", value: stats.total, icon: Users },
          { label: "Novas Prospecções", value: stats.novos, icon: UserPlus },
          { label: "Em Negociação", value: stats.contatados, icon: TrendingUp },
          { label: "Taxa Conversão", value: `${stats.conversionRate}%`, icon: Target }
        ].map((stat, i) => (
          <Card key={i} className="shadow-none border-border/40 bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
                <h3 className="text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Control Bar - Standardized */}
      <Card className="shadow-none border-none bg-muted/20">
        <CardHeader className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 items-start sm:items-center gap-2 sm:gap-4 w-full">
            <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
              <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar leads por nome ou celular..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            >
              <option value="ALL">Status: TODOS</option>
              <option value="NEW">Status: NOVOS</option>
              <option value="CONTACTED">Status: EM CONTATO</option>
              <option value="QUALIFIED">Status: QUALIFICADOS</option>
              <option value="LOST">Status: PERDIDOS</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-background p-1 rounded-md border border-border shrink-0 shadow-sm">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn("h-7 w-7 transition-all", viewMode === 'grid' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn("h-7 w-7 transition-all", viewMode === 'list' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 mt-4 overflow-x-auto min-h-[300px]">
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border/40">
                    <TableRow>
                      <TableHead className="px-5 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Prospecção</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="hidden md:table-cell font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Contato Direto</TableHead>
                      <TableHead className="hidden lg:table-cell text-center font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Entrada</TableHead>
                      <TableHead className="text-right px-5 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Global</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow 
                        key={lead.id} 
                        onClick={() => setSelectedLead(lead)} 
                        className="cursor-pointer transition-colors group"
                      >
                        <TableCell className="px-5 py-4">
                          <div className="font-bold text-foreground text-base tracking-tight group-hover:text-primary transition-colors">{lead.name}</div>
                          <div className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest">{lead.id}</div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(lead.status)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col">
                            <span className="text-foreground font-bold font-mono text-xs">{lead.phone}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px] uppercase font-medium">{lead.email || 'Sem email'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center text-muted-foreground font-mono text-xs">
                          {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right px-5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openWhatsApp(lead.phone, lead.name)} className="h-8 w-8 hover:bg-secondary/10 hover:text-secondary" title="WhatsApp">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(lead)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteLead(lead.id, lead.name)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            ) : (
              <motion.div 
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
              >
                {filteredLeads.map((lead, idx) => (
                  <LeadCard 
                    key={lead.id} 
                    lead={lead} 
                    idx={idx}
                    onEdit={handleEditClick} 
                    onDelete={handleDeleteLead}
                    onWhatsApp={openWhatsApp}
                    onSelect={() => setSelectedLead(lead)}
                    statusBadge={getStatusBadge(lead.status)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredLeads.length === 0 && (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-card/20 rounded-2xl border border-dashed border-border/80">
          <div className="p-4 bg-primary/5 rounded-full mb-6">
            <Users className="h-12 w-12 text-primary/30" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">Nenhuma prospecção ativa</h3>
          <p className="text-muted-foreground max-w-xs mb-8 text-sm">
            Sua base de CRM estratégica da AlmoxPro está vazia. Comece a cadastrar novas oportunidades comerciais.
          </p>
          <Button onClick={() => setIsAddModalOpen(true)} className="px-10 h-11 shadow-2xl shadow-primary/30 font-bold uppercase tracking-widest text-[10px] rounded-xl">
            Criar Primeiro Contato
          </Button>
        </div>
      )}

      {/* Footer Navigation - Standardized branding */}
      <div className="flex justify-center pt-10">
        <Link 
          to="/app/inventory"
          className="group flex items-center gap-4 px-8 py-5 bg-[hsl(var(--card))] border border-border shadow-md hover:shadow-xl rounded-2xl transition-all hover:-translate-y-1 transform-gpu"
        >
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Package className="h-6 w-6" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 leading-none mb-2">RETORNAR AO MÓDULO</p>
            <p className="font-bold text-xl leading-none text-[hsl(var(--foreground))] group-hover:text-primary transition-colors">Gestão Industrial</p>
          </div>
          <ArrowRight className="h-5 w-5 ml-6 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Modals & Detail Sheet */}
      <AnimatePresence>
        {isAddModalOpen && (
          <LeadFormModal 
            editing={!!editingId} 
            formData={formData} 
            setFormData={setFormData}
            onClose={() => setIsAddModalOpen(false)} 
            onSubmit={handleSaveLead} 
          />
        )}
        
        {isMappingModalOpen && (
          <MappingModal 
            isProcessing={isProcessingAI}
            mapping={columnMapping}
            setMapping={setColumnMapping}
            onClose={() => setIsMappingModalOpen(false)}
            onConfirm={handleConfirmMapping}
            preview={importPreview}
          />
        )}

        {isImportModalOpen && (
          <ImportPreviewModal 
            preview={importPreview}
            mapping={columnMapping}
            onClose={() => setIsImportModalOpen(false)}
            onConfirm={handleProcessImport}
          />
        )}

        {isReviewOpen && (
          <ImportReviewModal 
            leads={newlyImportedLeads} 
            onClose={() => { setIsReviewOpen(false); setNewlyImportedLeads([]); }}
          />
        )}

        {selectedLead && (
          <LeadDetailSheet 
            lead={selectedLead} 
            onClose={() => setSelectedLead(null)}
            onEdit={handleEditClick}
            onWhatsApp={openWhatsApp}
            onEmail={openEmail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadCard({ lead, idx, onEdit, onDelete, onWhatsApp, onSelect, statusBadge }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      onClick={onSelect}
      className="group bg-card p-5 rounded-2xl border border-border/60 hover:border-primary/50 hover:shadow-2xl transition-all cursor-pointer flex flex-col justify-between h-full min-h-[190px] hover:-translate-y-1.5 transform-gpu"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          {statusBadge}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100" onClick={e => e.stopPropagation()}>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => onEdit(lead)}>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(lead.id, lead.name)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
             </Button>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-foreground text-lg leading-snug line-clamp-2 tracking-tight group-hover:text-primary transition-colors">{lead.name}</h3>
          <p className="text-[10px] font-mono text-muted-foreground uppercase mt-1 tracking-widest opacity-50 underline decoration-primary/20 decoration-2 underline-offset-4">ID: {lead.id.split('-').pop()}</p>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-border/30 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-bold">
          <Phone className="h-3.5 w-3.5 text-secondary" />
          <span className="font-mono">{lead.phone}</span>
        </div>
        <Button 
          variant="secondary"
          size="sm"
          className="w-full text-[9px] font-black uppercase tracking-[0.2em] h-9 shadow-inner bg-secondary/10 hover:bg-secondary hover:text-white transition-all"
          onClick={(e) => { e.stopPropagation(); onWhatsApp(lead.phone, lead.name); }}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-2" />
          Conectar WhatsApp
        </Button>
      </div>
    </motion.div>
  );
}

function LeadFormModal({ editing, formData, setFormData, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-card w-full max-w-lg rounded-3xl shadow-3xl border border-border overflow-hidden"
      >
        <div className="px-7 py-6 border-b flex justify-between items-center bg-muted/20">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">{editing ? 'Editar Ficha Prospecção' : 'Cadastrar Lead Estratégico'}</h2>
            <p className="text-[10px] text-primary/60 uppercase tracking-[0.3em] font-black mt-1">Inteligência CRM - AlmoxPro</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
            <X className="h-6 w-6" />
          </Button>
        </div>
        <form onSubmit={onSubmit} className="p-7 space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none px-1">Nome Completo do Prospecção</label>
              <input 
                required
                placeholder="Ex: Almir Guimarães"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full h-12 px-5 rounded-2xl border border-input bg-muted/10 font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:font-normal placeholder:opacity-40"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none px-1">WhatsApp / Celular</label>
                <input 
                  required
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full h-12 px-5 rounded-2xl border border-input bg-muted/10 font-mono font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:font-normal"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none px-1">Posição no Funil</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as Lead['status']})}
                  className="w-full h-12 px-5 rounded-2xl border border-input bg-muted/10 font-black text-[10px] uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer"
                >
                  <option value="NEW">Prospecção: NOVO</option>
                  <option value="CONTACTED">Prospecção: EM CONTATO</option>
                  <option value="QUALIFIED">Prospecção: QUALIFICADO</option>
                  <option value="LOST">Prospecção: PERDIDO</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none px-1">E-mail Corporativo</label>
              <input 
                type="email"
                placeholder="comercial@tegas.com.br"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full h-12 px-5 rounded-2xl border border-input bg-muted/10 font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:font-normal placeholder:opacity-40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none px-1">Histórico & Briefing Detalhado</label>
              <textarea 
                placeholder="Descreva detalhes da última interação, interesse ou negociação em curso..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full h-32 p-5 rounded-2xl border border-input bg-muted/10 text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none resize-none transition-all"
              />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
             <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-14 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-muted/50">Cancelar</Button>
             <Button type="submit" className="flex-[2] h-14 font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-primary/20 rounded-2xl">Confirmar Atualização</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function LeadDetailSheet({ lead, onClose, onEdit, onWhatsApp, onEmail }: any) {
  return (
    <div 
      className="fixed inset-0 z-[150] flex justify-end bg-background/50 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-card w-full max-w-md h-full shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col p-0 border-l border-border/40"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 border-b flex justify-between items-center bg-muted/5">
          <div>
            <h2 className="text-2xl font-black tracking-tight line-clamp-1 group-hover:text-primary transition-all text-primary">{lead.name}</h2>
            <div className="flex items-center gap-3 mt-2.5">
              <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-[0.3em] bg-primary/10 text-primary border-none py-1 px-3 rounded-full">{lead.status}</Badge>
              <span className="text-[9px] font-mono text-muted-foreground font-black uppercase tracking-widest opacity-40">System_Ref: {lead.id}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-12 w-12 hover:bg-muted">
            <X className="h-7 w-7" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
          <div className="grid grid-cols-1 gap-4">
             <Button 
                onClick={() => onWhatsApp(lead.phone, lead.name)} 
                className="h-16 font-black bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all rounded-3xl shadow-2xl shadow-secondary/40 text-xs uppercase tracking-widest"
              >
                <MessageSquare className="h-6 w-6 mr-4" />
                Conversão via WhatsApp
             </Button>
             <Button 
                variant="outline"
                disabled={!lead.email}
                onClick={() => onEmail(lead.email)} 
                className="h-14 font-black rounded-3xl border-border/80 text-[10px] uppercase tracking-widest"
              >
                <Mail className="h-6 w-6 mr-4" />
                E-mail Corporativo
             </Button>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-3 border-b border-primary/20 pb-3">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Target className="h-4 w-4" /></div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/80">Dados Estratégicos</h4>
             </div>
             <div className="space-y-5 text-sm">
                <div className="flex justify-between items-center group">
                   <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Contato WhatsApp</p>
                   <p className="font-black font-mono text-base text-primary">{lead.phone}</p>
                </div>
                {lead.email && (
                  <div className="flex justify-between items-center group">
                     <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Endereço E-mail</p>
                     <p className="font-bold underline text-secondary cursor-pointer break-all text-right max-w-[200px]" onClick={() => onEmail(lead.email)}>{lead.email}</p>
                  </div>
                )}
                <div className="flex justify-between items-center group">
                   <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Data Cadastro</p>
                   <p className="font-bold text-muted-foreground/80">{new Date(lead.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex justify-between items-center group">
                   <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">Canal de Origem</p>
                   <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary py-0.5">{lead.source}</Badge>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-3 border-b border-primary/20 pb-3">
                <div className="p-1.5 bg-secondary/10 rounded-lg text-secondary"><MessageSquare className="h-4 w-4" /></div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/80">Anotações Comerciais</h4>
             </div>
             <div className="bg-muted/10 p-7 rounded-[2rem] border border-border/30 min-h-[160px] shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <TrendingUp className="h-20 w-20" />
                </div>
                {lead.notes ? (
                  <p className="text-foreground leading-relaxed text-sm font-medium italic relative z-10">"{lead.notes}"</p>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-4 text-center opacity-40 italic">
                    <p className="text-sm font-medium mb-1">Sem histórico de interações</p>
                    <p className="text-[10px] font-black uppercase tracking-widest">Aguardando prospecção inicial</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        <div className="p-8 border-t bg-muted/5 flex gap-4">
           <Button variant="outline" onClick={() => { onClose(); onEdit(lead); }} className="flex-1 h-14 font-black uppercase tracking-widest text-[10px] rounded-2xl">Editar Ficha</Button>
           <Button onClick={onClose} className="flex-1 h-14 font-black uppercase tracking-widest text-[10px] rounded-2xl bg-foreground text-background">Fechar Módulo</Button>
        </div>
      </motion.div>
    </div>
  );
}

function MappingModal({ isProcessing, mapping, setMapping, onClose, onConfirm, preview }: any) {
  const headers = preview.length > 0 ? Object.keys(preview[0]) : [];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/98 backdrop-blur-2xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card w-full max-w-md rounded-[2.5rem] shadow-3xl border border-border/80 overflow-hidden"
      >
        <div className="px-8 py-7 border-b flex justify-between items-center bg-primary/5">
          <h2 className="text-xl font-black flex items-center gap-4 tracking-tighter uppercase">
            <div className="p-2.5 bg-primary/20 rounded-2xl text-primary shadow-lg shadow-primary/10"><Upload className="h-6 w-6" /></div>
            Inteligência de Dados
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-11 w-11"><X className="h-6 w-6" /></Button>
        </div>
        
        <div className="p-8 space-y-8">
          <div className={cn(
            "p-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center border",
            isProcessing ? "bg-primary/10 text-primary border-primary/20 animate-pulse" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-md"
          )}>
            {isProcessing ? (
              <div className="flex items-center justify-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI AlmoxPro Sincronizando Cabeçalhos...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <span>Mapeamento Sugerido com Sucesso</span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {[
              { field: 'name', label: 'Nome da Prospecção' },
              { field: 'phone', label: 'Celular de Contato' },
              { field: 'email', label: 'E-mail Corporativo' },
              { field: 'notes', label: 'Briefing / Interesse' },
            ].map(item => (
              <div key={item.field} className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] leading-none px-2">{item.label}</label>
                <select 
                  value={mapping[item.field] || ""}
                  onChange={e => setMapping({...mapping, [item.field]: e.target.value})}
                  className="w-full h-14 px-5 rounded-[1.25rem] border border-input bg-muted/20 font-black text-[11px] uppercase tracking-widest focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer shadow-inner appearance-none"
                >
                  <option value="">(Ignorar Coluna)</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <Button 
            onClick={onConfirm}
            className="w-full h-16 font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-primary/30 group rounded-2xl transition-all hover:scale-[1.02]"
          >
            Validar Registros
            <ArrowRight className="h-5 w-5 ml-4 group-hover:translate-x-2 transition-transform" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ImportPreviewModal({ preview, mapping, onClose, onConfirm }: any) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/95 backdrop-blur-2xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card w-full max-w-3xl rounded-[2.5rem] shadow-3xl border border-border/80 overflow-hidden"
      >
        <div className="px-10 py-7 border-b flex justify-between items-center bg-muted/10">
          <div>
            <h2 className="text-2xl font-black tracking-tighter uppercase">Análise Prévia da Base ({preview.length})</h2>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest opacity-60">Verifique a integridade dos dados antes da importação massiva.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-12 w-12"><X className="h-7 w-7" /></Button>
        </div>

        <div className="overflow-y-auto max-h-[380px] custom-scrollbar bg-muted/5">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-20 border-b">
              <TableRow>
                <TableHead className="px-8 py-5 font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground whitespace-nowrap">Nome Prospecção</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground whitespace-nowrap">WhatsApp/Phone</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground whitespace-nowrap">E-mail Corporativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.slice(0, 15).map((row: any, i: number) => (
                <TableRow key={i} className="hover:bg-primary/5 transition-colors border-border/30">
                  <td className="px-8 py-5 font-black text-foreground text-sm tracking-tight">{row[mapping.name] || <span className="opacity-20 italic">vázio</span>}</td>
                  <td className="py-5 font-mono font-bold text-primary text-xs tracking-wider">{row[mapping.phone] || <span className="opacity-20 italic">vázio</span>}</td>
                  <td className="py-5 text-muted-foreground text-[11px] font-bold lowercase opacity-70 italic">{row[mapping.email] || "-"}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview.length > 15 && (
            <div className="p-6 text-center text-primary font-black text-[10px] uppercase tracking-[0.4em] border-t bg-primary/5 border-primary/20">
              + {preview.length - 15} REGISTROS ADICIONAIS IDENTIFICADOS NA PLANILHA
            </div>
          )}
        </div>

        <div className="p-8 border-t flex gap-5 bg-muted/10">
           <Button variant="outline" onClick={onClose} className="flex-1 h-16 font-black uppercase tracking-[0.3em] text-[10px] rounded-2xl shadow-sm">Refazer Mapeamento</Button>
           <Button 
            onClick={onConfirm}
            className="flex-[2.5] h-16 font-black uppercase tracking-[0.3em] text-[10px] shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] rounded-2xl"
          >
            Sincronizar CRM Agora
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ImportReviewModal({ leads, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/98 backdrop-blur-3xl">
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0.3 }}
        className="bg-card w-full max-w-xl rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] border border-border/50 overflow-hidden"
      >
        <div className="p-12 text-center bg-secondary/5 border-b border-border/20 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/10 to-transparent pointer-events-none" />
          <motion.div 
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-28 h-28 bg-secondary text-secondary-foreground rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-3xl shadow-secondary/40 relative z-10"
          >
            <CheckCircle2 className="h-14 w-14" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-5xl font-black tracking-tighter text-foreground leading-[0.85] mb-6 relative z-10"
          >
            DATABASE<br />SINCRO
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground font-black text-xl leading-snug relative z-10 uppercase tracking-tight"
          >
            Base estratégica atualizada com<br /><span className="text-secondary">+{leads.length} OPORTUNIDADES</span>.
          </motion.p>
        </div>
        
        <div className="p-12">
           <div className="bg-muted/40 p-10 rounded-[2.5rem] border border-border/40 mb-12 space-y-8 relative overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] flex items-center justify-center gap-4 opacity-50">
                <div className="w-8 h-px bg-muted-foreground/30" /> Ação Imediata <div className="w-8 h-px bg-muted-foreground/30" />
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-5 group cursor-pointer" onClick={onClose}>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-lg">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Segmentação</p>
                    <p className="text-sm font-bold text-foreground">Filtrar novos leads importados</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 group cursor-pointer" onClick={onClose}>
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-all shadow-lg">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1.5">Prospecção</p>
                    <p className="text-sm font-bold text-foreground">Iniciar cadência de WhatsApp</p>
                  </div>
                </div>
              </div>
           </div>

           <Button 
            onClick={onClose}
            className="w-full h-20 rounded-[2rem] font-black uppercase tracking-[0.4em] text-xs shadow-2xl shadow-primary/20 hover:scale-[0.98] transition-all bg-foreground text-background"
           >
            Acessar Funil de Vendas
           </Button>
        </div>
      </motion.div>
    </div>
  );
}
