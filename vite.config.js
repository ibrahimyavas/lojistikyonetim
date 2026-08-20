import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // tailwindcss() burada olmadan src/index.css'teki @import "tailwindcss/..."
  // satırları düz metin olarak kalır, hiç utility class üretilmez - yeni
  // (Optimizasyon grubu) dashboard'lar Tailwind class'larıyla yazıldığı için
  // bu eklenti şart.
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
});
