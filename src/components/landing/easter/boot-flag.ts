export const BOOT_FLAG = "cbb-booted";

export function shouldBoot(storage: Pick<Storage, "getItem"> | null, key = BOOT_FLAG): boolean {
  if (!storage) return false;
  return storage.getItem(key) === null;
}

export function markBooted(storage: Pick<Storage, "setItem"> | null, key = BOOT_FLAG): void {
  storage?.setItem(key, "1");
}

export function clearBootFlag(storage: Pick<Storage, "removeItem"> | null, key = BOOT_FLAG): void {
  storage?.removeItem(key);
}

// Reading the property itself throws when cookies are blocked, so every call site goes through this.
export function safeSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
