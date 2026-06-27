import Dexie, { type Table } from 'dexie';
import { collection, query, getDocs, getDoc, doc, setDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import type { VisionRecord } from '../types';

// ── Banco local (IndexedDB via Dexie) ───────────────────────
class VisionLocalDB extends Dexie {
  visionRecords!: Table<VisionRecord & { orgId: string }, string>;
  syncMeta!: Table<{ key: string; value: number }, string>;

  constructor() {
    super("AlmoxVisionDB");
    this.version(1).stores({
      visionRecords: "id, orgId, sku, updatedAt",
      syncMeta: "key"
    });
  }
}

const localDb = new VisionLocalDB();

// ── Lazy Singleton para o modelo ────────────────────────────
let extractorPromise: Promise<any> | null = null;
let isDownloadingModel = false;
let modelDownloadProgress = 0;

export function getVisionModelStatus() {
  return { isDownloading: isDownloadingModel, progress: modelDownloadProgress };
}

async function getExtractor() {
  if (!extractorPromise) {
    isDownloadingModel = true;
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      // Configurações do Transformers.js para rodar no browser (downloads locais)
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        progress_callback: (info: any) => {
           if (info.status === "progress" && info.progress) {
             modelDownloadProgress = info.progress;
           }
        }
      });
      isDownloadingModel = false;
      return extractor;
    })();
  }
  return extractorPromise;
}

// ── Funções Core de Visão ───────────────────────────────────

export async function gerarEmbedding(imagemBase64: string): Promise<number[]> {
  const extractor = await getExtractor();
  // Passamos o Data URL (base64) diretamente para o pipeline
  const output = await extractor(imagemBase64);
  
  // Normalização L2 do vetor (normalmente 512 dimensões para o CLIP-ViT-Base)
  const data = Array.from(output.data) as number[];
  const norm = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0));
  return data.map(val => val / (norm || 1));
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

// ── Sincronização e Persistência ────────────────────────────

// Helpers de timestamp
function tsToMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts.seconds) return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
  if (ts.toMillis) return ts.toMillis();
  return 0;
}

const SYNC_KEY = (orgId: string) => `lastSync_${orgId}`;

export async function carregarMemoria(orgId: string): Promise<VisionRecord[]> {
  const row = await localDb.syncMeta.get(SYNC_KEY(orgId));
  const lastSync = row?.value ?? 0;
  
  const base = collection(db, `organizations/${orgId}/vision_memory`);
  
  if (lastSync === 0) {
    // Sincronização inicial completa
    const snap = await getDocs(query(base));
    const items = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
    if (items.length > 0) {
       await localDb.visionRecords.bulkPut(items);
       const maxTs = Math.max(0, ...items.map(i => tsToMillis(i.updatedAt)));
       await localDb.syncMeta.put({ key: SYNC_KEY(orgId), value: maxTs });
    }
  } else {
     // Sincronização incremental: busca apenas o que mudou
     const snap = await getDocs(query(base, where("updatedAt", ">", new Date(lastSync))));
     if (snap.size > 0) {
       const changed = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
       await localDb.visionRecords.bulkPut(changed);
       const maxTs = Math.max(lastSync, ...changed.map(i => tsToMillis(i.updatedAt)));
       await localDb.syncMeta.put({ key: SYNC_KEY(orgId), value: maxTs });
     }
  }
  
  return await localDb.visionRecords.where("orgId").equals(orgId).toArray();
}

export async function salvarAmostra(
  orgId: string,
  sku: string,
  label: string,
  embedding: number[],
  fonte: 'live_scanner' | 'agent_chat' | 'manual'
): Promise<void> {
  const recordId = sku; // Usamos o SKU como ID do documento para manter 1 registro por SKU
  const ref = doc(db, `organizations/${orgId}/vision_memory/${recordId}`);
  
  const snap = await getDoc(ref);
  
  if (snap.exists()) {
    const data = snap.data() as VisionRecord;
    let newEmbeddings = data.embeddings ? [...data.embeddings, embedding] : [embedding];
    
    // Máximo 8 amostras, descarta a mais antiga (shift)
    if (newEmbeddings.length > 8) {
      newEmbeddings = newEmbeddings.slice(newEmbeddings.length - 8);
    }
    
    const updateData = {
      label,
      embeddings: newEmbeddings,
      samples: (data.samples || 0) + 1,
      fonte,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(ref, updateData);
    
    // Atualiza cache local
    await localDb.visionRecords.update(recordId, {
      ...updateData,
      updatedAt: Date.now()
    });
  } else {
    const newData = {
      id: recordId,
      sku,
      label,
      embeddings: [embedding],
      samples: 1,
      fonte,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(ref, newData);
    
    // Atualiza cache local
    await localDb.visionRecords.put({
      ...newData,
      orgId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as any);
  }
}

export async function buscarMaisSimilar(orgId: string, embedding: number[]): Promise<{sku: string, label: string, score: number} | null> {
  const items = await carregarMemoria(orgId);
  
  let bestMatch = null;
  let highestScore = -Infinity;
  
  for (const item of items) {
    if (!item.embeddings || item.embeddings.length === 0) continue;
    
    // Testa contra todos os ângulos/amostras salvos daquele item
    for (const emb of item.embeddings) {
      const score = cosine(embedding, emb);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = { sku: item.sku, label: item.label, score };
      }
    }
  }
  
  return bestMatch;
}
