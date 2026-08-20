import { useCallback, useState } from "react";

// "top" (yatay sekme şeridi) vs "sidebar" (sol menü) - kullanıcı ikisini
// canlıda deneyip karar verebilsin diye bir geçiş düğmesi. Tercih
// localStorage'da kalıcı, aynı hooks/useTheme.js deseninde.
const KEY = "lojistik:navDuzeni";
const DEFAULT_LAYOUT = "top";

export function useNavLayout() {
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem(KEY) || DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  });

  const toggleLayout = useCallback(() => {
    setLayout((current) => {
      const next = current === "top" ? "sidebar" : "top";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // storage unavailable - the choice just won't survive a reload
      }
      return next;
    });
  }, []);

  return { layout, toggleLayout };
}
