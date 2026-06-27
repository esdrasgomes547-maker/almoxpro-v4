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

// Replaces all color classes with strict palette.
// #1b365d is primary dark hover/button
// #050d1a and #0a1628 are dark bg
// #e8f4ff text primary
// #4a7a9b text secondary
// #378add normal stock
// #e24b4a critical stock
// #00d4ff warning (below min) actually the prompt said: Atenção (abaixo do mínimo) -> azul mais claro '#00d4ff'

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');

  // Replace emojis again to be absolutely sure
  const emojis = ['🔧', '🛡️', '⚡', '🎯', '🔍', '📋', '✅', '⚠️', '🚨', '📦', '🏭', '📅'];
  for (const em of emojis) {
      content = content.split(em + ' ').join('');
      content = content.split(' ' + em).join('');
      content = content.split(em).join('');
  }

  // 1. Remove/replace Tailwind colors globally where possible.
  // We'll replace text-amber-*, text-emerald-*, bg-amber-*, etc.
  
  // Actually, I can use regex to replace specific ones, but manual targeted replacements might be safer.
  // Instead of a broad brush that might break layout or class names, let's find specific ones in Inventory.tsx
  
  fs.writeFileSync(file, content);
}

console.log("Done");
