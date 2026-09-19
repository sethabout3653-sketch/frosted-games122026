import { adminDb } from "./firebase-admin";

interface SyncTask {
  op: "set" | "delete";
  collection: string;
  id: string;
  data?: any;
  timestamp: number;
  retries: number;
}

let syncQueue: SyncTask[] = [];
let isProcessingQueue = false;
let isQuotaExceeded = false;
let lastQuotaCheck = 0;

export async function queueFirebaseSync(
  op: "set" | "delete",
  collection: string,
  id: string,
  data?: any
) {
  // If we know the quota is exceeded, don't spam Firestore unless 60 seconds have passed to test if it has reset
  if (isQuotaExceeded && Date.now() - lastQuotaCheck < 60000) {
    syncQueue.push({ op, collection, id, data, timestamp: Date.now(), retries: 0 });
    return;
  }

  syncQueue.push({ op, collection, id, data, timestamp: Date.now(), retries: 0 });
  triggerQueueProcessing();
}

async function triggerQueueProcessing() {
  if (isProcessingQueue || !adminDb) return;
  isProcessingQueue = true;

  while (syncQueue.length > 0) {
    const task = syncQueue.shift();
    if (!task) continue;

    try {
      if (task.op === "delete") {
        await adminDb.collection(task.collection).doc(task.id).delete();
      } else {
        await adminDb.collection(task.collection).doc(task.id).set(
          {
            ...(task.data || {}),
            id: task.id,
            collection: task.collection,
            timestamp: task.timestamp,
          },
          { merge: true }
        );
      }

      // Successfully synced! Reset quota flag if it was set
      if (isQuotaExceeded) {
        console.log("[Firebase Queue] Quota limit reset! Cloud synchronizations resumed.");
        isQuotaExceeded = false;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[Firebase Sync Error] Sync failed for ${task.collection}/${task.id}:`, errMsg);

      // Check for standard Firebase Quota Limit Exceeded indicators
      if (
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("quota") ||
        errMsg.includes("exceeded") ||
        err?.code === 8 || // Resource exhausted code in gRPC
        err?.code === "resource-exhausted"
      ) {
        console.error("[Firebase Queue] Cloud Quota Exceeded! Sync paused, caching all data locally.");
        isQuotaExceeded = true;
        lastQuotaCheck = Date.now();

        // Put the task back at the front of the queue
        syncQueue.unshift(task);
        break; // Stop queue processing to prevent infinite loops
      }

      // For other transient errors (e.g. network timeout), retry up to 5 times
      if (task.retries < 5) {
        task.retries++;
        syncQueue.push(task); // Push to back of the queue
      }
    }

    // Small delay to avoid hammering the API
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  isProcessingQueue = false;
}
