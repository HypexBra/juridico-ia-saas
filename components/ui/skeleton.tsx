import type { HTMLAttributes } from "react";

/**
 * Bloco de esqueleto genérico usado nos `loading.tsx` do dashboard. Existe
 * para dar feedback visual IMEDIATO durante a navegação entre rotas do
 * App Router (via streaming/Suspense automático do Next quando há
 * `loading.tsx` no mesmo segmento de um `page.tsx` async) — a navegação
 * troca de tela na hora, e só o conteúdo real "estufa" por cima quando os
 * dados terminam de chegar do Supabase. Sem isso, o usuário fica com a
 * tela anterior congelada até a resposta completa do servidor.
 */
export function Skeleton({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton rounded-lg ${className}`}
      {...rest}
    />
  );
}
