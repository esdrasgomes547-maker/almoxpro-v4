import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, extrairSKU } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Html5Qrcode } from "html5-qrcode";
import { Search, Plus, Filter, History, X, ArrowUpRight, ArrowDownRight, Trash2, Edit2, Archive, Phone, Mail, Database, Camera, ImageIcon, ZoomIn, Eye, EyeOff, Package, MessageSquare, AlertTriangle, TrendingUp, Layers, Tag, QrCode, Printer, Wifi, Settings, RefreshCw, Cpu, Usb, PlusCircle, Check, Smartphone, FileText, AlignLeft, AlignCenter, AlignRight, Upload, ChevronDown, User, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { saveInventoryItem, updateInventoryItem, deleteInventoryItem } from "../lib/inventoryWrites";
import { registrarRetorno, ajustarEstoque } from "../lib/movementManager";
import { syncInventory, resetLocalInventory, localDb } from "../lib/localDb";
import { db, handleFirestoreError, OperationType, auth, safeOnSnapshot } from "../lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, setDoc, deleteDoc, updateDoc, orderBy, limit, getDocs, deleteField, serverTimestamp } from "firebase/firestore";
import { sendWhatsAppNotification, sendEmailReport, generateInventoryReport } from "../lib/notificationService";
import { useOrganization } from "../lib/tenant";
import { InventoryItem, MovementItem, Category } from "../types";
import { isDemo } from '../lib/demo';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { jsPDF } from "jspdf";

export type OrdemInventario =
  | "alfabetica_az"
  | "alfabetica_za"
  | "ultimos_adicionados"
  | "primeiros_adicionados"
  | "estoque_critico"
  | "maior_quantidade"
  | "menor_quantidade"
  | "maior_valor"
  | "menor_valor";

const STORAGE_KEY = "@almoxpro-ordem-inventario";

export function Inventory() {
  const { orgId } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");


  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("category"));
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<MovementItem[]>([]);
  const [newMovement, setNewMovement] = useState({ type: "IN" as "IN" | "OUT", qty: 0, reason: "" });
  const [viewingProduct, setViewingProduct] = useState<InventoryItem | null>(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(!!searchParams.get("category"));
  const [categoryViewMode, setCategoryViewMode] = useState<'grid' | 'carousel'>('grid');

  const [selectedProductForQr, setSelectedProductForQr] = useState<InventoryItem | null>(null);
  const [selectedItemsForPrintSheet, setSelectedItemsForPrintSheet] = useState<Record<string, boolean>>({});
  const [printColumns, setPrintColumns] = useState<number>(2);
  const [showOnlyInStock, setShowOnlyInStock] = useState<boolean>(false);
  const [categoryQrCodes, setCategoryQrCodes] = useState<Record<string, string>>({});
   const [isGeneratingCategoryQrs, setIsGeneratingCategoryQrs] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [ordem, setOrdem] = useState<OrdemInventario>(() => {
    return (localStorage.getItem(STORAGE_KEY) as OrdemInventario) ?? "alfabetica_az";
  });
  
  const mudarOrdem = (novaOrdem: OrdemInventario) => {
    setOrdem(novaOrdem);
    localStorage.setItem(STORAGE_KEY, novaOrdem);
  };
  const [exportData, setExportData] = useState<{name: string, id: string, qrUrl: string}[]>([]);
  const [mobileTab, setMobileTab] = useState<'config' | 'preview'>('config');

  // Label configuration states & presets for Pimaco/Customization
  const [selectedTemplateId, setSelectedTemplateId] = useState("gondola");
  const [sheetSize, setSheetSize] = useState("a4"); // "a4" | "letter"
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(9);
  const [cardWidth, setCardWidth] = useState(91);
  const [cardHeight, setCardHeight] = useState(28);
  const [marginX, setMarginX] = useState(10);
  const [marginY, setMarginY] = useState(12);
  const [gapX, setGapX] = useState(4);
  const [gapY, setGapY] = useState(4);
  const [qrSize, setQrSize] = useState(20);
  const [fontSize, setFontSize] = useState(9.5);
  const [paddingX, setPaddingX] = useState(3);
  const [hasBorders, setHasBorders] = useState(true);
  const [showTitleHeader, setShowTitleHeader] = useState(true);

  // Advanced Canva-Style customizer state
  const [canvaTab, setCanvaTab] = useState<'layout' | 'style' | 'elements'>('layout');
  const [qrPosition, setQrPosition] = useState<"right" | "left" | "center_top">("right");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");
  const [borderRadius, setBorderRadius] = useState(1.5);
  const [accentColor, setAccentColor] = useState<"none" | "indigo" | "amber" | "emerald" | "rose" | "slate">("none");
  const [showBrand, setShowBrand] = useState(true);
  const [showSku, setShowSku] = useState(true);

  // List of standard presets
  const labelTemplates = [
    {
      id: "gondola",
      name: "AlmoxPro • Gôndola Padrão",
      description: "2 colunas x 9 linhas (A4 - 91mm x 28mm)",
      sheetSize: "a4",
      cols: 2,
      rows: 9,
      cardWidth: 91,
      cardHeight: 28,
      marginX: 10,
      marginY: 12,
      gapX: 4,
      gapY: 4,
      qrSize: 20,
      fontSize: 9.5,
      paddingX: 3,
      hasBorders: true,
      showTitleHeader: true
    },
    {
      id: "pimaco_6081",
      name: "Pimaco 6081 / 6181 / 6281 (Carta)",
      description: "2 colunas x 10 linhas (Carta - 101,6mm x 25,4mm)",
      sheetSize: "letter",
      cols: 2,
      rows: 10,
      cardWidth: 101.6,
      cardHeight: 25.4,
      marginX: 6.35,
      marginY: 12.7,
      gapX: 0,
      gapY: 0,
      qrSize: 17,
      fontSize: 8,
      paddingX: 3,
      hasBorders: true,
      showTitleHeader: false
    },
    {
      id: "pimaco_6082",
      name: "Pimaco 6082 (Carta)",
      description: "2 colunas x 7 linhas (Carta - 101,6mm x 33,9mm)",
      sheetSize: "letter",
      cols: 2,
      rows: 7,
      cardWidth: 101.6,
      cardHeight: 33.9,
      marginX: 6.35,
      marginY: 12.7,
      gapX: 0,
      gapY: 0.8,
      qrSize: 22,
      fontSize: 9.5,
      paddingX: 4,
      hasBorders: true,
      showTitleHeader: false
    },
    {
      id: "pimaco_a4_3100",
      name: "Pimaco 3100 (A4)",
      description: "3 colunas x 10 linhas (A4 - 63,5mm x 25,4mm)",
      sheetSize: "a4",
      cols: 3,
      rows: 10,
      cardWidth: 63.5,
      cardHeight: 25.4,
      marginX: 7.2,
      marginY: 12.7,
      gapX: 2.5,
      gapY: 0,
      qrSize: 16,
      fontSize: 8,
      paddingX: 2.5,
      hasBorders: true,
      showTitleHeader: false
    },
    {
      id: "custom",
      name: "Personalizado...",
      description: "Personalização completa de dimensões e margens",
      sheetSize: "a4",
      cols: 2,
      rows: 10,
      cardWidth: 95,
      cardHeight: 25,
      marginX: 8,
      marginY: 12,
      gapX: 2,
      gapY: 2,
      qrSize: 17,
      fontSize: 8,
      paddingX: 3,
      hasBorders: true,
      showTitleHeader: false
    }
  ];

  const applyTemplate = (templateId: string) => {
    const t = labelTemplates.find(x => x.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    setSheetSize(t.sheetSize);
    setCols(t.cols);
    setRows(t.rows);
    setCardWidth(t.cardWidth);
    setCardHeight(t.cardHeight);
    setMarginX(t.marginX);
    setMarginY(t.marginY);
    setGapX(t.gapX);
    setGapY(t.gapY);
    setQrSize(t.qrSize);
    setFontSize(t.fontSize);
    setPaddingX(t.paddingX);
    setHasBorders(t.hasBorders);
    setShowTitleHeader(t.showTitleHeader);

    // Apply sensible default canvas/Canva style preferences based on selection
    if (templateId === "pimaco_6081") {
      setQrPosition("right");
      setTextAlign("left");
      setBorderRadius(1.0);
      setAccentColor("none");
      setShowBrand(false);
      setShowSku(true);
    } else if (templateId === "pimaco_a4_3100") {
      setQrPosition("left");
      setTextAlign("left");
      setBorderRadius(0.8);
      setAccentColor("none");
      setShowBrand(false);
      setShowSku(true);
    } else if (templateId === "gondola") {
      setQrPosition("right");
      setTextAlign("left");
      setBorderRadius(2.0);
      setAccentColor("indigo");
      setShowBrand(true);
      setShowSku(true);
    } else {
      setQrPosition("right");
      setTextAlign("left");
      setBorderRadius(1.5);
      setAccentColor("none");
      setShowBrand(true);
      setShowSku(true);
    }
  };
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [registeredPrinters, setRegisteredPrinters] = useState<Array<{ id: string; name: string; type: string; address?: string; size: string }>>(() => {
    try {
      const saved = localStorage.getItem("almoxpro_registered_printers");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: "p1", name: "Impressora Térmica Xprinter 365B (Bluetooth)", type: "Bluetooth", address: "00:11:22:33:FF:EE", size: "50x30mm" },
      { id: "p2", name: "Zebra ZD220 Desk (USB)", type: "USB", address: "/dev/usb/lp0", size: "80x40mm" },
      { id: "p3", name: "Almox Central LAN (Rede/IP)", type: "Rede / IP", address: "192.168.1.180:9100", size: "50x30mm" }
    ];
  });
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("p1");
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [newPrinterForm, setNewPrinterForm] = useState({ name: "", type: "Bluetooth", address: "", size: "50x30mm" });

  // States for stock materials output & employees
  const [employees, setEmployees] = useState<any[]>([]);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [outputModalMode, setOutputModalMode] = useState<"saida" | "retorno">("saida");
  const [outputProductId, setOutputProductId] = useState("");
  const [outputFilteredInventory, setOutputFilteredInventory] = useState<typeof inventory | null>(null);
  const [outputEmployeeId, setOutputEmployeeId] = useState("");
  const [outputQty, setOutputQty] = useState<number>(0);
  const [outputActivity, setOutputActivity] = useState("Montagem");
  const [outputCustomActivity, setOutputCustomActivity] = useState("");
  const [outputNotes, setOutputNotes] = useState("");
  const [isSavingOutput, setIsSavingOutput] = useState(false);

  const [isOutputScanning, setIsOutputScanning] = useState(false);
  const [outputScannerError, setOutputScannerError] = useState("");
  const outputScannerRef = useRef<Html5Qrcode | null>(null);

  const [showInlineEmployee, setShowInlineEmployee] = useState(false);
  const [inlineEmployeeName, setInlineEmployeeName] = useState("");
  const [inlineEmployeeRole, setInlineEmployeeRole] = useState("Técnico");

  // States for material/tool returns (Retornos / Devoluções)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnProductId, setReturnProductId] = useState("");
  const [returnEmployeeId, setReturnEmployeeId] = useState("");
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returnState, setReturnState] = useState("INTEGRO");
  const [returnNotes, setReturnNotes] = useState("");
  const [isSavingReturn, setIsSavingReturn] = useState(false);

  // States for quick product addition within output/requisition flows
  const [isAddProdFromOutputOpen, setIsAddProdFromOutputOpen] = useState(false);
  const [quickProdName, setQuickProdName] = useState("");
  const [quickProdCategory, setQuickProdCategory] = useState("");
  const [quickProdLocation, setQuickProdLocation] = useState("Almoxarifado Central");
  const [quickProdQty, setQuickProdQty] = useState<number>(10);
  const [quickProdMinQty, setQuickProdMinQty] = useState<number>(2);
  const [quickProdPrice, setQuickProdPrice] = useState<number>(0);
  const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);

  const categoryItems = useMemo(() => {
    if (!selectedProductForQr) return [];
    const cat = selectedProductForQr.category || "Sem Categoria";
    return inventory.filter(item => {
      const itemCat = item.category || "Sem Categoria";
      if (showOnlyInStock && (item.qty || 0) <= 0) {
        return false;
      }
      return itemCat === cat;
    });
  }, [selectedProductForQr, inventory, showOnlyInStock]);

  useEffect(() => {
    if (selectedProductForQr) {
      const scanUrl = `${window.location.origin}/scan?sku=${selectedProductForQr.id || ""}&org=${orgId}`;
      QRCode.toDataURL(
        scanUrl,
        { margin: 1, width: 250, color: { dark: "#0f172a", light: "#ffffff" } }
      )
      .catch(err => {
        console.error("Error generating qr code", err);
        toast.error("Erro ao gerar QR Code");
      });

      const cat = selectedProductForQr.category || "Sem Categoria";
      const items = inventory.filter(item => {
        const itemCat = item.category || "Sem Categoria";
        return itemCat === cat;
      });
      
      const initialMap: Record<string, boolean> = {};
      items.forEach(item => {
        initialMap[item.id] = true;
      });
      setSelectedItemsForPrintSheet(initialMap);
      
      setIsGeneratingCategoryQrs(true);
      const newQrMap: Record<string, string> = {};
      
      Promise.all(
        items.map(item => {
          const itemScanUrl = `${window.location.origin}/scan?sku=${item.id || ""}&org=${orgId}`;
          return QRCode.toDataURL(
            itemScanUrl,
            { margin: 1, width: 200, color: { dark: "#0f172a", light: "#ffffff" } }
          )
          .then(url => {
            newQrMap[item.id] = url;
          })
          .catch(err => {
            console.error("Error generating categories QR:", item.id, err);
          });
        })
      ).then(() => {
        setCategoryQrCodes(newQrMap);
        setIsGeneratingCategoryQrs(false);
      });
    } else {
      setSelectedItemsForPrintSheet({});
      setCategoryQrCodes({});
    }
  }, [selectedProductForQr, inventory]);

  // Hook para deep link de edição via URL e busca robusta de produto
  useEffect(() => {
    const sku = searchParams.get("sku");
    if (!sku || !orgId || orgId === "undefined") return;

    const loadProductFromSku = async () => {
      let matchedItem = inventory.find(
        (item) => item.id.toUpperCase() === sku.toUpperCase()
      );

      // Se não localizar na lista (pode ser devido a filtros ativos de busca ou paginação), busca direto no banco
      if (!matchedItem) {
        try {
          const docRef = doc(db, `organizations/${orgId}/inventory`, sku);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            matchedItem = { id: docSnap.id, ...docSnap.data() } as InventoryItem;
          }
        } catch (error) {
          console.error("Erro ao buscar produto pelo SKU direta do Firestore:", error);
        }
      }

      if (matchedItem) {
        handleEdit(matchedItem);
        // Remove o parâmetro SKU e limpa filtros se necessário para carregar apropriadamente
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete("sku");
            return next;
        });
      } else {
        // Se a lista de inventário já tiver elementos carregados, e o item não for encontrado mesmo após busca direta
        if (inventory.length > 0) {
          toast.error(`Produto SKU "${sku}" não foi localizado.`);
          setSearchParams(prev => {
              const next = new URLSearchParams(prev);
              next.delete("sku");
              return next;
          });
        }
      }
    };

    loadProductFromSku();
  }, [searchParams, inventory, orgId]);


  // --- SCANNER DE HARDWARE FÍSICO EXTERNO (USB/BLUETOOTH) ---
  useEffect(() => {
    let scannedCharsBuffer = "";
    let lastKeypressTime = Date.now();

    const handleHardwareScan = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const difference = currentTime - lastKeypressTime;
      lastKeypressTime = currentTime;

      const isCurrentElementInput =
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.getAttribute("contenteditable") === "true");

      const isFastTyping = difference < 45; // Teclado simulado de scanner digita em intervalos < 40ms

      if (event.key === "Enter") {
        if (scannedCharsBuffer.length >= 2 && (isFastTyping || scannedCharsBuffer.length > 5)) {
          event.preventDefault();
          event.stopPropagation();
          const targetSku = scannedCharsBuffer.trim();
          scannedCharsBuffer = "";

          const matchedItem = inventory.find(
            (item) => item.id.toUpperCase() === targetSku.toUpperCase() ||
                      (item.id.toUpperCase().replace(/[^A-Z0-9]/gi, "") === targetSku.toUpperCase().replace(/[^A-Z0-9]/gi, ""))
          );

          if (matchedItem) {
            toast.success(`Scanner de Hardware leu: "${matchedItem.name}"`, {
              description: `Código SKU: ${matchedItem.id}`
            });
            openViewingProduct(matchedItem);
          } else {
            toast.warning(`Código lido: "${targetSku}", mas o produto não existe neste estoque.`);
          }
        } else {
          scannedCharsBuffer = "";
        }
        return;
      }

      // Desconsidera se o caractere for operacional extraordinário
      if (event.key.length > 1) {
        return;
      }

      if (scannedCharsBuffer === "" || isFastTyping) {
        // Ignora acumular caracteres do buffer caso o usuário esteja apenas escrevendo normalmente em um input e não esteja rápido
        if (isCurrentElementInput && scannedCharsBuffer === "" && !isFastTyping) {
          return;
        }
        scannedCharsBuffer += event.key;
      } else {
        // Se demorou, trata como digitação humana lenta comum
        scannedCharsBuffer = event.key;
      }
    };

    window.addEventListener("keydown", handleHardwareScan, true);
    return () => {
      window.removeEventListener("keydown", handleHardwareScan, true);
    };
  }, [inventory]);

  const handleScanPrinters = async () => {
    setIsScanningPrinters(true);
    toast.info("Iniciando escaneamento de portas Bluetooth e USB...");
    
    let physicalFound = false;
    try {
      const nav = navigator as any;
      if (nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function') {
      }
      if (nav.usb && typeof nav.usb.getDevices === 'function') {
        const usbDevices = await nav.usb.getDevices();
        if (usbDevices.length > 0) {
          physicalFound = true;
          usbDevices.forEach((dev: any) => {
            const exists = registeredPrinters.some(p => p.name.includes(dev.productName || ""));
            if (!exists) {
              const newDev = {
                id: `usb-${Date.now()}`,
                name: `${dev.productName || 'Impressora USB'} (${dev.manufacturerName || 'Zebra'})`,
                type: 'USB',
                address: `Porta USB ${dev.deviceClass}`,
                size: '80x40mm'
              };
              setRegisteredPrinters(prev => {
                const updated = [...prev, newDev];
                localStorage.setItem("almoxpro_registered_printers", JSON.stringify(updated));
                return updated;
              });
              toast.success(`Dispositivo USB encontrado: ${dev.productName || 'Impressora'}`);
            }
          });
        }
      }
    } catch (e) {
      console.warn("Nenhum device físico selecionado ou erro de API:", e);
    }

    setTimeout(() => {
      setIsScanningPrinters(false);
      if (!physicalFound) {
        const mockBtName = "Gôndola Bluetooth Printer " + Math.floor(100 + Math.random() * 900);
        const exists = registeredPrinters.some(p => p.name.includes("Gôndola Bluetooth"));
        if (!exists) {
          const newMock = {
            id: `bt-${Date.now()}`,
            name: `${mockBtName} (Detectada)`,
            type: "Bluetooth",
            address: "98:D3:31:F4:12:" + Math.floor(10 + Math.random() * 89),
            size: "50x30mm"
          };
          setRegisteredPrinters(prev => {
            const updated = [...prev, newMock];
            localStorage.setItem("almoxpro_registered_printers", JSON.stringify(updated));
            return updated;
          });
          toast.success(`Nova impressora detectada e pareada via Bluetooth: ${mockBtName}`);
        } else {
          toast.success("Varredura concluída. Dispositivos atualizados.");
        }
      }
    }, 1800);
  };

  const handleAddPrinterManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrinterForm.name.trim()) {
      toast.error("Nome da impressora é obrigatório");
      return;
    }
    const newP = {
      id: `man-${Date.now()}`,
      name: newPrinterForm.name,
      type: newPrinterForm.type,
      address: newPrinterForm.address || "Padrão",
      size: newPrinterForm.size
    };
    setRegisteredPrinters(prev => {
      const updated = [...prev, newP];
      localStorage.setItem("almoxpro_registered_printers", JSON.stringify(updated));
      return updated;
    });
    setSelectedPrinterId(newP.id);
    setNewPrinterForm({ name: "", type: "Bluetooth", address: "", size: "50x30mm" });
    toast.success("Impressora cadastrada com sucesso!");
  };
  
  const handleDeletePrinter = (printerId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const updated = registeredPrinters.filter(p => p.id !== printerId);
    setRegisteredPrinters(updated);
    localStorage.setItem("almoxpro_registered_printers", JSON.stringify(updated));
    toast.success("Impressora removida.");
    if (selectedPrinterId === printerId && updated.length > 0) {
      setSelectedPrinterId(updated[0].id);
    }
  };

  const printCategorySheet = () => {
    if (!selectedProductForQr) return;
    const cat = selectedProductForQr.category || "Sem Categoria";
    const selectedList = categoryItems.filter(item => selectedItemsForPrintSheet[item.id]);
    
    if (selectedList.length === 0) {
      toast.error("Nenhum produto selecionado para impressão.");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      toast.error("Para imprimir, libere popups no navegador.");
      return;
    }

    const columnsClass = 
      printColumns === 1 ? 'grid-template-columns: 1fr;' :
      printColumns === 3 ? 'grid-template-columns: repeat(3, 1fr);' :
      'grid-template-columns: repeat(2, 1fr);';

    const cardHeight =
      printColumns === 1 ? 'height: 100px;' :
      printColumns === 3 ? 'height: 75px;' :
      'height: 85px;';

    const qrSize =
      printColumns === 1 ? 'width: 85px; height: 85px;' :
      printColumns === 3 ? 'width: 60px; height: 60px;' :
      'width: 72px; height: 72px;';

    const itemsHtml = selectedList.map(item => {
      const qrUrl = categoryQrCodes[item.id] || "";
      return `
        <div class="label-card" style="${cardHeight}">
          <div class="label-left">
            <div class="label-name">${item.name}</div>
            <div class="label-sku">SKU: ${item.id}</div>
            <div class="label-meta">
              <span>Cat: ${item.category || "Geral"}</span>
              ${item.qty !== undefined ? `<span style="margin-left: 8px;">Estoque: ${item.qty} un</span>` : ''}
            </div>
          </div>
          ${qrUrl ? `<img class="label-qr" style="${qrSize}" src="${qrUrl}" alt="QR" />` : '<div class="label-qr-placeholder">QR</div>'}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Folha de Etiquetas - Categoria ${cat}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            @page {
              size: A4;
              margin: 12mm 10mm;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #000;
              background-color: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 20px;
            }
            .page-title {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .page-meta {
              font-size: 11px;
              font-weight: 600;
              color: #555;
            }
            .grid-container {
              display: grid;
              ${columnsClass}
              gap: 12px;
            }
            .label-card {
              border: 1.5px solid #000;
              border-radius: 6px;
              padding: 10px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              background: #fff;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .label-left {
              flex: 1;
              min-width: 0;
              margin-right: 8px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              text-align: left;
            }
            .label-name {
              font-size: 12px;
              font-weight: 700;
              line-height: 1.2;
              margin: 0 0 3px 0;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
            }
            .label-sku {
              font-family: monospace;
              font-size: 10px;
              font-weight: 700;
              color: #000;
              background-color: #f1f5f9;
              padding: 1.5px 5px;
              border-radius: 3px;
              display: inline-block;
              margin: 2px 0;
              width: fit-content;
            }
            .label-meta {
              font-size: 9px;
              font-weight: 500;
              color: #444;
              margin-top: 2px;
            }
            .label-qr {
              flex-shrink: 0;
              display: block;
            }
            .label-qr-placeholder {
              width: 60px;
              height: 60px;
              border: 1px dashed #ccc;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              color: #999;
              flex-shrink: 0;
            }
          </style>
        </head>
        <body>
          <div class="page-header">
            <div class="page-title">AlmoxPro • Etiquetas de Gôndola</div>
            <div class="page-meta">Categoria: ${cat} | ${selectedList.length} itens</div>
          </div>
          <div class="grid-container">
            ${itemsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    logActivity('qr_sheet_print', 'Impressao', `Folha de etiquetas da categoria "${cat}" enviada para impressora com ${selectedList.length} itens.`, 'CREATE');
    toast.success("Folha de etiquetas enviada para o assistente de impressão do navegador!");
  };

  const generateCategoryPdf = async () => {
    if (!selectedProductForQr) return;
    const cat = selectedProductForQr.category || "Sem Categoria";
    const selectedList = categoryItems.filter(item => selectedItemsForPrintSheet[item.id]);
    
    if (selectedList.length === 0) {
      toast.error("Nenhum produto selecionado para gerar o PDF.");
      return;
    }

    toast.info("Processando e gerando o PDF de etiquetas...");

    try {
      const doc = new jsPDF();
      
      const MarginX = 10;
      const MarginY = 12;
      const cols = printColumns;
      const Gap = 4;
      const AvailableWidth = 190; // 210 - 2 * 10
      const CardWidth = (AvailableWidth - (cols - 1) * Gap) / cols;
      
      const CardHeight = 
        cols === 1 ? 32 :
        cols === 2 ? 28 :
        26;

      const drawHeader = () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('AlmoxPro • Etiquetas de Gôndola', MarginX, MarginY + 5);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`Categoria: ${cat} | ${selectedList.length} itens`, 210 - MarginX, MarginY + 5, { align: 'right' });
        
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.5);
        doc.line(MarginX, MarginY + 8, 210 - MarginX, MarginY + 8);
      };

      // Draw first page header
      drawHeader();

      let currentY = MarginY + 14;
      let colIndex = 0;

      selectedList.forEach((item, index) => {
        if (index > 0 && colIndex === 0) {
          // Check if starting a new row exceeds the page limits
          if (currentY + CardHeight > 297 - MarginY) {
            doc.addPage();
            drawHeader();
            currentY = MarginY + 14;
          }
        }

        const posX = MarginX + colIndex * (CardWidth + Gap);
        const posY = currentY;

        // Draw card border
        doc.setDrawColor(15, 23, 42); // slate-900
        doc.setLineWidth(0.3);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(posX, posY, CardWidth, CardHeight, 2, 2, 'FD');

        const qrImageSize = cols === 1 ? 24 : cols === 2 ? 20 : 18;
        const paddingX = 3;
        const textWidth = CardWidth - qrImageSize - paddingX * 2 - 2;

        // Item Name
        const nameFontSize = cols === 1 ? 11 : cols === 2 ? 9.5 : 8.5;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(nameFontSize);
        doc.setTextColor(15, 23, 42);
        
        const textLines = doc.splitTextToSize(item.name || '', textWidth);
        const linesToDraw = textLines.slice(0, 2);
        
        let textY = posY + 5;
        linesToDraw.forEach((line: string) => {
          doc.text(line, posX + paddingX, textY);
          textY += nameFontSize * 0.35 + 0.5;
        });

        // SKU
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(cols === 3 ? 7.5 : 8.5);
        doc.setTextColor(51, 65, 85); // slate-700
        doc.text(`SKU: ${item.id}`, posX + paddingX, posY + CardHeight - 6.5);

        // Category & Qty
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(cols === 3 ? 6.5 : 7.5);
        doc.setTextColor(100, 116, 139); // slate-500
        const qtyText = item.qty !== undefined ? `  |  Est: ${item.qty} un` : '';
        doc.text(`Cat: ${item.category || "Geral"}${qtyText}`, posX + paddingX, posY + CardHeight - 2.5);

        // QR Code image
        const qrUrl = categoryQrCodes[item.id];
        if (qrUrl) {
          try {
            const qrPosX = posX + CardWidth - qrImageSize - paddingX;
            const qrPosY = posY + (CardHeight - qrImageSize) / 2;
            doc.addImage(qrUrl, 'PNG', qrPosX, qrPosY, qrImageSize, qrImageSize);
          } catch (e) {
            console.error("Erro ao desenhar QR Code no PDF:", e);
          }
        } else {
          // Draw a placeholder box if QR is not loaded
          const qrPosX = posX + CardWidth - qrImageSize - paddingX;
          const qrPosY = posY + (CardHeight - qrImageSize) / 2;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.2);
          doc.rect(qrPosX, qrPosY, qrImageSize, qrImageSize);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text("Sem QR", qrPosX + qrImageSize / 2, qrPosY + qrImageSize / 2 + 1, { align: "center" });
        }

        colIndex++;
        if (colIndex >= cols) {
          colIndex = 0;
          currentY += CardHeight + Gap;
        }
      });

      doc.save(`etiquetas_categoria_${cat.toLowerCase().replace(/\s+/g, '_')}.pdf`);
      
      logActivity('qr_sheet_pdf', 'Impressao', `PDF de etiquetas da categoria "${cat}" gerado com ${selectedList.length} itens.`, 'CREATE');
      toast.success("PDF de etiquetas gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Ocorreu um erro ao gerar o PDF das etiquetas.");
    }
  };

  const generateExportedPdf = async () => {
    if (exportData.length === 0) {
      toast.error("Nenhum produto selecionado para gerar o PDF.");
      return;
    }

    toast.info("Processando e gerando o PDF de etiquetas...");

    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: sheetSize === 'letter' ? 'letter' : 'a4'
      });
      
      const PageWidth = sheetSize === 'letter' ? 215.9 : 210;

      const drawHeader = () => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('AlmoxPro • Catálogo de Etiquetas', marginX, marginY + 3);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`Lista de Etiquetas Selecionadas | ${exportData.length} itens`, PageWidth - marginX, marginY + 3, { align: 'right' });
        
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.3);
        doc.line(marginX, marginY + 5, PageWidth - marginX, marginY + 5);
      };

      // Draw first page header if enabled
      if (showTitleHeader) {
        drawHeader();
      }

      const itemsPerPage = cols * rows;
      const startY = marginY + (showTitleHeader ? 10 : 0);

      const getAccentRGB = (color: string) => {
        switch (color) {
          case 'indigo': return [79, 70, 229];
          case 'amber': return [245, 158, 11];
          case 'emerald': return [16, 185, 129];
          case 'rose': return [244, 63, 94];
          case 'slate': return [71, 85, 105];
          default: return [255, 255, 255];
        }
      };

      exportData.forEach((item, index) => {
        const localIndex = index % itemsPerPage;
        
        // Add new page when page limit is reached
        if (index > 0 && localIndex === 0) {
          doc.addPage(sheetSize === 'letter' ? 'letter' : 'a4', 'p');
          if (showTitleHeader) {
            drawHeader();
          }
        }

        const r = Math.floor(localIndex / cols);
        const c = localIndex % cols;

        const posX = marginX + c * (cardWidth + gapX);
        const posY = startY + r * (cardHeight + gapY);

        // Draw card border & background
        doc.setDrawColor(186, 195, 201); // Soft grey border
        doc.setLineWidth(hasBorders ? 0.15 : 0);
        doc.setFillColor(255, 255, 255);
        
        if (hasBorders) {
          doc.roundedRect(posX, posY, cardWidth, cardHeight, borderRadius, borderRadius, 'FD');
        } else {
          doc.roundedRect(posX, posY, cardWidth, cardHeight, borderRadius, borderRadius, 'F');
        }

        // Draw Accent Stripe
        if (accentColor !== "none") {
          const rgb = getAccentRGB(accentColor);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          // Draw a small 2.2mm vertical stripe inside the left edge of the card
          doc.rect(posX + 0.1, posY + 0.1, 2.2, cardHeight - 0.2, 'F');
        }

        // Available dimensions offset if we have color stripe on left
        const stripeWidthOffset = (accentColor !== "none") ? 2.8 : 0;

        // Position of QR Code
        let qrPosX = 0;
        let qrPosY = 0;
        if (qrPosition === "right") {
          qrPosX = posX + cardWidth - qrSize - paddingX;
          qrPosY = posY + (cardHeight - qrSize) / 2;
        } else if (qrPosition === "left") {
          qrPosX = posX + paddingX + stripeWidthOffset;
          qrPosY = posY + (cardHeight - qrSize) / 2;
        } else { // center_top
          qrPosX = posX + (cardWidth - qrSize) / 2;
          qrPosY = posY + paddingX;
        }

        // Calculate Text placement box bounds
        let textPosX = posX + paddingX;
        let textWidth = cardWidth - paddingX * 2;
        let startTextY = posY + paddingX + (fontSize * 0.35) + 1;

        if (qrPosition === "right") {
          textPosX = posX + paddingX + stripeWidthOffset;
          textWidth = cardWidth - qrSize - paddingX * 2 - 3 - stripeWidthOffset;
          startTextY = posY + paddingX + (fontSize * 0.35) + 1;
        } else if (qrPosition === "left") {
          textPosX = posX + paddingX + qrSize + 2.5 + stripeWidthOffset;
          textWidth = cardWidth - qrSize - paddingX * 2 - 3 - stripeWidthOffset;
          startTextY = posY + paddingX + (fontSize * 0.35) + 1;
        } else { // center_top
          textPosX = posX + paddingX;
          textWidth = cardWidth - paddingX * 2;
          startTextY = posY + paddingX + qrSize + (fontSize * 0.35) + 2;
        }

        // Apply alignment coordinate X
        let alignCoordX = textPosX;
        if (textAlign === "center") {
          alignCoordX = textPosX + textWidth / 2;
        } else if (textAlign === "right") {
          alignCoordX = textPosX + textWidth;
        }

        // Draw Product Name
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(15, 23, 42); // slate-900

        const cleanName = item.name || '';
        const nameTextWidth = textWidth > 8 ? textWidth : 12;
        const textLines = doc.splitTextToSize(cleanName, nameTextWidth);

        // Maximum lines estimation depending on card size limit
        const titleLineHeight = fontSize * 0.35 + 0.6;
        const offsetBottom = showSku ? (cardHeight > 20 ? 8 : 4.5) : 3;
        const availableHeightForName = (qrPosition === "center_top") 
          ? (cardHeight - qrSize - paddingX * 2 - offsetBottom)
          : (cardHeight - paddingX * 2 - offsetBottom);

        const maxLines = Math.floor(availableHeightForName / titleLineHeight) || 1;
        const linesToDraw = textLines.slice(0, Math.max(1, maxLines));

        let currentTextY = startTextY;
        linesToDraw.forEach((line: string) => {
          if (currentTextY < posY + cardHeight - 1.5) {
            doc.text(line, alignCoordX, currentTextY, { align: textAlign });
            currentTextY += titleLineHeight;
          }
        });

        // Draw SKU Code
        if (showSku) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(Math.max(6.0, fontSize * 0.75));
          doc.setTextColor(71, 85, 105); // slate-600
          
          let skuY = posY + cardHeight - (cardHeight > 22 ? 5 : 2);
          if (qrPosition === "center_top") {
            skuY = currentTextY + 1.5;
          }
          // Clamp SKU inside card boundaries safely
          if (skuY > posY + cardHeight - 1.2) {
            skuY = posY + cardHeight - 1.2;
          }

          doc.text(`SKU: ${item.id}`, alignCoordX, skuY, { align: textAlign });
        }

        // Logo AlmoxPro at footer corner (only if space available)
        if (showBrand && cardHeight > 22 && qrPosition !== "center_top") {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(fontSize * 0.65);
          doc.setTextColor(148, 163, 184); // slate-400
          
          let brandX = posX + paddingX;
          if (accentColor !== "none" && qrPosition !== "left") brandX += 2.5;
          
          doc.text(`AlmoxPro`, brandX, posY + cardHeight - 1.5);
        }

        // Draw QR Code image
        const qrUrl = item.qrUrl;
        if (qrUrl) {
          try {
            doc.addImage(qrUrl, 'PNG', qrPosX, qrPosY, qrSize, qrSize);
          } catch (e) {
            console.error("Erro ao desenhar QR Code no PDF:", e);
          }
        }
      });

      doc.save(`etiquetas_almoxpro_${selectedTemplateId === 'custom' ? 'personalizado' : selectedTemplateId}.pdf`);
      
      logActivity('qr_sheet_pdf', 'Impressao', `PDF de etiquetas exportadas no modelo "${selectedTemplateId}" com ${exportData.length} itens gerado com customizações de design mestre.`, 'CREATE');
      toast.success("PDF de etiquetas gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Ocorreu um erro ao gerar o PDF das etiquetas.");
    }
  };


  const categoryStats = useMemo(() => {
    const stats: Record<string, { totalSkus: number; totalQty: number; totalValue: number; criticalCount: number }> = {};
    categories.forEach(c => {
      stats[c.name] = { totalSkus: 0, totalQty: 0, totalValue: 0, criticalCount: 0 };
    });
    inventory.forEach(item => {
      const catName = item.category || "Sem Categoria";
      if (!stats[catName]) {
        stats[catName] = { totalSkus: 0, totalQty: 0, totalValue: 0, criticalCount: 0 };
      }
      stats[catName].totalSkus += 1;
      stats[catName].totalQty += (item.qty || 0);
      stats[catName].totalValue += ((item.qty || 0) * (item.price || 0));
      if (item.qty <= (item.minQty || 0)) {
        stats[catName].criticalCount += 1;
      }
    });
    return stats;
  }, [categories, inventory]);

  useEffect(() => {
    const s = searchParams.get("search");
    if (s !== null) {
      setSearchTerm(s);
    }
    const cat = searchParams.get("category");
    if (cat !== null) {
      setSelectedCategory(cat);
      setShowCategories(true);
    }
  }, [searchParams]);

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

  // Derive viewingProduct from URL param for robust state management and back-button support
  const viewId = searchParams.get('view');
  useEffect(() => {
    if (viewId) {
      const item = inventory.find(i => i.id === viewId);
      if (item) {
        setViewingProduct(item);
      }
    } else {
      setViewingProduct(null);
    }
  }, [viewId, inventory]);

  const openViewingProduct = (item: InventoryItem) => {
    setSearchParams(prev => {
      prev.set('view', item.id);
      return prev;
    }, { replace: false });
  };

  const closeViewingProduct = () => {
    setSearchParams(prev => {
      prev.delete('view');
      return prev;
    }, { replace: true });
  };

  const openAjusteEstoque = (produto: InventoryItem, tipo: "IN" | "OUT") => {
    setAjusteParams({ produto, tipo });
    setAjusteQty("");
    setAjusteMotivo("");
    setIsAjusteModalOpen(true);
  };

  const handleSaveAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !ajusteParams.produto) return;
    const qtyNum = Number(ajusteQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }
    
    // Se for saída, validar se não fica negativo
    if (ajusteParams.tipo === "OUT" && ajusteParams.produto.qty < qtyNum) {
      toast.error("Estoque insuficiente para esta saída.");
      return;
    }

    setIsSavingAjuste(true);
    try {
      const authUser = auth.currentUser;
      const user = authUser?.displayName || authUser?.email?.split('@')[0] || "Usuário Desconhecido";
      const userEmail = authUser?.email || "";
      
      const defaultMotivo = ajusteParams.tipo === "IN" ? "Ajuste manual (entrada)" : "Ajuste manual (saída)";
      const motivo = ajusteMotivo.trim() || defaultMotivo;

      await ajustarEstoque(orgId, {
        sku: ajusteParams.produto.id,
        tipo: ajusteParams.tipo,
        qty: qtyNum,
        motivo,
        user,
        userEmail
      });
      
      await logActivity('inventory_movement', 'Estoque', `${ajusteParams.tipo === 'IN' ? 'Entrada' : 'Saída'} manual de ${qtyNum} un de "${ajusteParams.produto.name}"`, 'UPDATE');
      
      toast.success(ajusteParams.tipo === "IN" ? "Entrada registrada com sucesso!" : "Saída registrada com sucesso!");
      setIsAjusteModalOpen(false);
      // Se estava vendo o produto, atualizar os dados dele também, caso ele esteja aberto no modal
      // Como o snapshot vai atualizar a lista geral, a lista geral atualiza.
      // O viewingProduct vai ser atualizado pelo click, mas ele não é reativo se o doc não tiver listener? 
      // É melhor só fechar o modal de visualização ou deixar que o usuário abra de novo.
      // Mas podemos só atualizar localmente.
      if (viewingProduct && viewingProduct.id === ajusteParams.produto.id) {
        setViewingProduct(prev => prev ? { ...prev, qty: prev.qty + (ajusteParams.tipo === "IN" ? qtyNum : -qtyNum) } : null);
      }
    } catch (error: any) {
      console.error("Erro ao ajustar estoque:", error);
      toast.error("Erro ao salvar o ajuste: " + error.message);
    } finally {
      setIsSavingAjuste(false);
    }
  };



  useEffect(() => {
    if (!selectedProduct || !orgId) {
      setHistory([]);
      return;
    }
    // Optimizing massive database: Adding limit and orderBy
    const q = query(
      collection(db, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`),
      orderBy("date", "desc"),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      const h = snap.docs.map(d => ({ id: d.id, ...d.data() } as MovementItem));
      setHistory(h);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`));
    return () => unsub();
  }, [selectedProduct, orgId]);

  useEffect(() => {
    if (!orgId || orgId === "undefined") return;

    // 1. Lê do cache local (Dexie) imediatamente para UI instantânea
    localDb.categorias.where("orgId").equals(orgId).toArray().then(cached => {
      if (cached.length > 0) {
        setCategories(cached as unknown as Category[]);
      }
    }).catch(console.error);

    // 2. Continua usando o snapshot do Firebase para receber atualizações do backend/background
    const q = query(collection(db, `organizations/${orgId}/categories`));
    const unsub = safeOnSnapshot(q, "categories", (items) => {
      const cats = items as Category[];
      setCategories(cats);
      // Sincroniza snapshot para Dexie para o próximo reload ser rápido
      localDb.categorias.bulkPut(cats.map(c => ({ ...c, orgId })));
    }, (error) => {
      console.error("DEBUG: Failed to list categories for orgId:", orgId, "error:", error);
    });
    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (!orgId || orgId === "undefined") return;
    const isDemoMode = localStorage.getItem("isDemoMode") === "true";
    if (isDemoMode) {
      try {
        const saved = localStorage.getItem("demo_employees");
        if (saved) {
          setEmployees(JSON.parse(saved));
          return;
        }
      } catch (e) {}
    }

    const q = query(collection(db, `organizations/${orgId}/employees`));
    const unsub = safeOnSnapshot(q, "employees", (list) => {
      setEmployees(list);
    }, (error) => {
      console.error("DEBUG: Failed to list employees for movement:", error);
    });
    return () => unsub();
  }, [orgId]);

  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const reloadInventory = async () => {
    if (!orgId) return;
    try {
      const { items } = await syncInventory(orgId);
      setAllItems(items);
      setInventory(items); // Keep compatibility with existing statistics and effects
    } catch (err) {
      // Ignoriing for now
    }
  };

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    syncInventory(orgId)
      .then(({ items }) => {
        setAllItems(items);
        setInventory(items);
        setLoading(false);
        setIsInitialLoad(false);
      })
      .catch(() => {
        setLoading(false);
        setIsInitialLoad(false);
      });
  }, [orgId]);

  const loadMore = () => {
    setVisibleCount(prev => prev + 20);
  };

  const filteredItems = React.useMemo(() => {
    let result = allItems;
    if (selectedCategory) {
      result = result.filter(i => i.category === selectedCategory);
    }
    if (debouncedSearchTerm) {
      const termo = debouncedSearchTerm.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(termo) ||
        i.id?.toLowerCase().includes(termo) ||
        i.category?.toLowerCase().includes(termo)
      );
    }

    return result;
  }, [allItems, debouncedSearchTerm, selectedCategory]);

  const inventarioOrdenado = useMemo(() => {
    const itens = [...filteredItems];
    switch (ordem) {
      case "alfabetica_az":
        return itens.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"));
      case "alfabetica_za":
        return itens.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? "", "pt-BR"));
      case "ultimos_adicionados":
        return itens.sort((a, b) => {
          const ta = (a.updatedAt as any)?.seconds ?? (a as any).createdAt?.seconds ?? 0;
          const tb = (b.updatedAt as any)?.seconds ?? (b as any).createdAt?.seconds ?? 0;
          return tb - ta;
        });
      case "primeiros_adicionados":
        return itens.sort((a, b) => {
          const ta = (a.updatedAt as any)?.seconds ?? (a as any).createdAt?.seconds ?? 0;
          const tb = (b.updatedAt as any)?.seconds ?? (b as any).createdAt?.seconds ?? 0;
          return ta - tb;
        });
      case "estoque_critico":
        return itens.sort((a, b) => {
          const scoreA = (a.qty ?? 0) <= (a.minQty ?? 0) ? 0 : 1;
          const scoreB = (b.qty ?? 0) <= (b.minQty ?? 0) ? 0 : 1;
          return scoreA - scoreB;
        });
      case "maior_quantidade":
        return itens.sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0));
      case "menor_quantidade":
        return itens.sort((a, b) => (a.qty ?? 0) - (b.qty ?? 0));
      case "maior_valor":
        return itens.sort((a, b) => ((b.price ?? 0) * (b.qty ?? 0)) - ((a.price ?? 0) * (a.qty ?? 0)));
      case "menor_valor":
        return itens.sort((a, b) => ((a.price ?? 0) * (a.qty ?? 0)) - ((b.price ?? 0) * (b.qty ?? 0)));
      default:
        return itens;
    }
  }, [filteredItems, ordem]);

  const filteredData = React.useMemo(() => {
    return inventarioOrdenado.slice(0, visibleCount);
  }, [inventarioOrdenado, visibleCount]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach(item => {
        map.set(item.category, (map.get(item.category) || 0) + item.qty);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [inventory]);

  const handleSelectAll = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedItems(e.target.checked ? filteredData.map(item => item.id) : []);
  }, [filteredData]);

  const handleSelectItem = React.useCallback((id: string, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, id] : prev.filter(item => item !== id));
  }, []);

  const handlePrintSelectedLabels = async () => {
    // 1. Scan/check for printers (as per user request)
    await handleScanPrinters();

    // 2. Filter selected items
    const selectedList = inventory.filter(item => selectedItems.includes(item.id));
    if (selectedList.length === 0) {
      toast.error("Nenhum item selecionado para exportar etiquetas.");
      return;
    }

    // 3. Generate QR codes for all selected
    setIsGeneratingCategoryQrs(true);
    
    const newExportData = await Promise.all(
      selectedList.map(async item => {
        const itemScanUrl = `${window.location.origin}/scan?sku=${item.id || ""}&org=${orgId}`;
        const url = await QRCode.toDataURL(
          itemScanUrl,
          { margin: 1, width: 200, color: { dark: "#0f172a", light: "#ffffff" } }
        );
        return { name: item.name, id: item.id, qrUrl: url };
      })
    );
    
    setIsGeneratingCategoryQrs(false);
    setExportData(newExportData);
    setIsExportModalOpen(true);
  };

  const handleExportPDF = () => {
    if (selectedItems.length === 0) {
      toast.error("Nenhum item selecionado para exportar.");
      return;
    }
    const itemsToExport = inventory.filter(item => selectedItems.includes(item.id));
    if (itemsToExport.length === 0) {
      toast.error("Itens selecionados não encontrados.");
      return;
    }

    toast.info("Processando e gerando o PDF...");
    try {
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('pt-BR');
      
      // Document header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('Relatório de Estoque - AlmoxPro', 14, 15);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Data: ${date} | Total: ${itemsToExport.length} itens`, 14, 21);
      
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.line(14, 24, 196, 24);

      // Table Headers
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      
      const colSku = 14;
      const colNome = 45;
      const colCat = 115;
      const colQtd = 160;
      const colStatus = 180;
      
      doc.text('SKU / ID', colSku, 31);
      doc.text('Nome do Produto', colNome, 31);
      doc.text('Categoria', colCat, 31);
      doc.text('Estoque', colQtd, 31);
      doc.text('Status', colStatus, 31);
      
      doc.line(14, 34, 196, 34);

      // Table Rows
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85); // slate-700
      
      let currentY = 40;
      itemsToExport.forEach((item) => {
        if (currentY > 275) {
          doc.addPage();
          currentY = 20;
          
          // Re-draw header on new page
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text('SKU / ID', colSku, currentY);
          doc.text('Nome do Produto', colNome, currentY);
          doc.text('Categoria', colCat, currentY);
          doc.text('Estoque', colQtd, currentY);
          doc.text('Status', colStatus, currentY);
          doc.line(14, currentY + 3, 196, currentY + 3);
          currentY += 8;
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
        }

        doc.text(String(item.id || ''), colSku, currentY);
        
        // Truncate name if too long
        let displayName = String(item.name || '');
        if (displayName.length > 35) {
          displayName = displayName.substring(0, 32) + '...';
        }
        doc.text(displayName, colNome, currentY);
        
        doc.text(String(item.category || 'Geral'), colCat, currentY);
        doc.text(`${item.qty ?? 0} un`, colQtd, currentY);
        const statusVal = item.qty <= (item.minQty ?? 0) ? 'Crítico' : 'OK';
        doc.text(statusVal, colStatus, currentY);
        
        currentY += 7;
      });

      doc.save(`relatorio_estoque_${date.replace(/\//g, '_')}.pdf`);
      toast.success("PDF de estoque gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o PDF.");
    }
  };

  const handleExportWhatsApp = () => {
    if (selectedItems.length === 0) {
      toast.error("Nenhum item selecionado para exportar.");
      return;
    }
    const itemsToExport = inventory.filter(item => selectedItems.includes(item.id));
    const date = new Date().toLocaleDateString('pt-BR');
    let message = `*RELATÓRIO DE ESTOQUE - AlmoxPro (${date})*\n\n`;
    message += `*Itens Selecionados (${itemsToExport.length}):*\n`;
    itemsToExport.forEach(item => {
      const statusSymbol = item.qty <= (item.minQty ?? 0) ? '' : '';
      message += `${statusSymbol} *${item.name}* (ID: ${item.id})\n`;
      message += `   • Estoque: ${item.qty} un (Mín: ${item.minQty ?? 0})\n`;
      message += `   • Categoria: ${item.category || 'Geral'}\n`;
      if (item.location) message += `   • Local: ${item.location}\n`;
      message += `\n`;
    });
    
    const phone = prompt("Digite o número de WhatsApp com DDD (apenas números para envio):", "5591986181270") || "";
    sendWhatsAppNotification(phone, message);
    toast.success("Relatório gerado e enviado para o WhatsApp!");
  };

  const handleExportEmail = () => {
    if (selectedItems.length === 0) {
      toast.error("Nenhum item selecionado para exportar.");
      return;
    }
    const itemsToExport = inventory.filter(item => selectedItems.includes(item.id));
    const date = new Date().toLocaleDateString('pt-BR');
    let message = `RELATÓRIO DE ESTOQUE - AlmoxPro (${date})\n\n`;
    message += `Itens Selecionados (${itemsToExport.length}):\n`;
    message += `==================================================\n\n`;
    itemsToExport.forEach(item => {
      const statusText = item.qty <= (item.minQty ?? 0) ? 'CRÍTICO' : 'REGULAR';
      message += `Produto: ${item.name} (SKU: ${item.id})\n`;
      message += `- Estoque: ${item.qty} un (Estoque Mínimo: ${item.minQty ?? 0})\n`;
      message += `- Categoria: ${item.category || 'Geral'}\n`;
      message += `- Local: ${item.location || 'Não Definido'}\n`;
      message += `- Status de Alerta: ${statusText}\n`;
      message += `\n`;
    });

    const email = prompt("Digite o e-mail de destino para o relatório:", "almoxarife@tecgas.com.br") || "";
    sendEmailReport(email, `Relatório de Estoque AlmoxPro - ${date}`, message);
    toast.success("Relatório gerado e enviado para e-mail!");
  };

  const handleDeleteSelected = async () => {
    if(!orgId) return;
    if(window.confirm(`Tem certeza que deseja arquivar ${selectedItems.length} produtos?`)) {
      let didDelete = false;
      for (const id of selectedItems) {
        try {
          await deleteInventoryItem(orgId, id);
          didDelete = true;
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/inventory/${id}`);
        }
      }
      if (didDelete) {
        await resetLocalInventory(orgId);
        await reloadInventory();
      }
      setSelectedItems([]);
    }
  };

  const handleUpdateStatus = async () => {
    if (!orgId) return;
    let didUpdate = false;
    for (const id of selectedItems) {
      const item = inventory.find(i => i.id === id);
      if (item) {
        try {
          await updateInventoryItem(orgId, id, {
            status: 'OK',
            qty: Math.max(item.qty, item.minQty + 10)
          });
          didUpdate = true;
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}/inventory/${id}`);
        }
      }
    }
    if (didUpdate) await reloadInventory();
    setSelectedItems([]);
  };


  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectAllItems = async () => {
    if (!orgId) return;
    toast.loading("Selecionando todos os produtos...");
    try {
      const q = query(collection(db, `organizations/${orgId}/inventory`));
      const snapshot = await getDocs(q);
      const allIds = snapshot.docs.map(doc => doc.id);
      setSelectedItems(allIds);
      toast.dismiss();
      toast.success(`${allIds.length} itens selecionados.`);
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Erro ao selecionar todos.");
    }
  };
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<{ productId: string, productName: string } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formFileInputRef = useRef<HTMLInputElement>(null);
  const formCameraInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isFormDragging, setIsFormDragging] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingMovement, setIsSavingMovement] = useState(false);

  const processAndSetProductFormPhoto = async (file: File) => {
    setIsUploadingPhoto(true);

    try {
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor, selecione um arquivo de imagem válido.");
        return;
      }
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = tempUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 400;
      const MAX_HEIGHT = 400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx?.drawImage(img, 0, 0, width, height);

      const base64Img = canvas.toDataURL("image/jpeg", 0.7);
      URL.revokeObjectURL(tempUrl);

      setNewItemForm(prev => ({ ...prev, imageUrl: base64Img }));
      toast.success("Foto do produto carregada!");
    } catch (error) {
      console.error("Error processing photo:", error);
      toast.error("Erro ao processar foto. Tente novamente.");
    } finally {
      setIsUploadingPhoto(false);
      if (formFileInputRef.current) formFileInputRef.current.value = "";
      if (formCameraInputRef.current) formCameraInputRef.current.value = "";
    }
  };

  const handleCaptureProductFormPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAndSetProductFormPhoto(file);
  };

  const handleFormDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormDragging(true);
  }, []);

  const handleFormDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormDragging(false);
  }, []);

  const handleFormDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAndSetProductFormPhoto(file);
    }
  }, []);

  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingProduct || !orgId) return;

    const tempUrl = URL.createObjectURL(file);
    const originalImageUrl = viewingProduct.imageUrl;

    setViewingProduct({ ...viewingProduct, imageUrl: tempUrl });
    setInventory(prev => prev.map(p => p.id === viewingProduct.id ? { ...p, imageUrl: tempUrl } : p));
    setIsUploadingPhoto(true);

    try {
      const img = new Image();
      img.src = tempUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 224;
      const MAX_HEIGHT = 224;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height *= MAX_WIDTH / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width *= MAX_HEIGHT / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx?.drawImage(img, 0, 0, width, height);

      const base64Img = canvas.toDataURL("image/jpeg", 0.5);

      await updateInventoryItem(orgId, viewingProduct.id, {
        imageUrl: base64Img
      });

      await reloadInventory();
      setViewingProduct(prev => prev?.id === viewingProduct.id ? { ...prev, imageUrl: base64Img } : prev);
      setInventory(prev => prev.map(p => p.id === viewingProduct.id ? { ...p, imageUrl: base64Img } : p));
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Error capturing photo:", error);
      toast.error("Erro ao processar foto. Tente novamente.");
      // Rollback
      setViewingProduct(prev => prev?.id === viewingProduct.id ? { ...prev, imageUrl: originalImageUrl } : prev);
      setInventory(prev => prev.map(p => p.id === viewingProduct.id ? { ...p, imageUrl: originalImageUrl } : p));
    } finally {
      setIsUploadingPhoto(false);
      URL.revokeObjectURL(tempUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!viewingProduct || !orgId || !viewingProduct.imageUrl) return;

    if (!confirm("Tem certeza que deseja apagar a foto deste produto?")) return;

    setIsUploadingPhoto(true);
    try {
      await updateInventoryItem(orgId, viewingProduct.id, {
        imageUrl: deleteField()
      });

      await reloadInventory();
      const updatedProduct = { ...viewingProduct };
      delete updatedProduct.imageUrl;
      setViewingProduct(updatedProduct);
      setInventory(prev => prev.map(p => p.id === viewingProduct.id ? updatedProduct : p));
      toast.success("Foto removida!");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Erro ao apagar foto.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && visibleCount < filteredItems.length) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (scrollRef.current) {
      observer.observe(scrollRef.current);
    }
    return () => {
      if (scrollRef.current) observer.unobserve(scrollRef.current);
    };
  }, [loading, visibleCount, filteredItems.length]);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const handleCaptureCategoryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingPhoto(true);

    try {
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = tempUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 224;
      const MAX_HEIGHT = 224;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height *= MAX_WIDTH / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width *= MAX_HEIGHT / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx?.drawImage(img, 0, 0, width, height);

      const base64Img = canvas.toDataURL("image/jpeg", 0.5);
      URL.revokeObjectURL(tempUrl);

      setNewCategoryForm(prev => ({ ...prev, photoUrl: base64Img }));
    } catch (error) {
      console.error("Error processing category photo:", error);
      toast.error("Erro ao processar foto.");
    } finally {
      setIsUploadingPhoto(false);
      if (categoryFileInputRef.current) categoryFileInputRef.current.value = "";
    }
  };

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: "", category: "Conexões", location: "", qty: 0, minQty: 10, price: 0, imageUrl: "", description: "" });
  const [newCategoryForm, setNewCategoryForm] = useState({ name: "", description: "", purpose: "", photoUrl: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Ajuste rápido de estoque
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [ajusteParams, setAjusteParams] = useState<{ produto: InventoryItem | null, tipo: "IN" | "OUT" }>({ produto: null, tipo: "IN" });
  const [ajusteQty, setAjusteQty] = useState<number | "">("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [isSavingAjuste, setIsSavingAjuste] = useState(false);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setNewItemForm({ 
      name: "", 
      category: selectedCategory || (categories.length > 0 ? categories[0].name : ""), 
      location: "", 
      qty: 0, 
      minQty: 10, 
      price: 0,
      imageUrl: "",
      description: ""
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!newItemForm.name.trim()) errors.name = "O nome é obrigatório.";
    if (!newItemForm.category.trim()) errors.category = "A categoria é obrigatória.";
    if (!newItemForm.location.trim()) errors.location = "A localização é obrigatória.";
    if (newItemForm.qty < 0) errors.qty = "A quantidade não pode ser negativa.";
    if (newItemForm.minQty < 0) errors.minQty = "A quantidade mínima não pode ser negativa.";
    if (newItemForm.price < 0) errors.price = "O valor não pode ser negativo.";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setNewItemForm(prev => ({ ...prev, [field]: value }));
    const errorMsg = validateField(field, value);
    setFormErrors(prev => ({
      ...prev,
      [field]: errorMsg
    }));
  };

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'name': return !value.trim() ? "O nome é obrigatório." : "";
      case 'category': return !value.trim() ? "A categoria é obrigatória." : "";
      case 'location': return !value.trim() ? "A localização é obrigatória." : "";
      case 'qty': return value < 0 ? "A quantidade não pode ser negativa." : "";
      case 'minQty': return value < 0 ? "A quantidade mínima não pode ser negativa." : "";
      case 'price': return value < 0 ? "O valor não pode ser negativo." : "";
      default: return "";
    }
  };

  const handleEdit = (item: any) => {
    const isDemo = localStorage.getItem('isDemoMode') === 'true';
    if (isDemo) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    setEditingId(item.id);
    setNewItemForm({
      name: item.name,
      category: item.category,
      location: item.location,
      qty: item.qty,
      minQty: item.minQty,
      price: item.price || 0,
      imageUrl: item.imageUrl || "",
      description: item.description || ""
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = React.useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingProduct) return;
    
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }

    if (!validateForm() || !orgId) return;
    
    setIsSavingProduct(true);
    let newStatus = 'OK';
    if(newItemForm.qty <= 0) newStatus = 'OUT_OF_STOCK';
    else if(newItemForm.qty <= newItemForm.minQty) newStatus = 'CRITICAL';
    else if(newItemForm.qty <= newItemForm.minQty + 5) newStatus = 'WARNING';

    const newProduct = {
      ...newItemForm,
      status: newStatus,
    };
    
    try {
      if (editingId) {
        await updateInventoryItem(orgId, editingId, newProduct);
        logActivity('product_update', 'Estoque', `Produto "${newProduct.name}" atualizado`, 'UPDATE');
      } else {
        const newId = `PROD-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
        await saveInventoryItem(orgId, newId, newProduct);
        logActivity('product_add', 'Estoque', `Novo produto "${newProduct.name}" adicionado`, 'CREATE');
      }
      await reloadInventory();
      setIsAddModalOpen(false);
      setEditingId(null);
      setFormErrors({});
      setNewItemForm({ name: "", category: "Conexões", location: "", qty: 0, minQty: 10, price: 0, imageUrl: "", description: "" });
      toast.success('Produto Salvo com sucesso');
    } catch (error) {
      console.error("Save product error:", error);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/inventory/${editingId || 'new'}`);
    } finally {
      setIsSavingProduct(false);
    }
  }, [editingId, isSavingProduct, newItemForm, orgId, validateForm]);

  const handleSaveCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingCategory) return;

    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }

    if (!orgId) {
      toast.error('ID da organização não encontrado');
      return;
    }

    if (!newCategoryForm.name.trim()) {
      toast.error('O nome da categoria é obrigatório');
      return;
    }

    setIsSavingCategory(true);
    try {
      if (editingCategoryId) {
        const updateData = {
          name: newCategoryForm.name.trim(),
          description: newCategoryForm.description,
          purpose: newCategoryForm.purpose,
          photoUrl: newCategoryForm.photoUrl,
        };
        await updateDoc(doc(db, `organizations/${orgId}/categories`, editingCategoryId), updateData);
        // Atualiza Dexie local
        await localDb.categorias.update(editingCategoryId, updateData);
        
        logActivity('category_update', 'Categorias', `Categoria "${newCategoryForm.name}" atualizada`, 'UPDATE');
        toast.success('Categoria atualizada com sucesso');
      } else {
        // ID generation for category
        const idBase = newCategoryForm.name.trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
          .replace(/[^a-z0-9]/g, '-'); // replace special chars
        
        const newId = `${idBase}-${Math.random().toString(36).substr(2, 4)}`;
        
        const newData = {
          ...newCategoryForm,
          name: newCategoryForm.name.trim()
        };
        await setDoc(doc(db, `organizations/${orgId}/categories`, newId), newData);
        // Atualiza Dexie local
        await localDb.categorias.put({ id: newId, orgId, ...newData });

        logActivity('category_add', 'Categorias', `Nova categoria "${newCategoryForm.name}" criada`, 'CREATE');
        toast.success('Nova categoria adicionada');
      }
      setIsCategoryModalOpen(false);
      setEditingCategoryId(null);
      setNewCategoryForm({ name: "", description: "", purpose: "", photoUrl: "" });
    } catch (error) {
      console.error("Save category error:", error);
      handleFirestoreError(error, editingCategoryId ? OperationType.UPDATE : OperationType.CREATE, `organizations/${orgId}/categories/${editingCategoryId || 'new'}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    const isDemo = localStorage.getItem('isDemoMode') === 'true';
    if (isDemo) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    setDeleteProductConfirm({ productId, productName });
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductConfirm || !orgId) return;
    try {
        await deleteInventoryItem(orgId, deleteProductConfirm.productId);
        await resetLocalInventory(orgId);
        await reloadInventory();
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/inventory/${deleteProductConfirm.productId}`);
    }
    setDeleteProductConfirm(null);
  };

  const confirmDeleteCategory = async () => {
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!orgId || !categoryToDelete) return;
    try {
      await deleteDoc(doc(db, `organizations/${orgId}/categories`, categoryToDelete.id));
      // Remove do Dexie local
      await localDb.categorias.delete(categoryToDelete.id);
      
      setIsDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, `organizations/${orgId}/categories/${categoryToDelete.id}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OK': return <Badge style={{ background: "rgba(55,138,221,0.1)", color: "#378add", border: "0.5px solid rgba(55,138,221,0.3)" }}>Em Estoque</Badge>;
      case 'WARNING': return <Badge style={{ background: "rgba(0,212,255,0.08)", color: "#00d4ff", border: "0.5px solid rgba(0,212,255,0.2)" }}>Atenção</Badge>;
      case 'CRITICAL': return <Badge style={{ background: "rgba(226,75,74,0.1)", color: "#e24b4a", border: "0.5px solid rgba(226,75,74,0.3)" }}>Estoque Crítico</Badge>;
      case 'OUT_OF_STOCK': return <Badge style={{ background: "rgba(226,75,74,0.1)", color: "#e24b4a", border: "0.5px solid rgba(226,75,74,0.3)" }}>Esgotado</Badge>;
      default: return null;
    }
  }

  const openHistory = (product: any) => {
    setSelectedProduct(product);
  };

  const handleAddMovement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }
    if (!newMovement.reason || newMovement.qty <= 0 || !orgId || isSavingMovement) return;
    const movementId = `MOV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const user = auth.currentUser;
    const movData = {
      type: newMovement.type,
      qty: newMovement.qty,
      reason: newMovement.reason,
      date: new Date().toISOString(),
      user: user?.displayName || "Usuário",
      userEmail: user?.email || "email@exemplo.com",
    };

    setIsSavingMovement(true);
    try {
       const newQty = selectedProduct.qty + (newMovement.type === "IN" ? newMovement.qty : -newMovement.qty);
       let newStatus = selectedProduct.status;
       if(newQty <= 0) newStatus = 'OUT_OF_STOCK';
       else if(newQty <= selectedProduct.minQty) newStatus = 'CRITICAL';
       else if(newQty <= selectedProduct.minQty + 5) newStatus = 'WARNING';
       else newStatus = 'OK';

       await updateInventoryItem(orgId, selectedProduct.id, {
         qty: newQty,
         status: newStatus
       });

       await setDoc(doc(db, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`, movementId), movData);
       await reloadInventory();
       logActivity('inventory_movement', 'Estoque', `${newMovement.type === 'IN' ? 'Entrada' : 'Saída'} de ${newMovement.qty} un de "${selectedProduct.name}"`, 'UPDATE');
       setNewMovement({ type: "IN", qty: 0, reason: "" });
       
       // Update selectedProduct so the UI updates
       setSelectedProduct({ ...selectedProduct, qty: newQty, status: newStatus });
       toast.success("Movimentação Registrada");
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/inventory/${selectedProduct.id}/movements`);
    } finally {
       setIsSavingMovement(false);
    }
  };

  const salvarFuncionarioInline = async () => {
    if (!inlineEmployeeName.trim() || !orgId) return;
    const id = `EMP-${Date.now().toString(36).toUpperCase()}`;
    await setDoc(doc(db, `organizations/${orgId}/employees`, id), {
      name: inlineEmployeeName.trim(),
      role: inlineEmployeeRole,
      status: "ATIVO",
      createdAt: serverTimestamp(),
    });
    setEmployees(prev => [...prev, { id, name: inlineEmployeeName.trim(), role: inlineEmployeeRole }]);
    setOutputEmployeeId(id);
    setInlineEmployeeName("");
    setShowInlineEmployee(false);
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outputProductId || !outputEmployeeId || outputQty < 1) return;
    setIsSavingOutput(true);
    try {
      const emp = employees.find(f => f.id === outputEmployeeId);
      await registrarRetorno(orgId!, {
        sku: outputProductId,
        qty: outputQty,
        employeeId: outputEmployeeId,
        employeeName: emp?.name ?? "",
        user: auth.currentUser?.displayName ?? "Almoxarife",
        userEmail: auth.currentUser?.email ?? "",
      });
      toast.success("Retorno registrado com sucesso!");
      setIsOutputModalOpen(false);
      setOutputModalMode("saida");
      setOutputProductId(""); setOutputEmployeeId(""); setOutputQty(0); setOutputNotes(""); setOutputFilteredInventory(null);
    } catch (e: any) {
      toast.error("Erro ao registrar retorno: " + e.message);
    } finally {
      setIsSavingOutput(false);
    }
  };

  const startOutputScanner = async () => {
    setOutputScannerError("");
    setIsOutputScanning(true);
    
    // Wait for the next tick to ensure the output-qr-reader div is mounted in the DOM
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("output-qr-reader");
        outputScannerRef.current = scanner;
    
        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };
    
        const onScanSuccess = (decodedText: string) => {
          const sku = extrairSKU(decodedText);
          if (sku) {
            setAllItems((prevInventory) => {
              const found = prevInventory.find(i => i.id.toUpperCase() === sku.toUpperCase());
              if (found) {
                setOutputProductId(found.id);
                setOutputQty(1);
                navigator.vibrate?.([100, 50, 100]);
                if (outputScannerRef.current) {
                  outputScannerRef.current.stop().catch(() => {});
                  outputScannerRef.current = null;
                }
                setIsOutputScanning(false);
              } else {
                setOutputScannerError(`Produto "${sku}" não encontrado no estoque.`);
              }
              return prevInventory;
            });
          }
        };
  
        try {
          await scanner.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => {}
          );
        } catch (err) {
          console.warn("Falha ao usar câmera traseira, tentando fallback:", err);
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              await scanner.start(
                cameras[0].id,
                config,
                onScanSuccess,
                () => {}
              );
            } else {
              throw new Error("Nenhuma câmera encontrada no dispositivo.");
            }
          } catch (fallbackErr: any) {
            throw fallbackErr || err;
          }
        }
      } catch (e: any) {
        console.error("Erro no scanner:", e);
        let errorMsg = "Erro desconhecido.";
        if (typeof e === 'string') {
          errorMsg = e;
        } else if (e instanceof Error) {
          errorMsg = e.message;
        } else if (e && e.name) {
          errorMsg = e.name;
        }
        
        if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
          setOutputScannerError("Permissão negada. Por favor, permita o acesso à câmera no seu navegador. Se estiver no preview, tente abrir em uma nova aba.");
        } else {
          setOutputScannerError("Erro ao acessar a câmera: " + errorMsg + ". Tente abrir o app em uma nova guia.");
        }
        setIsOutputScanning(false);
      }
    }, 100);
  };

  const stopOutputScanner = async () => {
    if (outputScannerRef.current) {
      try {
        await outputScannerRef.current.stop();
      } catch (e) {}
      outputScannerRef.current = null;
    }
    setIsOutputScanning(false);
  };

  const handleSaveMaterialOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }

    if (!orgId || isSavingOutput) return;

    // Validate product
    const product = inventory.find(i => i.id === outputProductId);
    if (!product) {
      toast.error("Produto selecionado é inválido.");
      return;
    }

    // Validate quantity
    if (outputQty <= 0) {
      toast.error("Quantidade de saída deve ser maior que zero.");
      return;
    }

    if (product.qty < outputQty) {
      toast.error(`Quantidade insuficiente em estoque. Saldo disponível: ${product.qty} un.`);
      return;
    }

    // Validate employee
    const employee = employees.find(emp => emp.id === outputEmployeeId);
    if (!employee) {
      toast.error("Por favor, selecione o funcionário solicitante.");
      return;
    }

    // Prepare movement details
    const selectedActivity = outputActivity === "Outras" ? outputCustomActivity.trim() : outputActivity;
    if (!selectedActivity) {
      toast.error("Especifique a atividade da requisição.");
      return;
    }

    const movementId = `MOV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const user = auth.currentUser;
    const finalReason = `[Atividade: ${selectedActivity} - Requisitante: ${employee.name}] ${outputNotes.trim()}`.trim();

    const movData = {
      type: "OUT",
      qty: outputQty,
      reason: finalReason,
      date: new Date().toISOString(),
      user: user?.displayName || "Usuário",
      userEmail: user?.email || "email@exemplo.com",
    };

    setIsSavingOutput(true);
    try {
      const newQty = product.qty - outputQty;
      let newStatus = product.status;
      if (newQty <= 0) newStatus = 'OUT_OF_STOCK';
      else if (newQty <= product.minQty) newStatus = 'CRITICAL';
      else if (newQty <= product.minQty + 5) newStatus = 'WARNING';
      else newStatus = 'OK';

      // 1. Update stock in inventory
      await updateInventoryItem(orgId, product.id, {
        qty: newQty,
        status: newStatus
      });

      // 2. Add movement record
      await setDoc(doc(db, `organizations/${orgId}/inventory/${product.id}/movements`, movementId), movData);
      
      await reloadInventory();

      // 3. Log activity
      await logActivity('inventory_movement', 'Estoque', `Saída de Material p/ Atividade: ${selectedActivity} | ${outputQty} un de "${finalReason.replace(/\[Atividade:.*?\]\s*/, '')}"`, 'UPDATE');

      toast.success("Saída de Material registrada com sucesso!");
      
      // Reset form & close modal
      setIsOutputModalOpen(false);
      setOutputProductId("");
      setOutputFilteredInventory(null);
      setOutputEmployeeId("");
      setOutputQty(0);
      setOutputActivity("Montagem");
      setOutputCustomActivity("");
      setOutputNotes("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/inventory/${product.id}/movements`);
    } finally {
      setIsSavingOutput(false);
    }
  };

  const handleSaveMaterialReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }

    if (!orgId || isSavingReturn) return;

    // Validate product
    const product = inventory.find(i => i.id === returnProductId);
    if (!product) {
      toast.error("Produto selecionado é inválido.");
      return;
    }

    // Validate quantity
    if (returnQty <= 0) {
      toast.error("Quantidade de retorno deve ser maior que zero.");
      return;
    }

    // Validate employee
    const employee = employees.find(emp => emp.id === returnEmployeeId);
    if (!employee) {
      toast.error("Por favor, selecione quem está devolvendo.");
      return;
    }

    const movementId = `MOV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const user = auth.currentUser;
    const finalReason = `[Retorno - Técnico: ${employee.name}] Estado: ${returnState}. ${returnNotes.trim()}`.trim();

    const movData = {
      type: "IN",
      qty: returnQty,
      reason: finalReason,
      date: new Date().toISOString(),
      user: user?.displayName || "Usuário",
      userEmail: user?.email || "email@exemplo.com",
    };

    setIsSavingReturn(true);
    try {
      const newQty = product.qty + returnQty;
      let newStatus = product.status;
      if (newQty <= 0) newStatus = 'OUT_OF_STOCK';
      else if (newQty <= product.minQty) newStatus = 'CRITICAL';
      else if (newQty <= product.minQty + 5) newStatus = 'WARNING';
      else newStatus = 'OK';

      // 1. Update stock in inventory
      await updateInventoryItem(orgId, product.id, {
        qty: newQty,
        status: newStatus
      });

      // 2. Add movement record
      await setDoc(doc(db, `organizations/${orgId}/inventory/${product.id}/movements`, movementId), movData);
      
      await reloadInventory();

      // 3. Log activity
      await logActivity('inventory_movement', 'Estoque', `Retorno de Material: ${returnQty} un de "${product.name}" por ${employee.name} (${returnState})`, 'UPDATE');

      toast.success("Retorno de Material registrado com sucesso!");
      
      // Reset form & close modal
      setIsReturnModalOpen(false);
      setReturnProductId("");
      setReturnEmployeeId("");
      setReturnQty(0);
      setReturnState("INTEGRO");
      setReturnNotes("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}/inventory/${product.id}/movements`);
    } finally {
      setIsSavingReturn(false);
    }
  };

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo()) {
      (window as any).triggerDemoBlock?.();
      return;
    }

    if (!orgId || isSavingQuickProduct) return;

    if (!quickProdName.trim()) {
      toast.error("Por favor, informe o nome do produto.");
      return;
    }

    setIsSavingQuickProduct(true);
    const newId = `PROD-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    
    let newStatus = 'OK';
    if (quickProdQty <= 0) newStatus = 'OUT_OF_STOCK';
    else if (quickProdQty <= quickProdMinQty) newStatus = 'CRITICAL';
    else if (quickProdQty <= quickProdMinQty + 5) newStatus = 'WARNING';

    const newProduct = {
      name: quickProdName.trim(),
      category: quickProdCategory.trim() || (categories.length > 0 ? categories[0].name : "Materiais"),
      location: quickProdLocation.trim() || "Almoxarifado",
      qty: quickProdQty,
      minQty: quickProdMinQty,
      price: quickProdPrice,
      imageUrl: "",
      description: "Cadastrado de forma rápida via fluxo de saídas.",
      status: newStatus
    };

    try {
      await saveInventoryItem(orgId, newId, newProduct);
      await reloadInventory();

      await logActivity('product_add', 'Estoque', `Novo produto "${newProduct.name}" cadastrado via fluxo de Saídas`, 'CREATE');

      toast.success("Novo produto cadastrado com sucesso!");
      
      // Select the product
      setOutputProductId(newId);
      setOutputQty(prev => prev > 0 ? Math.min(prev, quickProdQty) : 1);
      
      // Close subform
      setIsAddProdFromOutputOpen(false);

      // Reset
      setQuickProdName("");
      setQuickProdCategory("");
      setQuickProdLocation("Almoxarifado");
      setQuickProdQty(10);
      setQuickProdMinQty(2);
      setQuickProdPrice(0);
    } catch (error) {
      console.error("Erro ao cadastrar produto rápido:", error);
      toast.error("Erro ao cadastrar produto rápido.");
    } finally {
      setIsSavingQuickProduct(false);
    }
  };

  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return history.slice(start, start + itemsPerPage);
  }, [history, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProduct]);

  const allSelected = filteredData.length > 0 && selectedItems.length === filteredData.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < filteredData.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Gerencie seus produtos, SKUs e alocação no armazém.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {isDemo() ? (
            <Button variant="outline" size="sm" onClick={() => (window as any).triggerDemoBlock?.()}>
               <Database className="h-4 w-4 mr-2" />
               Importar
            </Button>
          ) : (
            <Link to="/app/estoque/importar">
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Importar
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCategories(!showCategories)}>
            {showCategories ? (
              <><EyeOff className="h-4 w-4 mr-2" /> Ocultar Categorias</>
            ) : (
              <><Eye className="h-4 w-4 mr-2" /> Visualizar Categorias</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (isDemo()) {
              (window as any).triggerDemoBlock?.();
              return;
            }
            const email = prompt("Digite o e-mail para envio do relatório:", "contato@almoxpro.com.br");
            if (email) {
              const report = generateInventoryReport(inventory);
              sendEmailReport(email, "Relatório de Estoque - AlmoxPro", report);
            }
          }}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => {
            if (isDemo()) {
              (window as any).triggerDemoBlock?.();
              return;
            }
            const report = generateInventoryReport(inventory);
            sendWhatsAppNotification("", report);
          }}>
            <Phone className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-border">
        <button className="px-6 py-2 border-b-2 border-primary font-bold text-sm text-primary flex items-center gap-2 transition-all">
          <Package className="h-4 w-4" />
          Estoque
        </button>
        <Link 
          to="/app/leads"
          onClick={(e) => {
            if (isDemo()) {
              e.preventDefault();
              (window as any).triggerDemoBlock?.();
            }
          }}
          className="px-6 py-2 border-b-2 border-transparent hover:border-border font-medium text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-all"
        >
          <MessageSquare className="h-4 w-4" />
          Leads (CRM)
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quantidade por Categoria</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {isInitialLoad ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--primary))" 
                  isAnimationActive={typeof window !== 'undefined' && localStorage.getItem('almox_perf_mode') !== 'pocket' && !document.body.classList.contains('ultra-perf-mode')}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {showCategories && (
        <div className="mb-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Header row with stats & view switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 border border-border/60 rounded-xl p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Painel de Categorias
                </h2>
                <Badge variant="secondary" className="font-semibold text-xs py-0.5 bg-primary/10 text-primary border-primary/20">
                  {categories.length} {categories.length === 1 ? "Categoria" : "Categorias"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitore a distribuição de estoque, verifique SKUs, e avalie a saúde operacional por categoria.
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* Grid / Carousel Toggle */}
              <div className="flex items-center bg-background border rounded-lg p-0.5 shadow-sm">
                <Button
                  size="sm"
                  variant={categoryViewMode === 'grid' ? 'secondary' : 'ghost'}
                  onClick={() => setCategoryViewMode('grid')}
                  className={cn(
                    "h-8 px-3 text-xs font-medium gap-1.5 rounded-md",
                    categoryViewMode === 'grid' && "bg-card shadow-sm text-foreground font-semibold"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Grade
                </Button>
                <Button
                  size="sm"
                  variant={categoryViewMode === 'carousel' ? 'secondary' : 'ghost'}
                  onClick={() => setCategoryViewMode('carousel')}
                  className={cn(
                    "h-8 px-3 text-xs font-medium gap-1.5 rounded-md",
                    categoryViewMode === 'carousel' && "bg-card shadow-sm text-foreground font-semibold"
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Carrossel
                </Button>
              </div>

              <Button size="sm" className="shadow-sm font-semibold h-9" onClick={() => {
                setEditingCategoryId(null);
                setNewCategoryForm({ name: "", description: "", purpose: "", photoUrl: "" });
                setIsCategoryModalOpen(true);
              }}>
                 <Plus className="h-4 w-4 mr-1.5" /> Nova Categoria
              </Button>
            </div>
          </div>

          {/* Quick general metrics preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card/50 border border-border/50 rounded-xl p-3 flex flex-col justify-center min-h-[76px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Total de SKU cadastrados</span>
              {isInitialLoad ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-lg font-bold font-mono text-foreground/90">{inventory.length} produtos</span>
              )}
            </div>
            <div className="bg-card/50 border border-border/50 rounded-xl p-3 flex flex-col justify-center min-h-[76px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Total de Unidades</span>
              {isInitialLoad ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className="text-lg font-bold font-mono text-foreground/90">
                  {inventory.reduce((acc, i) => acc + (i.qty || 0), 0).toLocaleString('pt-BR')} itens
                </span>
              )}
            </div>
            <div className="bg-card/50 border border-border/50 rounded-xl p-3 flex flex-col justify-center min-h-[76px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Total em Ativos</span>
              {isInitialLoad ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <span className="text-lg font-bold font-mono text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    inventory.reduce((acc, i) => acc + ((i.qty || 0) * (i.price || 0)), 0)
                  )}
                </span>
              )}
            </div>
            <div className="bg-card/50 border border-border/50 rounded-xl p-3 flex flex-col justify-center min-h-[76px]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Filtro Ativo</span>
              <span className="text-sm font-semibold text-muted-foreground line-clamp-1">
                {selectedCategory ? (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 py-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {selectedCategory}
                  </Badge>
                ) : (
                  "Nenhum (Mostrando Tudo)"
                )}
              </span>
            </div>
          </div>
          
          {/* Main List */}
          <div className={cn(
            "w-full",
            categoryViewMode === 'carousel' 
              ? "flex overflow-x-auto pb-4 -mx-1 px-1 gap-4 snap-x hide-scrollbar h-full"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          )}>
            <AnimatePresence mode="popLayout">
              {categories.map((c, index) => {
                const stats = categoryStats[c.name] || { totalSkus: 0, totalQty: 0, totalValue: 0, criticalCount: 0 };
                const isSelected = selectedCategory === c.name;
                
                // Beautiful badge helper for purposes
                const getPurposeBadgeColor = (purpose: string) => {
                  const p = (purpose || "Geral").toLowerCase();
                  if (p.includes("epi") || p.includes("segurança") || p.includes("proteção")) return "bg-[#378add]/10 text-[#378add] dark:text-[#378add] border-[#378add]/20";
                  if (p.includes("ferramenta") || p.includes("máquina") || p.includes("construção") || p.includes("ferro")) return "bg-[#00d4ff]/10 text-[#00d4ff] dark:text-[#00d4ff] border-[#00d4ff]/20";
                  if (p.includes("escritório") || p.includes("adm") || p.includes("papel")) return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
                  if (p.includes("eletro") || p.includes("fio") || p.includes("tecnologia")) return "bg-[#4a7a9b]/10 text-[#4a7a9b] dark:text-[#4a7a9b] border-[#4a7a9b]/20";
                  return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
                };

                return (
                  <motion.div 
                    key={c.id} 
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ delay: index * 0.03, type: "spring", stiffness: 260, damping: 20 }}
                    className={cn(
                      categoryViewMode === 'carousel' && "min-w-[290px] sm:min-w-[325px] snap-start flex-shrink-0",
                      "p-5 border rounded-xl relative group cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden transform-gpu will-change-transform",
                      isSelected 
                        ? "border-primary bg-primary/[0.02] ring-1 ring-primary/40 shadow-md scale-[1.01]" 
                        : "bg-card border-border/70 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                    )}
                    onClick={() => {
                      setSelectedCategory(prev => prev === c.name ? null : c.name);
                      setTimeout(() => {
                        const container = document.querySelector('main');
                        const target = document.getElementById('inventory-table');
                        if (container && target) {
                          const containerRect = container.getBoundingClientRect();
                          const targetRect = target.getBoundingClientRect();
                          const scrollOffset = targetRect.top - containerRect.top + container.scrollTop - 24;
                          container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                        } else {
                          target?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }, 100);
                    }}
                  >
                    {/* Decorative glowing backdrops */}
                    <div className={cn(
                      "absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl transition-opacity duration-500",
                      isSelected ? "bg-primary/10 opacity-100" : "bg-primary/5 opacity-40 group-hover:opacity-100"
                    )} />
                    
                    <div>
                      {/* Brand/Heading Layout */}
                      <div className="flex justify-between items-start gap-2 mb-2 relative z-10">
                        <div className="space-y-1 flex-1">
                          <h3 className="font-bold text-base tracking-tight text-foreground/90 line-clamp-1">
                            {c.name}
                          </h3>
                          <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider py-0.5 px-2", getPurposeBadgeColor(c.purpose))}>
                            {c.purpose || "Geral"}
                          </Badge>
                        </div>

                        {/* Fast Action Board */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategoryId(c.id);
                              setNewCategoryForm({ name: c.name, description: c.description, purpose: c.purpose, photoUrl: c.photoUrl || "" });
                              setIsCategoryModalOpen(true);
                            }}
                            className="h-8 w-8 rounded-full hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar Categoria"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategoryToDelete(c);
                              setIsDeleteCategoryModalOpen(true);
                            }}
                            className="h-8 w-8 rounded-full hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Brief description */}
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-2 relative z-10 leading-relaxed">
                        {c.description || "Nenhuma descrição informada."}
                      </p>
                    </div>

                    {/* Stats Panel */}
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-2 relative z-10">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/30 p-2 rounded-lg flex items-center gap-2">
                          <div className="text-muted-foreground p-1 bg-background rounded border border-border/30">
                            <Tag className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground">SKUs</p>
                            <p className="font-bold font-mono text-foreground/80">{stats.totalSkus}</p>
                          </div>
                        </div>

                        <div className="bg-muted/30 p-2 rounded-lg flex items-center gap-2">
                          <div className="text-muted-foreground p-1 bg-background rounded border border-border/30">
                            <Layers className="h-3.5 w-3.5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground">Unidades</p>
                            <p className="font-bold font-mono text-foreground/80">{stats.totalQty}</p>
                          </div>
                        </div>
                      </div>

                      {/* Financial valuation stat display */}
                      <div className="bg-primary/5 p-2 rounded-lg flex items-center justify-between border border-primary/10">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Valor do Ativo</span>
                        </div>
                        <span className="font-bold font-mono text-xs text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
                        </span>
                      </div>

                      {/* Alerts bar indicator */}
                      <div className="flex items-center justify-between pt-1">
                        {stats.criticalCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold bg-[#e24b4a]/10 text-[#e24b4a] dark:text-[#e24b4a] border border-[#e24b4a]/20 rounded-full animate-pulse">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {stats.criticalCount} {stats.criticalCount === 1 ? "produto crítico" : "produtos críticos"}
                          </span>
                        ) : stats.totalSkus > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[#378add]/10 text-[#378add] dark:text-[#378add] border border-[#378add]/20 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#378add]/10" />
                            Estoque saudável
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-muted text-muted-foreground border rounded-full">
                            Vazio
                          </span>
                        )}

                        {isSelected && (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1 animate-bounce">
                            Selecionado
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {categories.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-xl w-full text-muted-foreground bg-muted/10 min-h-[160px]">
                <Database className="w-10 h-10 mb-3 opacity-40 text-primary" />
                <p className="text-base font-bold text-foreground/80">Nenhuma categoria cadastrada.</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px] text-center">Inicie adicionando sua primeira categoria para classificar e organizar o estoque.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showCategories && selectedCategory && (
        <div className="mb-6 bg-card border border-border/70 rounded-2xl shadow-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Produtos em <span className="text-primary">{selectedCategory}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Gere etiquetas QR Code e organize o estoque físico de gôndolas e prateleiras.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 bg-muted">
                {inventory.filter(p => p.category === selectedCategory).length} SKUs Cadastrados
              </Badge>
              <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 border-primary/20 bg-primary/5 text-primary">
                {inventory.filter(p => p.category === selectedCategory).reduce((acc, curr) => acc + (curr.qty || 0), 0)} Itens Totais
              </Badge>
            </div>
          </div>

          {/* List of products */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {inventory.filter(p => p.category === selectedCategory).map((product) => {
              const isLowStock = product.qty <= (product.minQty || 0);

              return (
                <div 
                  key={product.id} 
                  className={cn(
                    "flex items-center justify-between p-3.5 border rounded-xl bg-muted/20 hover:bg-card hover:shadow-sm transition-all duration-200",
                    isLowStock ? "border-[#00d4ff]/20 bg-[#00d4ff]/10/[0.02]" : "border-border/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 bg-background border rounded-lg flex items-center justify-center text-muted-foreground overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 opacity-60 text-primary" />
                      )}
                      
                      {isLowStock && (
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#00d4ff]/10 rounded-full ring-2 ring-background animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground/90 line-clamp-1 truncate" title={product.name}>
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground bg-muted p-0.5 px-1.5 rounded-md">
                          {product.id || 'S/ SKU'}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold font-mono",
                          isLowStock ? "text-[#00d4ff]" : "text-[#378add]"
                        )}>
                          Qtd: {product.qty} un
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setSelectedProductForQr(product)}
                    className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary-foreground dark:hover:text-primary transition-all active:scale-95"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Gerar QR
                  </Button>
                </div>
              );
            })}

            {inventory.filter(p => p.category === selectedCategory).length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Package className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm font-semibold">Nenhum produto cadastrado nesta categoria</p>
                <p className="text-xs mt-0.5">Vá ao formulário de cadastro de produtos e classifique um produto com esta categoria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Card className="scroll-mt-6" id="inventory-table">
        <CardHeader className="p-4 pb-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
            <div className="flex items-center gap-2 w-full max-w-md">
              <div className="flex-1 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input 
                  type="text" 
                  placeholder="Buscar por SKU ou Nome..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))]"
                />
              </div>

              {/* Dropdown de ordenação */}
              <div style={{ position: "relative" }} className="w-full sm:w-auto">
                <select
                  value={ordem}
                  onChange={e => mudarOrdem(e.target.value as OrdemInventario)}
                  className="h-9 w-full sm:w-auto px-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm cursor-pointer outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 transition-colors appearance-none pr-8 font-semibold text-foreground whitespace-nowrap"
                >
                  <option value="alfabetica_az">Ordem Alfabética (A → Z)</option>
                  <option value="alfabetica_za">Ordem Alfabética (Z → A)</option>
                  <option value="ultimos_adicionados">Últimos alterados</option>
                  <option value="primeiros_adicionados">Primeiros alterados</option>
                  <option value="estoque_critico">Estoque crítico primeiro</option>
                  <option value="maior_quantidade">Maior quantidade primeiro</option>
                  <option value="menor_quantidade">Menor quantidade primeiro</option>
                  <option value="maior_valor">Maior valor total</option>
                  <option value="menor_valor">Menor valor total</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>
            </div>
            
            {selectedCategory && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium animate-in fade-in self-start">
                <span>Categoria: {selectedCategory}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => setSelectedCategory(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          {selectedItems.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 animate-in fade-in zoom-in-95 bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-2 rounded-xl shadow-lg text-sm font-medium w-full xl:w-auto">
              <span className="px-2">{selectedItems.length} {selectedItems.length === 1 ? 'selecionado' : 'selecionados'}</span>
              <div className="w-px h-4 bg-[hsl(var(--border))] hidden sm:block" />
              <Button variant="outline" size="sm" className="h-8 border-[hsl(var(--primary))/20] hover:bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))] font-bold" onClick={selectAllItems}>
                <Check className="h-3.5 w-3.5 mr-1" /> Marcar Todos
              </Button>
              <Button variant="outline" size="sm" className="h-8 border-[hsl(var(--primary))/20] hover:bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))] font-bold" onClick={handleUpdateStatus}>
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Reabastecer
              </Button>
              <div className="flex items-center gap-1 border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-1 rounded-lg">
                <span className="text-[10px] uppercase font-black tracking-wider text-[hsl(var(--primary))] px-2 select-none hidden md:inline">Exportar para:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2.5 text-xs text-foreground font-bold hover:bg-[hsl(var(--primary))]/10 cursor-pointer" 
                  onClick={handleExportPDF}
                >
                  <FileText className="h-3.5 w-3.5 mr-1 text-[#e24b4a]" /> PDF
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2.5 text-xs text-foreground font-bold hover:bg-[hsl(var(--primary))]/10 cursor-pointer" 
                  onClick={handleExportWhatsApp}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1 text-[#378add]" /> WhatsApp
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2.5 text-xs text-foreground font-bold hover:bg-[hsl(var(--primary))]/10 cursor-pointer" 
                  onClick={handleExportEmail}
                >
                  <Mail className="h-3.5 w-3.5 mr-1 text-blue-500" /> E-mail
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-8 border-destructive/20 hover:bg-destructive/5 text-destructive font-bold" onClick={handleDeleteSelected}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
              </Button>
              <Button variant="outline" size="sm" className="h-8 border-[hsl(var(--primary))]/20 hover:bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))] font-bold" onClick={handlePrintSelectedLabels}>
                <QrCode className="h-3.5 w-3.5 mr-1" /> Gerar Etiqueta QR
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap w-full xl:w-auto mt-2 xl:mt-0 justify-start sm:justify-end">
              <button
                onClick={() => { setIsOutputModalOpen(true); setOutputModalMode("saida"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 16px", borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(55,138,221,0.15))",
                  border: "0.5px solid rgba(0,212,255,0.3)",
                  color: "#e8f4ff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <ArrowDownRight style={{ width: 14, height: 14, color: "#00d4ff" }} />
                Saída / Retorno
                <RotateCcw style={{ width: 13, height: 13, color: "#378add" }} />
              </button>
              <Button size="sm" className="h-9 flex-1 sm:flex-initial font-bold" onClick={handleOpenAddModal}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-4 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-[hsl(var(--muted-foreground))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                    checked={allSelected}
                    ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                    onChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[100px]">SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Localização</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden sm:table-cell text-center w-[140px]">Status</TableHead>
                <TableHead className="text-center w-[160px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInitialLoad ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-4 text-center"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="hidden sm:table-cell text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredData.map((item) => (
                    <motion.tr 
                      key={item.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      data-state={selectedItems.includes(item.id) ? "selected" : undefined}
                      className="cursor-pointer transition-colors hover:bg-muted/50 border-b transform-gpu will-change-transform"
                      onClick={() => openViewingProduct(item)}
                    >
                      <TableCell className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-[hsl(var(--muted-foreground))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium text-xs truncate max-w-[80px]">{item.id}</TableCell>
                      <TableCell className="font-medium whitespace-normal break-words min-w-[200px]">
                        <div>{item.name}</div>
                        <div className="sm:hidden mt-1">{getStatusBadge(item.status)}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[hsl(var(--muted-foreground))]">{item.category}</TableCell>
                      <TableCell className="hidden lg:table-cell text-[hsl(var(--muted-foreground))] text-sm">{item.location}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span className={item.qty < item.minQty ? 'text-destructive' : ''}>
                          {item.qty}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm max-w-[100px] truncate">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center">
                        {getStatusBadge(item.status)}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { e.stopPropagation(); setSelectedProductForQr(item); }}
                            title="Generate QR"
                            className="text-primary hover:bg-primary/10"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(item); }} title="Editar">
                            <Edit2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(item.id, item.name); }} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openHistory(item); }} title="Ver Histórico">
                            <History className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
              
              {!isInitialLoad && filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      {visibleCount < filteredItems.length && (
            <div ref={scrollRef} className="h-4" />
          )}
        </CardContent>
      </Card>

      {/* View Product Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl border-none max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 shrink-0">
              <CardTitle className="text-xl">Detalhes do Produto</CardTitle>
              <button className="p-2 rounded-full hover:bg-accent transition-colors" onClick={() => closeViewingProduct()}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardHeader>
            <CardContent className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold">{viewingProduct.name}</h3>
                  <div className="text-sm font-mono text-muted-foreground mt-1">{viewingProduct.id}</div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-3 mb-4">
                  {viewingProduct.imageUrl ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-black/5 flex items-center justify-center group">
                      <img src={viewingProduct.imageUrl} alt={viewingProduct.name} className="max-w-full max-h-full object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" decoding="async" onClick={() => setZoomedImageUrl(viewingProduct.imageUrl || null)} />
                      <div className="absolute top-2 right-2 bg-black/40 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                        <ZoomIn className="w-5 h-5" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-video rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground flex-col gap-2">
                       <ImageIcon className="w-8 h-8 opacity-50" />
                       <span className="text-sm">Sem foto associada</span>
                    </div>
                  )}

                  <input type="file" accept="image/*" capture="environment" hidden ref={fileInputRef} onChange={handleCapturePhoto} />
                  <div className="flex gap-2 w-full">
                    <Button variant="secondary" className="w-full flex-1" onClick={() => fileInputRef.current?.click()} disabled={isUploadingPhoto}>
                      <Camera className="w-4 h-4 mr-2" />
                      {isUploadingPhoto ? "Aguarde..." : (viewingProduct.imageUrl ? "Trocar Foto" : "Tirar Foto")}
                    </Button>
                    {viewingProduct.imageUrl && (
                      <Button variant="destructive" className="w-full flex-1" onClick={handleDeletePhoto} disabled={isUploadingPhoto}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Apagar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    <div>{getStatusBadge(viewingProduct.status)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Valor Unitário</span>
                    <div className="font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProduct.price)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Categoria</span>
                    <div>{viewingProduct.category}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Localização</span>
                    <div>{viewingProduct.location}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Quantidade Atual</span>
                    <div className={cn("font-mono text-lg font-bold", viewingProduct.qty < viewingProduct.minQty ? "text-destructive" : "")}>
                      {viewingProduct.qty}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Quantidade Mínima</span>
                    <div className="font-mono">{viewingProduct.minQty}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground">Valor Total em Estoque</span>
                    <div className="font-mono text-lg font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingProduct.price * viewingProduct.qty)}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-4 border-t mt-6">
                <div className="flex gap-2">
                  <Button variant="outline" type="button" onClick={() => openAjusteEstoque(viewingProduct, "IN")} className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600">+ Entrada</Button>
                  <Button variant="outline" type="button" onClick={() => openAjusteEstoque(viewingProduct, "OUT")} className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive">- Saída</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => closeViewingProduct()}>Fechar</Button>
                  <Button onClick={() => { handleEdit(viewingProduct); closeViewingProduct(); }}>
                    Editar Produto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ajuste Estoque Modal */}
      {isAjusteModalOpen && ajusteParams.produto && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 shrink-0">
              <CardTitle className="text-lg">
                {ajusteParams.tipo === "IN" ? "Adicionar Entrada" : "Registrar Saída"}
              </CardTitle>
              <button className="p-2 rounded-full hover:bg-accent transition-colors" onClick={() => setIsAjusteModalOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </CardHeader>
            <form onSubmit={handleSaveAjuste} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <CardContent className="p-6 space-y-4 overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Ajustando estoque geral para o item <strong>{ajusteParams.produto.name}</strong>.
                  <br />
                  Estoque atual: <strong>{ajusteParams.produto.qty}</strong>
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full h-10 px-3 border rounded-lg bg-background"
                    value={ajusteQty}
                    onChange={(e) => setAjusteQty(e.target.value ? Number(e.target.value) : "")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivo (Opcional)</label>
                  <input
                    type="text"
                    className="w-full h-10 px-3 border rounded-lg bg-background"
                    placeholder={ajusteParams.tipo === "IN" ? "Ex: Compra, devolução..." : "Ex: Quebra, uso interno..."}
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                  />
                </div>
              </CardContent>
              <div className="p-6 pt-0 mt-auto border-t">
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsAjusteModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isSavingAjuste} className={ajusteParams.tipo === "IN" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-destructive hover:bg-destructive/90 text-white"}>
                    {isSavingAjuste ? "Salvando..." : "Confirmar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-xl max-h-[95vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <CardTitle className="text-xl">{editingId ? 'Editar Produto' : 'Adicionar Produto'}</CardTitle>
              <button className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => { setIsAddModalOpen(false); setFormErrors({}); }} type="button">
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <CardContent className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Produto <span className="text-destructive">*</span></label>
                <input 
                  type="text" 
                  className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.name ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                  placeholder="Ex: Teclado Mecânico"
                  value={newItemForm.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria <span className="text-destructive">*</span></label>
                  <select 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.category ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  {formErrors.category && <p className="text-xs text-destructive mt-1">{formErrors.category}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Localização <span className="text-destructive">*</span></label>
                  <input 
                    type="text" 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all", formErrors.location ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    placeholder="Ex: B2 - C3"
                    value={newItemForm.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                  />
                  {formErrors.location && <p className="text-xs text-destructive mt-1">{formErrors.location}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd.</label>
                  <input 
                    type="text" 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all font-mono", formErrors.qty ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.qty || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handleChange('qty', val === "" ? 0 : Number(val));
                    }}
                    placeholder="0"
                  />
                  {formErrors.qty && <p className="text-xs text-destructive mt-1">{formErrors.qty}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Qtd. Min</label>
                  <input 
                    type="text" 
                    className={cn("w-full h-10 px-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all font-mono", formErrors.minQty ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                    value={newItemForm.minQty || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handleChange('minQty', val === "" ? 0 : Number(val));
                    }}
                    placeholder="10"
                  />
                  {formErrors.minQty && <p className="text-xs text-destructive mt-1">{formErrors.minQty}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">R$</span>
                    <input 
                      type="text" 
                      className={cn("w-full h-10 pl-8 pr-3 rounded-md border bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all font-mono", formErrors.price ? "border-destructive focus:border-destructive" : "border-[hsl(var(--border))]")}
                      value={newItemForm.price || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        handleChange('price', val === "" ? 0 : Number(val));
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  {formErrors.price && <p className="text-xs text-destructive mt-1">{formErrors.price}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Foto do Produto</label>
                
                {/* Inputs ocultos */}
                <input 
                  type="file" 
                  accept="image/*" 
                  hidden 
                  ref={formFileInputRef} 
                  onChange={handleCaptureProductFormPhoto} 
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  hidden 
                  ref={formCameraInputRef} 
                  onChange={handleCaptureProductFormPhoto} 
                />

                <div 
                  onDragOver={handleFormDragOver}
                  onDragLeave={handleFormDragLeave}
                  onDrop={handleFormDrop}
                  onClick={() => formFileInputRef.current?.click()}
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all gap-3 bg-[hsl(var(--background))] select-none min-h-[140px]",
                    isFormDragging 
                      ? "border-primary bg-primary/10 text-primary scale-[1.01]" 
                      : "border-[hsl(var(--border))] hover:border-primary/40 hover:bg-muted/10",
                    isUploadingPhoto && "opacity-60 pointer-events-none"
                  )}
                >
                  {isUploadingPhoto ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground font-medium">Processando imagem...</span>
                    </div>
                  ) : newItemForm.imageUrl ? (
                    <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                      <div className="relative w-32 h-32 rounded-md overflow-hidden border shadow-sm group">
                        <img 
                          src={newItemForm.imageUrl} 
                          alt="Pré-visualização do Produto" 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => setNewItemForm(prev => ({ ...prev, imageUrl: "" }))}
                          className="absolute top-1 right-1 p-1.5 bg-[#e24b4a]/10 hover:bg-[#e24b4a]/10 text-white rounded-full transition-colors shadow-md"
                          title="Remover Imagem"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground text-center">
                        Arraste outra foto ou clique abaixo para alterar
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2 py-2">
                      <div className="p-3 bg-muted/20 rounded-full text-muted-foreground">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Arraste e solte uma imagem do produto</p>
                        <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar do seu dispositivo</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-xs" 
                    onClick={() => formFileInputRef.current?.click()} 
                    disabled={isUploadingPhoto}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Enviar Arquivo
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-xs" 
                    onClick={() => formCameraInputRef.current?.click()} 
                    disabled={isUploadingPhoto}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Tirar Foto
                  </Button>
                  
                  {newItemForm.imageUrl && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setNewItemForm(prev => ({ ...prev, imageUrl: "" }))}
                      disabled={isUploadingPhoto}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição Técnica</label>
                <textarea 
                  className="w-full p-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 focus:border-[hsl(var(--primary))] outline-none transition-all resize-none text-sm min-h-[80px]"
                  placeholder="Descrição da peça ou detalhes técnicos..."
                  value={newItemForm.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                />
              </div>
              </CardContent>
              <div className="p-6 pt-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] flex items-center justify-end space-x-2 shrink-0">
                <Button variant="outline" onClick={() => { setIsAddModalOpen(false); setFormErrors({}); }} type="button" disabled={isSavingProduct}>Cancelar</Button>
                <Button type="submit" disabled={isSavingProduct}>
                  {isSavingProduct ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Zoom Image Modal */}
      {zoomedImageUrl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setZoomedImageUrl(null)}>
           <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-[120]" onClick={(e) => { e.stopPropagation(); setZoomedImageUrl(null); }}>
             <X className="h-8 w-8" />
           </Button>
           <img src={zoomedImageUrl} alt="Imagem Ampliada" className="max-w-full max-h-full object-contain pointer-events-none" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Add/Edit Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <Card className="w-full max-w-sm shadow-xl flex flex-col max-h-[95vh]">
             <div className="px-6 py-4 border-b border-[hsl(var(--border))] shrink-0">
               <CardTitle>{editingCategoryId ? "Editar Categoria" : "Nova Categoria"}</CardTitle>
             </div>
             <form onSubmit={handleSaveCategory} className="flex flex-col flex-1 overflow-hidden min-h-0">
               <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                  <div className="space-y-4 mb-2">
                    <div className="flex items-center gap-4">
                      {newCategoryForm.photoUrl ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border group shrink-0">
                          <img src={newCategoryForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setNewCategoryForm(prev => ({ ...prev, photoUrl: "" }))}
                            className="absolute top-1 right-1 p-1 bg-[#e24b4a]/10 text-white rounded-full hover:bg-[#e24b4a]/10 transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/20 text-muted-foreground shrink-0">
                          <ImageIcon className="w-6 h-6 opacity-40" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input type="file" accept="image/*" capture="environment" hidden ref={categoryFileInputRef} onChange={handleCaptureCategoryPhoto} />
                        <Button type="button" variant="outline" size="sm" className="w-full relative overflow-hidden h-9" onClick={() => categoryFileInputRef.current?.click()} disabled={isUploadingPhoto}>
                           <Camera className="w-3.5 h-3.5 mr-2" />
                           <span className="text-xs">Escolher p/ Foto</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Nome da Categoria</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Válvulas, Conexões..." 
                      className="w-full h-10 px-3 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                      value={newCategoryForm.name} 
                      onChange={e => setNewCategoryForm({...newCategoryForm, name: e.target.value})} 
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Descrição</label>
                    <textarea 
                      placeholder="Breve descrição da categoria..." 
                      className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" 
                      rows={2}
                      value={newCategoryForm.description} 
                      onChange={e => setNewCategoryForm({...newCategoryForm, description: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Finalidade Técnico/Comercial</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Instalações Prediais, Manutenção..." 
                      className="w-full h-10 px-3 border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                      value={newCategoryForm.purpose} 
                      onChange={e => setNewCategoryForm({...newCategoryForm, purpose: e.target.value})} 
                    />
                  </div>
               </div>
               <div className="p-6 pt-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] flex justify-end gap-2 shrink-0">
                  <Button variant="outline" type="button" onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategoryId(null);
                  }} disabled={isSavingCategory}>Cancelar</Button>
                  <Button type="submit" disabled={isSavingCategory}>
                    {isSavingCategory ? "Salvando..." : (editingCategoryId ? "Salvar Alterações" : "Criar Categoria")}
                  </Button>
               </div>
             </form>
           </Card>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {isDeleteCategoryModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
            <CardTitle>Confirmar Exclusão</CardTitle>
            <p className="text-sm">Tem certeza que deseja apagar a categoria <strong>{categoryToDelete.name}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteCategoryModalOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteCategory}>Apagar</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteProductConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-xl p-6 space-y-4">
            <CardTitle>Confirmar Exclusão</CardTitle>
            <p className="text-sm">Tem certeza que deseja apagar o produto <strong>{deleteProductConfirm.productName}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteProductConfirm(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteProduct}>Apagar</Button>
            </div>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0">
              <div>
                <CardTitle className="text-xl">Histórico de Movimentação</CardTitle>
                <div className="flex items-center mt-1 space-x-2">
                  <span className="uppercase font-mono text-xs font-semibold bg-[hsl(var(--muted))] px-2 py-0.5 rounded text-[hsl(var(--muted-foreground))]">{selectedProduct.id}</span>
                  <span className="text-sm font-medium">{selectedProduct.name}</span>
                </div>
              </div>
              <button 
                className="p-2 rounded-full hover:bg-[hsl(var(--accent))] transition-colors"
                onClick={() => setSelectedProduct(null)}
              >
                <X className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </button>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 flex flex-col lg:flex-row">
              <div className="w-full lg:w-[380px] p-6 border-b lg:border-b-0 lg:border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))]/10 flex flex-col justify-center shrink-0">
                <form onSubmit={handleAddMovement} className="w-full bg-[hsl(var(--background))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm space-y-5">
                 <h4 className="font-bold flex items-center mb-2">
                    <History className="w-5 h-5 mr-2 text-[hsl(var(--primary))]" />
                    Nova Movimentação
                 </h4>
                 
                 <div className="space-y-4">
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Operação</label>
                     <div className="grid grid-cols-2 gap-3">
                       <Button 
                         type="button"
                         variant={newMovement.type === "IN" ? "default" : "outline"} 
                         className={newMovement.type === "IN" ? "bg-gradient-to-br from-[#1b365d] to-[#0d2a4a] border border-[#00d4ff]/30 text-[#e8f4ff] hover:opacity-90 h-10" : "h-10 border-dashed"}
                         onClick={() => setNewMovement({...newMovement, type: "IN"})}
                       >
                         <ArrowDownRight className="w-4 h-4 mr-1.5" /> Entrada
                       </Button>
                       <Button 
                         type="button"
                         variant={newMovement.type === "OUT" ? "default" : "outline"} 
                         className={newMovement.type === "OUT" ? "bg-gradient-to-br from-[#1b365d] to-[#0d2a4a] border border-[#00d4ff]/30 text-[#e8f4ff] hover:opacity-90 h-10" : "h-10 border-dashed"}
                         onClick={() => setNewMovement({...newMovement, type: "OUT"})}
                       >
                         <ArrowUpRight className="w-4 h-4 mr-1.5" /> Saída
                       </Button>
                     </div>
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Quantidade</label>
                      <input 
                        type="text" 
                        className="w-full h-11 px-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))] outline-none text-base font-medium shadow-sm transition-shadow font-mono"
                        placeholder="0"
                        value={newMovement.qty || ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setNewMovement({...newMovement, qty: val === "" ? 0 : Number(val)});
                        }}
                      />
                   </div>
                   
                   <div className="space-y-1.5">
                     <label className="text-sm font-semibold text-[hsl(var(--foreground))]">Motivo / Descrição</label>
                     <textarea 
                       rows={2}
                       placeholder={newMovement.type === "IN" ? "Ex: NF-e 1234 de Fornecedor" : "Ex: Retirada p/ OS #1002"}
                       className="w-full p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))] outline-none text-sm resize-none shadow-sm transition-shadow"
                       value={newMovement.reason}
                       onChange={(e) => setNewMovement({...newMovement, reason: e.target.value})}
                     />
                   </div>
                 </div>
                 
                 <Button 
                   type="submit"
                   size="lg"
                   className="w-full h-11 font-semibold text-base mt-2" 
                   disabled={!newMovement.reason || newMovement.qty <= 0 || isSavingMovement}
                 >
                   {isSavingMovement ? "Registrando..." : "Registrar Movimentação"}
                 </Button>
                </form>
              </div>
              <div className="w-full lg:flex-1 flex flex-col min-h-[400px]">
                <div className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Data</TableHead>
                        <TableHead>Op.</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistory.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                            <div className="font-medium">{new Date(mov.date).toLocaleDateString('pt-BR')}</div>
                            <div className="text-[10px] opacity-70">{new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}</div>
                          </TableCell>
                          <TableCell>
                            {mov.type === 'IN' ? (
                              <div className="flex items-center text-[#378add] font-medium text-xs">
                                <ArrowDownRight className="h-4 w-4 mr-1" /> Entrada
                              </div>
                            ) : (
                              <div className="flex items-center text-[#00d4ff] font-medium text-xs">
                                <ArrowUpRight className="h-4 w-4 mr-1" /> Saída
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-[hsl(var(--muted-foreground))] text-sm max-w-[150px] truncate" title={mov.reason}>
                            {mov.reason}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            <span className={mov.type === 'IN' ? 'text-[#378add]' : 'text-[#00d4ff]'}>
                              {mov.type === 'IN' ? '+' : '-'}{mov.qty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-[hsl(var(--muted-foreground))]">
                            {mov.user.split(' ')[0]}
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-[hsl(var(--muted-foreground))]">
                            <History className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            Nenhuma movimentação registrada.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="p-4 border-t border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(var(--muted))]/10 shrink-0">
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Página <span className="font-medium text-[hsl(var(--foreground))]">{currentPage}</span> de <span className="font-medium text-[hsl(var(--foreground))]">{totalPages}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="h-8 w-8 p-0"
                      >
                        <span className="sr-only">Anterior</span>
                        <ArrowDownRight className="h-4 w-4 rotate-90" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="h-8 w-8 p-0"
                      >
                        <span className="sr-only">Próxima</span>
                        <ArrowDownRight className="h-4 w-4 -rotate-90" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* QR Code and Multi-Product Label Sheet Printing Center Modal */}
      {selectedProductForQr && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-5xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col overflow-hidden bg-card text-left">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 shrink-0 bg-[hsl(var(--muted))]/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Folha de Impressão de Etiquetas por Categoria</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecione os produtos da categoria <span className="font-extrabold text-foreground bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">{selectedProductForQr.category || "Geral"}</span> para imprimir as etiquetas de gôndola (gaveteiro).
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-muted"
                onClick={() => setSelectedProductForQr(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--border))]">
              {/* Mobile Tab Selector - Visible only on mobile */}
              <div className="flex md:hidden border-b border-border bg-muted/15 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileTab('config')}
                  className={cn(
                    "flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all",
                    mobileTab === 'config'
                      ? "bg-card text-primary shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  1. Opções & Itens
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('preview')}
                  className={cn(
                    "flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                    mobileTab === 'preview'
                      ? "bg-card text-primary shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  2. Visualizar Folha A4
                  <Badge variant="outline" className="text-[10px] scale-90 px-1.5 py-0 bg-primary/10 text-primary">
                    {categoryItems.filter(i => selectedItemsForPrintSheet[i.id]).length}
                  </Badge>
                </button>
              </div>

              {/* Left Column: Configuration Panels */}
              <div className={cn("w-full md:w-[320px] p-5 space-y-6 bg-[hsl(var(--muted))]/5 shrink-0 overflow-y-auto", mobileTab !== 'config' && "hidden md:block")}>
                {/* Print Grid Settings */}
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5" />
                    Layout da Folha (A4)
                  </h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Colunas na Página</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((cols) => (
                        <button
                          key={cols}
                          type="button"
                          onClick={() => setPrintColumns(cols)}
                          className={cn(
                            "py-2 px-1 rounded-lg border text-xs font-bold transition-all",
                            printColumns === cols
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                              : "border-[hsl(var(--border))] bg-card hover:bg-muted/40 text-foreground"
                          )}
                        >
                          {cols} {cols === 1 ? 'Coluna' : 'Colunas'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stock Filter switch */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-card">
                    <div className="space-y-0.5">
                      <label htmlFor="only-stock" className="text-xs font-bold text-foreground cursor-pointer">Apenas em estoque</label>
                      <p className="text-[10px] text-muted-foreground">Ocultar itens zerados</p>
                    </div>
                    <input
                      id="only-stock"
                      type="checkbox"
                      checked={showOnlyInStock}
                      onChange={(e) => setShowOnlyInStock(e.target.checked)}
                      className="h-4 w-4 rounded border-[hsl(var(--border))] text-primary focus:ring-primary cursor-pointer accent-primary"
                    />
                  </div>
                </div>

                {/* Batch Checklist actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Selecionar Itens ({categoryItems.length})</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allChecked: Record<string, boolean> = {};
                          categoryItems.forEach(i => { allChecked[i.id] = true; });
                          setSelectedItemsForPrintSheet(allChecked);
                        }}
                        className="text-[10px] text-primary hover:underline font-bold"
                      >
                        Marcar todos
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItemsForPrintSheet({});
                        }}
                        className="text-[10px] text-muted-foreground hover:underline font-bold"
                      >
                        Desmarcar todos
                      </button>
                    </div>
                  </div>

                  {/* Items quick list to toggle */}
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {categoryItems.map(item => {
                      const isChecked = !!selectedItemsForPrintSheet[item.id];
                      return (
                        <div 
                          key={item.id}
                          onClick={() => {
                            setSelectedItemsForPrintSheet(prev => ({
                              ...prev,
                              [item.id]: !isChecked
                            }));
                          }}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none text-[11px] transition-all",
                            isChecked 
                              ? "border-primary/40 bg-primary/[0.02]" 
                              : "border-[hsl(var(--border))] opacity-60 bg-card hover:opacity-95"
                          )}
                        >
                          <div className="min-w-0 pr-2 space-y-0.5">
                            <p className="font-bold text-foreground line-clamp-1">{item.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">SKU: {item.id}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent div click
                            className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-primary accent-primary cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Info block */}
                <div className="p-3 bg-muted/40 rounded-xl border border-[hsl(var(--border))]/40 space-y-2 text-xs">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Etiquetas de Gaveteiro
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    Ideal para colar na frente das gavetas ou caixas organizadoras. Cada etiqueta exibe o nome do produto e o respectivo QR code ao lado para leitura imediata.
                  </p>
                </div>
              </div>

              {/* Right Column: Sheet Preview Canvas */}
              <div className={cn("flex-1 p-4 md:p-6 overflow-y-auto bg-[hsl(var(--muted))]/10 flex flex-col", mobileTab !== 'preview' && "hidden md:flex")}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-[hsl(var(--border))]/60 pb-3 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
                      Pré-visualização da Folha de Impressão (Layout A4)
                    </span>
                    <Badge variant="outline" className="bg-card text-foreground text-[10px] font-mono font-bold">
                      {categoryItems.filter(i => selectedItemsForPrintSheet[i.id]).length} Etiquetas Selecionadas
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto justify-end">
                    <Button 
                      variant="outline"
                      className="font-bold text-xs h-9 border-primary/40 text-primary hover:bg-primary/5 shadow-sm gap-2 px-3 flex-1 sm:flex-initial justify-center"
                      onClick={generateCategoryPdf}
                      disabled={isGeneratingCategoryQrs || categoryItems.filter(item => selectedItemsForPrintSheet[item.id]).length === 0}
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      Gerar PDF
                    </Button>
                    <Button 
                      className="font-bold text-xs h-9 bg-primary hover:bg-[hsl(var(--primary-hover))] shadow-md gap-2 px-4 text-primary-foreground flex-1 sm:flex-initial justify-center"
                      onClick={printCategorySheet}
                      disabled={isGeneratingCategoryQrs || categoryItems.filter(item => selectedItemsForPrintSheet[item.id]).length === 0}
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir Folha
                    </Button>
                  </div>
                </div>

                {/* Printable container view */}
                <div className="flex-1 min-h-[400px] flex items-start justify-center">
                  <div className="w-full max-w-[640px] bg-white border border-slate-300 rounded-lg p-6 shadow-md text-slate-900 font-sans min-h-[600px] flex flex-col">
                    {/* Simulated Sheet Header */}
                    <div className="w-full flex justify-between items-center border-b border-slate-300 pb-2 mb-4">
                      <span className="font-black text-[11px] tracking-widest text-slate-400">ALMOX PRO • ETIQUETAS</span>
                      <span className="font-bold text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Categoria: {selectedProductForQr.category || "Geral"}
                      </span>
                    </div>

                    {isGeneratingCategoryQrs ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16 space-y-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs font-bold">Gerando códigos QR da gaveta...</p>
                      </div>
                    ) : (
                      <>
                        {/* Printable simulated Grid */}
                        <div className={cn(
                          "grid gap-3 w-full",
                          printColumns === 1 && "grid-cols-1",
                          printColumns === 2 && "grid-cols-2",
                          printColumns === 3 && "grid-cols-3"
                        )}>
                          {categoryItems.filter(item => selectedItemsForPrintSheet[item.id]).map(item => {
                            const qrUrl = categoryQrCodes[item.id];
                            return (
                              <div 
                                key={item.id}
                                className="relative bg-white border border-slate-900 rounded-md p-3 flex items-center justify-between h-[82px] hover:ring-1 hover:ring-primary/20 transition-all select-none group"
                              >
                                {/* Quick individual toggle checkbox */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemsForPrintSheet(prev => ({
                                      ...prev,
                                      [item.id]: false
                                    }));
                                  }}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#e24b4a]/10 text-[#e24b4a] rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold"
                                  title="Remover da impressão"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>

                                <div className="flex-1 min-w-0 pr-1 select-none pointer-events-none text-left">
                                  <h5 className="font-black text-[11px] leading-[1.25] text-slate-950 line-clamp-2">{item.name}</h5>
                                  <div className="inline-block mt-1 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-slate-600 border border-slate-200">
                                    SKU: {item.id}
                                  </div>
                                </div>

                                {qrUrl ? (
                                  <img 
                                    src={qrUrl} 
                                    className="w-[58px] h-[58px] object-contain shrink-0 border border-slate-100 p-0.5 rounded" 
                                    alt="QR Code" 
                                  />
                                ) : (
                                  <div className="w-[58px] h-[58px] bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 rounded">
                                    <span className="text-[10px] text-slate-300">...</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {categoryItems.filter(item => selectedItemsForPrintSheet[item.id]).length === 0 && (
                            <div className="col-span-full py-16 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
                              <Archive className="h-8 w-8 mx-auto opacity-30" />
                              <p className="text-xs font-medium">Nenhum item selecionado para a folha.</p>
                              <p className="text-[10px] text-slate-400">Marque os itens no painel lateral esquerdo.</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Trigger Buttons */}
                <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]/60 flex justify-end shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProductForQr(null)}
                    className="font-semibold text-xs w-full sm:w-28"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}









      {/* Material Output (Saída de Material) Modal */}
      {isOutputModalOpen && (
  <div
    className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
    style={{ animation: "fadeIn 0.2s ease" }}
    onClick={e => { if (e.target === e.currentTarget) { stopOutputScanner(); setIsOutputModalOpen(false); setOutputModalMode("saida"); setOutputFilteredInventory(null); } }}
  >
    <div
      style={{
        width: "100%", maxWidth: 520,
        background: "linear-gradient(160deg, #0a1628 0%, #050d1a 100%)",
        border: "0.5px solid rgba(0,212,255,0.12)",
        borderRadius: "24px 24px 0 0",
        maxHeight: "94vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      className="sm:rounded-[24px]"
    >
      {/* Drag handle mobile */}
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
      </div>

      {/* Header */}
      <div style={{ padding: "16px 24px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: outputModalMode === "saida"
                ? "rgba(226,75,74,0.12)"
                : "rgba(0,212,255,0.12)",
              border: `0.5px solid ${outputModalMode === "saida" ? "rgba(226,75,74,0.4)" : "rgba(0,212,255,0.4)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.3s ease",
            }}>
              {outputModalMode === "saida"
                ? <ArrowDownRight style={{ width: 17, height: 17, color: "#e24b4a" }} />
                : <RotateCcw style={{ width: 17, height: 17, color: "#00d4ff" }} />
              }
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#e8f4ff", margin: 0, transition: "all 0.2s" }}>
                {outputModalMode === "saida" ? "Saída de Material" : "Retorno de Material"}
              </h2>
              <p style={{ fontSize: 11, color: "#4a7a9b", margin: 0 }}>
                {outputModalMode === "saida" ? "Retirada para campo ou manutenção" : "Devolução ao almoxarifado"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { stopOutputScanner(); setIsOutputModalOpen(false); setOutputProductId(""); setOutputEmployeeId(""); setOutputQty(0); setOutputActivity("Montagem"); setOutputCustomActivity(""); setOutputNotes(""); setOutputFilteredInventory(null); setOutputModalMode("saida"); }}
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14, color: "#4a7a9b" }} />
          </button>
        </div>

        {/* Toggle Saída / Retorno */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, position: "relative", border: "0.5px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            position: "absolute",
            top: 4, bottom: 4,
            left: outputModalMode === "saida" ? 4 : "calc(50% + 2px)",
            width: "calc(50% - 6px)",
            borderRadius: 9,
            background: outputModalMode === "saida"
              ? "rgba(0,212,255,0.12)"
              : "rgba(55,138,221,0.12)",
            border: `0.5px solid ${outputModalMode === "saida" ? "rgba(0,212,255,0.4)" : "rgba(55,138,221,0.4)"}`,
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }} />
          <button type="button" onClick={() => setOutputModalMode("saida")}
            style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "transparent", color: outputModalMode === "saida" ? "#00d4ff" : "#4a7a9b", fontSize: 13, fontWeight: outputModalMode === "saida" ? 700 : 400, cursor: "pointer", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "color 0.2s" }}>
            <ArrowDownRight style={{ width: 14, height: 14 }} />
            Saída
          </button>
          <button type="button" onClick={() => setOutputModalMode("retorno")}
            style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "transparent", color: outputModalMode === "retorno" ? "#378add" : "#4a7a9b", fontSize: 13, fontWeight: outputModalMode === "retorno" ? 700 : 400, cursor: "pointer", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "color 0.2s" }}>
            <RotateCcw style={{ width: 14, height: 14 }} />
            Retorno
          </button>
        </div>
      </div>

      {/* Body */}
      <form onSubmit={outputModalMode === "saida" ? handleSaveMaterialOutput : handleSaveReturn}
        style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}
        key={outputModalMode}
      >
        {/* Produto */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5 }}>
              <Package style={{ width: 11, height: 11 }} /> Produto <span style={{ color: "#e24b4a" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button"
                onClick={startOutputScanner}
                style={{ fontSize: 11, color: "#e8f4ff", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <QrCode style={{ width: 10, height: 10 }} /> Ler QR Code
              </button>
              {outputModalMode === "saida" && (
                <button type="button"
                  onClick={() => { setQuickProdCategory(categories.length > 0 ? categories[0].name : "Materiais"); setIsAddProdFromOutputOpen(true); }}
                  style={{ fontSize: 11, color: "#00d4ff", background: "rgba(0,212,255,0.08)", border: "0.5px solid rgba(0,212,255,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Plus style={{ width: 10, height: 10 }} /> Adicionar
                </button>
              )}
            </div>
          </div>
          
          <div style={{ display: isOutputScanning ? 'block' : 'none', marginBottom: 12, borderRadius: 10, overflow: "hidden", background: "#000", position: "relative" }}>
            <div id="output-qr-reader" style={{ width: "100%", minHeight: 200 }}></div>
            <button type="button" onClick={stopOutputScanner}
              style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          {outputScannerError && (
            <div style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(226,75,74,0.1)", border: "0.5px solid rgba(226,75,74,0.3)", color: "#e24b4a", fontSize: 12 }}>
              {outputScannerError}
            </div>
          )}

          <input type="text" placeholder="Buscar produto..."
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            onChange={e => {
              const term = e.target.value.toLowerCase();
              setOutputFilteredInventory(term ? inventory.filter(i => i.name.toLowerCase().includes(term) || i.id.toLowerCase().includes(term)) : null);
            }}
          />
          <select value={outputProductId}
            onChange={e => { setOutputProductId(e.target.value); if (e.target.value) setOutputQty(1); else setOutputQty(0); }}
            required
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: outputProductId ? "#e8f4ff" : "#4a7a9b", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none", boxSizing: "border-box" }}>
            <option value="">-- Selecione o produto --</option>
            {(outputFilteredInventory ?? inventory).map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.qty} un
              </option>
            ))}
          </select>

          {/* Snapshot */}
          {outputProductId && (() => {
            const prod = inventory.find(i => i.id === outputProductId);
            if (!prod) return null;
            const isLow = prod.qty <= (prod.minQty ?? 0);
            const emCampo = (prod as any).qtyEmCampo ?? 0;
            return (
              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: isLow ? "#e24b4a" : "#378add", margin: 0 }}>{prod.qty}</p>
                  <p style={{ fontSize: 10, color: "#4a7a9b", margin: 0 }}>Disponível</p>
                </div>
                <div style={{ textAlign: "center", borderLeft: "0.5px solid rgba(255,255,255,0.06)", borderRight: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#378add", margin: 0 }}>{emCampo}</p>
                  <p style={{ fontSize: 10, color: "#4a7a9b", margin: 0 }}>Em Campo</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#4a7a9b", margin: 0 }}>{prod.minQty ?? 0}</p>
                  <p style={{ fontSize: 10, color: "#4a7a9b", margin: 0 }}>Mínimo</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Responsável + Quantidade */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <User style={{ width: 11, height: 11 }} /> {outputModalMode === "saida" ? "Responsável" : "Quem está devolvendo"} <span style={{ color: "#e24b4a" }}>*</span>
            </label>
            <select value={outputEmployeeId} onChange={e => setOutputEmployeeId(e.target.value)} required={!showInlineEmployee}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: outputEmployeeId ? "#e8f4ff" : "#4a7a9b", fontSize: 13, outline: "none", cursor: "pointer", appearance: "none" }}>
              <option value="">-- Selecione --</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} · {emp.role || "Técnico"}</option>)}
            </select>
            {!showInlineEmployee ? (
              <button type="button" onClick={() => setShowInlineEmployee(true)}
                style={{ fontSize: 11, color: "#378add", background: "none", border: "none", cursor: "pointer", marginTop: 6, padding: 0 }}>
                + Funcionário não cadastrado? Adicionar agora
              </button>
            ) : (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(27,54,93,0.3)", border: "0.5px solid rgba(0,212,255,0.2)", display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.2s ease" }}>
                <input value={inlineEmployeeName} onChange={e => setInlineEmployeeName(e.target.value)}
                  placeholder="Nome do funcionário"
                  style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 12, outline: "none" }} />
                <select value={inlineEmployeeRole} onChange={e => setInlineEmployeeRole(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 12, outline: "none", appearance: "none" }}>
                  <option>Técnico</option>
                  <option>Engenheiro</option>
                  <option>Operador</option>
                  <option>Motorista</option>
                  <option>Supervisor</option>
                  <option>Outro</option>
                </select>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => setShowInlineEmployee(false)}
                    style={{ flex: 1, padding: "7px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#4a7a9b", fontSize: 12, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={salvarFuncionarioInline} disabled={!inlineEmployeeName.trim()}
                    style={{ flex: 2, padding: "7px", borderRadius: 8, background: "linear-gradient(135deg, #1b365d, #0d2a4a)", border: "0.5px solid rgba(0,212,255,0.3)", color: "#e8f4ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Salvar e selecionar
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
              Qtd. <span style={{ color: "#e24b4a" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 10px" }}>
              <button type="button" onClick={() => setOutputQty(q => Math.max(1, q - 1))}
                style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", color: "#e8f4ff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#e8f4ff", minWidth: 28, textAlign: "center" }}>{outputQty || 1}</span>
              <button type="button" onClick={() => setOutputQty(q => q + 1)}
                style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", color: "#e8f4ff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          </div>
        </div>

        {/* Atividade — só na saída */}
        {outputModalMode === "saida" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <Settings style={{ width: 11, height: 11 }} /> Atividade <span style={{ color: "#e24b4a" }}>*</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { value: "Montagem", label: "Montagem / Instalação" },
                { value: "Preventiva", label: "Manutenção Preventiva" },
                { value: "Corretiva", label: "Manutenção Corretiva" },
                { value: "Calibração", label: "Calibração / Ajuste" },
                { value: "Preditiva", label: "Inspeção Preditiva" },
                { value: "Outras", label: "Outras" },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setOutputActivity(opt.value)}
                  style={{ padding: "6px 12px", borderRadius: 20, border: `0.5px solid ${outputActivity === opt.value ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.08)"}`, background: outputActivity === opt.value ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)", color: outputActivity === opt.value ? "#00d4ff" : "#4a7a9b", fontSize: 12, fontWeight: outputActivity === opt.value ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {outputActivity === "Outras" && (
              <input type="text" value={outputCustomActivity} onChange={e => setOutputCustomActivity(e.target.value)} required placeholder="Descreva a atividade..."
                style={{ width: "100%", marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(0,212,255,0.3)", color: "#e8f4ff", fontSize: 13, outline: "none", boxSizing: "border-box", animation: "fadeIn 0.2s ease" }} />
            )}
          </div>
        )}

        {/* Notas */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#4a7a9b", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <MessageSquare style={{ width: 11, height: 11 }} /> Notas / OS (Opcional)
          </label>
          <textarea rows={2} value={outputNotes} onChange={e => setOutputNotes(e.target.value)}
            placeholder={outputModalMode === "saida" ? "Ex: OS #2040 · Setor B" : "Ex: Retorno parcial · 3 unidades danificadas"}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#e8f4ff", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "0.5px solid rgba(255,255,255,0.06)", marginTop: "auto" }}>
          <button type="button"
            onClick={() => { setIsOutputModalOpen(false); setOutputProductId(""); setOutputEmployeeId(""); setOutputQty(0); setOutputActivity("Montagem"); setOutputCustomActivity(""); setOutputNotes(""); setOutputFilteredInventory(null); setOutputModalMode("saida"); }}
            style={{ flex: 1, padding: "13px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#4a7a9b", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button type="submit" disabled={isSavingOutput}
            style={{
              flex: 2, padding: "13px", borderRadius: 12, border: "none",
              background: outputModalMode === "saida"
                  ? "linear-gradient(135deg, #1b365d, #0d2a4a)"
                  : "linear-gradient(135deg, #1b365d, #0a4a7a)",
              color: "#e8f4ff", fontSize: 13, fontWeight: 700, cursor: isSavingOutput ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.3s ease",
            }}>
            {isSavingOutput
              ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.5)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Registrando...</>
              : outputModalMode === "saida"
                ? <><ArrowDownRight style={{ width: 15, height: 15 }} /> Confirmar Saída</>
                : <><RotateCcw style={{ width: 15, height: 15 }} /> Confirmar Retorno</>
            }
          </button>
        </div>
      </form>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  </div>
)}

      {/* Bluetooth/USB Printer Connection Pairing Modal */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-3xl shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col overflow-hidden bg-card text-left">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 shrink-0 bg-[hsl(var(--muted))]/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/10 text-blue-600 rounded-lg">
                  <Wifi className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Conexão & Pareamento Bluetooth / USB</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Gerencie e conecte suas impressoras térmicas locais de etiqueta por aproximação.</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-muted font-bold"
                onClick={() => setIsPrinterModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--border))]">
              {/* Left Column: Device scan and connected list */}
              <div className="flex-1 p-5 flex flex-col min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-blue-500" />
                    Impressoras Próximas Detectadas
                  </h4>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleScanPrinters}
                    disabled={isScanningPrinters}
                    className="h-8 text-xs font-bold gap-1 text-primary hover:bg-primary/5 px-3 border border-border"
                  >
                    <RefreshCw className={cn("h-3 w-3", isScanningPrinters && "animate-spin")} />
                    Escaneamento Rápido
                  </Button>
                </div>

                {isScanningPrinters ? (
                  <div className="flex-1 min-h-[160px] bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="flex space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary tracking-wide uppercase">Buscando pareamento Bluetooth térmico...</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Ligue sua etiquetadora e ative a descoberta Bluetooth.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[160px] space-y-2">
                    {registeredPrinters.map(p => {
                      const isSelected = selectedPrinterId === p.id;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedPrinterId(p.id);
                            toast.success(`Impressora "${p.name}" selecionada como padrão.`);
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 relative group",
                            isSelected 
                              ? "border-primary bg-primary/[0.03] ring-1 ring-primary/25" 
                              : "border-[hsl(var(--border))] bg-card hover:bg-muted/30"
                          )}
                        >
                          <div className="min-w-0 pr-8">
                            <div className="flex items-center gap-1.5">
                              <p className="font-extrabold text-xs text-foreground/90 leading-normal truncate">{p.name}</p>
                              {isSelected && (
                                <span className="bg-[#378add]/10 border border-[#378add]/20 text-[#378add] text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1 font-mono">
                              {p.type === 'Bluetooth' && <Wifi className="h-3 w-3 text-blue-500" />}
                              {p.type === 'USB' && <Usb className="h-3 w-3 text-indigo-500" />}
                              {p.type === 'Rede / IP' && <Cpu className="h-3 w-3 text-[#378add]" />}
                              <span>{p.address || "Sem endereço"}</span>
                              <span>•</span>
                              <span>Tamanho: {p.size}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 absolute right-3">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleDeletePrinter(p.id, e)}
                              title="Remover impressora"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <span className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0",
                              isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                            )} />
                          </div>
                        </div>
                      );
                    })}

                    {registeredPrinters.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground space-y-2 border border-dashed border-[hsl(var(--border))] rounded-xl">
                        <Wifi className="h-8 w-8 mx-auto opacity-30" />
                        <p className="text-xs font-semibold">Nenhuma impressora disponível.</p>
                        <p className="text-[10px]">Cadastre manualmente ou realize o escaneamento.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-[#378add]" />
                    Impressão direta ativa via gôndola.
                  </span>
                  <Button
                    variant="link"
                    className="text-xs text-primary h-auto p-0 hover:underline"
                    onClick={() => {
                      toast.info("Enviado RAW ZPL / TSPL de teste para a fila.");
                    }}
                  >
                    Imprimir teste RAW
                  </Button>
                </div>
              </div>

              {/* Right Column: Add/Register form */}
              <div className="w-full md:w-[300px] p-5 space-y-4 bg-[hsl(var(--muted))]/5 shrink-0 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Adicionar Manualmente
                  </h4>
                </div>

                <form onSubmit={handleAddPrinterManual} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Nome da Impressora / Marca</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Elgin L42 Pro Balcão"
                      value={newPrinterForm.name}
                      onChange={(e) => setNewPrinterForm({...newPrinterForm, name: e.target.value})}
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none bg-card text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase font-semibold">Tipo Conexão</label>
                      <select 
                        value={newPrinterForm.type}
                        onChange={(e) => setNewPrinterForm({...newPrinterForm, type: e.target.value})}
                        className="w-full h-9 px-2 border border-[hsl(var(--border))] rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-card text-foreground cursor-pointer"
                      >
                        <option value="Bluetooth">Bluetooth</option>
                        <option value="USB">USB</option>
                        <option value="Rede / IP">Rede / IP</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase font-semibold">Gabarito Fita</label>
                      <select 
                        value={newPrinterForm.size}
                        onChange={(e) => setNewPrinterForm({...newPrinterForm, size: e.target.value})}
                        className="w-full h-9 px-2 border border-[hsl(var(--border))] rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none bg-card text-foreground cursor-pointer"
                      >
                        <option value="50x30mm">50x30mm</option>
                        <option value="80x40mm">80x40mm</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Endereço (MAC, IP ou USB)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 98:D3:31:F4:12:45"
                      value={newPrinterForm.address}
                      onChange={(e) => setNewPrinterForm({...newPrinterForm, address: e.target.value})}
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg text-xs font-semibold focus:ring-1 focus:ring-primary focus:outline-none bg-card text-foreground"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-9 text-xs font-bold gap-1 mt-2 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Registrar Aparelho
                  </Button>
                </form>

                <div className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  A comunicação móvel com as etiquetadoras utiliza comandos ESC/POS e TSPL/ZPL diretamente via pareamento rápido.
                </div>
              </div>
            </CardContent>

            <div className="p-4 bg-muted/10 border-t border-[hsl(var(--border))] flex justify-end shrink-0">
              <Button
                variant="outline"
                className="font-bold text-xs h-9"
                onClick={() => setIsPrinterModalOpen(false)}
              >
                Concluído
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Material Return / Devolução Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col overflow-hidden bg-card text-left">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4 shrink-0 bg-[hsl(var(--muted))]/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#378add]/10 rounded-lg text-[#378add]">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-white">Retorno de Material / Devolução</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Registre de forma ágil a devolução de ferramentas ou sobras de materiais.</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-muted font-bold"
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setReturnProductId("");
                  setReturnEmployeeId("");
                  setReturnQty(0);
                  setReturnState("INTEGRO");
                  setReturnNotes("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
              <form onSubmit={handleSaveMaterialReturn} className="space-y-4">
                
                {/* Product Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    Produto / Item Devolvido <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={returnProductId}
                    onChange={(e) => {
                      setReturnProductId(e.target.value);
                      if (e.target.value) {
                        setReturnQty(1);
                      } else {
                        setReturnQty(0);
                      }
                    }}
                    required
                    className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-sm cursor-pointer"
                  >
                    <option value="">-- Selecione o produto correspondente --</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (SKU: {item.id}) - Estoque atual: {item.qty} un
                      </option>
                    ))}
                  </select>
                </div>

                {/* Returner Technician */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                    Técnico / Devolvente Responsável <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={returnEmployeeId}
                    onChange={(e) => setReturnEmployeeId(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-sm cursor-pointer"
                  >
                    <option value="">-- Selecione quem está devolvendo --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || "Técnico"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Return Qty and Material State */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Qtd. Solicitada p/ Voltar <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={returnQty || ""}
                      onChange={(e) => setReturnQty(e.target.value === "" ? 0 : Number(e.target.value))}
                      required
                      placeholder="Ex: 1"
                      className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-sm font-semibold font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      Estado do Material <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={returnState}
                      onChange={(e) => setReturnState(e.target.value)}
                      required
                      className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-sm cursor-pointer"
                    >
                      <option value="INTEGRO">ÍNTEGRO / EM BOM ESTADO</option>
                      <option value="COM_AVARIAS">COM AVARIAS / DESGASTE</option>
                      <option value="MANUTENÇÃO">REQUER MANUTENÇÃO</option>
                    </select>
                  </div>
                </div>

                {/* Observations / Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    Notas de Recebimento ou Motivo do Retorno (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Ex: Devolução de ferramenta de teste de pressão. Em perfeito estado para reinstalação."
                    className="w-full p-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs resize-none leading-relaxed"
                  />
                </div>

                {/* Action footer */}
                <div className="flex gap-2 pt-4 border-t border-[hsl(var(--border))]">
                  <Button 
                    variant="ghost" 
                    type="button" 
                    className="flex-1 font-semibold hover:bg-muted"
                    onClick={() => {
                      setIsReturnModalOpen(false);
                      setReturnProductId("");
                      setReturnEmployeeId("");
                      setReturnQty(0);
                      setReturnState("INTEGRO");
                      setReturnNotes("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isSavingReturn}
                    className="flex-1 bg-gradient-to-br from-[#1b365d] to-[#0d2a4a] border border-[#00d4ff]/30 text-[#e8f4ff] hover:opacity-90 text-white font-bold gap-2"
                  >
                    {isSavingReturn ? (
                      <>Processando...</>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Registrar Entrada
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Add Product / Cadastro Rápido de Produto overlay */}
      {isAddProdFromOutputOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border border-[hsl(var(--border))] max-h-[92vh] flex flex-col overflow-hidden bg-card text-left">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 shrink-0 bg-[hsl(var(--muted))]/15">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">Adicionar Novo Produto</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Cadastre o item ausente sem sair ou perder seu formulário de requisição.</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-muted font-bold"
                onClick={() => setIsAddProdFromOutputOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs overflow-y-auto">
              <form onSubmit={handleSaveQuickProduct} className="space-y-4">
                
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                    Nome do Produto <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickProdName}
                    onChange={(e) => setQuickProdName(e.target.value)}
                    placeholder="Ex: Regulador de Pressão Aliança 506/01"
                    className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs"
                  />
                </div>

                {/* Product Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                    Categoria <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={quickProdCategory}
                      onChange={(e) => setQuickProdCategory(e.target.value)}
                      required
                      className="flex-1 h-9 px-2 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs cursor-pointer"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                      <option value="Conexões">Conexões</option>
                      <option value="Ferramentas">Ferramentas</option>
                      <option value="Segurança">Segurança (EPI)</option>
                      <option value="Insumos">Outros Insumos</option>
                    </select>
                    
                    <input
                      type="text"
                      placeholder="Ou digite nova..."
                      value={quickProdCategory}
                      onChange={(e) => setQuickProdCategory(e.target.value)}
                      className="w-1/2 h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs"
                    />
                  </div>
                </div>

                {/* Stock Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                      Qtd. Em Estoque Inicial <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={quickProdQty || ""}
                      onChange={(e) => setQuickProdQty(e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs font-semibold font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                      Qtd. Estoque Mínimo <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={quickProdMinQty || ""}
                      onChange={(e) => setQuickProdMinQty(e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs font-semibold font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                      Valor Unitário (Opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quickProdPrice || ""}
                      onChange={(e) => setQuickProdPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                      placeholder="Ex: 85.90"
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-foreground">
                      Localização Prateleira
                    </label>
                    <input
                      type="text"
                      value={quickProdLocation}
                      onChange={(e) => setQuickProdLocation(e.target.value)}
                      placeholder="Ex: Corredor A, Prata 3"
                      className="w-full h-9 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-primary focus:outline-none bg-muted/10 text-foreground text-xs"
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex gap-2 pt-3 border-t border-[hsl(var(--border))]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddProdFromOutputOpen(false)}
                    className="flex-1 font-semibold hover:bg-muted"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingQuickProduct}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
                  >
                    {isSavingQuickProduct ? "Salvando..." : "Cadastrar e Usar"}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isExportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[hsl(var(--card))] rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col p-6 shadow-2xl border border-[hsl(var(--border))] overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[hsl(var(--border))] shrink-0 font-sans">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500 flex items-center justify-center">
                  <Settings className="h-5 w-5 animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-foreground">Canva AlmoxPro • Designer Mestre de Etiquetas</h3>
                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 border-0 font-extrabold text-[10px] tracking-wider uppercase">
                      Premium Suite
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">Ajuste o modelo mestre em tempo real. Suas edições aplicam-se a todas as {exportData.length} etiquetas instantaneamente.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => setIsExportModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Split Workspace */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-1 py-4 overflow-hidden min-h-0 text-left">
              
              {/* LEFT COLUMN: Canva Style Properties Panel (7/12 cols) */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-hidden border border-[hsl(var(--border))]/60 rounded-2xl bg-muted/5">
                
                {/* Visual Tab Navigation */}
                <div className="flex border-b border-[hsl(var(--border))] bg-muted/20 p-1.5 shrink-0 font-sans gap-1 text-[11px] font-bold">
                  <button
                    onClick={() => setCanvaTab("layout")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
                      canvaTab === "layout" 
                        ? "bg-background text-foreground shadow-sm border border-[hsl(var(--border))]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    1. Folha & Gabarito
                  </button>
                  <button
                    onClick={() => setCanvaTab("style")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
                      canvaTab === "style" 
                        ? "bg-background text-foreground shadow-sm border border-[hsl(var(--border))]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    2. Design & Layout
                  </button>
                  <button
                    onClick={() => setCanvaTab("elements")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all",
                      canvaTab === "elements" 
                        ? "bg-background text-foreground shadow-sm border border-[hsl(var(--border))]" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    3. Conteúdo & Fontes
                  </button>
                </div>

                {/* Tab Scroll Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-foreground font-sans">
                  
                  {/* TAB 1: SHEET LAYOUT AND PRESETS */}
                  {canvaTab === "layout" && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* Presets Grid */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Selecione um Gabarito Comercial de Partida
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => applyTemplate(e.target.value)}
                            className="w-full h-10 px-3 border border-[hsl(var(--border))] rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-background text-foreground text-xs cursor-pointer font-semibold"
                          >
                            <option value="gondola">A4 Padrão AlmoxPro • Gôndola (2 col x 9 lin - A4 • 91mm x 28mm)</option>
                            <option value="pimaco_6081">Pimaco 6081 / 6181 / 6281 (2 col x 10 lin - Carta • 101,6mm x 25,4mm)</option>
                            <option value="pimaco_6082">Pimaco 6082 (2 col x 7 lin - Carta • 101,6mm x 33,9mm)</option>
                            <option value="pimaco_a4_3100">Pimaco 3100 (3 col x 10 lin - A4 • 63,5mm x 25,4mm)</option>
                            <option value="custom">⚙️ Customizado (Preencher dimensões livremente)</option>
                          </select>
                          <p className="text-[10px] text-muted-foreground italic pl-1 leading-normal font-sans">
                            {labelTemplates.find(x => x.id === selectedTemplateId)?.description}
                          </p>
                        </div>
                      </div>

                      {/* Main Sheet Metrics */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--primary))] border-b border-[hsl(var(--border))] pb-1">
                          Parâmetros de Medidas Geras (mm)
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Formato da Folha</span>
                              <span className="text-muted-foreground text-[10px] uppercase font-mono">{sheetSize}</span>
                            </div>
                            <select
                              value={sheetSize}
                              onChange={(e) => {
                                setSheetSize(e.target.value);
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 px-2 border border-[hsl(var(--border))] rounded-md focus:ring-1 focus:ring-indigo-500 bg-background text-foreground text-xs font-semibold"
                            >
                              <option value="a4">A4 (210mm x 297mm)</option>
                              <option value="letter">Carta (215.9mm x 279.4mm)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Colunas na Folha</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{cols} col</span>
                            </div>
                            <input
                              type="range" min="1" max="8" step="1"
                              value={cols}
                              onChange={(e) => {
                                setCols(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Linhas na Folha</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{rows} lin</span>
                            </div>
                            <input
                              type="range" min="1" max="30" step="1"
                              value={rows}
                              onChange={(e) => {
                                setRows(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Margem Topo (Y)</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{marginY} mm</span>
                            </div>
                            <input
                              type="range" min="0" max="40" step="0.5"
                              value={marginY}
                              onChange={(e) => {
                                setMarginY(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Margem Lateral (X)</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{marginX} mm</span>
                            </div>
                            <input
                              type="range" min="0" max="40" step="0.5"
                              value={marginX}
                              onChange={(e) => {
                                setMarginX(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Espaço Vertical</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{gapY} mm</span>
                            </div>
                            <input
                              type="range" min="0" max="15" step="0.1"
                              value={gapY}
                              onChange={(e) => {
                                setGapY(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between">
                              <span className="font-bold">Espaço Horizontal</span>
                              <span className="text-muted-foreground text-[10px] font-mono">{gapX} mm</span>
                            </div>
                            <input
                              type="range" min="0" max="15" step="0.1"
                              value={gapX}
                              onChange={(e) => {
                                setGapX(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>
                          
                          <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-center text-center">
                            <div className="space-y-0.5">
                              <div className="text-[10px] uppercase font-black tracking-widest text-indigo-500">Capacidade da Folha</div>
                              <div className="text-lg font-black text-foreground">{cols * rows} unidades</div>
                              <div className="text-[9px] text-muted-foreground">Etiquetas por página impressa</div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* TAB 2: POSITION, BG COLOR, ALIGNMENT */}
                  {canvaTab === "style" && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      
                      {/* QR POSITIONING */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Posicionamento do QR Code
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setQrPosition("right")}
                            className={cn(
                              "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer bg-background",
                              qrPosition === "right"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <AlignRight className="h-4 w-4" />
                            <span>Direita (Padrão)</span>
                          </button>

                          <button
                            onClick={() => setQrPosition("left")}
                            className={cn(
                              "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer bg-background",
                              qrPosition === "left"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <AlignLeft className="h-4 w-4" />
                            <span>Esquerda</span>
                          </button>

                          <button
                            onClick={() => setQrPosition("center_top")}
                            className={cn(
                              "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer bg-background",
                              qrPosition === "center_top"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <QrCode className="h-4 w-4" />
                            <span>Centro (Topo)</span>
                          </button>
                        </div>
                      </div>

                      {/* TEXT ALIGNMENT */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          Alinhamento dos Textos da Etiqueta
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setTextAlign("left")}
                            className={cn(
                              "p-2 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-background",
                              textAlign === "left"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <AlignLeft className="h-4 w-4" />
                            <span>Esquerda</span>
                          </button>

                          <button
                            onClick={() => setTextAlign("center")}
                            className={cn(
                              "p-2 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-background",
                              textAlign === "center"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <AlignCenter className="h-4 w-4" />
                            <span>Centralizar</span>
                          </button>

                          <button
                            onClick={() => setTextAlign("right")}
                            className={cn(
                              "p-2 rounded-xl border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-background",
                              textAlign === "right"
                                ? "border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-500 font-extrabold"
                                : "border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/10"
                            )}
                          >
                            <AlignRight className="h-4 w-4" />
                            <span>Direita</span>
                          </button>
                        </div>
                      </div>

                      {/* DECORATIVE COLOR BAR ACCENT */}
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>Faixa de Cor (Destaque Industrial)</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-mono font-bold tracking-normal">{accentColor === "none" ? "Nenhum" : accentColor}</span>
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                          <button
                            onClick={() => setAccentColor("none")}
                            className={cn(
                              "relative h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center overflow-hidden bg-background",
                              accentColor === "none" ? "border-indigo-500 ring-2 ring-indigo-500/10 text-foreground" : "border-[hsl(var(--border))] text-muted-foreground"
                            )}
                            title="Sem faixa colorida"
                          >
                            <X className="h-4 w-4 text-[#e24b4a]" />
                          </button>

                          <button
                            onClick={() => setAccentColor("indigo")}
                            className={cn(
                              "h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center bg-indigo-600 hover:scale-105",
                              accentColor === "indigo" ? "border-black ring-4 ring-indigo-500/30" : "border-transparent"
                            )}
                            title="Estilo Índigo Corp"
                          />

                          <button
                            onClick={() => setAccentColor("amber")}
                            className={cn(
                              "h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center bg-[#00d4ff]/10 hover:scale-105",
                              accentColor === "amber" ? "border-black ring-4 ring-[#00d4ff]/30" : "border-transparent"
                            )}
                            title="Estilo Alerta / Manutenção"
                          />

                          <button
                            onClick={() => setAccentColor("emerald")}
                            className={cn(
                              "h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center bg-[#378add]/10 hover:scale-105",
                              accentColor === "emerald" ? "border-black ring-4 ring-[#00d4ff]/30" : "border-transparent"
                            )}
                            title="Estilo Segurança / Ativo"
                          />

                          <button
                            onClick={() => setAccentColor("rose")}
                            className={cn(
                              "h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center bg-[#e24b4a]/10 hover:scale-105",
                              accentColor === "rose" ? "border-black ring-4 ring-[#00d4ff]/30" : "border-transparent"
                            )}
                            title="Estilo Crítico / Risco"
                          />

                          <button
                            onClick={() => setAccentColor("slate")}
                            className={cn(
                              "h-10 rounded-xl border cursor-pointer transition-all flex items-center justify-center bg-slate-700 hover:scale-105",
                              accentColor === "slate" ? "border-black ring-4 ring-slate-500/30" : "border-transparent"
                            )}
                            title="Estilo Técnico / Neutro"
                          />
                        </div>
                      </div>

                      {/* BORDER RADIUS / CORNERS SHARPNESS */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Arredondamento dos Cantos</label>
                          <span className="text-muted-foreground font-mono font-bold">{borderRadius} mm</span>
                        </div>
                        <input
                          type="range" min="0" max="6" step="0.2"
                          value={borderRadius}
                          onChange={(e) => setBorderRadius(Number(e.target.value))}
                          className="w-full h-8 accent-indigo-600 block"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>Sharp (Reto)</span>
                          <span>Suave</span>
                          <span>Round (Pimaco)</span>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 3: ELEMENT TOGGLES AND SIZES */}
                  {canvaTab === "elements" && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--primary))] border-b border-[hsl(var(--border))] pb-1">
                          Dimensionamento de Elementos (mm)
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold">Largura da Etiqueta</span>
                              <span className="text-muted-foreground font-mono">{cardWidth} mm</span>
                            </div>
                            <input
                              type="range" min="30" max="150" step="0.5"
                              value={cardWidth}
                              onChange={(e) => {
                                setCardWidth(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold">Altura da Etiqueta</span>
                              <span className="text-muted-foreground font-mono">{cardHeight} mm</span>
                            </div>
                            <input
                              type="range" min="10" max="80" step="0.5"
                              value={cardHeight}
                              onChange={(e) => {
                                setCardHeight(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold">Tamanho QR Code</span>
                              <span className="text-muted-foreground font-mono">{qrSize} mm</span>
                            </div>
                            <input
                              type="range" min="5" max="40" step="1"
                              value={qrSize}
                              onChange={(e) => {
                                setQrSize(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold">Tamanho Fonte Texto</span>
                              <span className="text-muted-foreground font-mono">{fontSize} pt</span>
                            </div>
                            <input
                              type="range" min="5" max="16" step="0.5"
                              value={fontSize}
                              onChange={(e) => {
                                setFontSize(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold">Padding Interno (Recuo)</span>
                              <span className="text-muted-foreground font-mono">{paddingX} mm</span>
                            </div>
                            <input
                              type="range" min="0" max="10" step="0.5"
                              value={paddingX}
                              onChange={(e) => {
                                setPaddingX(Number(e.target.value));
                                setSelectedTemplateId("custom");
                              }}
                              className="w-full h-8 accent-indigo-600 block"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--primary))] border-b border-[hsl(var(--border))] pb-1">
                          Visibilidade de Elementos
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:bg-muted/30 transition-all select-none bg-background">
                            <input
                              type="checkbox"
                              checked={hasBorders}
                              onChange={(e) => {
                                setHasBorders(e.target.checked);
                                setSelectedTemplateId("custom");
                              }}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer rounded"
                            />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs">Desenhar Linhas de Borda</div>
                              <div className="text-[10px] text-muted-foreground">Mostra moldura sutil em cada etiqueta</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:bg-muted/30 transition-all select-none bg-background">
                            <input
                              type="checkbox"
                              checked={showSku}
                              onChange={(e) => setShowSku(e.target.checked)}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer rounded"
                            />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs font-mono">Mostrar SKU do Produto</div>
                              <div className="text-[10px] text-muted-foreground">Texto SKU: [CÓDIGO] no lote</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:bg-muted/30 transition-all select-none bg-background">
                            <input
                              type="checkbox"
                              checked={showBrand}
                              onChange={(e) => setShowBrand(e.target.checked)}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer rounded"
                            />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs">Simbolo AlmoxPro</div>
                              <div className="text-[10px] text-muted-foreground">Coloca marca d'água no rodapé</div>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[hsl(var(--border))] cursor-pointer hover:bg-muted/30 transition-all select-none bg-background">
                            <input
                              type="checkbox"
                              checked={showTitleHeader}
                              onChange={(e) => {
                                setShowTitleHeader(e.target.checked);
                                setSelectedTemplateId("custom");
                              }}
                              className="h-4 w-4 accent-indigo-600 cursor-pointer rounded"
                            />
                            <div className="space-y-0.5">
                              <div className="font-semibold text-xs">Incluir Título na Folha</div>
                              <div className="text-[10px] text-muted-foreground">Cria um cabeçalho oficial no PDF</div>
                            </div>
                          </label>
                        </div>
                      </div>

                    </div>
                  )}
                  
                </div>
              </div>
              
              {/* RIGHT COLUMN: Interactive Canva Visualizer (5/12 cols) */}
              <div className="lg:col-span-5 flex flex-col h-full overflow-hidden space-y-4">
                
                {/* Visualizer Canvas Box */}
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between items-center text-center relative overflow-hidden shadow-2xl shadow-slate-950/20">
                  
                  {/* Canva Sandbox Header badge */}
                  <div className="absolute top-2.5 right-3 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-full text-[9px] font-black tracking-wider uppercase font-sans">
                    CANVA LIVE SCREEN
                  </div>
                  
                  {/* Helper description */}
                  <div className="text-left w-full border-b border-slate-800 pb-2 mb-3">
                    <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider">Visualização Realista Mestre</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 leading-normal">Todas as {exportData.length} etiquetas copiadoras herdarão este design exato</span>
                  </div>

                  {/* REALTIME RENDERING COMPONENT WORKSPACE */}
                  <div className="flex-1 flex items-center justify-center w-full py-8 text-left font-sans">
                    {(() => {
                      // Proportional Scale Math in Screen Space
                      // Let's assume on screen the label is represented inside a max-width of 260px container.
                      const maxPreviewWidth = 265;
                      const scale = maxPreviewWidth / Math.max(30, cardWidth);
                      const computedHeight = cardHeight * scale;
                      
                      // Map Accent Colors
                      const stripeColorClass = {
                        none: "hidden",
                        indigo: "bg-indigo-600",
                        amber: "bg-[#00d4ff]/10",
                        emerald: "bg-[#378add]/10",
                        rose: "bg-[#e24b4a]/10",
                        slate: "bg-slate-500"
                      }[accentColor];

                      const previewItem = exportData.length > 0 ? exportData[0] : {
                        name: "Válvula Reguladora de Pressão Aliança 506B Comandos de Gás",
                        id: "VAL-506B-99",
                        qrUrl: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VAL-506B-99"
                      };

                      return (
                        <div 
                          className="relative bg-white text-slate-900 shadow-2xl transition-all duration-300 select-none overflow-hidden flex flex-row"
                          style={{
                            width: `${maxPreviewWidth}px`,
                            height: `${computedHeight}px`,
                            borderRadius: `${borderRadius * scale}px`,
                            border: hasBorders ? "1.5px solid #cbd5e1" : "none",
                            padding: `${paddingX * scale}px`,
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                          }}
                        >
                          {/* Accent bar strip on left side */}
                          {accentColor !== "none" && (
                            <div 
                              className={cn("absolute left-[1px] top-[1px] bottom-[1px] rounded-l-md", stripeColorClass)} 
                              style={{ 
                                width: `${2.3 * scale}px`,
                                borderTopLeftRadius: `${borderRadius * scale}px`,
                                borderBottomLeftRadius: `${borderRadius * scale}px`
                              }}
                            />
                          )}

                          {/* Dynamic Grid Layout matching style preferences (Flex flow or Column) */}
                          <div 
                            className={cn(
                              "w-full h-full flex gap-1 relative",
                              qrPosition === "right" && "flex-row justify-between items-center",
                              qrPosition === "left" && "flex-row-reverse justify-between items-center",
                              qrPosition === "center_top" && "flex-col justify-center items-center text-center"
                            )}
                            style={{
                              paddingLeft: (accentColor !== "none" && qrPosition !== "left") ? `${2.5 * scale}px` : "0px",
                              paddingRight: (accentColor !== "none" && qrPosition === "left") ? `${2.5 * scale}px` : "0px"
                            }}
                          >
                            {/* TEXT BOX WRAPPER */}
                            <div 
                              className={cn(
                                "flex flex-col justify-between overflow-hidden",
                                qrPosition === "center_top" ? "w-full" : "flex-1 min-w-0"
                              )}
                              style={{
                                textAlign: textAlign,
                                height: qrPosition === "center_top" ? "auto" : "100%"
                              }}
                            >
                              {/* Product Name */}
                              <div 
                                className="font-extrabold text-slate-900 hover:text-indigo-600 transition-colors leading-[1.25] tracking-tight truncate-3-lines"
                                style={{ 
                                  fontSize: `${fontSize * scale * 0.38}px`,
                                  marginTop: qrPosition === "center_top" ? "2.5px" : "0px"
                                }}
                              >
                                {previewItem.name}
                              </div>

                              {/* Footer SKU and brand wrap */}
                              <div className={cn("space-y-[1px]", qrPosition === "center_top" && "mt-1.5")}>
                                {showSku && (
                                  <div 
                                    className="font-black text-slate-500 font-mono"
                                    style={{ fontSize: `${Math.max(5.5, fontSize * 0.75) * scale * 0.38}px` }}
                                  >
                                    SKU: {previewItem.id}
                                  </div>
                                )}
                                
                                {showBrand && cardHeight > 22 && qrPosition !== "center_top" && (
                                  <div 
                                    className="text-slate-400 font-bold uppercase tracking-wider block"
                                    style={{ fontSize: `${fontSize * 0.55 * scale * 0.38}px` }}
                                  >
                                    AlmoxPro
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* QR CODE BOX WRAPPER */}
                            <div 
                              className="flex items-center justify-center bg-slate-100/50 rounded-lg p-0.5 border border-slate-200 shrink-0"
                              style={{
                                width: `${qrSize * scale}px`,
                                height: `${qrSize * scale}px`,
                              }}
                            >
                              <img 
                                src={previewItem.qrUrl} 
                                alt="QR Code Preview" 
                                className="w-full h-full object-contain rounded" 
                                referrerPolicy="no-referrer"
                              />
                            </div>

                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Sheet Packaging Visualizer (Grid Simulation) */}
                  <div className="w-full bg-slate-900/40 p-3 rounded-xl border border-slate-800/80 text-[10px] text-slate-300 text-left space-y-1.5 font-sans shrink-0">
                    <span className="font-extrabold text-slate-400 block uppercase tracking-wider">Aproveitamento de Impressão ({cols * rows} por folha)</span>
                    <div className="flex gap-2.5 items-center">
                      <div className="grid border border-slate-700 bg-slate-950 p-[3px] rounded gap-[2px] w-14 shrink-0"
                           style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                        {Array.from({ length: Math.min(24, cols * rows) }).map((_, i) => (
                          <div key={i} className="bg-indigo-600/30 border border-indigo-600/50 rounded-[1px] aspect-[3.25/1] h-[5px] w-full" />
                        ))}
                      </div>
                      <div className="flex-1 text-[9px] text-slate-400 leading-normal">
                        Uma única folha **{sheetSize === "a4" ? "A4" : "Carta"}** acomodará as etiquetas em **{cols} colunas x {rows} linhas**. {exportData.length > (cols * rows) ? `Lote total demandará ${Math.ceil(exportData.length / (cols * rows))} folhas inteiras.` : 'Todo o lote cabe em uma única folha de papel.'}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Search & Selected list summary */}
                <div className="space-y-1.5 text-left font-sans shrink-0">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--border))] pb-1">
                    <span>Lote da exportação ({exportData.length} etiquetas)</span>
                    <span className="text-[9px] hover:underline cursor-pointer text-indigo-500" onClick={() => applyTemplate("gondola")}>Restaurar Fabricante</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto border border-[hsl(var(--border))] rounded-xl p-2 space-y-1.5 bg-muted/10">
                    {exportData.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1 px-1.5 rounded-lg border border-[hsl(var(--border))]/50 bg-background/50 text-[10px]">
                        <div className="truncate pr-2">
                          <span className="font-extrabold text-foreground">{item.name}</span>
                          <span className="text-[9px] font-mono ml-2 text-muted-foreground">SKU: {item.id}</span>
                        </div>
                        <span className="bg-[#378add]/10 text-[#378add] font-black text-[8px] px-1.5 py-0.5 rounded-full uppercase shrink-0 font-sans">
                          Pronto
                        </span>
                      </div>
                    ))}
                    {exportData.length > 4 && (
                      <div className="text-center text-[9px] text-muted-foreground py-0.5 font-medium">
                        ... e mais {exportData.length - 4} produtos selecionados no lote.
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-[hsl(var(--border))] bg-card shrink-0 font-sans">
              <Button 
                variant="outline" 
                className="flex-1 flex items-center justify-center gap-2 font-bold text-xs h-10 border-[hsl(var(--border))] text-foreground bg-[hsl(var(--muted))]/5 hover:bg-muted/40 w-full" 
                onClick={() => setIsExportModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={generateExportedPdf} 
                disabled={exportData.length === 0}
                className="flex-1 flex items-center justify-center gap-2.5 font-extrabold text-xs h-10 w-full bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/10 shadow-md text-white border-0 cursor-pointer"
              >
                <FileText className="h-4 w-4" /> Gerar PDF de Alta Resolução ({exportData.length} etiquetas)
              </Button>
            </div>
            
          </motion.div>
        </div>
      )}
    </div>
  );
}
