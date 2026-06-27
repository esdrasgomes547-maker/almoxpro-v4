import { getGoogleToken } from './google-auth';

interface GmailMessage {
  id: string;
  snippet: string;
}

export const googleWorkspace = {
  // Gmail API
  async listEmails(): Promise<GmailMessage[]> {
    const token = getGoogleToken();
    if (!token) throw new Error("Não conectado ao Google");

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error("Erro ao buscar emails");
    const data = await response.json();
    return data.messages || [];
  },

  async sendEmail(to: string, subject: string, body: string) {
    const token = getGoogleToken();
    if (!token) throw new Error("Não conectado ao Google");

    // Basic RFC822 format (very basic)
    const str = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "",
      body
    ].join("\n");
    
    const encodedMail = btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMail })
    });

    if (!response.ok) throw new Error("Erro ao enviar email");
    return await response.json();
  },

  // Sheets API
  async createInventorySpreadsheet(name: string, inventory: any[]) {
    const token = getGoogleToken();
    if (!token) throw new Error("Não conectado ao Google");

    // 1. Create Spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: name }
      })
    });

    if (!createRes.ok) throw new Error("Erro ao criar planilha");
    const spreadsheet = await createRes.json();
    const spreadsheetId = spreadsheet.spreadsheetId;

    // 2. Prepare Data
    const rows = [
      ["ID", "Produto", "Categoria", "Quantidade", "Status"],
      ...inventory.map(item => [item.id, item.name, item.category, item.qty, item.status])
    ];

    // 3. Update Sheet
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:E${rows.length}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rows })
    });

    if (!updateRes.ok) throw new Error("Erro ao inserir dados na planilha");
    return spreadsheet;
  },

  // Drive API
  async listFiles() {
    const token = getGoogleToken();
    if (!token) throw new Error("Não conectado ao Google");

    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType)', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Erro ao buscar arquivos");
    const data = await response.json();
    return data.files || [];
  }
};
