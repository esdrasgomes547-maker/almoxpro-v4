const fs = require('fs');

const files = [
  'src/pages/Inventory.tsx',
  'src/pages/ScanProduct.tsx',
  'src/pages/SaidaLote.tsx',
  'src/pages/Registros.tsx',
  'src/components/AlertaEstoqueModal.tsx',
  'src/components/InconsistencyPanel.tsx',
  'src/components/AgentChat.tsx',
  'src/components/layout/AppLayout.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');

  // Specific strict primary replacement:
  // "Botão de ação principal: background: linear-gradient(135deg, #1b365d, #0d2a4a)"
  text = text.replace(/bg-(green|emerald|teal|amber|orange)-600 hover:bg-(green|emerald|teal|amber|orange)-700/g, 'bg-gradient-to-br from-[#1b365d] to-[#0d2a4a] border border-[#00d4ff]/30 text-[#e8f4ff] hover:opacity-90');
  
  text = text.replace(/text-(amber|yellow|orange)-\d+(\/\d+)?/g, 'text-[#00d4ff]');
  text = text.replace(/text-(green|emerald|teal)-\d+(\/\d+)?/g, 'text-[#378add]');
  text = text.replace(/text-(purple|violet|pink)-\d+(\/\d+)?/g, 'text-[#4a7a9b]');
  text = text.replace(/text-(rose|red)-\d+(\/\d+)?/g, 'text-[#e24b4a]');
  
  text = text.replace(/bg-(amber|yellow|orange)-\d+\/\d+/g, 'bg-[#00d4ff]/10');
  text = text.replace(/bg-(amber|yellow|orange)-\d+/g, 'bg-[#00d4ff]/10');
  
  text = text.replace(/bg-(green|emerald|teal)-\d+\/\d+/g, 'bg-[#378add]/10');
  text = text.replace(/bg-(green|emerald|teal)-\d+/g, 'bg-[#378add]/10');
  
  text = text.replace(/bg-(purple|violet|pink)-\d+\/\d+/g, 'bg-[#4a7a9b]/10');
  text = text.replace(/bg-(purple|violet|pink)-\d+/g, 'bg-[#4a7a9b]/10');
  
  text = text.replace(/bg-(rose|red)-\d+\/\d+/g, 'bg-[#e24b4a]/10');
  text = text.replace(/bg-(rose|red)-\d+/g, 'bg-[#e24b4a]/10');

  text = text.replace(/border-(amber|yellow|orange)-\d+\/\d+/g, 'border-[#00d4ff]/20');
  text = text.replace(/border-(amber|yellow|orange)-\d+/g, 'border-[#00d4ff]/20');
  text = text.replace(/border-(green|emerald|teal)-\d+\/\d+/g, 'border-[#378add]/20');
  text = text.replace(/border-(green|emerald|teal)-\d+/g, 'border-[#378add]/20');
  text = text.replace(/border-(purple|violet|pink)-\d+\/\d+/g, 'border-[#4a7a9b]/20');
  text = text.replace(/border-(purple|violet|pink)-\d+/g, 'border-[#4a7a9b]/20');
  text = text.replace(/border-(rose|red)-\d+\/\d+/g, 'border-[#e24b4a]/20');
  text = text.replace(/border-(rose|red)-\d+/g, 'border-[#e24b4a]/20');
  
  text = text.replace(/ring-(amber|yellow|orange|green|emerald|teal|purple|violet|pink|rose|red)-\d+(\/\d+)?/g, 'ring-[#00d4ff]/30');
  
  // also handle "text-success", "bg-success" etc if there's any? No, we didn't search for that.
  
  fs.writeFileSync(file, text);
}
console.log("Colors replaced via script.");
