import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PRECOS_POR_MILHAO,
  agregarPorDia,
  agregarPorOrigem,
  agregarTotais,
  calcularCustoEstimado,
  type RegistroUsoIa,
} from "@/lib/uso/agregar";
import { limiteMensagensIaPara } from "@/lib/types";
import { mesReferencia } from "@/lib/ia/registro-uso";

export const metadata = { title: "Uso de IA — Jurídico IA" };

/** Janela da série diária (dias). */
const JANELA_DIAS = 30;

function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

function formatarUsd(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

/** Duração média legível: milissegundos abaixo de 1s, segundos acima. */
function formatarDuracao(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${formatarNumero(ms)} ms` : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

/**
 * Observabilidade de uso de IA (Fase 27, migration 0045) — leitura agregada
 * das linhas de `uso_ia`: totais do mês, série diária (barras CSS puro),
 * top origens e custo estimado HONESTO contra preços públicos de referência.
 * Toda agregação vive em lib/uso/agregar.ts (puro/testado); aqui é só I/O +
 * renderização. RLS de `uso_ia` garante isolamento entre escritórios.
 */
export default async function UsoIaPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const escritorioId = usuario.perfil.escritorio_id;
  // Base temporal única via construtor `new Date()` (padrão das páginas
  // vizinhas): `Date.now()` dispara a regra react-hooks/purity do lint.
  const agora = new Date();
  const inicioJanela = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const mesAtual = mesReferencia(agora);

  // Duas leituras baratas: a janela 30d alimenta séries/custo; a do mês
  // corrente alimenta os totais e a comparação com o plano (a janela 30d
  // pode não cobrir integralmente o mês corrente, ex.: dia 1º).
  const [{ data: janela }, { data: mes }] = await Promise.all([
    supabase
      .from("uso_ia")
      .select("criado_em, mes_ref, tokens_in, tokens_out, duracao_ms, modelo, origem")
      .eq("escritorio_id", escritorioId)
      .gte("criado_em", inicioJanela)
      .order("criado_em", { ascending: true })
      .returns<RegistroUsoIa[]>(),
    supabase
      .from("uso_ia")
      .select("criado_em, mes_ref, tokens_in, tokens_out, duracao_ms, modelo, origem")
      .eq("escritorio_id", escritorioId)
      .eq("mes_ref", mesAtual)
      .returns<RegistroUsoIa[]>(),
  ]);

  const registrosJanela = janela ?? [];
  const registrosMes = mes ?? [];

  // Estado vazio honesto: nenhum dado fictício, só orientação.
  if (registrosMes.length === 0 && registrosJanela.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Uso de IA</h1>
          <p className="mt-1 text-sm text-muted">Chamadas, tokens, latência e custo estimado do escritório.</p>
        </div>
        <Card>
          <p className="text-sm text-muted">
            Nenhuma chamada registrada ainda. O uso aparece aqui automaticamente assim que você conversar
            com a IA ou gerar uma análise/minuta.
          </p>
        </Card>
      </div>
    );
  }

  const totaisMes = agregarTotais(registrosMes);
  const serieDia = agregarPorDia(registrosJanela, agora, JANELA_DIAS);
  const porOrigem = agregarPorOrigem(registrosJanela);
  const custo = calcularCustoEstimado(registrosJanela, PRECOS_POR_MILHAO);

  const limitePlano = limiteMensagensIaPara(usuario.perfil.escritorio.plano);
  const percentualLimite = Math.round((totaisMes.chamadas / limitePlano) * 100);
  const percentualBarra = Math.max(0, Math.min(100, percentualLimite));

  const maxTokensDia = Math.max(...serieDia.map((dia) => dia.tokens), 0);
  const divisorBarra = maxTokensDia > 0 ? maxTokensDia : 1;

  const foraDoCalculo = custo.registrosTotal - custo.registrosPrecificados;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Uso de IA</h1>
        <p className="mt-1 text-sm text-muted">
          Chamadas, tokens, latência e custo estimado do escritório nos últimos {JANELA_DIAS} dias.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { titulo: "Chamadas no mês", valor: formatarNumero(totaisMes.chamadas), detalhe: `Mês corrente (${mesAtual})` },
          {
            titulo: "Tokens de entrada",
            valor: formatarNumero(totaisMes.tokensIn),
            detalhe: "Prompts + contexto enviado",
          },
          {
            titulo: "Tokens de saída",
            valor: formatarNumero(totaisMes.tokensOut),
            detalhe: "Respostas geradas",
          },
          {
            titulo: "Duração média",
            valor: formatarDuracao(totaisMes.duracaoMediaMs),
            detalhe: "Chamadas com latência registrada",
          },
        ].map((item) => (
          <Card key={item.titulo}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{item.titulo}</p>
            <p className="mt-1 font-display text-xl font-semibold text-ice">{item.valor}</p>
            <p className="mt-0.5 text-[11px] text-muted">{item.detalhe}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Comparação com o plano</CardTitle>
          <Badge tone={usuario.perfil.escritorio.plano === "pro" ? "silver" : "muted"}>
            Plano {usuario.perfil.escritorio.plano === "pro" ? "Pro" : "Free"}
          </Badge>
        </div>
        <p className="mb-3 text-xs text-muted">
          {percentualLimite}% do limite mensal do plano — {formatarNumero(totaisMes.chamadas)} de{" "}
          {formatarNumero(limitePlano)} chamadas usadas em {mesAtual}. O limite conta chamadas de IA (linhas
          em uso_ia), não tokens nem dinheiro.
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percentualLimite, 999)}
          aria-label={`Uso mensal de IA: ${percentualLimite}% do limite do plano`}
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percentualLimite >= 100 ? "bg-red-400" : percentualLimite >= 80 ? "bg-amber-300" : "bg-silver"
            }`}
            style={{ width: `${percentualBarra}%` }}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-1">Chamadas e tokens por dia</CardTitle>
        <p className="mb-4 text-xs text-muted">
          Barra proporcional aos tokens do dia ({formatarNumero(maxTokensDia)} no pico). Dias vazios aparecem
          de propósito — são informação real.
        </p>
        <div className="space-y-1.5">
          {serieDia.map((dia) => (
            <div key={dia.dia} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted">{dia.rotulo}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-sm bg-white/5" title={`${dia.chamadas} chamada(s) · ${formatarNumero(dia.tokens)} tokens`}>
                <div
                  className={`h-full rounded-sm ${dia.chamadas > 0 ? "bg-silver/50" : ""}`}
                  style={{ width: dia.tokens > 0 ? `${Math.max(2, (dia.tokens / divisorBarra) * 100)}%` : "0%" }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-muted">
                {dia.chamadas > 0 ? `${dia.chamadas}× · ${formatarNumero(dia.tokens)} tok` : "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-1">Por origem</CardTitle>
          <p className="mb-4 text-xs text-muted">Top {porOrigem.length} funcionalidades que consumiram IA.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Origem</th>
                  <th className="pb-2 pr-3 font-medium">Chamadas</th>
                  <th className="pb-2 font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {porOrigem.map((linha) => (
                  <tr key={linha.origem}>
                    <td className="py-2 pr-3 text-ice">{linha.origem}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">{formatarNumero(linha.chamadas)}</td>
                    <td className="py-2 tabular-nums text-silver-2">{formatarNumero(linha.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-1">Custo estimado (últimos {JANELA_DIAS} dias)</CardTitle>
          <p className="mt-1 font-display text-xl font-semibold text-silver-2">
            {custo.totalUsd === null ? "—" : formatarUsd(custo.totalUsd)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Estimativa com preços públicos de referência — não substitui a fatura do provedor.
          </p>
          {foraDoCalculo > 0 && (
            <p className="mt-1 text-xs text-muted">
              {foraDoCalculo} registro(s) com modelo não identificado ficam fora do cálculo (mostrados como
              &ldquo;&mdash;&rdquo; — nenhum custo é inventado).
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
