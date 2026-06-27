export const sendWhatsAppNotification = (phone: string, message: string) => {
  // Format phone number to remove non-numeric characters
  const formattedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  window.open(url, '_blank');
};

export const sendEmailReport = (email: string, subject: string, reportBody: string) => {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(reportBody);
  const url = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
  
  // Try to open the mailto link
  window.open(url, '_blank');
  
  // Always copy to clipboard as a fallback
  navigator.clipboard.writeText(reportBody).then(() => {
    alert("O relatório foi copiado para sua área de transferência, caso o e-mail não tenha aberto.");
  }).catch(err => {
    console.error("Erro ao copiar para clipboard: ", err);
  });
};

export const generateSuppliersReport = (suppliers: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE FORNECEDORES - Almox pro (${date})*\n\n`;
  
  const active = suppliers.filter(s => s.status === 'ACTIVE');
  const review = suppliers.filter(s => s.status === 'REVIEW_NEEDED');
  
  report += `*Aprovados (${active.length}):*\n`;
  active.forEach(item => {
    report += `- [${item.category}] ${item.name} (${item.phone})\n`;
  });
  
  report += `\n*Aguardando Revisão (${review.length}):*\n`;
  review.forEach(item => {
    report += `- [${item.category}] ${item.name} (${item.phone})\n`;
  });
  
  return report;
};

export const generateShipmentsReport = (shipments: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE EXPEDIÇÕES - Almox pro (${date})*\n\n`;
  
  const inTransit = shipments.filter(s => s.status === 'SHIPPED');
  const pending = shipments.filter(s => s.status === 'PENDING' || s.status === 'PREPARING');
  
  report += `*Em Trânsito (${inTransit.length}):*\n`;
  inTransit.forEach(item => {
    report += `- [${item.id}] Destino: ${item.destination} (Mot: ${item.driver})\n`;
  });
  
  report += `\n*Pendentes / Preparando (${pending.length}):*\n`;
  pending.forEach(item => {
    report += `- [${item.id}] ${item.destination} (Itens: ${item.items})\n`;
  });
  
  return report;
};

export const generateInventoryReport = (inventory: any[]) => {
  const date = new Date().toLocaleDateString('pt-BR');
  let report = `*RELATÓRIO DE ESTOQUE - Almox pro (${date})*\n\n`;
  
  const critical = inventory.filter(i => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK');
  const ok = inventory.filter(i => i.status === 'OK');
  
  report += `*Itens Críticos / Faltantes (${critical.length}):*\n`;
  critical.forEach(item => {
    report += `- ${item.name} (${item.category}): ${item.qty} un (Min: ${item.minQty})\n`;
  });
  
  report += `\n*Itens Regulares (${ok.length}):*\n`;
  ok.forEach(item => {
    report += `- ${item.name}: ${item.qty} un\n`;
  });
  
  return report;
};
