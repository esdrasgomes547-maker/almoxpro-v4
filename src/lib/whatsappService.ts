import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface WhatsAppConfig {
  numero: string;
  apiKey: string;
  ativo: boolean;
}

export async function getWhatsAppConfig(orgId: string): Promise<WhatsAppConfig | null> {
  try {
    const snap = await getDoc(doc(db, `organizations/${orgId}/settings`, "default"));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.whatsappNumero || !data.whatsappApiKey || !data.whatsappAtivo) return null;
    return {
      numero: data.whatsappNumero.replace(/\D/g, ""),
      apiKey: data.whatsappApiKey.trim(),
      ativo: data.whatsappAtivo === true,
    };
  } catch { return null; }
}

export async function enviarWhatsApp(
  orgId: string,
  mensagem: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const config = await getWhatsAppConfig(orgId);
  if (!config) return { sucesso: false, erro: "WhatsApp não configurado ou credenciais incompletas." };
  if (!config.ativo) return { sucesso: false, erro: "Notificações de WhatsApp estão desativadas nas configurações." };

  const url = `https://api.callmebot.com/whatsapp.php?phone=${config.numero}&text=${encodeURIComponent(mensagem)}&apikey=${config.apiKey}`;

  try {
    const resp = await fetch(url);
    if (resp.ok) return { sucesso: true };
    return { sucesso: false, erro: `Erro de requisição: ${resp.status}` };
  } catch (e: any) {
    return { sucesso: false, erro: e.message };
  }
}
