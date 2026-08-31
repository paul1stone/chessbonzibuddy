export const BOOT_FLAG = "cbb-booted";

export function shouldBoot(storage: Pick<Storage, "getItem"> | null): boolean {
  if (!storage) return false;
  return storage.getItem(BOOT_FLAG) === null;
}

export function markBooted(storage: Pick<Storage, "setItem"> | null): void {
  storage?.setItem(BOOT_FLAG, "1");
}

export function clearBootFlag(storage: Pick<Storage, "removeItem"> | null): void {
  storage?.removeItem(BOOT_FLAG);
}

// Reading the property itself throws when cookies are blocked, so every call site goes through this.
export function safeSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
