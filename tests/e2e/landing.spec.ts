import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renderiza o hero principal sem erro fatal de console", async ({
    page,
  }) => {
    // Listener registrado ANTES da navegação para capturar todos os erros;
    // warnings são tolerados, apenas mensagens do tipo 'error' falham o teste.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[${msg.location().url}] ${msg.text()}`);
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // O h1 do hero é a promessa central da marca (components/marketing/hero.tsx).
    const h1 = page.getByRole("heading", {
      level: 1,
      name: /O trabalho jurídico,\s*finalmente organizado/,
    });
    await expect(h1).toBeVisible();

    // O texto principal precisa existir no corpo renderizado (não só no title).
    await expect(
      page.getByText(/O trabalho jurídico,\s*finalmente organizado/).first(),
    ).toBeVisible();

    // Nenhum erro de console acumulado ao final da navegação/renderização.
    expect(
      consoleErrors,
      `Erros de console na landing:\n${consoleErrors.join("\n")}`,
    ).toEqual([]);
  });
});
