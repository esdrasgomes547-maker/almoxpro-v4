import Dexie, { type Table } from "dexie";
import {
  collection, query, where, getDocs, orderBy,
} from "firebase/firestore";
import { db as firestore } from "./firebase";
import type { InventoryItem } from "../types";

// ── Banco local (IndexedDB via Dexie) ───────────────────────
class AlmoxLocalDB extends Dexie {
  inventory!: Table<InventoryItem & { orgId: string }, string>;
  syncMeta!:  Table<{ key: string; value: number }, string>;
  categorias!: Table<{ id: string; orgId: string; [key: string]: any }, string>;

  constructor() {
    super("AlmoxProLocal");
    this.version(2).stores({
      inventory: "id, orgId, name, category, qty, updatedAt",
      syncMeta:  "key",
      categorias: "id, orgId, updatedAt"
    }).upgrade(() => {
      // Configurar upgrade se necessário
    });
  }
}

export const localDb = new AlmoxLocalDB();

// ── Helpers de timestamp ────────────────────────────────────
// Firestore serverTimestamp vira objeto {seconds, nanoseconds}
function tsToMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts.seconds) return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
  if (ts.toMillis) return ts.toMillis();
  return 0;
}

const SYNC_KEY = (orgId: string) => `lastSync_${orgId}`;
const SYNC_CAT_KEY = (orgId: string) => `lastSyncCat_${orgId}`;

async function getLastSync(orgId: string, type: 'inventory' | 'categories' = 'inventory'): Promise<number> {
  const row = await localDb.syncMeta.get(type === 'inventory' ? SYNC_KEY(orgId) : SYNC_CAT_KEY(orgId));
  return row?.value ?? 0;
}

async function setLastSync(orgId: string, millis: number, type: 'inventory' | 'categories' = 'inventory') {
  await localDb.syncMeta.put({ key: type === 'inventory' ? SYNC_KEY(orgId) : SYNC_CAT_KEY(orgId), value: millis });
}

// ── Sincronização incremental de Inventário ───────────────────────────────
// Retorna a lista completa de itens (do cache local, já sincronizado)
export async function syncInventory(orgId: string): Promise<{
  items: InventoryItem[];
  lidos: number;
  fonte: "full" | "incremental" | "cache";
}> {
  const lastSync = await getLastSync(orgId, 'inventory');
  const base = collection(firestore, `organizations/${orgId}/inventory`);

  let lidos = 0;
  let fonte: "full" | "incremental" | "cache" = "cache";

  if (lastSync === 0) {
    // Primeira vez — baixa tudo
    const snap = await getDocs(query(base, orderBy("name", "asc")));
    lidos = snap.size;
    fonte = "full";
    const items = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
    await localDb.inventory.bulkPut(items);
    const maxTs = Math.max(0, ...items.map(i => tsToMillis(i.updatedAt)));
    if (maxTs > 0) await setLastSync(orgId, maxTs, 'inventory');
  } else {
    // Incremental — só o que mudou desde o último sync
    const snap = await getDocs(query(base, where("updatedAt", ">", new Date(lastSync))));
    lidos = snap.size;
    fonte = "incremental";
    if (snap.size > 0) {
      const changed = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
      await localDb.inventory.bulkPut(changed);
      const maxTs = Math.max(lastSync, ...changed.map(i => tsToMillis(i.updatedAt)));
      await setLastSync(orgId, maxTs, 'inventory');
    }
  }

  // Sempre retorna a lista completa do cache local
  const items = await localDb.inventory.where("orgId").equals(orgId).toArray();
  return { items, lidos, fonte };
}

// ── Sincronização de Categorias ───────────────────────────────
export async function syncCategories(orgId: string): Promise<{ id: string; orgId: string; [key: string]: any }[]> {
  const lastSync = await getLastSync(orgId, 'categories');
  const base = collection(firestore, `organizations/${orgId}/categories`);

  if (lastSync === 0) {
    const snap = await getDocs(query(base));
    const items = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
    await localDb.categorias.bulkPut(items);
    const maxTs = Math.max(0, ...items.map(i => tsToMillis(i.updatedAt || Date.now())));
    if (maxTs > 0) await setLastSync(orgId, maxTs, 'categories');
  } else {
    // Sincroniza em background e não espera
    getDocs(query(base, where("updatedAt", ">", new Date(lastSync)))).then(async snap => {
      if (snap.size > 0) {
        const changed = snap.docs.map(d => ({ id: d.id, orgId, ...d.data() } as any));
        await localDb.categorias.bulkPut(changed);
        const maxTs = Math.max(lastSync, ...changed.map(i => tsToMillis(i.updatedAt || Date.now())));
        await setLastSync(orgId, maxTs, 'categories');
      }
    }).catch(console.error);
  }

  return await localDb.categorias.where("orgId").equals(orgId).toArray();
}

// Limpa o cache local de uma org (para forçar full sync)
export async function resetLocalInventory(orgId: string) {
  await localDb.inventory.where("orgId").equals(orgId).delete();
  await localDb.syncMeta.delete(SYNC_KEY(orgId));
  await localDb.categorias.where("orgId").equals(orgId).delete();
  await localDb.syncMeta.delete(SYNC_CAT_KEY(orgId));
}
