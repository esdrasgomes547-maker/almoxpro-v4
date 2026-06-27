import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";

import { motion } from "motion/react";
import { Search, Package, Info, Image as ImageIcon, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, handleFirestoreError, OperationType, safeOnSnapshot } from "../lib/firebase";
import { collection, doc, getDoc } from "firebase/firestore";
import { useOrganization } from "../lib/tenant";
import { InventoryItem, Category } from "../types";

interface CatalogProps {
  isPublicItemView?: boolean;
}

export function Catalog({ isPublicItemView = false }: CatalogProps) {
  const { orgId: contextOrgId } = useOrganization();
  const { sku } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orgFromUrl = searchParams.get("org");
  const effectiveOrgId = contextOrgId || orgFromUrl;

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Single Item State for Public View
  const [publicItem, setPublicItem] = useState<InventoryItem | null>(null);
  const [loadingPublic, setLoadingPublic] = useState(isPublicItemView);

  // Load Single Item if Public
  useEffect(() => {
    if (isPublicItemView && sku && effectiveOrgId) {
      setLoadingPublic(true);
      getDoc(doc(db, `organizations/${effectiveOrgId}/inventory`, sku)).then(snap => {
        if (snap.exists()) {
          setPublicItem({ id: snap.id, ...snap.data() } as InventoryItem);
        }
        setLoadingPublic(false);
      }).catch(err => {
        console.warn("Public catalog single item getDoc failed:", err.message);
        handleFirestoreError(err, OperationType.GET, `organizations/${effectiveOrgId}/inventory/${sku}`);
        setLoadingPublic(false);
      });
    }
  }, [isPublicItemView, sku, effectiveOrgId]);

  // Load Inventory and Categories (Only if not single item view or if we want background data)
  useEffect(() => {
    if (!effectiveOrgId || isPublicItemView) return;

    const unsubInv = safeOnSnapshot(collection(db, `organizations/${effectiveOrgId}/inventory`), "inventory", (items) => {
      setInventory(items as InventoryItem[]);
    }, (err) => {
      console.warn("Catalog inventory scan subscription blocked: ", err.message);
    });

    const unsubCat = safeOnSnapshot(collection(db, `organizations/${effectiveOrgId}/categories`), "categories", (cats) => {
      setCategories(cats as Category[]);
    }, (err) => {
      console.warn("Catalog category scan subscription blocked: ", err.message);
    });

    return () => {
      unsubInv();
      unsubCat();
    };
  }, [effectiveOrgId, isPublicItemView]);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isPublicItemView) {
    if (loadingPublic) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!publicItem) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
          <div className="bg-muted/50 p-6 rounded-full mb-6">
            <Package className="h-12 w-12 text-muted-foreground/20" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Produto Não Encontrado</h1>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-xs">O QR Code lido não corresponde a nenhum item ativo em nosso catálogo digital no momento.</p>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="h-12 px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] border-border/60"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex flex-col pb-12">
        <header className="p-5 flex items-center justify-between border-b border-border/50 bg-card/30 backdrop-blur-md sticky top-0 z-10">
           <div className="flex items-center gap-3">
              <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
                 <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Catálogo Digital</h1>
                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-70">AlmoxPro System</p>
              </div>
           </div>
        </header>

        <main className="flex-1 p-6 flex flex-col items-center max-w-lg mx-auto w-full pt-12">
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: 1, scale: 1 }}
             className="w-full aspect-square relative rounded-[3rem] overflow-hidden border-4 border-primary/20 shadow-2xl shadow-primary/10 bg-card mb-10 group hover:border-primary/40 transition-all duration-500"
           >
              {publicItem.imageUrl ? (
                <img 
                  src={publicItem.imageUrl} 
                  alt={publicItem.name} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/20">
                  <ImageIcon className="h-24 w-24 mb-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Sem Imagem Disponível</span>
                </div>
              )}
              
              {/* Product Badge Area */}
              <div className="absolute inset-x-6 bottom-6">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl">
                  <span className="text-[10px] font-black text-primary-foreground bg-primary px-2.5 py-1 rounded-lg uppercase tracking-widest mb-2 inline-block shadow-sm">
                    {publicItem.category || "Geral"}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
                    {publicItem.name}
                  </h2>
                </div>
              </div>
           </motion.div>

           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="text-center space-y-6 w-full"
           >
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary">
                   <Info className="h-4 w-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Informações Técnicas</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed px-4 italic font-medium opacity-80">
                  {publicItem.description || "Este componente faz parte da linha de ativos industriais AlmoxPro. Detalhes técnicos específicos estão disponíveis apenas para usuários credenciados."}
                </p>
              </div>
              
              <div className="pt-8 flex flex-col gap-4">
                 <div className="flex flex-col items-center gap-1 opacity-60 bg-card border border-border/40 py-4 px-6 rounded-2xl">
                   <span className="text-[9px] font-black uppercase tracking-widest text-primary">Identificador Técnico</span>
                   <span className="font-mono text-xs font-bold tracking-tight text-foreground/85 mt-1">{publicItem.id}</span>
                 </div>
              </div>
           </motion.div>
        </main>

        <footer className="mt-auto text-center p-8">
           <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">AlmoxPro v4.2 Internal Terminal</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase italic">Catálogo AlmoxPro</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Package className="h-4 w-4" /> Visualização estratégica de componentes e ativos
          </p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Pesquisar no catálogo técnico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border-border h-12 pl-12 pr-4 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <Button 
            variant={selectedCategory === null ? "default" : "outline"}
            onClick={() => setSelectedCategory(null)}
            className="rounded-full px-5 h-10 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
          >
            Todos
          </Button>
          {categories.map(cat => (
            <Button 
              key={cat.id}
              variant={selectedCategory === cat.name ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.name)}
              className="rounded-full px-5 h-10 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </section>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:16, padding:"20px 0" }}>
        {filteredInventory.map(item => (
          <div key={item.id} style={{ background:"rgba(255,255,255,0.02)", border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:16, overflow:"hidden", cursor:"pointer" }}
            onClick={() => navigate(`/app/inventory?view=${item.id}`)}>
            <div style={{ height:140, background:"#060f20", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"contain", padding:12 }} />
                : <Package style={{ width:40, height:40, color:"rgba(255,255,255,0.1)" }} />}
            </div>
            <div style={{ padding:"12px" }}>
              <p style={{ fontSize:10, fontFamily:"monospace", color:"rgba(255,255,255,0.3)", margin:"0 0 4px" }}>{item.id}</p>
              <p style={{ fontSize:13, fontWeight:500, color:"#e8f4ff", margin:"0 0 6px", lineHeight:1.3 }}>{item.name}</p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{item.category}</span>
                <span style={{ fontSize:12, fontWeight:600, color: (item.qty??0)===0?"#e24b4a":(item.qty??0)<=(item.minQty??0)?"#f59e0b":"#00c47a" }}>{item.qty??0} un</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
