import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Package, Truck, Users, Settings, Search, Menu, ChevronLeft, ChevronRight, Moon, Sun, LogOut, ShieldAlert, FileBarChart, Calculator, FileText, Briefcase, MessageSquare, Share2, Car, IdCard, HelpCircle, Globe, Laptop, RefreshCw, Camera, PackageMinus, ClipboardList } from "lucide-react";
import { Lock, Key, Shield, Scan, UserPlus, Zap } from "lucide-react";
import { useTheme } from "../ThemeProvider";
import { AlmoxProLogo } from "../AlmoxProLogo";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, collection, deleteDoc, setDoc } from "firebase/firestore";
import { useOrganization } from "@/lib/tenant";
import { useSubscription } from "@/lib/useSubscription";
import { useDemoModal } from "../DemoModalProvider";
import { toast } from "sonner";
import { AgentChat } from "../AgentChat";
import { verificarEAlertarEstoque, AlertaEstoque } from "../../lib/alertManager";
import { AlertaEstoqueModal } from "../AlertaEstoqueModal";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { orgId } = useOrganization();
  const { isMaster, role, ipAddress, loading: subLoading } = useSubscription();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const { theme, setTheme } = useTheme();

  const [alertaModal, setAlertaModal] = useState<{ alertas: AlertaEstoque[]; mensagem: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const timer = setTimeout(async () => {
      try {
        const resultado = await verificarEAlertarEstoque(orgId);
        if (resultado) setAlertaModal(resultado);
      } catch { }
    }, 30000);
    return () => clearTimeout(timer);
  }, [orgId]);
  
  // Custom operators state
  const [appSettings, setAppSettings] = useState({
    companyName: "Almox pro",
    avatarUrl: "",
    masterPin: "",
    seniorPin: "",
    juniorPin: "",
    seniorPages: [] as string[],
    juniorPage: ""
  });

  const [activePinLevel, setActivePinLevel] = useState<"master" | "senior" | "junior" | null>(() => {
    const savedLevel = localStorage.getItem("almox_active_pin_level");
    if (!savedLevel) return "master"; // Dono por padrão
    return savedLevel as any;
  });
  const [isPinVerified, setIsPinVerified] = useState<boolean>(() => {
    const savedVerified = localStorage.getItem("almox_active_pin_verified");
    const savedLevel = localStorage.getItem("almox_active_pin_level");
    const isLockedManually = localStorage.getItem("almox_device_locked_manually") === "true";
    
    if (isLockedManually) {
      return false; // Permanece bloqueado pedindo PIN
    }

    if (savedVerified === null) {
      if (savedLevel === "senior" || savedLevel === "junior") {
        return false;
      }
      return true; // Autenticação por padrão de Master para quem tem login
    }
    return savedVerified === "true";
  });

  const [selectedPinLevel, setSelectedPinLevel] = useState<"master" | "senior" | "junior" | null>(null);
  const [pinEntry, setPinEntry] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [showPinSetupModal, setShowPinSetupModal] = useState<boolean>(false);
  
  // PIN setup modal states
  const [setupCompanyName, setSetupCompanyName] = useState("");
  const [setupManagerName, setSetupManagerName] = useState("");
  const [setupCnpj, setSetupCnpj] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupMasterPin, setSetupMasterPin] = useState("");
  const [setupSeniorPin, setSetupSeniorPin] = useState("");
  const [setupJuniorPin, setSetupJuniorPin] = useState("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  const { showDemoModal } = useDemoModal();

  const isDemoMode = localStorage.getItem('isDemoMode') === 'true';

  const isSettingsAccess = location.pathname.startsWith("/app/settings");
  const currentActiveLevel = isSettingsAccess ? "master" : selectedPinLevel;

  const keyPressHandler = React.useCallback((digit: string) => {
    if (!currentActiveLevel) return;
    setPinError("");
    const targetPin = currentActiveLevel === 'master' 
      ? appSettings.masterPin 
      : currentActiveLevel === 'senior' 
        ? appSettings.seniorPin 
        : appSettings.juniorPin;
    
    if (!targetPin) return;
    if (pinEntry.length >= targetPin.length) return;
    const nextPin = pinEntry + digit;
    setPinEntry(nextPin);

    if (nextPin === targetPin) {
      localStorage.setItem("almox_active_pin_level", currentActiveLevel!);
      localStorage.setItem("almox_active_pin_verified", "true");
      localStorage.removeItem("almox_device_locked_manually");
      
      if (currentActiveLevel === "master") {
        sessionStorage.setItem("almox_explicit_master_verified", "true");
      }
      
      setActivePinLevel(currentActiveLevel);
      setIsPinVerified(true);
      toast.success(`Acesso concedido como Operador ${currentActiveLevel?.toUpperCase()}!`);
      
      setPinEntry("");
      setSelectedPinLevel(null);
      setPinError("");
      
      if (currentActiveLevel === 'junior') {
        navigate(appSettings.juniorPage || "/app/fleet");
      } else if (currentActiveLevel === 'senior') {
        const allowed = appSettings.seniorPages || [];
        if (allowed.length > 0) {
          navigate(allowed[0]);
        } else {
          navigate("/app/dashboard");
        }
      } else {
        if (location.pathname.startsWith("/app/settings")) {
          navigate("/app/settings");
        } else {
          navigate("/app/dashboard");
        }
      }
    } else if (nextPin.length === targetPin.length) {
      setPinError("PIN INCORRETO!");
      setTimeout(() => {
        setPinEntry("");
        setPinError("");
      }, 1000);
    }
  }, [currentActiveLevel, pinEntry, appSettings, navigate]);

  useEffect(() => {
    (window as any).triggerDemoBlock = () => {
      showDemoModal();
    };
    return () => {
      delete (window as any).triggerDemoBlock;
    };
  }, [showDemoModal]);

  useEffect(() => {
    if (!currentActiveLevel) return;
    const handlePhysKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        keyPressHandler(e.key);
      } else if (e.key === 'Backspace') {
        setPinEntry(prev => prev.slice(0, -1));
        setPinError("");
      } else if (e.key === 'Escape') {
        if (location.pathname.startsWith("/app/settings")) {
          navigate("/app/dashboard");
        } else {
          setSelectedPinLevel(null);
        }
        setPinEntry("");
        setPinError("");
      }
    };
    window.addEventListener('keydown', handlePhysKey);
    return () => window.removeEventListener('keydown', handlePhysKey);
  }, [currentActiveLevel, keyPressHandler, navigate]);

  const handleNavClick = (_e?: React.MouseEvent, _path?: string) => {
    setIsMobileOpen(false);
  };

  const isBypassed = localStorage.getItem('master_bypass') === 'true';

  useEffect(() => {
    if (!orgId) return;

    const seedDemo = async () => {
      if (isDemoMode) {
        const seedDoneKey = `demo_seeded_${orgId}`;
        if (localStorage.getItem(seedDoneKey) === "true") return;

        try {
          
          // 1. Configurações da Empresa
          const setupData = {
            companyName: "MetalGás S.A. (Demo)",
            cnpj: "12.345.678/0001-90",
            email: "almoxarifado@metalgas.com.br",
            phone: "(11) 4002-8922",
            lowStockAlerts: true,
            shipmentUpdates: true,
            dailyEmail: false,
            externalAccessEnabled: true,
            externalAccessPin: "1234",
            welcomeMessage: "Organização e segurança em primeiro lugar. Estoque calibrado em 200K itens.",
            customGreeting: "Boas-vindas ao painel da MetalGás!",
            masterPin: "1234",
            seniorPin: "2345",
            juniorPin: "3456",
            seniorPages: [
              "/app/dashboard",
              "/app/inventory",
              "/app/catalog",
              "/app/services",
              "/app/quotes",
              "/app/fleet",
              "/app/support"
            ],
            juniorPage: "/app/fleet"
          };
          await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), setupData);

          // 2. Categorias
          const categoriesToSeed = [
            { name: "Cabos e Condutores", description: "Fios, cabos isolados de cobre ou alumínio.", purpose: "Infraestrutura elétrica para obras." },
            { name: "EPIs de Segurança", description: "Equipamentos de Proteção Individual.", purpose: "Conformidade operacional NR-6." },
            { name: "Parafusos e Fixadores", description: "Parafusos, porcas, arruelas e elementos metálicos.", purpose: "Montagem mecânica e sustentação." },
            { name: "Peças e Conexões", description: "Abraçadeiras, tubos e conexões hidráulicas.", purpose: "Manutenção de sistemas fluidos." }
          ];
          for (const cat of categoriesToSeed) {
            const catId = cat.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
            await setDoc(doc(db, `organizations/${orgId}/categories`, catId), { id: catId, ...cat });
          }

          // 3. Produtos (Quantidade total = 200.000, Valor total = R$ 200.000,00)
          const productsToSeed = [
            { id: "PROD-00101", name: "Cabo de Cobre Flexível 10mm (Vermelho)", category: "Cabos e Condutores", location: "Prateleira A-12", qty: 40000, minQty: 5000, price: 1.50, status: "OK", description: "Cabo elétrico flexível de cobre, isolação de PVC, indicado para instalações de baixa tension." },
            { id: "PROD-00102", name: "Luva de Proteção Nitrílica Cano Longo", category: "EPIs de Segurança", location: "Prateleira B-04", qty: 25000, minQty: 2000, price: 2.40, status: "OK", description: "Insumo de segurança de borracha nitrílica robusta, indicado para manuseio de agentes químicos." },
            { id: "PROD-00103", name: "Parafuso Sextavado M12 Zincado", category: "Parafusos e Fixadores", location: "Gaveiro C-08", qty: 110000, minQty: 10000, price: 0.50, status: "OK", description: "Parafuso rosca soberba sextavado de alta resistência, acabamento zincado brilhante." },
            { id: "PROD-00104", name: "Abraçadeira Plástica Nylon 200mm", category: "Peças e Conexões", location: "Prateleira D-03", qty: 20000, minQty: 1500, price: 0.50, status: "OK", description: "Abraçadeira plástica robusta para amarração de fiações e tubulações." },
            { id: "PROD-00105", name: "Máscara Respiratória PFF2 com Válvula", category: "EPIs de Segurança", location: "Prateleira B-09", qty: 5000, minQty: 1000, price: 3.00, status: "OK", description: "Respirador descartável purificador de ar semi-facial para vapores, gases e poeiras tóxicas." }
          ];
          for (const prod of productsToSeed) {
            await setDoc(doc(db, `organizations/${orgId}/inventory`, prod.id), prod);
          }

          // 4. Remessas (Shipments) de Amostra
          const shipmentsToSeed = [
            { id: "SHIP-49102", destination: "Setor de Produção B - Usinagem", items: 1250, driver: "Antônio Souza", vehicle: "Furgão Ford Transit - ABC1D23", status: "DELIVERED", date: "2026-06-01" },
            { id: "SHIP-49103", destination: "Filial São Paulo - Logística Central", items: 3500, driver: "Marcos Pereira", vehicle: "Caminhão Scania - XYZ2A34", status: "SHIPPED", date: "2026-06-01" },
            { id: "SHIP-49104", destination: "Setor de Manutenção de Turbinas", items: 150, driver: "Antônio Souza", vehicle: "Furgão Ford Transit - ABC1D23", status: "PREPARING", date: "2026-06-01" }
          ];
          for (const ship of shipmentsToSeed) {
            await setDoc(doc(db, `organizations/${orgId}/shipments`, ship.id), ship);
          }

          // 5. Laudo de Controle de Qualidade
          const qcToSeed = {
            productName: "Cabo de Cobre Flexível 10mm (Vermelho)",
            inspectorName: "Eng. Marcelo Reis",
            structureStatus: true,
            hasImetro: "SIM",
            hasLabSeal: "SIM",
            hasSafetySeals: "SIM",
            notes: "Lote de cabos de cobre em perfeitas condições técnicas, alta espessura e condutividade adequadas às normas de segurança.",
            signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            status: "APPROVED",
            type: "LOTE",
            date: "2026-06-01"
          };
          await setDoc(doc(db, `organizations/${orgId}/quality_control`, "QR-90021"), qcToSeed);

          localStorage.setItem(seedDoneKey, "true");
          toast.success("Demonstração carregada: Centros de estoque estáveis de 200 mil itens!");
        } catch (err) {
          console.error("Erro ao rodar seeder de demonstração:", err);
        }
      }
    };

    seedDemo();

    const unsub = onSnapshot(doc(db, `organizations/${orgId}/settings`, "default"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const masterPinVal = data.masterPin || "";
        
        setAppSettings({
          companyName: data.companyName || "Almox pro",
          avatarUrl: data.avatarUrl || "",
          masterPin: masterPinVal,
          seniorPin: data.seniorPin || "",
          juniorPin: data.juniorPin || "",
          seniorPages: data.seniorPages || [
            "/app/dashboard",
            "/app/inventory",
            "/app/catalog",
            "/app/services",
            "/app/quotes",
            "/app/fleet",
            "/app/support"
          ],
          juniorPage: data.juniorPage || "/app/fleet"
        });

        setShowPinSetupModal(false);
      } else {
        setShowPinSetupModal(false);
      }
    }, err => handleFirestoreError(err, OperationType.GET, `organizations/${orgId}/settings/default`));
    return () => unsub();
  }, [orgId]);

  const user = auth.currentUser;
  const displayName = isBypassed 
    ? "Esdras Nunes (Criador)" 
    : (isMaster ? "Master Admin" : (user?.displayName || user?.email?.split('@')[0] || "Usuário"));
  const initials = isBypassed ? "EN" : displayName.substring(0, 2).toUpperCase();

  // Subscrever à lista de dispositivos da empresa em tempo real
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    if (!orgId || !user) {
      setLoadingDevices(false);
      return;
    }
    const devicesRef = collection(db, `organizations/${orgId}/active_devices`);
    const unsub = onSnapshot(devicesRef, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push(d.data());
      });
      setDeviceList(list);
      setLoadingDevices(false);
    }, (err) => {
      console.warn("Dispositivos bloqueados ou erro:", err.message);
      setLoadingDevices(false);
    });
    return () => unsub();
  }, [orgId, user]);

  const handleRemoveDevice = async (ipToRemove: string) => {
    if (!orgId) return;
    try {
      const docId = ipToRemove.replace(/\./g, '_');
      await deleteDoc(doc(db, `organizations/${orgId}/active_devices`, docId));
      toast.success(`Dispositivo ${ipToRemove} revogado com sucesso!`);
    } catch (err: any) {
      console.error("Failed to revoke device:", err);
      toast.error("Erro ao revogar dispositivo do banco de dados.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('isDemoMode');
      localStorage.removeItem('master_bypass');
      localStorage.removeItem('demoOrgId');
      localStorage.removeItem('almox_active_pin_level');
      localStorage.removeItem('almox_active_pin_verified');
      localStorage.removeItem('almox_device_locked_manually');
      sessionStorage.removeItem('almox_explicit_master_verified');
      navigate("/");
      toast.success("Sessão encerrada com sucesso.");
    } catch (e: any) {
      toast.error("Erro ao encerrar sessão.");
    }
  };

  const handleSaveInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupCompanyName.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    if (!setupMasterPin || setupMasterPin.length < 4) {
      toast.error("O PIN Master deve ter de 4 a 6 dígitos");
      return;
    }
    if (!setupSeniorPin || setupSeniorPin.length < 4) {
      toast.error("O PIN Sênior deve ter de 4 a 6 dígitos");
      return;
    }
    if (!setupJuniorPin || setupJuniorPin.length < 4) {
      toast.error("O PIN Júnior deve ter de 4 a 6 dígitos");
      return;
    }

    setIsSavingSetup(true);
    const setupData = {
      companyName: setupCompanyName,
      managerName: setupManagerName || "Gestor Principal",
      cnpj: setupCnpj || "00.000.000/0001-00",
      email: setupEmail || user?.email || "contato@almoxpro.com.br",
      phone: setupPhone || "(11) 4002-8922",
      avatarUrl: "",
      welcomeMessage: "Organização e segurança em primeiro lugar. Vamos movimentar o estoque com agilidade!",
      customGreeting: "Boas-vindas ao painel operacional!",
      masterPin: setupMasterPin,
      seniorPin: setupSeniorPin,
      juniorPin: setupJuniorPin,
      seniorPages: [
        "/app/dashboard",
        "/app/inventory",
        "/app/catalog",
        "/app/services",
        "/app/quotes",
        "/app/fleet",
        "/app/support"
      ],
      juniorPage: "/app/fleet"
    };

    try {
      if (orgId && !isDemoMode) {
        await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), setupData);
      }
      
      localStorage.setItem(`almox_settings_${orgId || 'demo'}`, JSON.stringify(setupData));
      localStorage.setItem("almox_active_pin_level", "master");
      localStorage.setItem("almox_active_pin_verified", "true");
      localStorage.removeItem("almox_device_locked_manually");
      sessionStorage.setItem("almox_explicit_master_verified", "true");
      setActivePinLevel("master");
      setIsPinVerified(true);
      setShowPinSetupModal(false);
      toast.success("AlmoxPro inicializado com sucesso! Operador MASTER ativo.");
      navigate("/app/dashboard");
    } catch (err: any) {
      console.error("Setup error:", err);
      toast.error("Erro ao salvar configuração inicial.");
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/app/catalog?q=${encodeURIComponent(globalSearch.trim())}`);
      setIsSearchOpen(false);
    }
  };

  const navItems = [
    { name: "Dashboard", path: "/app/dashboard", icon: LayoutDashboard },
    { name: "Estoque", path: "/app/inventory", icon: Package },
    { name: "Scanner", path: "/scan", icon: Scan },
    { name: "Scanner Visual IA", path: "/app/live-scanner", icon: Zap },
    { name: "Saída em Lote", path: "/app/saida-lote", icon: PackageMinus },
    { name: "Documentos", path: "/app/documentos", icon: FileText },
    { name: "Registros", path: "/app/registros", icon: ClipboardList },
    { name: "Catálogo", path: "/app/catalog", icon: Search },
    { name: "Serviços", path: "/app/services", icon: Briefcase },
    { name: "Orçamentos", path: "/app/quotes", icon: FileText },
    { name: "Expedição", path: "/app/shipments", icon: Truck },
    { name: "Frota", path: "/app/fleet", icon: Car },
    { name: "Funcionários", path: "/app/employees", icon: IdCard },
    { name: "Fornecedores", path: "/app/suppliers", icon: Users },
    { name: "Importar Contatos", path: "/app/import-contacts", icon: UserPlus },
    { name: "Leads", path: "/app/leads", icon: MessageSquare },
    { name: "Relatórios", path: "/app/reports", icon: FileBarChart },
    { name: "Simulação", path: "/app/simulation", icon: Calculator },
    { name: "Integrações", path: "/app/integrations", icon: Share2 },
    { name: "Ajuda & Suporte", path: "/app/support", icon: HelpCircle },
    { name: "Configurações", path: "/app/settings", icon: Settings },
  ];

  // Filtro de navItems baseado no PIN ou cargo da subscrição (Retrocompatível)
  const normalizedRole = (role || 'master').toLowerCase();
  
  const filteredNavItems = navItems;

  const isAllowedPath = true;

  // Redirecionamento automático e blindagem ativa para Operadores Sênior e Júnior
  useEffect(() => {
    // Desativado: controle de operadores locais removido
    return;
  }, [location.pathname, activePinLevel, isPinVerified, appSettings.masterPin, appSettings.juniorPage, appSettings.seniorPages, navigate]);

  const showGlobalPinBlockerUI = false;
  const showDeviceLimitUI = false;

  // The main renderer should always call hooks in the same order.
  // We'll use conditional rendering in the return instead of early returns
  // to avoid Hook Order violations (Rules of Hooks).

  return (
    <>
      {subLoading ? (
        <div className="flex h-screen w-full items-center justify-center bg-[hsl(var(--background))]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : showGlobalPinBlockerUI ? (
        <div className="min-h-screen w-full flex items-center justify-center bg-stone-950 text-stone-100 p-4 font-sans relative overflow-hidden select-none">
          {/* Ambient background accents with brand-blue theme */}
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[30%] h-[50%] bg-sky-500/5 rounded-full blur-[150px] pointer-events-none" />

          <AnimatePresence mode="wait">
            {!selectedPinLevel ? (
              <motion.div 
                key="profile-select"
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -15 }}
                transition={{ duration: 0.3 }}
                className="relative w-full max-w-xl bg-stone-900/95 border border-stone-800 rounded-3xl p-5 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto max-h-[92vh] overflow-y-auto focus:outline-none"
              >
                <div className="flex flex-col items-center text-center">
                  {/* Logo */}
                  <div className="h-12 w-32 flex items-center justify-center mb-6">
                    <AlmoxProLogo className="h-full w-full object-contain" />
                  </div>

                  <div className="w-full text-center space-y-6">
                    <div>
                      <h3 className="font-sans text-xl font-black text-white tracking-tight uppercase">
                        Quem está operando agora?
                      </h3>
                      <p className="text-stone-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                        Escolha um perfil local do AlmoxPro da sua empresa para desbloquear e configurar o terminal de trabalho.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 pt-2">
                      <button 
                        onClick={() => {
                          setSelectedPinLevel("master");
                          setPinEntry("");
                          setPinError("");
                        }}
                        className="w-full p-4 rounded-2xl bg-stone-950/40 hover:bg-stone-850 border border-stone-850 hover:border-blue-500/50 text-left transition duration-200 cursor-pointer group flex items-start space-x-3.5 shadow-md"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20 transition-all">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 duration-100 group-hover:text-blue-400">
                            Operador Master
                            <span className="text-[9px] px-1.5 py-0.5 font-bold uppercase rounded bg-blue-500/10 text-blue-400">Dono</span>
                          </h4>
                          <p className="text-stone-400 text-[11px] leading-snug">
                            Controle integral de estoque, frotas, orçamentos e edição de níveis de acesso e PINs.
                          </p>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          setSelectedPinLevel("senior");
                          setPinEntry("");
                          setPinError("");
                        }}
                        className="w-full p-4 rounded-2xl bg-stone-950/40 hover:bg-stone-850 border border-stone-850 hover:border-sky-500/50 text-left transition duration-200 cursor-pointer group flex items-start space-x-3.5 shadow-md"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:bg-sky-500/20 transition-all">
                          <Key className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 duration-100 group-hover:text-sky-400">
                            Operador Sênior
                          </h4>
                          <p className="text-stone-400 text-[11px] leading-snug">
                            Acesso às abas operacionais específicas autorizadas previamente pelo Master.
                          </p>
                        </div>
                      </button>

                      <button 
                        onClick={() => {
                          setSelectedPinLevel("junior");
                          setPinEntry("");
                          setPinError("");
                        }}
                        className="w-full p-4 rounded-2xl bg-stone-950/40 hover:bg-stone-850 border border-stone-850 hover:border-cyan-500/50 text-left transition duration-200 cursor-pointer group flex items-start space-x-3.5 shadow-md"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500/20 transition-all">
                          <Car className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 duration-100 group-hover:text-cyan-400">
                            Operador Júnior
                          </h4>
                          <p className="text-stone-400 text-[11px] leading-snug">
                            Foco estrito em uma página específica do AlmoxPro delegada pelo Master (ex: Frota).
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
                      <p className="text-[10px] text-stone-500 italic">
                        Central de Segurança Local AlmoxPro
                      </p>
                      <button 
                        onClick={() => signOut(auth)}
                        className="text-[10px] font-bold uppercase text-[#e24b4a] hover:text-[#e24b4a] transition"
                      >
                        Sair da Conta 
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="pin-keypad"
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -15 }}
                transition={{ duration: 0.3 }}
                className="relative w-full max-w-xl bg-stone-900/95 border border-stone-800 rounded-3xl p-5 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto max-h-[92vh] overflow-y-auto focus:outline-none"
              >
                <div className="flex flex-col items-center">
                  {/* Logo */}
                  <div className="h-12 w-32 flex items-center justify-center mb-6">
                    <AlmoxProLogo className="h-full w-full object-contain" />
                  </div>

                  <div className="w-full space-y-6 text-center">
                    <div>
                      <span className={cn(
                        "inline-block px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-md mb-2.5 shadow-sm border",
                        selectedPinLevel === 'master' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : selectedPinLevel === 'senior' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      )}>
                        Operador {selectedPinLevel === 'master' ? 'Master' : selectedPinLevel === 'senior' ? 'Sênior' : 'Júnior'}
                      </span>
                      <h3 className="font-sans text-lg font-black text-white uppercase tracking-tight">
                        Digite seu PIN de Segurança
                      </h3>
                      <p className="text-stone-400 text-xs mt-1">
                        Insira o código numérico de acesso configurado pelo Administrador.
                      </p>
                    </div>

                    {/* Circles indicator */}
                    <div className="flex justify-center items-center space-x-3.5 py-3">
                      {Array.from({ length: 
                        selectedPinLevel === 'master' 
                          ? appSettings.masterPin.length 
                          : selectedPinLevel === 'senior' 
                            ? appSettings.seniorPin.length 
                            : appSettings.juniorPin?.length || 4
                      }).map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "h-4 w-4 rounded-full border transition-all duration-150",
                            pinEntry.length > i 
                              ? selectedPinLevel === 'master' 
                                ? "bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                                : selectedPinLevel === 'senior' 
                                  ? "bg-sky-500 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.6)]" 
                                  : "bg-cyan-500 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                              : "bg-stone-900 border-stone-800"
                          )}
                        />
                      ))}
                    </div>

                    {/* Error Banner */}
                    <div className="h-6 flex items-center justify-center text-center">
                      {pinError && (
                        <span className="text-[#e24b4a] font-black text-xs uppercase tracking-wider animate-pulse">
                          {pinError}
                        </span>
                      )}
                    </div>

                    {/* Keypad Grid (3x4) */}
                    <div className="max-w-[280px] mx-auto grid grid-cols-3 gap-3.5 justify-items-center">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                        <motion.button
                          key={num}
                          onClick={() => keyPressHandler(num)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-16 h-16 rounded-full bg-stone-950/60 hover:bg-stone-850 flex items-center justify-center font-bold text-lg border border-stone-800 hover:border-blue-500/40 cursor-pointer shadow-sm text-stone-200 hover:text-blue-400 transition-colors"
                        >
                          {num}
                        </motion.button>
                      ))}

                      <motion.button
                        onClick={() => {
                          const isSettingsAccess = location.pathname.startsWith("/app/settings");
                          if (isSettingsAccess) {
                            setSelectedPinLevel(null);
                            setPinEntry("");
                            setPinError("");
                            navigate("/app/dashboard");
                          } else {
                            setSelectedPinLevel(null);
                            setPinEntry("");
                            setPinError("");
                          }
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-[10px] font-black uppercase text-stone-400 hover:text-white hover:bg-stone-900/50 cursor-pointer transition-colors"
                      >
                        Voltar
                      </motion.button>

                      <motion.button
                        onClick={() => keyPressHandler("0")}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 rounded-full bg-stone-950/60 hover:bg-stone-850 flex items-center justify-center font-bold text-lg border border-stone-800 hover:border-blue-500/40 cursor-pointer shadow-sm text-stone-200 hover:text-blue-400 transition-colors"
                      >
                        0
                      </motion.button>

                      <motion.button
                        onClick={() => {
                          setPinEntry("");
                          setPinError("");
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-[10px] font-black uppercase text-stone-400 hover:text-white hover:bg-stone-900/50 cursor-pointer transition-colors"
                      >
                        Limpar
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : showDeviceLimitUI ? (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-stone-900 via-stone-950 to-neutral-900 text-stone-100 p-4 font-sans">
          <div className="relative w-full max-w-2xl bg-stone-900/90 border-2 border-primary/20 rounded-3xl p-8 md:p-10 shadow-[0_0_50px_rgba(var(--primary),0.1)] overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-stone-800">
              <div className="h-12 w-12 bg-primary/10 rounded-xl border border-primary/30 flex items-center justify-center animate-pulse">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-wider font-bold text-primary uppercase bg-primary/10 px-2.5 py-0.5 rounded-full">
                  POLICIAMENTO DE DISPOSITIVOS IP
                </span>
                <h1 className="text-2xl font-black tracking-tight text-white mt-1">Limite de Aparelhos Excedido</h1>
              </div>
            </div>

            <p className="text-sm text-stone-400 mb-6 leading-relaxed">
              O AlmoxPro possui um controle rígido de segurança para garantir o cumprimento das regras da plataforma. Cada empresa pode ter no máximo <strong className="text-primary font-bold">3 aparelhos ativos</strong> simultaneamente.
            </p>

            <div className="bg-stone-950/50 rounded-2xl p-4 border border-stone-850 mb-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Seu IP Atual:</span>
                <span className="font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-bold">{ipAddress || "Identificando..."}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 font-medium">Sua Conta:</span>
                <span className="font-bold text-stone-300">{user?.email}</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <Laptop className="h-4 w-4 text-primary" /> Dispositivos Sincronizados na Conta ({deviceList.length}/3)
              </h3>

              {loadingDevices ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {deviceList.map((dev) => {
                    const isCurrent = dev.ip === ipAddress;
                    return (
                      <div 
                        key={dev.ip} 
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between text-xs transition",
                          isCurrent 
                            ? "bg-primary/5 border-primary/25" 
                            : "bg-stone-950/40 border-stone-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Globe className={cn("h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-stone-600")} />
                          <div>
                            <p className="font-mono text-xs font-bold text-stone-200">
                              IP: {dev.ip} {isCurrent && <span className="text-primary font-mono text-[10px] bg-primary/15 px-1.5 py-0.5 rounded ml-1.5">ATUAL</span>}
                            </p>
                            <p className="text-[10px] text-stone-500 mt-1">
                              Usuário: {dev.userEmail} • Sincronia: {dev.lastActive ? new Date(dev.lastActive).toLocaleTimeString() : "Histórica"}
                            </p>
                          </div>
                        </div>

                        {/* Se for Master, oferece a opção de derrubar um dispositivo para liberar espaço */}
                        {(isMaster || normalizedRole === 'master') ? (
                          <button
                            onClick={() => handleRemoveDevice(dev.ip)}
                            className="px-2.5 py-1 bg-[#e24b4a]/10 hover:bg-[#e24b4a]/10 hover:text-white rounded text-[10px] font-bold text-[#e24b4a] transition-colors"
                          >
                            Revogar
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-stone-800">
              {(isMaster || normalizedRole === 'master') ? (
                <p className="text-[10px] text-stone-500 italic max-w-xs text-center sm:text-left">
                  Como administrador Master, você pode revogar acessos de aparelhos antigos acima para autorizar este dispositivo instantaneamente.
                </p>
              ) : (
                <p className="text-[10px] text-stone-500 italic max-w-xs text-center sm:text-left">
                  Entre em contato com o administrador Master da sua empresa para que ele revogue o acesso de um antigo IP.
                </p>
              )}
              
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto sm:ml-auto px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 border border-stone-700 hover:text-white transition"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-layout-screen bg-[hsl(var(--background))] overflow-hidden">
          {/* Mobile Backdrop */}
          {isMobileOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside 
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex flex-col bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] transition-all duration-300 ease-in-out md:static transform-gpu will-change-transform",
              isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
              isCollapsed && !isMobileOpen ? "md:w-20" : "md:w-64"
            )}
          >
            <div className={cn("h-16 flex items-center px-4 border-b border-[hsl(var(--border))]", isCollapsed && !isMobileOpen ? "justify-center" : "space-x-3")}>
              <div className={cn("flex-shrink-0 flex items-center justify-center overflow-hidden", isCollapsed && !isMobileOpen ? "h-10 w-10" : "h-9 w-9")}>
                {appSettings.avatarUrl ? (
                  <img src={appSettings.avatarUrl} alt="Logo" className="w-full h-full rounded-md object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <AlmoxProLogo className="w-full h-full" />
                )}
              </div>
              {(!isCollapsed || isMobileOpen) && <span className="font-bold text-lg tracking-tight shrink-0 uppercase">{appSettings.companyName}</span>}
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    title={isCollapsed && !isMobileOpen ? item.name : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-colors",
                      isCollapsed && !isMobileOpen ? "justify-center p-3" : "px-3 py-2.5 space-x-3",
                      isActive 
                        ? "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]" 
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.name}</span>}
                  </Link>
                )
              })}
              
              <div className="mt-auto pt-4">
                <div className="h-px bg-[hsl(var(--border))] mb-4" />
                <button
                  onClick={handleLogout}
                  title={isCollapsed && !isMobileOpen ? "Sair" : undefined}
                  className={cn(
                    "w-full flex items-center rounded-lg text-sm font-medium transition-colors",
                    isCollapsed && !isMobileOpen ? "justify-center p-3" : "px-3 py-2.5 space-x-3",
                    "text-[hsl(var(--muted-foreground))] hover:bg-destructive/10 hover:text-destructive"
                  )}
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                  {(!isCollapsed || isMobileOpen) && <span className="truncate text-left">Sair</span>}
                </button>
              </div>
            </div>
            
            <div className={cn("p-4 border-t border-[hsl(var(--border))] flex flex-col space-y-3", isCollapsed && !isMobileOpen ? "items-center px-2" : "")}>
              <div className={cn("flex items-center w-full justify-between")}>
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white font-medium text-xs flex-shrink-0 overflow-hidden relative">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : initials}
                  </div>
                  {(!isCollapsed || isMobileOpen) && (
                    <div className="flex flex-col truncate">
                      <span className="text-sm font-medium leading-none truncate flex items-center gap-1.5">
                        {displayName}
                        {isBypassed && <span className="h-1.5 w-1.5 rounded-full bg-[#378add]/10 animate-pulse shrink-0" />}
                      </span>
                      <span className="text-[10px] text-[#00d4ff] uppercase tracking-wider font-bold mt-0.5">
                        {isBypassed ? 'CONTA SUPREMA 👑' : (role || 'Master')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Seletor de operador do dispositivo logado */}
              {false && appSettings.masterPin && isPinVerified && (!isCollapsed || isMobileOpen) && (
                <div className="w-full text-xs bg-[hsl(var(--muted))]/85 border border-[hsl(var(--border))] px-3 py-2 rounded-xl flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-1.5 font-bold text-[10px]">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0",
                      activePinLevel === 'master' ? "bg-[#378add]/10 shadow-[0_0_8px_#378add]" : activePinLevel === 'senior' ? "bg-cyan-500 shadow-[0_0_8px_#06b6d4]" : "bg-[#4a7a9b]/10 shadow-[0_0_8px_#a855f7]"
                    )} />
                    <span className="uppercase text-[9px] text-[hsl(var(--muted-foreground))]">
                      Opr: <strong className="text-foreground">{activePinLevel === 'master' ? 'Master' : activePinLevel === 'senior' ? 'Sênior' : 'Júnior'}</strong>
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.removeItem("almox_active_pin_verified");
                      localStorage.removeItem("almox_active_pin_level");
                      localStorage.setItem("almox_device_locked_manually", "true");
                      sessionStorage.removeItem("almox_explicit_master_verified");
                      setActivePinLevel(null);
                      setIsPinVerified(false);
                      setSelectedPinLevel(null);
                      setPinEntry("");
                      setPinError("");
                      toast.success("Dispositivo bloqueado. Entre com outro PIN.");
                    }}
                    className="text-[9px] font-black uppercase text-[#e24b4a] hover:text-[#e24b4a] p-1 cursor-pointer flex items-center gap-1 shrink-0"
                    title="Trocar Operador / Bloquear dispositivo"
                  >
                    <Lock className="h-3 w-3 shrink-0" />
                    Sair PIN
                  </button>
                </div>
              )}

              {/* Seletor compacto se estiver colapsado */}
              {false && appSettings.masterPin && isPinVerified && isCollapsed && !isMobileOpen && (
                <button 
                  onClick={() => {
                    localStorage.removeItem("almox_active_pin_verified");
                    localStorage.removeItem("almox_active_pin_level");
                    localStorage.setItem("almox_device_locked_manually", "true");
                    sessionStorage.removeItem("almox_explicit_master_verified");
                    setActivePinLevel(null);
                    setIsPinVerified(false);
                    setSelectedPinLevel(null);
                    setPinEntry("");
                    setPinError("");
                    toast.success("Dispositivo bloqueado.");
                  }}
                  className="p-1.5 bg-[#e24b4a]/10 hover:bg-[#e24b4a]/10 hover:text-white rounded-lg text-[#e24b4a] transition cursor-pointer"
                  title="Bloquear / Trocar Operador"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex absolute -right-3 top-20 h-6 w-6 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-full items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors shadow-sm"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col h-layout-screen overflow-hidden w-full relative transform-gpu">
            {/* Decorative Background Elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] pointer-events-none z-0" />
            
            {/* Header */}
            <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 z-10">
              <div className="flex items-center gap-4">
                {/* Mobile Menu Button */}
                <button 
                  className="md:hidden p-2 -ml-2 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                  onClick={() => setIsMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                
                {/* Logo/Name on Mobile if space permits */}
                {isSearchOpen && (
                  <form onSubmit={handleGlobalSearch} className="flex md:hidden items-center animate-in fade-in slide-in-from-top-1 duration-200">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Pesquisar..." 
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      onBlur={() => {
                        if (!globalSearch) setIsSearchOpen(false);
                      }}
                      className="w-40 xs:w-48 h-9 px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    />
                  </form>
                )}
              </div>

              <form onSubmit={handleGlobalSearch} className="hidden sm:flex items-center w-48 md:w-64 relative">
                  <Search className="h-4 w-4 absolute left-3 text-[hsl(var(--muted-foreground))]" />
                  <input 
                    type="text" 
                    placeholder="Buscar no estoque..." 
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
                  />
                </form>
              
              <div className="flex items-center space-x-2 sm:space-x-4">
                <button 
                  className="relative p-2 rounded-full hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  title="Alternar Tema"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <button 
                  className="sm:hidden relative p-2 rounded-full hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))]"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-mobile-safe md:pb-8">
              {isAllowedPath ? children : (
                <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 bg-[#00d4ff]/10 border-2 border-[#00d4ff]/20 rounded-2xl flex items-center justify-center text-[#00d4ff] mb-6 shadow-lg shadow-[#00d4ff]/5">
                    <ShieldAlert className="h-8 w-8 animate-bounce" />
                  </div>
                  <h2 className="text-2xl font-black text-foreground tracking-tight">Área Restrita</h2>
                  <p className="text-zinc-500 max-w-md text-sm mt-2 leading-relaxed">
                    Desculpe, a seção que você está tentando acessar é restrita para contas com nível de acesso <strong className="text-primary font-bold uppercase">{role || 'Básico'}</strong>.
                  </p>
                  <p className="text-zinc-500 max-w-md text-xs mt-1">
                    Entre em contato com o gestor Master da sua empresa para reclassificar o seu nível.
                  </p>
                  <button 
                    onClick={() => navigate(normalizedRole === 'basic' ? '/app/inventory' : '/app/dashboard')}
                    className="mt-8 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_hsl(var(--primary))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] duration-100"
                  >
                    Voltar à Área Principal
                  </button>
                </div>
              )}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/75 backdrop-blur-xl border-t border-border/50 z-40 px-3 pb-safe shadow-[0_-8px_32px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between h-14">
                {[
                  { name: "Painel", path: "/app/dashboard", icon: LayoutDashboard },
                  { name: "Estoque", path: "/app/inventory", icon: Package },
                  { name: "Scanner", path: "/scan", icon: Camera, isScanner: true },
                  { name: "Equipe", path: "/app/employees", icon: IdCard },
                  { name: "Ajustes", path: "/app/settings", icon: Settings },
                ].filter(item => {
                  if (isMaster || normalizedRole === 'master') return true;
                  if (normalizedRole === 'basic') {
                    return ["/app/inventory", "/app/employees", "/app/settings", "/scan"].includes(item.path);
                  }
                  if (normalizedRole === 'medium') {
                    return ["/app/dashboard", "/app/inventory", "/app/employees", "/app/settings", "/scan"].includes(item.path);
                  }
                  return true;
                }).map((item) => {
                  const isActive = (location.pathname === item.path) || (item.path !== '/' && location.pathname.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={(e) => handleNavClick(e, item.path)}
                      className={cn(
                        "flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-90",
                        isActive ? "text-primary scale-105" : "text-muted-foreground"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center transition-all duration-300",
                        (item as any).isScanner 
                          ? "bg-primary text-white p-3 rounded-2xl -mt-6 shadow-lg shadow-primary/25 border-4 border-background w-14 h-14 ring-1 ring-primary/20" 
                          : "h-6 w-6"
                      )}>
                        <Icon className={cn((item as any).isScanner ? "h-7 w-7" : "h-5 w-5", isActive ? "stroke-[2.5]" : "stroke-[2]")} />
                      </div>
                      <span className={cn(
                        "text-[9px] uppercase tracking-widest font-black mt-1.5",
                        (item as any).isScanner ? "text-primary opacity-100" : "opacity-60"
                      )}>
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      )}

      {showPinSetupModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-stone-950/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="absolute top-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-sky-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-800 pb-5 mb-6">
              <div className="space-y-1">
                <div className="h-8 w-24 mb-1">
                  <AlmoxProLogo className="h-full object-contain" />
                </div>
                <h3 className="font-sans text-xl font-black text-white uppercase tracking-tight">
                  Assistente de Personalização & Segurança
                </h3>
                <p className="text-stone-400 text-xs">
                  A primeira configuração local do AlmoxPro ativa o nível MASTER de administração para o seu dispositivo.
                </p>
              </div>
              <span className="mt-3 md:mt-0 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-wider self-start md:self-auto">
                Modo Gestor Primário
              </span>
            </div>

            <form onSubmit={handleSaveInitialSetup} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* COL 1: IDENTIDADE DO WORKSPACE */}
                <div className="space-y-4">
                  <h4 className="text-stone-200 font-bold text-xs uppercase tracking-wider border-l-2 border-blue-500 pl-2.5">
                    Dados Corporativos
                  </h4>
                  
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      Nome da Empresa <small className="text-blue-400 font-bold">*</small>
                    </label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: AlmoxPro Logística Ltda"
                      value={setupCompanyName}
                      onChange={(e) => setSetupCompanyName(e.target.value)}
                      className="w-full text-xs bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-stone-100 rounded-lg h-10 px-3 focus:outline-none placeholder-stone-600 transition-all duration-150"
                    />
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      CNPJ da Unidade <small className="text-stone-500">(Opcional)</small>
                    </label>
                    <input 
                      type="text"
                      placeholder="Ex: 00.000.000/0001-00"
                      value={setupCnpj}
                      onChange={(e) => setSetupCnpj(e.target.value)}
                      className="w-full text-xs bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-stone-100 rounded-lg h-10 px-3 focus:outline-none placeholder-stone-600 transition-all duration-150"
                    />
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      Nome do Gestor Responsável <small className="text-stone-500">(Opcional)</small>
                    </label>
                    <input 
                      type="text"
                      placeholder="Ex: Esdras Gomes"
                      value={setupManagerName}
                      onChange={(e) => setSetupManagerName(e.target.value)}
                      className="w-full text-xs bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-stone-100 rounded-lg h-10 px-3 focus:outline-none placeholder-stone-600 transition-all duration-150"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                        E-mail Comercial
                      </label>
                      <input 
                        type="email"
                        placeholder="contato@empresa.com"
                        value={setupEmail}
                        onChange={(e) => setSetupEmail(e.target.value)}
                        className="w-full text-xs bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-stone-100 rounded-lg h-10 px-3 focus:outline-none placeholder-stone-600 transition-all duration-150"
                      />
                    </div>
                    <div className="space-y-1.5 font-sans">
                      <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                        Fone WhatsApp
                      </label>
                      <input 
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={setupPhone}
                        onChange={(e) => setSetupPhone(e.target.value)}
                        className="w-full text-xs bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-stone-100 rounded-lg h-10 px-3 focus:outline-none placeholder-stone-600 transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>

                {/* COL 2: PINS DE CONTROLE LOCAL */}
                <div className="space-y-4">
                  <h4 className="text-stone-200 font-bold text-xs uppercase tracking-wider border-l-2 border-blue-500 pl-2.5">
                    Segurança de Operadores (PINs)
                  </h4>
                  
                  <div className="p-3 bg-stone-950/50 rounded-xl border border-stone-800 text-[11px] text-stone-400 leading-relaxed space-y-1">
                    <p className="font-bold text-white text-xs flex items-center gap-1.5">🔐 Como funciona o compartilhamento local?</p>
                    <p>Qualquer operador que acessar sua conta no mesmo login (ou outros terminais) precisará digitar o seu PIN respectivo para ver as abas liberadas.</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* PIN MASTER */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      <div className="col-span-3">
                        <span className="text-xs font-black text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                          PIN Master <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1 py-0.2 rounded font-bold border border-blue-500/20">SUPREMO</span>
                        </span>
                        <p className="text-[10px] text-stone-500 leading-tight">Visualização de lucros, faturamento, relatórios e PINs.</p>
                      </div>
                      <input 
                        type="password"
                        required
                        maxLength={6}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Ex: 4433"
                        value={setupMasterPin}
                        onChange={(e) => setSetupMasterPin(e.target.value.replace(/\D/g, ''))}
                        className="col-span-2 text-center text-xs tracking-widest bg-stone-950 border border-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 text-blue-400 font-extrabold rounded-lg h-10 px-2 focus:outline-none placeholder-stone-700 transition"
                      />
                    </div>

                    {/* PIN SENIOR */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      <div className="col-span-3">
                        <span className="text-xs font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                          PIN Sênior <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1 py-0.2 rounded font-bold border border-sky-500/25">SUPERVISÃO</span>
                        </span>
                        <p className="text-[10px] text-stone-500 leading-tight">Painéis e operações gerais configuradas na aba Defasada.</p>
                      </div>
                      <input 
                        type="password"
                        required
                        maxLength={6}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Ex: 5544"
                        value={setupSeniorPin}
                        onChange={(e) => setSetupSeniorPin(e.target.value.replace(/\D/g, ''))}
                        className="col-span-2 text-center text-xs tracking-widest bg-stone-950 border border-stone-800 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10 text-sky-400 font-extrabold rounded-lg h-10 px-2 focus:outline-none placeholder-stone-700 transition"
                      />
                    </div>

                    {/* PIN JUNIOR */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      <div className="col-span-3">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                          PIN Júnior <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1 py-0.2 rounded font-bold border border-cyan-500/25">ÚNICA ABA</span>
                        </span>
                        <p className="text-[10px] text-stone-500 leading-tight">Operador operacional isolado em uma única ferramenta (ex: Frota).</p>
                      </div>
                      <input 
                        type="password"
                        required
                        maxLength={6}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Ex: 6655"
                        value={setupJuniorPin}
                        onChange={(e) => setSetupJuniorPin(e.target.value.replace(/\D/g, ''))}
                        className="col-span-2 text-center text-xs tracking-widest bg-stone-950 border border-stone-800 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 text-cyan-400 font-extrabold rounded-lg h-10 px-2 focus:outline-none placeholder-stone-700 transition"
                      />
                    </div>
                  </div>

                </div>
              </div>

              <div className="pt-5 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[10px] text-stone-500 max-w-md leading-relaxed text-center sm:text-left">
                  Ao clicar em Ativar, as configurações serão sincronizadas na sua organização de banco de dados do Google Cloud Firestore.
                </p>
                <motion.button
                  type="submit"
                  disabled={isSavingSetup}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider relative group overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingSetup ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      Ativar e Iniciar AlmoxPro
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AgentChat />

      {alertaModal && (
        <AlertaEstoqueModal
          alertas={alertaModal.alertas}
          mensagem={alertaModal.mensagem}
          onClose={() => setAlertaModal(null)}
        />
      )}
    </>
  );
}
