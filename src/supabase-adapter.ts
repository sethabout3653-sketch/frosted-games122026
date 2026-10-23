import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import {
  storageEngine,
  sendBroadcastSignal,
  subscribeBroadcastSignals,
  universalDB,
} from "./lib/database";

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
  console.warn(`[Firestore] Operation ${op} on ${path}:`, error);
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

export const cassandra = {
  storage: storageEngine,
};

export {
  db,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
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
