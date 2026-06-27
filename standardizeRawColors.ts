import fs from 'fs';

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

  // Emerald / Green hex AND rgba -> Normal / IN -> #378add & rgba(55,138,221)
  text = text.replace(/#00c47a/gi, '#378add');
  text = text.replace(/#10b981/gi, '#378add');
  text = text.replace(/#34d399/gi, '#378add');
  text = text.replace(/rgba\(0,\s*196,\s*122/gi, 'rgba(55,138,221');
  
  // Amber / Yellow hex AND rgba -> Warning -> #00d4ff & rgba(0,212,255)
  text = text.replace(/#f59e0b/gi, '#00d4ff');
  text = text.replace(/#fbbf24/gi, '#00d4ff');
  text = text.replace(/rgba\(245,\s*158,\s*11/gi, 'rgba(0,212,255');
  
  // Pink / Rose / Red (except critical)? The prompt says "Único vermelho permitido é para estoque crítico (#e24b4a), então padronizar qualquer vermelho pro #e24b4a
  text = text.replace(/#f87171/gi, '#e24b4a');

  fs.writeFileSync(file, text);
}
console.log("Raw hex/rgba removed.");
