import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Car, 
  Truck, 
  Wrench, 
  Plus, 
  Gauge, 
  Droplet, 
  Thermometer, 
  FileText, 
  AlertTriangle, 
  Search, 
  Edit2, 
  Trash2, 
  DollarSign,
  Activity,
  UserCheck,
  X
} from "lucide-react";
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, orderBy, updateDoc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { Vehicle, MaintenanceRecord } from "../types";
import { toast } from "sonner";
import { sendWhatsAppNotification } from "../lib/notificationService";

export function Fleet() {
  const { orgId } = useOrganization();
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");

  useEffect(() => {
    const s = searchParams.get("search");
    if (s !== null) {
      setSearchTerm(s);
    }
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState<"fleet" | "history">("fleet");

  const getMaintenanceStatus = (v: Vehicle) => {
    const current = Number(v.currentKm || 0);
    const lastOil = Number(v.lastOilChangeKm || 0);
    const lastCoolant = Number(v.lastCoolantChangeKm || 0);

    const oilRun = lastOil > 0 ? (current - lastOil) : 0;
    const coolantRun = lastCoolant > 0 ? (current - lastCoolant) : 0;

    const alerts: string[] = [];
    let status = "OK";

    if (lastOil > 0) {
      if (oilRun >= 10000) {
        alerts.push(`Troca de óleo vencida há ${(oilRun - 10000).toLocaleString("pt-BR")} KM`);
        status = "CRITICAL";
      } else if (oilRun >= 8500) {
        alerts.push(`Troca de óleo próxima (Faltam ${(10000 - oilRun).toLocaleString("pt-BR")} KM)`);
        if (status !== "CRITICAL") status = "WARNING";
      }
    }

    if (lastCoolant > 0) {
      if (coolantRun >= 20000) {
        alerts.push(`Troca de líquido de arrefecimento vencida há ${(coolantRun - 20000).toLocaleString("pt-BR")} KM`);
        status = "CRITICAL";
      } else if (coolantRun >= 17000) {
        alerts.push(`Troca de líquido de arrefecimento próxima (Faltam ${(20000 - coolantRun).toLocaleString("pt-BR")} KM)`);
        if (status !== "CRITICAL") status = "WARNING";
      }
    }

    if (v.nextMaintenanceKm && v.nextMaintenanceKm > 0) {
      if (current >= v.nextMaintenanceKm) {
        alerts.push(`Manutenção programada (${v.nextMaintenanceNotes || "Geral"}) vencida em ${formatKm(v.nextMaintenanceKm)}`);
        status = "CRITICAL";
      } else if (current >= v.nextMaintenanceKm - 1000) {
        alerts.push(`Manutenção programada (${v.nextMaintenanceNotes || "Geral"}) se aproximando em ${formatKm(v.nextMaintenanceKm)} (Faltam ${(v.nextMaintenanceKm - current).toLocaleString("pt-BR")} KM)`);
        if (status !== "CRITICAL") status = "WARNING";
      }
    }

    if (v.nextMaintenanceDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const targetDate = new Date(v.nextMaintenanceDate);
      targetDate.setHours(0,0,0,0);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        alerts.push(`Preventiva agendada vencida em ${new Date(v.nextMaintenanceDate).toLocaleDateString("pt-BR")}`);
        status = "CRITICAL";
      } else if (diffDays <= 4) {
        const daysLabel = diffDays === 0 ? "HOJE" : diffDays === 1 ? "amanhã" : `em ${diffDays} dias`;
        alerts.push(`Preventiva agendada próxima para ${new Date(v.nextMaintenanceDate).toLocaleDateString("pt-BR")} (${daysLabel})`);
        if (status !== "CRITICAL") status = "WARNING";
      }
    }

    return { status, alerts };
  };

  const triggerMaintenanceWhatsApp = (v: Vehicle) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const { alerts } = getMaintenanceStatus(v);
    if (alerts.length === 0) {
      toast.info("Este veículo está com todas as preventivas em dia!");
      return;
    }

    const driverName = v.driver || "Motorista";
    const phone = v.driverPhone || "";
    
    // Format alerts as bullet points
    const alertList = alerts.map(a => `• ${a}`).join("\n");
    
    const message = `*ALERTA DE MANUTENÇÃO PREVENTIVA - AlmoxPro* 🚗💨\n\nOlá *${driverName}*,\n\nEste é um aviso do sistema AlmoxPro sobre o veículo *${v.model}* (Placa: *${v.plate}*).\n\nIdentificamos pendências no cronograma de revisão periódica:\n${alertList}\n\nQuilometragem atual registrada: *${formatKm(v.currentKm)}*.\n\nPor favor, atente-se e programe uma visita à oficina o quanto antes para garantir a segurança e conservação do veículo!\n\nAtenciosamente,\n*Gestão de Frota - AlmoxPro*`;

    if (!phone) {
      const userPhone = window.prompt(`O veículo ${v.plate} não possui WhatsApp cadastrado para o motorista ${driverName}.\nDigite o número de WhatsApp para enviar este alerta (ex: 5541999999999):`, "55");
      if (userPhone) {
        sendWhatsAppNotification(userPhone, message);
        logActivity('whatsapp_notification', 'Frota', `Mensagem de manutenção do ${v.plate} enviada para o número manual ${userPhone}`, 'CREATE');
        toast.success("Alerta do WhatsApp enviado com sucesso!");
      }
    } else {
      sendWhatsAppNotification(phone, message);
      logActivity('whatsapp_notification', 'Frota', `Mensagem de manutenção do ${v.plate} direcionada ao WhatsApp cadastrado (${phone})`, 'CREATE');
      toast.success(`Redirecionando para o WhatsApp do motorista (${driverName})...`);
    }
  };

  // State for Vehicle Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    model: "",
    plate: "",
    type: "Caminhão",
    status: "ACTIVE" as Vehicle["status"],
    driver: "",
    driverPhone: "",
    currentKm: 0,
    lastOilChangeKm: 0,
    lastOilChangeDate: "",
    lastCoolantChangeKm: 0,
    lastCoolantChangeDate: "",
    mechanicNotes: "",
    nextMaintenanceDate: "",
    nextMaintenanceKm: 0,
    nextMaintenanceNotes: ""
  });

  // State for Maintenance Service Log Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [serviceForm, setServiceForm] = useState({
    serviceDone: "",
    date: new Date().toISOString().substring(0, 16), // Local format YYYY-MM-DDTHH:mm
    km: 0,
    mechanicNotes: "",
    cost: 0
  });

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

  // Real-time listener for vehicles collection
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    const q = query(collection(db, `organizations/${orgId}/vehicles`), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/vehicles`);
      setLoading(false);
    });

    return () => unsub();
  }, [orgId]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return vehicles.filter(v => 
      v.model.toLowerCase().includes(term) || 
      v.plate.toLowerCase().includes(term) ||
      (v.driver && v.driver.toLowerCase().includes(term))
    );
  }, [vehicles, searchTerm]);

  // Aggregate stats
  const stats = useMemo(() => {
    let active = 0;
    let main = 0;
    let inactive = 0;
    let totalKm = 0;
    let preventiveAlerts = 0;

    vehicles.forEach(v => {
      if (v.status === "ACTIVE") active++;
      else if (v.status === "MAINTENANCE") main++;
      else inactive++;

      totalKm += Number(v.currentKm || 0);

      // Check if preventive alert is triggered (Oil change over 10,000 km or Coolant over 20,000 km)
      const current = Number(v.currentKm || 0);
      const lastOil = Number(v.lastOilChangeKm || 0);
      const lastCoolant = Number(v.lastCoolantChangeKm || 0);

      const isOilDue = lastOil > 0 && (current - lastOil >= 10000);
      const isCoolantDue = lastCoolant > 0 && (current - lastCoolant >= 20000);
      const isCustomKmDue = Number(v.nextMaintenanceKm || 0) > 0 && (current >= Number(v.nextMaintenanceKm));
      const isCustomDateDue = v.nextMaintenanceDate && (new Date(v.nextMaintenanceDate) <= new Date());

      if (isOilDue || isCoolantDue || isCustomKmDue || isCustomDateDue) {
        preventiveAlerts++;
      }
    });

    return {
      total: vehicles.length,
      active,
      maintenance: main,
      inactive,
      totalKm,
      preventiveAlerts
    };
  }, [vehicles]);

  // Complete maintenance history aggregated and ordered by date
  const allMaintenances = useMemo(() => {
    const records: { vehicleId: string; vehicleModel: string; vehiclePlate: string; record: MaintenanceRecord }[] = [];
    vehicles.forEach(v => {
      if (v.maintenances && Array.isArray(v.maintenances)) {
        v.maintenances.forEach(m => {
          records.push({
            vehicleId: v.id,
            vehicleModel: v.model,
            vehiclePlate: v.plate,
            record: m
          });
        });
      }
    });

    // Sort by date desc (time includes HH:mm)
    return records.sort((a, b) => new Date(b.record.date).getTime() - new Date(a.record.date).getTime());
  }, [vehicles]);

  // Save/Update vehicle details
  const handleSaveVehicle = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;
    try {
      const dataToSave = {
        model: vehicleForm.model.trim(),
        plate: vehicleForm.plate.toUpperCase().trim(),
        type: vehicleForm.type,
        status: vehicleForm.status,
        driver: vehicleForm.driver.trim(),
        driverPhone: vehicleForm.driverPhone.trim(),
        currentKm: Number(vehicleForm.currentKm || 0),
        lastOilChangeKm: Number(vehicleForm.lastOilChangeKm || 0),
        lastOilChangeDate: vehicleForm.lastOilChangeDate,
        lastCoolantChangeKm: Number(vehicleForm.lastCoolantChangeKm || 0),
        lastCoolantChangeDate: vehicleForm.lastCoolantChangeDate,
        mechanicNotes: vehicleForm.mechanicNotes.trim(),
        nextMaintenanceDate: vehicleForm.nextMaintenanceDate,
        nextMaintenanceKm: Number(vehicleForm.nextMaintenanceKm || 0),
        nextMaintenanceNotes: vehicleForm.nextMaintenanceNotes.trim()
      };

      if (editingVehicleId) {
        // preserve existing maintenance logs if updating
        const oldVehicle = vehicles.find(v => v.id === editingVehicleId);
        const updated = {
          ...dataToSave,
          maintenances: oldVehicle?.maintenances || []
        };
        await updateDoc(doc(db, `organizations/${orgId}/vehicles`, editingVehicleId), updated);
        logActivity('vehicle_update', 'Frota', `Dados do veículo ${dataToSave.plate} (${dataToSave.model}) atualizados`, 'UPDATE');
        toast.success("Veículo atualizado com sucesso!");
      } else {
        const newId = `VEH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const created = {
          id: newId,
          ...dataToSave,
          createdAt: new Date().toISOString(),
          maintenances: []
        };
        await setDoc(doc(db, `organizations/${orgId}/vehicles`, newId), created);
        logActivity('vehicle_add', 'Frota', `Veículo ${dataToSave.plate} adicionado à frota`, 'CREATE');
        toast.success("Novo veículo cadastrado!");
      }

      setIsVehicleModalOpen(false);
      setEditingVehicleId(null);
      resetVehicleForm();
    } catch (e) {
      handleFirestoreError(e, editingVehicleId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/vehicles`);
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      model: "",
      plate: "",
      type: "Caminhão",
      status: "ACTIVE",
      driver: "",
      driverPhone: "",
      currentKm: 0,
      lastOilChangeKm: 0,
      lastOilChangeDate: "",
      lastCoolantChangeKm: 0,
      lastCoolantChangeDate: "",
      mechanicNotes: "",
      nextMaintenanceDate: "",
      nextMaintenanceKm: 0,
      nextMaintenanceNotes: ""
    });
  };

  const handleEditVehicle = (v: Vehicle) => {
    setEditingVehicleId(v.id);
    setVehicleForm({
      model: v.model,
      plate: v.plate,
      type: v.type,
      status: v.status,
      driver: v.driver || "",
      driverPhone: v.driverPhone || "",
      currentKm: v.currentKm || 0,
      lastOilChangeKm: v.lastOilChangeKm || 0,
      lastOilChangeDate: v.lastOilChangeDate || "",
      lastCoolantChangeKm: v.lastCoolantChangeKm || 0,
      lastCoolantChangeDate: v.lastCoolantChangeDate || "",
      mechanicNotes: v.mechanicNotes || "",
      nextMaintenanceDate: v.nextMaintenanceDate || "",
      nextMaintenanceKm: v.nextMaintenanceKm || 0,
      nextMaintenanceNotes: v.nextMaintenanceNotes || ""
    });
    setIsVehicleModalOpen(true);
  };

  const handleDeleteVehicle = async (id: string, plate: string) => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !window.confirm(`Deseja mesmo remover o veículo ${plate} da frota? Esta ação é irreversível e apagará o histórico.`)) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/vehicles`, id));
      logActivity('vehicle_delete', 'Frota', `Veículo ${plate} removido`, 'DELETE');
      toast.success("Veículo excluído da frota!");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `organizations/${orgId}/vehicles/${id}`);
    }
  };

  // Log new maintenance record
  const handleLogService = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !selectedVehicle) return;
    try {
      const newRecord: MaintenanceRecord = {
        id: `MNT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        serviceDone: serviceForm.serviceDone.trim(),
        date: serviceForm.date,
        km: Number(serviceForm.km || 0),
        mechanicNotes: serviceForm.mechanicNotes.trim(),
        cost: Number(serviceForm.cost || 0)
      };

      const updatedHistory = [...(selectedVehicle.maintenances || []), newRecord];
      
      // Update vehicle properties (auto-elevate current KM if a greater KM was recorded)
      const isNewKmHigher = newRecord.km > (selectedVehicle.currentKm || 0);
      const finalKm = isNewKmHigher ? newRecord.km : (selectedVehicle.currentKm || 0);

      const updates: any = {
        maintenances: updatedHistory,
        currentKm: finalKm
      };

      // Auto-tag oil or coolant stats if that was the service logged
      const lowerService = newRecord.serviceDone.toLowerCase();
      if (lowerService.includes("óleo") || lowerService.includes("oleo")) {
        updates.lastOilChangeKm = newRecord.km;
        updates.lastOilChangeDate = newRecord.date.split("T")[0];
      }
      if (lowerService.includes("arrefecimento") || lowerService.includes("fluido") || lowerService.includes("flúido")) {
        updates.lastCoolantChangeKm = newRecord.km;
        updates.lastCoolantChangeDate = newRecord.date.split("T")[0];
      }
      if (newRecord.mechanicNotes) {
        updates.mechanicNotes = newRecord.mechanicNotes;
      }

      await updateDoc(doc(db, `organizations/${orgId}/vehicles`, selectedVehicle.id), updates);
      logActivity('maintenance_log', 'Frota', `Registrado manutenção no veículo ${selectedVehicle.plate}: ${newRecord.serviceDone}`, 'UPDATE');
      toast.success(`Serviço registrado no ${selectedVehicle.plate}!`);
      
      setIsServiceModalOpen(false);
      setSelectedVehicle(null);
      setServiceForm({
        serviceDone: "",
        date: new Date().toISOString().substring(0, 16),
        km: 0,
        mechanicNotes: "",
        cost: 0
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `organizations/${orgId}/vehicles/${selectedVehicle?.id}`);
    }
  };

  const handleOpenServiceModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setServiceForm({
      serviceDone: "",
      date: new Date().toISOString().substring(0, 16),
      km: vehicle.currentKm || 0,
      mechanicNotes: "",
      cost: 0
    });
    setIsServiceModalOpen(true);
  };

  // Helper formatting values
  const formatKm = (km: number | undefined) => {
    if (km === undefined || km === null) return "N/D";
    return Number(km).toLocaleString("pt-BR") + " KM";
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/D";
    try {
      const parts = dateStr.split("T");
      const d = new Date(parts[0]);
      const dateFormatted = d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
      if (parts[1]) {
        return `${dateFormatted} às ${parts[1]}`;
      }
      return dateFormatted;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Frota</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Controle de veículos, quilometragens, manutenções corretivas e agendamentos preventivos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { resetVehicleForm(); setEditingVehicleId(null); setIsVehicleModalOpen(true); }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar Veículo
          </Button>
        </div>
      </div>

      {/* Fleet Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
            <Car className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {stats.active} Ativos | {stats.maintenance} Em Manutenção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prevenção Alerta</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.preventiveAlerts > 0 ? "text-amber-500 animate-pulse" : "text-emerald-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.preventiveAlerts > 0 ? "text-amber-500" : "text-foreground"}`}>
              {stats.preventiveAlerts}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Veículos com troca pendente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distância Total</CardTitle>
            <Gauge className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKm(stats.totalKm)}</div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Quilometragem somada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Manutenções</CardTitle>
            <Wrench className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allMaintenances.length}</div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Serviços auditados no total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Sub-Tabs and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-px">
        <div className="flex space-x-2">
          <Button 
            variant={activeTab === "fleet" ? "default" : "ghost"} 
            className="rounded-b-none h-11 px-4 border-b-2 border-transparent transition-all"
            onClick={() => setActiveTab("fleet")}
          >
            <Car className="h-4 w-4 mr-2" />
            Veículos & Manutenções
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "ghost"} 
            className="rounded-b-none h-11 px-4 border-b-2 border-transparent transition-all"
            onClick={() => setActiveTab("history")}
          >
            <Activity className="h-4 w-4 mr-2" />
            Histórico Consolidado
          </Button>
        </div>

        {activeTab === "fleet" && (
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input 
              type="text"
              placeholder="Pesquisar por modelo, placa ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 outline-none"
            />
          </div>
        )}
      </div>

      {/* Main Tab Rendering */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Wrench className="h-10 w-10 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Buscando informações da frota...</span>
        </div>
      ) : activeTab === "fleet" ? (
        // FLEET AND VEHICLES GRID VIEW
        <div className="space-y-6">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-lg">Nenhum veículo encontrado</h3>
              <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
                Não localizamos veículos com os critérios informados. Cadastre um novo veículo ou altere o termo de pesquisa.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchTerm("")}>
                Limpar Busca
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {filteredVehicles.map((v) => {
                // Perform quick alerts checking on oil (10K km) & coolant (20K km) & custom milestones
                const currentKm = v.currentKm || 0;
                const lastOilKm = v.lastOilChangeKm || 0;
                const lastCoolantKm = v.lastCoolantChangeKm || 0;

                const kmSinceOil = currentKm - lastOilKm;
                const kmSinceCoolant = currentKm - lastCoolantKm;
                
                // Percentages of service wear (limit between 0-100)
                const oilWearPercentage = lastOilKm > 0 ? Math.min(100, (kmSinceOil / 10000) * 100) : 0;
                const coolantWearPercentage = lastCoolantKm > 0 ? Math.min(100, (kmSinceCoolant / 20000) * 100) : 0;

                // Call our unified status helper
                const maintenanceInfo = getMaintenanceStatus(v);

                return (
                  <Card key={v.id} className="relative overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                    {/* Top status indicator strip */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-border" />
                    {v.status === 'MAINTENANCE' && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 animate-pulse" />
                    )}
                    {v.status === 'INACTIVE' && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-zinc-500" />
                    )}
                    {v.status === 'ACTIVE' && maintenanceInfo.status === 'CRITICAL' && (
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600 animate-pulse" />
                    )}
                    
                    <CardHeader className="pb-3 pt-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            maintenanceInfo.status === 'CRITICAL' 
                              ? "bg-red-500/10 text-red-500" 
                              : maintenanceInfo.status === 'WARNING'
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-primary/10 text-primary"
                          }`}>
                            {v.type === "Caminhão" || v.type === "Furgão" ? (
                              <Truck className="h-6 w-6" />
                            ) : (
                              <Car className="h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg font-bold font-display leading-tight">{v.model}</CardTitle>
                            <CardDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              Placa: <span className="bg-muted px-1.5 py-0.5 rounded font-bold text-foreground border border-border">{v.plate}</span>
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <Badge variant={v.status === 'ACTIVE' ? 'success' : v.status === 'MAINTENANCE' ? 'outline' : 'secondary'} className="px-2.5 py-0.5 text-[11px] font-semibold">
                            {v.status === 'ACTIVE' ? "Ativo" : v.status === 'MAINTENANCE' ? "Manutenção" : "Inativo"}
                          </Badge>
                          {v.driver ? (
                            <div className="text-xs text-muted-foreground flex flex-col items-end">
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <UserCheck className="h-3.5 w-3.5 text-primary" /> {v.driver}
                              </span>
                              {v.driverPhone && (
                                <span className="text-[10px] text-muted-foreground bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono px-1 rounded-sm mt-0.5 hover:cursor-pointer flex items-center gap-0.5" onClick={() => triggerMaintenanceWhatsApp(v)}>
                                  WhatsApp: {v.driverPhone}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10.5px] italic text-muted-foreground">Sem motorista</span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 flex-1">
                      {/* Mileage overview banner */}
                      <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/50">
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Quilometragem Atual</span>
                          <span className="text-base font-extrabold font-mono mt-1 text-primary">{formatKm(v.currentKm)}</span>
                        </div>
                        <div className="flex flex-col justify-center border-l pl-3 border-border">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Cadastrado Em</span>
                          <span className="text-xs font-semibold text-foreground mt-1">{new Date(v.createdAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>

                      {/* Wear Indexes (Visual Progress Bars) */}
                      <div className="space-y-2 pb-1 border-b border-border/50">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Trocas e Fluidos Periódicos</h4>
                        
                        {/* Oil Change Status */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground flex items-center gap-1 font-medium">
                              <Droplet className="h-3 w-3 text-red-500" /> Troca de Óleo
                            </span>
                            <span className="text-muted-foreground text-[11px] font-mono">
                              Última: {v.lastOilChangeKm ? `${formatKm(v.lastOilChangeKm)}` : "Sem registro"}
                            </span>
                          </div>
                          {v.lastOilChangeKm ? (
                            <div className="relative">
                              <Progress value={oilWearPercentage} className="h-2" />
                              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                                <span>{kmSinceOil.toLocaleString("pt-BR")} km rodados</span>
                                <span className={oilWearPercentage >= 90 ? "text-amber-500 font-extrabold animate-pulse" : "text-muted-foreground font-semibold"}>
                                  {oilWearPercentage >= 100 ? "Troca Necessária!" : `${oilWearPercentage.toFixed(0)}% de Desgaste (Intervalo: 10.000km)`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] block italic">Por favor, registre a última para calibrar o alerta automático.</span>
                          )}
                        </div>

                        {/* Coolant Fluid Change Status */}
                        <div className="space-y-1 mt-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground flex items-center gap-1 font-medium">
                              <Thermometer className="h-3 w-3 text-blue-500" /> Arrefecimento
                            </span>
                            <span className="text-muted-foreground text-[11px] font-mono">
                              Última: {v.lastCoolantChangeKm ? `${formatKm(v.lastCoolantChangeKm)}` : "Sem registro"}
                            </span>
                          </div>
                          {v.lastCoolantChangeKm ? (
                            <div className="relative">
                              <Progress value={coolantWearPercentage} className="h-2" />
                              <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                                <span>{kmSinceCoolant.toLocaleString("pt-BR")} km rodados</span>
                                <span className={coolantWearPercentage >= 90 ? "text-amber-500 font-extrabold animate-pulse" : "text-muted-foreground font-semibold"}>
                                  {coolantWearPercentage >= 100 ? "Troca Necessária!" : `${coolantWearPercentage.toFixed(0)}% de Desgaste (Intervalo: 20.000km)`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] block italic">Por favor, registre ou atualize para calibrar os alertas periódicos.</span>
                          )}
                        </div>
                      </div>

                      {/* Mechanics Notes */}
                      <div className="text-xs bg-muted/30 p-2.5 rounded border">
                        <div className="flex items-center gap-1.5 font-semibold text-muted-foreground mb-1 uppercase text-[10px] tracking-wide">
                          <FileText className="h-3.5 w-3.5 text-blue-400" /> Observações do Mecânico
                        </div>
                        <p className="text-foreground min-h-[1.5rem] break-words italic">
                          {v.mechanicNotes || "Nenhuma observação cadastrada."}
                        </p>
                      </div>

                      {/* Unified Maintenance Alerts Banner and WhatsApp direct alert */}
                      {maintenanceInfo.status !== "OK" && (
                        <div className={`p-3 rounded-lg border flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-300 ${
                          maintenanceInfo.status === "CRITICAL" 
                            ? "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-400" 
                            : "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-400"
                        }`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`h-4.5 w-4.5 shrink-0 mt-0.5 animate-pulse ${maintenanceInfo.status === "CRITICAL" ? "text-red-600" : "text-amber-600"}`} />
                            <div className="text-xs space-y-1 flex-1">
                              <span className="font-bold">Atenção Preventiva!</span>
                              <div className="space-y-1 text-[11.5px] font-medium leading-tight">
                                {maintenanceInfo.alerts.map((alert, index) => (
                                  <div key={index} className="flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-current shrink-0" />
                                    <span>{alert}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button 
                            onClick={() => triggerMaintenanceWhatsApp(v)}
                            className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 rounded-md shadow-sm border-0 transition-all font-sans"
                          >
                            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.454L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 2.019 14.111.996 11.997.996 6.561.996 2.135 5.367 2.131 10.8c-.002 1.71.452 3.382 1.313 4.869l-.974 3.556 3.655-.958zm12.332-6.524c-.317-.159-1.88-.928-2.172-1.034-.29-.107-.503-.159-.715.159-.211.318-.82.1034-1.004 1.246-.186.213-.372.24-.69.08-1.564-.783-2.614-1.428-3.516-2.983-.243-.418-.243-.72-.086-.921.144-.183.318-.372.477-.557.159-.186.212-.318.318-.53.106-.214.053-.4-.027-.558-.08-.16-.715-1.726-.98-2.36-.258-.62-.519-.534-.715-.544-.186-.01-.398-.01-.61-.01s-.557.08-.847.4c-.29.318-1.111 1.087-1.111 2.65 0 1.565 1.139 3.078 1.299 3.29.16.213 2.24 3.425 5.424 4.8 1.24.535 2.13.784 2.87.973.801.213 1.53.184 2.09.1.63-.095 1.88-.769 2.14-1.484.26-.715.26-1.325.18-1.455-.07-.13-.29-.21-.61-.37z"/>
                            </svg>
                            Enviar Alerta por WhatsApp
                          </Button>
                        </div>
                      )}

                      {/* Miniature Recent Services table */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Últimas Manutenções</span>
                        {(!v.maintenances || v.maintenances.length === 0) ? (
                          <span className="text-xs text-zinc-500 block italic">Nenhuma intervenção registrada ainda.</span>
                        ) : (
                          <div className="border rounded max-h-24 overflow-y-auto text-[11px] divide-y divide-border bg-background">
                            {[...(v.maintenances || [])].reverse().slice(0, 3).map((hist) => (
                              <div key={hist.id} className="p-1.5 flex justify-between items-start hover:bg-muted/30">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-foreground">{hist.serviceDone}</span>
                                  <span className="text-muted-foreground block text-[10px]">{formatDate(hist.date)} ({formatKm(hist.km)})</span>
                                </div>
                                <div className="text-right">
                                  {hist.cost ? (
                                    <span className="font-bold text-foreground">R$ {hist.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                  ) : (
                                    <span className="text-muted-foreground">Gratuito/Garantia</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>

                    {/* Action Panel */}
                    <div className="px-6 py-3.5 bg-muted/20 border-t border-border/60 flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5" />
                        <span>{v.maintenances?.length || 0} Manutenções</span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleEditVehicle(v)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="default" className="h-8 text-xs bg-primary/20 hover:bg-primary text-primary hover:text-white" onClick={() => handleOpenServiceModal(v)}>
                          <Wrench className="h-3.5 w-3.5 mr-1" /> Logar Serviço
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteVehicle(v.id, v.plate)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // AUDITED DETAILED RECENT SERVICES HISTORY
        <Card>
          <CardHeader>
            <CardTitle>Histórico Geral de Manutenções da Frota</CardTitle>
            <CardDescription>
              Acompanhamento de notas fiscais de peças, mão-de-obra e prazos de todos os carros cadastrados no AlmoxPro.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Serviço Executado</TableHead>
                    <TableHead>Data & Hora</TableHead>
                    <TableHead>Quilometragem (KM)</TableHead>
                    <TableHead>Valor Integrado</TableHead>
                    <TableHead>Notas do Mecânico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMaintenances.map((item, idx) => (
                    <TableRow key={item.record.id || idx}>
                      <TableCell className="font-semibold">{item.vehicleModel}</TableCell>
                      <TableCell><span className="font-mono bg-muted border px-1.5 py-0.5 text-xs rounded">{item.vehiclePlate}</span></TableCell>
                      <TableCell className="font-medium text-foreground">{item.record.serviceDone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{formatDate(item.record.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatKm(item.record.km)}</TableCell>
                      <TableCell className="font-bold text-foreground font-mono">
                        {item.record.cost ? `R$ ${item.record.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "N/I"}
                      </TableCell>
                      <TableCell className="text-xs italic text-neutral-600 max-w-xs truncate" title={item.record.mechanicNotes}>
                        {item.record.mechanicNotes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {allMaintenances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-20 text-muted-foreground text-sm">
                        <Wrench className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
                        Nenhuma manutenção registrada até o momento.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: ADD / EDIT VEHICLE */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 shrink-0">
              <CardTitle className="text-xl flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" /> {editingVehicleId ? "Editar Veículo da Frota" : "Cadastrar Novo Veículo da Frota"}
              </CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))]" onClick={() => setIsVehicleModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Basic info section */}
                <div className="md:col-span-3 pb-2 border-b">
                  <h3 className="text-sm font-bold uppercase text-primary tracking-wide">Informações Gerais</h3>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Modelo</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={vehicleForm.model}
                    onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})}
                    placeholder="Ex: Chevrolet Montana, Volvo FH 540"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Placa</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.plate}
                    onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value})}
                    placeholder="Ex: ABC1D23, RJK-2940"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Motorista Responsável</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={vehicleForm.driver}
                    onChange={e => setVehicleForm({...vehicleForm, driver: e.target.value})}
                    placeholder="Motorista titular"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">WhatsApp do Motorista</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.driverPhone}
                    onChange={e => setVehicleForm({...vehicleForm, driverPhone: e.target.value})}
                    placeholder="Ex: 5541999999999"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Tipo</label>
                  <select 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm bg-background outline-none"
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
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Status Operacional</label>
                  <select 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm bg-background outline-none"
                    value={vehicleForm.status}
                    onChange={e => setVehicleForm({...vehicleForm, status: e.target.value as any})}
                  >
                    <option value="ACTIVE">Ativo (Em Circulação)</option>
                    <option value="MAINTENANCE">Manutenção (Oficina/Reparo)</option>
                    <option value="INACTIVE">Inativo (Estoque/Em repouso)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Quilometragem (KM) Atual</label>
                  <input 
                    type="number"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.currentKm || ""}
                    onChange={e => setVehicleForm({...vehicleForm, currentKm: Number(e.target.value)})}
                    placeholder="Ex: 48500"
                  />
                </div>

                {/* Preventive status calibration info */}
                <div className="md:col-span-3 pt-4 pb-2 border-b">
                  <h3 className="text-sm font-bold uppercase text-primary tracking-wide">Calibração de Preventivas (Alertas)</h3>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Última Troca de Óleo (KM)</label>
                  <input 
                    type="number"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.lastOilChangeKm || ""}
                    onChange={e => setVehicleForm({...vehicleForm, lastOilChangeKm: Number(e.target.value)})}
                    placeholder="KM da troca de óleo"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Data Última Troca Óleo</label>
                  <input 
                    type="date"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.lastOilChangeDate}
                    onChange={e => setVehicleForm({...vehicleForm, lastOilChangeDate: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground text-blue-500">Última Troca Líq. Arrefecimento (KM)</label>
                  <input 
                    type="number"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.lastCoolantChangeKm || ""}
                    onChange={e => setVehicleForm({...vehicleForm, lastCoolantChangeKm: Number(e.target.value)})}
                    placeholder="KM do arrefecimento"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground text-blue-500">Data Última Troca Arrefecimento</label>
                  <input 
                    type="date"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.lastCoolantChangeDate}
                    onChange={e => setVehicleForm({...vehicleForm, lastCoolantChangeDate: e.target.value})}
                  />
                </div>

                <div className="md:col-span-3 pt-4 pb-2 border-b">
                  <h3 className="text-sm font-bold uppercase text-primary tracking-wide">Agendar Próxima Preventiva (Opcional)</h3>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Próxima Preventiva (KM Alvo)</label>
                  <input 
                    type="number"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    placeholder="Ex: 60000"
                    value={vehicleForm.nextMaintenanceKm || ""}
                    onChange={e => setVehicleForm({...vehicleForm, nextMaintenanceKm: Number(e.target.value)})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Próxima Preventiva (Data Alvo)</label>
                  <input 
                    type="date"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    value={vehicleForm.nextMaintenanceDate}
                    onChange={e => setVehicleForm({...vehicleForm, nextMaintenanceDate: e.target.value})}
                  />
                </div>

                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Peças/Serviços Programados</label>
                  <input 
                    type="text"
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Ex: Troca de pastilhas de freio, jogo de velas e cabos"
                    value={vehicleForm.nextMaintenanceNotes}
                    onChange={e => setVehicleForm({...vehicleForm, nextMaintenanceNotes: e.target.value})}
                  />
                </div>

                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Observações Gerais / Histórico Mecânico</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    placeholder="Notas mecânicas recentes (ex: suspensão dianteira recém revisada, amortecedores trocados)"
                    value={vehicleForm.mechanicNotes}
                    onChange={e => setVehicleForm({...vehicleForm, mechanicNotes: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex items-center justify-end space-x-2 shrink-0">
                <Button variant="outline" onClick={() => setIsVehicleModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveVehicle} disabled={!vehicleForm.model || !vehicleForm.plate}>Salvar Veículo</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: LOG NEW MAINTENANCE SERVICE DONE */}
      {isServiceModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 shrink-0">
              <CardTitle className="text-xl flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary animate-bounce" /> Registrar Serviço Executado
              </CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))]" onClick={() => setIsServiceModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-muted rounded border flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">{selectedVehicle.model}</span>
                  <span className="text-xs font-mono text-muted-foreground uppercase">{selectedVehicle.plate}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Atual:</span>
                  <span className="font-bold font-mono text-xs">{formatKm(selectedVehicle.currentKm)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Serviço Executado</label>
                <input 
                  className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  type="text"
                  placeholder="Ex: Troca de óleo Shell Helix 5w30, Filtro de ar e óleo"
                  value={serviceForm.serviceDone}
                  onChange={e => setServiceForm({...serviceForm, serviceDone: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Data & Horário</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-xs outline-none font-mono"
                    type="datetime-local"
                    value={serviceForm.date}
                    onChange={e => setServiceForm({...serviceForm, date: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Quilometragem (KM)</label>
                  <input 
                    className="w-full h-9 px-3 rounded-md border border-input text-sm outline-none font-mono"
                    type="number"
                    value={serviceForm.km || ""}
                    onChange={e => setServiceForm({...serviceForm, km: Number(e.target.value)})}
                    placeholder="KM no dia do serviço"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Custo Total Integrado (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    className="w-full h-9 pl-8 pr-3 rounded-md border border-input text-sm outline-none font-mono"
                    type="number"
                    value={serviceForm.cost || ""}
                    onChange={e => setServiceForm({...serviceForm, cost: Number(e.target.value)})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Observações Técnicas / Notas do Mecânico</label>
                <textarea 
                  rows={3}
                  className="w-full p-3 rounded-md border border-input text-sm outline-none bg-background resize-none"
                  placeholder="Instruções ou defeitos encontrados na manutenção que precisam de acompanhamento..."
                  value={serviceForm.mechanicNotes}
                  onChange={e => setServiceForm({...serviceForm, mechanicNotes: e.target.value})}
                />
              </div>

              <div className="pt-4 border-t flex items-center justify-end space-x-2 shrink-0">
                <Button variant="outline" onClick={() => setIsServiceModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleLogService} disabled={!serviceForm.serviceDone || !serviceForm.date || !serviceForm.km}>Gravar Manutenção</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
