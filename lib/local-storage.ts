import { Platform } from "react-native";

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStorage = new Map<string, string>();

const webStorage: StorageLike = {
  async getItem(key) {
    if (typeof window === "undefined" || !window.localStorage) {
      return memoryStorage.get(key) ?? null;
    }

    return window.localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof window === "undefined" || !window.localStorage) {
      memoryStorage.set(key, value);
      return;
    }

    window.localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (typeof window === "undefined" || !window.localStorage) {
      memoryStorage.delete(key);
      return;
    }

    window.localStorage.removeItem(key);
  }
};

let nativeStorage: StorageLike | null = null;

const getNativeStorage = () => {
  if (!nativeStorage) {
    nativeStorage = require("@react-native-async-storage/async-storage")
      .default as StorageLike;
  }

  return nativeStorage;
};

export const localStorageAdapter: StorageLike =
  Platform.OS === "web" ? webStorage : getNativeStorage();

