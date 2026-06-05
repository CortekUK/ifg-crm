"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type ThemeCtx = { theme: string; toggle: () => void };
const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("dark");

  // Adopt whatever the no-flash inline script already set on <html>.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("ifg-theme", theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

// Inline script string: set data-theme before paint to avoid a flash.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('ifg-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
