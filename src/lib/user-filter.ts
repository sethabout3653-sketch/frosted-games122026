import { db, collection, getDocs, deleteDoc, doc } from "../supabase-adapter";

export const ALLOWED_USERNAMES = new Set(["giggity", "sethplayz12", "logicgatesobviously"]);

export function isAllowedUsername(username?: string, _uid?: string, _currentUid?: string): boolean {
  if (!username) return false;
  const clean = username.trim().toLowerCase();
  if (!clean || clean === "anonymous") return false;
  return true;
}

export function isGuestUser(username?: string): boolean {
  if (!username) return true;
  const clean = username.trim().toLowerCase();
  
  if (clean === "anonymous" || clean === "guest" || clean.startsWith("guest_") || clean.startsWith("player_")) {
    return true;
  }

  // If explicitly signed in, they are NOT a guest!
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (window.localStorage.getItem("frosted_has_signed_in") === "true") {
        return false;
      }
    }
  } catch (e) {}

  if (ALLOWED_USERNAMES.has(clean)) {
    return false;
  }

  const parts = clean.split("_");
  if (parts.length === 3 && !isNaN(Number(parts[2]))) {
    return true;
  }

  return true;
}

/**
 * Clean up expired stale temporary presence or voice docs older than 2 hours (without purging active guests)
 */
export async function purgeNonAllowedUsers(): Promise<number> {
  let totalDeleted = 0;
  const targetCollections = [
    "presence",
    "voice_users",
  ];

  const now = Date.now();
  const cutoff = now - 2 * 60 * 60 * 1000; // 2 hours stale

  for (const colName of targetCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap || snap.empty) continue;

      const deletePromises: Promise<void>[] = [];

      snap.forEach((docSnap: any) => {
        const data = typeof docSnap.data === "function" ? docSnap.data() : (docSnap.data || docSnap);
        const docId = docSnap.id || "";
        const lastSeen = Number(data?.lastSeen || data?.timestamp || 0);

        // Only delete genuinely abandoned/stale docs older than 2 hours
        if (lastSeen > 0 && lastSeen < cutoff) {
          deletePromises.push(
            deleteDoc(doc(db, colName, docId)).then(() => {
              totalDeleted++;
            }).catch(() => {})
          );
        }
      });

      await Promise.all(deletePromises);
    } catch (e) {
      console.warn(`Clean-up note on collection ${colName}:`, e);
    }
  }

  return totalDeleted;
}
