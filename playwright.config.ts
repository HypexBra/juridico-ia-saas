import { defineConfig, devices } from "@playwright/test";

/**
 * Infraestrutura de testes E2E (Fase 29).
 *
 * PRÉ-REQUISITO: `npm run start` serve o build de produção (`next start`),
 * então é preciso rodar `npm run build` antes de executar esta suíte.
 *
 * Execução: `npm run test:e2e` (ou `npx playwright test`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Tempo por teste: smoke de páginas inteiras com redirect de middleware. */
  timeout: 30_000,
  /* Smoke determinístico: sem retry mascarando instabilidade real. */
  retries: 0,
  /* Um worker só: evita competir por RAM (~5,7GB na máquina local) e
     mantém a ordem de execução previsível contra um único servidor. */
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    /* Chromium apenas: único browser instalado nesta máquina. */
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* Sobe o servidor de produção na porta 3100 antes da suíte.
     Requer `.next` buildado (`npm run build` roda antes).
     Em CI não reusa servidor existente; local, sim (iteração rápida). */
  webServer: {
    command: "npm run start",
    port: 3100,
    env: {
      PORT: "3100",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
