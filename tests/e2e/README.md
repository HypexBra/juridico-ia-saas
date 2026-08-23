# Testes E2E (Playwright)

Smoke E2E contra o **build de produção** (`next start`), não contra `next dev`.

## Pré-requisitos

```bash
npm run build                      # OBRIGATÓRIO: `npm run start` serve o .next buildado
npx playwright install chromium    # único browser usado (sem --with-deps)
```

> Se faltar dependência de sistema no chromium, rode:
> `sudo npx playwright install-deps chromium`
> (equivalente manual: `sudo apt-get install <libs listadas em ldd …/chrome-linux64/chrome | grep 'not found'>`)

Também é preciso `.env.local` válido (Supabase): o middleware consulta a sessão em toda navegação.

## Execução

```bash
npm run test:e2e          # sobe o servidor na porta 3100 e roda a suíte
npx playwright test --list # só lista os testes (valida config/specs)
```

O `playwright.config.ts` usa `webServer: npm run start @ :3100` com `reuseExistingServer` fora de CI.

## Cobertura por spec

| Spec | Cobre |
|---|---|
| `landing.spec.ts` | `/` renderiza h1 "O trabalho jurídico, finalmente organizado", texto principal visível e **zero erros de console** (warnings tolerados) |
| `auth.spec.ts` | `/login` renderiza form (input e-mail); submissão vazia fica no login; `/app` sem sessão é redirecionado pelo middleware de volta para `/login` |
| `health.spec.ts` | `/manifest.webmanifest` responde 200 (sanity de static serving) |

## Convenções

- Títulos e comentários em pt-BR.
- `workers: 1` e `retries: 0`: smoke determinístico, sem mascarar instabilidade.
- Artefatos gerados (`test-results/`, `playwright-report/`) estão gitignored.
