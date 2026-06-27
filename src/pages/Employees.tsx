import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Search, Plus, X, Trash2, IdCard, ClipboardCheck, 
  PenTool, Check, Upload, Clock, Ban, Camera, RefreshCw, 
  ZoomIn, ZoomOut, Maximize2, Pencil, Share2, Mail, 
  MessageCircle, FileDown, Smartphone, Printer, Building 
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { useTheme } from "../components/ThemeProvider";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface EPILog {
  id: string;
  epiName: string;
  brand: string;
  caNumber: string;
  requestDate: string;  // Data de requisição
  deliveryDate: string; // Data de entrega
  returnDate?: string;  // Data de devolução (opcional)
  signature: string;    // Base64 data URL
}

interface Employee {
  id: string;
  name: string;
  role: string;
  age: number;
  tools: string[];
  photoUrl: string; // Base64 or standard URL
  epis: EPILog[];
  rg?: string;
  admissionDate?: string;
  sector?: string;
  regional?: string;
}

const generateRobertoSignature = () => {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "italic 24px 'Courier New', cursive, sans-serif";
    ctx.fillStyle = "#1e3a8a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Roberto de S. Gonçalves", 200, 45);
    
    ctx.beginPath();
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 1.8;
    ctx.moveTo(35, 62);
    ctx.quadraticCurveTo(150, 75, 250, 60);
    ctx.quadraticCurveTo(310, 50, 365, 68);
    ctx.stroke();
    return canvas.toDataURL("image/png");
  }
  return "";
};

const getRobertoEmployee = (): Employee => {
  const sig = generateRobertoSignature();
  return {
    id: "emp-roberto-sousa",
    name: "ROBERTO DE SOUSA GONÇALVES",
    role: "MONTADOR",
    age: 41,
    tools: ["EPI", "Chave de Fenda", "Alicate Decapador", "Esmerilhadeira"],
    photoUrl: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=250&q=80",
    rg: "5080355",
    admissionDate: "2015-09-01",
    sector: "OPERACIONAL",
    regional: "NORTE",
    epis: [
      {
        id: "epi-01",
        epiName: "Bota de PVC Impermeável Bracol Y991 CA 12601",
        brand: "Y991",
        caNumber: "12601",
        requestDate: "2026-03-30",
        deliveryDate: "2026-03-30",
        signature: sig
      },
      {
        id: "epi-02",
        epiName: "Óculos de Proteção Incolor CA 30491",
        brand: "OA",
        caNumber: "30491",
        requestDate: "2026-02-27",
        deliveryDate: "2026-02-27",
        signature: sig
      },
      {
        id: "epi-03",
        epiName: "Respirador Semifacial Descartável CA 31191",
        brand: "AlmoxPro",
        caNumber: "31191",
        requestDate: "2026-02-21",
        deliveryDate: "2026-02-21",
        signature: sig
      },
      {
        id: "epi-04",
        epiName: "Avental de Raspa de Couro CA 34991",
        brand: "AlmoxPro",
        caNumber: "34991",
        requestDate: "2026-03-10",
        deliveryDate: "2026-03-10",
        signature: sig
      },
      {
        id: "epi-05",
        epiName: "Protetor Auditivo Tipo Concha CA 23033",
        brand: "AlmoxPro",
        caNumber: "23033",
        requestDate: "2026-04-03",
        deliveryDate: "2026-04-03",
        signature: sig
      },
      {
        id: "epi-06",
        epiName: "Luva de Proteção Nitrílica CA 59148",
        brand: "AlmoxPro",
        caNumber: "59148",
        requestDate: "2026-04-01",
        deliveryDate: "2026-04-01",
        signature: sig
      },
      {
        id: "epi-07",
        epiName: "Sapato de Segurança de Couro (Medida 38) CA 42330",
        brand: "AlmoxPro",
        caNumber: "42330",
        requestDate: "2026-08-01",
        deliveryDate: "2026-08-01",
        returnDate: "2026-04-30",
        signature: sig
      },
      {
        id: "epi-08",
        epiName: "Capacete de Proteção com Jugular CA 06942",
        brand: "AlmoxPro",
        caNumber: "06942",
        requestDate: "2026-03-29",
        deliveryDate: "2026-03-29",
        returnDate: "2026-08-29",
        signature: sig
      },
      {
        id: "epi-09",
        epiName: "Máscara de Solda Escurecimento Automático CA 57450",
        brand: "AlmoxPro",
        caNumber: "57450",
        requestDate: "2026-05-23",
        deliveryDate: "2026-05-23",
        returnDate: "2026-09-23",
        signature: sig
      },
      {
        id: "epi-10",
        epiName: "Luva de Raspa de Couro (Cano Longo) CA 40490",
        brand: "AlmoxPro",
        caNumber: "40490",
        requestDate: "2026-05-24",
        deliveryDate: "2026-05-24",
        signature: sig
      }
    ]
  };
};

const defaultEmployees: Employee[] = [getRobertoEmployee()];

