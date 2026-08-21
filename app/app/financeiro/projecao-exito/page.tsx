import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  calcularProjecaoExito,
  type ContratoExitoProjecaoInput,
  type ItemSemData,
} from "@/lib/financeiro/projecao-exito";
import type { StatusParcelaHonorario, StatusProcessualFicha } from "@/lib/types";

export const metadata = { title: "Projeção de honorários de êxito — Jurídico IA" };

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

const STATUS_PARCELA_TONE: Record<StatusParcelaHonorario, "silver" | "green" | "red"> = {
  pendente: "silver",
  pago: "green",
  atrasado: "red",
};

const STATUS_PARCELA_LABEL: Record<StatusParcelaHonorario, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "2026-09" -> "set/2026" */
function formatarMesRef(mesRef: string) {
  const [ano, mes] = mesRef.split("-");
  const label = MESES_ABREV[Number(mes) - 1] ?? mes;
  return `${label}/${ano}`;
}

type FichaExitoRow = { nome_cliente: string | null; status_processual: StatusProcessualFicha };
type ParcelaExitoRow = { id: string; valor: number; vencimento: string; status: StatusParcelaHonorario };
type ContratoExitoRow = {
  id: string;
  valor_total: number | null;
  percentual_exito: number | null;
  ficha_caso: FichaExitoRow | FichaExitoRow[] | null;
  parcelas: ParcelaExitoRow[];
};

