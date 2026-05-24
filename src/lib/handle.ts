const HANDLE_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

const RESERVED_HANDLES = new Set([
  "signup",
  "login",
  "dashboard",
  "explore",
  "api",
  "admin",
  "www",
  "app",
]);

export function isValidHandle(handle: string): boolean {
  const normalized = handle.toLowerCase().trim();
  if (normalized.length < 3 || normalized.length > 30) return false;
  if (!HANDLE_REGEX.test(normalized)) return false;
  if (RESERVED_HANDLES.has(normalized)) return false;
  return true;
}

export function normalizeHandle(handle: string): string {
  return handle.toLowerCase().trim();
}
