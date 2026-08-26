import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Autorização compartilhada das rotas de cron (`app/api/cron/*`), que rodam
 * server-to-server sem nenhuma sessão de usuário e por isso só têm o
 * `CRON_SECRET` como credencial. O Vercel Cron injeta
 * `Authorization: Bearer ${CRON_SECRET}` automaticamente quando a env var
 * existe no projeto.
 *
 * Antes, cada rota repetia o mesmo par de checagens à mão. Dois motivos para
 * centralizar:
 *
 * 1. FAIL-CLOSED sem exceção. Se `CRON_SECRET` não estiver configurada, a
 *    comparação `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` compara
 *    contra a string literal "Bearer undefined" · qualquer um que mande esse
 *    header exato passa. As rotas atuais já checavam a presença da env var
 *    antes justamente por isso, mas era uma disciplina repetida em 4 arquivos,
 *    fácil de esquecer no quinto. Aqui é estrutural.
 * 2. COMPARAÇÃO EM TEMPO CONSTANTE. `!==` em string sai no primeiro byte
 *    diferente. O secret é de alta entropia e a rede acrescenta muito ruído,
 *    então explorar isso remotamente é impraticável na prática · mas
 *    `timingSafeEqual` é o mesmo custo de código e remove a discussão (é o
 *    padrão já usado nos webhooks assinados deste projeto).
 */

export type ResultadoAutorizacaoCron =
  | { ok: true }
  | { ok: false; status: 401 | 500; erro: string };

const PREFIXO_BEARER = "Bearer ";

export function autorizarChamadaCron(request: Request): ResultadoAutorizacaoCron {
  const secretEsperado = process.env.CRON_SECRET;
  if (!secretEsperado) {
    // 500, não 401: o problema é configuração do servidor, não a credencial
    // de quem chamou · devolver 401 aqui mandaria o operador caçar o secret
    // errado durante horas.
    return { ok: false, status: 500, erro: "CRON_SECRET não configurado no servidor." };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith(PREFIXO_BEARER)) {
    return { ok: false, status: 401, erro: "Não autorizado." };
  }

  const recebido = Buffer.from(authHeader.slice(PREFIXO_BEARER.length));
  const esperado = Buffer.from(secretEsperado);

  // `timingSafeEqual` lança se os buffers têm tamanhos diferentes, e o
  // próprio tamanho já é observável de fora · comparar o tamanho antes não
  // vaza nada além do que o atacante já poderia medir.
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return { ok: false, status: 401, erro: "Não autorizado." };
  }

  return { ok: true };
}
