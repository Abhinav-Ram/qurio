// Hardcoded admin auth (placeholder until real auth lands).
const KEY = "ii.session.v1";
const VALID_USER = "admin";
const VALID_PASS = "admin";

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function login(username: string, password: string): boolean {
  if (username === VALID_USER && password === VALID_PASS) {
    window.localStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
