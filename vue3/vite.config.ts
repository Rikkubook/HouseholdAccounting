import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // mode=real（VITE_USE_MOCK=false）時，/api 轉發到本機 Hono 後端
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
