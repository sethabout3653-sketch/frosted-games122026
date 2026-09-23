import { db, collection, getDocs, deleteDoc, doc } from "../supabase-adapter";

export const ALLOWED_USERNAMES = new Set(["giggity", "sethplayz12", "logicgatesobviously"]);

export function isAllowedUsername(username?: string, uid?: string, currentUid?: string): boolean {
  if (uid && currentUid && uid === currentUid) return true;
  if (!username) return false;
  const clean = username.trim().toLowerCase();
  return ALLOWED_USERNAMES.has(clean);
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

  // If match one of the allowed usernames, they are allowed
  if (ALLOWED_USERNAMES.has(clean)) {
    return false;
  }

  // Also, check if it matches the default auto-generated format like Adjective_Noun_123
  const parts = clean.split("_");
  if (parts.length === 3 && !isNaN(Number(parts[2]))) {
    return true;
  }

  return false;
}

/**
 * Purges all users from database collections except "giggity", "SethPlayz12", and "logicgatesobviously"
 */
export async function purgeNonAllowedUsers(): Promise<number> {
  let totalDeleted = 0;
  const targetCollections = [
    "presence",
    "voice_users",
    "user_profiles",
    "banned_users",
    "moderation_actions",
    "moderation_banned_names",
    "user_mutes",
    "user_warnings",
  ];

  for (const colName of targetCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap || snap.empty) continue;

      const deletePromises: Promise<void>[] = [];

      snap.forEach((docSnap: any) => {
        const data = typeof docSnap.data === "function" ? docSnap.data() : (docSnap.data || docSnap);
        const docId = docSnap.id || "";
        const username = (data?.username || data?.targetUsername || data?.bannedBy || docId || "").toString().trim().toLowerCase();

        // If not in allowed set, delete permanently
        if (username && !ALLOWED_USERNAMES.has(username) && !ALLOWED_USERNAMES.has(docId.toLowerCase())) {
          deletePromises.push(
            deleteDoc(doc(db, colName, docId)).then(() => {
              totalDeleted++;
            }).catch(() => {})
          );
        }
      });

      await Promise.all(deletePromises);
    } catch (e) {
      console.warn(`Purge error on collection ${colName}:`, e);
    }
  }

  return totalDeleted;
}
