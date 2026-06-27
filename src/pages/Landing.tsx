import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Zap, 
  Phone, 
  Mail, 
  Layers, 
  Laptop, 
  Truck, 
  ChevronDown,
  ExternalLink,
  Users,
  Server,
  PieChart,
  Globe,
  Map,
  QrCode,
  ClipboardList,
  Box
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AlmoxProLogo } from '../components/AlmoxProLogo';
import { usePerformance } from '../lib/performance';

const fadeInUp: any = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
  }
};

const premiumTitleContainer: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

const getPremiumLineVariant = (isPocket: boolean): any => ({
  hidden: { y: isPocket ? "0%" : "85%", rotate: isPocket ? 0 : 1.5, opacity: 0 },
  visible: {
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: {
      type: isPocket ? "tween" : "spring",
      damping: isPocket ? 0 : 17,
      stiffness: isPocket ? 0 : 55,
      duration: isPocket ? 0.05 : 0.95,
      ease: [0.16, 1, 0.3, 1]
    }
  }
});

export function Landing() {
  const navigate = useNavigate();
  const { isPocket } = usePerformance();
  
  useEffect(() => {
    if (isPocket) {
      document.body.classList.add('ultra-perf-mode');
    } else {
      document.body.classList.remove('ultra-perf-mode');
    }
  }, [isPocket]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<boolean>(false);

  // Live simulator state to dazzle users with immediate interactive controls

  // High-end interactive token generation for direct consulting setup
  const [devCompName, setDevCompName] = useState<string>('');
  const [devToken, setDevToken] = useState<string>('');
  const [devStep, setDevStep] = useState<number>(0); // 0: Form, 1: Process, 2: Done
  const [devLogs, setDevLogs] = useState<string[]>([]);

  const generateDevToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!devCompName.trim()) return;
    setDevStep(1);
    setDevLogs([
      "Conectando ao terminal geral da LevTheDev Company...",
      "Resolvendo DNS seguro para pátio industrial...",
    ]);
    
    setTimeout(() => {
      setDevLogs(prev => [...prev, "Sincronizando chaves assimétricas de auditoria de Esdras Nunes..."]);
    }, 600);

    setTimeout(() => {
      setDevLogs(prev => [...prev, `Registrando solicitação consultiva para: [${devCompName.toUpperCase()}]`]);
    }, 1200);

    setTimeout(() => {
      const tokenRandom = `LTD-PROJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}-2026`;
      setDevToken(tokenRandom);
      setDevStep(2);
      setDevLogs(prev => [...prev, `[SINALIZADOR VERDE]: Token gerado com sucesso -> ${tokenRandom}`]);
    }, 2000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isBypass = localStorage.getItem('master_bypass') === 'true';
      if (user || isBypass) {
        navigate('/app/dashboard');
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleLogin = () => {
    navigate('/login');
  };

  const handleStartNow = () => {
    const isBypass = localStorage.getItem('master_bypass') === 'true';
    if (auth.currentUser || isBypass) {
      navigate('/app/dashboard');
    } else {
      navigate('/subscribe');
    }
  };

  const handleDemo = () => {
    localStorage.setItem('isDemoMode', 'true');
    localStorage.removeItem('demoOrgId');
    navigate('/app/dashboard');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };



  const faqs = [
    {
      q: "O Almoxpro roda offline ou requer nuvem constante?",
      a: "O aplicativo opera de forma 100% sincronizada na nuvem com o Google Firebase. Isso garante que celulares de técnicos no pátio pesado e computadores na mesa de gerência vejam exatamente os mesmos níveis de estoque em tempo real, eliminando planilhas desatualizadas."
    },
    {
      q: "Como é feita a implantação na minha planta industrial?",
      a: "A implantação conta com o suporte consultivo direto do Desenvolvedor de Software Esdras Nunes (LevTheDev Company). Nós estruturamos e limpamos sua base inicial, geramos as chaves de acesso organizacional e treinamos seu time em menos de 48 horas."
    },
    {
      q: "Consigo exportar dados para auditorias fiscais?",
      a: "Perfeitamente. O Almoxpro dispõe de um exportador de grade que converte o banco de dados filtrado diretamente para formatos legíveis. Caso necessite de automações fiscais personalizadas sob demanda, nosso canal de arquitetura está disponível abaixo para desenvolvimento ágil."
    }
  ];

  return (
    <div className="min-h-screen bg-[#020614] text-slate-100 font-sans overflow-x-hidden relative selection:bg-primary/30 selection:text-foreground flex flex-col justify-between">
      
      {/* 1. SPECTACULAR AMBIENT DECORATIVE GRAPHICS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        
        {/* Glowing static light orbs reflecting high-end aesthetics - Static for high-end mobile performance */}
        <div className="absolute top-[-10%] left-[5%] w-[900px] h-[900px] bg-primary/10 rounded-full blur-[160px] opacity-75" />
        <div className="absolute bottom-[10%] right-[-10%] w-[850px] h-[850px] bg-[#0066ff]/8 rounded-full blur-[140px] opacity-75" />
        <div className="absolute top-[35%] left-[45%] -translate-x-1/2 w-[1000px] h-[500px] bg-[#00d2ff]/4 rounded-full blur-[130px] opacity-60" />
        
        {/* Elegant Tech Horizontal & Vertical Grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,180,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,180,255,0.025)_1px,transparent_1px)] bg-[size:50px_50px] opacity-60" />
      </div>

      {/* HEADER NAVIGATION */}
      <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-[#03091e]/75 backdrop-blur-xl shrink-0">
        <div className="container mx-auto px-4 md:px-8 h-20 flex items-center justify-between max-w-6xl">
          
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 relative">
              <AlmoxProLogo />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-xl font-black tracking-widest bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent block font-display">
                Almoxpro
              </span>
            </div>
          </div>

          {/* Nav links to anchor points on page */}
          <nav className="hidden md:flex items-center space-x-1.5 bg-[#06122c]/55 border border-primary/15 p-1 rounded-full">
            <button 
              onClick={() => scrollToSection('features')} 
              className="text-xs font-semibold px-4.5 py-2 rounded-full text-slate-300 hover:text-white hover:bg-primary/10 transition-all cursor-pointer font-display"
            >
              Arquitetura
            </button>
            <button 
              onClick={() => scrollToSection('live-simulation')} 
              className="text-xs font-semibold px-4.5 py-2 rounded-full text-slate-300 hover:text-white hover:bg-primary/10 transition-all cursor-pointer font-display"
            >
              Simulador Ativo
            </button>
            <button 
              onClick={() => scrollToSection('bento')} 
              className="text-xs font-semibold px-4.5 py-2 rounded-full text-slate-300 hover:text-white hover:bg-primary/10 transition-all cursor-pointer font-display"
            >
              Detecção de Ruptura
            </button>
            <button 
              onClick={() => scrollToSection('developer-workspace')} 
              className="text-xs font-bold px-4.5 py-2 rounded-full text-[#00c8ff] hover:bg-primary/15 transition-all cursor-pointer flex items-center gap-1.5 font-display"
            >
              <Laptop size={13} /> Esdras Nunes
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <a 
              href="https://wa.me/5591986181270" 
              target="_blank" 
              rel="noreferrer" 
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-[#00c8ff] hover:text-[#00c8ff]/90 bg-primary/10 hover:bg-primary/15 px-4.5 py-2 rounded-full border border-primary/25 transition-all font-display shadow-[0_0_12px_rgba(0,180,255,0.15)]"
            >
              <Phone size={13} className="text-primary animate-pulse" /> WhatsApp: (91) 98618-1270
            </a>

            <button 
              onClick={handleDemo}
              className="inline-flex items-center gap-1 px-4.5 h-10 rounded-full text-xs font-bold border border-primary/20 hover:border-primary/45 text-slate-300 hover:text-primary bg-primary/5 hover:bg-primary/10 transition-all active:scale-95 cursor-pointer uppercase tracking-wider font-display"
            >
              <Zap size={11} className="text-primary animate-pulse" /> Demo
            </button>

            <button 
              onClick={handleLogin}
              className="px-6 h-10 rounded-full text-xs font-bold bg-[#0055ff] hover:bg-[#0044dd] text-white hover:shadow-[0_0_15px_rgba(0,85,255,0.4)] transition-all active:scale-95 cursor-pointer uppercase tracking-widest text-[11px] font-display border-none"
            >
              Login
            </button>
          </div>

        </div>
      </header>

      {/* HERO SECTION WITH DRIFTING PARTICLES */}
      <section className="relative z-10 pt-16 pb-16 md:pt-24 md:pb-28 px-4 container mx-auto text-center flex flex-col items-center max-w-5xl">
        
        {/* Continuous Floating Tech Lines & Connecting Nodes */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden max-w-7xl mx-auto">
          {/* Node 3 */}
          <div className="absolute top-[75%] left-[15%] hidden md:flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(0,180,255,0.95)] animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-primary/70 tracking-widest uppercase bg-primary/10 px-2 py-1 rounded border border-primary/25 backdrop-blur-sm">AUDIT_STOCKS_V3 [SECURED]</span>
          </div>
        </div>



        {/* Hero Title - Minimalista, Corporativo e Sofisticado com Motion de Linha Estilo Stripe/Linear */}
        <motion.h1 
          variants={premiumTitleContainer}
          initial="hidden"
          animate="visible"
          className="text-[1.8rem] sm:text-[3.2rem] md:text-[4.2rem] lg:text-[4.6rem] xl:text-[5.4rem] font-extrabold tracking-tighter leading-[1.12] mb-8 font-corporate relative z-10 w-full text-center force-gpu"
        >
          <span className="block overflow-hidden py-1">
            <motion.span 
              variants={getPremiumLineVariant(isPocket)} 
              className="block animate-premium-shine font-extrabold force-gpu"
              style={{ willChange: "transform, opacity" }}
            >
              A evolução da
            </motion.span>
          </span>
          <span className="block overflow-hidden py-1">
            <motion.span 
              variants={getPremiumLineVariant(isPocket)} 
              className="block animate-colored-shine drop-shadow-[0_4px_25px_rgba(30,144,255,0.25)] font-extrabold force-gpu"
              style={{ willChange: "transform, opacity" }}
            >
              gestão empresarial.
            </motion.span>
          </span>
          <span className="block overflow-hidden py-1">
            <motion.span 
              variants={getPremiumLineVariant(isPocket)} 
              className="block animate-premium-shine mt-2 sm:mt-3 leading-tight text-[1.4rem] sm:text-[2.2rem] md:text-[2.8rem] lg:text-[3.2rem] font-extrabold force-gpu"
              style={{ willChange: "transform, opacity" }}
            >
              Controle absoluto na palma da mão!
            </motion.span>
          </span>
        </motion.h1>

        {/* Hero description */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-3xl mx-auto mb-12 leading-relaxed force-gpu"
          style={{ willChange: "transform, opacity" }}
        >
          Gerencie insumos estratégicos, matérias-primas e ativos de valor. Previna rupturas de estoque com alertas inteligentes e otimize a logística da sua frota. Uma solução modular desenvolvida para gerar organização impecável, controle severo de processos e lucro máximo para todos os setores corporativos e industriais.
        </motion.p>

        {/* Hero CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-xl mx-auto force-gpu"
          style={{ willChange: "transform, opacity" }}
        >
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartNow}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-blue-600 text-white px-10 h-14 rounded-full font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-primary/50 cursor-pointer border-none uppercase tracking-wider font-display force-gpu"
            style={{ willChange: "transform" }}
          >
            Acessar AlmoxPro <ArrowRight size={16} />
          </motion.button>
        </motion.div>

        {/* Interactive scroll triggers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-muted-foreground font-mono"
        >
          <button 
            onClick={() => scrollToSection('features')} 
            className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none font-mono font-bold"
          >
            <Layers size={13} className="text-primary" /> Explorar Arquitetura
          </button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="mt-12 text-xs text-muted-foreground flex flex-col items-center gap-2 cursor-pointer font-sans"
          onClick={() => scrollToSection('live-simulation')}
        >
          <span>Role para explorar os diferenciais</span>
          <ChevronDown size={14} className="text-primary" />
        </motion.div>
      </section>

      {/* 2. REAL ECOSYSTEM SHOWCASE (TRANSPARENCY & RELIABILITY) */}
      <section id="ecosystem" className="py-24 bg-background relative border-t border-border/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-extrabold text-white font-display tracking-tight">
              Ecossistema Completo AlmoxPro
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
               Tudo que sua operação precisa para gerenciar inventários, logística e inteligência empresarial em uma única plataforma integrada.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Box className="h-6 w-6"/>, title: "Gestão de Itens", desc: "Catalogação e rastreamento completo de insumos de toda a fábrica." },
              { icon: <Truck className="h-6 w-6"/>, title: "Expedição", desc: "Gestão de saídas, cargas e romaneios logísticos." },
              { icon: <Users className="h-6 w-6"/>, title: "Fornecedores", desc: "Cadastro, avaliações e centralização de contatos." },
              { icon: <Map className="h-6 w-6"/>, title: "Frota", desc: "Controle de veículos e rotas de distribuição." },
              { icon: <ClipboardList className="h-6 w-6"/>, title: "Cotações", desc: "Central de propostas e fretes." },
              { icon: <PieChart className="h-6 w-6"/>, title: "BI & Relatórios", desc: "Dashboards analíticos para previsão de estoque." },
              { icon: <Globe className="h-6 w-6"/>, title: "Integrações", desc: "Conexão com sistemas corporativos e APIs." },
              { icon: <QrCode className="h-6 w-6"/>, title: "Escaneamento", desc: "Check-in/Check-out rápido com QR Codes." }
            ].map((m, i) => (
               <motion.div 
                 key={i}
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 transition={{ delay: i * 0.05 }}
                 className="bg-muted/10 p-6 rounded-2xl border border-primary/10 hover:border-primary/40 transition-all duration-300 group"
               >
                 <div className="mb-4 text-primary group-hover:scale-110 transition-transform">{m.icon}</div>
                 <h4 className="font-bold text-white mb-2 font-display">{m.title}</h4>
                 <p className="text-sm text-slate-400 leading-relaxed">{m.desc}</p>
               </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. LEVTHEDEV COMPANY ARCHITECT DEV WORKSPACE - EXPANDED SPECTACLE */}
      <section id="developer-workspace" className="py-24 bg-background text-foreground border-t border-border/40 relative overflow-hidden">
        
        {/* Glow decorative rings */}
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[120px] pointer-events-none" />
        
        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          
          <div className="text-center md:text-left mb-12">
            <span className="text-[10px] font-mono tracking-widest text-primary font-bold bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full uppercase">
              ESTÁGIO 04 // DESENVOLVEDOR & EMPRESA RESPONSÁVEL
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mt-4 tracking-tight leading-none font-display">
              LevTheDev Company
            </h2>
            <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-xl">
              Soluções sob medida para automação de almoxarifados táticos, rastreabilidade rígida de ativos empresariais e controle operacional de alto rendimento.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-12 items-stretch">
            
            {/* Left Column: Creative Corporate Presentation */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="md:col-span-6 space-y-6 text-left flex flex-col justify-between"
            >
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                  Liderada pelo Desenvolvedor de Software e Arquiteto de Sistemas <strong>Esdras Nunes</strong>, a <strong>LevTheDev Company</strong> desenvolve sistemas de pátio operacional severo com altos padrões de confiabilidade, otimização extrema de banco de dados no Google Firebase e reações instantâneas em tempo real de sub-segundo.
                </p>


              </div>

            </motion.div>

            {/* Right Column: High-tech Interactive Project Vault Configurator (Destaque visual espetacular) */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeInUp}
              className="md:col-span-6 w-full flex flex-col justify-between"
            >
              <div className="p-8 rounded-3xl bg-[#050c1b]/85 border border-primary/25 hover:border-primary/45 hover:shadow-[0_10px_40px_rgba(0,180,255,0.15)] transition-all duration-300 relative overflow-hidden text-left shadow-2xl flex flex-col justify-between h-full group backdrop-blur-md">
                
                {/* Visual highlights */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00c8ff]/10 rounded-full blur-[70px] pointer-events-none transition-colors" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-[65px] pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00c8ff]/15 border border-[#00c8ff]/25 text-[#00c8ff] rounded-full text-[9px] font-bold uppercase tracking-widest font-mono shadow-[0_0_12px_rgba(0,200,255,0.1)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00c8ff] animate-pulse" /> Sincronizador Ativo
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">v3.0-PRO</span>
                  </div>

                  <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-wide font-display">
                    <Laptop size={18} className="text-primary" /> Solicitar Consultoria LevTheDev
                  </h3>
                  <p className="text-slate-300 text-xs mt-1.5 leading-relaxed font-normal">
                    Personalize sua planta ou integre ao banco de dados preenchendo o painel abaixo para gerar sua credencial de pátio exclusiva.
                  </p>
                </div>

                {/* Sub-form UI */}
                <div className="my-6 relative z-10">
                  <AnimatePresence mode="wait">
                    {devStep === 0 && (
                      <motion.form 
                        onSubmit={generateDevToken}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-2 font-display">Nome de sua Empresa ou Fábrica</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              required
                              value={devCompName}
                              onChange={(e) => setDevCompName(e.target.value)}
                              placeholder="Fábrica de Gás Nordeste Ltda"
                              className="w-full bg-[#010410] border border-primary/25 focus:border-primary/50 focus:ring-1 focus:ring-primary text-white rounded-xl py-3 px-4 text-xs font-semibold outline-none transition-all placeholder:text-slate-500 font-sans shadow-inner"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Server size={14} />
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 bg-gradient-to-r from-[#0055ff] to-[#00a2ff] text-white border-none font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 uppercase tracking-widest cursor-pointer shadow-[0_4px_15px_rgba(0,85,255,0.3)] active:scale-[0.98] font-display"
                        >
                          <Zap size={13} className="stroke-[3]" /> Gerar Credencial de Atendimento
                        </button>
                      </motion.form>
                    )}

                    {devStep === 1 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4 py-2 font-mono text-[11px]"
                      >
                        <div className="flex items-center gap-2 text-primary">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                          <span className="font-bold">Processando algoritmo com segurança...</span>
                        </div>
                        <div className="bg-background rounded-xl border border-border p-3 text-muted-foreground space-y-1 max-h-[140px] overflow-y-auto">
                          {devLogs.map((log, i) => (
                            <div key={i} className="text-[10px] border-l-2 border-primary pl-2">{log}</div>
                          ))}
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                            className="bg-primary h-full rounded-full"
                          />
                        </div>
                      </motion.div>
                    )}

                    {devStep === 2 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-4 py-2 text-left font-sans"
                      >
                        <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-1">
                          <span className="text-[9px] font-mono text-primary font-bold uppercase block tracking-wider font-display">CREDENCIAL GERADA COM SUCESSO</span>
                          <span className="text-sm font-mono font-bold text-foreground block select-all tracking-wide">{devToken}</span>
                          <span className="text-[10px] text-muted-foreground block mt-1 leading-snug font-normal">Chave de prioridade registrada para {devCompName.toUpperCase()}. Toque para acionar Esdras!</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <a 
                            href={`https://wa.me/5591986181270?text=Olá%2520Esdras,%2520sou%2520representante%2520da%2520empresa%2520${encodeURIComponent(devCompName)}%2520e%2520gerei%2520a%2520credencial%2520*${devToken}*%2520na%2520landing%2520page%2520do%2520AlmoxPro.%2520Gostaria%2520de%252520conversar%2520sobre%2520o%2520projeto.`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-3 bg-primary hover:opacity-90 text-primary-foreground rounded-xl font-bold text-[11px] text-center flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider cursor-pointer border-none shadow-md font-display"
                          >
                            <Phone size={12} className="stroke-[2.5]" /> WhatsApp Direto
                          </a>
                          
                          <button 
                            type="button"
                            onClick={() => {
                              setDevStep(0);
                              setDevCompName('');
                              setDevToken('');
                              setDevLogs([]);
                            }}
                            className="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl border border-border font-bold text-[11px] text-center transition-colors uppercase tracking-wider cursor-pointer font-display"
                          >
                            Gerar Outro
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Developer Contacts Direct links */}
                {devStep !== 2 && (
                  <div className="space-y-2.5 relative z-10 pt-4 border-t border-border/30">
                    <a 
                      href="https://wa.me/5591986181270"
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-border/30 hover:border-primary/20 bg-muted/10 hover:bg-primary/5 transition-all cursor-pointer text-xs font-sans"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Phone size={13} />
                        </div>
                        <div>
                          <p className="text-[8px] font-mono font-bold text-primary uppercase tracking-widest">Atendimento WhatsApp</p>
                          <p className="text-foreground group-hover:text-primary font-bold transition-colors font-display">(91) 98618-1270</p>
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
                    </a>

                    <a 
                      href="mailto:esdrasgomes547@gmail.com"
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-border/30 hover:border-primary/20 bg-muted/10 hover:bg-primary/5 transition-all cursor-pointer text-xs font-sans"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Mail size={13} />
                        </div>
                        <div>
                          <p className="text-[8px] font-mono font-bold text-primary uppercase tracking-widest">E-mail Profissional</p>
                          <p className="text-foreground group-hover:text-primary font-bold transition-colors font-display">esdrasgomes547@gmail.com</p>
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
                    </a>
                  </div>
                )}

                <div className="pt-3.5 mt-3 border-t border-border/30 text-[9.5px] text-muted-foreground font-mono text-center flex items-center justify-center gap-1.5 relative z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>CRIADOR FUNDADOR // ESDRAS NUNES</span>
                </div>

              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 6. DÚVIDAS FREQUENTES */}
      <section className="py-24 bg-background border-t border-border/40">
        <div className="container mx-auto px-4 max-w-3xl">
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground bg-muted px-3.5 py-1.5 rounded-full inline-block border border-border/45">
              DÚVIDAS FREQUENTES
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold mt-4 text-foreground tracking-tight font-display">
              Dúvidas Técnicas
            </h2>
          </motion.div>

          <div className="space-y-3.5 text-left">
            {faqs.map((f, idx) => (
              <div 
                key={idx}
                className="bg-card hover:bg-muted/10 border border-border rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-sm md:text-base font-bold text-foreground hover:opacity-90 text-left cursor-pointer transition-colors bg-transparent border-none font-display"
                >
                  <span>{f.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${expandedFaq === idx ? 'rotate-180 text-primary' : ''}`} />
                </button>
                
                <AnimatePresence initial={false}>
                  {expandedFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-5 pt-0 text-xs sm:text-sm text-muted-foreground border-t border-border/30 leading-relaxed font-normal">
                        {f.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FINAL CALL TO ACTION BOX */}
      <section className="py-24 bg-background text-center border-t border-border/40 relative">
        <div className="absolute inset-0 bg-primary/[0.01] pointer-events-none" />
        
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <h2 className="text-3xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight font-display">
            Assuma o controle definitivo <br/> do seu almoxarifado técnico hoje.
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mb-10 max-w-xl mx-auto leading-relaxed font-normal">
            Elimine gargalos operacionais e proteja o fluxo de estoque de matérias-primas, insumos corporativos e ferramentas. Uma arquitetura de ponta a ponta desenvolvida para durabilidade extrema.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
            <button 
              onClick={handleStartNow}
              className="w-full sm:w-auto px-10 h-14 bg-foreground text-background font-bold rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md active:scale-97 text-[15px] uppercase tracking-wider font-display"
            >
              Começar Agora <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleDemo}
              className="w-full sm:w-auto h-14 bg-primary text-primary-foreground font-bold px-10 rounded-full hover:bg-primary/95 transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md active:scale-97 text-[15px] uppercase tracking-wider font-display"
            >
              Ver Demonstração <Zap size={14} className="animate-pulse" />
            </button>
          </div>
        </div>
      </section>


      {/* 7. TERMO DE USO E DE RESPONSABILIDADE */}
      <section className="py-12 bg-background border-t border-border/40">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-card hover:bg-muted/10 border border-border rounded-2xl overflow-hidden transition-colors">
            <button
              type="button"
              onClick={() => setExpandedTerm(!expandedTerm)}
              className="w-full flex items-center justify-between p-5 text-sm md:text-base font-bold text-foreground hover:opacity-90 text-left cursor-pointer transition-colors bg-transparent border-none font-display"
            >
              <span>Termo de Uso e de Responsabilidade</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${expandedTerm ? 'rotate-180 text-primary' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {expandedTerm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="p-5 pt-0 text-[10px] sm:text-xs text-muted-foreground border-t border-border/30 leading-relaxed font-normal space-y-2">
                    <p>AlmoxPro – Plataforma de Multigerenciamento Digital</p>
                    <p>Versão 1.0 – Maio de 2026</p>
                    <p>Ao acessar ou utilizar a plataforma AlmoxPro (https://almoxprov3.vercel.app), você declara ter lido, compreendido e aceitado integralmente os termos abaixo. Caso não concorde, não utilize o serviço.</p>
                    <h4 className="font-bold text-foreground">1. Sobre o Serviço</h4>
                    <p>O AlmoxPro é uma ferramenta digital auxiliar de multigerenciamento, desenvolvida para auxiliar gestores, empresas e indústrias na organização de almoxarifado, controle de estoque, patrimônio e relatórios gerenciais.</p>
                    <p>É expressamente esclarecido que o AlmoxPro não substitui a gestão humana, o controle físico, a contabilidade, o departamento fiscal ou qualquer obrigação legal da empresa. Trata-se de um instrumento de apoio, e não deve ser seguido de forma cega ou automática. O usuário é o único responsável pela gestão real de seu negócio.</p>
                    <p>O serviço é disponibilizado por Esdras Levi Gomes Nunes (LevTheDev Company), CPF nº 039.525.532-55, residente em Belém do Pará.</p>
                    <h4 className="font-bold text-foreground">2. Aceitação dos Termos</h4>
                    <p>O uso da plataforma implica aceitação expressa e irrestrita deste Termo. Reservamo-nos o direito de alterá-lo a qualquer momento, com publicação na plataforma. As alterações entrarão em vigor 10 (dez) dias após a divulgação.</p>
                    <h4 className="font-bold text-foreground">3. Cadastro e Conta de Usuário</h4>
                    <p>3.1. É necessário cadastro com informações verdadeiras e atualizadas.</p>
                    <p>3.2. O usuário é inteiramente responsável pela segurança de sua conta e senha.</p>
                    <p>3.3. É proibido compartilhar contas.</p>
                    <h4 className="font-bold text-foreground">4. Obrigações do Usuário</h4>
                    <p>O usuário se compromete a: Utilizar a plataforma de forma ética e legal; Manter os dados inseridos sempre corretos e atualizados; Não inserir informações falsas ou que violem direitos de terceiros; Responsabilizar-se integralmente por todas as informações lançadas e pelas decisões tomadas com base nos dados do sistema.</p>
                    <h4 className="font-bold text-foreground">5. Propriedade Intelectual</h4>
                    <p>Todos os direitos sobre o AlmoxPro pertencem exclusivamente a Esdras Levi Gomes Nunes (LevTheDev Company). É proibida qualquer cópia, modificação ou uso não autorizado.</p>
                    <h4 className="font-bold text-foreground">6. Privacidade e Proteção de Dados</h4>
                    <p>O tratamento dos dados segue a LGPD (Lei nº 13.709/2018) e nossa Política de Privacidade.</p>
                    <h4 className="font-bold text-foreground">7. Limitação de Responsabilidade</h4>
                    <p>7.1. O AlmoxPro é fornecido “no estado em que se encontra”, sem qualquer garantia de precisão total, disponibilidade contínua ou adequação a fins específicos.</p>
                    <p>7.2. Qualquer decisão tomada com base nos dados do sistema é de inteira e exclusiva responsabilidade do usuário; O desenvolvedor não se responsabiliza por divergências entre o sistema e a realidade física, erros de lançamento, perdas financeiras, multas, sanções fiscais, trabalhistas ou de qualquer outra natureza.</p>
                    <p>7.3. A responsabilidade se limita à realização de manutenções técnicas trimestrais.</p>
                    <h4 className="font-bold text-foreground">8. Indenização</h4>
                    <p>O usuário indenizará e isentará Esdras Levi Gomes Nunes (LevTheDev Company) de qualquer prejuízo decorrente do uso da plataforma.</p>
                    <h4 className="font-bold text-foreground">9. Lei Aplicável e Foro</h4>
                    <p>Este Termo é regido pelas leis do Brasil. Foro: Comarca de Belém/PA. Última atualização: 25 de maio de 2026.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full border-t border-border/40 py-12 bg-muted/20 text-center text-xs text-muted-foreground z-10 shrink-0 select-none">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl md:flex md:items-center md:justify-between space-y-4 md:space-y-0 text-left font-sans">
          
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium">
              A marca <span className="text-foreground font-bold font-display">AlmoxPro</span> é protegida pela <strong className="text-foreground hover:text-primary transition-colors cursor-pointer font-display">LevTheDev Company</strong>
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Engenharia e Criação por Esdras Nunes, Arquiteto Sênior de Sistemas Web.
            </p>
          </div>

          <div className="space-y-2 md:text-right">
            <div className="flex items-center gap-4.5 justify-start md:justify-end text-muted-foreground text-[11px] sm:text-xs">
              <a href="mailto:esdrasgomes547@gmail.com" className="hover:text-primary transition-colors flex items-center gap-1.5 font-bold cursor-pointer font-sans">
                <Mail size={12} className="text-primary" /> esdrasgomes547@gmail.com
              </a>
              <span className="text-border">•</span>
              <a href="https://wa.me/5591986181270" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors flex items-center gap-1.5 font-bold cursor-pointer font-sans">
                <Phone size={12} className="text-primary animate-pulse" /> (91) 98618-1270
              </a>
            </div>
            <p className="text-muted-foreground/60 text-[10px]">© 2026 LevTheDev Company. Todos os direitos reservados de forma imaculada.</p>
          </div>

        </div>
      </footer>

    </div>
  );
}
