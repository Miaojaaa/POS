"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Modules that require Owner PIN
export const OWNER_LOCKED_MODULES = new Set(["REPORTS", "HR", "SETTINGS"]);

// Route prefixes that require Owner unlock
export const OWNER_LOCKED_ROUTES = ["/reports", "/hr", "/settings"];

const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = "owner_unlock_until";

interface OwnerLockContextValue {
  isUnlocked: boolean;
  remainingSeconds: number;
  unlock: () => void;
  lock: () => void;
  isRouteLocked: (pathname: string) => boolean;
}

const OwnerLockContext = createContext<OwnerLockContextValue>({
  isUnlocked: false,
  remainingSeconds: 0,
  unlock: () => {},
  lock: () => {},
  isRouteLocked: () => false,
});

export function OwnerLockProvider({ children }: { children: ReactNode }) {
  const [unlockUntil, setUnlockUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, check localStorage for existing unlock
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const ts = Number(saved);
      if (ts > Date.now()) {
        setUnlockUntil(ts);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Tick every second to update remaining time
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const isUnlocked = unlockUntil > now;
  const remainingSeconds = isUnlocked ? Math.ceil((unlockUntil - now) / 1000) : 0;

  const unlock = useCallback(() => {
    const until = Date.now() + LOCK_DURATION_MS;
    setUnlockUntil(until);
    setNow(Date.now());
    localStorage.setItem(STORAGE_KEY, String(until));
  }, []);

  const lock = useCallback(() => {
    setUnlockUntil(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isRouteLocked = useCallback((pathname: string) => {
    if (isUnlocked) return false;
    return OWNER_LOCKED_ROUTES.some(prefix => pathname.startsWith(prefix));
  }, [isUnlocked]);

  // Auto-clear storage when lock expires
  useEffect(() => {
    if (unlockUntil > 0 && unlockUntil <= now) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [unlockUntil, now]);

  return (
    <OwnerLockContext.Provider value={{ isUnlocked, remainingSeconds, unlock, lock, isRouteLocked }}>
      {children}
    </OwnerLockContext.Provider>
  );
}

export function useOwnerLock() {
  return useContext(OwnerLockContext);
}
