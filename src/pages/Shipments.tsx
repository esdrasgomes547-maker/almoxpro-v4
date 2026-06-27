import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, PackageCheck, Send, CheckCircle2, Clock, X, Trash2, Edit2, Mail, Phone, Truck } from "lucide-react";
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, updateDoc } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateShipmentsReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";
import { ShipmentItem, Vehicle } from "../types";
import { toast } from "sonner";

export function Shipments() {
  const { orgId } = useOrganization();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  
  const [newShipmentForm, setNewShipmentForm] = useState({ destination: "", items: 1, driver: "", vehicle: "", status: "PENDING" as ShipmentItem["status"] });
  const [vehicleForm, setVehicleForm] = useState({ model: "", plate: "", type: "Caminhão", status: "ACTIVE" as Vehicle["status"] });

  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    let q = query(
      collection(db, `organizations/${orgId}/shipments`), 
      orderBy("date", "desc")
    );
    
    if (debouncedSearchTerm) {
      q = query(q, limit(1000));
    } else {
      q = query(q, limit(20));
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShipmentItem));
      setShipments(items);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/shipments`);
      setLoading(false);
    });

    const vQ = query(collection(db, `organizations/${orgId}/vehicles`), orderBy("createdAt", "desc"));
    const unsubVehicles = onSnapshot(vQ, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    return () => {
      unsub();
      unsubVehicles();
    };
  }, [orgId, debouncedSearchTerm]);

  const loadMore = async () => {
    if (!orgId || !lastVisible) return;
    setLoading(true);
    const nextQ = query(
      collection(db, `organizations/${orgId}/shipments`),
      orderBy("date", "desc"),
      startAfter(lastVisible),
      limit(20)
    );
    const snap = await getDocs(nextQ);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ShipmentItem));
    setShipments(prev => [...prev, ...items]);
    setLastVisible(snap.docs[snap.docs.length - 1] || null);
    setLoading(false);
  };

  const filteredData = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return shipments.filter(item => 
      item.destination.toLowerCase().includes(term) || 
      item.id.toLowerCase().includes(term)
    );
  }, [shipments, searchTerm]);

  const { entregasHoje, emPreparacao } = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return {
      entregasHoje: shipments.filter(s => s.status === 'DELIVERED' && s.date === todayStr).length,
      emPreparacao: shipments.filter(s => s.status === 'PREPARING').length
    };
  }, [shipments]);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNewShipmentForm({
      destination: item.destination,
      items: item.items,
      driver: item.driver || "",
      vehicle: item.vehicle || "",
      status: item.status || "PENDING"
    });
    setIsAddModalOpen(true);
  };

  const handleSaveShipment = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;
    const newShipment = {
      ...newShipmentForm,
      date: new Date().toISOString().split('T')[0],
    };
    
    try {
      if (editingId) {
        const existing = shipments.find(s => s.id === editingId);
        await updateDoc(doc(db, `organizations/${orgId}/shipments`, editingId), { ...newShipment, date: existing?.date || newShipment.date });
        logActivity('shipment_update', 'Expedições', `Expedição para ${newShipment.destination} atualizada para ${newShipment.status}`, 'UPDATE');
        toast.success("Expedição atualizada!");
      } else {
        const newId = `EXP-${String(Math.floor(Math.random() * 10000) + 23400)}`;
        await setDoc(doc(db, `organizations/${orgId}/shipments`, newId), newShipment);
        logActivity('shipment_add', 'Expedições', `Nova expedição criada para ${newShipment.destination}`, 'CREATE');
        toast.success("Expedição criada!");
      }
      setIsAddModalOpen(false);
      setEditingId(null);
      setNewShipmentForm({ destination: "", items: 1, driver: "", vehicle: "", status: "PENDING" });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/shipments`);
    }
  };

  const handleSaveVehicle = async () => {
    if (!orgId) return;
    try {
      const data = { ...vehicleForm, createdAt: new Date().toISOString() };
      if (editingVehicleId) {
        await updateDoc(doc(db, `organizations/${orgId}/vehicles`, editingVehicleId), data);
        logActivity('vehicle_update', 'Frota', `Veículo ${data.plate} atualizado`, 'UPDATE');
        toast.success("Veículo atualizado!");
      } else {
        const newId = `VEH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        await setDoc(doc(db, `organizations/${orgId}/vehicles`, newId), data);
        logActivity('vehicle_add', 'Frota', `Novo veículo ${data.plate} (${data.model}) cadastrado`, 'CREATE');
        toast.success("Veículo cadastrado!");
      }
      setIsVehicleModalOpen(false);
      setEditingVehicleId(null);
      setVehicleForm({ model: "", plate: "", type: "Caminhão", status: "ACTIVE" });
    } catch (error) {
      handleFirestoreError(error, editingVehicleId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/vehicles`);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!orgId || !confirm("Deseja excluir este veículo?")) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/vehicles`, id));
      toast.success("Veículo removido!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/vehicles`);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      model: vehicle.model,
      plate: vehicle.plate,
      type: vehicle.type,
      status: vehicle.status
    });
    setIsVehicleModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if(!orgId) return;
    if(window.confirm("Deseja apagar esta expedição?")) {
      try {
        await deleteDoc(doc(db, `organizations/${orgId}/shipments`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/shipments/${id}`);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'DELIVERED': return <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Entregue</Badge>;
      case 'SHIPPED': return <Badge variant="default" className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600"><Send className="h-3 w-3" /> Em Trânsito</Badge>;
      case 'PREPARING': return <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10"><PackageCheck className="h-3 w-3" /> Separando</Badge>;
      case 'PENDING': return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expedição</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Gerencie as saídas e entregas de materiais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (localStorage.getItem('isDemoMode') === 'true') {
              (window as any).triggerDemoBlock?.();
              return;
            }
            const email = prompt("Digite o e-mail para envio do relatório:", "contato@almoxpro.com.br");
            if (email) {
              const report = generateShipmentsReport(shipments);
              sendEmailReport(email, "Relatório de Expedições - AlmoxPro", report);
            }
          }}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => {
            if (localStorage.getItem('isDemoMode') === 'true') {
              (window as any).triggerDemoBlock?.();
              return;
            }
            const report = generateShipmentsReport(shipments);
            sendWhatsAppNotification("", report);
          }}>
            <Phone className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/app/fleet")}>
            <Truck className="h-4 w-4 mr-2" />
            Frota
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Expedição
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
            <Send className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entregasHoje}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Preparação</CardTitle>
            <PackageCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emPreparacao}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-1 items-center space-x-2 w-full max-w-sm relative">
            <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text" 
              placeholder="Buscar por ID ou destino..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
            />
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex shrink-0">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </CardHeader>
        <CardContent className="p-0 mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Expedição</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="hidden lg:table-cell">Motorista / Veículo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium text-xs">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.destination}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-[hsl(var(--muted-foreground))]">{new Date(item.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-center font-mono">{item.items}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-sm">{item.driver}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.vehicle}</div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end space-x-1">
                    <Button variant="ghost" size="sm" className="h-8 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]" onClick={() => handleEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Nenhuma expedição encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {lastVisible && !debouncedSearchTerm && (
            <div className="p-4 text-center">
              <Button onClick={loadMore} disabled={loading} variant="outline">
                {loading ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Shipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <CardTitle className="text-xl">{editingId ? 'Editar Expedição' : 'Nova Expedição'}</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setIsAddModalOpen(false)}>
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">Destino</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                  placeholder="Ex: Filial Sul - Curitiba"
                  value={newShipmentForm.destination}
                  onChange={(e) => setNewShipmentForm({...newShipmentForm, destination: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motorista</label>
                  <input 
                    type="text" 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    placeholder="Ex: João Souza"
                    value={newShipmentForm.driver}
                    onChange={(e) => setNewShipmentForm({...newShipmentForm, driver: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Veículo</label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                    value={newShipmentForm.vehicle}
                    onChange={(e) => setNewShipmentForm({...newShipmentForm, vehicle: e.target.value})}
                  >
                    <option value="">Selecione um veículo da frota...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={`${v.model} (${v.plate})`}>{v.model} - {v.plate}</option>
                    ))}
                    <option value="OUTRO">Outro (digitar abaixo)</option>
                  </select>
                  {newShipmentForm.vehicle === "OUTRO" && (
                    <input 
                      type="text" 
                      className="w-full h-10 px-3 mt-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all"
                      placeholder="Identificação do veículo"
                      onChange={(e) => setNewShipmentForm({...newShipmentForm, vehicle: e.target.value})}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade de Itens</label>
                <input 
                  type="text" 
                  className="w-full h-10 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all font-mono"
                  value={newShipmentForm.items || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewShipmentForm({...newShipmentForm, items: val === "" ? 0 : Number(val)});
                  }}
                  placeholder="0"
                />
              </div>
              <div className="pt-4 flex items-center justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveShipment} disabled={!newShipmentForm.destination}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vehicle Fleet Modal */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> Gerenciar Frota
              </CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))]" onClick={() => setIsVehicleModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto space-y-6">
              {/* Add/Edit Vehicle Form */}
              <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-primary/20 space-y-4">
                <h3 className="font-bold text-sm">{editingVehicleId ? "Editar Veículo" : "Cadastrar Novo Veículo"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Modelo</label>
                    <input 
                      className="w-full h-9 px-3 rounded-md border border-input text-sm"
                      value={vehicleForm.model}
                      onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})}
                      placeholder="Ex: Fiat Fiorino"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Placa</label>
                    <input 
                      className="w-full h-9 px-3 rounded-md border border-input text-sm"
                      value={vehicleForm.plate}
                      onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value})}
                      placeholder="Ex: ABC-1234"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Tipo</label>
                    <select 
                      className="w-full h-9 px-3 rounded-md border border-input text-sm bg-background"
                      value={vehicleForm.type}
                      onChange={e => setVehicleForm({...vehicleForm, type: e.target.value})}
                    >
                      <option value="Caminhão">Caminhão</option>
                      <option value="Furgão">Furgão</option>
                      <option value="Moto">Moto</option>
                      <option value="Passeio">Passeio</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">Status</label>
                    <select 
                      className="w-full h-9 px-3 rounded-md border border-input text-sm bg-background"
                      value={vehicleForm.status}
                      onChange={e => setVehicleForm({...vehicleForm, status: e.target.value as any})}
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="MAINTENANCE">Em Manutenção</option>
                      <option value="INACTIVE">Inativo</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingVehicleId && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingVehicleId(null);
                      setVehicleForm({ model: "", plate: "", type: "Caminhão", status: "ACTIVE" });
                    }}>Cancelar</Button>
                  )}
                  <Button size="sm" onClick={handleSaveVehicle} disabled={!vehicleForm.model || !vehicleForm.plate}>
                    {editingVehicleId ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </div>

              {/* Vehicle List */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm">Veículos Cadastrados</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="py-2 h-auto text-xs">Modelo / Placa</TableHead>
                        <TableHead className="py-2 h-auto text-xs">Tipo</TableHead>
                        <TableHead className="py-2 h-auto text-xs">Status</TableHead>
                        <TableHead className="py-2 h-auto text-xs text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="py-3">
                            <div className="font-semibold text-sm">{v.model}</div>
                            <div className="text-xs text-muted-foreground font-mono">{v.plate}</div>
                          </TableCell>
                          <TableCell className="text-xs">{v.type}</TableCell>
                          <TableCell>
                            <Badge variant={v.status === 'ACTIVE' ? 'success' : v.status === 'MAINTENANCE' ? 'outline' : 'secondary'} className="text-[10px] py-0 h-4">
                              {v.status === 'ACTIVE' ? "Ativo" : v.status === 'MAINTENANCE' ? "Manutenção" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditVehicle(v)}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteVehicle(v.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {vehicles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-20 text-muted-foreground text-sm">Nenhum veículo cadastrado.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
