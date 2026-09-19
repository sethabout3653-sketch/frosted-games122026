import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc, setDoc, deleteDoc, collection, limit, query, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Keep adminAuth for any token verification if needed
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
export const adminAuth = getAuth();

// Initialize Client SDK with API Key to properly authenticate writes to the named Firestore database
const clientApp = !getClientApps().length ? initializeClientApp(firebaseConfig) : getClientApp();
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || "(default)");

// Compatibility wrapper matching the exact adminDb API signature used in the codebase
export const adminDb = {
  collection: (colName: string) => {
    return {
      doc: (docId: string) => {
        return {
          set: async (data: any, options?: { merge?: boolean }) => {
            return setDoc(doc(clientDb, colName, docId), data, { merge: options?.merge ?? false });
          },
          delete: async () => {
            return deleteDoc(doc(clientDb, colName, docId));
          }
        };
      },
      limit: (num: number) => {
        return {
          get: async () => {
            const q = query(collection(clientDb, colName), limit(num));
            const snapshot = await getDocs(q);
            return {
              empty: snapshot.empty,
              docs: snapshot.docs.map(d => ({
                id: d.id,
                data: () => d.data()
              }))
            };
          }
        };
      }
    };
  }
} as any;
