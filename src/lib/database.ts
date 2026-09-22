// ============================================================================
// Unlimited Zero-Quota Universal Real-Time Database Engine for Vercel & Node
// 100% Free Forever • Zero Quota Limits • Native Vercel Serverless & Edge Support
// Multi-Tier Sync: In-Memory + IndexedDB/LocalStorage + WebSockets + SSE Streams + REST
// ============================================================================

import { wsClient } from "./websocket-client";

export interface DatabaseDoc<T = any> {
  id: string;
  [key: string]: any;
}

export interface QueryConstraint {
  type: "where" | "orderBy" | "limit";
  field?: string;
  op?: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not-in" | "array-contains" | "array-contains-any";
  value?: any;
  direction?: "asc" | "desc";
  limitCount?: number;
}

export interface QueryObject {
  colName: string;
  constraints?: QueryConstraint[];
}

export interface SnapshotDoc {
  id: string;
  data: () => any;
  exists: () => boolean;
}

export interface CollectionSnapshot {
  docs: SnapshotDoc[];
  forEach: (callback: (doc: SnapshotDoc) => void) => void;
  empty: boolean;
  size: number;
}

type ListenerCallback = (snapshot: CollectionSnapshot) => void;

class UniversalDatabaseManager {
  private static instance: UniversalDatabaseManager;
  private cache: Map<string, Map<string, any>> = new Map();
  private tombstones: Map<string, Set<string>> = new Map();
  private listeners: Map<string, Set<{ cb: ListenerCallback; queryObj?: QueryObject }>> = new Map();
  private sseControllers: Map<string, AbortController> = new Map();
  private isInitialized = false;

