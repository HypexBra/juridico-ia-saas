"use client";

import { useTheme } from "./use-theme";

function IconSol({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.55 1.55M18.05 18.05l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.55-1.55M18.05 5.95l1.55-1.55" />
    </svg>
  );
}

function IconLua({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7z" />
    </svg>
  );
}

interface ThemeToggleProps {
  /** Classes do botão — cada superfície de host (nav claro / sidebar do
   * app) já tem sua própria paleta de hover, então o estilo do "casco" do
   * botão é responsabilidade de quem monta, não deste componente. */
  className?: string;
  /** Mostra o rótulo "Claro"/"Escuro" ao lado do ícone (usado na sidebar
   * do app, onde há espaço horizontal); a nav da landing usa só o ícone. */
  comRotulo?: boolean;
}

/**
 * Toggle de tema claro/escuro. Acessível: `<button>` nativo (foco/Enter/
 * Espaço de graça), `aria-label` descreve a AÇÃO do clique (não o estado
 * atual — "Ativar modo escuro" enquanto o tema é claro), `aria-pressed`
 * expõe o estado atual pra tecnologia assistiva sem depender só do ícone.
 */
export function ThemeToggle({ className, comRotulo = false }: ThemeToggleProps) {
  const { tema, alternarTema } = useTheme();
  const escuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      aria-pressed={escuro}
      className={className}
    >
      {escuro ? <IconSol className="h-[18px] w-[18px]" /> : <IconLua className="h-[18px] w-[18px]" />}
      {comRotulo ? <span>{escuro ? "Modo claro" : "Modo escuro"}</span> : null}
    </button>
  );
}
