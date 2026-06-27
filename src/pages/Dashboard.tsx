import React, { useState, useEffect, useRef } from "react";
import { highFlowAlertAgent } from "../lib/highFlowAlertAgent";
import { Skeleton } from "@/components/ui/skeleton";
import { TradingDashboard } from '../components/dashboard/TradingDashboard';
import { Link, useNavigate } from "react-router-dom";
import { InconsistencyPanel } from "../components/InconsistencyPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, Truck, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  PackageCheck, ChevronRight, History, Activity, User, 
  X, MessageSquare, ClipboardCheck, 
  ShieldCheck, Check, Trash2, PenTool, Search, 
  Award, Plus, Download, Calendar, RefreshCw
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, handleFirestoreError, OperationType, auth, safeOnSnapshot } from "../lib/firebase";
import { collection, onSnapshot, query, doc, limit, orderBy, addDoc, deleteDoc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { ShipmentItem, CompanySettings, QualityReport } from "../types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { lerResumo } from "../lib/statsManager";

import { reconstruirStats } from "../lib/statsManager";

export function Dashboard() {
  const navigate = useNavigate();
  const { orgId } = useOrganization();
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');



  // Controle de Qualidade (QC) States
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [qcTab, setQcTab] = useState<'nova' | 'historico'>('nova');
  const [qcSearch, setQcSearch] = useState('');

  // Form States for QC
  const [qcProductName, setQcProductName] = useState('');
  const [qcInspectorName, setQcInspectorName] = useState('');
  const [qcType, setQcType] = useState<'LOTE' | 'PRODUTO' | 'CAIXA'>('LOTE');
  
  // Product Structure Checks
  const [structureNoCorrosion, setStructureNoCorrosion] = useState(false);
  const [structureNoHoles, setStructureNoHoles] = useState(false);
  const [structureNoCracks, setStructureNoCracks] = useState(false);
  const [structureNoFlaws, setStructureNoFlaws] = useState(false);

  // Seals Checks
  const [hasImetro, setHasImetro] = useState<'SIM' | 'NAO' | 'NA'>('NA');
  const [hasLabSeal, setHasLabSeal] = useState<'SIM' | 'NAO' | 'NA'>('NA');
  const [hasSafetySeals, setHasSafetySeals] = useState<'SIM' | 'NAO' | 'NA'>('NA');

  // Additional Obs / Signatures
  const [qcNotes, setQcNotes] = useState('');
  const [qcStatus, setQcStatus] = useState<'APPROVED' | 'DISAPPROVED'>('APPROVED');
  const [qcSignature, setQcSignature] = useState(''); // Base64 png data URL

  const qcCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isQcDrawing, setIsQcDrawing] = useState(false);
  const [hasQcSigned, setHasQcSigned] = useState(false);

  // Pre-load default evaluator name when auth finishes
  useEffect(() => {
    if (auth.currentUser) {
      const defaultName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || '';
      setQcInspectorName(defaultName);
    }
  }, [auth.currentUser]);

  // Personalized Greeting
  const displayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || "Visitante";
  const firstName = displayName.split(' ')[0];
  const capFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  // Generate chart data dynamically from shipments
  const salesData = React.useMemo(() => {
    const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
    if (isDemoMode && shipments.length === 0) {
      return [
        { name: "01/Mai", value: 1200 },
        { name: "05/Mai", value: 2400 },
        { name: "10/Mai", value: 1800 },
        { name: "15/Mai", value: 3200 },
        { name: "20/Mai", value: 2900 },
        { name: "25/Mai", value: 4500 },
        { name: "30/Mai", value: 5400 }
      ];
    }
    const data = [...shipments]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .reduce((acc: any[], current) => {
        const dateLabel = new Date(current.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
        
        const existing = acc.find(item => item.name === dateLabel);
        if (existing) {
          existing.value += current.items;
        } else {
          acc.push({ name: dateLabel, value: current.items });
        }
        return acc;
      }, []);

    if (data.length === 0) {
      data.push({ name: "Sem dados", value: 0 });
    } else if (data.length === 1) {
      data.unshift({ name: "Início", value: 0 });
    }
    return data;
  }, [shipments]);

  useEffect(() => {
    if (!orgId) return;

    highFlowAlertAgent.verificar(orgId);

    lerResumo(orgId).then(data => {
      if (data) setStats(data);
    });

    const unsubSettings = onSnapshot(doc(db, `organizations/${orgId}/settings`, "default"), snap => {
      if (snap.exists()) setCompanySettings(snap.data() as CompanySettings);
    }, err => handleFirestoreError(err, OperationType.GET, `organizations/${orgId}/settings/default`));

    // Desativado: lendo do stats/summary em vez de baixar o estoque inteiro
    // const unsubInv = safeOnSnapshot(query(collection(db, `organizations/${orgId}/inventory`), limit(1000)), "inventory", (list) => {
    //   setInventory(list as InventoryItem[]);
    // });

    const unsubShip = safeOnSnapshot(query(collection(db, `organizations/${orgId}/shipments`), orderBy('date', 'desc'), limit(1000)), "shipments", (list) => {
      setShipments(list as ShipmentItem[]);
    });

    const unsubQC = safeOnSnapshot(query(collection(db, `organizations/${orgId}/quality_control`), limit(500)), "quality_control", (list) => {
      setReports(list as QualityReport[]);
    });

    const unsubActivity = safeOnSnapshot(query(collection(db, `organizations/${orgId}/activity_log`), orderBy('date', 'desc'), limit(500)), "activity_log", (list) => {
      setActivities(list);
    });

    return () => {
      unsubSettings();
      // unsubInv();
      unsubShip();
      unsubQC();
      unsubActivity();
    }
  }, [orgId]);

  const { alerts, shippedCount, inTransitCount, totalVolume, totalValue, categoryData } = React.useMemo(() => {
    const isDemoMode = localStorage.getItem('isDemoMode') === 'true';
    if (isDemoMode && !stats) {
      return {
        alerts: [],
        shippedCount: 4750,
        inTransitCount: 150,
        totalVolume: 200000,
        totalValue: 200000,
        categoryData: [
          { name: "Cabos e Condutores", value: 60000 },
          { name: "EPIs de Segurança", value: 75000 },
          { name: "Parafusos e Fixadores", value: 55000 },
          { name: "Peças e Conexões", value: 10000 }
        ]
      };
    }
    
    // Substituindo pelos valores do resumo:
    const calculatedTotalValue = stats?.totalValue ?? 0;
    const calculatedTotalVolume = stats?.totalVolume ?? 0;
    const categoryDataArray = Object.entries(stats?.categorias ?? {}).map(([name, value]) => ({ name, value }));

    return {
      alerts: [], // Desativado avisos vindos de todos os itens do inventário para evitar load massivo
      shippedCount: shipments.filter(s => s.status === 'DELIVERED' || s.status === 'SHIPPED').length,
      inTransitCount: shipments.filter(s => s.status === 'PREPARING' || s.status === 'PENDING').length,
      totalVolume: calculatedTotalVolume,
      totalValue: calculatedTotalValue,
      categoryData: isDemoMode && categoryDataArray.length === 0 ? [
        { name: "Cabos e Condutores", value: 60000 },
        { name: "EPIs de Segurança", value: 75000 },
        { name: "Parafusos e Fixadores", value: 55000 },
        { name: "Peças e Conexões", value: 10000 }
      ] : categoryDataArray
    };
  }, [stats, shipments]);

  // Modern Universal pointer signature board callbacks for QC
  const startQcDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = qcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a"; 
    setIsQcDrawing(true);
    setHasQcSigned(true);
  };

  const drawQc = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isQcDrawing) return;
    const canvas = qcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopQcDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isQcDrawing) return;
    const canvas = qcCanvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsQcDrawing(false);
  };

  const clearQcCanvas = () => {
    const canvas = qcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasQcSigned(false);
    setQcSignature('');
  };

  // Dynamically size/render canvas when QC modal or tab changes
  useEffect(() => {
    if (!isQcModalOpen || qcTab !== 'nova') return;

    const timer = setTimeout(() => {
      const canvas = qcCanvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        // use proper layout dimensions
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#0f172a";
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isQcModalOpen, qcTab]);

  const handleSaveQcReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!qcProductName.trim()) {
      toast.error("Por favor, preencha o nome do produto.");
      return;
    }
    if (!qcInspectorName.trim()) {
      toast.error("Por favor, preencha o nome do inspetor.");
      return;
    }

    const canvas = qcCanvasRef.current;
    let signatureUrl = qcSignature;
    if (canvas && hasQcSigned && !signatureUrl) {
      signatureUrl = canvas.toDataURL("image/png");
    }

    if (!signatureUrl) {
      toast.error("Por favor, colete a assinatura digital do responsável.");
      return;
    }

    // Product structure condition check
    const structureApproved = structureNoCorrosion && structureNoHoles && structureNoCracks && structureNoFlaws;

    const newReport: Omit<QualityReport, 'id'> = {
      productName: qcProductName,
      inspectorName: qcInspectorName,
      structureStatus: structureApproved,
      hasImetro,
      hasLabSeal,
      hasSafetySeals,
      notes: qcNotes,
      signature: signatureUrl,
      status: qcStatus,
      type: qcType,
      date: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, `organizations/${orgId}/quality_control`), newReport);
      
      // Also register an entry in activity log!
      const logEntry = {
        action: 'quality_report',
        entity: 'Controle de Qualidade',
        message: `Relatório de Qualidade do produto "${qcProductName}" registrado como [${qcStatus === 'APPROVED' ? 'APROVADO' : 'REPROVADO'}] por ${qcInspectorName}.`,
        date: new Date().toISOString(),
        user: auth.currentUser?.displayName || '',
        userEmail: auth.currentUser?.email || '',
        userName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Almoxarife'
      };
      await addDoc(collection(db, `organizations/${orgId}/activity_log`), logEntry);

      toast.success("Relatório de controle de qualidade salvo com sucesso!");
      
      // Reset form fields
      setQcProductName('');
      setStructureNoCorrosion(false);
      setStructureNoHoles(false);
      setStructureNoCracks(false);
      setStructureNoFlaws(false);
      setHasImetro('NA');
      setHasLabSeal('NA');
      setHasSafetySeals('NA');
      setQcNotes('');
      setQcStatus('APPROVED');
      setQcSignature('');
      setHasQcSigned(false);
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Go to history tab
      setQcTab('historico');
    } catch (err) {
      console.error("Erro ao salvar relatório de QC:", err);
      toast.error("Erro ao salvar o relatório. Verifique sua conexão.");
    }
  };

  const handleDeleteQcReport = async (reportId: string) => {
    if (!orgId) return;
    if (!confirm("Tem certeza que deseja excluir permanentemente este relatório?")) return;

    try {
      await deleteDoc(doc(db, `organizations/${orgId}/quality_control`, reportId));
      toast.success("Relatório de qualidade excluído!");
    } catch (err) {
      console.error("Erro ao excluir relatório:", err);
      toast.error("Não foi possível excluir o relatório.");
    }
  };

  const downloadQcPdf = (report: QualityReport) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const margin = 12;
      let y = 15;

      // Header border
      doc.setDrawColor(79, 70, 229); // indigo header frame
      doc.setLineWidth(1);
      doc.rect(margin, y, 186, 26);

      // App Brand and logo placeholder
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text("ALMOXPRO", margin + 6, y + 10);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("SISTEMA DE GESTÃO & LAUDOS", margin + 6, y + 15);
      doc.text("CNPJ: " + (companySettings?.cnpj || "00.000.000/0001-00"), margin + 6, y + 20);

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.line(margin + 62, y, margin + 62, y + 26);

      // Right title side
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text("LAUDO TÉCNICO DE CONTROLE DE QUALIDADE", margin + 66, y + 9);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Identificador de Emissão: #${report.id.slice(0, 10).toUpperCase()}`, margin + 66, y + 14);
      const formattedRegisterDate = format(new Date(report.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Data do Registro: ${formattedRegisterDate}`, margin + 66, y + 19);
      doc.text(`Tipo de Recipiente: ${report.type}`, margin + 66, y + 24);

      y += 32;

      // Card structure for the general metadata
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, 186, 22, "F");
      doc.rect(margin, y, 186, 22);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("DADOS GERAIS DO PRODUTO", margin + 4, y + 6);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Produto Recebido: ${report.productName}`, margin + 4, y + 13);
      doc.text(`Almoxarife Inspetor: ${report.inspectorName}`, margin + 4, y + 18);
      doc.text(`Avaliação de Abrangência: Lote / Produto / Caixa individual`, margin + 100, y + 13);

      y += 28;

      // Evaluation Criteria Section
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("CRITÉRIOS INSPECIONADOS DA ESTRUTURA (100% DE EXIGÊNCIA)", margin, y);

      y += 4;
      const headersCriteria = ["CRITÉRIO DE INTEGRIDADE FISICA", "AÇÃO DA ESTRUTURA"];
      const criteriaDataRules = [
        ["Estrutura isenta de furos e frestas físicas", report.structureStatus ? "CONFORME [OK]" : "CONFORME [OK] / PARCIAL"],
        ["Inexistência de corrosão ativa ou oxidação estrutural", report.structureStatus ? "CONFORME [OK]" : "CONFORME [OK] / PARCIAL"],
        ["Superfície plana livre de rachaduras e trincas", report.structureStatus ? "CONFORME [OK]" : "CONFORME [OK] / PARCIAL"],
        ["Isenção total de rebarbas, deformidades ou falhas moldura", report.structureStatus ? "CONFORME [OK]" : "CONFORME [OK] / PARCIAL"],
      ];

      autoTable(doc, {
        head: [headersCriteria],
        body: criteriaDataRules,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin }
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Seals evaluation table
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("STATUS DE CERTIFICADOS E SELOS REGULAMENTARES", margin, y);

      y += 4;
      const headersSeals = ["SELO OU INSCRIÇÃO OBRIGATÓRIA", "EXIGIBILIDADE DO DISPOSITIVO", "APRESENTAÇÃO"];
      const sealsDataList = [
        ["Selo de Inspeção Geral Inmetro", "Obrigatório se Aplicável", report.hasImetro],
        ["Certificação Laboratorial / Laudo Químico", "Obrigatório se Aplicável", report.hasLabSeal],
        ["Selos Gravados de Segurança Geral no Produto", "Mandatório de Fábrica", report.hasSafetySeals],
      ];

      autoTable(doc, {
        head: [headersSeals],
        body: sealsDataList,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin }
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Observations Box
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("NOTAS EXPLICATIVAS DO PARECER TÉCNICO", margin, y);
      y += 4;
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, 186, 16, "F");
      doc.rect(margin, y, 186, 16);
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const notesText = report.notes ? report.notes : "Nenhuma observação técnica complementar foi lavrada pelo almoxarife inspetor responsável.";
      const lines = doc.splitTextToSize(notesText, 178);
      doc.text(lines, margin + 4, y + 6);

      y += 24;

      // VERDICT ROW
      doc.setFillColor(report.status === "APPROVED" ? 240 : 254, report.status === "APPROVED" ? 253 : 242, report.status === "APPROVED" ? 250 : 242);
      doc.rect(margin, y, 186, 12, "F");
      doc.setDrawColor(report.status === "APPROVED" ? 16 : 220, report.status === "APPROVED" ? 185 : 38, report.status === "APPROVED" ? 129 : 38);
      doc.rect(margin, y, 186, 12);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(report.status === "APPROVED" ? 5 : 153, report.status === "APPROVED" ? 150 : 27, report.status === "APPROVED" ? 105 : 27);
      doc.text(`VEREDITO FINAL DA AUDITORIA: ${report.status === "APPROVED" ? "LOTE/PRODUTO APROVADO" : "LOTE/PRODUTO REPROVADO"}`, margin + 6, y + 7.5);

      y += 20;

      // Signature Zone
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin + 60, y, 66, 24);
      
      try {
        if (report.signature) {
          doc.addImage(report.signature, "PNG", margin + 61, y + 1, 64, 22);
        }
      } catch (err) {
        console.error("Erro ao desenhar assinatura no PDF:", err);
      }

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("ASSINATURA DIGITAL DO ALMOXARIFE RESPONSÁVEL", margin + 62, y + 28);

      const todayLabel = new Date().toLocaleDateString("pt-BR");
      doc.text(`AlmoxPro Software • Autenticação Síncrona via Firestore • Emissão em ${todayLabel}`, margin, 285);

      doc.save(`Laudo_Qualidade_${report.productName.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF do Controle de Qualidade baixado!");
    } catch (err) {
      console.error("Erro ao gerar PDF de laudo:", err);
      toast.error("Ocorreu um erro ao exportar o laudo em PDF.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-[-16px] relative z-10 pr-2">
        <button onClick={async () => {
          if (!orgId) return;
          try {
            const r = await reconstruirStats(orgId);
            setStats(r);
            toast.success("Resumo reconstruído com sucesso!");
          } catch(e) {
            toast.error("Erro ao reconstruir resumo.");
          }
        }}
          style={{ fontSize: 10, color: "#4a7a9b", background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <RefreshCw style={{ width: 10, height: 10 }} /> Recalcular
        </button>
      </div>
      <TradingDashboard totalValue={totalValue} chartData={categoryData} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {localStorage.getItem('isDemoMode') === 'true' ? "Olá, visitante" : (companySettings?.customGreeting || `Olá, ${capFirstName}`)}
              {localStorage.getItem('isDemoMode') !== 'true' && companySettings?.companyName && (
                <span className="text-[hsl(var(--muted-foreground))] font-normal ml-1">
                  da {companySettings.companyName}
                </span>
              )}
            </h1>
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            {localStorage.getItem('isDemoMode') === 'true' ? "Bem-vindo(a) de volta! Acompanhe seus principais indicadores logísticos." : (companySettings?.welcomeMessage || "Bem-vindo(a) de volta! Acompanhe seus principais indicadores logísticos.")}
          </p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-y-2 justify-end">
          <button 
            onClick={() => setIsQcModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-bold transition-all border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white h-9 px-4 py-2 shadow-sm"
            id="open-qc-panel-btn"
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Controle de Qualidade
          </button>
          <button 
            onClick={() => setIsActivityModalOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
          >
            <History className="h-4 w-4 mr-2" />
            Movimentações
          </button>
          <Link to="/app/inventory">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
              <Package className="h-4 w-4 mr-2" />
              Estoque
            </button>
          </Link>
          <Link to="/app/leads">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Leads
            </button>
          </Link>
          <Link to="/app/shipments">
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
              <Truck className="h-4 w-4 mr-2" />
              Expedições
            </button>
          </Link>
        </div>
      </div>

      <InconsistencyPanel />

      <div className="grid gap-4 md:grid-cols-4">
        <Link to="/app/shipments" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl transform-gpu will-change-transform">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Enviados</CardTitle>
              <PackageCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono">{shippedCount}</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                    <span className="text-emerald-500 flex items-center mr-1">
                      <ArrowUpRight className="h-3 w-3" />
                      +12.5%
                    </span> 
                    vs. mês anterior
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/app/shipments" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl transform-gpu will-change-transform">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Trânsito</CardTitle>
              <Truck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono">{inTransitCount}</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                    <span className="text-destructive flex items-center mr-1">
                      <ArrowDownRight className="h-3 w-3" />
                      -4.1%
                    </span> 
                    vs. mês anterior
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/inventory" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl transform-gpu will-change-transform">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volume em Estoque</CardTitle>
              <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono">
                    {totalVolume.toLocaleString()}
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center mt-1">
                    <span className="text-emerald-500 flex items-center mr-1">
                      <ArrowUpRight className="h-3 w-3" />
                      +2.1%
                    </span> 
                    vs. mês anterior
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/inventory" className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl transform-gpu will-change-transform">
          <Card className="h-full transition-all hover:bg-accent/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Ruptura</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <>
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-4 w-36" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono text-amber-600">{alerts.length}</div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    SKUs abaixo do estoque mínimo
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-1 md:col-span-4 lg:col-span-5">
          <CardHeader>
            <CardTitle>Fluxo de Expedição</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px]">
              {stats === null ? (
                <div className="pl-6 h-full w-full">
                  <Skeleton className="w-full h-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      isAnimationActive={typeof window !== 'undefined' && localStorage.getItem('almox_perf_mode') !== 'pocket' && !document.body.classList.contains('ultra-perf-mode')}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3 lg:col-span-2 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle>Alertas de Estoque</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Itens que precisam de reposição</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            {alerts.length === 0 ? (
              <div className="text-sm text-[hsl(var(--muted-foreground))] h-full flex flex-col items-center justify-center py-8 text-center">
                <PackageCheck className="h-8 w-8 mb-2 text-emerald-500/50" />
                Nenhum alerta. Estoque saudável.
              </div>
            ) : (
              alerts.map(item => (
                <div key={item.id} className="flex flex-col space-y-2 border-b border-[hsl(var(--border))] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold truncate pr-2" title={item.name}>{item.name}</h4>
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{item.id}</span>
                    </div>
                    {item.status === 'CRITICAL' || item.status === 'OUT_OF_STOCK' ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">CRÍTICO</span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">ATENÇÃO</span>
                    )}
                  </div>
                  <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs font-medium">
                      <div>
                        Atual: <span className={item.qty < item.minQty ? 'text-destructive font-bold font-mono' : 'font-mono'}>{item.qty}</span>
                      </div>
                      <div>
                        Mínimo: <span className="font-mono">{item.minQty}</span>
                      </div>
                    </div>
                    <Link to={`/app/inventory?search=${item.id}`} className="flex items-center text-xs font-medium text-[hsl(var(--primary))] hover:underline">
                      Ver detalhes <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {isActivityModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setIsActivityModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 border border-primary/10"
            >
              <div className="p-6 border-b bg-muted/20 relative">
                <button 
                  onClick={() => setIsActivityModalOpen(false)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex flex-col text-left">
                    <h3 className="text-xl font-bold tracking-tight">Histórico de Atividades</h3>
                    <p className="text-sm text-muted-foreground">
                      Sincronizado em tempo real com o banco de dados.
                    </p>
                  </div>
                </div>

                <div className="flex gap-1 mt-6 bg-muted/40 p-1 rounded-lg border">
                  {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: 'Semana' },
                    { id: 'month', label: 'Mês' },
                    { id: 'all', label: 'Tudo' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActivityFilter(filter.id as any)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                        activityFilter === filter.id 
                          ? "bg-background text-primary shadow-sm" 
                          : "text-muted-foreground hover:bg-background/50"
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 scrollbar-hide py-2">
                {(() => {
                  const now = new Date();
                  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                  const combinedActivity = [
                    ...activities.map(a => ({ ...a, activityType: 'LOG' as const, sortDate: new Date(a.date) })),
                    ...shipments.map(s => ({ ...s, activityType: 'SHIPMENT' as const, sortDate: new Date(s.date) })),
                  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

                  const filtered = combinedActivity.filter(item => {
                    if (activityFilter === 'today') return item.sortDate >= startOfDay;
                    if (activityFilter === 'week') return item.sortDate >= startOfWeek;
                    if (activityFilter === 'month') return item.sortDate >= startOfMonth;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <History className="h-12 w-12 opacity-20 mb-4" />
                        <p>Nenhuma movimentação neste período.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-border/50">
                      {filtered.map((item, idx) => {
                        const isLog = item.activityType === 'LOG';
                        const isShipment = item.activityType === 'SHIPMENT';
                        const isAddition = item.action === 'product_add' || item.message?.includes('Entrada');
                        const isRemoval = item.message?.includes('Saída') || isShipment;
                        
                        const getTargetUrl = () => {
                          if (isShipment) return '/app/shipments';
                          const entity = (item.entity || '').toLowerCase();
                          const action = (item.action || '').toLowerCase();
                          
                          const match = item.message?.match(/"([^"]+)"/);
                          const extractedName = match ? match[1] : null;

                          if (entity.includes('estoque') || entity.includes('categoria') || action.includes('product') || action.includes('category') || action.includes('inventory')) {
                            let url = '/app/inventory';
                            if (extractedName) {
                              if (action.includes('category') || entity.includes('categoria')) {
                                url += `?category=${encodeURIComponent(extractedName)}`;
                              } else {
                                url += `?search=${encodeURIComponent(extractedName)}`;
                              }
                            }
                            return url;
                          }
                          if (entity.includes('frota') || action.includes('vehicle') || action.includes('maintenance')) {
                            let url = '/app/fleet';
                            if (extractedName) {
                              url += `?search=${encodeURIComponent(extractedName)}`;
                            }
                            return url;
                          }
                          if (entity.includes('leads') || action.includes('lead')) {
                            let url = '/app/leads';
                            if (extractedName) {
                              url += `?search=${encodeURIComponent(extractedName)}`;
                            }
                            return url;
                          }
                          return null;
                        };
                        const targetUrl = getTargetUrl();
                        
                        return (
                          <div 
                            key={idx} 
                            onClick={() => {
                              if (targetUrl) {
                                navigate(targetUrl);
                                setIsActivityModalOpen(false);
                              }
                            }}
                            className={cn(
                              "p-4 flex gap-4 transition-all duration-200 group border-l-4 border-l-transparent",
                              targetUrl 
                                ? "cursor-pointer hover:bg-muted/60 active:bg-muted/80 hover:border-l-primary" 
                                : ""
                            )}
                            title={targetUrl ? `Clique para ir para ${
                              targetUrl.includes('shipments') ? 'Expedições' : 
                              targetUrl.includes('inventory') ? 'Estoque' : 
                              targetUrl.includes('fleet') ? 'Frota' : 'Leads'
                            }` : undefined}
                          >
                            <div className="mt-1 flex-shrink-0">
                              {isAddition ? (
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
                                  <ArrowUpRight className="h-5 w-5" />
                                </div>
                              ) : isRemoval ? (
                                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm border border-rose-200">
                                  <ArrowDownRight className="h-5 w-5" />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm border border-slate-200">
                                  <Activity className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-widest",
                                  isAddition ? "text-emerald-600" : isRemoval ? "text-rose-600" : "text-muted-foreground"
                                )}>
                                  {isAddition ? 'ENTRADA / ADIÇÃO' : isRemoval ? 'SAÍDA / EXPEDIÇÃO' : item.entity}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 font-mono bg-muted/50 px-2 py-0.5 rounded">
                                  {format(item.sortDate, "HH:mm 'em' dd/MM", { locale: ptBR })}
                                </span>
                              </div>
                              
                              <h4 className="text-sm font-semibold text-foreground leading-tight">
                                {isLog ? item.message : 
                                 isShipment ? `Expedição p/ ${item.destination}` : 
                                 item.message}
                              </h4>
                              
                              <div className="mt-2 flex items-center gap-3">
                                {item.userName && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 w-fit px-1.5 py-0.5 rounded border border-border/50">
                                    <User className="h-3 w-3" />
                                    <span>{item.userName}</span>
                                  </div>
                                )}
                                
                                {isShipment && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase">
                                    <Package className="h-3 w-3" />
                                    {item.items} itens
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {targetUrl && (
                              <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pl-2 text-primary flex-shrink-0">
                                <ChevronRight className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 border-t bg-muted/20 flex justify-end">
                 <button 
                  onClick={() => setIsActivityModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-6 transition-colors shadow-lg shadow-primary/20"
                >
                  Fechar Histórico
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isQcModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => setIsQcModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 border border-primary/10"
            >
              <div className="p-6 border-b bg-muted/20 relative">
                <button 
                  onClick={() => setIsQcModalOpen(false)}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
                  id="close-qc-panel-btn"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex flex-col text-left">
                    <h3 className="text-xl font-extrabold tracking-tight text-foreground">Controle de Qualidade de Produtos</h3>
                    <p className="text-xs text-muted-foreground">
                      Auditorias sensoriais, conformidades físicas de estruturas, assinaturas eletrônicas e laudos de lotes.
                    </p>
                  </div>
                </div>

                {/* Tabs selection selectors */}
                <div className="flex gap-2 mt-6 bg-muted/40 p-1 rounded-xl border max-w-sm">
                  <button
                    onClick={() => setQcTab('nova')}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                      qcTab === 'nova' 
                        ? "bg-background text-emerald-600 shadow-sm border border-emerald-500/10" 
                        : "text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" /> Nova Avaliação
                  </button>
                  <button
                    onClick={() => setQcTab('historico')}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
                      qcTab === 'historico' 
                        ? "bg-background text-indigo-600 shadow-sm border border-indigo-500/10" 
                        : "text-muted-foreground hover:bg-background/50"
                    )}
                  >
                    <History className="h-3.5 w-3.5" /> Histórico ({reports.length})
                  </button>
                </div>
              </div>

              {/* Modal Body content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {qcTab === 'nova' ? (
                  <form onSubmit={handleSaveQcReport} className="space-y-6 text-left">
                    {/* General section */}
                    <div className="grid gap-4 sm:grid-cols-3 bg-muted/10 p-4 rounded-xl border border-border/60">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Nome do Produto</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            list="qc-inventory-presets"
                            placeholder="Selecione ou digite o nome do produto..." 
                            value={qcProductName}
                            onChange={(e) => setQcProductName(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <datalist id="qc-inventory-presets">
                          </datalist>
                          <span className="absolute right-2.5 top-2 py-0.5 px-1.5 text-[9px] bg-muted text-muted-foreground rounded font-mono pointer-events-none uppercase">Presert/Estoque</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Tipo da Avaliação</label>
                        <select 
                          value={qcType}
                          onChange={(e: any) => setQcType(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="LOTE">Análise de Lote</option>
                          <option value="PRODUTO">Produto Solto</option>
                          <option value="CAIXA">Caixa Fechada</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Nome do Almoxarife Avaliador / Responsável</label>
                        <input 
                          type="text" 
                          placeholder="Digite seu nome completo..." 
                          value={qcInspectorName}
                          onChange={(e) => setQcInspectorName(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Criteria checklist */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="text-xs font-black uppercase text-foreground tracking-widest flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-emerald-500" />
                          Critério Estrutural de Integridade Física
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">100% Mandatório</span>
                      </div>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { id: 'corrosion', label: 'Livre de Corrosão / Oxidação', desc: 'Material isento de ferrugem ativa ou oxidação severa', state: structureNoCorrosion, setter: setStructureNoCorrosion },
                          { id: 'holes', label: 'Ausência de Furos / Frestas', desc: 'Estrutura maciça, sem furos desproporcionais ou aberturas', state: structureNoHoles, setter: setStructureNoHoles },
                          { id: 'cracks', label: 'Isento de Rachaduras / Trincas', desc: 'Integridade física intacta sob superfícies e junções', state: structureNoCracks, setter: setStructureNoCracks },
                          { id: 'flaws', label: 'Ausência de Rebarbas / Deformações', desc: 'Material moldado regularmente sem falhas no design', state: structureNoFlaws, setter: setStructureNoFlaws }
                        ].map((c) => (
                          <div 
                            key={c.id} 
                            onClick={() => c.setter(!c.state)}
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none",
                              c.state 
                                ? "bg-emerald-500/5 border-emerald-500/30 shadow-sm" 
                                : "hover:bg-muted/30 hover:border-border"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded mt-0.5 flex items-center justify-center transition-all border",
                              c.state ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted"
                            )}>
                              {c.state && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-xs font-bold text-foreground leading-tight">{c.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{c.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Seals Verification section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-foreground tracking-widest border-b pb-2 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-indigo-500" />
                        Autenticação de Selos Regulamentares (Se houver no produto)
                      </h4>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Selo do Inmetro</label>
                          <select 
                            value={hasImetro}
                            onChange={(e: any) => setHasImetro(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                          >
                            <option value="SIM">SIM (Certificado e visível)</option>
                            <option value="NAO">NÃO (Faltando / ilegível)</option>
                            <option value="NA">Não se aplica (N/A)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Laudo / Selo Laboratório</label>
                          <select 
                            value={hasLabSeal}
                            onChange={(e: any) => setHasLabSeal(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                          >
                            <option value="SIM">SIM (Certificado e visível)</option>
                            <option value="NAO">NÃO (Faltando / ilegível)</option>
                            <option value="NA">Não se aplica (N/A)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Selos Gerais de Segurança</label>
                          <select 
                            value={hasSafetySeals}
                            onChange={(e: any) => setHasSafetySeals(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                          >
                            <option value="SIM">SIM (Certificado e visível)</option>
                            <option value="NAO">NÃO (Faltando / ilegível)</option>
                            <option value="NA">Não se aplica (N/A)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Observacoes */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase text-foreground tracking-widest flex items-center gap-1">Observações Técnicas Complementares</label>
                      <textarea
                        rows={2}
                        placeholder="Caso o lote apresente inconformidade, detalhe aqui as rebarbas, amassados ou rasuras observadas..."
                        value={qcNotes}
                        onChange={(e) => setQcNotes(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Verdict approved or disapproved */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div 
                        onClick={() => setQcStatus('APPROVED')}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all cursor-pointer text-center relative overflow-hidden flex flex-col items-center justify-center space-y-1",
                          qcStatus === 'APPROVED' 
                            ? "bg-emerald-500/10 border-emerald-500 shadow-md scale-[1.02]" 
                            : "bg-background border-muted hover:border-gray-300"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                          <Check className="h-5 w-5 stroke-[3]" />
                        </div>
                        <span className="font-extrabold text-sm text-emerald-700">LOTE APROVADO</span>
                        <span className="text-[10px] text-emerald-600/80">Conforme com todos os manuais técnicos de segurança.</span>
                      </div>

                      <div 
                        onClick={() => setQcStatus('DISAPPROVED')}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all cursor-pointer text-center relative overflow-hidden flex flex-col items-center justify-center space-y-1",
                          qcStatus === 'DISAPPROVED' 
                            ? "bg-rose-500/10 border-rose-500 shadow-md scale-[1.02]" 
                            : "bg-background border-muted hover:border-gray-300"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-600">
                          <X className="h-5 w-5 stroke-[3]" />
                        </div>
                        <span className="font-extrabold text-sm text-rose-700">LOTE REPROVADO</span>
                        <span className="text-[10px] text-rose-600/80">Apresenta falhas de rebarbas, corrosão ou falta de selos regulamentados.</span>
                      </div>
                    </div>

                    {/* Digital signature canvas identical to EPI page */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase text-stone-700 tracking-wider flex items-center gap-1.5">
                          <PenTool className="h-4 w-4 text-stone-500" /> Assinatura Digital de Fiscalização Geral
                        </label>
                        <button 
                          type="button"
                          onClick={clearQcCanvas}
                          className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Limpar pauta
                        </button>
                      </div>

                      <div className="relative h-44 bg-white rounded-xl border-2 border-stone-200/85 p-1 flex flex-col justify-center overflow-hidden">
                        <canvas
                          ref={qcCanvasRef}
                          onPointerDown={startQcDrawing}
                          onPointerMove={drawQc}
                          onPointerUp={stopQcDrawing}
                          onPointerLeave={stopQcDrawing}
                          className="w-full h-full cursor-crosshair touch-none bg-white"
                          style={{ touchAction: "none" }}
                        />

                        {/* Sign indicators */}
                        {!hasQcSigned && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-stone-300 select-none text-center p-6 space-y-1.5">
                            <PenTool className="h-8 w-8 text-stone-300 animate-pulse" />
                            <p className="text-xs font-semibold text-stone-400">Pressione e deslize para assinar</p>
                            <p className="text-[10px] text-stone-400/80">(Equivalente aesthetics à assinatura de EPI)</p>
                          </div>
                        )}

                        <div className="absolute bottom-6 left-6 right-6 border-b border-dashed border-stone-300 pointer-events-none flex flex-col items-center">
                          <span className="text-[9px] text-stone-400 bg-white px-2 -mb-1.5 select-none font-medium">
                            ASSINATURA DIGITAL DO ALMOXARIFE RESPONSÁVEL
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Submit footer */}
                    <div className="flex justify-end gap-3 border-t pt-4">
                      <button
                        type="button"
                        onClick={() => setIsQcModalOpen(false)}
                        className="rounded-lg text-sm font-semibold border bg-background hover:bg-muted h-10 px-5 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg text-sm font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-8 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        Salvar e Analisar Lote <Check className="h-4 w-4 stroke-[3]" />
                      </button>
                    </div>
                  </form>
                ) : (
                  // History reports panel
                  <div className="space-y-4 text-left">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Buscar por lote, produto ou inspetor responsável..." 
                        value={qcSearch}
                        onChange={(e) => setQcSearch(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {reports.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl flex flex-col items-center justify-center">
                        <ClipboardCheck className="h-12 w-12 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Nenhum laudo registrado neste armazém.</p>
                        <p className="text-xs opacity-70">Acesse a aba 'Nova Avaliação' para auditar mercadorias.</p>
                      </div>
                    ) : (() => {
                      const filteredReports = reports.filter(r => 
                        r.productName?.toLowerCase().includes(qcSearch.toLowerCase()) ||
                        r.inspectorName?.toLowerCase().includes(qcSearch.toLowerCase()) ||
                        r.type?.toLowerCase().includes(qcSearch.toLowerCase()) ||
                        r.status?.toLowerCase().includes(qcSearch.toLowerCase())
                      );

                      if (filteredReports.length === 0) {
                        return (
                          <div className="text-center py-12 text-muted-foreground">
                            Nenhum relatório encontrado para "{qcSearch}".
                          </div>
                        );
                      }

                      return (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {filteredReports.map((report) => (
                            <div 
                              key={report.id}
                              className={cn(
                                "rounded-xl border p-4 flex flex-col justify-between shadow-sm transition-all hover:shadow-md hover:border-foreground/25",
                                report.status === 'APPROVED' ? "border-emerald-500/20 bg-emerald-500/[0.01]" : "border-rose-500/20 bg-rose-500/[0.01]"
                              )}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-muted-foreground bg-muted p-1 rounded">
                                      {report.type}
                                    </span>
                                    <h4 className="text-base font-bold text-foreground mt-1.5 leading-tight">{report.productName}</h4>
                                  </div>

                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1",
                                    report.status === 'APPROVED' 
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                                      : "bg-rose-100 text-rose-800 border border-rose-200"
                                  )}>
                                    {report.status === 'APPROVED' ? 'APROVADO' : 'REPROVADO'}
                                  </span>
                                </div>

                                <div className="text-xs space-y-1 text-muted-foreground">
                                  <p className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" /> Inspetor: <strong className="text-foreground">{report.inspectorName}</strong>
                                  </p>
                                  <p className="flex items-center gap-1 font-mono text-[10px]">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {format(new Date(report.date), "dd MMMM yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>

                                {/* Checklist summaries brief */}
                                <div className="border-t pt-2 grid grid-cols-2 gap-1 text-[10px]">
                                  <div className="flex items-center gap-1">
                                    <span className={cn("w-2 h-2 rounded-full", report.structureStatus ? "bg-emerald-500" : "bg-destructive")} />
                                    <span>Estrutura 100%: {report.structureStatus ? 'OK' : 'Falha'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className={cn("w-2 h-2 rounded-full", report.hasImetro === 'SIM' ? "bg-emerald-500" : report.hasImetro === 'NA' ? "bg-stone-300" : "bg-destructive")} />
                                    <span>Inmetro: {report.hasImetro}</span>
                                  </div>
                                  <div className="flex items-center gap-1 col-span-2">
                                    <span className={cn("w-2 h-2 rounded-full", report.hasSafetySeals === 'SIM' ? "bg-emerald-500" : "bg-stone-300")} />
                                    <span>Demais marcas gravadas: {report.hasSafetySeals}</span>
                                  </div>
                                </div>

                                {/* Observations preview */}
                                {report.notes && (
                                  <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded italic line-clamp-2 border">
                                    "{report.notes}"
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t pt-3 mt-4">
                                <button 
                                  onClick={() => handleDeleteQcReport(report.id)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                                  title="Excluir Auditoria"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                
                                <button 
                                  onClick={() => downloadQcPdf(report)}
                                  className="inline-flex items-center justify-center text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 px-4 transition-all gap-1.5 shadow-sm shadow-indigo-500/10"
                                >
                                  <Download className="h-3 w-3" /> Exportar Laudo PDF
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* General footer */}
              <div className="p-4 border-t bg-muted/20 flex justify-end">
                <button 
                  onClick={() => setIsQcModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg text-xs font-bold bg-secondary hover:bg-secondary/80 h-9 px-6 transition-colors"
                >
                  Fechar Painel Geral
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