/** Extrai o primeiro item de uma relação PostgREST que pode vir como objeto único ou array. */
function primeiroItem<T>(valor: T | T[] | null): T | null {
  if (valor === null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function SecaoSemData({
  titulo,
  descricao,
  itens,
  tone,
}: {
  titulo: string;
  descricao: string;
  itens: ItemSemData[];
  tone: "silver" | "green" | "muted";
}) {
  return (
    <div>
      <CardTitle className="mb-1">
        {titulo} ({itens.length})
      </CardTitle>
      <p className="mb-3 text-xs text-muted">{descricao}</p>
      {itens.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Nenhum contrato nesta situação no momento.</p>
        </Card>
      ) : (
        <Card className="!p-0">
          <ul>
            {itens.map((item) => (
              <li
                key={item.contratoId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5 last:border-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-ice">{item.nomeCliente}</span>
                  <span className="text-xs text-muted">
                    {item.valorTotal !== null ? `${formatarMoeda(item.valorTotal)} · ` : ""}
                    {item.percentualExito !== null ? `${item.percentualExito}% de êxito` : "percentual não informado"}
                  </span>
                </div>
                <Badge tone={item.valor === null ? "muted" : tone}>
                  {item.valor === null ? "Valor indeterminado" : formatarMoeda(item.valor)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default async function ProjecaoExitoPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contratos_honorario")
    .select(
      "id, valor_total, percentual_exito, " +
        "ficha_caso:fichas_caso(nome_cliente, status_processual), " +
        "parcelas:parcelas_honorario(id, valor, vencimento, status)",
    )
    .eq("tipo", "exito")
    .order("criado_em", { ascending: false })
    .returns<ContratoExitoRow[]>();

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-ice">Projeção de honorários de êxito</h1>
        <Card className="border-red-500/30">
          <p className="text-sm text-red-300">
            Não foi possível carregar a projeção de recebíveis. Tente novamente em instantes.
          </p>
        </Card>
      </div>
    );
  }

  const contratos: ContratoExitoProjecaoInput[] = (data ?? []).map((row) => {
    const ficha = primeiroItem(row.ficha_caso);
    return {
      contratoId: row.id,
      nomeCliente: ficha?.nome_cliente ?? "Cliente sem nome",
      valorTotal: row.valor_total,
      percentualExito: row.percentual_exito,
      statusProcessual: ficha?.status_processual ?? "em_andamento",
      parcelas: row.parcelas.map((parcela) => ({
        id: parcela.id,
        valor: parcela.valor,
        vencimento: parcela.vencimento,
        status: parcela.status,
      })),
    };
  });

  const projecao = calcularProjecaoExito(contratos);
  const semNenhumContrato = contratos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Projeção de honorários de êxito</h1>
          <p className="mt-1 text-sm text-muted">
            Quanto o escritório espera receber de contratos de êxito, e quando — com base nas parcelas já
            geradas e no andamento do processo de cada caso vinculado.
          </p>
        </div>
        <LinkButton href="/app/financeiro" variant="ghost" size="sm">
          Voltar ao financeiro
        </LinkButton>
      </div>

      {semNenhumContrato ? (
        <Card>
          <p className="text-sm text-muted">
            Nenhum contrato de honorário de êxito cadastrado ainda. Cadastre um contrato do tipo &quot;Êxito&quot;
            em Financeiro para ver a projeção aqui.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Confirmado a receber</p>
              <p className="mt-2 font-display text-3xl font-bold text-ice">
                {formatarMoeda(projecao.totalConfirmadoAReceber)}
              </p>
              <p className="mt-2 text-xs text-muted">Parcelas já geradas, pendentes ou atrasadas.</p>
            </Card>

            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Aguardando parcelamento (êxito confirmado)
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-green">
                {formatarMoeda(projecao.totalConfirmadoAguardandoParcelamento)}
              </p>
              <p className="mt-2 text-xs text-muted">Casos ganhos/com acordo, sem parcelas geradas ainda.</p>
            </Card>

            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Estimado (em andamento)</p>
              <p className="mt-2 font-display text-3xl font-bold text-silver-2">
                {formatarMoeda(projecao.totalEstimadoEmAndamento)}
              </p>
              <p className="mt-2 text-xs text-muted">
                Casos ainda sem resultado — expectativa sujeita a não se concretizar.
                {projecao.quantidadeIndeterminada > 0
                  ? ` ${projecao.quantidadeIndeterminada} contrato(s) sem valor/percentual suficiente para estimar.`
                  : ""}
              </p>
            </Card>
          </div>

          <div>
            <CardTitle className="mb-4">Linha do tempo (parcelas já geradas)</CardTitle>
            {projecao.linhasMensais.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">
                  Nenhuma parcela de honorário de êxito gerada ainda — os contratos abaixo ainda dependem do
                  resultado do processo ou do parcelamento formal.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {projecao.linhasMensais.map((linha) => (
                  <Card key={linha.mesRef} className="!p-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3.5">
                      <span className="font-display text-base font-semibold text-ice">
                        {formatarMesRef(linha.mesRef)}
                      </span>
                      <span className="text-xs text-muted">
                        A receber: {formatarMoeda(linha.totalPendenteAtrasado)}
                        {linha.totalPago > 0 ? ` · Recebido: ${formatarMoeda(linha.totalPago)}` : ""}
                      </span>
                    </div>
                    <ul>
                      {linha.itens.map((item) => (
                        <li
                          key={item.parcelaId}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3 last:border-0"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium text-ice">{item.nomeCliente}</span>
                            <span className="text-xs text-muted">
                              Venc. {formatarData(item.vencimento)} · {formatarMoeda(item.valor)}
                            </span>
                          </div>
                          <Badge tone={STATUS_PARCELA_TONE[item.status]}>{STATUS_PARCELA_LABEL[item.status]}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <SecaoSemData
            titulo="Aguardando resultado do processo"
            descricao="Casos de êxito ainda em andamento — o valor é uma estimativa (valor total × percentual acordado) e não está confirmado nem tem data de recebimento."
            itens={projecao.aguardandoResultado}
            tone="silver"
          />

          <SecaoSemData
            titulo="Aguardando parcelamento"
            descricao="Casos com êxito já confirmado (ganho ou acordo homologado), mas ainda sem parcelas de honorário geradas. Gere o parcelamento no contrato para dar uma data a este valor."
            itens={projecao.aguardandoParcelamento}
            tone="green"
          />

          <SecaoSemData
            titulo="Encerrados sem honorário de êxito"
            descricao="Casos perdidos ou arquivados sem parcelas geradas — não entram em nenhum total de expectativa de receita."
            itens={projecao.encerradosSemRecebiveis}
            tone="muted"
          />
        </>
      )}
    </div>
  );
}
