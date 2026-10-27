/**
 * Session & Preference Persistence Helper
 * Persists recent databases, open tabs, query history, and theme settings.
 */

const STORAGE_KEY_PREFIX = 'sql_magic_';

export interface PersistedSession {
  theme: 'dark' | 'light';
  recentFiles: { name: string; timestamp: number }[];
  savedQueries: string[];
  activeSchema?: string;
}

export function saveSessionState(session: Partial<PersistedSession>): void {
  try {
    const existing = loadSessionState();
    const merged = { ...existing, ...session };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}session`, JSON.stringify(merged));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

export function loadSessionState(): PersistedSession {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}session`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore fallback
  }

  return {
    theme: 'dark',
    recentFiles: [],
    savedQueries: [],
    activeSchema: 'public',
  };
}

/**
 * Encodes a query into a shareable URL hash or search parameter.
 */
export function encodeShareableQueryUrl(sql: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('q', encodeURIComponent(sql));
  return url.toString();
}

/**
 * Extracts a shared query from URL if present.
 */
export function extractSharedQueryFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('q');
    return q ? decodeURIComponent(q) : null;
  } catch {
    return null;
  }
}
