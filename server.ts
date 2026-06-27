import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import compression from "compression";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  // Helper robust de geração de conteúdo com suporte a múltiplos modelos, retentativas e backoff exponencial em caso de indisponibilidade ou limite de quota (503 / 429)
  async function generateContentWithFallback(ai: GoogleGenAI, configParams: { contents: any; config?: any; [key: string]: any }) {
    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite"
    ];
    let lastError: any = null;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const modelName of models) {
      let attempt = 0;
      const maxRetries = 3;
      let delay = 600;

      while (attempt < maxRetries) {
        attempt++;
        try {
          console.log(`[IA Robust Helper] Tentando gerar conteúdo usando o modelo: ${modelName} (Tentativa ${attempt}/${maxRetries})`);
          const response = await ai.models.generateContent({
            ...configParams,
            model: modelName
          });
          if (response && response.text) {
            console.log(`[IA Robust Helper] Sucesso com o modelo: ${modelName} na tentativa ${attempt}`);
            return response;
          }
        } catch (error: any) {
          lastError = error;
          const status = error.status || (error.message && error.message.includes("503") ? 503 : (error.message && error.message.includes("429") ? 429 : null));
          const isTemporary = status === 503 || status === 429 || error.message?.includes("UNAVAILABLE") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("high demand") || error.message?.includes("quota");
          
          console.warn(`[IA Robust Helper] Falha no modelo ${modelName} (Tentativa ${attempt}/${maxRetries}):`, error.message || error);
          
          if (isTemporary && attempt < maxRetries) {
            console.log(`[IA Robust Helper] Aguardando ${delay}ms antes de tentar novamente devido a congestionamento na rede...`);
            await sleep(delay);
            delay *= 2.5; // Backoff multiplicador de 2.5x para aliviar o congestionamento do servidor
          } else {
            // Se o erro for permanente (como erro de validação ou estrutura inválida) ou se acabaram as tentativas deste modelo, passa para o próximo modelo
            break;
          }
        }
      }
    }
    
    throw lastError || new Error("Todos os modelos de Inteligência Artificial do Gemini estão temporariamente sobrecarregados. Por favor, aguarde alguns instantes antes de reenviar o documento.");
  }

  // Middlewares
  app.use(compression());
  app.use(express.json({ limit: "50mb" }));
  app.use(cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));

  // Log de todas as requisições
  app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
  });

  // ====================== GEMINI API ROUTES ======================

  app.post("/api/gemini/parse-spreadsheet", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    try {
      const { headers, sampleRow, targetKeys } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const keysDescription = targetKeys 
        ? targetKeys.map((k: any) => `- ${k.key} (${k.description})`).join('\n')
        : `- name (nome do produto)\n- category (categoria)\n- quantity (estoque atual)\n- minStock (estoque mínimo)\n- price (preço de venda)`;

      const prompt = `
        Analise os cabeçalhos e uma linha de exemplo de uma planilha.
        Cabeçalhos: ${JSON.stringify(headers)}
        Exemplo: ${JSON.stringify(sampleRow)}

        Mapeie esses campos para as seguintes chaves do nosso sistema:
        ${keysDescription}

        Retorne APENAS um JSON plano com o mapeamento, onde a chave é a nossa (ex: "name") e o valor é o nome exato da coluna da planilha (ex: "PRODUTO_NOME").
        Se não encontrar um correspondente óbvio para uma chave, retorne string vazia para o valor dessa chave.
      `;

      const response = await generateContentWithFallback(ai, {
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "";
      const mapping = JSON.parse(text.trim());
      res.json(mapping);
    } catch (error: any) {
      console.error("Spreadsheet mapping error:", error);
      res.status(500).json({ error: "Falha ao processar mapeamento", details: error.message });
    }
  });

  app.post("/api/gemini/settings-assist", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    try {
      const { action, businessSegment, tone, currentText, prompt } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      if (action === "suggest") {
        const promptText = `
          Você é um especialista em branding de marcas e administração corporativa.
          Sugira informações de configuração ideais para um almoxarifado/sistema de gestão de uma empresa do setor: "${businessSegment}" com tom de comunicação "${tone || "Profissional"}".

          Gere:
          1. Um nome de empresa fictício excelente e realista fictício adequado para esse ramo.
          2. Uma saudação personalizada curta para o topo do painel (ex: "Boas-vindas ao hub logístico da MetalSul! ⚙️").
          3. Uma mensagem de boas-vindas motivacional e prática para todos os colaboradores do almoxarifado (ex: "Organização é o segredo do sucesso. Vamos movimentar cargas com segurança hoje!").
          4. Um e-mail de contato corporativo fictício combinando com o nome gerado (ex: "suporte@metalsul.com").
          5. Um telefone corporativo (ex: "(11) 3214-5555").
          6. Um CNPJ fictício formatado de forma válida (ex: "82.491.597/0001-08").

          Retorne obrigatoriamente no formato JSON plano com as chaves: companyName, customGreeting, welcomeMessage, email, phone, cnpj.
        `;

        const response = await generateContentWithFallback(ai, {
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                companyName: { type: "STRING" },
                customGreeting: { type: "STRING" },
                welcomeMessage: { type: "STRING" },
                email: { type: "STRING" },
                phone: { type: "STRING" },
                cnpj: { type: "STRING" }
              },
              required: ["companyName", "customGreeting", "welcomeMessage", "email", "phone", "cnpj"]
            }
          }
        });

        const mapping = JSON.parse((response.text || "{}").trim());
        return res.json(mapping);
      } else if (action === "refine") {
        const promptText = `
          Você é um assistente de redação corporativa profissional.
          Sua tarefa é reescrever ou aprimorar o seguinte texto de saudação/boas-vindas do sistema de gestão:
          Texto atual: "${currentText}"
          Instrução/Objetivo do usuário: "${prompt}"

          Conserve a brevidade (máximo de 150 caracteres para saudações ou 300 caracteres para mensagens de boas-vindas). 
          Torne o texto marcante, amigável ou focado em metas e segurança operacional, dependendo da instrução.

          Retorne no formato JSON plano com a chave: refinedText.
        `;

        const response = await generateContentWithFallback(ai, {
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                refinedText: { type: "STRING" }
              },
              required: ["refinedText"]
            }
          }
        });

        const mapping = JSON.parse((response.text || "{}").trim());
        return res.json(mapping);
      } else {
        return res.status(400).json({ error: "Ação não suportada" });
      }
    } catch (error: any) {
      console.error("Settings assistant error:", error);
      res.status(500).json({ error: "Falha ao processar assistência de IA", details: error.message });
    }
  });

  app.post("/api/gemini/analyze-services", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada na plataforma." });
    }

    try {
      const { textContent, fileData, mimeType, optionalPrompt } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const contents: any[] = [];
      const systemInstruction = `
        Você é um assistente de IA especialista em análise de documentos de engenharia, construção, logística, manutenção e orçamentos para a plataforma AlmoxPro.
        Sua tarefa é analisar o documento fornecido (pode ser texto brutas, relatórios de serviços, ordens laboratoriais ou de campo, contratos, faturas, folhas de medição ou imagens de notas) e IDENTIFICAR ou deduzir serviços técnicos aplicáveis para registrar no catálogo de serviços da empresa.
        
        Siga rigorosamente estas regras:
        1. Identifique os serviços prestados, mão de obra, supervisão, projetos, consultorias, instalações, vistorias, laudos ou reparos expressos ou requeridos no documento.
        2. Mapeie cada item encontrado para a estrutura JSON descrita no responseSchema:
           - "name": Nome claro, descritivo e profissional (em português). Ex: "Substituição de Atuador Pneumático de 2\"" ou "Laudo de Inspeção NR-13 para Caldeiras".
           - "category": Escolha rigorosamente uma destas categorias padrão da plataforma AlmoxPro: "Instalação", "Manutenção", "Consultoria", "Vistoria", "Reparo". Se não bater perfeitamente, use o bom senso corporativo para obter a melhor correlação técnica.
           - "basePrice": Se houver indicação de preço unitário ou estimado no documento, extraia esse valor numérico. Caso contrário, estime um valor razoável para o mercado brasileiro de serviços industriais / de reparo ou use um padrão fictício realista (ou retorne 0 se impossível inferir).
           - "unit": Unidade padrão de faturamento. Ex: "unid", "hora", "m2", "ponto", "km", "dia", "folha", etc.
           - "description": Descrição técnica precisa e objetiva sobre o escopo do serviço, ferramentas envolvidas, profissionais recomendados, ou observações gerais do documento.
        3. No campo "documentSummary", escreva um breve parágrafo descrevendo do que se trata o documento analisado, sua relevância e visão geral das principais atividades extraídas.
      `;

      let userPrompt = "Analise o seguinte arquivo/texto e retorne a lista de serviços identificados:";
      if (optionalPrompt) {
        userPrompt += `\nInstrução adicional do usuário: "${optionalPrompt}"`;
      }

      const parts: any[] = [{ text: userPrompt }];

      if (fileData && mimeType) {
        const lowerMime = mimeType.toLowerCase();
        // Only push to inlineData if it is a fully supported multimodal format
        if (lowerMime.startsWith("image/") || lowerMime === "application/pdf") {
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: fileData
            }
          });
        } else {
          console.warn(`[Backend Alert] MIME type '${mimeType}' ignora inlineData para evitar 400 Bad Request. Usando textContent.`);
        }
      }

      if (textContent) {
        parts.push({ text: `Texto/Metadados adicionados:\n${textContent}` });
      }

      contents.push({ parts });

      const response = await generateContentWithFallback(ai, {
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              services: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    category: { type: "STRING" },
                    basePrice: { type: "NUMBER" },
                    unit: { type: "STRING" },
                    description: { type: "STRING" }
                  },
                  required: ["name", "category", "basePrice", "unit", "description"]
                }
              },
              documentSummary: { type: "STRING" }
            },
            required: ["services", "documentSummary"]
          }
        }
      });

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText.trim());
      res.json(resultObj);
    } catch (error: any) {
      console.error("AI Services Analysis Error:", error);
      res.status(500).json({ error: "Falha na análise de IA", details: error.message });
    }
  });



  app.post("/api/gemini/scan-code", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    try {
      const { fileData, mimeType } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `
        Você é um scanner de códigos de barras e QR codes de alta precisão.
        Sua única tarefa é detectar e extrair qualquer código de barras (EAN, UPC, etc.) ou QR code presente na imagem fornecida.
        Retorne APENAS o código detectado como texto puro (sem formatação, sem frases extras).
        Se NÃO houver nenhum código detectável, retorne estritamente: "NOT_FOUND"
      `;

      const response = await generateContentWithFallback(ai, {
        contents: [{
          parts: [
            { text: "Extraia o código de barras ou QR code desta imagem:" },
            {
              inlineData: {
                mimeType: mimeType,
                data: fileData
              }
            }
          ]
        }],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1 // Baixa temperatura para precisão
        }
      });

      const decodedText = (response.text || "").trim();
      res.json({ decodedText });
    } catch (error: any) {
      console.error("AI Scanner error:", error);
      res.status(500).json({ error: "Erro ao processar imagem", details: error.message });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    try {
      const { history, texto, contexto } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const contents = [
        { role: "user", parts: [{ text: contexto }] },
        { role: "model", parts: [{ text: "Entendido. Estou pronto para ajudar com o estoque." }] },
        ...(history || []),
        { role: "user", parts: [{ text: texto }] }
      ];

      const response = await generateContentWithFallback(ai, {
        contents
      });

      const resposta = response.text || "Sem resposta.";
      res.json({ resposta });
    } catch (error: any) {
      console.error("Agent chat error:", error);
      res.status(500).json({ error: "Erro no chat de IA", details: error.message });
    }
  });

  app.post("/api/gemini/summarize-inconsistencies", async (req, res) => {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    try {
      const { top5String } = req.body;
      const ai = new GoogleGenAI({ 
        apiKey: GEMINI_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await generateContentWithFallback(ai, {
        contents: [{ parts: [{ text: `Você é o Pro, assistente do AlmoxPro. Em 2 frases diretas e profissionais, resuma estas inconsistências do estoque industrial:\n${top5String}` }] }]
      });

      res.json({ resumo: response.text || "" });
    } catch (error: any) {
      console.error("Inconsistencies summary error:", error);
      res.status(500).json({ error: "Falha ao gerar resumo de inconsistências", details: error.message });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // ====================== FRONTEND ======================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Almox Pro rodando na porta ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
