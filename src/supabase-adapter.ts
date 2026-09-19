// ============================================================================
// Unlimited Zero-Quota Database Adapter (Universal Vercel & Node Engine)
// Seamless Drop-In Replacement for Supabase with 0 Quotas & Forever Free Tier
// ============================================================================

import {
  universalDB,
  storageEngine,
  db as universalDbRef,
  OperationType,
  handleFirestoreError,
  toTimestampMs,
  compareMessagesChronological,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  sendBroadcastSignal,
  subscribeBroadcastSignals,
} from "./lib/database";

// Re-export storage engine as cassandra / storage for legacy component bindings
export const cassandra = {
  storage: storageEngine,
};

export const db = universalDbRef;

export {
  OperationType,
  handleFirestoreError,
  toTimestampMs,
  compareMessagesChronological,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  sendBroadcastSignal,
  subscribeBroadcastSignals,
  universalDB,
};
