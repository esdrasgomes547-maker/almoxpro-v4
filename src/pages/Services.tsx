import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Briefcase,
  Layers,
  DollarSign,
  Info
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { Service } from "../types";
import { toast } from 'sonner';

export function Services() {
  const { orgId } = useOrganization();
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Instalação",
    basePrice: 0,
    unit: "unid"
  });

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/services`), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      setServices(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/services`));
    return () => unsub();
  }, [orgId]);

  const filteredServices = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();
    return services.filter(service => 
      service.name.toLowerCase().includes(lowerTerm) || 
      service.description.toLowerCase().includes(lowerTerm) ||
      service.category.toLowerCase().includes(lowerTerm)
    );
  }, [services, searchTerm]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      category: "Instalação",
      basePrice: 0,
      unit: "unid"
    });
    setIsModalOpen(true);
  };

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      basePrice: service.basePrice,
      unit: service.unit
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/services`, id));
      toast.success("Serviço excluído com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/services/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;

    setLoading(true);
    try {
      const serviceData = {
        ...formData,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, `organizations/${orgId}/services`, editingId), serviceData);
        toast.success("Serviço atualizado!");
      } else {
        const newId = `SRV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        await setDoc(doc(db, `organizations/${orgId}/services`, newId), serviceData);
        toast.success("Serviço cadastrado!");
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/services`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Serviços</h1>
          <p className="text-muted-foreground text-sm">Gerencie os serviços prestados pela sua empresa.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenAddModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" /> Total de Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-700">
              <DollarSign className="h-4 w-4" /> Média de Preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                services.reduce((acc, s) => acc + s.basePrice, 0) / (services.length || 1)
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Layers className="h-4 w-4" /> Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {new Set(services.map(s => s.category)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar serviços..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Preço Base</TableHead>
                <TableHead className="text-center w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service) => (
                <TableRow key={service.id} className="group">
                  <TableCell>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{service.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{service.category}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{service.unit}</TableCell>
                  <TableCell className="text-right font-mono font-medium text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.basePrice)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} className="h-8 w-8 hover:bg-muted">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredServices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum serviço encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                {editingId ? "Editar Serviço" : "Novo Serviço"}
              </CardTitle>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Serviço</label>
                  <input 
                    className="w-full h-10 px-3 rounded-md border border-input text-foreground bg-background"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Instalação de Tubulação"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Instalação">Instalação</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Consultoria">Consultoria</option>
                    <option value="Vistoria">Vistoria</option>
                    <option value="Reparo">Reparo</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preço Base (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="w-full h-10 px-3 rounded-md border border-input font-mono text-foreground bg-background"
                      value={formData.basePrice || ""}
                      onChange={e => setFormData({...formData, basePrice: Number(e.target.value)})}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unidade</label>
                    <input 
                      className="w-full h-10 px-3 rounded-md border border-input text-foreground bg-background"
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      placeholder="unid, hora, m2..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <textarea 
                    className="w-full px-3 py-2 rounded-md border border-input text-foreground bg-background"
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Descreva detalhadamente o serviço..."
                  />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> Essas informações serão usadas para preencher orçamentos automaticamente.
                  </p>
                </div>
              </CardContent>
              <div className="p-4 border-t bg-muted/30 flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : (editingId ? "Atualizar" : "Cadastrar")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
