const AUTH_TOKEN_KEY = "showprep-auth-token";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Keeps `showprep_token` cookie in sync with the session token (for SSE and other cookie-only endpoints). */
export function syncAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `showprep_token=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } else {
    document.cookie = "showprep_token=; Path=/; Max-Age=0; SameSite=Lax";
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
  syncAuthCookie(token);
}
