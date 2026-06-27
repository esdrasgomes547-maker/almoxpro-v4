import { useState, useRef, useEffect } from "react";
import { montarContexto } from "../lib/agentContext";
import { useOrganization } from "../lib/tenant";
import { Send, X, Minimize2, Maximize2, Loader2, ChevronRight, Camera, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

import { chamarLLM, montarMensagensChat } from "../lib/llmRouter";

// Ícone Pro — robô industrial com olhos que seguem o mouse
function ProIcon({ size = 56 }: { size?: number }) {
  const [pupila, setPupila] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mover = (x: number, y: number) => {
      if (!iconRef.current) return;
      const rect = iconRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 120;
      if (dist < maxDist) {
        const fator = Math.min(dist / maxDist, 1) * 1.8;
        setPupila({ x: (dx / dist) * fator, y: (dy / dist) * fator });
      } else {
        setPupila({ x: 0, y: 0 });
      }
    };

    const handleMouse = (e: MouseEvent) => mover(e.clientX, e.clientY);
    const handleTouch = (e: TouchEvent) => {
      if (e.touches[0]) mover(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = () => setPupila({ x: 0, y: 0 });

    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return (
    <div ref={iconRef} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#2a4a7a" />
            <stop offset="100%" stopColor="#0d1f3c" />
          </radialGradient>
          <radialGradient id="eyeGlowL" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#0066aa" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="eyeGlowR" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#0066aa" stopOpacity="0.3" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowStrong">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a6fa5" />
            <stop offset="50%" stopColor="#1b365d" />
            <stop offset="100%" stopColor="#0d1f3c" />
          </linearGradient>
          <linearGradient id="antennaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#1b365d" />
          </linearGradient>
        </defs>

        {/* Antena */}
        <line x1="28" y1="4" x2="28" y2="11" stroke="url(#antennaGrad)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="28" cy="3.5" r="2" fill="#00d4ff" filter="url(#glowStrong)">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Corpo da cabeça — hexágono arredondado */}
        <path
          d="M28 10 L44 19 L44 37 L28 46 L12 37 L12 19 Z"
          fill="url(#bodyGrad)"
          stroke="#2a4a7a"
          strokeWidth="1.5"
        />

        {/* Placa metálica frente */}
        <path
          d="M28 13 L41 20.5 L41 35.5 L28 43 L15 35.5 L15 20.5 Z"
          fill="url(#metalGrad)"
          stroke="#4a6fa5"
          strokeWidth="0.75"
          opacity="0.6"
        />

        {/* Parafusos nos cantos */}
        {[[16.5, 21.5], [39.5, 21.5], [16.5, 34.5], [39.5, 34.5]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.2" fill="#4a6fa5" stroke="#2a4a7a" strokeWidth="0.5" />
        ))}

        {/* Olho esquerdo — socket */}
        <ellipse cx="21" cy="27" rx="5" ry="5" fill="#050f1e" stroke="#00aadd" strokeWidth="1" />
        {/* Íris esquerda */}
        <circle cx="21" cy="27" r="3.5" fill="url(#eyeGlowL)" opacity="0.9" filter="url(#glow)" />
        {/* Pupila esquerda — segue o mouse */}
        <circle
          cx={21 + pupila.x}
          cy={27 + pupila.y}
          r="1.8"
          fill="#001122"
        />
        {/* Brilho olho esquerdo */}
        <circle cx={20 + pupila.x * 0.5} cy={25.5 + pupila.y * 0.5} r="0.7" fill="white" opacity="0.9" />

        {/* Olho direito — socket */}
        <ellipse cx="35" cy="27" rx="5" ry="5" fill="#050f1e" stroke="#00aadd" strokeWidth="1" />
        {/* Íris direita */}
        <circle cx="35" cy="27" r="3.5" fill="url(#eyeGlowR)" opacity="0.9" filter="url(#glow)" />
        {/* Pupila direita — segue o mouse */}
        <circle
          cx={35 + pupila.x}
          cy={27 + pupila.y}
          r="1.8"
          fill="#001122"
        />
        {/* Brilho olho direito */}
        <circle cx={34 + pupila.x * 0.5} cy={25.5 + pupila.y * 0.5} r="0.7" fill="white" opacity="0.9" />

        {/* Boca — grade de ventilação */}
        <rect x="21" y="35" width="14" height="4" rx="2" fill="#050f1e" stroke="#2a4a7a" strokeWidth="0.75" />
        {[23, 26, 29, 32].map((x, i) => (
          <line key={i} x1={x} y1="35.5" x2={x} y2="38.5" stroke="#00aadd" strokeWidth="0.75" opacity="0.6" />
        ))}

        {/* Linhas de circuito decorativas */}
        <path d="M15 27 L18 27" stroke="#00aadd" strokeWidth="0.75" opacity="0.4" />
        <path d="M38 27 L41 27" stroke="#00aadd" strokeWidth="0.75" opacity="0.4" />
        <path d="M28 13 L28 16" stroke="#00aadd" strokeWidth="0.75" opacity="0.4" />

        {/* Indicador de status — pisca */}
        <circle cx="28" cy="42.5" r="1.5" fill="#00d4ff" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

interface Mensagem {
  role: "user" | "agent";
  texto: string;
  timestamp: Date;
}

// Renderiza markdown simples (negrito, listas com →)
function renderTexto(texto: string) {
  const linhas = texto.split("\n");
  return linhas.map((linha, i) => {
    // Negrito
    const comNegrito = linha.split(/\*\*(.*?)\*\*/g).map((parte, j) =>
      j % 2 === 1 ? <strong key={j} className="font-bold text-[hsl(var(--foreground))]">{parte}</strong> : parte
    );
    // Linha com →
    if (linha.trim().startsWith("→")) {
      return (
        <div key={i} className="flex items-start gap-2 py-1 px-3 rounded-lg bg-[hsl(var(--muted)/0.5)] my-0.5">
          <span className="text-[hsl(var(--primary))] font-bold mt-0.5 flex-shrink-0">→</span>
          <span>{comNegrito.slice(1)}</span>
        </div>
      );
    }
    // Linha vazia
    if (!linha.trim()) return <div key={i} className="h-2" />;
    // Linha normal
    return <p key={i} className="leading-relaxed">{comNegrito}</p>;
  });
}

const SUGESTOES = [
  "O que está crítico agora?",
  "Quem tem peças em campo?",
  "Meu melhor fornecedor?",
  "Resumo do estoque hoje",
];

export function AgentChat() {
  const { orgId } = useOrganization();
  const [aberto, setAberto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([{
    role: "agent",
    texto: "Olá. Sou o **Pro** — seu assistente de estoque industrial.\n\nEstou conectado ao seu inventário em tempo real. Como posso ajudar?",
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [contexto, setContexto] = useState("");
  const [carregandoCtx, setCarregandoCtx] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado para imagem anexada
  const [imagemAnexada, setImagemAnexada] = useState<string | null>(null); // base64
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para áudio via Whisper
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcreverEProcessar(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
    } catch (e: any) {
      toast.error("Microfone indisponível: " + e.message);
    }
  };

  const pararGravacao = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setGravando(false);
  };

  const transcreverEProcessar = async (blob: Blob) => {
    setCarregando(true);
    try {
      const { chamarGeminiBackend } = await import("../lib/llmRouter");
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
      });

      const respostaTexto = await chamarGeminiBackend({
        mensagens: [
          { role: "user", text: "Transcreva este áudio em português. Retorne APENAS o texto transcrito, sem aspas e sem explicações." }
        ],
        imagem: { mimeType: "audio/webm", base64: base64Audio } // reutilizamos o campo imagem para passar o audio em base64 com inlineData
      });

      const textoTranscrito = respostaTexto?.trim() ?? "";

      if (!textoTranscrito) {
        toast.error("Não entendi o áudio. Tente novamente.");
        return;
      }

      // Mostra o que foi transcrito
      setMensagens(prev => [...prev, {
        role: "user",
        texto: `🎤 "${textoTranscrito}"`,
        timestamp: new Date(),
      }]);

      // Processa com contexto do inventário via Groq
      const promptContextual = `${contexto}

O usuário enviou uma mensagem de voz que foi transcrita como:
"${textoTranscrito}"

INSTRUÇÕES CRÍTICAS:
1. Interprete a intenção mesmo que o nome da peça não seja exato
   Exemplo: "válvula de meia" = buscar no catálogo por válvula 1/2"
   Exemplo: "tubo fino" = buscar por tubos de menor diâmetro
2. Se identificar uma movimentação (saída, retorno, entrada), extraia:
   - Produto (tente identificar pelo contexto)
   - Quantidade (se mencionada, senão pergunte)
   - Responsável/funcionário (se mencionado)
   - Destino/serviço (se mencionado)
3. SEMPRE confirme antes de registrar: mostre o que entendeu e pergunte se está correto
4. Se não entendeu, peça esclarecimento específico
5. Seja direto e profissional — máximo 3 linhas na resposta

Responda em português, sem emojis.`;

      const resultado = await chamarLLM([
        { role: "system", content: promptContextual },
        { role: "user", content: textoTranscrito },
      ], "chat_rapido");

      setMensagens(prev => [...prev, {
        role: "agent",
        texto: resultado.texto,
        timestamp: new Date(),
      }]);

    } catch (e: any) {
      console.error("[Pro Audio]", e);
      toast.error("Erro ao processar áudio: " + e.message);
    } finally {
      setCarregando(false);
    }
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setImagemAnexada(base64);
    };
    reader.readAsDataURL(file);
  };

  // Estado de posição do botão
  const [pos, setPos] = useState({ x: 16, y: 96 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, btnX: 0, btnY: 0 });
  const btnRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  // Salva posição no localStorage pra persistir entre sessões
  useEffect(() => {
    const saved = localStorage.getItem('@almoxpro-pro-pos');
    if (saved) setPos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      const newX = Math.max(8, Math.min(window.innerWidth - 56, dragStart.current.btnX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 56, dragStart.current.btnY + dy));
      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      setDragging(false);
      localStorage.setItem('@almoxpro-pro-pos', JSON.stringify(pos));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, pos]);

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    hasMoved.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { mouseX: clientX, mouseY: clientY, btnX: pos.x, btnY: pos.y };
    setDragging(true);
  };

  const onClick = () => {
    if (hasMoved.current) return; // não abre se arrastou
    setAberto(true);
  };

  useEffect(() => {
    if (aberto && orgId && !contexto) {
      setCarregandoCtx(true);
      montarContexto(orgId)
        .then(setContexto)
        .catch(console.error)
        .finally(() => setCarregandoCtx(false));
    }
  }, [aberto, orgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  useEffect(() => {
    if (aberto && !minimizado) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aberto, minimizado]);

  const enviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? input).trim();
    if ((!texto && !imagemAnexada) || carregando || !contexto) return;
    setInput("");
    
    const fotoAtual = imagemAnexada;
    setImagemAnexada(null);
    
    const msgUsuario = texto || "Analise esta peça do meu estoque";
    setMensagens(prev => [...prev, {
      role: "user",
      texto: msgUsuario + (fotoAtual ? " [foto anexada]" : ""),
      timestamp: new Date(),
    }]);
    setCarregando(true);

    try {
      let resposta = "";
      const { chamarGeminiBackend } = await import("../lib/llmRouter");

      if (fotoAtual) {
        const promptText = `${contexto}\n\nO usuário enviou uma foto de uma peça industrial e perguntou: "${msgUsuario}"\n\nINSTRUÇÕES CRÍTICAS:\n1. Analise a imagem com atenção: identifique tipo de peça, material, dimensões aparentes, conexões\n2. Compare com TODOS os itens do catálogo do estoque acima\n3. Mesmo se o nome no estoque for diferente do nome comum da peça, identifique pela função e tipo\n   Exemplo: "registro de gás 1/2 polegada" pode estar como "Válvula Esfera GLP 1/2""\n   Exemplo: "joelho 90 graus" pode estar como "Cotovelo 90G PVC 1/2""\n4. Responda no formato:\n   - O que vejo: [descrição clara da peça]\n   - Encontrado no estoque: [SKU] - [Nome] ([quantidade] disponíveis)\n   - Confiança: Alta/Média/Baixa\n   - Sugestão: Pergunte se quer registrar saída\n5. Se não tiver certeza, liste 2-3 candidatos mais prováveis\n6. Se realmente não encontrar, sugira cadastrar como novo item\n7. Seja direto, profissional, sem emojis. Resposta em português.`;

        resposta = await chamarGeminiBackend({
          mensagens: [{ role: "user", text: promptText }],
          imagem: { mimeType: "image/jpeg", base64: fotoAtual }
        });
      } else {
        const msgs = montarMensagensChat(
          contexto,
          mensagens.slice(1).map(m => ({
            role: m.role === "agent" ? "assistant" : "user",
            content: m.texto,
          })),
          texto
        );
        const resultado = await chamarLLM(msgs, "chat_rapido");
        resposta = resultado.texto;
      }

      setMensagens(prev => [...prev, {
        role: "agent",
        texto: resposta,
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      console.error(e);
      let erroMsg = "Erro ao processar a requisição.";
      if (e.message && (e.message.includes("não configurada") || e.message.includes("GEMINI_API_KEY"))) {
        erroMsg = "A chave da API Gemini não está configurada neste ambiente.";
      } else {
        erroMsg = `Falha na API Gemini: ${e.status ? `[HTTP ${e.status}] ` : ""}${e.message || JSON.stringify(e)}`;
      }
      
      setMensagens(prev => [...prev, {
        role: "agent",
        texto: erroMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      {/* Botão flutuante premium */}
      {!aberto && (
        <div
          ref={btnRef}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          onClick={onClick}
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            zIndex: 50,
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#1b365d] to-[#0d1f3c] shadow-lg shadow-[#00d4ff]/20 border border-[#2a4a7a] flex items-center justify-center hover:scale-105 transition-transform">
            <ProIcon size={36} />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00d4ff] rounded-full border-2 border-[hsl(var(--background))]">
              <div className="w-full h-full rounded-full bg-[#00d4ff] animate-ping opacity-75" />
            </div>
          </div>
        </div>
      )}

      {/* Janela do chat */}
      {aberto && (
        <div className={`fixed bottom-24 right-4 z-50 w-[360px] flex flex-col rounded-2xl border border-[hsl(var(--border))] shadow-2xl shadow-black/20 overflow-hidden transition-all duration-300 ${minimizado ? "h-14" : "h-[520px]"}`}
          style={{ background: "hsl(var(--card))" }}>

          {/* Header com gradiente */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(196,100%,35%) 100%)" }}>
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <ProIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white tracking-wide">Pro</p>
              <p className="text-xs text-white/70 flex items-center gap-1.5">
                {carregandoCtx ? (
                  <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Carregando estoque...</>
                ) : (
                  <><span className="w-1.5 h-1.5 bg-[#378add]/10 rounded-full inline-block" /> Conectado ao inventário</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimizado(m => !m)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                {minimizado ? <Maximize2 className="w-3.5 h-3.5 text-white" /> : <Minimize2 className="w-3.5 h-3.5 text-white" />}
              </button>
              <button onClick={() => setAberto(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!minimizado && (
            <>
              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {mensagens.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "agent" && (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(196,100%,35%)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ProIcon size={14} />
                      </div>
                    )}
                    <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--primary))] text-white rounded-br-sm"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-bl-sm"
                    }`}>
                      {msg.role === "agent" ? renderTexto(msg.texto) : msg.texto}
                    </div>
                  </div>
                ))}

                {carregando && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(196,100%,35%)] flex items-center justify-center flex-shrink-0">
                      <ProIcon size={14} />
                    </div>
                    <div className="bg-[hsl(var(--muted))] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 bg-[hsl(var(--primary))] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Sugestões rápidas */}
              {mensagens.length === 1 && !carregandoCtx && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                  {SUGESTOES.map(s => (
                    <button key={s} onClick={() => enviar(s)}
                      className="flex items-center gap-1.5 text-left text-xs bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] px-3 py-2 rounded-xl transition-colors border border-transparent hover:border-[hsl(var(--border))]">
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ padding: "0" }}>
                {/* Preview da imagem anexada */}
                {imagemAnexada && (
                  <div style={{ padding: "8px 16px 0", position: "relative", display: "inline-block" }}>
                    <img src={`data:image/jpeg;base64,${imagemAnexada}`} alt="peça"
                      style={{ height: 60, borderRadius: 8, border: "0.5px solid rgba(0,212,255,0.2)", objectFit: "cover" }} />
                    <button onClick={() => setImagemAnexada(null)}
                      style={{ position: "absolute", top: 4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#e24b4a", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                )}

                {/* Input row */}
                <div style={{ display: "flex", gap: 8, padding: "8px 16px 16px" }}>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                    onChange={handleFoto} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#4a7a9b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Camera style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    onMouseDown={iniciarGravacao}
                    onMouseUp={pararGravacao}
                    onTouchStart={iniciarGravacao}
                    onTouchEnd={pararGravacao}
                    style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: gravando ? "rgba(226,75,74,0.15)" : "rgba(255,255,255,0.04)",
                      border: `0.5px solid ${gravando ? "rgba(226,75,74,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: gravando ? "#e24b4a" : "#4a7a9b",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      animation: gravando ? "pulseMic 1s ease infinite" : "none",
                      transition: "all 0.2s",
                    }}>
                    {gravando ? <MicOff style={{ width: 18, height: 18 }} /> : <Mic style={{ width: 18, height: 18 }} />}
                  </button>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
                    placeholder={carregandoCtx ? "Carregando estoque..." : "Pergunte ao Pro..."}
                    disabled={carregando || carregandoCtx}
                    className="flex-1 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors disabled:opacity-50 placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                  <button onClick={() => enviar()}
                    disabled={carregando || (!input.trim() && !imagemAnexada) || carregandoCtx}
                    className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(196,100%,35%)] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shadow-sm flex-shrink-0">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <style>{`
        @keyframes pulseMic { 0%,100%{box-shadow:0 0 0 0 rgba(226,75,74,0.4)} 50%{box-shadow:0 0 0 6px rgba(226,75,74,0)} }
      `}</style>
    </>
  );
}