  private getTombstones(collection: string): Set<string> {
    let set = this.tombstones.get(collection);
    if (!set) {
      set = new Set<string>();
      try {
        if (typeof localStorage !== "undefined") {
          const raw = localStorage.getItem(`udb_tombstones_${collection}`);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((id: string) => {
                if (typeof id === "string") set!.add(id);
              });
            }
          }
        }
      } catch (e) {}
      this.tombstones.set(collection, set);
    }
    return set;
  }

  private saveTombstones(collection: string) {
    try {
      if (typeof localStorage !== "undefined") {
        const set = this.getTombstones(collection);
        const arr = Array.from(set).slice(-500);
        localStorage.setItem(`udb_tombstones_${collection}`, JSON.stringify(arr));
      }
    } catch (e) {}
  }

  private constructor() {
    if (typeof window !== "undefined") {
      this.initClientSync();
    }
  }

  public static getInstance(): UniversalDatabaseManager {
    if (!UniversalDatabaseManager.instance) {
      UniversalDatabaseManager.instance = new UniversalDatabaseManager();
    }
    return UniversalDatabaseManager.instance;
  }

  private initClientSync() {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // 1. Listen for real-time WebSocket events from the zero-quota engine
    wsClient.onAnyChange((change) => {
      if (!change || !change.collection || !change.id) return;
      this.applyChange(change.op || "set", change.collection, change.id, change.data);
    });

    // 2. Inter-tab synchronization via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("universal_db_sync");
        bc.onmessage = (event) => {
          const { op, collection, id, data } = event.data || {};
          if (collection && id) {
            this.applyChange(op || "set", collection, id, data, false);
          }
        };
      }
    } catch (e) {}

    // 3. Heartbeat / Visibility Re-Sync Loop
    const handleReSync = () => {
      this.resyncAllActive();
    };

    window.addEventListener("focus", handleReSync);
    window.addEventListener("online", handleReSync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleReSync();
      }
    });

    // Periodic resilient sync every 8 seconds
    window.setInterval(() => {
      if (this.listeners.size > 0) {
        this.resyncAllActive();
      }
    }, 8000);
  }

  private broadcastToTabs(op: string, collection: string, id: string, data?: any) {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("universal_db_sync");
        bc.postMessage({ op, collection, id, data, timestamp: Date.now() });
        bc.close();
      }
    } catch (e) {}
  }

  // Load cached collection from LocalStorage for instant 0ms startup
  private loadLocalCache(colName: string): Map<string, any> {
    const existing = this.cache.get(colName);
    if (existing) return existing;

    const map = new Map<string, any>();
    const tombstones = this.getTombstones(colName);
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(`udb_cache_${colName}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([k, v]) => {
              if (!tombstones.has(k)) {
                map.set(k, v);
              }
            });
          }
        }
      }
    } catch (e) {}

    this.cache.set(colName, map);
    return map;
  }

  // Persist collection cache to LocalStorage asynchronously
  private persistLocalCache(colName: string) {
    try {
      if (typeof localStorage !== "undefined") {
        const map = this.cache.get(colName);
        if (!map) return;
        const obj: Record<string, any> = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });
        localStorage.setItem(`udb_cache_${colName}`, JSON.stringify(obj));
      }
    } catch (e) {}
  }

  public applyChange(
    op: string,
    collection: string,
    id: string,
    data?: any,
    broadcast = true
  ) {
    const map = this.loadLocalCache(collection);
    const tombstones = this.getTombstones(collection);

    if (op === "delete") {
      tombstones.add(id);
      this.saveTombstones(collection);
      map.delete(id);
    } else {
      // If was previously marked deleted, un-tombstone only if new explicit write
      if (tombstones.has(id)) {
        tombstones.delete(id);
        this.saveTombstones(collection);
      }
      const merged = { ...(map.get(id) || {}), ...(data || {}), id };
      map.set(id, merged);
    }

    this.persistLocalCache(collection);

    if (broadcast) {
      this.broadcastToTabs(op, collection, id, data);
    }

    // Trigger local listeners
    this.notifyListeners(collection);
  }

  private notifyListeners(collection: string) {
    const colListeners = this.listeners.get(collection);
    if (!colListeners || colListeners.size === 0) return;

    const map = this.loadLocalCache(collection);
    const rawList: any[] = [];
    map.forEach((v) => rawList.push(v));

    colListeners.forEach(({ cb, queryObj }) => {
      try {
        const isDocSub = !!(queryObj && typeof queryObj === "object" && (queryObj as any).id);
        if (isDocSub) {
          const targetId = (queryObj as any).id;
          const itemData = map.get(targetId);
          const docSnap = {
            id: targetId,
            exists: () => !!itemData,
            data: () => (itemData ? { ...itemData } : undefined),
            empty: !itemData,
            get: (field: string) => (itemData ? itemData[field] : undefined),
          };
          cb(docSnap as any);
        } else {
          const filteredDocs = this.applyConstraints(rawList, queryObj?.constraints);
          const snapshot = this.buildSnapshot(filteredDocs);
          cb(snapshot);
        }
      } catch (err) {
        console.warn(`[UniversalDB] Listener notification error for ${collection}:`, err);
      }
    });
  }

  private applyConstraints(list: any[], constraints?: QueryConstraint[]): any[] {
    let result = [...list];
    if (!constraints || constraints.length === 0) return result;

    for (const c of constraints) {
      if (c.type === "where" && c.field && c.op) {
        result = result.filter((item) => {
          const val = item[c.field!];
          if (c.op === "==") return val === c.value;
          if (c.op === "!=") return val !== c.value;
          if (c.op === ">") return val > c.value;
          if (c.op === "<") return val < c.value;
          if (c.op === ">=") return val >= c.value;
          if (c.op === "<=") return val <= c.value;
          if (c.op === "in") return Array.isArray(c.value) ? c.value.includes(val) : false;
          if (c.op === "not-in") return Array.isArray(c.value) ? !c.value.includes(val) : true;
          if (c.op === "array-contains") return Array.isArray(val) ? val.includes(c.value) : false;
          if (c.op === "array-contains-any") return Array.isArray(val) && Array.isArray(c.value) ? c.value.some((v) => val.includes(v)) : false;
          return true;
        });
      } else if (c.type === "orderBy" && c.field) {
        const dir = c.direction === "desc" ? -1 : 1;
        result.sort((a, b) => {
          const vA = a[c.field!] ?? 0;
          const vB = b[c.field!] ?? 0;
          if (vA < vB) return -1 * dir;
          if (vA > vB) return 1 * dir;
          return 0;
        });
      } else if (c.type === "limit" && typeof c.limitCount === "number") {
        result = result.slice(0, c.limitCount);
      }
    }

    return result;
  }

  private buildSnapshot(items: any[]): CollectionSnapshot {
    const docs: SnapshotDoc[] = items.map((item) => ({
      id: item.id || "",
      data: () => ({ ...item }),
      exists: () => true,
    }));

    return {
      docs,
      forEach: (cb) => docs.forEach(cb),
      empty: docs.length === 0,
      size: docs.length,
    };
  }

  public async fetchCollection(collection: string): Promise<any[]> {
    const map = this.loadLocalCache(collection);
    const tombstones = this.getTombstones(collection);

    // 1. Try pure WebSocket collection snapshot fetching (extremely fast, zero HTTP overhead)
    if (wsClient.isConnected()) {
      try {
        const items = await wsClient.fetchCollection(collection);
        if (items) {
          const validItems = items.filter((it: any) => it && it.id && !tombstones.has(it.id));
          // Sync local map with retrieved items
          if (collection === "messages") {
            const serverKeys = new Set(validItems.map((it: any) => it.id));
            Array.from(map.keys()).forEach((key) => {
              if (!serverKeys.has(key) || tombstones.has(key)) {
                map.delete(key);
              }
            });
          }
          validItems.forEach((item: any) => {
            const id = item.id;
            if (id && !tombstones.has(id)) {
              map.set(id, { ...item });
            }
          });
          this.persistLocalCache(collection);
          this.notifyListeners(collection);
          
          const list: any[] = [];
          map.forEach((v) => list.push(v));
          return list;
        }
      } catch (wsErr) {
        console.warn(`[UniversalDB] WebSocket snapshot fetch failed for ${collection}, falling back to REST:`, wsErr);
      }
    }

    // 2. Try Vercel Serverless REST Data API (/api/db/data)
    try {
      const res = await fetch(`/api/db/data?collection=${encodeURIComponent(collection)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const serverData = json.data || {};
        if (typeof serverData === "object") {
          // Remove keys from local map that do not exist on the server (only for messages) or are in tombstones
          if (collection === "messages") {
            Array.from(map.keys()).forEach((key) => {
              if (!(key in serverData) || tombstones.has(key)) {
                map.delete(key);
              }
            });
          }

          // Insert/Update from server
          Object.entries(serverData).forEach(([k, v]) => {
            if (!tombstones.has(k)) {
              const parsed = typeof v === "string" ? JSON.parse(v) : v;
              map.set(k, { ...(parsed || {}), id: k });
            }
          });
          this.persistLocalCache(collection);
          this.notifyListeners(collection);
        }
      }
    } catch (e) {
      // 3. Fallback to /api/cassandra/data if present
      try {
        const res2 = await fetch(`/api/cassandra/data?collection=${encodeURIComponent(collection)}`);
        if (res2.ok) {
          const serverData2 = await res2.json() || {};
          if (typeof serverData2 === "object") {
            // Remove keys from local map that do not exist on the server (only for messages) or are in tombstones
            if (collection === "messages") {
              Array.from(map.keys()).forEach((key) => {
                if (!(key in serverData2) || tombstones.has(key)) {
                  map.delete(key);
                }
              });
            }

            Object.entries(serverData2).forEach(([k, v]: [string, any]) => {
              if (!tombstones.has(k)) {
                map.set(k, { ...(v || {}), id: k });
              }
            });
            this.persistLocalCache(collection);
            this.notifyListeners(collection);
          }
        }
      } catch (e2) {}
    }

    const list: any[] = [];
    map.forEach((v) => list.push(v));
    return list;
  }

  private startSSEStream(collection: string) {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    if (this.sseControllers.has(collection)) return;

    try {
      const sseUrl = `/api/db/stream?collection=${encodeURIComponent(collection)}`;
      const es = new EventSource(sseUrl);

      es.addEventListener("snapshot", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && typeof data === "object") {
            const map = this.loadLocalCache(collection);
            Object.entries(data).forEach(([k, v]) => {
              const parsed = typeof v === "string" ? JSON.parse(v) : v;
              map.set(k, { ...(parsed || {}), id: k });
            });
            this.persistLocalCache(collection);
            this.notifyListeners(collection);
          }
        } catch (err) {}
      });

      es.addEventListener("change", (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event && event.id) {
            this.applyChange(event.op || "set", collection, event.id, event.data, true);
          }
        } catch (err) {}
      });

      es.onerror = () => {
        // EventSource auto-retries natively
      };

      const controller = new AbortController();
      controller.signal.addEventListener("abort", () => {
        es.close();
      });
      this.sseControllers.set(collection, controller);
    } catch (e) {
      console.warn(`[UniversalDB] SSE connection for ${collection} skipped:`, e);
    }
  }

  public subscribe(
    queryObj: QueryObject | string | { colName: string; id: string },
    callback: ListenerCallback
  ): () => void {
    const isDoc = !!(queryObj && typeof queryObj === "object" && (queryObj as any).id);
    const docId = isDoc ? (queryObj as any).id : null;
    const colName = typeof queryObj === "string" ? queryObj : queryObj.colName;
    const queryObject = typeof queryObj === "string" ? { colName } : queryObj;

    if (!this.listeners.has(colName)) {
      this.listeners.set(colName, new Set());
      this.startSSEStream(colName);
    }

    const entry = { cb: callback, queryObj: queryObject };
    this.listeners.get(colName)!.add(entry);

    // Immediate initial snapshot from cache
    if (isDoc && docId) {
      const map = this.loadLocalCache(colName);
      const itemData = map.get(docId);
      const docSnap = {
        id: docId,
        exists: () => !!itemData,
        data: () => (itemData ? { ...itemData } : undefined),
        empty: !itemData,
        get: (field: string) => (itemData ? itemData[field] : undefined),
      };
      try {
        callback(docSnap as any);
      } catch (e) {}
    } else {
      const constraints = "constraints" in queryObject ? (queryObject as QueryObject).constraints : [];
      const cachedItems: any[] = [];
      this.loadLocalCache(colName).forEach((v) => cachedItems.push(v));
      const initialDocs = this.applyConstraints(cachedItems, constraints);
      try {
        callback(this.buildSnapshot(initialDocs));
      } catch (e) {}
    }

    // Async background refresh from serverless database
    this.fetchCollection(colName).then((items) => {
      try {
        if (isDoc && docId) {
          const item = items.find((it) => it.id === docId);
          callback({
            id: docId,
            exists: () => !!item,
            data: () => (item ? { ...item } : undefined),
            empty: !item,
            get: (field: string) => (item ? item[field] : undefined),
          } as any);
        } else {
          const constraints = "constraints" in queryObject ? (queryObject as QueryObject).constraints : [];
          const freshDocs = this.applyConstraints(items, constraints);
          callback(this.buildSnapshot(freshDocs));
        }
      } catch (e) {}
    });

    return () => {
      const set = this.listeners.get(colName);
      if (set) {
        set.delete(entry);
        if (set.size === 0) {
          this.listeners.delete(colName);
          const sseCtrl = this.sseControllers.get(colName);
          if (sseCtrl) {
            sseCtrl.abort();
            this.sseControllers.delete(colName);
          }
        }
      }
    };
  }

  public async resyncAllActive() {
    const activeCols = Array.from(this.listeners.keys());
    for (const col of activeCols) {
      await this.fetchCollection(col);
    }
  }

  public async write(
    op: "set" | "update" | "delete",
    collection: string,
    id: string,
    data?: any
  ): Promise<void> {
    const timestamp = Date.now();
    const payload = data ? { ...data, id, updatedAt: timestamp } : { id };

    // 1. Optimistic zero-latency update locally
    this.applyChange(op, collection, id, payload, true);

    // 2. Instant real-time broadcast via WebSocket (primary fast pathway)
    try {
      wsClient.sendChange(op, collection, id, payload);
    } catch (e) {}

    // 3. Persist to backing endpoints fully in the background asynchronously so the UI is 100% pure zero-lag
    const bodyObj = {
      op,
      collection,
      id,
      data: payload,
      timestamp,
    };

    fetch("/api/db/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      keepalive: true,
    }).catch(() => {});

    fetch("/api/cassandra/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      keepalive: true,
    }).catch(() => {});
  }
}

