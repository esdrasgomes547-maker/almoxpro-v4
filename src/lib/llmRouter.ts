// src/lib/llmRouter.ts
// Roteador LLM: Somente Gemini

export type TarefaLLM =
  | "chat_rapido"        // Pro respondendo perguntas simples
  | "analise_estoque"    // Análise de inconsistências
  | "resumo_alerta"      // Resumo corporativo de alertas
  | "contexto_longo";    // Contexto grande (inventário completo)

export interface MensagemLLM {
  role: "system" | "user" | "assistant";
  content?: string;
  texto?: string;
  parts?: any[];
}

export interface RespostaLLM {
  texto: string;
  modelo: string;
  provider: "gemini" | "fallback";
}

interface ImagemParams {
  base64: string;
  mimeType: string;
}

export async function chamarGeminiBackend({ 
  mensagens, 
  imagem 
}: { 
  mensagens: any[], 
  imagem?: ImagemParams 
}): Promise<string> {
  // FALLBACK DE DEV: Chama Gemini direto no client
  if (import.meta.env.DEV) {
    const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!GEMINI_KEY) throw new Error("VITE_GEMINI_API_KEY não configurada no ambiente de DEV.");
    
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    
    let contents = mensagens.map((msg: any) => {
      let parts = [];
      if (msg.parts) {
        parts = msg.parts;
      } else if (msg.text || msg.texto || msg.content) {
        parts = [{ text: msg.text || msg.texto || msg.content }];
      } else if (typeof msg === "string") {
        parts = [{ text: msg }];
      } else {
        parts = [{ text: JSON.stringify(msg) }];
      }
      
      return {
        role: msg.role === "assistant" ? "model" : (msg.role || "user"),
        parts,
      };
    });

    if (contents.length === 0 && mensagens.length === 0 && imagem) {
      contents = [{ role: "user", parts: [] }];
    }

    if (imagem) {
      const imagePart = {
        inlineData: { mimeType: imagem.mimeType, data: imagem.base64 }
      };
      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts.unshift(imagePart);
      } else {
        contents.push({ role: "user", parts: [imagePart] });
      }
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents,
      config: { temperature: 0.2 },
    });
    
    return response.text?.trim() ?? "";
  }
  
  // PRODUÇÃO: Chama backend Serverless
  const url = import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/api/gemini` : "/api/gemini";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensagens, imagem }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    const error: any = new Error(data.erro || "Erro na API Gemini");
    error.status = data.status || resp.status;
    throw error;
  }

  return data.texto;
}

// Função legada adaptada
export async function chamarLLM(
  mensagens: MensagemLLM[],
  _tarefa: TarefaLLM = "chat_rapido"
): Promise<RespostaLLM> {
  try {
    const texto = await chamarGeminiBackend({ mensagens });
    return { texto, modelo: "gemini-2.0-flash", provider: "gemini" };
  } catch (e: any) {
    console.warn("[LLM] Gemini falhou:", e);
    return {
      texto: `Serviço de IA temporariamente indisponível. Detalhe: ${e.message}`,
      modelo: "fallback",
      provider: "fallback",
    };
  }
}

// Helper para o Pro chat
export function montarMensagensChat(
  systemPrompt: string,
  historico: { role: "user" | "assistant"; content: string }[],
  novaMensagem: string
): MensagemLLM[] {
  return [
    { role: "system", content: systemPrompt },
    ...historico,
    { role: "user", content: novaMensagem },
  ];
}
