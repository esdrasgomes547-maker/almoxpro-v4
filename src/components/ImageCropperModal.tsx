import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { 
  X, ZoomIn, RotateCw, Check, 
  RefreshCw, Sliders, Settings2
} from "lucide-react";

interface ImageCropperModalProps {
  imageSrc: string;
  fileName: string;
  onConfirm: (blob: Blob, format: string) => void;
  onCancel: () => void;
}

export function ImageCropperModal({ imageSrc, fileName, onConfirm, onCancel }: ImageCropperModalProps) {
  // Crop settings state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(1); // Default to 1:1 square
  const [exportFormat, setExportFormat] = useState<string>("image/png");
  const [exportWidth, setExportWidth] = useState<number>(400);
  
  // Interactive state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  // Local preview refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-resize / reset zoom depending on initial load
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPosX(0);
    setPosY(0);
  }, [imageSrc, aspectRatio]);

  // Wheel zoom effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => Math.min(4.0, Math.max(0.1, prev - e.deltaY * 0.003)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Handle Dragging
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - posX, y: clientY - posY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStart) return;
    setPosX(clientX - dragStart.x);
    setPosY(clientY - dragStart.y);
  };

  const handleEnd = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Utility to map formats
  const getFormatExtension = (format: string) => {
    if (format === "image/jpeg") return "jpg";
    if (format === "image/webp") return "webp";
    return "png";
  };

  // Generate cropped image using real canvas settings
  const generateCroppedBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        // Calculate crop area dimensions on the 260px screener container
        let w_crop = 260 * 0.7; // default 70%
        let h_crop = w_crop / aspectRatio;
        
        if (aspectRatio > 1) {
          w_crop = 260 * 0.9;
          h_crop = w_crop / aspectRatio;
        } else if (aspectRatio < 1) {
          h_crop = 260 * 0.9;
          w_crop = h_crop * aspectRatio;
        } else {
          w_crop = 260 * 0.7;
          h_crop = 260 * 0.7;
        }

        // Selected width
        const width = exportWidth;
        const height = width / aspectRatio;

        canvas.width = width;
        canvas.height = height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Underlay white for jpeg
        if (exportFormat === "image/jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
        }

        // Map screen dimensions to output canvas size
        const canvasScale = width / w_crop;

        ctx.save();
        // Translate center of canvas plus the translated position mapped to scale
        ctx.translate(width / 2 + posX * canvasScale, height / 2 + posY * canvasScale);
        
        // Execute rotation around the image's translated center
        ctx.rotate((rotation * Math.PI) / 180);

        // Calculate baseline rendered width/height on screen (with maxHeight/maxWidth of 80%)
        const s_base = 208 / Math.max(img.width, img.height);
        const w_render = img.width * s_base * zoom;
        const h_render = img.height * s_base * zoom;

        // Draw mapped to output size
        const w_draw = w_render * canvasScale;
        const h_draw = h_render * canvasScale;

        ctx.drawImage(img, -w_draw / 2, -h_draw / 2, w_draw, h_draw);
        ctx.restore();

        // Output blob
        canvas.toBlob(
          (blob) => resolve(blob),
          exportFormat,
          exportFormat === "image/png" ? undefined : 0.88
        );
      };
      img.src = imageSrc;
    });
  };

  // Real-time local preview refresh
  useEffect(() => {
    const updatePreview = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = 120;
        canvas.width = size;
        canvas.height = size / aspectRatio;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (exportFormat === "image/jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        let w_crop = 260 * 0.7;
        let h_crop = w_crop / aspectRatio;
        
        if (aspectRatio > 1) {
          w_crop = 260 * 0.9;
          h_crop = w_crop / aspectRatio;
        } else if (aspectRatio < 1) {
          h_crop = 260 * 0.9;
          w_crop = h_crop * aspectRatio;
        } else {
          w_crop = 260 * 0.7;
          h_crop = 260 * 0.7;
        }

        const canvasScale = size / w_crop;

        ctx.save();
        ctx.translate(size / 2 + posX * canvasScale, canvas.height / 2 + posY * canvasScale);
        ctx.rotate((rotation * Math.PI) / 180);

        const s_base = 208 / Math.max(img.width, img.height);
        const w_render = img.width * s_base * zoom;
        const h_render = img.height * s_base * zoom;

        const w_draw = w_render * canvasScale;
        const h_draw = h_render * canvasScale;

        ctx.drawImage(img, -w_draw / 2, -h_draw / 2, w_draw, h_draw);
        ctx.restore();
      };
      img.src = imageSrc;
    };

    const timer = setTimeout(updatePreview, 60);
    return () => clearTimeout(timer);
  }, [imageSrc, zoom, rotation, posX, posY, aspectRatio, exportFormat]);

  const triggerConfirm = async () => {
    const blob = await generateCroppedBlob();
    if (blob) {
      onConfirm(blob, exportFormat);
    } else {
      alert("Erro ao recortar imagem.");
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Interactive Arena / Workspace */}
        <div className="flex-1 bg-stone-900/95 p-6 flex flex-col items-center justify-center relative min-h-[340px] md:min-h-[440px] border-b md:border-b-0 md:border-r border-border select-none">
          <div className="absolute top-4 left-4 z-10 flex flex-col items-start">
            <span className="text-[10px] text-stone-400 font-mono tracking-widest uppercase">Workspace de Recorte</span>
            <span className="text-xs font-semibold text-white truncate max-w-[200px]" title={fileName}>
              {fileName}
            </span>
          </div>

          <button 
            type="button"
            onClick={() => {
              setZoom(1);
              setRotation(0);
              setPosX(0);
              setPosY(0);
            }} 
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-stone-800 text-stone-300 hover:text-white transition-all size-8 flex items-center justify-center cursor-pointer"
            title="Resetar Posição"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Interactive view container */}
          <div 
            ref={containerRef}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => {
              if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={handleEnd}
            className="relative w-[260px] h-[260px] bg-stone-950/80 rounded-lg overflow-hidden flex items-center justify-center cursor-move border border-stone-800 touch-none"
          >
            {/* Visual Crop Overlay (Foco Area) */}
            <div 
              style={{
                aspectRatio: aspectRatio || "1/1",
                width: aspectRatio && aspectRatio > 1 ? "90%" : "70%",
                height: aspectRatio && aspectRatio < 1 ? "90%" : undefined
              }}
              className="absolute pointer-events-none rounded border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] z-10 transition-all flex items-center justify-center"
            >
              <div className="absolute inset-0 border border-dashed border-white/40"></div>
              {/* Central crosshair */}
              <div className="w-4 h-[1px] bg-white/60 absolute"></div>
              <div className="h-4 w-[1px] bg-white/60 absolute"></div>
            </div>

            {/* Rotated & Translated Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Submeter para recorte"
              draggable={false}
              style={{
                transform: `translate(${posX}px, ${posY}px) rotate(${rotation}deg) scale(${zoom})`,
                maxHeight: "80%",
                maxWidth: "80%",
                transition: isDragging ? "none" : "transform 0.1s ease-out-quint"
              }}
              className="object-contain pointer-events-none"
            />
          </div>

          <p className="text-[10px] text-stone-400 mt-4 text-center">
            Arraste a imagem diretamente para posicionar ou use os controles laterais.
          </p>
        </div>

        {/* Right Configuration sidebar panel */}
        <div className="w-full md:w-[320px] bg-card p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Recortar & Formatar</h3>
              </div>
              <button 
                type="button"
                onClick={onCancel}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Live Cropped Preview */}
            <div className="bg-muted/40 p-3 rounded-lg border border-border flex items-center gap-3">
              <div className="h-[75px] w-[75px] rounded border border-border bg-stone-900 overflow-hidden flex items-center justify-center p-1 relative flex-shrink-0">
                <canvas ref={previewCanvasRef} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="text-left">
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Resultado Final</span>
                <h4 className="text-xs font-semibold text-foreground truncate max-w-[180px]">Logo da Empresa</h4>
                <p className="text-[10px] text-muted-foreground">Formato: .<b>{getFormatExtension(exportFormat)}</b> ({exportWidth}x{Math.round(aspectRatio ? exportWidth / aspectRatio : exportWidth)}px)</p>
              </div>
            </div>

            {/* Adjustments Section */}
            <div className="space-y-4">
              {/* Zoom slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Zoom ({zoom.toFixed(1)}x)</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.2))} className="p-0.5 border border-border bg-muted rounded hover:bg-muted/80 text-[10px] cursor-pointer">-</button>
                    <button type="button" onClick={() => setZoom(prev => Math.min(4.0, prev + 0.2))} className="p-0.5 border border-border bg-muted rounded hover:bg-muted/80 text-[10px] cursor-pointer">+</button>
                  </div>
                </div>
                <input 
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-ew-resize"
                />
              </div>

              {/* Rotation slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" /> Rotação ({rotation}°)</span>
                  <button type="button" onClick={() => setRotation(prev => (prev + 90) % 360)} className="text-[10px] text-primary font-bold cursor-pointer">+90°</button>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-ew-resize"
                />
              </div>

              {/* Proportion selection (Aspect Ratio) */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Proporção do Corte</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAspectRatio(1)}
                    className={`px-2 py-1.5 text-[10px] rounded border font-semibold text-center transition-all cursor-pointer ${aspectRatio === 1 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                  >
                    1:1 Quadrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio(1.33)}
                    className={`px-2 py-1.5 text-[10px] rounded border font-semibold text-center transition-all cursor-pointer ${aspectRatio === 1.33 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                  >
                    4:3 Retângulo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio(1.77)}
                    className={`px-2 py-1.5 text-[10px] rounded border font-semibold text-center transition-all cursor-pointer ${aspectRatio === 1.77 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                  >
                    16:9 Banner
                  </button>
                </div>
              </div>

              {/* Custom formats selector (png/jpeg/webp) as requested! */}
              <div className="space-y-1.5 border-t border-border pt-3">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Formato de Saída</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExportFormat("image/png")}
                    className={`px-2 py-1 text-[9px] rounded border font-bold uppercase transition-all cursor-pointer ${exportFormat === "image/png" ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("image/jpeg")}
                    className={`px-2 py-1 text-[9px] rounded border font-bold uppercase transition-all cursor-pointer ${exportFormat === "image/jpeg" ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    JPEG
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("image/webp")}
                    className={`px-2 py-1 text-[9px] rounded border font-bold uppercase transition-all cursor-pointer ${exportFormat === "image/webp" ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    WEBP
                  </button>
                </div>
              </div>

              {/* Output Resolution control */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Settings2 className="h-3 w-3" /> Resolução Recomendada</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExportWidth(200)}
                    className={`px-2 py-1.5 text-[9px] rounded border font-semibold transition-all cursor-pointer ${exportWidth === 200 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    Menor (200px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportWidth(400)}
                    className={`px-2 py-1.5 text-[9px] rounded border font-semibold transition-all cursor-pointer ${exportWidth === 400 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    Médio (400px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportWidth(800)}
                    className={`px-2 py-1.5 text-[9px] rounded border font-semibold transition-all cursor-pointer ${exportWidth === 800 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                  >
                    Nítido (800px)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-border flex flex-col gap-2 mt-4 md:mt-0">
            <Button
              type="button"
              onClick={triggerConfirm}
              className="w-full bg-primary hover:bg-primary/95 text-xs text-white font-bold h-9 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="h-4 w-4" /> Aplicar e Fazer Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full text-xs h-9 cursor-pointer"
            >
              Voltar / Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