export function Employees() {
  const { orgId } = useOrganization();
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Company customized settings for documentation outputs
  const [companySettings, setCompanySettings] = useState({
    companyName: "Almox pro - Gestão",
    cnpj: "00.000.000/0001-00",
    avatarUrl: "",
    email: "contato@almoxpro.com.br",
    phone: "(11) 4002-8922"
  });

  useEffect(() => {
    const fetchCompanySettings = async () => {
      if (!orgId) return;
      try {
        const docRef = doc(db, `organizations/${orgId}/settings`, "default");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCompanySettings(docSnap.data() as any);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações nas fichas:", err);
      }
    };
    fetchCompanySettings();
  }, [orgId]);

  // Active employee for Ficha de EPI document export
  const [exportingEmployee, setExportingEmployee] = useState<Employee | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  // Modals / global states
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [showSuccessEpiToast, setShowSuccessEpiToast] = useState(false);

  // Active form inside a specific card
  const [activeEpiFormEmpId, setActiveEpiFormEmpId] = useState<string | null>(null);
  
  // Inline return date registry state
  const [activeReturnEpi, setActiveReturnEpi] = useState<{ employeeId: string; epiId: string } | null>(null);
  const [inlineReturnDate, setInlineReturnDate] = useState(() => new Date().toISOString().split("T")[0]);

  // States to edit an existing EPI
  const [editingEpi, setEditingEpi] = useState<{ employeeId: string; epiId: string } | null>(null);
  const [editEpiName, setEditEpiName] = useState("");
  const [editEpiBrand, setEditEpiBrand] = useState("");
  const [editEpiCa, setEditEpiCa] = useState("");
  const [editEpiRequestDate, setEditEpiRequestDate] = useState("");
  const [editEpiDeliveryDate, setEditEpiDeliveryDate] = useState("");
  const [editEpiReturnDate, setEditEpiReturnDate] = useState("");

  // New Employee form inputs
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newAge, setNewAge] = useState<number | "">("");
  const [newToolsInput, setNewToolsInput] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newRg, setNewRg] = useState("");
  const [newAdmissionDate, setNewAdmissionDate] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newRegional, setNewRegional] = useState("");

  // New EPI form inputs (embedded in card)
  const [newEpiName, setNewEpiName] = useState("");
  const [newEpiBrand, setNewEpiBrand] = useState("");
  const [newEpiCa, setNewEpiCa] = useState("");
  const [newEpiRequestDate, setNewEpiRequestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newEpiDeliveryDate, setNewEpiDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Drawing Canvas controls
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number; pressure: number; time: number; width: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [tempSignature, setTempSignature] = useState("");
  const [epiFormErrors, setEpiFormErrors] = useState<{
    name?: boolean;
    brand?: boolean;
    ca?: boolean;
    signature?: boolean;
  }>({});

  // Toast customization content state
  const [toastTitle, setToastTitle] = useState("Salvo com Sucesso!");
  const [toastDescription, setToastDescription] = useState("O registro do EPI e o termo assinado foram salvos.");

  // Real-time camera capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraEmpId, setCameraEmpId] = useState<string | null>(null); // "NEW" or existing employee.id
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Photo Zoom Expansion Lightbox State
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [zoomedPhotoName, setZoomedPhotoName] = useState("");
  const [photoZoomScale, setPhotoZoomScale] = useState(1);

  // Dynamically resize full-screen signature canvas on mount
  useEffect(() => {
    if (!isSignatureModalOpen) return;
    
    // Give canvas helper timer to ensure DOM and layout container are fully rendered
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = isSignatureModalOpen ? "#0f172a" : (theme === "dark" ? "#60a5fa" : "#1e40af");
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isSignatureModalOpen, theme]);

  // -------------------------------------------------------------
  // SHARING & EXPORT CHANNELS: PDF, EMAIL, WHATSAPP
  // -------------------------------------------------------------
  const downloadEpiPdf = (emp: Employee) => {
    if (isDemoMode) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Colors & settings
      const margin = 10;
      let y = 15;

      // Header Container border
      doc.setDrawColor(180, 187, 196);
      doc.rect(margin, y, 190, 25);

      // Logo or text placeholder
      if (companySettings.avatarUrl) {
        try {
          doc.addImage(companySettings.avatarUrl, "JPEG", margin + 2, y + 2, 21, 21);
        } catch (e) {
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10);
          doc.text(companySettings.companyName.substring(0, 15), margin + 3, y + 13);
        }
      } else {
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text(companySettings.companyName.substring(0, 15), margin + 3, y + 13);
      }

      // Vertical separator
      doc.line(margin + 25, y, margin + 25, y + 25);

      // Title header terms
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("FICHA DE CONTROLE DE EPI", margin + 30, y + 8);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text("EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - NR 06", margin + 30, y + 13);
      doc.text(`Empresa: ${companySettings.companyName} | CNPJ: ${companySettings.cnpj}`, margin + 30, y + 18);
      doc.text(`Email: ${companySettings.email} | Tel: ${companySettings.phone}`, margin + 30, y + 23);

      y += 28;

      // Employee metadata sub-header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, 190, 8, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("DADOS DO COLABORADOR", margin + 2, y + 5.5);

      y += 8;
      doc.rect(margin, y, 190, 24); // border surrounding collaborator details

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      
      // Col 1
      doc.setFont("Helvetica", "bold");
      doc.text("Nome: ", margin + 2, y + 6);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.name, margin + 12, y + 6);
      
      doc.setFont("Helvetica", "bold");
      doc.text("Admissão: ", margin + 110, y + 6);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.admissionDate ? emp.admissionDate.split("-").reverse().join("/") : "Não cadastrada", margin + 126, y + 6);

      // Row 2: RG, Setor, Regional
      doc.setFont("Helvetica", "bold");
      doc.text("RG: ", margin + 2, y + 14);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.rg || "Não cadastrado", margin + 8, y + 14);

      doc.setFont("Helvetica", "bold");
      doc.text("Setor: ", margin + 60, y + 14);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.sector || "Não cadastrado", margin + 70, y + 14);

      doc.setFont("Helvetica", "bold");
      doc.text("Regional: ", margin + 120, y + 14);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.regional || "Não cadastrado", margin + 135, y + 14);

      // Row 3: Cargo, Idade
      doc.setFont("Helvetica", "bold");
      doc.text("Cargo: ", margin + 2, y + 21);
      doc.setFont("Helvetica", "normal");
      doc.text(emp.role, margin + 12, y + 21);

      doc.setFont("Helvetica", "bold");
      doc.text("Idade: ", margin + 120, y + 21);
      doc.setFont("Helvetica", "normal");
      doc.text(`${emp.age} anos`, margin + 130, y + 21);

      y += 28;

      // NR-06 Clause declaration segment
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("TERMO DE RESPONSABILIDADE E DECLARAÇÃO (NR-06)", margin, y + 4);
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(7);
      const declarationText = "Declaro para os devidos fins de direito que recebi do meu empregador, de forma gratuita, os Equipamentos de Proteção Individual (EPIs) adequados para o desempenho seguro das minhas atividades profissionais. Comprometo-me a higienizá-los, mantê-los conservados e sob minha guarda pessoal, usá-los obrigatoriamente no período laboral e a comunicar qualquer desgaste ou danificação para reposição imediata, cumprindo rigorosamente as orientações do artigo 158 da CLT e NR-06.";
      const lines = doc.splitTextToSize(declarationText, 190);
      doc.text(lines, margin, y + 8);

      y += 20;

      // Lists registered equipment under tabular layout
      const tableHeaders = ["CÓD/EPI", "ESPECIFICAÇÃO DO EQUIPAMENTO", "C.A", "ENTREGUE", "DEVOLVIDO", "ASSINATURA"];
      
      const tableBody = (emp.epis || []).map((epiLog) => [
        epiLog.id,
        `${epiLog.epiName} (Marca: ${epiLog.brand})`,
        epiLog.caNumber,
        epiLog.deliveryDate.split("-").reverse().join("/"),
        epiLog.returnDate ? epiLog.returnDate.split("-").reverse().join("/") : "Em uso",
        "" // Rendered inline in didDrawCell
      ]);

      autoTable(doc, {
        head: [tableHeaders],
        body: tableBody,
        startY: y,
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          fontSize: 7.5,
          valign: "middle",
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 17, halign: "center" },
          1: { cellWidth: 78 },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 22, halign: "center" },
          5: { cellWidth: 33 } // signature placeholder width
        },
        didDrawCell: (data: any) => {
          if (data.column.index === 5 && data.cell.section === "body") {
            const rowIndex = data.row.index;
            const epiLog = emp.epis[rowIndex];
            if (epiLog && epiLog.signature) {
              try {
                doc.addImage(
                  epiLog.signature,
                  "PNG",
                  data.cell.x + 2,
                  data.cell.y + 1,
                  data.cell.width - 4,
                  data.cell.height - 2
                );
              } catch (err) {
                console.error("Erro ao desenhar assinatura no PDF:", err);
              }
            }
          }
        },
        margin: { left: margin, right: margin }
      });

      // Save Output
      doc.save(`Ficha_EPI_${emp.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Ocorreu um erro ao exportar o PDF de documentação.");
    }
  };

  const getEpiWhatsAppUrl = (emp: Employee) => {
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    
    // Lists deliveries
    const epiListText = (emp.epis || []).map((epi, idx) => {
      const returnStatus = epi.returnDate ? `Devolvido em ${epi.returnDate.split("-").reverse().join("/")}` : "Pendente (Em uso)";
      const signatureStatus = epi.signature ? "✔️ Assinado Digitalmente" : "❌ Assinatura Pendente";
      return `${idx + 1}. *EPI:* ${epi.epiName} | *C.A:* ${epi.caNumber} | *Marca:* ${epi.brand || "N/A"}\n   *Entregue:* ${epi.deliveryDate.split("-").reverse().join("/")}\n   *Status:* ${returnStatus}\n   *Assinatura:* ${signatureStatus}`;
    }).join("\n\n");

    const message = `📋 *ALMOXPRO - FICHA DE CONTROLE DE EPI (NR-06)* 📋\n\n` +
      `🏢 *EMPRESA:* \n` +
      `- *Nome:* ${companySettings.companyName}\n` +
      `- *CNPJ:* ${companySettings.cnpj}\n` +
      `- *Contato:* ${companySettings.email} | ${companySettings.phone}\n\n` +
      `👤 *COLABORADOR:* \n` +
      `- *Nome:* ${emp.name}\n` +
      `- *RG:* ${emp.rg || "Não cadastrado"}\n` +
      `- *Cargo/Função:* ${emp.role}\n` +
      `- *Setor/Dep:* ${emp.sector || "Não cadastrado"}\n` +
      `- *Regional:* ${emp.regional || "Não informada"}\n` +
      `- *Admissão:* ${emp.admissionDate ? emp.admissionDate.split("-").reverse().join("/") : "Não informada"}\n\n` +
      `⚖️ *TERMO DE RESPONSABILIDADE & DECLARAÇÃO:* \n` +
      `"Declaro que recebi gratuitamente os EPIs adequados para o desempenho seguro das minhas atividades profissionais. Comprometo-me a higienizá-los, mantê-los conservados e sob minha guarda, usá-los obrigatoriamente no período laboral e comunicar qualquer desgaste ou dano, cumprindo o art 158 da CLT e NR-06."\n\n` +
      `🛠️ *RELAÇÃO DE EQUIPAMENTOS ENTREGUES:* \n\n${epiListText || "_Nenhum EPI registrado no momento._"}\n\n` +
      `🔗 *AUTENTICIDADE CERTIFICADA DIGITALMENTE PELA PLATAFORMA ALMOXPRO*`;

    const encodedText = encodeURIComponent(message);
    return cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
  };

  const sendEpiEmail = (emp: Employee) => {
    if (isDemoMode) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    const epiListText = (emp.epis || []).map((epi, idx) => {
      const returnStatus = epi.returnDate ? `Devolvido em ${epi.returnDate.split("-").reverse().join("/")}` : "Pendente (Em uso)";
      return `${idx + 1}. EPI: ${epi.epiName} | CA: ${epi.caNumber} | Marca: ${epi.brand} | Entregue: ${epi.deliveryDate.split("-").reverse().join("/")} | Status: ${returnStatus}`;
    }).join("\n\n");

    const subject = `AlmoxPro - Ficha de Controle de EPI - ${emp.name}`;
    const body = `ALMOXPRO - FICHA DE CONTROLE DE EPI (NR-06)\n\n` +
      `EMPRESA:\n` +
      `Nome: ${companySettings.companyName}\n` +
      `CNPJ: ${companySettings.cnpj}\n\n` +
      `COLABORADOR:\n` +
      `Nome: ${emp.name}\n` +
      `RG: ${emp.rg || "Não cadastrado"}\n` +
      `Cargo/Função: ${emp.role}\n` +
      `Setor: ${emp.sector || "Não cadastrado"}\n` +
      `Regional: ${emp.regional || "Não cadastrada"}\n` +
      `Admissão: ${emp.admissionDate ? emp.admissionDate.split("-").reverse().join("/") : "Não informada"}\n\n` +
      `RELAÇÃO DE EPIS ENTREGUES:\n\n${epiListText || "Nenhum EPI registrado."}\n\n` +
      `Assinatura digitalizada e arquivada nos servidores Almoxpro de acordo com a NR-06.`;

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  };

  const isDemoMode = localStorage.getItem("isDemoMode") === "true";

  // Load and Listen to Employees
  useEffect(() => {
    if (isDemoMode) {
      const stored = localStorage.getItem("demo_employees");
      let list: Employee[] = [];
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (e) {
          list = defaultEmployees;
        }
      } else {
        list = defaultEmployees;
      }
      const robertoExists = list.some((emp) => emp.name.toUpperCase().includes("ROBERTO DE SOUSA"));
      if (!robertoExists) {
        list = [getRobertoEmployee(), ...list];
        localStorage.setItem("demo_employees", JSON.stringify(list));
      }
      setEmployees(list);
      return;
    }

    if (!orgId) return;
    const q = query(collection(db, `organizations/${orgId}/employees`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
        setEmployees(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/employees`);
      }
    );
    return () => unsub();
  }, [orgId, isDemoMode]);

  // Filtered employees listing
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        emp.role.toLowerCase().includes(term) ||
        emp.tools.some((t) => t.toLowerCase().includes(term))
    );
  }, [employees, searchTerm]);

  // Save Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newRole || !newAge) return;

    if (employeeToEdit) {
      const updatedEmp: Employee = {
        ...employeeToEdit,
        name: newName,
        role: newRole,
        age: Number(newAge),
        tools: newToolsInput ? newToolsInput.split(",").map((s) => s.trim()).filter(Boolean) : [],
        photoUrl: newPhotoUrl,
        rg: newRg,
        admissionDate: newAdmissionDate,
        sector: newSector,
        regional: newRegional
      };

      if (isDemoMode) {
        const updated = employees.map((emp) => emp.id === employeeToEdit.id ? updatedEmp : emp);
        setEmployees(updated);
        localStorage.setItem("demo_employees", JSON.stringify(updated));
        setIsAddEmployeeOpen(false);
        resetEmployeeForm();
        setEmployeeToEdit(null);
        setToastTitle("Salvo com sucesso!");
        setToastDescription("O cadastro do funcionário foi atualizado.");
        setShowSuccessEpiToast(true);
        setTimeout(() => setShowSuccessEpiToast(false), 3500);
        return;
      }

      if (!orgId) return;
      try {
        await setDoc(doc(db, `organizations/${orgId}/employees`, employeeToEdit.id), updatedEmp);
        setIsAddEmployeeOpen(false);
        resetEmployeeForm();
        setEmployeeToEdit(null);
        setToastTitle("Salvo com sucesso!");
        setToastDescription("O cadastro do funcionário foi atualizado.");
        setShowSuccessEpiToast(true);
        setTimeout(() => setShowSuccessEpiToast(false), 3500);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${employeeToEdit.id}`);
      }
      return;
    }

    const newEmp: Employee = {
      id: `EMP-${Date.now().toString().slice(-4)}`,
      name: newName,
      role: newRole,
      age: Number(newAge),
      tools: newToolsInput ? newToolsInput.split(",").map((s) => s.trim()).filter(Boolean) : [],
      photoUrl: newPhotoUrl,
      epis: [],
      rg: newRg,
      admissionDate: newAdmissionDate,
      sector: newSector,
      regional: newRegional
    };

    if (isDemoMode) {
      const updated = [...employees, newEmp];
      setEmployees(updated);
      localStorage.setItem("demo_employees", JSON.stringify(updated));
      setIsAddEmployeeOpen(false);
      resetEmployeeForm();
      setToastTitle("Salvo com sucesso!");
      setToastDescription("O cadastro do funcionário foi realizado e armazenado.");
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
      return;
    }

    if (!orgId) return;
    try {
      await setDoc(doc(db, `organizations/${orgId}/employees`, newEmp.id), newEmp);
      setIsAddEmployeeOpen(false);
      resetEmployeeForm();
      setToastTitle("Salvo com sucesso!");
      setToastDescription("O cadastro do funcionário foi realizado e armazenado.");
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `organizations/${orgId}/employees`);
    }
  };

  // Delete Employee
  const triggerDeleteEmployee = (emp: Employee) => {
    setEmployeeToDelete(emp);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    const cleanupStates = () => {
      setEmployees((prev) => prev.filter((e) => e.id !== employeeToDelete.id));
      if (activeEpiFormEmpId === employeeToDelete.id) {
        setActiveEpiFormEmpId(null);
      }
      if (activeReturnEpi?.employeeId === employeeToDelete.id) {
        setActiveReturnEpi(null);
      }
      if (editingEpi?.employeeId === employeeToDelete.id) {
        setEditingEpi(null);
      }
      if (employeeToEdit?.id === employeeToDelete.id) {
        setEmployeeToEdit(null);
      }
      setIsDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
    };

    if (isDemoMode) {
      const updated = employees.filter((e) => e.id !== employeeToDelete.id);
      localStorage.setItem("demo_employees", JSON.stringify(updated));
      cleanupStates();
      toast.success("Funcionário excluído com sucesso (Demo)!");
      return;
    }

    if (!orgId) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/employees`, employeeToDelete.id));
      
      // Apenas para garantir, se houvesse tabela employees no localDb no futuro, seria deletado aqui.
      // (Atualmente localDb tem apenas inventory, categorias e syncMeta)
      
      cleanupStates();
      toast.success("Funcionário excluído com sucesso!");
    } catch (err: any) {
      toast.error(`Erro ao excluir funcionário: ${err.message}`);
      handleFirestoreError(err, OperationType.DELETE, `organizations/${orgId}/employees/${employeeToDelete.id}`);
    }
  };

  // Handle Photopicker Upload with smart 200px compression to protect Firestore space
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const maxDimension = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
            setNewPhotoUrl(compressedBase64);
          } else {
            setNewPhotoUrl(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const resetEmployeeForm = () => {
    setNewName("");
    setNewRole("");
    setNewAge("");
    setNewToolsInput("");
    setNewPhotoUrl("");
    setNewRg("");
    setNewAdmissionDate("");
    setNewSector("");
    setNewRegional("");
  };

  // Modern Universal pointer signature board callbacks (fits stylus / touch flawlessly with high-fidelity smoothing)
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const baseWidth = 3.5;
    const press = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
    
    // Clear previous stroke points and insert original starting coordinate
    pointsRef.current = [{
      x,
      y,
      pressure: press,
      time: Date.now(),
      width: baseWidth
    }];

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = baseWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = isSignatureModalOpen ? "#0f172a" : (theme === "dark" ? "#60a5fa" : "#1e40af"); 
    
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const points = pointsRef.current;
    if (points.length === 0) return;

    const lastPoint = points[points.length - 1];
    
    // Calculate distance walked
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Filter duplicates or extreme subpixel noise
    if (dist < 1.2) return;

    const now = Date.now();
    const dt = now - lastPoint.time;
    const velocity = dist / (dt || 1);

    // Map velocity or device pressure to elegant varying pen width
    const minWidth = 1.8;
    const maxWidth = 5.2;
    
    let targetWidth = 3.2;
    const hasTruePressure = e.pressure !== undefined && e.pressure > 0 && e.pressure !== 0.5;

    if (hasTruePressure) {
      // Touch/Stylus pressure sensitivity
      targetWidth = minWidth + (maxWidth - minWidth) * e.pressure * 1.35;
    } else {
      // Mouse/Trackpad velocity sensitivity (moving faster = thinner ink stroke)
      targetWidth = Math.max(minWidth, maxWidth - Math.min(3.2, velocity) * 1.4);
    }

    // Apply low-pass smooth filtering to line width transitions
    const smoothedWidth = lastPoint.width * 0.72 + targetWidth * 0.28;

    const newPoint = {
      x,
      y,
      pressure: e.pressure !== undefined ? e.pressure : 0.5,
      time: now,
      width: smoothedWidth
    };
    points.push(newPoint);

    // Draw using quadratic Bezier curve interpolation around the midpoints
    ctx.strokeStyle = isSignatureModalOpen ? "#0f172a" : (theme === "dark" ? "#60a5fa" : "#1e40af");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (points.length > 2) {
      const p0 = points[points.length - 3];
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];

      // Coordinate midpoints
      const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      ctx.beginPath();
      ctx.moveTo(mid1.x, mid1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
      ctx.lineWidth = p1.width;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.lineWidth = smoothedWidth;
      ctx.stroke();
    }
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Capture signature from full-screen modal
  const saveSignatureFromModal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureBase64 = canvas.toDataURL("image/png");
    setTempSignature(signatureBase64);
    setIsSignatureModalOpen(false);
    if (epiFormErrors.signature) {
      setEpiFormErrors((prev) => ({ ...prev, signature: false }));
    }
  };

  // Submit and Save EPI inline inside the employee card
  const handleSaveEpiInline = async (employeeId: string) => {
    const errors: { name?: boolean; brand?: boolean; ca?: boolean; signature?: boolean } = {};
    if (!newEpiName || !newEpiName.trim()) errors.name = true;
    if (!newEpiBrand || !newEpiBrand.trim()) errors.brand = true;
    if (!newEpiCa || !newEpiCa.trim()) errors.ca = true;
    if (!tempSignature) errors.signature = true;

    if (Object.keys(errors).length > 0) {
      setEpiFormErrors(errors);
      return;
    }

    const newEpi: EPILog = {
      id: `EPI-${Date.now().toString().slice(-4)}`,
      epiName: newEpiName,
      brand: newEpiBrand,
      caNumber: newEpiCa,
      requestDate: newEpiRequestDate,
      deliveryDate: newEpiDeliveryDate,
      signature: tempSignature
    };

    const targetEmployee = employees.find((e) => e.id === employeeId);
    if (!targetEmployee) return;

    const updatedEpis = [newEpi, ...(targetEmployee.epis || [])];

    setToastTitle("Salvo com Sucesso!");
    setToastDescription("O registro do EPI e o termo assinado foram salvos.");

    if (isDemoMode) {
      const updatedList = employees.map((emp) =>
        emp.id === employeeId ? { ...emp, epis: updatedEpis } : emp
      );
      setEmployees(updatedList);
      localStorage.setItem("demo_employees", JSON.stringify(updatedList));
      setActiveEpiFormEmpId(null);
      resetEpiFormInputs();
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
      return;
    }

    if (!orgId) return;
    try {
      await updateDoc(doc(db, `organizations/${orgId}/employees`, employeeId), {
        epis: updatedEpis
      });
      setActiveEpiFormEmpId(null);
      resetEpiFormInputs();
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${employeeId}`);
    }
  };

  // Inline return date setter callback
  const handleRegisterReturnDate = async (employeeId: string, epiId: string) => {
    if (!inlineReturnDate) return;

    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    const updatedEpis = (employee.epis || []).map((epi) =>
      epi.id === epiId ? { ...epi, returnDate: inlineReturnDate } : epi
    );

    if (isDemoMode) {
      const updatedList = employees.map((emp) =>
        emp.id === employeeId ? { ...emp, epis: updatedEpis } : emp
      );
      setEmployees(updatedList);
      localStorage.setItem("demo_employees", JSON.stringify(updatedList));
      setActiveReturnEpi(null);
      return;
    }

    if (!orgId) return;
    try {
      await updateDoc(doc(db, `organizations/${orgId}/employees`, employeeId), {
        epis: updatedEpis
      });
      setActiveReturnEpi(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${employeeId}`);
    }
  };

  const handleSaveEditEpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEpi) return;
    const { employeeId, epiId } = editingEpi;

    if (!editEpiName.trim() || !editEpiBrand.trim() || !editEpiCa.trim() || !editEpiRequestDate || !editEpiDeliveryDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      setToastTitle("Erro de Validação");
      setToastDescription("Preencha todos os campos obrigatórios.");
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
      return;
    }

    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) {
      toast.error("Funcionário não encontrado.");
      return;
    }

    const updatedEpis = (employee.epis || []).map((epi) => {
      if (epi.id === epiId) {
        const updated: any = {
          ...epi,
          epiName: editEpiName.trim(),
          brand: editEpiBrand.trim(),
          caNumber: editEpiCa.trim(),
          requestDate: editEpiRequestDate,
          deliveryDate: editEpiDeliveryDate,
        };
        if (editEpiReturnDate && editEpiReturnDate.trim() !== "") {
          updated.returnDate = editEpiReturnDate;
        } else {
          // completely remove returnDate instead of passing undefined
          delete updated.returnDate;
        }
        return updated;
      }
      return epi;
    });

    setToastTitle("EPI Editado");
    setToastDescription("Dados atualizados com sucesso.");

    if (isDemoMode) {
      const updatedList = employees.map((emp) =>
        emp.id === employeeId ? { ...emp, epis: updatedEpis } : emp
      );
      setEmployees(updatedList);
      localStorage.setItem("demo_employees", JSON.stringify(updatedList));
      setEditingEpi(null);
      toast.success("EPI atualizado com sucesso!");
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
      return;
    }

    if (!orgId) {
      toast.error("ID da organização não encontrado.");
      return;
    }

    try {
      await updateDoc(doc(db, `organizations/${orgId}/employees`, employeeId), {
        epis: updatedEpis
      });
      setEditingEpi(null);
      toast.success("EPI atualizado com sucesso!");
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
    } catch (err) {
      toast.error("Ocorreu um erro ao atualizar o EPI.");
      handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${employeeId}`);
    }
  };

  const handleDeleteEpi = async (employeeId: string, epiId: string) => {
    if (!window.confirm("Tem certeza que deseja remover este EPI entregue? Esta ação não pode ser desfeita.")) {
      return;
    }

    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    const updatedEpis = (employee.epis || []).filter((epi) => epi.id !== epiId);

    setToastTitle("EPI Removido");
    setToastDescription("O registro do EPI foi excluído com sucesso.");

    if (isDemoMode) {
      const updatedList = employees.map((emp) =>
        emp.id === employeeId ? { ...emp, epis: updatedEpis } : emp
      );
      setEmployees(updatedList);
      localStorage.setItem("demo_employees", JSON.stringify(updatedList));
      setEditingEpi(null);
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
      return;
    }

    if (!orgId) return;
    try {
      await updateDoc(doc(db, `organizations/${orgId}/employees`, employeeId), {
        epis: updatedEpis
      });
      setEditingEpi(null);
      setShowSuccessEpiToast(true);
      setTimeout(() => setShowSuccessEpiToast(false), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${employeeId}`);
    }
  };

  const resetEpiFormInputs = () => {
    setNewEpiName("");
    setNewEpiBrand("");
    setNewEpiCa("");
    setNewEpiRequestDate(new Date().toISOString().split("T")[0]);
    setNewEpiDeliveryDate(new Date().toISOString().split("T")[0]);
    setTempSignature("");
    setHasSigned(false);
    setEpiFormErrors({});
  };

  // Start webcam and handle permissions or facing modes
  const startCamera = async (facing: "user" | "environment" = "user") => {
    setIsCameraLoading(true);
    setCameraError(null);
    setCapturedPhoto(null);
    setCameraFacingMode(facing);

    // Stop existing camera track if any is running
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.log("Play interrupted", e));
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Não foi possível acessar a câmera. Verifique as permissões de vídeo do seu navegador para este site."
      );
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Turn off camera stream and reset states
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCameraEmpId(null);
    setCapturedPhoto(null);
    setCameraError(null);
  };

  // Snapshot a centered square image from the video stream
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    // Use the maximum possible native square size from the live feed to avoid loss of detail
    const size = Math.min(video.videoWidth, video.videoHeight) || 1080;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Draw centered square
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

      // Export image at maximum resolution and high quality (0.95), skipping downscaling completely
      const base64 = canvas.toDataURL("image/jpeg", 0.95);
      setCapturedPhoto(base64);
    }
  };

  // Save the captured Base64 photo to Firestore or Demo Mode
  const saveCapturedPhoto = async () => {
    if (!capturedPhoto || !cameraEmpId) return;

    if (cameraEmpId === "NEW") {
      setNewPhotoUrl(capturedPhoto);
      stopCamera();
      return;
    }

    const targetEmployeeId = cameraEmpId;
    if (isDemoMode) {
      const updatedList = employees.map((emp) =>
        emp.id === targetEmployeeId ? { ...emp, photoUrl: capturedPhoto } : emp
      );
      setEmployees(updatedList);
      localStorage.setItem("demo_employees", JSON.stringify(updatedList));
    } else {
      if (!orgId) return;
      try {
        await updateDoc(doc(db, `organizations/${orgId}/employees`, targetEmployeeId), {
          photoUrl: capturedPhoto
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `organizations/${orgId}/employees/${targetEmployeeId}`);
      }
    }

    setToastTitle("Foto Registrada!");
    setToastDescription("A nova foto do funcionário foi salva.");
    setShowSuccessEpiToast(true);
    setTimeout(() => setShowSuccessEpiToast(false), 3500);

    stopCamera();
  };

  return (
    <div className="space-y-6 text-[hsl(var(--foreground))]">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe & Funcionários</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Monitore o quadro oficial de técnicos, ferramentas de uso diário e assine termos de entrega e devolução de EPIs diretamente em cada card.
          </p>
        </div>
        <Button 
          onClick={() => {
            setEmployeeToEdit(null);
            resetEmployeeForm();
            setIsAddEmployeeOpen(true);
          }} 
          className="self-start sm:self-center"
        >
          <Plus className="mr-2 h-4 w-4" /> Cadastrar Funcionário
        </Button>
      </div>

      {/* Filter and Search actions */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          placeholder="Buscar funcionário, cargo ou ferramentas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Grid of All Employees (A single self-contained Card per Employee is populated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          const hasEpis = emp.epis && emp.epis.length > 0;
          return (
            <Card
              key={emp.id}
              className="border border-border/80 bg-card overflow-hidden transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-5 flex-1 flex flex-col justify-between">
                
                {/* Employee Info Header block */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="relative group flex-shrink-0">
                      <div
                        onClick={() => {
                          if (emp.photoUrl) {
                            setZoomedPhotoUrl(emp.photoUrl);
                            setZoomedPhotoName(emp.name);
                            setPhotoZoomScale(1);
                          }
                        }}
                        className={cn(
                          "h-16 w-16 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center transition-all",
                          emp.photoUrl ? "cursor-zoom-in hover:opacity-80 hover:scale-105 active:scale-95" : ""
                        )}
                        title={emp.photoUrl ? "Clique para ampliar a foto" : undefined}
                      >
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.name}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-primary">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setCameraEmpId(emp.id);
                          setIsCameraOpen(true);
                          startCamera("user");
                        }}
                        className="absolute -bottom-1 -right-1 p-1 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg border border-background transition-transform duration-100 hover:scale-110"
                        title="Tirar foto em tempo real"
                        id={`btn-camera-emp-${emp.id}`}
                        type="button"
                      >
                        <Camera className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h2 className="font-bold text-base leading-snug truncate" title={emp.name}>
                          {emp.name}
                        </h2>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEmployeeToEdit(emp);
                              setNewName(emp.name);
                              setNewRole(emp.role);
                              setNewAge(emp.age);
                              setNewToolsInput(emp.tools ? emp.tools.join(", ") : "");
                              setNewPhotoUrl(emp.photoUrl || "");
                              setNewRg(emp.rg || "");
                              setNewAdmissionDate(emp.admissionDate || "");
                              setNewSector(emp.sector || "");
                              setNewRegional(emp.regional || "");
                              setIsAddEmployeeOpen(true);
                            }}
                            className="text-[hsl(var(--muted-foreground))] hover:text-primary p-1 rounded-md transition-colors"
                            title="Editar Funcionário"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => triggerDeleteEmployee(emp)}
                            className="text-[hsl(var(--muted-foreground))] hover:text-destructive p-1 rounded-md transition-colors"
                            title="Remover Funcionário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-primary font-semibold mt-0.5">{emp.role}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="inline-block px-1.5 py-0.5 bg-muted text-[10px] text-[hsl(var(--muted-foreground))] rounded font-medium">
                          {emp.age} anos
                        </span>
                        {emp.rg && (
                          <span className="inline-block px-1.5 py-0.5 bg-muted text-[10px] text-[hsl(var(--muted-foreground))] rounded font-medium" title="RG">
                            RG: {emp.rg}
                          </span>
                        )}
                        {emp.admissionDate && (
                          <span className="inline-block px-1.5 py-0.5 bg-muted text-[10px] text-[hsl(var(--muted-foreground))] rounded font-medium" title="Data de Admissão">
                            Adm: {emp.admissionDate.split("-").reverse().join("/")}
                          </span>
                        )}
                        {emp.sector && (
                          <span className="inline-block px-1.5 py-0.5 bg-muted text-[10px] text-[hsl(var(--muted-foreground))] rounded font-medium" title="Setor/Departamento">
                            Setor: {emp.sector}
                          </span>
                        )}
                        {emp.regional && (
                          <span className="inline-block px-1.5 py-0.5 bg-muted text-[10px] text-[hsl(var(--muted-foreground))] rounded font-medium" title="Regional">
                            Reg: {emp.regional}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tools/Materials frequent section */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] block">
                      Ferramentas & Materiais de Uso Frequente:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {emp.tools && emp.tools.length > 0 ? (
                        emp.tools.map((tool, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-[9px] font-medium py-0 px-1.5 border-border bg-muted/40"
                          >
                            {tool}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">Nenhum registrado</span>
                      )}
                    </div>
                  </div>

                  {/* Separator line inside the card */}
                  <hr className="border-border/80" />

                  {/* Registered EPI log items section with return dates and digital signatures */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                        <ClipboardCheck className="h-4 w-4 text-primary" /> EPIs Fornecidos ({emp.epis?.length || 0})
                      </h3>
                      {activeEpiFormEmpId !== emp.id && (
                        <button
                          onClick={() => {
                            setActiveEpiFormEmpId(emp.id);
                            resetEpiFormInputs();
                          }}
                          className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Registrar EPI
                        </button>
                      )}
                    </div>

                    {/* Scrollable list of EPIs directly inside the card */}
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {hasEpis ? (
                        emp.epis.map((apiLog) => (
                          <div
                            key={apiLog.id}
                            className="bg-muted/40 rounded-lg p-3 border border-border/80 space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-[13px] text-[hsl(var(--foreground))] truncate" title={apiLog.epiName}>
                                  {apiLog.epiName}
                                </p>
                                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                  Marca: <strong>{apiLog.brand}</strong> &nbsp;|&nbsp; C.A: <strong>{apiLog.caNumber}</strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEpi({ employeeId: emp.id, epiId: apiLog.id });
                                    setEditEpiName(apiLog.epiName);
                                    setEditEpiBrand(apiLog.brand);
                                    setEditEpiCa(apiLog.caNumber);
                                    setEditEpiRequestDate(apiLog.requestDate);
                                    setEditEpiDeliveryDate(apiLog.deliveryDate);
                                    setEditEpiReturnDate(apiLog.returnDate || "");
                                  }}
                                  className="p-1 text-primary hover:bg-primary/10 rounded transition-all"
                                  title="Editar EPI"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEpi(emp.id, apiLog.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                                  title="Excluir EPI"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Chronology timeline inside card */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-dashed border-border/50">
                              <p className="text-[hsl(var(--muted-foreground))]">
                                Requisitado: <strong className="text-[hsl(var(--foreground))]">{apiLog.requestDate.split("-").reverse().join("/")}</strong>
                              </p>
                              <p className="text-[hsl(var(--muted-foreground))]">
                                Entregue: <strong className="text-[hsl(var(--foreground))]">{apiLog.deliveryDate.split("-").reverse().join("/")}</strong>
                              </p>
                            </div>

                            {/* Return Date Status handler */}
                            <div className="pt-1.5 border-t border-dashed border-border/50 text-[11px]">
                              {apiLog.returnDate ? (
                                <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <Check className="h-3.5 w-3.5" /> Devolvido em: {apiLog.returnDate.split("-").reverse().join("/")}
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" /> Pendente de Devolução
                                  </p>
                                  
                                  {/* Return date quick inline form toggle */}
                                  {activeReturnEpi?.employeeId === emp.id && activeReturnEpi?.epiId === apiLog.id ? (
                                    <div className="flex items-center gap-1.5 p-1 bg-muted rounded border border-border">
                                      <input
                                        type="date"
                                        value={inlineReturnDate}
                                        onChange={(e) => setInlineReturnDate(e.target.value)}
                                        className="px-1.5 py-1 text-xs rounded bg-[hsl(var(--background))] border border-border focus:outline-none"
                                      />
                                      <button
                                        onClick={() => handleRegisterReturnDate(emp.id, apiLog.id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                        title="Salvar Devolução"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setActiveReturnEpi(null)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                        title="Cancelar"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setActiveReturnEpi({ employeeId: emp.id, epiId: apiLog.id });
                                        setInlineReturnDate(new Date().toISOString().split("T")[0]);
                                      }}
                                      className="text-[10px] text-primary hover:underline font-bold bg-primary/10 px-2 py-1 rounded"
                                    >
                                      Registrar Devolução
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Digital signature visualization inside card */}
                            {apiLog.signature && (
                              <div className="bg-card rounded p-1.5 border border-border/80 flex flex-col items-center justify-center h-12 mt-1">
                                <span className="text-[8px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] block mb-0.5">Assinatura Certificada</span>
                                <img
                                  src={apiLog.signature}
                                  alt="Assinatura"
                                  className="max-h-7 max-w-[150px] object-contain dark:invert"
                                />
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center border border-dashed border-border rounded-lg">
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">Nenhum EPI entregue cadastrado.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Documents button at the bottom of the card content */}
                  <div className="pt-3.5 border-t border-border/60 flex gap-2 mt-4">
                    <Button
                      onClick={() => {
                        setExportingEmployee(emp);
                        setIsExportModalOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 h-9 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>Exportar Ficha de EPI</span>
                    </Button>
                  </div>
                </div>

                {/* Inline Register EPI form inside card */}
                {activeEpiFormEmpId === emp.id && (
                  <div className="mt-4 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                        <PenTool className="h-3.5 w-3.5" /> Registrar Entrega para {emp.name.split(" ")[0]}
                      </h4>
                      <button
                        onClick={() => setActiveEpiFormEmpId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="space-y-1">
                        <label className="font-semibold text-muted-foreground">Nome do EPI</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Protetor Auricular C-30"
                          value={newEpiName}
                          onChange={(e) => {
                            setNewEpiName(e.target.value);
                            if (epiFormErrors.name) setEpiFormErrors(prev => ({ ...prev, name: false }));
                          }}
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded border bg-card focus:outline-none focus:ring-1 focus:ring-primary",
                            epiFormErrors.name ? "border-rose-500 ring-rose-500 ring-1" : "border-border"
                          )}
                        />
                        {epiFormErrors.name && (
                          <span className="text-[10px] text-rose-500 font-semibold block mt-0.5" id="epi-name-error">Nome do EPI é obrigatório</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Marca</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: 3M"
                            value={newEpiBrand}
                            onChange={(e) => {
                              setNewEpiBrand(e.target.value);
                              if (epiFormErrors.brand) setEpiFormErrors(prev => ({ ...prev, brand: false }));
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded border bg-card focus:outline-none focus:ring-1 focus:ring-primary",
                              epiFormErrors.brand ? "border-rose-500 ring-rose-500 ring-1" : "border-border"
                            )}
                          />
                          {epiFormErrors.brand && (
                            <span className="text-[10px] text-rose-500 font-semibold block mt-0.5" id="epi-brand-error">Marca é obrigatória</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">C.A do EPI</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: 42.189"
                            value={newEpiCa}
                            onChange={(e) => {
                              setNewEpiCa(e.target.value);
                              if (epiFormErrors.ca) setEpiFormErrors(prev => ({ ...prev, ca: false }));
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded border bg-card focus:outline-none focus:ring-1 focus:ring-primary",
                              epiFormErrors.ca ? "border-rose-500 ring-rose-500 ring-1" : "border-border"
                            )}
                          />
                          {epiFormErrors.ca && (
                            <span className="text-[10px] text-rose-500 font-semibold block mt-0.5" id="epi-ca-error">C.A é obrigatório</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Data Requisitado</label>
                          <input
                            type="date"
                            required
                            value={newEpiRequestDate}
                            onChange={(e) => setNewEpiRequestDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Data Entregue</label>
                          <input
                            type="date"
                            required
                            value={newEpiDeliveryDate}
                            onChange={(e) => setNewEpiDeliveryDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Full Screen High Resolution Signature Launcher */}
                      <div className="space-y-1.5 pt-1">
                        <label className="font-semibold text-muted-foreground">
                          Assinatura Digital {tempSignature ? "(Registrada)" : "(Obrigatória)"}
                        </label>
                        {tempSignature ? (
                          <div id="signature-preview-panel" className="bg-background rounded-lg border border-emerald-500/30 p-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Assinatura capturada!
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTempSignature("");
                                    setHasSigned(false);
                                  }}
                                  className="text-[10px] text-rose-500 hover:underline font-bold"
                                  id="clear-captured-signature-btn"
                                >
                                  Apagar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSignatureModalOpen(true);
                                    setHasSigned(true);
                                  }}
                                  className="text-[10px] text-primary hover:underline font-bold"
                                  id="redo-captured-signature-btn"
                                >
                                  Refazer
                                </button>
                              </div>
                            </div>
                            <div className="bg-card p-1 rounded border border-border flex items-center justify-center h-16">
                              <img
                                src={tempSignature}
                                alt="Assinatura Capturada"
                                className="max-h-12 max-w-full object-contain dark:invert"
                              />
                            </div>
                          </div>
                        ) : (
                          <div 
                            id="no-signature-panel" 
                            className={cn(
                              "flex flex-col items-center justify-center p-4 border border-dashed rounded-lg bg-background hover:bg-muted/10 transition-colors text-center space-y-2",
                              epiFormErrors.signature ? "border-rose-500 ring-rose-500/25 ring-1 bg-rose-50/5" : "border-border"
                            )}
                          >
                            <PenTool className={cn("h-5 w-5", epiFormErrors.signature ? "text-rose-500 animate-bounce" : "text-primary/70")} />
                            <div className="space-y-0.5">
                              <p className={cn("text-[11px] font-semibold", epiFormErrors.signature ? "text-rose-600" : "")}>Nenhuma assinatura registrada</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">Requer assinatura na tela do dispositivo</p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => {
                                setIsSignatureModalOpen(true);
                                setHasSigned(false);
                              }}
                              className={cn(
                                "h-8 text-xs text-white",
                                epiFormErrors.signature ? "bg-rose-600 hover:bg-rose-700" : "bg-primary hover:bg-primary/95"
                              )}
                              id="open-full-signature-btn"
                            >
                              <PenTool className="mr-1.5 h-3.5 w-3.5" /> Assinar em Tela Cheia
                            </Button>
                          </div>
                        )}
                        {epiFormErrors.signature && !tempSignature && (
                          <span className="text-[10px] text-rose-500 font-semibold block mt-0.5" id="epi-signature-error">A assinatura do funcionário é obrigatória</span>
                        )}
                      </div>
                    </div>
 
                    {/* Confirm cancel buttons inside card */}
                    <div className="flex justify-end gap-2 pt-1 border-t border-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setActiveEpiFormEmpId(null);
                          resetEpiFormInputs();
                        }}
                        id="cancel-epi-registrations-btn"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEpiInline(emp.id)}
                        className="bg-primary hover:bg-primary/95 text-xs text-white"
                        id="save-epi-registrations-btn"
                      >
                        Salvar EPI <Check className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Empty layout display */}
        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-border/80 rounded-2xl bg-card">
            <IdCard className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-base font-bold">Nenhum funcionário encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Clique em "Cadastrar Funcionário" no menu superior para criar um novo registro oficial da sua equipe.
            </p>
          </div>
        )}
      </div>

      {/* Add Employee Modal dialog */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-xl bg-card border-border animate-in fade-in zoom-in-95 duration-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <form onSubmit={handleSaveEmployee} className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <IdCard className="h-5 w-5 text-primary" /> {employeeToEdit ? "Editar Colaborador" : "Cadastrar Novo Colaborador"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEmployeeOpen(false);
                    setEmployeeToEdit(null);
                    resetEmployeeForm();
                  }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable container with paddings */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 pr-3 mr-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Souza"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">Função / Cargo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Supervisor Geral"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">Idade (anos)</label>
                    <input
                      type="number"
                      required
                      min="18"
                      max="100"
                      placeholder="Ex: 38"
                      value={newAge}
                      onChange={(e) => setNewAge(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">RG do Colaborador</label>
                    <input
                      type="text"
                      placeholder="Ex: 56.721.912-0"
                      value={newRg}
                      onChange={(e) => setNewRg(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">Data de Admissão</label>
                    <input
                      type="date"
                      value={newAdmissionDate}
                      onChange={(e) => setNewAdmissionDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">Setor / Departamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Administrativo"
                      value={newSector}
                      onChange={(e) => setNewSector(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1 overflow-visible">
                    <label className="text-xs font-semibold text-muted-foreground">Regional / Unidade</label>
                    <input
                      type="text"
                      placeholder="Ex: Norte"
                      value={newRegional}
                      onChange={(e) => setNewRegional(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Ferramentas & Equipamentos Frequentemente Utilizados (separados por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Esmerilhadeira Bosch, Inversora TIG, Multímetro"
                    value={newToolsInput}
                    onChange={(e) => setNewToolsInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Foto de Identificação</label>
                  <div className="flex items-center flex-wrap gap-2.5">
                    <label className="flex items-center gap-2 h-9 px-4 border border-border rounded-lg bg-background text-xs font-medium cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span>Selecionar Imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCameraEmpId("NEW");
                        setIsCameraOpen(true);
                        startCamera("user");
                      }}
                      className="flex items-center gap-2 h-9 px-3 border border-border rounded-lg bg-background text-xs font-medium hover:bg-muted/50 transition-colors"
                    >
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span>Tirar Foto</span>
                    </Button>
                    {newPhotoUrl ? (
                      <div 
                        onClick={() => {
                          setZoomedPhotoUrl(newPhotoUrl);
                          setZoomedPhotoName(employeeToEdit ? `${employeeToEdit.name} (Prévia)` : "Novo Colaborador (Prévia)");
                          setPhotoZoomScale(1);
                        }}
                        className="h-9 w-9 rounded-full bg-primary/10 overflow-hidden border border-primary/20 flex items-center justify-center cursor-zoom-in hover:opacity-85 transition-all hover:scale-105"
                        title="Clique para ampliar a prévia"
                      >
                        <img src={newPhotoUrl} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Nenhuma imagem carregada</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed bottom footer actions panel */}
              <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsAddEmployeeOpen(false);
                    setEmployeeToEdit(null);
                    resetEmployeeForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="bg-primary hover:bg-primary/95 text-xs text-white px-4 font-bold">
                  {employeeToEdit ? "Salvar Alterações" : "Salvar Cadastro"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Employee Confirmation Dialog */}
      {isDeleteConfirmOpen && employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-sm bg-card border-border p-4 space-y-4">
            <h3 className="font-bold text-sm">Remover funcionário?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você está removendo permanentemente o cadastro de <strong>{employeeToDelete.name}</strong> da equipe AlmoxPro. Todos os seus registros assinados de EPIs vinculados serão perdidos. Confirmar operação?
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="destructive" onClick={confirmDeleteEmployee}>
                Confirmar Exclusão
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Full-Screen Signature Modal Window */}
      {isSignatureModalOpen && (
        <div id="full-screen-signature-overlay" className="fixed inset-0 z-[100] bg-[#fbfbfb] flex flex-col justify-between p-4 md:p-6 animate-in fade-in duration-200">
          
          {/* Header block resembling a premium invoice or physical document title */}
          <div className="flex justify-between items-center bg-[#fbfbfb] border-b border-stone-200 pb-3">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                DOCUMENTO DE ASSINATURA DIGITAL de EPI
              </p>
              {(() => {
                const activeEmp = employees.find((e) => e.id === activeEpiFormEmpId);
                if (activeEmp) {
                  return (
                    <h2 className="text-base font-bold text-stone-800">
                      Termo de Entrega — {activeEmp.name}
                    </h2>
                  );
                }
                return <h2 className="text-base font-bold text-stone-800">Termo de Assinatura</h2>;
              })()}
            </div>
            <button
              onClick={() => setIsSignatureModalOpen(false)}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500 transition-colors"
              title="Fechar termo"
              id="close-full-signature-panel-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Interactive full-size white sheet canvas zone */}
          <div className="flex-1 my-4 flex flex-col justify-center relative bg-white rounded-xl shadow-md border border-stone-200/80 p-1 overflow-hidden">
            <canvas
              id="full-screen-signature-canvas"
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              className="w-full h-full cursor-crosshair touch-none bg-white"
              style={{ touchAction: "none" }}
            />
            
            {/* Visual sheet indicators */}
            {!hasSigned && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-stone-300 select-none text-center p-6 space-y-3">
                <PenTool className="h-10 w-10 text-stone-300 animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-stone-400">Área Livre de Assinatura</p>
                  <p className="text-xs text-stone-400/80">Assine utilizando o dedo, caneta stylus ou mouse</p>
                </div>
              </div>
            )}
            
            {/* Real physical document signature baseline indicator */}
            <div className="absolute bottom-12 left-10 right-10 border-b border-dashed border-stone-300 pointer-events-none flex flex-col items-center">
              <span className="text-[10px] text-stone-400 bg-white px-3 -mb-1.5 select-none font-medium">
                ASSINATURA DIGITAL DO COLABORADOR
              </span>
            </div>
          </div>

          {/* Clean minimal controls matching the white paper sheet theme */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#fbfbfb] border-t border-stone-200 pt-4">
            <p className="text-[11px] text-stone-400 max-w-sm text-center sm:text-left leading-normal font-medium">
              Caso a assinatura não tenha ficado legível, clique em "Apagar e Refazer" para reiniciar o preenchimento.
            </p>
            
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={clearCanvas}
                className="flex-1 sm:flex-initial text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-10 px-4 font-semibold flex items-center justify-center gap-1.5 bg-white shadow-sm border border-rose-200"
                id="clear-full-canvas-signature-btn"
              >
                <Trash2 className="h-4 w-4 text-rose-500" /> Apagar e Refazer
              </Button>
              <Button
                type="button"
                onClick={saveSignatureFromModal}
                disabled={!hasSigned}
                className="flex-1 sm:flex-initial text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-6 flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                id="confirm-full-canvas-signature-btn"
              >
                Salvar Assinatura <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Animated Success Toast Pop-up */}
      <AnimatePresence>
        {showSuccessEpiToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="fixed bottom-6 right-6 z-[150] flex items-center gap-3 bg-emerald-600 text-white px-5 py-4 rounded-xl shadow-2xl border border-emerald-500/20 max-w-sm"
            id="saved-epi-success-toast"
          >
            <div className="bg-white/20 p-1.5 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{toastTitle}</p>
              <p className="text-[11px] text-emerald-100">{toastDescription}</p>
            </div>
            <button
              onClick={() => setShowSuccessEpiToast(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/85"
              id="close-success-toast-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Camera Capture Modal */}
      {isCameraOpen && (
        <div id="camera-capture-overlay" className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-stone-900 border-stone-800 text-white shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 p-4 pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2 text-stone-100">
                  <Camera className="h-5 w-5 text-primary" /> Registrar Foto em Tempo Real
                </h3>
                <p className="text-[11px] text-stone-400">
                  {cameraEmpId === "NEW" ? "Capturar foto para novo colaborador" : "Atualizar foto do colaborador registrado"}
                </p>
              </div>
              <button
                onClick={stopCamera}
                className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video / Snapshot Viewport */}
            <div className="relative aspect-square w-full bg-stone-950 flex flex-col items-center justify-center overflow-hidden border-y border-stone-800">
              
              {isCameraLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-950 text-stone-400 space-y-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs">Inicializando câmera...</p>
                </div>
              )}

              {cameraError ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-950 px-6 text-center space-y-4">
                  <Ban className="h-10 w-10 text-rose-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-stone-200">Acesso à Câmera Negado</p>
                    <p className="text-xs text-stone-400 leading-relaxed">{cameraError}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startCamera(cameraFacingMode)}
                    className="bg-primary hover:bg-primary/95 text-xs text-white"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              ) : null}

              {/* Live stream video element */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-200",
                  capturedPhoto ? "hidden" : "block",
                  cameraFacingMode === "user" ? "scale-x-[-1]" : "" // mirror front camera
                )}
              />

              {/* Static Snapped Preview */}
              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Captured review"
                  className="w-full h-full object-cover animate-in fade-in duration-300"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Centered Target Mask Grid Overlay */}
              {!capturedPhoto && !cameraError && !isCameraLoading && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-11/12 h-11/12 border-2 border-dashed border-white/20 rounded-full animate-pulse flex items-center justify-center">
                    <div className="text-[10px] text-white/50 bg-black/40 px-2.5 py-1 rounded-full font-medium tracking-wide">
                      POSICIONE O ROSTO AQUI
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Row */}
            <div className="p-4 bg-stone-900 flex flex-col gap-3">
              {cameraError ? null : (
                <>
                  {!capturedPhoto ? (
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={stopCamera}
                        className="text-stone-300 hover:text-white hover:bg-stone-800 text-xs flex-1 h-9"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => startCamera(cameraFacingMode === "user" ? "environment" : "user")}
                        className="bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs border border-stone-700 hover:border-stone-650 flex items-center justify-center gap-1.5 px-3 h-9"
                        title="Alternar Câmera"
                        disabled={isCameraLoading}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Inverter
                      </Button>
                      <Button
                        type="button"
                        onClick={capturePhoto}
                        disabled={isCameraLoading}
                        className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex-1 flex items-center justify-center gap-1.5 px-4 h-9"
                        id="btn-take-realtime-snapshot"
                      >
                        <Camera className="h-4 w-4" /> Tirar Foto
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 font-semibold">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera(cameraFacingMode);
                        }}
                        className="text-stone-300 hover:text-white hover:bg-stone-800 text-xs flex-1 h-9"
                        id="btn-retake-snapshot"
                      >
                        Tirar Outra
                      </Button>
                      <Button
                        type="button"
                        onClick={saveCapturedPhoto}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex-1 flex items-center justify-center gap-1.5 h-9"
                        id="btn-confirm-captured-snapshot"
                      >
                        Confirmar & Salvar <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Interactive Photo Zoom Lightbox Modal */}
      <AnimatePresence>
        {zoomedPhotoUrl && (
          <div 
            id="photo-zoom-overlay" 
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setZoomedPhotoUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl bg-stone-900 border border-stone-850 rounded-xl overflow-hidden shadow-2xl flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-800 p-4 bg-stone-950/50">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                    <Maximize2 className="h-4 w-4 text-primary" /> Visualização Ampliada
                  </h3>
                  <p className="text-xs text-stone-400 font-medium">
                    Colaborador: <span className="text-stone-200 font-semibold">{zoomedPhotoName}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomedPhotoUrl(null)}
                  className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                  id="close-photo-zoom-btn"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-square md:aspect-video w-full bg-stone-950 overflow-hidden flex items-center justify-center border-b border-stone-800 select-none">
                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-200 overflow-auto"
                  style={{ transform: `scale(${photoZoomScale})` }}
                >
                  <img
                    src={zoomedPhotoUrl}
                    alt={zoomedPhotoName}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Internal zoom scale indicator */}
                <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded text-[10px] font-semibold text-stone-300 font-mono tracking-wider backdrop-blur-sm">
                  ZOOM: {Math.round(photoZoomScale * 100)}%
                </div>
              </div>

              {/* Zoom Action Panel */}
              <div className="p-3 bg-stone-950/70 flex items-center justify-between gap-4">
                <span className="text-[11px] text-stone-400">
                  Use os controles para ampliar com riqueza de detalhes em alta fidelidade.
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPhotoZoomScale((prev) => Math.max(0.5, prev - 0.25))}
                    className="h-8 w-8 p-0 bg-stone-800 hover:bg-stone-750 text-white rounded border border-stone-700"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPhotoZoomScale(1)}
                    className="h-8 px-2.5 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs rounded border border-stone-700"
                    title="Resetar Zoom"
                  >
                    100%
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPhotoZoomScale((prev) => Math.min(4, prev + 0.25))}
                    className="h-8 w-8 p-0 bg-stone-800 hover:bg-stone-750 text-white rounded border border-stone-700"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* EXPORT DOCUMENTATION PREVIEW & SHARING DIALOG */}
        {/* ------------------------------------------------------------------ */}
        {isExportModalOpen && exportingEmployee && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="text-base font-bold text-foreground">Exportar Ficha de EPI</h3>
                    <p className="text-xs text-muted-foreground">Documento de controle regulamentar personalizado de entrega de Equipamentos de Proteção Individual.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsExportModalOpen(false);
                    setExportingEmployee(null);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors animate-pulse"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body: Custom High Fidelity Document Canvas Layout */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900 border-b border-border">
                
                {/* Print Sheet Paper styling container */}
                <div 
                  id="printable-epi-document"
                  className="max-w-[800px] mx-auto bg-white text-stone-900 border border-stone-300 rounded shadow-md p-6 font-sans space-y-4 print:p-0 print:border-none print:shadow-none"
                >
                  {/* Ficha Header Row */}
                  <div className="border border-stone-400 p-4 rounded grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-12 sm:col-span-3 flex justify-center sm:justify-start">
                      {companySettings.avatarUrl ? (
                        <img 
                          src={companySettings.avatarUrl} 
                          alt="Logo Empresa" 
                          className="max-h-16 max-w-full object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded border-2 border-stone-300 border-dashed flex flex-col items-center justify-center text-stone-400">
                          <Building className="h-8 w-8" />
                          <span className="text-[9px] font-bold">LOGO</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-12 sm:col-span-9 space-y-1 text-center sm:text-left border-t sm:border-t-0 sm:border-l border-stone-300 sm:pl-4 pt-3 sm:pt-0">
                      <h4 className="text-base font-black tracking-tight uppercase">FICHA DE CONTROLE DE EPI</h4>
                      <p className="text-[10px] font-bold text-stone-500">EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - NORMA REGULAMENTADORA NR 06</p>
                      <p className="text-xs font-semibold">Empresa: <span className="font-bold">{companySettings.companyName}</span> | CNPJ: <span className="font-bold">{companySettings.cnpj}</span></p>
                      <p className="text-[10px] text-stone-500">Contato: {companySettings.email} | {companySettings.phone}</p>
                    </div>
                  </div>

                  {/* Employee Block Grid */}
                  <div className="border border-stone-400 rounded-lg overflow-hidden text-left">
                    <div className="bg-stone-100 px-3 py-1.5 border-b border-stone-400">
                      <span className="text-xs font-black text-stone-800 tracking-wider">DADOS DO TRABALHADOR</span>
                    </div>
                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="font-bold text-stone-500">Nome:</span>
                        <p className="font-bold text-stone-900">{exportingEmployee.name}</p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500">Admissão:</span>
                        <p className="font-semibold text-stone-900">
                          {exportingEmployee.admissionDate ? exportingEmployee.admissionDate.split("-").reverse().join("/") : "Não informada"}
                        </p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500">Idade:</span>
                        <p className="font-semibold text-stone-900">{exportingEmployee.age} anos</p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500">Cargo/Função:</span>
                        <p className="font-semibold text-stone-900">{exportingEmployee.role}</p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500">Setor/Dep:</span>
                        <p className="font-semibold text-stone-900">{exportingEmployee.sector || "Não informado"}</p>
                      </div>
                      <div>
                        <span className="font-bold text-stone-500">Regional:</span>
                        <p className="font-semibold text-stone-900">{exportingEmployee.regional || "Não informada"}</p>
                      </div>
                      <div className="col-span-full border-t border-stone-200 pt-2 flex gap-1 items-baseline">
                        <span className="font-bold text-stone-500">RG do Colaborador:</span>
                        <p className="font-bold text-stone-900">{exportingEmployee.rg || "Não cadastrado"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Declaration NR-06 terms of responsibility */}
                  <div className="p-3.5 bg-stone-50 rounded border border-stone-300 space-y-1.5 text-left">
                    <h5 className="text-[10px] uppercase font-black tracking-wider text-stone-600">TERMO DE RESPONSABILIDADE E DECLARAÇÃO (NR-06)</h5>
                    <p className="text-[11px] text-stone-600 leading-relaxed text-justify">
                      Declaro para os devidos fins de direito que recebi do meu empregador, de forma gratuita, os Equipamentos de Proteção Individual (EPIs) adequados para o desempenho seguro das minhas atividades profissionais. Comprometo-me a higienizá-los, mantê-los conservados e sob minha guarda pessoal, usá-los obrigatoriamente no período laboral e a comunicar qualquer desgaste ou danificação para reposição imediata, cumprindo rigorosamente as orientações do artigo 158 da CLT e NR-06.
                    </p>
                  </div>

                  {/* EPI log registered list of equipment */}
                  <div className="border border-stone-400 rounded overflow-x-auto text-left">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-100 border-b border-stone-400 text-[10px] font-bold text-stone-700 uppercase">
                          <th className="p-2 border-r border-stone-400 text-center w-[12%]">Código</th>
                          <th className="p-2 border-r border-stone-400 w-[45%]">Especificação / Marca / Modelo</th>
                          <th className="p-2 border-r border-stone-400 text-center w-[10%]">C.A</th>
                          <th className="p-2 border-r border-stone-400 text-center w-[12%]">Entrega</th>
                          <th className="p-2 border-r border-stone-400 text-center w-[10%]">Devolução</th>
                          <th className="p-2 text-center w-[20%]">Assinatura do Funcionário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exportingEmployee.epis && exportingEmployee.epis.length > 0 ? (
                          exportingEmployee.epis.map((epi) => (
                            <tr key={epi.id} className="border-b border-stone-300 hover:bg-stone-50/50">
                              <td className="p-2 border-r border-stone-300 text-center font-semibold text-stone-600">{epi.id}</td>
                              <td className="p-2 border-r border-stone-300">
                                <span className="font-bold text-stone-900 block">{epi.epiName}</span>
                                <span className="text-[10px] text-stone-500">Marca: {epi.brand}</span>
                              </td>
                              <td className="p-2 border-r border-stone-300 text-center font-bold text-stone-800">{epi.caNumber}</td>
                              <td className="p-2 border-r border-stone-300 text-center">{epi.deliveryDate.split("-").reverse().join("/")}</td>
                              <td className="p-2 border-r border-stone-300 text-center text-stone-600">
                                {epi.returnDate ? (
                                  <span className="text-emerald-700 font-bold">{epi.returnDate.split("-").reverse().join("/")}</span>
                                ) : (
                                  <span className="text-stone-400 font-medium italic">Em uso</span>
                                )}
                              </td>
                              <td className="p-1 text-center bg-stone-50/50">
                                {epi.signature ? (
                                  <div className="flex flex-col items-center justify-center p-0.5">
                                    <img 
                                      src={epi.signature} 
                                      alt="Assinatura" 
                                      className="max-h-7 max-w-[120px] object-contain"
                                    />
                                    <span className="text-[7px] text-stone-400 font-mono scale-[0.9]">Digitalizada</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-rose-500 italic font-semibold">Pendente</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-stone-400 italic">
                              Nenhum histórico de entrega de EPI assinado para este funcionário.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Verification stamps */}
                  <div className="pt-4 border-t border-stone-300 grid grid-cols-2 gap-4 text-[10px] text-stone-500 font-mono text-left">
                    <div>
                      <p>DOCUMENTO DE REFERÊNCIA OFICIAL ALMOXPRO</p>
                      <p>AUTENTICIDADE CERTIFICADA DIGITALMENTE</p>
                    </div>
                    <div className="text-right font-mono">
                      <p>GERADO EM: {new Date().toLocaleDateString("pt-BR")}</p>
                      <p>EMISSOR: {companySettings.companyName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions Share Panel */}
              <div className="p-5 bg-card border-t border-border flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs text-muted-foreground font-medium text-center md:text-left">
                    Deseja enviar diretamente para um número? (DDD + Número)
                  </span>
                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1.5 max-w-sm w-full">
                    <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Ex: 11999999999"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, ""))}
                      className="bg-transparent border-none text-xs focus:outline-none w-full text-foreground"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center w-full md:w-auto">
                  <Button
                    onClick={() => downloadEpiPdf(exportingEmployee)}
                    className="flex-1 sm:flex-none items-center gap-1.5 h-10 px-4 bg-primary hover:bg-primary/95 text-xs text-white font-bold"
                    id="export-pdf-action-btn"
                  >
                    <FileDown className="h-4 w-4" /> Exportar PDF
                  </Button>
                  <Button
                    onClick={() => {
                      if (isDemoMode) {
                        (window as any).triggerDemoBlock?.();
                        return;
                      }
                      window.open(getEpiWhatsAppUrl(exportingEmployee), "_blank");
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-xs text-white font-semibold rounded-md transition-colors"
                    id="export-whatsapp-action-btn"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button
                    onClick={() => sendEpiEmail(exportingEmployee)}
                    variant="outline"
                    className="flex-1 sm:flex-none items-center gap-1.5 h-10 px-4 border-border text-xs font-semibold"
                    id="export-email-action-btn"
                  >
                    <Mail className="h-4 w-4" /> E-mail
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 sm:flex-none h-10 px-4 text-xs font-semibold border-border bg-muted/50 hover:bg-muted"
                    onClick={() => {
                      setIsExportModalOpen(false);
                      setExportingEmployee(null);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit EPI Dialog */}
        {editingEpi && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-md bg-card border-border p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-base flex items-center gap-1.5 text-foreground">
                  <Pencil className="h-4 w-4 text-primary" /> Editar Informações do EPI
                </h3>
                <Button
                  variant="ghost"
                  type="button"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setEditingEpi(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSaveEditEpi} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Nome do EPI</label>
                  <input
                    type="text"
                    value={editEpiName}
                    onChange={(e) => setEditEpiName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Marca</label>
                    <input
                      type="text"
                      value={editEpiBrand}
                      onChange={(e) => setEditEpiBrand(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Número C.A.</label>
                    <input
                      type="text"
                      value={editEpiCa}
                      onChange={(e) => setEditEpiCa(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Data de Requisição</label>
                    <input
                      type="date"
                      value={editEpiRequestDate}
                      onChange={(e) => setEditEpiRequestDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-muted-foreground">Data de Entrega</label>
                    <input
                      type="date"
                      value={editEpiDeliveryDate}
                      onChange={(e) => setEditEpiDeliveryDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">Data de Devolução <span className="text-[10px] font-normal text-muted-foreground">(Deixe em branco se ainda estiver em uso)</span></label>
                  <input
                    type="date"
                    value={editEpiReturnDate}
                    onChange={(e) => setEditEpiReturnDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-muted/20 border border-[hsl(var(--border))] focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    type="button" 
                    onClick={() => setEditingEpi(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    type="submit"
                    className="gap-1 bg-primary hover:bg-primary-hover font-bold text-primary-foreground dark:text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
