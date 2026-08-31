import { expect, test } from "vitest";
import { BOOT_FLAG, clearBootFlag, markBooted, shouldBoot } from "./boot-flag";

const fakeStorage = () => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

test("boots only when flag unset", () => {
  const s = fakeStorage();
  expect(shouldBoot(s)).toBe(true);
  markBooted(s);
  expect(shouldBoot(s)).toBe(false);
  expect(s.store.has(BOOT_FLAG)).toBe(true);
  clearBootFlag(s);
  expect(shouldBoot(s)).toBe(true);
});

test("null storage is safe and never boots", () => {
  expect(shouldBoot(null)).toBe(false);
  markBooted(null); // must not throw
  clearBootFlag(null); // must not throw
});
