import { vi } from "vitest";

export function installChrome() {
  const store: Record<string, unknown> = {};
  const chromeMock = {
    runtime: { id: "test", getURL: (p: string) => `chrome-extension://test/${p}` },
    contextMenus: { removeAll: vi.fn((cb?: () => void) => cb?.()), create: vi.fn() },
    scripting: { executeScript: vi.fn().mockResolvedValue([]) },
    tabs: { sendMessage: vi.fn() },
    windows: { create: vi.fn().mockResolvedValue({}) },
    storage: {
      local: {
        get: vi.fn(async (k: string) => (k in store ? { [k]: store[k] } : {})),
        set: vi.fn(async (o: Record<string, unknown>) => { Object.assign(store, o); }),
        remove: vi.fn(async (k: string) => { delete store[k]; }),
      },
    },
  };
  vi.stubGlobal("chrome", chromeMock);
  return { chrome: chromeMock, store };
}
