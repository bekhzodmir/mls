import { describe, expect, it } from "vitest";
import {
  isStoreWritable,
  type KeyValueStore,
  LOGIN_HANDOFF_STORAGE_KEY,
  loadLoginHandoff,
  parseLoginHandoff,
  readStored,
  removeStored,
  saveLoginHandoff,
  writeStored,
} from "./session-store";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("storage access", () => {
  it("reads, writes and removes", () => {
    const store = memoryStore();
    expect(writeStored("k", "v", store)).toBe(true);
    expect(readStored("k", store)).toBe("v");
    removeStored("k", store);
    expect(readStored("k", store)).toBeNull();
  });

  it("probes whether progress can be kept, leaving nothing behind", () => {
    const store = memoryStore();
    expect(isStoreWritable(store)).toBe(true);
    expect(store.data.size).toBe(0);
    expect(isStoreWritable(brokenStore)).toBe(false);
    expect(isStoreWritable(null)).toBe(false);
  });

  it("never throws when storage is blocked or missing", () => {
    expect(readStored("k", brokenStore)).toBeNull();
    expect(writeStored("k", "v", brokenStore)).toBe(false);
    expect(() => removeStored("k", brokenStore)).not.toThrow();
    expect(readStored("k", null)).toBeNull();
    expect(writeStored("k", "v", null)).toBe(false);
  });
});

describe("login hand-off", () => {
  it("keeps a normalized phone and a Telegram greeting", () => {
    expect(
      parseLoginHandoff(
        JSON.stringify({ phone: "90 123 45 67", telegram: { firstName: " Aziz ", username: "aziz_r" } }),
      ),
    ).toEqual({ phone: "+998901234567", telegram: { firstName: "Aziz", username: "aziz_r" } });
  });

  it("drops anything malformed", () => {
    expect(parseLoginHandoff(null)).toEqual({});
    expect(parseLoginHandoff("{not json")).toEqual({});
    expect(parseLoginHandoff(JSON.stringify({ phone: "12", telegram: { firstName: "" } }))).toEqual({});
    expect(parseLoginHandoff(JSON.stringify([1, 2]))).toEqual({});
  });

  it("merges later steps into earlier ones", () => {
    const store = memoryStore();
    saveLoginHandoff({ telegram: { firstName: "Aziz" } }, store);
    saveLoginHandoff({ phone: "+998901234567" }, store);
    expect(loadLoginHandoff(store)).toEqual({ phone: "+998901234567", telegram: { firstName: "Aziz" } });
    expect(store.data.has(LOGIN_HANDOFF_STORAGE_KEY)).toBe(true);
  });
});
