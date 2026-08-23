import { expect, test } from "@playwright/test";

test.describe("Health checks", () => {
  test("/manifest.webmanifest responde 200 (static serving saudável)", async ({
    request,
  }) => {
    // Sanity de static serving: o webmanifest (gerado por app/manifest.ts)
    // deve estar disponível com status OK — prova que o servidor de produção
    // está servindo rotas públicas sem passar por autenticação.
    const response = await request.get("/manifest.webmanifest");

    expect(response.status()).toBe(200);
    expect(response.ok()).toBeTruthy();
  });
});
