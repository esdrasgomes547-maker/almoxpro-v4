import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { AccessGuard } from "./components/AccessGuard";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { DemoModalProvider } from "./components/DemoModalProvider";
import { SubscriptionProvider } from "./components/SubscriptionProvider";

import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { ScanProduct } from "./pages/ScanProduct";
import { ProductShowcase } from "./pages/ProductShowcase";
import { SaidaLote } from "./pages/SaidaLote";
import { Registros } from "./pages/Registros";
import { AppLayout } from "./components/layout/AppLayout";

import { ImportContacts } from "./pages/ImportContacts";
import { usePerformance } from "./lib/performance";

const Dashboard   = React.lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Inventory   = React.lazy(() => import("./pages/Inventory").then(m => ({ default: m.Inventory })));
const Services    = React.lazy(() => import("./pages/Services").then(m => ({ default: m.Services })));
const Quotes      = React.lazy(() => import("./pages/Quotes").then(m => ({ default: m.Quotes })));
const Shipments   = React.lazy(() => import("./pages/Shipments").then(m => ({ default: m.Shipments })));
const Fleet       = React.lazy(() => import("./pages/Fleet").then(m => ({ default: m.Fleet })));
const Employees   = React.lazy(() => import("./pages/Employees").then(m => ({ default: m.Employees })));
const Suppliers   = React.lazy(() => import("./pages/Suppliers").then(m => ({ default: m.Suppliers })));
const Leads       = React.lazy(() => import("./pages/Leads").then(m => ({ default: m.Leads })));
const Reports     = React.lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const SalesSimulation = React.lazy(() => import("./pages/SalesSimulation").then(m => ({ default: m.SalesSimulation })));
const Catalog     = React.lazy(() => import("./pages/Catalog").then(m => ({ default: m.Catalog })));
const Integrations= React.lazy(() => import("./pages/Integrations").then(m => ({ default: m.Integrations })));
const Settings    = React.lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Support     = React.lazy(() => import("./pages/Support").then(m => ({ default: m.Support })));
const ImportInventory = React.lazy(() => import("./pages/ImportInventory").then(m => ({ default: m.ImportInventory })));
const MasterPanel = React.lazy(() => import("./pages/MasterPanel").then(m => ({ default: m.MasterPanel })));
const LiveScanner = React.lazy(() => import("./pages/LiveScanner").then(m => ({ default: m.LiveScanner })));
const Documentos  = React.lazy(() => import("./pages/Documentos").then(m => ({ default: m.Documentos })));

const SuspenseFallback = (
  <div className="flex items-center justify-center h-layout-screen">
    <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
  </div>
);

export default function App() {
  usePerformance(); // Initializes auto-adaptive performance detection and pocket mode overrides on document.body

  return (
    <ThemeProvider defaultTheme="dark" storageKey="altec-theme">
      <SubscriptionProvider>
        <BrowserRouter>
        <DemoModalProvider>
          <Suspense fallback={SuspenseFallback}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/subscribe" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/scan" element={<ScanProduct />} />
              <Route path="/produto/:sku" element={<ProductShowcase />} />
              <Route path="/catalog/item/:sku" element={<Catalog isPublicItemView />} />
              
              <Route 
                path="/master" 
                element={
                  <AccessGuard requireMaster>
                    <AppLayout>
                      <MasterPanel />
                    </AppLayout>
                  </AccessGuard>
                } 
              />

              <Route 
                path="/app/*" 
                element={
                  <AccessGuard>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="saida-lote" element={<SaidaLote />} />
                        <Route path="live-scanner" element={<LiveScanner />} />
                        <Route path="documentos" element={<Documentos />} />
                        <Route path="registros" element={<Registros />} />
                        <Route path="inventory" element={<Inventory />} />
                        <Route path="services" element={<Services />} />
                        <Route path="quotes" element={<Quotes />} />
                        <Route path="shipments" element={<Shipments />} />
                        <Route path="fleet" element={<Fleet />} />
                        <Route path="employees" element={<Employees />} />
                        <Route path="suppliers" element={<Suppliers />} />
                        <Route path="import-contacts" element={<ImportContacts />} />
                        <Route path="leads" element={<Leads />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="simulation" element={<SalesSimulation />} />
                        <Route path="catalog" element={<Catalog />} />
                        <Route path="integrations" element={<Integrations />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="support" element={<Support />} />
                        <Route path="estoque/importar" element={<ImportInventory />} />
                      </Routes>
                    </AppLayout>
                  </AccessGuard>
                } 
              />
            </Routes>
          </Suspense>
        </DemoModalProvider>
      </BrowserRouter>
    </SubscriptionProvider>
      <Toaster />
    </ThemeProvider>
  );
}
