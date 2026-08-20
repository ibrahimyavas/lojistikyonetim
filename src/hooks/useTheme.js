import { useCallback, useEffect, useState } from "react";

// null = "sistemi izle" (no explicit choice yet - the @media query in
// index.css decides). Once the user toggles, we pin an explicit value and
// remember it: bare :root holds the dark defaults, an explicit [data-theme]
// attribute overrides in either direction, prefers-color-scheme only
// matters until that happens.
const KEY = "lojistik:tema";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const active = current || (systemPrefersDark() ? "dark" : "light");
      const next = active === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // storage unavailable - the choice just won't survive a reload
      }
      return next;
    });
  }, []);

  return { theme: theme || (systemPrefersDark() ? "dark" : "light"), toggleTheme };
}
