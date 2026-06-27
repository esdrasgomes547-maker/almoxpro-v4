import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X, Trash2 } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";

export function Suppliers() {
  const { orgId } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: "", category: "Conexões", phone: "", email: "", whatsapp: "", produtos: "" });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/suppliers`));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSuppliers(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/suppliers`);
    });
    return () => unsub();
  }, [orgId]);

  const filteredData = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return suppliers.filter(item => 
      item.name.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);


  const handleSaveSupplier = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;
    try {
      const supplierData = {
        ...newSupplierForm,
        whatsapp: newSupplierForm.whatsapp ?? "",
        produtos: newSupplierForm.produtos
          ? newSupplierForm.produtos.split(",").map((s: string) => s.trim().toUpperCase())
          : [],
      };

      if (editingId) {
        // We preserve rating and status using updateDoc
        await updateDoc(doc(db, `organizations/${orgId}/suppliers`, editingId), supplierData);
      } else {
        const newId = `FOR-${String(Math.floor(Math.random() * 1000) + 100).padStart(3, '0')}`;
        const newSupplier = {
          ...supplierData,
          rating: 0,
          status: "REVIEW_NEEDED",
        };
        await setDoc(doc(db, `organizations/${orgId}/suppliers`, newId), newSupplier);
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setNewSupplierForm({ name: "", category: "Conexões", phone: "", email: "", whatsapp: "", produtos: "" });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/suppliers/${editingId || 'new'}`);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setSupplierToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if(!orgId || !supplierToDelete) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/suppliers`, supplierToDelete.id));
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/suppliers/${supplierToDelete.id}`);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie seus contatos e avaliações de fornecedores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fornecedor
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
        <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
        <input 
          type="text" 
          placeholder="Buscar por nome ou categoria..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredData.map((item) => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{item.name}</CardTitle>
              <Badge variant="secondary" className="w-fit">{item.category}</Badge>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                <p>Telefone: {item.phone || 'Não informado'}</p>
                <p>Email: {item.email || 'Não informado'}</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {item.phone && (
                  <a 
                    href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (localStorage.getItem('isDemoMode') === 'true') {
                        e.preventDefault();
                        (window as any).triggerDemoBlock?.();
                      }
                    }}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] h-9 px-3 flex-1"
                    )}
                  >
                    WhatsApp
                  </a>
                )}
                {item.email && (
                  <a 
                    href={`mailto:${item.email}`}
                    onClick={(e) => {
                      if (localStorage.getItem('isDemoMode') === 'true') {
                        e.preventDefault();
                        (window as any).triggerDemoBlock?.();
                      }
                    }}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] h-9 px-3 flex-1"
                    )}
                  >
                    Email
                  </a>
                )}
                <Button variant="ghost" size="sm" className="text-destructive h-9 w-9 p-0" onClick={() => handleDelete(item.id, item.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full h-24 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <CardTitle className="text-xl">Novo Fornecedor</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  placeholder="Ex: Empresa xyz S/A"
                  value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  value={newSupplierForm.category}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, category: e.target.value})}
                >
                  <option>Conexões</option>
                  <option>Tubulações</option>
                  <option>Equipamentos</option>
                  <option>Ferramentas</option>
                  <option>EPI</option>
                  <option>Outros</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone/WhatsApp</label>
                  <input 
                    type="tel" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="(00) 0000-0000"
                    value={newSupplierForm.phone}
                    onChange={(e) => setNewSupplierForm({...newSupplierForm, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input 
                    type="email" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="email@empresa.com"
                    value={newSupplierForm.email}
                    onChange={(e) => setNewSupplierForm({...newSupplierForm, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  placeholder="5591999998888 — com DDD, sem espaços"
                  value={newSupplierForm.whatsapp}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, whatsapp: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Produtos fornecidos</label>
                <textarea 
                  className="w-full h-20 px-3 py-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all resize-none"
                  placeholder="GLP-3446, ITEM-00472, GLP-0978 — SKUs separados por vírgula"
                  value={newSupplierForm.produtos}
                  onChange={(e) => setNewSupplierForm({...newSupplierForm, produtos: e.target.value})}
                />
              </div>
              <div className="pt-4 flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveSupplier} disabled={!newSupplierForm.name}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && supplierToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
            <CardTitle>Confirmar Exclusão</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Tem certeza que deseja apagar o fornecedor <strong>{supplierToDelete.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete}>Apagar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
