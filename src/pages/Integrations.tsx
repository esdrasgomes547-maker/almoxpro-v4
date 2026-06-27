import { useState, useEffect } from "react";
import { Share2, Mail, FileSpreadsheet, HardDrive, CheckCircle2, Loader2, ExternalLink, RefreshCw, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { googleConnect, googleDisconnect, initGoogleAuth } from "../lib/google-auth";
import { googleWorkspace } from "../lib/google-api";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";

export function Integrations() {
  const { orgId } = useOrganization();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, _token) => {
        setIsConnected(true);
        setUserEmail(user.email);
      },
      () => {
        setIsConnected(false);
        setUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const handleConnect = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    setIsConnecting(true);
    try {
      const result = await googleConnect();
      if (result) {
        setIsConnected(true);
        setUserEmail(result.user.email);
        toast.success("Conectado ao Google Workspace com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao conectar: " + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await googleDisconnect();
    setIsConnected(false);
    setUserEmail(null);
    toast.info("Desconectado do Google Workspace");
  };

  const exportInventoryToSheets = async () => {
    if (localStorage.getItem('isDemoMode') === 'true') {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId) return;
    setIsActionLoading("sheets");
    try {
      const snapshot = await getDocs(query(collection(db, `organizations/${orgId}/inventory`), limit(100)));
      const inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const spreadsheet = await googleWorkspace.createInventorySpreadsheet(
        `AlmoxPro - Estoque ${new Date().toLocaleDateString()}`,
        inventory
      );
      
      toast.success("Planilha criada com sucesso!");
      window.open(`https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`, '_blank');
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao exportar: " + err.message);
    } finally {
      setIsActionLoading(null);
    }
  };

  const integrations = [
    {
      id: "gmail",
      name: "Gmail",
      description: "Envie e-mails de orçamentos, pedidos de compra e notificações diretamente pelo AlmoxPro.",
      icon: Mail,
      color: "bg-red-500/10 text-red-500",
      scopes: ["gmail.modify"],
      status: isConnected ? "Ativo" : "Pendente"
    },
    {
      id: "sheets",
      name: "Google Sheets",
      description: "Exporte inventários, relatórios e listas de fornecedores para planilhas colaborativas.",
      icon: FileSpreadsheet,
      color: "bg-green-500/10 text-green-500",
      scopes: ["spreadsheets"],
      status: isConnected ? "Ativo" : "Pendente"
    },
    {
      id: "drive",
      name: "Google Drive",
      description: "Armazene PDFs de notas fiscais, fotos de produtos e documentos técnicos na nuvem.",
      icon: HardDrive,
      color: "bg-blue-500/10 text-blue-500",
      scopes: ["drive.file"],
      status: isConnected ? "Ativo" : "Pendente"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none mb-2">
            Integrações <span className="text-primary italic">Workspace</span>
          </h1>
          <p className="text-muted-foreground font-medium max-w-xl">
            Conecte o AlmoxPro ao ecossistema Google para automatizar sua logística e comunicação industrial.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">{userEmail}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-[10px] uppercase font-black tracking-widest h-8 rounded-lg">
                Desconectar
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[10px] h-12 px-8 rounded-xl shadow-xl shadow-primary/20 flex items-center gap-3 transition-all hover:scale-105"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Conectar Google Workspace
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {integrations.map((app) => (
          <Card key={app.id} className="border-border/60 bg-card/40 backdrop-blur-sm hover:border-primary/30 transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-24 h-24 ${app.color.split(' ')[0]} opacity-5 rounded-bl-full -mr-8 -mt-8`} />
            
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className={`h-12 w-12 ${app.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <app.icon className="h-6 w-6" />
                </div>
                <Badge variant={isConnected ? "default" : "secondary"} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
                  {app.status}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold uppercase italic tracking-tight">{app.name}</CardTitle>
              <CardDescription className="text-xs font-medium leading-relaxed min-h-[40px]">
                {app.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {app.scopes.map(scope => (
                  <span key={scope} className="text-[9px] font-black uppercase tracking-widest bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    {scope}
                  </span>
                ))}
              </div>
              
              <div className="pt-4 border-t border-border/40">
                {app.id === "sheets" ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-10 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all disabled:opacity-50"
                    disabled={!isConnected || isActionLoading === "sheets"}
                    onClick={exportInventoryToSheets}
                  >
                    {isActionLoading === "sheets" ? (
                      <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                    ) : (
                      <>
                        Exportar Estoque
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </>
                    )}
                  </Button>
                ) : app.id === "gmail" ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-10 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-50 cursor-not-allowed"
                    disabled
                  >
                    Enviar Notificação
                    <Send className="h-3 w-3 opacity-50" />
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-10 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-50 cursor-not-allowed"
                    disabled
                  >
                    Criar Backup
                    <Plus className="h-3 w-3 opacity-50" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="p-8 bg-primary/[0.03] border border-primary/10 rounded-3xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Share2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold uppercase italic tracking-tight">Próximos Passos</h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Expansion & AI Integration</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-bold flex items-center gap-2">
              <span className="h-2 w-2 bg-primary rounded-full" />
              Sincronização com Google Calendar
            </h4>
            <p className="text-sm text-muted-foreground">
              Agende manutenções industriais e receba alertas de prazos de entrega diretamente no seu calendário logístico.
            </p>
            <Button variant="link" className="p-0 h-auto text-xs font-bold uppercase tracking-widest text-primary opacity-50 cursor-not-allowed">Em breve</Button>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold flex items-center gap-2">
              <span className="h-2 w-2 bg-primary rounded-full" />
              Automação de Pedidos via Gmail
            </h4>
            <p className="text-sm text-muted-foreground">
              Assim que o estoque atingir o nível mínimo, um rascunho de pedido de compra será gerado automaticamente para o fornecedor.
            </p>
            <Button variant="link" className="p-0 h-auto text-xs font-bold uppercase tracking-widest text-primary opacity-50 cursor-not-allowed">Em breve</Button>
          </div>
        </div>
      </section>
      
      {!isConnected && (
        <div className="text-center py-12 border-2 border-dashed border-border/40 rounded-3xl">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold">Segurança e Privacidade</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
            O AlmoxPro utiliza tokens de acesso em memória que são destruídos ao fechar a sessão. Suas credenciais nunca são armazenadas em nossos servidores.
          </p>
        </div>
      )}
    </div>
  );
}
