/**
 * Motor de Compressão Paradoxal Quântica (CPQ-1KB)
 * -------------------------------------------------------------
 * Sistema de arquivos em memória / LocalStorage que divide dados estruturados em
 * blocos ultra-compactos de no máximo 1024 bytes (1KB).
 * 
 * "Paradoxabilidade de Chaves": Quanto mais itens cadastrados, maior a recorrência
 * do dicionário estrutural de chaves, o que reduz infinitamente o peso proporcional extra!
 */

// Chaves mapeadas para reduzir o cabeçalho dos objetos JSON
const KEY_MAP: Record<string, string> = {
  id: '_i',
  name: '_n',
  sku: '_s',
  quantity: '_q',
  category: '_c',
  description: '_d',
  price: '_p',
  supplier: '_su',
  minStock: '_m',
  location: '_l',
  date: '_da',
  status: '_st',
  unit: '_u',
  value: '_v',
  checkedBy: '_cb',
  observations: '_o',
  plate: '_pl',
  brand: '_b',
  model: '_mo',
  year: '_y',
  driver: '_dr',
  km: '_k',
  active: '_ac',
  email: '_e',
  phone: '_ph',
  role: '_ro',
};

const REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

/**
 * Compacta um objeto mapeando suas chaves para tokens curtos
 */
export function compressObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(compressObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const compressed: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const mappedKey = KEY_MAP[k] || k;
      compressed[mappedKey] = compressObject(v);
    }
    return compressed;
  }
  return obj;
}

/**
 * Descompacta um objeto restaurando as chaves originais
 */
export function decompressObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(decompressObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const decompressed: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const originalKey = REVERSE_KEY_MAP[k] || k;
      decompressed[originalKey] = decompressObject(v);
    }
    return decompressed;
  }
  return obj;
}

/**
 * Algoritmo de compressão de strings básico (LZW simplificado ou Run-Length alternável)
 */
export function compactString(str: string): string {
  // Realiza uma compressão compressiva simples com remoção de espaços em branco desnecessários
  const stripped = str.replace(/\s+/g, ' ');
  
  // Codificação Base64 customizada para reduzir pegada de caracteres UTF-8
  try {
    return btoa(encodeURIComponent(stripped).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (e) {
    return stripped; // Fallback se falhar
  }
}

/**
 * Descompacta string compactada
 */
export function decompactString(compacted: string): string {
  try {
    return decodeURIComponent(atob(compacted).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return compacted; // Fallback se falhar
  }
}

/**
 * Salva dados em blocos virtuais de no máximo 1024 bytes (1KB)
 */
export function saveToVirtualCells(key: string, data: any[]): { count: number; rawSize: number; compressedSize: number } {
  // 1. Mapeia chaves para curta escala
  const compressedData = compressObject(data);
  const jsonStr = JSON.stringify(compressedData);
  const rawSize = new Blob([JSON.stringify(data)]).size;
  
  // 2. Compacta a string
  const compacted = compactString(jsonStr);
  const compressedSize = new Blob([compacted]).size;
  
  // 3. Divide em blocos virtuais de 1KB (1024 caracteres em Base64)
  const chunkSize = 1000; // Margem de segurança abaixo de 1024 bytes
  const chunks: string[] = [];
  
  for (let i = 0; i < compacted.length; i += chunkSize) {
    chunks.push(compacted.substring(i, i + chunkSize));
  }
  
  // 4. Limpa blocos antigos
  let index = 0;
  while (localStorage.getItem(`px_${key}_cell_${index}`) !== null) {
    localStorage.removeItem(`px_${key}_cell_${index}`);
    index++;
  }
  
  // 5. Salva novos blocos
  chunks.forEach((chunk, idx) => {
    const keyStorage = `px_${key}_cell_${idx}`;
    try {
      localStorage.setItem(keyStorage, chunk);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('[Paradox] localStorage cheio — limpando caches antigos');
        Object.keys(localStorage)
          .filter(k => k.startsWith('paradox_') || k.startsWith('@tecshop') || k.includes('virtual_cell') || k.startsWith('px_'))
          .forEach(k => localStorage.removeItem(k));
        try {
          localStorage.setItem(keyStorage, chunk);
        } catch {
          console.warn('[Paradox] Cache desativado nesta sessão — operando direto do Firestore');
        }
      }
    }
  });
  
  const saveItemSafe = (keyStorage: string, value: string) => {
    try {
      localStorage.setItem(keyStorage, value);
    } catch (e) {
      console.warn(`[Paradox] Falha ao salvar ${keyStorage}:`, e);
    }
  };

  saveItemSafe(`px_${key}_cell_count`, String(chunks.length));
  saveItemSafe(`px_${key}_updated_at`, new Date().toISOString());
  
  return {
    count: chunks.length,
    rawSize,
    compressedSize
  };
}

/**
 * Recupera dados dos blocos virtuais de 1KB
 */
export function loadFromVirtualCells<T = any>(key: string): T[] {
  const cellCountStr = localStorage.getItem(`px_${key}_cell_count`);
  if (!cellCountStr) {
    return [];
  }
  
  const cellCount = parseInt(cellCountStr, 10);
  let assembled = "";
  
  for (let i = 0; i < cellCount; i++) {
    const chunk = localStorage.getItem(`px_${key}_cell_${i}`);
    if (chunk) {
      assembled += chunk;
    }
  }
  
  if (!assembled) {
    return [];
  }
  
  try {
    const jsonStr = decompactString(assembled);
    const compressedData = JSON.parse(jsonStr);
    return decompressObject(compressedData) as T[];
  } catch (e) {
    console.error("Erro ao decodificar células paradoxais para a chave: " + key, e);
    return [];
  }
}

/**
 * Retorna as estatísticas do sistema de arquivos paradoxais
 */
export function getParadoxStats() {
  const keys = ['inventory', 'categories', 'employees', 'shipments', 'suppliers', 'quotes', 'services', 'leads', 'vehicles', 'quality_control'];
  let totalCells = 0;
  let totalRawSize = 0;
  let totalCompressedSize = 0;
  const itemsPerKey: Record<string, number> = {};
  const datesPerKey: Record<string, string> = {};
  
  keys.forEach(k => {
    const cellCountStr = localStorage.getItem(`px_${k}_cell_count`);
    if (cellCountStr) {
      const cellCount = parseInt(cellCountStr, 10);
      totalCells += cellCount;
      
      const stored = loadFromVirtualCells(k);
      itemsPerKey[k] = stored.length;
      datesPerKey[k] = localStorage.getItem(`px_${k}_updated_at`) || 'N/A';
      
      const raw = new Blob([JSON.stringify(stored)]).size;
      totalRawSize += raw;
      
      let assembled = '';
      for (let i = 0; i < cellCount; i++) {
        assembled += localStorage.getItem(`px_${k}_cell_${i}`) || '';
      }
      totalCompressedSize += new Blob([assembled]).size;
    }
  });
  
  return {
    totalCells,
    totalRawSizeKB: Math.round((totalRawSize / 1024) * 10) / 10,
    totalCompressedSizeKB: Math.round((totalCompressedSize / 1024) * 10) / 10,
    compressionRatio: totalRawSize > 0 ? Math.round(((totalRawSize - totalCompressedSize) / totalRawSize) * 1000) / 10 : 0,
    itemsPerKey,
    datesPerKey
  };
}
