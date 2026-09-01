import { Fragment } from "react";

/**
 * Renderizador minimalista de Markdown para as respostas da IA (que seguem o
 * formato pedido no system prompt: títulos, listas e negrito). Evita puxar
 * uma dependência de markdown completa só para isso.
 */

const PADRAO_CITACAO_DOC = /^\[Doc\s*#(\d+)\]$/i;

/**
 * `citacoesInvalidas`: números de "[Doc #N]" que `lib/rag/citacoes.ts`
 * confirmou NÃO existirem no contexto injetado nesta mensagem (ver
 * app/app/chat/actions.ts / app/api/chat/mensagem/route.ts). Inspirado na
 * validação de citação colorida do "Jus IA" (Jusbrasil) — verde = confirmada,
 * vermelho = o modelo citou um doc que não foi de fato recuperado.
 */
function renderInline(texto: string, keyPrefix: string, citacoesInvalidas?: number[] | null) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\[Doc\s*#\d+\])/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ice">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    const matchCitacao = parte.match(PADRAO_CITACAO_DOC);
    if (matchCitacao) {
      const numero = Number(matchCitacao[1]);
      const invalida = citacoesInvalidas?.includes(numero) ?? false;
      return (
        <span
          key={`${keyPrefix}-${i}`}
          title={invalida ? "Citação não encontrada no contexto recuperado — possível alucinação" : "Citação confirmada no contexto recuperado"}
          className={`mx-0.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold ${
            invalida
              ? "bg-red-500/15 text-red-500"
              : "bg-emerald-500/15 text-emerald-500"
          }`}
        >
          {parte}
        </span>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{parte}</Fragment>;
  });
}

export function MarkdownLite({ texto, citacoesInvalidas }: { texto: string; citacoesInvalidas?: number[] | null }) {
  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let listaAtual: string[] = [];

  function fecharLista(key: string) {
    if (listaAtual.length === 0) return;
    blocos.push(
      <ul key={key} className="ml-5 list-disc space-y-1">
        {listaAtual.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-li-${i}`, citacoesInvalidas)}</li>
        ))}
      </ul>,
    );
    listaAtual = [];
  }

  linhas.forEach((linhaBruta, idx) => {
    const linha = linhaBruta.trimEnd();
    const key = `b-${idx}`;

    if (/^\s*[-*]\s+/.test(linha)) {
      listaAtual.push(linha.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    fecharLista(`${key}-lista`);

    if (/^###\s+/.test(linha)) {
      blocos.push(
        <h4 key={key} className="mt-3 font-display text-sm font-semibold text-silver-2">
          {renderInline(linha.replace(/^###\s+/, ""), key, citacoesInvalidas)}
        </h4>,
      );
    } else if (/^##\s+/.test(linha)) {
      blocos.push(
        <h3 key={key} className="mt-4 font-display text-base font-semibold text-silver-2">
          {renderInline(linha.replace(/^##\s+/, ""), key, citacoesInvalidas)}
        </h3>,
      );
    } else if (/^#\s+/.test(linha)) {
      blocos.push(
        <h2 key={key} className="mt-4 font-display text-lg font-semibold text-silver-2">
          {renderInline(linha.replace(/^#\s+/, ""), key, citacoesInvalidas)}
        </h2>,
      );
    } else if (linha.trim() === "") {
      blocos.push(<div key={key} className="h-2" />);
    } else {
      blocos.push(
        <p key={key} className="leading-relaxed">
          {renderInline(linha, key, citacoesInvalidas)}
        </p>,
      );
    }
  });
  fecharLista("final-lista");

  return <div className="space-y-1 text-sm text-ice-2">{blocos}</div>;
}
