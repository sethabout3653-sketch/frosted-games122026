/**
 * Content Moderation - Filters Deleted per User Request
 * All messages, GIFs, and attachments are permitted without filtering.
 */

export interface ModerationResult {
  safe: boolean;
  category?: string;
  reason?: string;
}

export const ALLOWED_EXCEPTIONS = new Set<string>();

export function normalizeForSafety(text: string): string {
  return text ? text.toLowerCase().trim() : "";
}

/**
 * Moderation check - Always returns safe: true (filters deleted)
 */
export function checkTextModeration(_input: string, _customBlacklist: string[] = []): ModerationResult {
  return { safe: true };
}

/**
 * GIF query safety check - Always returns safe: true (filters deleted)
 */
export function isQuerySafeForGif(_query: string): { safe: boolean; reason?: string } {
  return { safe: true };
}
