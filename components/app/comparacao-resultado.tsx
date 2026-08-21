import { Badge } from "@/components/ui/badge";
import type {
  ClausulaComparada,
  NivelCertezaAnaliseProcesso,
  ResultadoComparacaoDocumento,
  TipoMudancaClausulaComparada,
} from "@/lib/document-intelligence/tipos";

const TIPO_MUDANCA_TONE: Record<TipoMudancaClausulaComparada, "green" | "red" | "amber" | "muted"> = {
  adicionada: "green",
  removida: "red",
  alterada: "amber",
  inalterada_relevante: "muted",
};

const TIPO_MUDANCA_LABEL: Record<TipoMudancaClausulaComparada, string> = {
  adicionada: "Adicionada",
  removida: "Removida",
  alterada: "Alterada",
  inalterada_relevante: "Mantida (relevante)",
};

/** Borda lateral colorida por `tipoMudanca` — adicionada=verde, removida=vermelho, alterada=amarelo (ADR 0011, seção 6). */
const TIPO_MUDANCA_BORDA: Record<TipoMudancaClausulaComparada, string> = {
  adicionada: "border-l-green",
  removida: "border-l-red-500",
  alterada: "border-l-amber-500",
  inalterada_relevante: "border-l-white/20",
};

const CERTEZA_LABEL: Record<NivelCertezaAnaliseProcesso, string> = {
  confirmado: "Confirmado",
  inferido: "Inferido",
  nao_encontrado: "Não encontrado",
};

const CERTEZA_TONE: Record<NivelCertezaAnaliseProcesso, "green" | "silver" | "muted"> = {
  confirmado: "green",
  inferido: "silver",
  nao_encontrado: "muted",
};

function ClausulaComparadaItem({ item }: { item: ClausulaComparada }) {
  return (
    <li
      className={`rounded-lg border border-white/10 border-l-4 bg-navy-2 p-3.5 ${TIPO_MUDANCA_BORDA[item.tipoMudanca]}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Badge tone={TIPO_MUDANCA_TONE[item.tipoMudanca]}>{TIPO_MUDANCA_LABEL[item.tipoMudanca]}</Badge>
        <div className="flex items-center gap-2">
          {item.risco && (
            <Badge tone={item.risco === "alto" ? "red" : item.risco === "medio" ? "amber" : "green"}>
              Risco {item.risco}
            </Badge>
          )}
          <Badge tone={CERTEZA_TONE[item.certeza]}>{CERTEZA_LABEL[item.certeza]}</Badge>
        </div>
      </div>
      <p className="mb-2 text-sm text-ice-2">{item.resumoMudanca}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/5 bg-navy p-2.5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
            Documento A{item.paginaA !== null ? ` (pág. ${item.paginaA})` : ""}
          </p>
          <p className="text-xs text-ice-2">
            {item.trechoA ?? <span className="italic text-muted">Não existe em A</span>}
          </p>
        </div>
        <div className="rounded-md border border-white/5 bg-navy p-2.5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
            Documento B{item.paginaB !== null ? ` (pág. ${item.paginaB})` : ""}
          </p>
          <p className="text-xs text-ice-2">
            {item.trechoB ?? <span className="italic text-muted">Não existe em B</span>}
          </p>
        </div>
      </div>
    </li>
  );
}

/** Diff visual lado a lado A/B — cor por `tipoMudanca` (ADR 0011, seção 5/6). */
export function ComparacaoResultado({ resultado }: { resultado: ResultadoComparacaoDocumento }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-silver/30 bg-silver/5 p-4">
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-silver-2">Resumo geral</h4>
        <p className="whitespace-pre-wrap text-sm text-ice-2">{resultado.resumoGeral}</p>
      </div>

      {resultado.riscosIntroduzidos.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Riscos introduzidos ({resultado.riscosIntroduzidos.length})
          </h4>
          <ul className="space-y-2">
            {resultado.riscosIntroduzidos.map((item, i) => (
              <li key={i} className="rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-sm text-ice-2">
                {item.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Cláusulas comparadas ({resultado.clausulas.length})
        </h4>
        {resultado.clausulas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma cláusula com mudança relevante identificada.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.clausulas.map((item, i) => (
              <ClausulaComparadaItem key={i} item={item} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Recomendações</h4>
        {resultado.recomendacoes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma recomendação adicional.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ice-2">
            {resultado.recomendacoes.map((texto, i) => (
              <li key={i}>{texto}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
