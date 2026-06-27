import { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuração básica de CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ erro: "Método não permitido. Use POST." });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    res.status(500).json({ erro: "GEMINI_API_KEY ausente no servidor" });
    return;
  }

  try {
    const { mensagens, imagem } = req.body;
    
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    let contents: any[] = [];

    if (mensagens && Array.isArray(mensagens)) {
      contents = mensagens.map((msg: any) => {
        let parts = [];
        if (msg.parts) {
          parts = msg.parts;
        } else if (msg.text || msg.texto) {
          parts = [{ text: msg.text || msg.texto }];
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
    } else if (mensagens && typeof mensagens === "string") {
      contents = [{ role: "user", parts: [{ text: mensagens }] }];
    } else if (mensagens) {
      contents = [{ role: "user", parts: [{ text: JSON.stringify(mensagens) }] }];
    }

    if (contents.length === 0 && !imagem) {
       res.status(400).json({ erro: "É necessário fornecer 'mensagens' ou 'imagem'." });
       return;
    }

    // Se houver imagem, anexa à última mensagem do usuário ou cria uma nova
    if (imagem && imagem.base64 && imagem.mimeType) {
      const imagePart = {
        inlineData: {
          mimeType: imagem.mimeType,
          data: imagem.base64,
        },
      };

      if (contents.length > 0 && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts.unshift(imagePart);
      } else {
        contents.push({
          role: "user",
          parts: [imagePart],
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents,
      config: {
        temperature: 0.2,
      },
    });

    const texto = response.text?.trim() ?? "";

    res.status(200).json({ texto });
  } catch (error: any) {
    console.error("Erro na API Gemini:", error);
    const status = error?.status || 500;
    const mensagemErro = error?.message || "Erro interno no servidor ao processar a requisição";
    res.status(status).json({ erro: mensagemErro, status });
  }
}
