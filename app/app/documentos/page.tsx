import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { listarAnalisesDocumentoAction } from "./actions";
import type { StatusAnaliseDocumento, TipoArquivoAnaliseDocumento } from "@/lib/types";

export const metadata = { title: "Documentos — Jurídico IA" };

const STATUS_TONE: Record<StatusAnaliseDocumento, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAnaliseDocumento, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

const TIPO_ARQUIVO_LABEL: Record<TipoArquivoAnaliseDocumento, string> = {
  pdf: "PDF",
  docx: "DOCX",
  imagem: "Imagem",
};

/**
 * Lista de Document Intelligence (`/app/documentos`, ADR 0011 seção 6) — nova
 * seção standalone, não uma aba dentro de `/app/fichas/[id]`, porque nem
 * todo documento a analisar pertence a uma ficha aberta (mesmo argumento já
 * usado para `analises_risco_contratual.ficha_caso_id` nullable).
 */
export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tipo?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "analise_documento");
  const { status: statusFiltro, tipo: tipoFiltro } = await searchParams;

  const resultado = temAcesso ? await listarAnalisesDocumentoAction() : null;
  const todasAnalises = resultado?.ok ? resultado.analises : [];
  const analises = todasAnalises.filter((analise) => {
    if (statusFiltro && analise.status !== statusFiltro) return false;
    if (tipoFiltro && analise.tipo_arquivo !== tipoFiltro) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Documentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Análise individual ou em lote de documentos avulsos (contratos, petições, procurações etc.) — resumo,
            classificação, cláusulas, entidades e riscos, com comparação entre duas versões.
          </p>
        </div>
        {temAcesso && (
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/app/documentos/novo" size="sm">
              Analisar documento
            </LinkButton>
            <LinkButton href="/app/documentos/lote" variant="secondary" size="sm">
              Analisar em lote
            </LinkButton>
          </div>
        )}
      </div>

      {!temAcesso ? (
        <Card>
          <CardTitle className="mb-1">Document Intelligence</CardTitle>
          <p className="text-sm text-muted">
            Análise individual e em lote de documentos avulsos (resumo, classificação, cláusulas, entidades e
            riscos) é uma feature do <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
            <Link href="/app/perfil" className="text-ice underline underline-offset-2">
              Meu perfil
            </Link>{" "}
            para liberar.
          </p>
        </Card>
      ) : (
        <Card>
          <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
            <div>
              <label htmlFor="status" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFiltro ?? ""}
                className="rounded-lg border border-white/10 bg-navy-2 px-3.5 py-2.5 text-sm text-ice outline-none focus:border-silver/60 focus:ring-1 focus:ring-silver/30"
              >
                <option value="">Todos</option>
                <option value="processando">Processando</option>
                <option value="pronto">Pronta</option>
                <option value="erro">Erro</option>
              </select>
            </div>
            <div>
              <label htmlFor="tipo" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
                Tipo de arquivo
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={tipoFiltro ?? ""}
                className="rounded-lg border border-white/10 bg-navy-2 px-3.5 py-2.5 text-sm text-ice outline-none focus:border-silver/60 focus:ring-1 focus:ring-silver/30"
              >
                <option value="">Todos</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="imagem">Imagem</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-navy-3 px-4 py-2.5 text-sm font-medium text-ice hover:bg-navy-3/70"
            >
              Filtrar
            </button>
            {(statusFiltro || tipoFiltro) && (
              <Link href="/app/documentos" className="text-xs font-medium text-silver hover:text-silver-2">
                Limpar filtros
              </Link>
            )}
          </form>

          {!resultado?.ok ? (
            <p className="text-sm text-red-400">{resultado?.error ?? "Não foi possível carregar as análises."}</p>
          ) : analises.length === 0 ? (
            <p className="text-sm text-muted">
              {todasAnalises.length === 0
                ? "Nenhum documento analisado ainda."
                : "Nenhuma análise encontrada com os filtros selecionados."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {analises.map((analise) => (
                <li key={analise.id} className="py-3">
                  <Link
                    href={`/app/documentos/${analise.id}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">{analise.nome_arquivo}</p>
                      <p className="text-xs text-muted">
                        {new Date(analise.criado_em).toLocaleString("pt-BR")} ·{" "}
                        {TIPO_ARQUIVO_LABEL[analise.tipo_arquivo]}
                        {analise.resultado_analise ? ` · ${analise.resultado_analise.tipoDocumento}` : ""}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
