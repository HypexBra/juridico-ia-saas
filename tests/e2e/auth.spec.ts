import { expect, test } from "@playwright/test";

test.describe("Autenticação", () => {
  test("/login renderiza o formulário de autenticação", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Input de e-mail associado ao label "E-mail" (app/login/login-form.tsx).
    const email = page.getByLabel("E-mail");
    await expect(email).toBeVisible();

    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("submissão vazia não sai do /login e rota interna /app redireciona de volta", async ({
    page,
  }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Credenciais vazias: os inputs são `required`, então a validação nativa
    // bloqueia o envio — o usuário permanece no /login (nunca chega a /app).
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Proteção de rota interna: sem sessão, /app/dashboard é redirecionado
    // para /login pela verificação server-side (middleware fail-open + redirect
    // em getUsuarioAtual/page).
    // O redirect é server-side (307), então networkidle já reflete a URL final.
    await page.goto("/app/dashboard", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login$/);
  });
});
