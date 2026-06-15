"use client";

import { useEffect, useState } from "react";
import type { Receiver } from "@/lib/types";

const KEY = "wave_user";
const EVENT = "wave_user_change";

export function getStoredUser(): Receiver {
  if (typeof window === "undefined") return "محمد";
  const value = window.localStorage.getItem(KEY);
  return value === "عبدالله" ? "عبدالله" : "محمد";
}

export function useCurrentUser() {
  const [user, setUser] = useState<Receiver>(() => getStoredUser());

  useEffect(() => {
    const handler = () => setUser(getStoredUser());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setCurrentUser = (next: Receiver) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVENT));
    setUser(next);
  };

  const toggleUser = () => setCurrentUser(user === "محمد" ? "عبدالله" : "محمد");

  return { user, setCurrentUser, toggleUser };
}
