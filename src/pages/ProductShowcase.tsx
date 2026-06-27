import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PackageSearch } from "lucide-react";

interface Produto {
  id: string;
  name: string;
  imageUrl?: string;
  price?: number;
  category?: string;
  description?: string;
  emEstoque?: boolean;
}

function ParallaxViewer({ imageUrl, name }: { imageUrl: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [light, setLight] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const animRef = useRef<number>(0);
  const targetTilt = useRef({ x: 0, y: 0 });
  const currentTilt = useRef({ x: 0, y: 0 });

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    currentTilt.current.x = lerp(currentTilt.current.x, targetTilt.current.x, 0.08);
    currentTilt.current.y = lerp(currentTilt.current.y, targetTilt.current.y, 0.08);
    setTilt({ x: currentTilt.current.x, y: currentTilt.current.y });
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current!);
  }, [animate]);

  const handleMove = (cx: number, cy: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (cx - rect.left) / rect.width;
    const y = (cy - rect.top) / rect.height;
    targetTilt.current = { x: (y - 0.5) * 22, y: (x - 0.5) * -22 };
    setLight({ x: x * 100, y: y * 100 });
  };

  const reset = () => { targetTilt.current = { x: 0, y: 0 }; setLight({ x: 50, y: 50 }); setHovered(false); };

  return (
    <div ref={ref}
      onMouseMove={e => { handleMove(e.clientX, e.clientY); setHovered(true); }}
      onMouseLeave={reset}
      onTouchMove={e => { handleMove(e.touches[0].clientX, e.touches[0].clientY); setHovered(true); }}
      onTouchEnd={reset}
      style={{
        width: "100%", height: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        perspective: "800px",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div style={{
        position: "relative",
        width: 240, height: 240,
        transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.05 : 1})`,
        transition: hovered ? "none" : "transform 0.6s cubic-bezier(.34,1.56,.64,1)",
        borderRadius: 20,
        overflow: "hidden",
        border: "0.5px solid rgba(0,212,255,0.15)",
      }}>
        {/* Imagem do produto */}
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: "100%", height: "100%",
            objectFit: "contain",
            padding: 20,
            background: "#060f20",
            display: "block",
          }}
          draggable={false}
        />

        {/* Reflexo de luz seguindo o mouse */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at ${light.x}% ${light.y}%, rgba(0,212,255,0.12) 0%, transparent 60%)`,
          transition: hovered ? "none" : "background 0.5s",
        }} />

        {/* Borda brilhante */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          borderRadius: 20,
          boxShadow: `inset 0 0 0 1px rgba(0,212,255,${hovered ? 0.25 : 0.08})`,
          transition: "box-shadow 0.3s",
        }} />
      </div>
    </div>
  );
}

function NoImage({ name }: { name: string }) {
  const letters = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return (
    <div style={{
      width: "100%", height: 260,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 160, height: 160,
        borderRadius: "50%",
        background: "#0d1f3c",
        border: "0.5px solid rgba(0,212,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 48, fontWeight: 500, color: "rgba(0,212,255,0.3)",
      }}>
        {letters}
      </div>
    </div>
  );
}

export function ProductShowcase() {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // Tenta ler o SKU da rota (/produto/ITEM-08460) primeiro
    const pathParts = window.location.pathname.split("/");
    const skuFromPath = pathParts[pathParts.length - 1];

    // Fallback para query param (?sku=ITEM-08460)
    const params = new URLSearchParams(window.location.search);
    const skuFromQuery = params.get("sku");

    const sku = (skuFromPath && skuFromPath !== "produto")
      ? skuFromPath
      : skuFromQuery;

    if (!sku) { setErro("SKU não informado."); return; }

    setLoading(true);
    getDoc(doc(db, `organizations/tecgas-master/catalogo_publico`, sku.toUpperCase()))
      .then(snap => {
        if (snap.exists()) {
          setProduto({ id: snap.id, ...snap.data() } as Produto);
          setTimeout(() => setPronto(true), 100);
        } else {
          setErro(`Produto "${sku}" não encontrado.`);
        }
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmtPreco = (v?: number) =>
    v ? `R$ ${v.toFixed(2).replace(".", ",")}` : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050d1a",
      fontFamily: "var(--font-sans)",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Header */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 6, height: 6, background: "#00d4ff", borderRadius: "50%", animation: "p3d 2s ease infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "#7ab3d4", letterSpacing: "0.12em", textTransform: "uppercase" }}>AlmoxPro</span>
        </div>
        <span style={{ fontSize: 10, color: "#2a4a7a", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>QR · VERIFICADO</span>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "2px solid #1b365d", borderTop: "2px solid #00d4ff", borderRadius: "50%", animation: "spin3d 0.8s linear infinite" }} />
          <span style={{ fontSize: 12, color: "#4a7a9b" }}>Carregando produto...</span>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <PackageSearch size={48} color="#1b365d" />
          <span style={{ fontSize: 14, color: "#4a7a9b" }}>{erro}</span>
        </div>
      )}

      {/* Produto */}
      {produto && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          opacity: pronto ? 1 : 0,
          transform: pronto ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>

          {/* Viewer parallax */}
          {produto.imageUrl
            ? <ParallaxViewer imageUrl={produto.imageUrl} name={produto.name} />
            : <NoImage name={produto.name} />
          }

          {/* Info */}
          <div style={{ padding: "0 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

            <div>
              <div style={{ fontSize: 10, color: "#2a4a7a", fontFamily: "var(--font-mono)", marginBottom: 4, letterSpacing: "0.1em" }}>
                {produto.id}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 500, color: "#e8f4ff", lineHeight: 1.3, margin: 0 }}>
                {produto.name}
              </h1>
              {produto.category && (
                <p style={{ fontSize: 12, color: "#4a7a9b", margin: "4px 0 0" }}>{produto.category}</p>
              )}
            </div>

            {fmtPreco(produto.price) && (
              <div style={{ fontSize: 28, fontWeight: 500, color: "#00d4ff" }}>
                {fmtPreco(produto.price)}
              </div>
            )}

            {produto.description && (
              <p style={{ fontSize: 13, color: "#4a7a9b", lineHeight: 1.6, margin: 0 }}>
                {produto.description}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: produto.emEstoque ? "#00c47a" : "#e24b4a",
              }} />
              <span style={{ fontSize: 12, color: produto.emEstoque ? "#00c47a" : "#e24b4a", fontWeight: 500 }}>
                {produto.emEstoque ? "Em estoque" : "Sem estoque"}
              </span>
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 8 }}>
              <a href={`https://almoxprov3.vercel.app/catalog`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#1b365d", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#e8f4ff", textDecoration: "none" }}>
                Ver na loja Tecshop
              </a>
              <a href="https://wa.me/5591986181270?text=Ol%C3%A1%21+Escaneei+um+QR+da+Tecgas+e+quero+conhecer+o+AlmoxPro!"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "rgba(0,196,122,0.1)", border: "0.5px solid rgba(0,196,122,0.25)", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#00c47a", textDecoration: "none" }}>
                Quero o AlmoxPro para minha empresa
              </a>
            </div>

            {/* Créditos */}
            <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: "#1b365d", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Desenvolvido por</div>
                <div style={{ fontSize: 11, color: "#4a7a9b", fontWeight: 500, marginTop: 2 }}>LevtheDev · Esdras Nunes</div>
              </div>
              <div style={{ fontSize: 9, color: "#1b365d", textAlign: "right", lineHeight: 1.6 }}>
                AlmoxPro &amp; Tecshop<br />Belém, PA · Brasil
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes p3d { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin3d { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