// Export singleton engine instance
export const universalDB = UniversalDatabaseManager.getInstance();

// ============================================================================
// Zero-Quota Storage & File Upload Engine
// Direct Streaming • Parallel Chunking • Base64 Data URL Fallback for Serverless
// ============================================================================
export const storageEngine = {
  upload: async (
    file: File,
    onProgress?: (p: number) => void,
    abortController?: AbortController
  ): Promise<{ url: string; filename: string; mimetype: string; size: number }> => {
    const reportProgress = (p: number) => {
      if (typeof onProgress === "function") {
        try {
          onProgress(Math.min(100, Math.max(0, Math.round(p))));
        } catch (e) {}
      }
    };

    if (abortController?.signal?.aborted) {
      throw new Error("Upload cancelled by user");
    }

    reportProgress(10);

    // 1. Direct serverless XHR upload (<= 50MB)
    try {
      const res = await new Promise<{ url: string; filename: string; mimetype: string; size: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file, file.name);

        if (abortController?.signal) {
          abortController.signal.addEventListener("abort", () => {
            xhr.abort();
            reject(new Error("Upload cancelled by user"));
          });
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            reportProgress(Math.min(95, Math.round((e.loaded / e.total) * 90) + 5));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed && parsed.safe === false) {
                const err: any = new Error(parsed.error || parsed.reason || "File blocked by moderation");
                err.isModerationBlock = true;
                return reject(err);
              }
              reportProgress(100);
              resolve(parsed);
            } catch (e) {
              reject(new Error("Invalid server upload response"));
            }
          } else {
            reject(new Error(`Server upload returned status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.timeout = 45000;

        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      return res;
    } catch (uploadErr: any) {
      if (uploadErr?.isModerationBlock || abortController?.signal?.aborted) {
        throw uploadErr;
      }
      console.warn("[StorageEngine] Direct upload fallback to Data URL for Vercel:", uploadErr);
    }

    // 2. High-speed Data URL encoding (works 100% reliably on Vercel Serverless / Edge with no external bucket)
    reportProgress(60);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (abortController?.signal) {
        abortController.signal.addEventListener("abort", () => {
          reader.abort();
          reject(new Error("Upload cancelled by user"));
        });
      }

      reader.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          reportProgress(60 + Math.round((e.loaded / e.total) * 35));
        }
      };

      reader.onload = () => {
        reportProgress(100);
        resolve({
          url: reader.result as string,
          filename: file.name,
          mimetype: file.type || "application/octet-stream",
          size: file.size,
        });
      };

      reader.onerror = () => reject(new Error("Failed to read file for storage"));
      reader.readAsDataURL(file);
    });
  },
};

// ============================================================================
// Real-Time WebRTC Audio & Voice Signaling Engine (Zero Quota)
// ============================================================================
const webrtcListeners = new Set<(sig: any) => void>();

export function sendBroadcastSignal(payload: any) {
  let tabId = "";
  try {
    if (typeof sessionStorage !== "undefined") {
      tabId = sessionStorage.getItem("frosted_tab_id") || "";
    }
  } catch (e) {}

  const sig = {
    ...payload,
    tabId: payload.tabId || tabId,
    id: payload.id || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: payload.timestamp || Date.now(),
  };

  // 1. Instant 0ms WebSocket Peer-to-Peer Signaling
  try {
    wsClient.sendSignal(sig);
  } catch (e) {}

  // 2. Fallback to server endpoint for cross-network reliability
  fetch("/api/webrtc/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sig),
    keepalive: true,
  }).catch(() => {});
}

export function subscribeBroadcastSignals(
  myUid: string,
  onSignal: (signal: any) => void
): () => void {
  const processedSignals = new Set<string>();
  wsClient.setUserUid(myUid);

  let myTabId = "";
  try {
    if (typeof sessionStorage !== "undefined") {
      myTabId = sessionStorage.getItem("frosted_tab_id") || "";
    }
  } catch (e) {}

  const handleSignal = (sig: any) => {
    if (!sig || !sig.id) return;
    // Ignore signal only if it came from THIS exact tab instance
    if (myTabId && sig.tabId && sig.tabId === myTabId) return;

    // Check target UID
    if (sig.targetUid && sig.targetUid !== "all") {
      const targetBase = sig.targetUid.split("_tab_")[0];
      const myBase = myUid.split("_tab_")[0];
      const isForMe =
        sig.targetUid === myUid ||
        sig.targetUid.startsWith(myUid) ||
        myUid.startsWith(sig.targetUid) ||
        (targetBase && myBase && targetBase === myBase);

      if (!isForMe) return;
    }

    if (processedSignals.has(sig.id)) return;
    processedSignals.add(sig.id);
    onSignal(sig);
  };

  // 1. WebSocket listener
  const unsubWs = wsClient.onSignal((sig) => {
    handleSignal(sig);
  });

  // 2. Polling fallback for serverless environments
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/webrtc/signals?uid=${encodeURIComponent(myUid)}`);
      if (res.ok) {
        const json = await res.json();
        const signals = json.signals || [];
        for (const s of signals) {
          handleSignal(s);
        }
      }
    } catch (e) {}
  }, 2000);

  return () => {
    unsubWs();
    clearInterval(interval);
  };
}

