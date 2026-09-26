/**
 * User & Access Filter - Filters Deleted per User Request
 * All usernames and profiles are allowed. No guest restrictions.
 */

export const ALLOWED_USERNAMES = new Set<string>();

export function isAllowedUsername(_username?: string, _uid?: string, _currentUid?: string): boolean {
  return true;
}

export function isGuestUser(_username?: string): boolean {
  return false;
}

/**
 * Clean up expired stale temporary presence or voice docs older than 2 hours
 */
export async function purgeNonAllowedUsers(): Promise<number> {
  return 0;
}
