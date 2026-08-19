import { Fragment } from "react";

/**
 * Renderizador minimalista de Markdown para as respostas da IA (que seguem o
 * formato pedido no system prompt: títulos, listas e negrito). Evita puxar
 * uma dependência de markdown completa só para isso.
 */

function renderInline(texto: string, keyPrefix: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ice">
          {parte.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{parte}</Fragment>;
  });
}

export function MarkdownLite({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  const blocos: React.ReactNode[] = [];
  let listaAtual: string[] = [];

  function fecharLista(key: string) {
    if (listaAtual.length === 0) return;
    blocos.push(
      <ul key={key} className="ml-5 list-disc space-y-1">
        {listaAtual.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>
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
          {renderInline(linha.replace(/^###\s+/, ""), key)}
        </h4>,
      );
    } else if (/^##\s+/.test(linha)) {
      blocos.push(
        <h3 key={key} className="mt-4 font-display text-base font-semibold text-silver-2">
          {renderInline(linha.replace(/^##\s+/, ""), key)}
        </h3>,
      );
    } else if (/^#\s+/.test(linha)) {
      blocos.push(
        <h2 key={key} className="mt-4 font-display text-lg font-semibold text-silver-2">
          {renderInline(linha.replace(/^#\s+/, ""), key)}
        </h2>,
      );
    } else if (linha.trim() === "") {
      blocos.push(<div key={key} className="h-2" />);
    } else {
      blocos.push(
        <p key={key} className="leading-relaxed">
          {renderInline(linha, key)}
        </p>,
      );
    }
  });
  fecharLista("final-lista");

  return <div className="space-y-1 text-sm text-ice-2">{blocos}</div>;
}
