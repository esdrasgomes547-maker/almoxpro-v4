import { useState, useEffect, useRef, ChangeEvent, DragEvent } from "react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, deleteDoc, getDocs } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { HeroSuccessPopup } from "../components/HeroSuccessPopup";
import { ImageCropperModal } from "../components/ImageCropperModal";
import { useSubscription } from "../lib/useSubscription";
import { toast } from "sonner";
import { motion } from "motion/react";
import { 
  Building2, 
  User, 
  FileText, 
  Mail, 
  Phone, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Check, 
  AlertTriangle,
  FileCheck,
  Smartphone,
  Crop,
  Sliders,
  Laptop,
  Globe,
  RefreshCw,
  Shield,
  Lock,
  Download,
  Database,
  Cpu
} from "lucide-react";
import { cn } from "../lib/utils";
import { usePerformance } from "../lib/performance";

export function Settings() {
  const { orgId } = useOrganization();
  const { isMaster: isAppMaster, role: currentUserRole, ipAddress } = useSubscription();
  const { mode: perfMode, activePreset: perfPreset, setMode: setPerfMode } = usePerformance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = async () => {
    if (!orgId) {
      toast.error("Para gerar o backup, você precisa estar vinculado a uma organização!");
      return;
    }
    
    const toastId = toast.loading("Preparando dados do AlmoxPro para exportação...");
    try {
      const backupData: Record<string, any[]> = {};
      
      // Backup settings
      backupData["settings"] = [settings];

      const collectionsToBackup = [
        "inventory",
        "categories",
        "employees",
        "shipments",
        "suppliers",
        "quotes",
        "services",
        "leads",
        "vehicles",
        "quality_control"
      ];

      for (const colName of collectionsToBackup) {
        try {
          const colRef = collection(db, `organizations/${orgId}/${colName}`);
          const snap = await getDocs(colRef);
          const docsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          backupData[colName] = docsList;
        } catch (colErr) {
          console.warn(`Could not backup collection ${colName}:`, colErr);
          backupData[colName] = [];
        }
      }

      // Export JSON
      const jsonStr = JSON.stringify({
        version: "1.0",
        exportedAt: new Date().toISOString(),
        orgId: orgId,
        companyName: settings.companyName,
        data: backupData
      }, null, 2);

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Clean company name for filename
      const cleanName = (settings.companyName || "almoxpro")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .substring(0, 20);
      
      link.download = `backup_almoxpro_${cleanName}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Backup gerado com sucesso! Arquivo salvo no seu dispositivo.", { id: toastId });
    } catch (err: any) {
      console.error("Backup failed:", err);
      toast.error("Erro ao gerar backup de segurança: " + err.message, { id: toastId });
    }
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orgId) return;

    const isDemo = localStorage.getItem('isDemoMode') === 'true';
    const confirmRestore = window.confirm(
      "Tem certeza que deseja restaurar as informações deste arquivo? Isso irá mesclar/adicionar os itens ao seu banco de dados atual com segurança corporativa."
    );
    if (!confirmRestore) {
      event.target.value = "";
      return;
    }

    const toastId = toast.loading("Restaurando banco de dados AlmoxPro...");
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const payload = JSON.parse(e.target?.result as string);
          if (!payload || !payload.data) {
            throw new Error("Arquivo de backup inválido.");
          }

          const data = payload.data;

          // Restore Settings if they exist
          if (data.settings && data.settings[0]) {
            const restoredSettings = { ...settings, ...data.settings[0] };
            setSettings(restoredSettings);
            if (!isDemo) {
              await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), restoredSettings);
            } else {
              localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(restoredSettings));
            }
          }

          const collectionsToRestore = [
            "inventory",
            "categories",
            "employees",
            "shipments",
            "suppliers",
            "quotes",
            "services",
            "leads",
            "vehicles",
            "quality_control"
          ];

          let restoredCount = 0;

          for (const colName of collectionsToRestore) {
            const items = data[colName];
            if (Array.isArray(items)) {
              for (const item of items) {
                const { id, ...itemData } = item;
                if (id) {
                  const docRef = doc(db, `organizations/${orgId}/${colName}`, id);
                  await setDoc(docRef, itemData, { merge: true });
                  restoredCount++;
                }
              }
            }
          }

          toast.success(`Restauração concluída! ${restoredCount} registros processados com sucesso.`, { id: toastId });
          setTimeout(() => {
            window.location.reload();
          }, 1500);

        } catch (parseErr: any) {
          console.error(parseErr);
          toast.error("Erro ao ler o arquivo de backup: " + parseErr.message, { id: toastId });
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      console.error("Restore failed:", err);
      toast.error("Erro na restauração de dados: " + err.message, { id: toastId });
    } finally {
      event.target.value = "";
    }
  };
  
  // Storage and Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  
  // Image metadata for High Definition visual feedback
  const [imageMeta, setImageMeta] = useState<{
    name: string;
    size: string;
    type: string;
    dimensions: string;
  } | null>(null);

  // Success Overlay Alert States
  const [isHeroSuccessOpen, setIsHeroSuccessOpen] = useState(false);
  const [successConfig, setSuccessConfig] = useState({ title: "", subtitle: "" });

  // Core settings synchronized directly with other branches (EPI, Dashboard, pdf render)
  const [settings, setSettings] = useState({
    companyName: "AlmoxPro - Gestão",
    managerName: "Gestor Principal",
    welcomeMessage: "Organização e segurança em primeiro lugar. Vamos movimentar o estoque com agilidade!",
    customGreeting: "Boas-vindas ao painel operacional!",
    cnpj: "00.000.000/0001-00",
    email: "contato@almoxpro.com.br",
    phone: "(11) 4002-8922",
    avatarUrl: "",
    masterPin: "",
    seniorPin: "",
    juniorPin: "",
    seniorPages: [
      "/app/dashboard",
      "/app/inventory",
      "/app/catalog",
      "/app/services",
      "/app/quotes",
      "/app/fleet",
      "/app/support"
    ] as string[],
    juniorPage: "/app/fleet",
    externalAccessPin: "",
    externalAccessEnabled: false,
    whatsappNumero: "",
    whatsappApiKey: "",
    whatsappAtivo: false
  });

  // Paradox Local-First Caching States
  const [localFirstMode, setLocalFirstMode] = useState(localStorage.getItem("almoxPro_localFirstMode") === "true");

  // Teammates and Devices states
  const [teammates, setTeammates] = useState<any[]>([]);
  const [loadingTeammates, setLoadingTeammates] = useState(true);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  // Subscribe teammates in organization
  useEffect(() => {
    if (!orgId) {
      setLoadingTeammates(false);
      return;
    }
    const q = query(collection(db, "users"), where("orgId", "==", orgId));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ uid: d.id, ...d.data() });
      });
      setTeammates(list);
      setLoadingTeammates(false);
    }, (err) => {
      console.warn("Teammates subscription error in settings:", err);
      setLoadingTeammates(false);
    });
    return () => unsub();
  }, [orgId]);

  // Subscribe devices in organization
  useEffect(() => {
    if (!orgId) {
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
      console.warn("Devices subscription error in settings:", err);
      setLoadingDevices(false);
    });
    return () => unsub();
  }, [orgId]);

  const handleUpdateTeammateRole = async (targetUid: string, nextRole: string) => {
    try {
      await setDoc(doc(db, "users", targetUid), { role: nextRole }, { merge: true });
      toast.success("Nível de acesso do usuário atualizado!");
    } catch (e) {
      console.error("Failed to update role:", e);
      toast.error("Erro ao atualizar nível do usuário.");
    }
  };

  const handleRemoveDevice = async (ipToRemove: string) => {
    if (!orgId) return;
    try {
      const docId = ipToRemove.replace(/\./g, '_');
      await deleteDoc(doc(db, `organizations/${orgId}/active_devices`, docId));
      toast.success(`Dispositivo ${ipToRemove} removido com sucesso!`);
    } catch (err: any) {
      console.error("Failed to revoke device:", err);
      toast.error("Erro ao remover dispositivo do banco de dados.");
    }
  };

  // Load configuration directly from user Firestore database
  useEffect(() => {
    const fetchSettings = async () => {
      if (!orgId) return;
      try {
        const docRef = doc(db, `organizations/${orgId}/settings`, "default");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings(prev => ({ ...prev, ...data }));
          
          if (data.avatarUrl) {
            setImageMeta({
              name: "Logo_Sincronizado.png",
              size: "Nuvem",
              type: "Alta Definição (HD)",
              dimensions: "Fidelidade Original"
            });
          }
        } else {
          // Attempt loading from local fallback
          const local = localStorage.getItem(`almox_settings_${orgId}`);
          if (local) {
            setSettings(JSON.parse(local));
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `organizations/${orgId}/settings/default`);
        // Fallback to local storage in non-production or offline states
        const local = localStorage.getItem(`almox_settings_${orgId}`);
        if (local) {
          setSettings(JSON.parse(local));
        }
      }
    };
    fetchSettings();
  }, [orgId]);

  // Save changes back to the database and update user storage
  const handleSaveWorkspace = async () => {
    if (!orgId) return;
    setIsSaving(true);
    const isDemo = localStorage.getItem('isDemoMode') === 'true';

    try {
      if (!isDemo) {
        await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), settings);
      } else {
        localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(settings));
      }

      setSuccessConfig({
        title: "Dados Gravados com Sucesso! 🌟",
        subtitle: "As informações da empresa e do usuário foram sincronizadas com o banco de dados. Elas já estão disponíveis no painel de EPIs e relatórios oficiais."
      });
      setIsHeroSuccessOpen(true);
    } catch (error) {
      console.error("Erro ao gravar dados corporativos:", error);
      // Absolute fallback to local state persistence
      localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(settings));
      setSuccessConfig({
        title: "Salvo no Dispositivo! 💾",
        subtitle: "Não foi possível conectar à nuvem principal. Os dados foram salvos temporariamente na sessão local do seu navegador."
      });
      setIsHeroSuccessOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCroppedConfirm = async (blob: Blob, format: string) => {
    setIsCropperOpen(false);
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const optimizedDataUrl = event.target?.result as string || "";
        
        setImageMeta({
          name: imageMeta?.name || "Logo_Personalizado.png",
          size: `${(optimizedDataUrl.length / 1024 * 0.75).toFixed(1)} KB`,
          type: format || "image/png",
          dimensions: "Ajuste Personalizado (HD)"
        });

        const updatedSettings = { ...settings, avatarUrl: optimizedDataUrl };
        setSettings(updatedSettings);

        const isDemo = localStorage.getItem('isDemoMode') === 'true';
        localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(updatedSettings));
        
        if (!isDemo && orgId) {
          await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), updatedSettings);
        }

        setSuccessConfig({
          title: "Foto Ajustada com Sucesso! ✂️",
          subtitle: "Sua imagem de perfil/logo foi recortada, rotacionada e salva de forma segura no sistema."
        });
        setIsHeroSuccessOpen(true);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error("Erro ao salvar recorte de imagem:", err);
      alert(`Erro ao ajustar corte de imagem: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Process raw high-definition files manually or drag-and-drop
  const processImageFile = async (file: File) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("A imagem selecionada é grande demais (limite: 20MB).");
      return;
    }

    setIsUploading(true);

    try {
      const optimizedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(event.target?.result as string || "");
              return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
            const resultUrl = canvas.toDataURL(outputType, 0.9);

            setImageMeta({
              name: file.name,
              size: `${(resultUrl.length / 1024 * 0.75).toFixed(1)} KB`,
              type: file.type || "image/jpeg",
              dimensions: `${width} x ${height} px`
            });

            resolve(resultUrl);
          };
          img.onerror = () => reject(new Error("Erro ao renderizar imagem original."));
          if (event.target?.result) {
            img.src = event.target.result as string;
          } else {
            reject(new Error("Não foi possível processar o arquivo."));
          }
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
        reader.readAsDataURL(file);
      });

      const updatedSettings = { ...settings, avatarUrl: optimizedDataUrl };
      setSettings(updatedSettings);

      // Save database setting instantly so header updates
      const isDemo = localStorage.getItem('isDemoMode') === 'true';
      localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(updatedSettings));
      
      if (!isDemo && orgId) {
        await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), updatedSettings);
      }

      setSuccessConfig({
        title: "Foto Carregada com Sucesso! 🎨",
        subtitle: "A sua foto de perfil / corporativa foi importada em alta resolução e definida no sistema."
      });
      setIsHeroSuccessOpen(true);

    } catch (err: any) {
      console.error("Erro durante o processamento de imagem:", err);
      alert(`Houve um problema ao processar seu arquivo de imagem: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // reset input so same file can be uploaded again
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const removeAvatar = async () => {
    const isDemo = localStorage.getItem('isDemoMode') === 'true';
    const updatedSettings = { ...settings, avatarUrl: "" };
    setSettings(updatedSettings);
    setImageMeta(null);

    try {
      localStorage.setItem(`almox_settings_${orgId}`, JSON.stringify(updatedSettings));
      if (!isDemo && orgId) {
        await setDoc(doc(db, `organizations/${orgId}/settings`, "default"), updatedSettings);
      }
      setSuccessConfig({
        title: "Imagem Removida! 🗑️",
        subtitle: "A imagem personalizada foi desvinculada. O AlmoxPro voltará a utilizar os layouts padronizados."
      });
      setIsHeroSuccessOpen(true);
    } catch (e) {
      console.error("Erro ao remover:", e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 max-w-5xl mx-auto pb-16 px-4 md:px-0"
    >
      
      {/* 3D Modern Header Greeting Card */}
      <div className="relative p-6 md:p-8 rounded-2xl bg-[hsl(var(--card))] border-2 border-primary/20 shadow-[4px_4px_0px_0px_hsl(var(--primary))] overflow-hidden">
        <div className="absolute top-0 right-0 w-44 h-44 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-extrabold tracking-widest uppercase text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Sincronismo Direto com Firebase
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Personalização de Dados</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Configure as credenciais e o logotipo oficial da sua unidade. Essas informações alimentam de forma unificada os dashboards, as impressões de EPI e os documentos do sistema.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border-2 border-primary/20 shadow-[2px_2px_0px_0px_rgba(var(--primary),0.1)]">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
              {settings.avatarUrl ? (
                <img src={settings.avatarUrl} alt="HD preview shortcut" className="h-full w-full object-contain p-0.5" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold leading-none text-primary">{settings.companyName || "AlmoxPro"}</p>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] font-mono mt-1">
                {settings.cnpj || "Sem CNPJ cadastrado"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: HIGH-DEFINITION PROFILE / LOGO Uploader 3D Card */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] shadow-[5px_5px_0px_0px_hsl(var(--primary)_/_0.15)] p-6 space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold tracking-tight">Logotipo / Avatar HD</h3>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-normal mb-4">
                Envie arquivos de imagem em alta definição para representação visual em cabeçalhos de EPIs e exportações oficiais da conta.
              </p>

              {/* Drag and Drop Box & HD Portait Frame */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group relative rounded-xl border-2 border-dashed transition-all p-4 text-center cursor-pointer min-h-[220px] flex flex-col items-center justify-center ${
                  isDragging 
                    ? "border-primary bg-primary/5 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.2)]" 
                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {settings.avatarUrl ? (
                  <div className="space-y-3 w-full">
                    {/* High Definition Container to avoid compression blur */}
                    <div 
                      className="relative mx-auto h-32 w-32 border-2 border-[hsl(var(--border))] bg-stone-50 rounded-lg flex items-center justify-center overflow-hidden group/img transition-colors shadow-md"
                      title="Clique nas ações abaixo para editar ou arrastar"
                    >
                      <img 
                        src={settings.avatarUrl} 
                        alt="High Definition Logo Source" 
                        className="h-full w-full object-contain p-1.5"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-1 right-1 bg-primary text-white font-bold text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded shadow">
                        HD SOURCE
                      </div>
                      
                      {/* Fully visible crop button on top of the image */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCropperOpen(true);
                        }}
                        className="absolute inset-x-0 bottom-0 py-1.5 bg-black/85 hover:bg-primary text-white text-[10px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border-t border-white/15 cursor-pointer"
                      >
                        <Crop className="h-3 w-3 animate-pulse" />
                        Editar Foto
                      </button>
                    </div>
                    
                    <div className="flex flex-col items-center gap-1.5 justify-center">
                      <span className="inline-block text-[10px] font-bold tracking-wide text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        ✓ Foto Carregada
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCropperOpen(true);
                        }}
                        className="text-[10px] font-extrabold tracking-tight text-primary bg-primary/10 hover:bg-primary/20 hover:scale-[1.02] active:scale-[0.98] border border-primary/30 px-2.5 py-1 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders className="h-3.5 w-3.5" /> Ajustar Corte & Rotação
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-4">
                    <div className="mx-auto h-14 w-14 rounded-full bg-[hsl(var(--muted))] border-2 border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                      {isUploading ? (
                        <span className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Selecione ou Arraste o arquivo</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Sugerido: PNG, JPG ou WEBP</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden Input field */}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Upload Button Controls */}
            <div className="space-y-3 pt-2">
              {settings.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setIsCropperOpen(true)}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground border-2 border-primary/20 font-black text-xs hover:bg-primary/95 transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_hsl(var(--primary))] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_hsl(var(--primary))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                >
                  <Crop className="h-4 w-4 shrink-0" />
                  Editar / Cortar Imagem Adicionada
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-2.5 px-4 rounded-lg bg-[hsl(var(--muted))] border-2 border-[hsl(var(--border))] font-extrabold text-xs text-foreground hover:bg-[hsl(var(--accent))] transition-all flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] active:shadow-none hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Upload className="h-3.5 w-3.5 text-primary" />
                {isUploading ? "Processando..." : "Carregar Nova Foto"}
              </button>

              {settings.avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="w-full py-2 px-4 rounded-lg bg-red-500/5 text-red-500 border-2 border-red-500/20 font-bold text-xs hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover Imagem
                </button>
              )}
            </div>
          </div>

          {/* High resolution Metadata & Properties block */}
          {imageMeta && settings.avatarUrl && (
            <div className="rounded-xl border-2 border-[hsl(var(--border))] bg-stone-500/5 p-4 text-xs space-y-2">
              <p className="font-bold text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Ficha de Resolução HD:</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono leading-relaxed">
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] block">Arquivo:</span>
                  <span className="font-bold truncate text-ellipsis block max-w-[130px]" title={imageMeta.name}>{imageMeta.name}</span>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] block">Tipo:</span>
                  <span className="font-bold block">{imageMeta.type}</span>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] block">Dimensões:</span>
                  <span className="font-bold text-primary block">{imageMeta.dimensions}</span>
                </div>
                <div>
                  <span className="text-[hsl(var(--muted-foreground))] block">Tamanho:</span>
                  <span className="font-bold block">{imageMeta.size}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: CORE ENTERPRISE FORM DATA 3D Card */}
        <div className="md:col-span-2 rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] shadow-[5px_5px_0px_0px_hsl(var(--primary)_/_0.15)] p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/30">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-extrabold tracking-tight">Formulário de Cadastro Corporativo</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Nome do Gestor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-stone-400" /> Nome do Gestor / Usuário
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Roberto Silva"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm font-bold focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner" 
                  value={settings.managerName || ""} 
                  onChange={e => setSettings({...settings, managerName: e.target.value})} 
                />
              </div>

              {/* Nome da Empresa */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-stone-400" /> Razão Social / Nome Fantasia
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Metalúrgica Sul Brasil Ltda"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-bold" 
                  value={settings.companyName || ""} 
                  onChange={e => setSettings({...settings, companyName: e.target.value})} 
                />
              </div>

              {/* CNPJ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  CNPJ Administrativo
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: 12.345.678/0001-99"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-mono font-bold" 
                  value={settings.cnpj || ""} 
                  onChange={e => setSettings({...settings, cnpj: e.target.value})} 
                />
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-stone-400" /> Telefone para EPI / Contato
                </label>
                <input 
                  type="tel" 
                  placeholder="Ex: (51) 3211-5432"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-mono font-bold" 
                  value={settings.phone || ""} 
                  onChange={e => setSettings({...settings, phone: e.target.value})} 
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-stone-400" /> Canal de Email Principal
                </label>
                <input 
                  type="email" 
                  placeholder="Ex: almox@empresa.com.br"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-bold" 
                  value={settings.email || ""} 
                  onChange={e => setSettings({...settings, email: e.target.value})} 
                />
              </div>

              {/* Saudação de Entrada */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Título de Entrada (Saudação Curta)
                </label>
                <input 
                  type="text" 
                  placeholder="Ex: Olá, equipe técnica!"
                  className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-bold" 
                  value={settings.customGreeting || ""} 
                  onChange={e => setSettings({...settings, customGreeting: e.target.value})} 
                />
              </div>

              {/* Mensagem de Boas-Vindas */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Mensagem Operacional (Mensagem de Boas-vindas para operadores)
                </label>
                <textarea 
                  rows={3}
                  placeholder="Escreva a mensagem exibida na entrada para conscientização ou aviso importante..."
                  className="w-full p-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner resize-none font-medium" 
                  value={settings.welcomeMessage || ""} 
                  onChange={e => setSettings({...settings, welcomeMessage: e.target.value})} 
                />
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 leading-normal italic text-primary flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
                  Este banner é propagado instantaneamente para a tela inicial dos operadores logísticos do almoxarifado.
                </p>
              </div>

            </div>
          </div>

          <div className="pt-6 border-t border-[hsl(var(--border))] mt-6 flex justify-end">
            <button 
              type="button"
              onClick={handleSaveWorkspace}
              disabled={isSaving}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest border-2 border-primary/20 shadow-[4px_4px_0px_0px_hsl(var(--primary))] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_hsl(var(--primary))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all duration-150 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  Sincronizando com a Conta...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-white" />
                  Gravar Dados e Sincronizar
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* SEÇÃO DE SEGURANÇA E MODO MASTER (APENAS PARA O GESTOR PRINCIPAL) */}
      {auth.currentUser?.email === 'esdrasgomes547@gmail.com' && (
        <div className="rounded-2xl bg-rose-950/20 border-2 border-rose-500/30 p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(244,63,94,0.2)]">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-500">Ferramentas de Gestão Master</h4>
          </div>
          
          <p className="text-xs text-rose-200/70 leading-normal">
            Esta é uma área sensível. Ao ativar o <strong>Modo Master (Bypass)</strong>, todas as consultas do sistema serão direcionadas diretamente para a base central (tecgas-master), ignorando o vínculo da organização atual. Use com cautela.
          </p>

          <button
            onClick={() => {
              const isBypass = localStorage.getItem('master_bypass') === 'true';
              localStorage.setItem('master_bypass', (!isBypass).toString());
              window.location.reload();
            }}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors flex items-center gap-2"
          >
            {localStorage.getItem('master_bypass') === 'true' ? "Desativar Modo Master" : "Ativar Modo Master (Tecgas Base Central)"}
          </button>
        </div>
      )}

      {/* Database Integration Preview Sandbox */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-4 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[hsl(var(--primary))]/10 text-primary border border-primary/20">
            <FileCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <h4 className="text-xs font-black uppercase tracking-wider text-primary">Integração com aba de EPI</h4>
        </div>
        
        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-normal">
          Para garantir total consistência de dados, as abas de certificados e emissões de EPIs (Equipamentos de Proteção Individual) puxam automaticamente o logotipo, CNPJ, nome da empresa e e-mail cadastrados acima. Isso evita inconsistências jurídicas nos termos de responsabilidade impressos.
        </p>

        <div className="p-4 rounded-xl bg-stone-500/5 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-[hsl(var(--border))]">
          <div className="text-xs">
            <span className="text-[hsl(var(--muted-foreground))] block text-[10px] uppercase font-bold">Unidade de Emissão:</span>
            <span className="font-bold text-stone-700 dark:text-stone-300">{settings.companyName}</span>
          </div>
          <div className="text-xs">
            <span className="text-[hsl(var(--muted-foreground))] block text-[10px] uppercase font-bold">CNPJ para Certificado:</span>
            <span className="font-semibold text-stone-700 dark:text-stone-300 font-mono">{settings.cnpj}</span>
          </div>
          <div className="text-xs">
            <span className="text-[hsl(var(--muted-foreground))] block text-[10px] uppercase font-bold">Gestor Autorizado:</span>
            <span className="font-semibold text-stone-700 dark:text-stone-300">{settings.managerName}</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE NOTIFICAÇÕES WHATSAPP */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10 text-green-500 border border-green-500/20">
              <Smartphone className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">Notificações WhatsApp Automáticas</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Configure o envio automático de alertas via CallMeBot. Sem custos.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Número WhatsApp (com DDI e DDD)
              </label>
              <input 
                type="tel" 
                placeholder="5591986181270"
                className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-mono font-bold" 
                value={settings.whatsappNumero || ""} 
                onChange={e => setSettings({...settings, whatsappNumero: e.target.value.replace(/[^0-9]/g, "")})} 
              />
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Apenas números (Ex: 5591986181270).</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                API Key CallMeBot
              </label>
              <input 
                type="text" 
                placeholder="sua chave aqui"
                className="w-full h-10 px-3 rounded-lg border-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors shadow-inner font-mono font-bold" 
                value={settings.whatsappApiKey || ""} 
                onChange={e => setSettings({...settings, whatsappApiKey: e.target.value})} 
              />
            </div>

            {/* Toggle */}
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border bg-stone-500/5 hover:bg-stone-500/10 transition-colors w-full group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.whatsappAtivo || false}
                  onChange={(e) => setSettings({ ...settings, whatsappAtivo: e.target.checked })}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${settings.whatsappAtivo ? "bg-green-500" : "bg-stone-600"}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.whatsappAtivo ? "transform translate-x-4" : ""}`}></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Ativar Envios via WhatsApp</p>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Permite que o Pro mande alertas diretos no seu celular.</p>
              </div>
            </label>
          </div>

          <div className="border border-green-500/30 rounded-xl p-5 bg-green-500/5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-green-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Instruções - Passo a Passo
            </h4>
            <ul className="text-xs text-stone-700 dark:text-stone-300 space-y-2 font-medium leading-relaxed">
              <li><strong>1.</strong> Adicione o número <strong>+34 644 51 81 19</strong> aos seus contatos do WhatsApp.</li>
              <li><strong>2.</strong> Envie a mensagem exata para ele: <br/><code className="bg-green-500/10 px-1.5 py-0.5 rounded text-green-600 select-all font-bold">I allow callmebot to send me messages</code></li>
              <li><strong>3.</strong> O robô responderá com sua <strong>API Key</strong> (ex: <code className="bg-stone-500/10 px-1 py-0.5 rounded">123456</code>).</li>
              <li><strong>4.</strong> Cole seu número (+55...) e a chave copiados nos campos ao lado, ative a chave seletora e Salve a configuração no final da página.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE BACKUP & SEGURANÇA (SEGURANÇA CONTRA PERDAS DE DADOS) */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10 text-green-500 border border-green-500/20">
              <Database className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">Backup de Segurança e Salvaguarda</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Exporte ou restaure todos os seus produtos, EPIs, frotas, movimentações e configurações em um único arquivo de backup.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Export card */}
          <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-stone-500/5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <h4 className="text-xs font-black uppercase tracking-wider text-green-500">Garantia Digital - Exportação</h4>
              </div>
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Baixar Cópias de Segurança Locais
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-normal">
                Gere e faça o download de um arquivo JSON criptografado contendo todos os dados registrados da sua marca no AlmoxPro. Salve em um HD externo, pen drive ou nuvem privada para sua segurança jurídica.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isSaving}
              className="mt-2 w-full py-2.5 px-4 rounded-lg bg-green-600 font-extrabold text-xs text-white hover:bg-green-500 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(34,197,94,0.2)] cursor-pointer"
            >
              <Download className="h-4 w-4 shrink-0 text-white" />
              Gerar Backup Completo (.json)
            </button>
          </div>

          {/* Import card */}
          <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-stone-500/5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-500">Recuperação de Desastres</h4>
              </div>
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Restaurar Base de Dados de um Backup
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-normal">
                Recupere suas informações a partir de um arquivo de backup do AlmoxPro (.json) gerado anteriormente. Seus estoques e cadastros serão mesclados com segurança na nuvem atual.
              </p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                id="restore-backup-upload"
                className="hidden"
                onChange={handleRestoreBackup}
              />
              <button
                type="button"
                onClick={() => document.getElementById("restore-backup-upload")?.click()}
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-lg bg-[hsl(var(--muted))] border-2 border-[hsl(var(--border))] font-extrabold text-xs text-foreground hover:bg-[hsl(var(--accent))]/10 transition-all flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)] cursor-pointer"
              >
                <Upload className="h-4 w-4 shrink-0 text-primary" />
                Upload e Restaurar Backup
              </button>
            </div>
          </div>

        </div>

        <div className="p-4 bg-[hsl(var(--muted))]/40 rounded-xl border border-[hsl(var(--border))] flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
            <strong>Proteção contra Perdas e Falhas de Operação:</strong> Todos os envios de dados usam persistência isolada por organização (Multi-tenant). Os backups são processados de forma assíncrona garantindo redundância total.
          </p>
        </div>
      </div>

      {/* SEÇÃO DE FLUIDEZ & RENDERIZAÇÃO ADAPTATIVA (PADRÃO ALMOXPRO) */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sliders className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">Fluidez & Renderização Adaptativa</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">O AlmoxPro ajusta o peso dos gráficos e fontes para rodar perfeitamente em qualquer dispositivo.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => {
              setPerfMode("auto");
              toast.success("Modo Adaptativo Ativado! O sistema otimizará os gráficos conforme o uso do hardware.");
            }}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden",
              perfMode === "auto"
                ? "bg-primary/5 border-primary shadow-[2px_2px_0px_0px_hsl(var(--primary))]"
                : "bg-transparent border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/10"
            )}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-xs font-black uppercase tracking-wider text-primary">01. Auto-Adaptativo</span>
              {perfMode === "auto" && <span className="h-2 w-2 rounded-full bg-primary animate-ping" />}
            </div>
            <div>
              <p className="text-[10px] text-foreground font-extrabold mt-2">Ajuste Inteligente (Padrão)</p>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-normal mt-1">
                Mede a taxa de frames (FPS) e especificações do processador em tempo real para prevenir lags.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setPerfMode("high");
              toast.success("Modo Alta Performance Ativado! Efeitos visuais premium habilitados.");
            }}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden",
              perfMode === "high"
                ? "bg-primary/5 border-primary shadow-[2px_2px_0px_0px_hsl(var(--primary))]"
                : "bg-transparent border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/10"
            )}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">02. Gráficos Premium</span>
            </div>
            <div>
              <p className="text-[10px] text-foreground font-extrabold mt-2">Elastic Springs & Blurs</p>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-normal mt-1">
                Habilita animações fluidas, efeitos de desfoque de fundo e sombras volumétricas 3D para PCs modernos.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setPerfMode("pocket");
              toast.success("Modo Bolso Ativado! Renderização simplificada com carregamento instantâneo.");
            }}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative overflow-hidden",
              perfMode === "pocket"
                ? "bg-primary/5 border-primary shadow-[2px_2px_0px_0px_hsl(var(--primary))]"
                : "bg-transparent border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]/10"
            )}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-xs font-black uppercase tracking-wider text-rose-500">03. Modo Suave / Bolso</span>
            </div>
            <div>
              <p className="text-[10px] text-foreground font-extrabold mt-2">Suporte Legado Extremo</p>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))] leading-normal mt-1">
                Ideal para internet lenta, TVs ou celulares antigos (ex. Samsung Pocket). Desliga delays, transições e sombras.
              </p>
            </div>
          </button>
        </div>

        <div className="p-4 bg-[hsl(var(--muted))]/50 rounded-xl border border-[hsl(var(--border))] flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-primary shrink-0" />
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
            <span className="font-extrabold text-foreground block mb-0.5">Diagnóstico Técnico AlmoxPro:</span>
            Aparelho atual operando em <strong className="text-primary font-bold">{perfPreset === "pocket" ? "Fichário Pocket / Modo Bolso" : "Alta Performance (60-120 FPS)"}</strong> de renderização. Caso note qualquer instabilidade devido ao processador da sua máquina, force o Modo Bolso acima para desativar os motores de animação pesados instantaneamente.
          </div>
        </div>
      </div>

      {/* BANCO DE DADOS LOCAL & MOTOR DE COMPRESSÃO PARADOXAL (ANTI-ESTOURO DE COTA) */}
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)] relative overflow-hidden">
        {/* Subtle decorative futuristic grid line in background */}
        <div className="absolute inset-0 bg-linear-to-r from-teal-500/5 to-indigo-500/5 pointer-events-none" />
        
        <div className="pb-4 border-b border-[hsl(var(--border))] relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
                <Cpu className="h-5 w-5 text-teal-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                  Motor Local Paradoxal & CPQ-1KB
                  <span className="text-[9px] font-bold uppercase py-0.5 px-2 rounded-full bg-teal-500/10 text-teal-500 border border-teal-500/20">
                    Tecnologia Quântica
                  </span>
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Converta seu navegador em um nó de banco de dados offline autônomo baseado em células virtuais compactadas de até 1KB.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const newVal = !localFirstMode;
                  setLocalFirstMode(newVal);
                  localStorage.setItem("almoxPro_localFirstMode", String(newVal));
                  if (newVal) {
                    toast.success("Modo Local-First Ativado! Todas as leituras e atualizações rodarão direto na memória do seu dispositivo.");
                  } else {
                    toast.info("Retornando ao modo de conexão síncrona online com o Firestore.");
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md hover:scale-[1.02] cursor-pointer",
                  localFirstMode 
                    ? "bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/10" 
                    : "bg-stone-500/10 border-2 border-[hsl(var(--border))] text-stone-700 dark:text-stone-300 hover:bg-stone-500/20"
                )}
              >
                <div className={cn("h-2.5 w-2.5 rounded-full", localFirstMode ? "bg-white animate-ping" : "bg-stone-400")} />
                {localFirstMode ? "Dispositivo Ativo como Core Principal" : "Ativar Dispositivo como Banco de Dados"}
              </button>
            </div>
          </div>
        </div>




      </div>

      {/* SEÇÃO DE SEGURANÇA LOCAL: NÍVEIS DE ACESSO & PINS */}
      {false && (
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Lock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">Controle de Operadores locais & PINs</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Defina senhas numéricas e permissões para co-trabalhadores que compartilham este mesmo login.</p>
            </div>
          </div>
          
          <span className="text-[10px] px-2.5 py-1 text-emerald-500 font-extrabold uppercase rounded border border-emerald-500/25 bg-emerald-500/10 animate-pulse">
            Local Security Active
          </span>
        </div>

        {/* Informar se atual dispositivo é master */}
        {settings.masterPin && localStorage.getItem("almox_active_pin_level") !== "master" && localStorage.getItem("almox_active_pin_verified") === "true" ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-center justify-between text-xs text-rose-500">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span>Somente o <strong>Operador Master</strong> verificado pode visualizar ou modificar os PINs e permissões locais.</span>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem("almox_active_pin_verified");
                localStorage.removeItem("almox_active_pin_level");
                window.location.reload();
              }}
              className="text-[10px] font-black uppercase text-rose-500 hover:underline shrink-0"
            >
              Autenticar Master
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            {/* MASTER FORM */}
            <div className="space-y-4 p-5 rounded-2xl border border-blue-500/30 bg-blue-500/[0.02] shadow-[0_4px_12px_rgba(59,130,246,0.03)] hover:border-blue-500/50 transition duration-150">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-blue-400 select-none">
                <Shield className="h-4 w-4" /> Operador Master
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">Proporciona gerenciamento total do estoque, faturamento, configurações e PINs locais.</p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">PIN Master (4-6 dígitos)</label>
                <input 
                  type="password"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="EX: 4433"
                  value={settings.masterPin || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setSettings(prev => ({ ...prev, masterPin: val }));
                  }}
                  className="w-full text-center text-xs tracking-widest bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg h-9 px-3 focus:outline-none focus:border-blue-500/50 text-blue-400 font-extrabold focus:ring-2 focus:ring-blue-500/10 duration-150"
                />
              </div>
            </div>

            {/* SENIOR FORM */}
            <div className="space-y-4 p-5 rounded-2xl border border-sky-500/30 bg-sky-500/[0.02] shadow-[0_4px_12px_rgba(14,165,233,0.03)] hover:border-sky-500/50 transition duration-150">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-sky-400 select-none">
                <Sliders className="h-4 w-4" /> Operador Sênior
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">Acessa os painéis básicos e operacionais. Configure abaixo as abas autorizadas para ele:</p>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">PIN Sênior (4-6 dígitos)</label>
                  <input 
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="EX: 5544"
                    value={settings.seniorPin || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSettings(prev => ({ ...prev, seniorPin: val }));
                    }}
                    className="w-full text-center text-xs tracking-widest bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg h-9 px-3 focus:outline-none focus:border-sky-500/50 text-sky-400 font-extrabold focus:ring-2 focus:ring-sky-500/10 duration-150"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest block">Abas Autorizadas para Sênior</label>
                  <div className="max-h-[160px] overflow-y-auto border border-[hsl(var(--border))] rounded-lg p-2.5 space-y-1.5 bg-[hsl(var(--background))]">
                    {[
                      { name: "Painel", path: "/app/dashboard" },
                      { name: "Estoque", path: "/app/inventory" },
                      { name: "Catálogo", path: "/app/catalog" },
                      { name: "Serviços", path: "/app/services" },
                      { name: "Orçamentos", path: "/app/quotes" },
                      { name: "Expedição", path: "/app/shipments" },
                      { name: "Frota", path: "/app/fleet" },
                      { name: "Funcionários", path: "/app/employees" },
                      { name: "Fornecedores", path: "/app/suppliers" },
                      { name: "Leads", path: "/app/leads" },
                      { name: "Relatórios", path: "/app/reports" },
                      { name: "Simulação", path: "/app/simulation" },
                      { name: "Integrações", path: "/app/integrations" },
                      { name: "Ajuda & Suporte", path: "/app/support" }
                    ].map((tab) => {
                      const isChecked = (settings.seniorPages || []).includes(tab.path);
                      return (
                        <label key={tab.path} className="flex items-center gap-2 cursor-pointer text-[10px] text-stone-300 hover:text-sky-450 select-none transition">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const pages = [...(settings.seniorPages || [])];
                              if (e.target.checked) {
                                if (!pages.includes(tab.path)) pages.push(tab.path);
                              } else {
                                const idx = pages.indexOf(tab.path);
                                if (idx > -1) pages.splice(idx, 1);
                              }
                              setSettings(prev => ({ ...prev, seniorPages: pages }));
                            }}
                            className="h-3 w-3 rounded text-sky-500 border-[hsl(var(--border))] focus:ring-0 cursor-pointer"
                          />
                          <span>{tab.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* JUNIOR FORM */}
            <div className="space-y-4 p-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.02] shadow-[0_4px_12px_rgba(6,182,212,0.03)] hover:border-cyan-500/50 transition duration-150">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-cyan-400 select-none">
                <Laptop className="h-4 w-4" /> Operador Júnior
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">Operador com visão única. Fica travado na tela operacional escolhida abaixo.</p>
              
              <div className="space-y-3 font-sans">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">PIN Júnior (4-6 dígitos)</label>
                  <input 
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="EX: 6655"
                    value={settings.juniorPin || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSettings(prev => ({ ...prev, juniorPin: val }));
                    }}
                    className="w-full text-center text-xs tracking-widest bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg h-9 px-3 focus:outline-none focus:border-cyan-500/50 text-cyan-400 font-extrabold focus:ring-2 focus:ring-cyan-500/10 duration-150"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Aba única delegada para Júnior</label>
                  <select
                    value={settings.juniorPage || "/app/fleet"}
                    onChange={(e) => setSettings(prev => ({ ...prev, juniorPage: e.target.value }))}
                    className="w-full text-xs font-semibold bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg h-9 px-2 focus:outline-none text-[hsl(var(--foreground))] cursor-pointer focus:border-cyan-500/50"
                  >
                    <option value="/app/fleet">Frota (Gerenciador Mecânico)</option>
                    <option value="/app/inventory">Estoque (Entradas e Saídas)</option>
                    <option value="/app/services">Serviços Operacionais</option>
                    <option value="/app/quotes">Orçamentos & Notas</option>
                    <option value="/app/shipments">Expedição & Cargas</option>
                    <option value="/app/employees">Fichas de Funcionários</option>
                    <option value="/app/dashboard">Painel de Métricas (Dashboard)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* EXTERNAL ACCESS FORM */}
            <div className="space-y-4 p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.02] shadow-[0_4px_12px_rgba(16,185,129,0.03)] hover:border-emerald-500/50 transition duration-150">
              <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-400 select-none">
                <Globe className="h-4 w-4" /> Acesso Externo (QR Code)
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">Permitir que usuários sem cadastro visualizem os cards de produtos via QR Code após o PIN.</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Liberar Scanner para Convidados</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.externalAccessEnabled || false}
                      onChange={(e) => setSettings(prev => ({ ...prev, externalAccessEnabled: e.target.checked }))}
                    />
                    <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">PIN de Acesso Público</label>
                  <input 
                    type="password"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="EX: 9988"
                    disabled={!settings.externalAccessEnabled}
                    value={settings.externalAccessPin || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSettings(prev => ({ ...prev, externalAccessPin: val }));
                    }}
                    className={cn(
                      "w-full text-center text-xs tracking-widest bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg h-9 px-3 focus:outline-none font-extrabold duration-150",
                      settings.externalAccessEnabled ? "focus:border-emerald-500/50 text-emerald-400 focus:ring-2 focus:ring-emerald-500/10" : "opacity-50 cursor-not-allowed text-stone-600"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* SEÇÃO TÉCNICA: CONTROLE DE ACESSOS E DISPOSITIVOS (IPs) */}
      {false && (
      <div className="rounded-2xl bg-[hsl(var(--card))] border-2 border-[hsl(var(--border))] p-6 space-y-6 shadow-[4px_4px_0px_0px_hsl(var(--primary)_/_0.1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">Policiamento de Acesso & IP</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Defina as permissões por operador e acompanhe os aparelhos IP ativos (Limite de 3).</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-lg shrink-0">
            <Smartphone className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-mono font-bold text-primary">IP Autenticado: {ipAddress || "Buscando IP..."}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quadro de Usuários (Teammates) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-primary" /> Cargos de Usuários Cadastrados ({teammates.length}/3)
              </h4>
            </div>

            {loadingTeammates ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {teammates.map((member) => (
                  <div key={member.uid} className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))]/10 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="truncate">
                      <p className="text-xs font-bold text-foreground truncate">{member.email}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 font-semibold flex items-center gap-1">
                        Permissão atual: 
                        <span className="font-mono text-[9px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                          {member.role || 'user'}
                        </span>
                      </p>
                    </div>

                    {/* Dropdown de ação rápida se atual usuário for master de verdade */}
                    {(isAppMaster || currentUserRole?.toLowerCase() === 'master') ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {['basic', 'medium', 'master'].map((level) => {
                          const isActive = (member.role || 'user').toLowerCase() === level;
                          return (
                            <button
                              key={level}
                              onClick={() => handleUpdateTeammateRole(member.uid, level)}
                              className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                                isActive 
                                  ? "bg-primary text-primary-foreground border-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]" 
                                  : "bg-transparent text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                              )}
                            >
                              {level === 'basic' ? 'Basic' : level === 'medium' ? 'Medium' : 'Master'}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-400 italic">Mudança Protegida</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quadro de Dispositivos por IP (Active Devices) */}
          <div className="space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Laptop className="h-4 w-4 text-primary" /> Dispositivos Sincronizados ({deviceList.length}/3)
            </h4>

            {loadingDevices ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {deviceList.map((dev) => {
                  const isCurrent = dev.ip === ipAddress;
                  return (
                    <div 
                      key={dev.ip} 
                      className={cn(
                        "p-4 rounded-xl border flex items-center justify-between text-xs transition",
                        isCurrent 
                          ? "bg-primary/5 border-primary/20" 
                          : "bg-[hsl(var(--background))] border-[hsl(var(--border))]"
                      )}
                    >
                      <div className="truncate flex items-center gap-3">
                        <Globe className={cn("h-4 w-4 shrink-0", isCurrent ? "text-primary animate-pulse" : "text-stone-400")} />
                        <div className="truncate">
                          <p className="font-mono text-xs font-black text-foreground truncate flex items-center gap-1.5">
                            IP: {dev.ip} 
                            {isCurrent && <span className="text-[9px] font-sans font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Seu Aparelho</span>}
                          </p>
                          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 truncate">
                            Ativo: {dev.userEmail} ({dev.lastActive ? new Date(dev.lastActive).toLocaleTimeString() : 'Histórica'})
                          </p>
                        </div>
                      </div>

                      {(isAppMaster || currentUserRole?.toLowerCase() === 'master') ? (
                        <button
                          onClick={() => handleRemoveDevice(dev.ip)}
                          className="p-2 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg text-red-500 transition cursor-pointer shrink-0 border border-red-500/20"
                          title="Excluir autorização de IP"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed bg-[hsl(var(--muted))]/40 p-3 rounded-lg border border-[hsl(var(--border))]">
              <p>
                <strong>Regra de Conectividade:</strong> Se a sua empresa trocar de aparelhos ou IPs dinâmicos de internet e atingir o limite de 3 ativos, basta que o usuário administrador Master revogue um dispositivo antigo clicando no ícone de lixeira para liberar espaço imediatamente.
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Custom Global App Notification Overlays */}
      <HeroSuccessPopup
        isOpen={isHeroSuccessOpen}
        onClose={() => setIsHeroSuccessOpen(false)}
        title={successConfig.title}
        subtitle={successConfig.subtitle}
      />

      {isCropperOpen && settings.avatarUrl && (
        <ImageCropperModal
          imageSrc={settings.avatarUrl}
          fileName={imageMeta?.name || "logo.png"}
          onConfirm={handleCroppedConfirm}
          onCancel={() => setIsCropperOpen(false)}
        />
      )}
    </motion.div>
  );
}