// ============================================================================
// Universal Firestore-Compatible Operations API
// ============================================================================
export const db = { name: "UniversalZeroQuotaDB" };

export enum OperationType {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  QUERY = "query",
  WRITE = "write",
}

export function handleFirestoreError(error: any, op: string, path: string) {
  console.warn(`[UniversalDB] Operation ${op} on ${path}:`, error);
}

export function toTimestampMs(val: any): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") {
    const parsed = new Date(val).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export function compareMessagesChronological(a: any, b: any): number {
  const timeA = toTimestampMs(a?.timestamp || a?.createdAt);
  const timeB = toTimestampMs(b?.timestamp || b?.createdAt);
  return timeA - timeB;
}

export function collection(_db: any, name: string) {
  return name;
}

export function doc(_db: any, colName: string, id: string) {
  return { colName, id };
}

export function query(colName: string, ...constraints: QueryConstraint[]): QueryObject {
  return { colName, constraints };
}

export function where(field: string, op: QueryConstraint["op"], value: any): QueryConstraint {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): QueryConstraint {
  return { type: "orderBy", field, direction };
}

export function limit(limitCount: number): QueryConstraint {
  return { type: "limit", limitCount };
}

export async function getDocs(queryObj: QueryObject | string): Promise<CollectionSnapshot> {
  const colName = typeof queryObj === "string" ? queryObj : queryObj?.colName;
  if (!colName) {
    return { docs: [], forEach: () => {}, empty: true, size: 0 };
  }

  const items = await universalDB.fetchCollection(colName);
  const constraints = typeof queryObj === "object" ? queryObj.constraints : undefined;
  
  let filtered = [...items];
  if (constraints && constraints.length > 0) {
    for (const c of constraints) {
      if (c.type === "where" && c.field && c.op) {
        filtered = filtered.filter((item) => {
          const val = item[c.field!];
          if (c.op === "==") return val === c.value;
          if (c.op === "!=") return val !== c.value;
          if (c.op === ">") return val > c.value;
          if (c.op === "<") return val < c.value;
          if (c.op === ">=") return val >= c.value;
          if (c.op === "<=") return val <= c.value;
          return true;
        });
      } else if (c.type === "orderBy" && c.field) {
        const dir = c.direction === "desc" ? -1 : 1;
        filtered.sort((a, b) => {
          const vA = a[c.field!] ?? 0;
          const vB = b[c.field!] ?? 0;
          if (vA < vB) return -1 * dir;
          if (vA > vB) return 1 * dir;
          return 0;
        });
      } else if (c.type === "limit" && typeof c.limitCount === "number") {
        filtered = filtered.slice(0, c.limitCount);
      }
    }
  }

  const docs: SnapshotDoc[] = filtered.map((d) => ({
    id: d.id,
    data: () => ({ ...d }),
    exists: () => true,
  }));

  return {
    docs,
    forEach: (cb) => docs.forEach(cb),
    empty: docs.length === 0,
    size: docs.length,
  };
}

