import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  MessageSquare, 
  Mail, 
  BookOpen, 
  Play, 
  CheckCircle2, 
  Package, 
  Truck, 
  Building,
  Phone,
  Copy,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Calculator,
  ChevronDown,
  Monitor,
  Cpu,
  Bookmark,
  Smartphone,
  Check,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface TutorialStep {
  title: string;
  description: string;
  module: string;
  badge: string;
  tips: string[];
}

export function Support() {
  const [activeTab, setActiveTab] = useState<"tutorial" | "contact">("tutorial");
  const [activeTourStep, setActiveTourStep] = useState<number>(-1);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  
  // Interactive Sandbox Simulator State
  const [simulatedModule, setSimulatedModule] = useState<"dash" | "estoque" | "orcamento" | "frota">("dash");
  const [simulatedActionMessage, setSimulatedActionMessage] = useState<string>("Clique nas opções ao lado para ver as animações e o funcionamento prático de cada módulo.");
  const [suportMessageText, setSuportMessageText] = useState("");

  const contactEmail = "Esdrasgomes547@gmail.com";
  const formattedWhatsAppUrl = `https://wa.me/5591986181270?text=${encodeURIComponent(
    suportMessageText 
      ? `Olá Esdras, ${suportMessageText} (Enviado via Almox Pro Support)`
      : "Olá Esdras, gostaria de suporte técnico na plataforma Almox Pro!"
  )}`;

  const copyEmailToClipboard = () => {
    navigator.clipboard.writeText(contactEmail);
    toast.success("E-mail copiado para a área de transferência!");
  };

  const tourSteps: TutorialStep[] = [
    {
      module: "Dashboard",
      badge: "Início",
      title: "1. Analisando o Painel Principal",
      description: "O Dashboard reúne os dados mais importantes sobre a sua operação em tempo real. Você pode visualizar o valor total do estoque, veículos ativos, alertas de produtos críticos e as últimas atividades.",
      tips: [
        "Verifique a seção 'Atenção e Alertas de Reabastecimento' para saber quais produtos precisam de reposição urgente.",
        "Clique em qualquer log da seção 'Histórico de Atividades Recentes' para navegar diretamente à página correspondente filtrada automaticamente."
      ]
    },
    {
      module: "Estoque",
      badge: "Estoque",
      title: "2. Gerenciando Produtos e Ativos",
      description: "No módulo de Estoque, você pode catalogar seus produtos, agrupá-los por categorias customizáveis e rastrear as movimentações de entrada e saída.",
      tips: [
        "Crie categorias primeiro (ex: Tubos, Conexões, EPIs) para organizar melhor seus produtos.",
        "Use o botão 'Nova movimentação' (Entrada/Saída) para ajustar com precisão o saldo e manter o histórico atualizado.",
        "Aproveite a inteligência artificial para ler planilhas na aba 'Importar Estoque' e povoar o sistema instantaneamente."
      ]
    },
    {
      module: "Orçamentos",
      badge: "Orçamentos",
      title: "3. Emitindo e Compartilhando Orçamentos",
      description: "Crie orçamentos avançados em segundos combinando produtos cadastrados e custos de mão de obra (Serviços) de forma unificada.",
      tips: [
        "Preencha os dados do cliente e avance pelas abas intuitivas (Cliente -> Itens -> Resumo).",
        "Você pode compartilhar o orçamento diretamente no WhatsApp do cliente com um clique ou exportar o PDF oficial de alta qualidade."
      ]
    },
    {
      module: "Frota",
      badge: "Frota & Expedição",
      title: "4. Controlando a Frota e Viagens",
      description: "Gerencie o cadastro de veículos e motoristas, planeje rotas/expedições e notifique motoristas no WhatsApp sobre manutenções ou entregas.",
      tips: [
        "Registre manutenções preventivas para cada veículo informando o tipo de serviço executado.",
        "Verifique o status de cada frete e mude o progresso (Pendente, Em Trânsito, Concluído) em tempo real."
      ]
    }
  ];

  const faqItems = [
    {
      question: "Como faço para cadastrar um novo produto no estoque?",
      answer: "Acesse o menu 'Estoque', selecione a aba correspondente e clique no botão '+ Novo Produto'. Preencha os detalhes como estoque mínimo, quantidade inicial, localização física no almoxarifado e imagens. O sistema calculará de forma automática a saúde de reabastecimento."
    },
    {
      question: "Consigo importar dados de planilhas Excel?",
      answer: "Sim! Na barra superior do menu Estoque existe o botão 'Importar Estoque'. Você faz o upload estruturado da planilha, e nossa IA inteligente ajuda a mapear cada coluna (Nome, Categoria, Saldo, Código) para integrar instantaneamente."
    },
    {
      question: "Os orçamentos dão baixa automaticamente da quantidade do estoque?",
      answer: "Não por padrão para evitar fraudes ou baixas acidentais! A emissão de orçamentos serve para validação comercial de custos. Para abater produtos, você realiza uma 'Saída' registrando o motivo específico ou confirma a expedição técnica no módulo correspondente."
    },
    {
      question: "Como funciona a sincronização com o WhatsApp no Almox Pro?",
      answer: "Tanto nos módulos de Orçamentos, Leads quanto de Frota, o Almox Pro gera conexões inteligentes. Ele cria mensagens profissionais formatadas instantaneamente para serem disparadas com um único toque, sem necessidade de integrações caras e burocráticas."
    },
    {
      question: "O sistema funciona em celulares e tablets?",
      answer: "Sim! O Almox Pro foi desenvolvido sob medida para ser totalmente responsivo. Ele possui uma elegante e confortável barra flutuante semitransparente na parte inferior de dispositivos móveis para que a navegação no depósito ou no canteiro de obras seja extremamente fluida."
    }
  ];

  // Animation constants with explicit transition safe variants
  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { 
        duration: 0.4, 
        ease: "easeOut"
      } 
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 px-4">
      {/* Dynamic Ambient Background Glow Elements */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-1/2 right-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* Premium Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden bg-gradient-to-br from-card/70 via-card/40 to-muted/20 border border-border/60 p-8 sm:p-10 rounded-3xl backdrop-blur-md shadow-xl"
      >
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px] opacity-70 pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="space-y-4 max-w-2xl text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))] bg-primary/10 border border-primary/20 rounded-full">
              <Sparkles className="h-3 w-3 text-primary animate-spin" style={{ animationDuration: '4s' }} /> LevTheDev Company
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
              Central de Treinamento <br />
              <span className="text-[hsl(var(--primary))] font-black tracking-wide drop-shadow-[0_2px_10px_rgba(59,130,246,0.15)]">Almox Pro</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Descubra como dominar todos os recursos do Almox Pro. Tire dúvidas operacionais, conheça dicas de eficiência e entre em contato direto com a engenharia de software do seu projeto.
            </p>
            
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <Button 
                onClick={() => setActiveTourStep(0)} 
                className="w-full sm:w-auto px-6 h-12 shadow-lg shadow-primary/20 transition-all hover:scale-[1.03] active:scale-[0.97] inline-flex items-center gap-2 font-semibold text-sm"
              >
                <Play className="h-4 w-4 fill-current animate-pulse" /> Iniciar Apresentação Interativa
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setActiveTab("contact");
                  setTimeout(() => {
                    const container = document.querySelector('main');
                    const target = document.getElementById('contact');
                    if (container && target) {
                      const containerRect = container.getBoundingClientRect();
                      const targetRect = target.getBoundingClientRect();
                      const scrollOffset = targetRect.top - containerRect.top + container.scrollTop - 24;
                      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                    } else {
                      target?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }, 150);
                }}
                className="w-full sm:w-auto px-6 h-12 border-border/80 hover:bg-muted text-sm font-semibold"
              >
                <MessageSquare className="h-4 w-4 mr-1 text-primary" /> Falar com o Suporte
              </Button>
            </div>
          </div>

          {/* Isometric Floating Elements Mockup Presentation */}
          <div className="relative w-72 h-44 sm:w-80 sm:h-52 hidden lg:block select-none transform hover:rotate-2 hover:scale-105 transition-all duration-500">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl" />
            <div className="absolute top-0 left-0 right-0 bottom-0 bg-card border border-primary/25 rounded-2xl shadow-2xl p-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/55 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <span className="text-[10px] font-mono opacity-40">almoxpro.live</span>
              </div>
              <div className="space-y-2">
                <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-12 w-full bg-accent/30 rounded-lg flex items-center justify-between px-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <div className="space-y-1">
                      <div className="h-2 w-16 bg-muted rounded" />
                      <div className="h-2 w-24 bg-muted/60 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-10 bg-emerald-500/20 text-emerald-500 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 flex-1 bg-muted rounded" />
                  <div className="h-8 w-12 bg-primary/20 rounded-md" />
                </div>
              </div>
            </div>
            
            {/* Overlay float elements */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -top-6 -right-4 bg-emerald-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 border border-emerald-400/50"
            >
              <TrendingUp className="h-3 w-3" /> Orçamento Emitido!
            </motion.div>

            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }}
              className="absolute -bottom-4 -left-6 bg-amber-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 border border-amber-400/50"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Estoque Crítico
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Tabs Controller Block */}
      <div className="flex justify-center">
        <div className="flex bg-muted/50 p-1.5 rounded-2xl border border-border/60 shadow-inner w-full sm:max-w-md">
          <button
            onClick={() => setActiveTab("tutorial")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all relative ${
              activeTab === "tutorial" ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === "tutorial" && (
              <motion.div 
                layoutId="activeTabGlow" 
                className="absolute inset-0 bg-primary rounded-xl shadow-lg shadow-primary/10" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Guia & Treinamento
            </span>
          </button>
          <button
            onClick={() => setActiveTab("contact")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all relative ${
              activeTab === "contact" ? "text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {activeTab === "contact" && (
              <motion.div 
                layoutId="activeTabGlow" 
                className="absolute inset-0 bg-primary rounded-xl shadow-lg shadow-primary/10" 
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Suporte LevTheDev
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "tutorial" ? (
          <motion.div
            key="tutorialTab"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-12"
          >
            {/* Live Interactive Simulator Console / Hero Section */}
            <motion.div variants={itemVariants} className="bg-card/45 border border-border/50 rounded-3xl overflow-hidden shadow-md">
              <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-lg text-foreground">Simulador AlmoxPro Live</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Clique nas abas para experimentar micro-simulações de fluxos reais do sistema.</p>
                </div>
                
                {/* Control Toggles */}
                <div className="flex flex-wrap gap-1.5">
                  {(["dash", "estoque", "orcamento", "frota"] as const).map((m) => {
                    const label = m === "dash" ? "Painel" : m === "estoque" ? "Estoque" : m === "orcamento" ? "Orçamento" : "Frota";
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          setSimulatedModule(m);
                          if (m === "dash") {
                            setSimulatedActionMessage("O Painel agrega atalhos rápidos e alertas. Experimente clicar em 'Nova Expedição' ou ver relatórios mensais no sistema original!");
                          } else if (m === "estoque") {
                            setSimulatedActionMessage("O módulo de Estoque permite adicionar produtos e gerenciar entradas ou saídas em tempo real para controle auditado.");
                          } else if (m === "orcamento") {
                            setSimulatedActionMessage("O Orçamento permite somar produtos e serviços de forma interativa e formatar no formato PDF ou fita de impressão.");
                          } else if (m === "frota") {
                            setSimulatedActionMessage("Gerencie frotas, manutenções por veículo e dispare rotas interativas para o celular dos seus motoristas!");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                          simulatedModule === m 
                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                            : "bg-background/80 hover:bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 sm:p-8 min-h-[300px]">
                {/* Simulator Visual Preview Side */}
                <div className="md:col-span-3 flex flex-col justify-between space-y-4 border border-border/40 bg-background/50 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 bg-primary/10 rounded-bl-xl text-[10px] font-mono font-bold text-primary flex items-center gap-1 select-none">
                    <Monitor className="h-3 w-3" /> MÓDULO INTERATIVO
                  </div>
                  
                  {/* Module Simulated Screen Area */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={simulatedModule}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 flex-1 flex flex-col justify-center"
                    >
                      {simulatedModule === "dash" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                              <LayoutDashboard className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-foreground">Relatórios unificados</h4>
                              <p className="text-xs text-muted-foreground">Controle de faturas, expedições de frete e produtos críticos na sua mão.</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-primary/5 p-2 rounded-lg border border-primary/10 text-center">
                              <span className="text-[10px] block opacity-60">Ativos</span>
                              <span className="font-mono text-sm font-bold text-foreground">420 Itens</span>
                            </div>
                            <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 text-center">
                              <span className="text-[10px] block opacity-60 font-bold text-emerald-600">Alerta</span>
                              <span className="font-mono text-sm font-bold text-emerald-500">Ok</span>
                            </div>
                            <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-center animate-pulse">
                              <span className="text-[10px] block opacity-60 text-amber-500 font-bold">Críticos</span>
                              <span className="font-mono text-xs font-black text-amber-600">3 Repor</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: '80%' }} />
                          </div>
                        </div>
                      )}

                      {simulatedModule === "estoque" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                              <Package className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-foreground">Produtos & Auditoria</h4>
                              <p className="text-xs text-muted-foreground">Registre entradas ou saídas com justificativa e altere dados em segundos.</p>
                            </div>
                          </div>
                          <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-xs text-muted-foreground font-mono leading-relaxed space-y-1">
                            <div className="text-emerald-500 font-bold flex items-center gap-1">🟢 &bull; ENTRADA DE PRODUTO</div>
                            <div>Adição de: COTOVELO DE AÇO de 1 1/2"</div>
                            <div>Saldo atualizado: <b>24 unidades</b> (+12 reposição)</div>
                          </div>
                        </div>
                      )}

                      {simulatedModule === "orcamento" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                              <Calculator className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-foreground">WhatsApp PDF Generator</h4>
                              <p className="text-xs text-muted-foreground">Soma automática de serviços com envio direto interativo em PDF para o cliente.</p>
                            </div>
                          </div>
                          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex items-center justify-between text-xs font-mono">
                            <div className="space-y-0.5">
                              <div>Quote #742 - LevTheDev</div>
                              <div className="text-primary font-bold">Total: R$ 4.890,00</div>
                            </div>
                            <Button size="sm" className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider">
                              <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                            </Button>
                          </div>
                        </div>
                      )}

                      {simulatedModule === "frota" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500">
                              <Truck className="h-6 w-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-foreground">Viagens & Despacho</h4>
                              <p className="text-xs text-muted-foreground">Acompanhamento geográfico simples de cargas e agendamentos de manutenção.</p>
                            </div>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-600 font-bold flex items-center gap-1">
                              • Scania 420 (Disponível)
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-600 font-bold flex items-center gap-1">
                              • Mercedes Accelo (Oficina)
                            </span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Explanatory text */}
                  <div className="bg-muted p-3.5 rounded-xl border border-border/40 text-xs text-muted-foreground italic leading-relaxed">
                    {simulatedActionMessage}
                  </div>
                </div>

                {/* Steps and interactive features list  */}
                <div className="md:col-span-2 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Operação de alto nível</span>
                    <h4 className="text-xl font-bold tracking-tight">O que você ganha no Almox Pro</h4>
                    
                    <ul className="space-y-3">
                      <li className="flex gap-2 items-start text-xs text-muted-foreground">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 rounded-full bg-emerald-100 p-0.5Dark:bg-emerald-500/20" />
                        <div>
                          <strong className="text-foreground font-semibold">Importação com Inteligência Artificial</strong>
                          <p className="text-[11px] mt-0.5">Chega de digitar linha por linha. Suba planilhas antigas e deixe o sistema fazer o trabalho duro.</p>
                        </div>
                      </li>
                      <li className="flex gap-2 items-start text-xs text-muted-foreground">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 rounded-full bg-emerald-100 p-0.5" />
                        <div>
                          <strong className="text-foreground font-semibold">Histórico de Movimentações Retroativas</strong>
                          <p className="text-[11px] mt-0.5">Toda entrada e saída arquiva quem fez, quando e por qual razão. Cuidado com auditorias resolvido.</p>
                        </div>
                      </li>
                      <li className="flex gap-2 items-start text-xs text-muted-foreground">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 rounded-full bg-emerald-100 p-0.5" />
                        <div>
                          <strong className="text-foreground font-semibold">Segurança & Conformidade Operacional</strong>
                          <p className="text-[11px] mt-0.5">Ambiente seguro com permissões diferenciadas para diretores e engenheiros de ponta.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      toast.info("Dica Pro: Adicione o AlmoxPro na tela inicial do seu smartphone para utilizá-lo como aplicativo nativo!");
                    }}
                    className="w-full border-dashed border-primary/30 hover:bg-primary/5 text-primary text-xs font-bold py-2.5 flex items-center justify-center gap-2"
                  >
                    <Smartphone className="h-4 w-4" /> Dica para acessar no celular
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Practical Cards Section with animations */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-xl text-foreground">Guias Operacionais Avançados</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tourSteps.map((step, idx) => (
                  <motion.div
                    key={idx}
                    variants={itemVariants}
                    className="bg-card hover:bg-card/85 p-6 rounded-2xl border border-border/50 shadow-md flex flex-col justify-between hover:shadow-lg transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--primary))] bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                          {step.badge}
                        </span>
                        <Bookmark className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      
                      <h4 className="font-bold text-base text-foreground tracking-tight mb-2">
                        {step.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        {step.description}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-border/30 pt-4 bg-muted/20 -mx-6 px-6 -mb-6 rounded-b-2xl p-4">
                      <span className="text-[10px] font-semibold text-foreground/80 block select-none">RECOMENDAÇÕES DA LEVTHEDEV:</span>
                      <ul className="space-y-1.5">
                        {step.tips.map((tip, tIdx) => (
                          <li key={tIdx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span className="text-[11px] leading-relaxed">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Advanced Interactive FAQ Accordion */}
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-card/80 to-card/40 border border-border/50 p-6 sm:p-8 rounded-3xl">
              <div className="mb-6 space-y-1">
                <h3 className="font-bold text-xl text-foreground flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" /> Central de Dúvidas Práticas
                </h3>
                <p className="text-xs text-muted-foreground">Clique nas perguntas abaixo para deslizar e ver as respostas recomendadas.</p>
              </div>

              <div className="space-y-3">
                {faqItems.map((faq, idx) => {
                  const isExpanded = expandedFaq === idx;
                  return (
                    <div 
                      key={idx} 
                      className="border border-border/40 hover:border-border/80 transition-all rounded-xl overflow-hidden bg-background/50"
                    >
                      <button
                        onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                        className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm text-foreground hover:text-primary transition-colors focus:outline-none"
                      >
                        <span className="pr-4">{faq.question}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180 text-primary' : ''}`} />
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1, transition: { height: { duration: 0.25 }, opacity: { duration: 0.2 } } }}
                            exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.2 }, opacity: { duration: 0.15 } } }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/20 bg-muted/10">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="contactTab"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
            id="contact"
          >
            {/* Split layout: Formulator + Direct channels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Creator Card */}
              <motion.div variants={itemVariants} className="lg:col-span-1">
                <Card className="border-border/50 overflow-hidden relative group h-full flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-emerald-500" />
                  
                  <CardContent className="pt-8 text-center space-y-4">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-500 shadow-md">
                      <Building className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-black text-foreground">LevTheDev Company</CardTitle>
                      <CardDescription className="text-xs uppercase tracking-widest font-black text-primary animate-pulse mt-0.5">Software Engineering</CardDescription>
                    </div>
                    
                    <p className="text-xs text-muted-foreground leading-relaxed px-2">
                      Sob a supervisão técnica de <strong>Esdras Gomes</strong>, a LevTheDev constrói algoritmos modernos para desburocratizar o controle interno e frotas de grandes plantas industriais.
                    </p>
                    
                    <div className="h-px bg-border/40 my-3" />
                    
                    <div className="text-xs text-muted-foreground">
                      Local de Operação: <strong className="text-foreground">Belém, Pará - Brasil</strong>
                    </div>
                  </CardContent>
                  
                  <div className="bg-muted/40 p-4 rounded-b-xl border-t border-border/30 text-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    ALMOX PRO OFFICIAL SUPPLIER
                  </div>
                </Card>
              </motion.div>

              {/* Action Board (WhatsApp direct simulator + layout) */}
              <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* WhatsApp Card */}
                  <Card className="border-border/55 hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden group hover:shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full blur-2xl pointer-events-none" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 shadow-inner">
                          <MessageSquare className="h-6 w-6" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          RETORNO IMEDIATO
                        </span>
                      </div>
                      <CardTitle className="text-lg font-bold mt-4 group-hover:text-emerald-500 transition-colors">WhatsApp Suporte</CardTitle>
                      <CardDescription className="text-xs">Fale no celular do desenvolvedor responsável.</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 font-mono text-sm text-emerald-600 font-bold bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 justify-center">
                        <Phone className="h-4 w-4" /> +55 (91) 98618-1270
                      </div>
                      
                      {/* Interactive Pre-written Form Text */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground block">Digite sua dúvida:</label>
                        <textarea
                          placeholder="Digite aqui para pré-escrever sua mensagem..."
                          value={suportMessageText}
                          onChange={(e) => setSuportMessageText(e.target.value)}
                          className="w-full p-2.5 text-xs border border-border bg-background rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none min-h-[60px]"
                        />
                      </div>

                      <Button 
                        onClick={() => window.open(formattedWhatsAppUrl, "_blank")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 inline-flex items-center gap-2 font-bold text-xs py-5"
                      >
                        <MessageSquare className="h-4 w-4" /> Enviar Mensagem via WhatsApp
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Mail Card */}
                  <Card className="border-border/55 hover:border-primary/40 transition-all duration-300 relative overflow-hidden group hover:shadow-lg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full blur-2xl pointer-events-none" />
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-inner">
                          <Mail className="h-6 w-6" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          SUPORTE GERAL
                        </span>
                      </div>
                      <CardTitle className="text-lg font-bold mt-4 group-hover:text-primary transition-colors">E-mail Corporativo</CardTitle>
                      <CardDescription className="text-xs">Para sugestões de novos recursos ou contratos comerciais.</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between font-mono text-xs text-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50">
                        <span className="truncate max-w-[150px] sm:max-w-none">{contactEmail}</span>
                        <button 
                          onClick={copyEmailToClipboard}
                          className="p-1 hover:text-primary transition-colors hover:bg-background rounded-md border border-transparent hover:border-border"
                          title="Copiar e-mail"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="h-[98px]" /> {/* Spacer to align card heights beautifully */}

                      <Button 
                        onClick={() => window.location.href = `mailto:${contactEmail}`}
                        variant="outline" 
                        className="w-full border-primary/25 hover:border-primary/50 inline-flex items-center gap-2 font-bold text-xs py-5"
                      >
                        <Mail className="h-4 w-4 text-primary" /> Abrir Aplicativo de E-mail
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Developer SLA Dedication Badge */}
                <div className="bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 p-5 rounded-2xl flex items-start gap-4">
                  <CheckCircle2 className="h-8 w-8 text-primary shrink-0 mt-0.5 bg-primary/10 rounded-xl p-1.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-foreground">Garantia de Manutenibilidade LevTheDev</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sua operação é crítica. O banco de dados do Almox Pro está protegido sob a infraestrutura do Google Cloud (Firestore), mantendo atualizações ao vivo e segurança blindada. Qualquer feedback de interface ou sugestão de novo botão de acesso será prontamente analisado e inserido por nossa equipe técnica.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Walkthrough Modal Overlay */}
      <AnimatePresence>
        {activeTourStep >= 0 && activeTourStep < tourSteps.length && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-xl bg-card border border-border/75 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
            >
              {/* Dynamic top animated glow strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-muted w-full flex">
                {tourSteps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-full flex-1 transition-all duration-300 ${
                      i <= activeTourStep ? "bg-primary" : "bg-transparent"
                    }`} 
                  />
                ))}
              </div>

              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    Passo {activeTourStep + 1} de {tourSteps.length} — {tourSteps[activeTourStep].badge}
                  </span>
                  <button 
                    onClick={() => setActiveTourStep(-1)}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted px-2.5 py-1 rounded-lg transition-all"
                  >
                    Sair do Tour
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight text-foreground">
                    {tourSteps[activeTourStep].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {tourSteps[activeTourStep].description}
                  </p>
                </div>

                {/* Checklist Tips */}
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-3">
                  <span className="text-xs font-black text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" /> Checklist Operacional
                  </span>
                  <ul className="space-y-2">
                    {tourSteps[activeTourStep].tips.map((tip, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-border/30">
                  <Button 
                    variant="ghost" 
                    onClick={() => setActiveTourStep(p => Math.max(0, p - 1))}
                    disabled={activeTourStep === 0}
                    className="text-xs font-semibold hover:bg-muted"
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (activeTourStep === tourSteps.length - 1) {
                        setActiveTourStep(-1);
                        toast.success("Parabéns! Você tem todo o conhecimento para guiar sua equipe no Almox Pro.");
                      } else {
                        setActiveTourStep(p => p + 1);
                      }
                    }}
                    className="text-xs font-semibold bg-primary hover:bg-primary/95 shadow-md shadow-primary/15 flex items-center gap-2 px-5 py-2"
                  >
                    {activeTourStep === tourSteps.length - 1 ? "Concluir" : "Próximo Passo"} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
