"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeCtx {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(Ctx);
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const value = localStorage.getItem("theme");
    return isTheme(value) ? value : "system";
  } catch {
    return "system";
  }
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Theme persistence is best-effort; the live theme should still change.
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (typeof window.matchMedia !== "function") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(resolved: "light" | "dark") {
  const cl = document.documentElement.classList;
  cl.remove("light", "dark");
  cl.add(resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  const [resolvedTheme, setResolved] = useState<"light" | "dark">(() =>
    resolve(theme),
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    persistTheme(t);
    const r = resolve(t);
    setResolved(r);
    applyTheme(r);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const handler = () => {
      if (theme === "system") {
        const r = getSystemTheme();
        setResolved(r);
        applyTheme(r);
      }
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [theme]);

  // Sync on mount
  useEffect(() => {
    applyTheme(resolve(theme));
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
