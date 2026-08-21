import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` só resolve para o marcador no-op (`empty.js`) sob a
      // condição de export "react-server", que o Next configura no build
      // real; o Vitest roda em Node puro e cairia no `index.js` (que lança
      // erro de propósito) sem este alias.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