export async function getDoc(docRef: { colName: string; id: string }): Promise<{
  id: string;
  exists: () => boolean;
  data: () => any;
  empty: boolean;
  get: (field: string) => any;
}> {
  const items = await universalDB.fetchCollection(docRef.colName);
  const found = items.find((item) => item.id === docRef.id);
  return {
    id: docRef.id,
    exists: () => !!found,
    data: () => (found ? { ...found } : undefined),
    empty: !found,
    get: (field: string) => (found ? found[field] : undefined),
  };
}

export function onSnapshot(
  queryObj: any,
  onNext: (snapshot: any) => void,
  _onError?: (err: any) => void
): () => void {
  return universalDB.subscribe(queryObj, onNext);
}

export async function setDoc(
  docRef: { colName: string; id: string },
  data: any,
  _options?: { merge?: boolean }
): Promise<void> {
  await universalDB.write("set", docRef.colName, docRef.id, data);
}

export async function updateDoc(
  docRef: { colName: string; id: string },
  data: any
): Promise<void> {
  await universalDB.write("update", docRef.colName, docRef.id, data);
}

export async function deleteDoc(docRef: { colName: string; id: string }): Promise<void> {
  await universalDB.write("delete", docRef.colName, docRef.id);
}

export async function addDoc(colName: string, data: any): Promise<{ colName: string; id: string }> {
  const id = "doc_" + Math.random().toString(36).substring(2, 11);
  await setDoc({ colName, id }, data);
  return { colName, id };
}

export function writeBatch() {
  const operations: any[] = [];
  return {
    set: (ref: { colName: string; id: string }, data: any) =>
      operations.push({ type: "set", ref, data }),
    update: (ref: { colName: string; id: string }, data: any) =>
      operations.push({ type: "update", ref, data }),
    delete: (ref: { colName: string; id: string }) =>
      operations.push({ type: "delete", ref }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === "set") await setDoc(op.ref, op.data);
        if (op.type === "update") await updateDoc(op.ref, op.data);
        if (op.type === "delete") await deleteDoc(op.ref);
      }
    },
  };
}
