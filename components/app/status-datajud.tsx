/**
 * STATUS DATAJUD (CNJ) — nota de honestidade de integração.
 *
 * Regra do produto: integração INATIVA nunca vira dado simulado. Enquanto o
 * escritório não tem credenciamento na API pública do DataJud, esta nota diz
 * exatamente isso e aponta o caminho real de solicitação. Com a chave
 * presente, confirma a conexão — sem inventar consultas que ainda não
 * existem (a integração efetiva vem depois).
 */
const WIKI_DATAJUD = "https://datajud-wiki.cnj.jus.br/api-publica/";

export function StatusDataJud() {
  // Runtime de servidor: env só existe no Node (guard evita crash em bundle
  // sem `process`, ex. pré-renderização fora do servidor).
  const conectado =
    typeof process !== "undefined" && Boolean(process.env.DATAJUD_API_KEY);

  if (conectado) {
    return (
      <p className="text-xs text-muted">
        DataJud conectado. Consultas diretas à API pública do CNJ serão habilitadas nesta tela.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted">
      Consulta DataJud (CNJ): aguardando credenciamento gratuito — solicite em{" "}
      <a
        href={WIKI_DATAJUD}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-ice"
      >
        datajud-wiki.cnj.jus.br/api-publica
      </a>
      . Enquanto isso, os diários oficiais são monitorados via DJEN.
    </p>
  );
}
