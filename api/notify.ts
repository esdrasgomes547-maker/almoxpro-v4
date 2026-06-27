import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Básico
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

  const { assunto, mensagem } = req.body || {};

  if (!assunto || !mensagem) {
    res.status(400).json({ erro: "Os campos 'assunto' e 'mensagem' são obrigatórios." });
    return;
  }

  let telegramStatus = "skip";
  let emailStatus = "skip";

  // --- TELEGRAM ---
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChats = process.env.TELEGRAM_CHAT_IDS;

  if (tgToken && tgChats) {
    try {
      const chatIds = tgChats.split(",").map(id => id.trim()).filter(id => id);
      
      const promises = chatIds.map(chatId => 
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `*${assunto}*\n\n${mensagem}`,
            parse_mode: "Markdown"
          })
        })
      );
      
      const results = await Promise.all(promises);
      const hasError = results.some(r => !r.ok);
      
      if (hasError) {
        telegramStatus = "erro: falha ao enviar para um ou mais chats";
      } else {
        telegramStatus = "ok";
      }
    } catch (e: any) {
      telegramStatus = `erro: ${e.message}`;
    }
  }

  // --- EMAIL (RESEND) ---
  const resendKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  const mailTo = process.env.MAIL_TO;

  if (resendKey && mailFrom && mailTo) {
    try {
      const toAddresses = mailTo.split(",").map(e => e.trim()).filter(e => e);
      
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: mailFrom,
          to: toAddresses,
          subject: assunto,
          text: mensagem
        })
      });
      
      if (!resp.ok) {
        const errText = await resp.text();
        emailStatus = `erro: ${resp.status} - ${errText}`;
      } else {
        emailStatus = "ok";
      }
    } catch (e: any) {
      emailStatus = `erro: ${e.message}`;
    }
  }

  res.status(200).json({
    telegram: telegramStatus,
    email: emailStatus
  });
}
