export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  location: string;
  qty: number;
  minQty: number;
  price: number;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'OUT_OF_STOCK';
  imageUrl?: string;
  description?: string;
  qtyEmCampo?: number;
  updatedAt?: any;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  purpose: string;
  photoUrl?: string;
}

export interface MovementItem {
  id: string;
  type: 'IN' | 'OUT' | 'RETURN' | 'CONSUME';
  qty: number;
  reason: string;
  date: string;
  user: string;
  userEmail: string;
  employeeId?: string;
  employeeName?: string;
  destination?: string;
  batchId?: string;
  status?: 'EM_CAMPO' | 'PARCIAL' | 'CONCLUIDO';
}

export interface ShipmentItem {
  id: string;
  destination: string;
  items: number;
  driver?: string;
  vehicle?: string;
  status: 'CURRENT' | 'DELIVERED' | 'PREPARING' | 'SHIPPED' | 'PENDING';
  date: string;
}

export interface CompanySettings {
  companyName?: string;
  welcomeMessage?: string;
  customGreeting?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  whatsappNumero?: string;
  whatsappApiKey?: string;
  whatsappAtivo?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  unit: string; // e.g., 'hora', 'm2', 'unid'
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  serviceDone: string;
  date: string;
  km: number;
  mechanicNotes?: string;
  cost?: number;
}

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  type: string; // e.g., 'Caminhão', 'Furgão', 'Moto'
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  driver?: string;
  driverPhone?: string;
  createdAt: string;
  currentKm?: number;
  lastOilChangeKm?: number;
  lastOilChangeDate?: string;
  lastCoolantChangeKm?: number;
  lastCoolantChangeDate?: string;
  mechanicNotes?: string;
  nextMaintenanceDate?: string;
  nextMaintenanceKm?: number;
  nextMaintenanceNotes?: string;
  maintenances?: MaintenanceRecord[];
}

export interface QuoteItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  type: 'PRODUCT' | 'SERVICE';
}

export interface Quote {
  id: string;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: QuoteItem[];
  serviceDescription?: string;
  laborValue: number;
  taxRate: number; // percentage
  total: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  date: string;
  validUntil: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  phone: string;
  whatsapp: string;
  email: string;
  rating: number;
  status: string;
  produtos?: string[];
  observacoes?: string;
}

export interface Organization {
  orgId: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: 'MANUAL' | 'IMPORT';
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';
  createdAt: string;
  notes?: string;
}

export interface QualityReport {
  id: string;
  productName: string;
  inspectorName: string;
  structureStatus: boolean;
  hasImetro: 'SIM' | 'NAO' | 'NA';
  hasLabSeal: 'SIM' | 'NAO' | 'NA';
  hasSafetySeals: 'SIM' | 'NAO' | 'NA';
  notes: string;
  signature: string; // Base64 png data URL
  status: 'APPROVED' | 'DISAPPROVED';
  type: 'LOTE' | 'PRODUTO' | 'CAIXA';
  date: string;
}

export interface VisionRecord {
  id?: string;
  sku: string; // referência a InventoryItem.id
  label: string;
  embeddings: number[][]; // multi-amostra (vários ângulos do mesmo item)
  samples: number;
  fonte: 'live_scanner' | 'agent_chat' | 'manual';
  createdAt?: any;
  updatedAt?: any;
}

export type AgentAcao =
  | 'registrar_saida' | 'registrar_retorno' | 'ajustar_qty'
  | 'criar_item' | 'editar_item'
  | 'criar_fornecedor' | 'editar_fornecedor'
  | 'criar_funcionario' | 'criar_orcamento'
  | 'gerar_documento' | 'solicitar_reposicao' | 'nenhum';

export interface AgentIntent {
  acao: AgentAcao;
  alvoTipo: 'inventory' | 'supplier' | 'employee' | 'quote' | 'document' | 'none';
  alvoId: string;
  params: Record<string, any>;
  confianca: number; // 0-100
}

export interface AgentDecision {
  id?: string;
  intent: AgentAcao;
  alvoTipo: string;
  alvoId: string;
  params: Record<string, any>;
  resultado: 'executado' | 'cancelado' | 'erro';
  confianca: number;
  userVerdict: 'correto' | 'incorreto' | null;
  timestamp?: any;
}

