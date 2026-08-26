import Script from "next/script";

/**
 * Aplica a classe `.dark` no `<html>` ANTES do primeiro paint, evitando
 * flash de tema errado (FOUC): script síncrono (`strategy="beforeInteractive"`,
 * injetado no `<head>` e executado antes da hidratação/pintura do React,
 * ver docs do Next.js sobre `next/script`) — não pode ser um efeito React
 * (useEffect só roda depois do primeiro paint) nem pode ser assíncrono.
 *
 * Prioridade de resolução do tema (mesmo contrato do `next-themes`, sem
 * depender do pacote): localStorage explícito do usuário > preferência do
 * SO (`prefers-color-scheme`) > "light" como fallback final.
 *
 * `THEME_STORAGE_KEY`/`resolverTemaInicial` são reexportados por
 * `use-theme.ts` para o toggle client-side usar exatamente a mesma lógica
 * (uma única fonte da verdade para a chave de storage e a heurística).
 */
export const THEME_STORAGE_KEY = "juridico-ia-tema";

// Função serializada para dentro do script inline — precisa ser
// autocontida (sem closures externas) porque roda como texto puro no
// browser antes de qualquer bundle JS do app carregar.
const INLINE_SCRIPT = `
(function () {
  try {
    var chave = ${JSON.stringify(THEME_STORAGE_KEY)};
    var salvo = window.localStorage.getItem(chave);
    var escuro = salvo === "dark" || (salvo !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", escuro);
  } catch (erro) {
    // Ambiente sem localStorage/matchMedia (SSR estático, navegador antigo,
    // modo privado bloqueando storage): mantém o tema claro padrão em vez
    // de quebrar o carregamento da página.
  }
})();
`;

export function ThemeScript() {
  return (
    // A regra `@next/next/no-before-interactive-script-outside-document`
    // ainda assume o Pages Router (`_document.js`) — no App Router (usado
    // neste projeto) o próprio Next.js documenta o root layout como o
    // lugar correto para `beforeInteractive`, não existe `_document.js`
    // aqui. Falso positivo conhecido, não um desvio de padrão real.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-script" strategy="beforeInteractive">
      {INLINE_SCRIPT}
    </Script>
  );
}
