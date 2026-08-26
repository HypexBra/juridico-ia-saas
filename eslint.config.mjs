import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código JS legado de referência (bot WhatsApp descontinuado), fora do app Next.js.
    "legacy/**",
    // Pacote de referência recebido de terceiro (P0.4 RAG diário): mantido
    // byte-a-byte como veio, para rastreabilidade do que foi entregue vs. do
    // que foi de fato integrado (ver docs/P0.4-rag-diario-integracao.md).
    // Não é código do app — não compila (usa @vercel/postgres, que o projeto
    // não tem) e não deve ser lintado.
    "docs/referencia/**",
  ]),
]);

export default eslintConfig;
