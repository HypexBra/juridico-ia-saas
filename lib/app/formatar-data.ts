/**
 * Formatação de data/hora em pt-BR fixada no fuso de Brasília.
 *
 * `timestamptz` do Postgres chega como instante UTC absoluto — formatado
 * sem `timeZone` explícito, `toLocaleString`/`toLocaleDateString` usa o
 * fuso PADRÃO DO AMBIENTE. Em Server Components (Vercel roda em UTC), isso
 * mostra a hora 3h atrasada em relação à hora real de Brasília (ex: painel
 * admin exibindo às 14h algo que aconteceu às 17h). Client Components não
 * sofrem disso (usam o fuso do navegador do usuário), mas usar este helper
 * em ambos os lados evita o mesmo bug reaparecer.
 *
 * NÃO usar para campos `date` puros (sem hora, ex: vencimento de parcela,
 * data de prazo) formatados via o truque `${iso}T00:00:00` — ali a ausência
 * de timezone é INTENCIONAL (cancela a interpretação também sem timezone),
 * fixar o fuso ali quebraria o dia exibido.
 */
const FUSO_HORARIO_PADRAO = "America/Sao_Paulo";

export function formatarDataHora(iso: string | Date, opcoes?: Intl.DateTimeFormatOptions): string {
  const data = typeof iso === "string" ? new Date(iso) : iso;
  return data.toLocaleString("pt-BR", { timeZone: FUSO_HORARIO_PADRAO, ...opcoes });
}

export function formatarData(iso: string | Date, opcoes?: Intl.DateTimeFormatOptions): string {
  const data = typeof iso === "string" ? new Date(iso) : iso;
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO_HORARIO_PADRAO, ...opcoes });
}

export function formatarHora(iso: string | Date, opcoes?: Intl.DateTimeFormatOptions): string {
  const data = typeof iso === "string" ? new Date(iso) : iso;
  return data.toLocaleTimeString("pt-BR", { timeZone: FUSO_HORARIO_PADRAO, ...opcoes });
}
