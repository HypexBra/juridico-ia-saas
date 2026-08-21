import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/app/charts/bar-chart";
import { planoTemAcesso } from "@/lib/planos/gating";
import { calcularRelatorioAvancado } from "@/lib/relatorios/avancado";

export const metadata = { title: "Relatórios — Jurídico IA" };

type LinhaProdutividade = {
  perfilId: string;
  nome: string;
  role: "owner" | "admin" | "advogado";
  ativo: boolean;
  totalCasos: number;
  prazosTotal: number;
  prazosConcluidos: number;
  prazosAtrasados: number;
  honorariosGerados: number;
  honorariosRecebidos: number;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Relatório de produtividade por advogado — leitura agregada, sem schema
 * novo (ver nota "3." em `supabase/migrations/0008_triagem_produtividade_risco.sql`).
 *
 * A ponta advogado -> registro é indireta em dois pontos e isso limita o
 * que dá para reportar com os dados atuais:
 *   - `fichas_caso` não tem `criado_por` própria; o vínculo com o advogado
 *     só existe quando a ficha nasceu de uma `conversa` (fichas_caso.conversa_id
 *     -> conversas.criado_por). Fichas criadas sem conversa associada (ex:
 *     importação manual) não são atribuídas a ninguém neste relatório.
 *   - Honorários são atribuídos via `rateio_socios` (perfil_id + percentual
 *     do contrato), não por "advogado responsável pelo caso" — por isso os
 *     valores abaixo são o percentual de rateio de cada advogado sobre cada
 *     contrato, não o valor total do contrato.
 *   - Não existe no schema atual nenhuma coluna de resultado/êxito do caso
 *     (ex: "ganho"/"perdido") — por isso NÃO há taxa de êxito neste
 *     relatório; adicionar isso exigiria uma migration nova.
 */
export default async function RelatoriosPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const escritorioId = usuario.perfil.escritorio_id;
  const supabase = await createClient();

  const [
    { data: perfis },
    { data: conversas },
    { data: fichas },
    { data: prazos },
    { data: rateios },
    { data: contratos },
    { data: parcelas },
  ] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, nome, role, ativo")
      .eq("escritorio_id", escritorioId)
      .order("nome")
      .returns<{ id: string; nome: string; role: "owner" | "admin" | "advogado"; ativo: boolean }[]>(),
    supabase
      .from("conversas")
      .select("id, criado_por")
      .eq("escritorio_id", escritorioId)
      .returns<{ id: string; criado_por: string | null }[]>(),
    supabase
      .from("fichas_caso")
      .select("id, conversa_id")
      .eq("escritorio_id", escritorioId)
      .returns<{ id: string; conversa_id: string | null }[]>(),
    supabase
      .from("prazos")
      .select("id, criado_por, concluido, data_prazo")
      .eq("escritorio_id", escritorioId)
      .returns<{ id: string; criado_por: string | null; concluido: boolean; data_prazo: string }[]>(),
    supabase
      .from("rateio_socios")
      .select("perfil_id, contrato_id, percentual")
      .eq("escritorio_id", escritorioId)
      .returns<{ perfil_id: string; contrato_id: string; percentual: number }[]>(),
    supabase
      .from("contratos_honorario")
      .select("id, valor_total")
      .eq("escritorio_id", escritorioId)
      .returns<{ id: string; valor_total: number | null }[]>(),
    supabase
      .from("parcelas_honorario")
      .select("contrato_id, valor, status")
      .eq("escritorio_id", escritorioId)
      .returns<{ contrato_id: string; valor: number; status: "pendente" | "pago" | "atrasado" }[]>(),
  ]);

  const listaPerfis = perfis ?? [];
  const listaConversas = conversas ?? [];
  const listaFichas = fichas ?? [];
  const listaPrazos = prazos ?? [];
  const listaRateios = rateios ?? [];
  const listaContratos = contratos ?? [];
  const listaParcelas = parcelas ?? [];

  const conversaParaAdvogado = new Map<string, string | null>();
  for (const conversa of listaConversas) conversaParaAdvogado.set(conversa.id, conversa.criado_por);

  const contratoValorTotal = new Map<string, number>();
  for (const contrato of listaContratos) contratoValorTotal.set(contrato.id, contrato.valor_total ?? 0);

  const contratoRecebido = new Map<string, number>();
  for (const parcela of listaParcelas) {
    if (parcela.status !== "pago") continue;
    contratoRecebido.set(parcela.contrato_id, (contratoRecebido.get(parcela.contrato_id) ?? 0) + parcela.valor);
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const linhas: LinhaProdutividade[] = listaPerfis.map((perfil) => {
    const totalCasos = listaFichas.filter((ficha) => {
      if (!ficha.conversa_id) return false;
      return conversaParaAdvogado.get(ficha.conversa_id) === perfil.id;
    }).length;

    const prazosDoAdvogado = listaPrazos.filter((prazo) => prazo.criado_por === perfil.id);
    const prazosConcluidos = prazosDoAdvogado.filter((prazo) => prazo.concluido).length;
    const prazosAtrasados = prazosDoAdvogado.filter(
      (prazo) => !prazo.concluido && prazo.data_prazo < hoje,
    ).length;

    const rateiosDoAdvogado = listaRateios.filter((rateio) => rateio.perfil_id === perfil.id);
    let honorariosGerados = 0;
    let honorariosRecebidos = 0;
    for (const rateio of rateiosDoAdvogado) {
      const fracao = rateio.percentual / 100;
      honorariosGerados += (contratoValorTotal.get(rateio.contrato_id) ?? 0) * fracao;
      honorariosRecebidos += (contratoRecebido.get(rateio.contrato_id) ?? 0) * fracao;
    }

    return {
      perfilId: perfil.id,
      nome: perfil.nome,
      role: perfil.role,
      ativo: perfil.ativo,
      totalCasos,
      prazosTotal: prazosDoAdvogado.length,
      prazosConcluidos,
      prazosAtrasados,
      honorariosGerados,
      honorariosRecebidos,
    };
  });

  linhas.sort((a, b) => b.honorariosRecebidos - a.honorariosRecebidos || b.totalCasos - a.totalCasos);

  const dadosHonorariosPorAdvogado = linhas
    .filter((linha) => linha.honorariosRecebidos > 0)
    .slice(0, 6)
    .map((linha) => ({
      label: linha.nome.split(" ")[0] ?? linha.nome,
      value: linha.honorariosRecebidos,
    }));

  const semAtribuicao = listaFichas.filter((ficha) => {
    if (!ficha.conversa_id) return true;
    return !conversaParaAdvogado.get(ficha.conversa_id);
  }).length;

  // Relatório avançado (realization rate + breakdown por caso/área) é
  // feature premium (`relatorios_avancados`) — só busca os dados extras
  // (nome_cliente/area_direito das fichas) quando o escritório tem acesso,
  // pra não gastar round-trip à toa no plano free.
  const temAcessoRelatorioAvancado = planoTemAcesso(usuario.perfil.escritorio, "relatorios_avancados");
  let relatorioAvancado: ReturnType<typeof calcularRelatorioAvancado> | null = null;
  if (temAcessoRelatorioAvancado) {
    const [{ data: fichasDetalhadas }, { data: contratosDetalhados }] = await Promise.all([
      supabase
        .from("fichas_caso")
        .select("id, nome_cliente, area_direito")
        .eq("escritorio_id", escritorioId)
        .returns<{ id: string; nome_cliente: string | null; area_direito: string | null }[]>(),
      supabase
        .from("contratos_honorario")
        .select("id, ficha_caso_id, valor_total")
        .eq("escritorio_id", escritorioId)
        .returns<{ id: string; ficha_caso_id: string; valor_total: number | null }[]>(),
    ]);

    relatorioAvancado = calcularRelatorioAvancado(
      (fichasDetalhadas ?? []).map((ficha) => ({
        id: ficha.id,
        nomeCliente: ficha.nome_cliente ?? "Cliente sem nome",
        areaDireito: ficha.area_direito,
      })),
      (contratosDetalhados ?? []).map((contrato) => ({
        contratoId: contrato.id,
        fichaCasoId: contrato.ficha_caso_id,
        valorTotal: contrato.valor_total,
      })),
      listaParcelas.map((parcela) => ({
        contratoId: parcela.contrato_id,
        valor: parcela.valor,
        status: parcela.status,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">
          Produtividade por advogado: casos, prazos e honorários rateados no escritório.
        </p>
      </div>

      {dadosHonorariosPorAdvogado.length > 0 && (
        <Card>
          <CardTitle className="mb-1">Honorários recebidos por advogado</CardTitle>
          <p className="mb-4 text-xs text-muted">Parcela do rateio sobre parcelas já pagas.</p>
          <BarChart data={dadosHonorariosPorAdvogado} format="moeda-compacta" />
        </Card>
      )}

      {linhas.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Nenhum perfil ativo cadastrado neste escritório ainda.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {linhas.map((linha) => (
            <Card key={linha.perfilId} className="transition-transform duration-150 ease-out active:scale-[0.99]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{linha.nome}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge tone={linha.role === "owner" ? "silver" : linha.role === "admin" ? "blue" : "muted"}>
                    {linha.role === "owner" ? "Titular" : linha.role === "admin" ? "Administrador(a)" : "Advogado(a)"}
                  </Badge>
                  {!linha.ativo && <Badge tone="red">Inativo</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Casos</p>
                  <p className="mt-1 font-display text-xl font-semibold text-ice">{linha.totalCasos}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Prazos</p>
                  <p className="mt-1 font-display text-xl font-semibold text-ice">{linha.prazosTotal}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Cumpridos</p>
                  <p className="mt-1 font-display text-xl font-semibold text-green">{linha.prazosConcluidos}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Atrasados</p>
                  <p className="mt-1 font-display text-xl font-semibold text-red-400">{linha.prazosAtrasados}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Honorários gerados</p>
                  <p className="mt-1 font-display text-lg font-semibold text-silver-2">
                    {formatarMoeda(linha.honorariosGerados)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Parcela do rateio sobre o valor total dos contratos.</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Honorários recebidos</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ice">
                    {formatarMoeda(linha.honorariosRecebidos)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Parcela do rateio sobre parcelas já pagas.</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {temAcessoRelatorioAvancado && relatorioAvancado ? (
        <Card>
          <CardTitle className="mb-1">Relatório avançado (Pro)</CardTitle>
          <p className="mb-4 text-xs text-muted">
            Realization rate (recebido / contratado) e breakdown financeiro por caso e por área do direito.
            {relatorioAvancado.quantidadeIndeterminada > 0 &&
              ` ${relatorioAvancado.quantidadeIndeterminada} caso(s) sem valor de contrato cadastrado ficam fora do cálculo.`}
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Contratado</p>
              <p className="mt-1 font-display text-lg font-semibold text-silver-2">
                {formatarMoeda(relatorioAvancado.valorContratadoTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Recebido</p>
              <p className="mt-1 font-display text-lg font-semibold text-ice">
                {formatarMoeda(relatorioAvancado.valorRecebidoTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Realization rate</p>
              <p className="mt-1 font-display text-lg font-semibold text-green">
                {relatorioAvancado.realizationRateGeral === null
                  ? "—"
                  : `${(relatorioAvancado.realizationRateGeral * 100).toFixed(1)}%`}
              </p>
            </div>
          </div>

          {relatorioAvancado.porArea.length > 0 && (
            <div className="mb-5 overflow-x-auto">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Por área do direito</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Área</th>
                    <th className="pb-2 pr-3 font-medium">Casos</th>
                    <th className="pb-2 pr-3 font-medium">Contratado</th>
                    <th className="pb-2 pr-3 font-medium">Recebido</th>
                    <th className="pb-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {relatorioAvancado.porArea.map((linha) => (
                    <tr key={linha.areaDireito}>
                      <td className="py-2 pr-3 text-ice">{linha.areaDireito}</td>
                      <td className="py-2 pr-3 text-muted">{linha.totalCasos}</td>
                      <td className="py-2 pr-3 text-silver-2">{formatarMoeda(linha.valorContratado)}</td>
                      <td className="py-2 pr-3 text-ice">{formatarMoeda(linha.valorRecebido)}</td>
                      <td className="py-2 text-muted">
                        {linha.realizationRate === null ? "—" : `${(linha.realizationRate * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {relatorioAvancado.porCaso.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Por caso</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Cliente</th>
                    <th className="pb-2 pr-3 font-medium">Área</th>
                    <th className="pb-2 pr-3 font-medium">Contratado</th>
                    <th className="pb-2 pr-3 font-medium">Recebido</th>
                    <th className="pb-2 pr-3 font-medium">Pendente/Atrasado</th>
                    <th className="pb-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {relatorioAvancado.porCaso.map((linha) => (
                    <tr key={linha.fichaCasoId}>
                      <td className="py-2 pr-3 text-ice">{linha.nomeCliente}</td>
                      <td className="py-2 pr-3 text-muted">{linha.areaDireito}</td>
                      <td className="py-2 pr-3 text-silver-2">{formatarMoeda(linha.valorContratado)}</td>
                      <td className="py-2 pr-3 text-ice">{formatarMoeda(linha.valorRecebido)}</td>
                      <td className="py-2 pr-3 text-muted">{formatarMoeda(linha.valorPendenteOuAtrasado)}</td>
                      <td className="py-2 text-muted">
                        {linha.realizationRate === null ? "—" : `${(linha.realizationRate * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardTitle className="mb-1">Relatório avançado</CardTitle>
          <p className="text-sm text-muted">
            Realization rate e breakdown financeiro por caso/área do direito é uma feature do{" "}
            <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
            <a href="/app/perfil" className="text-ice underline underline-offset-2">
              Meu perfil
            </a>{" "}
            para liberar.
          </p>
        </Card>
      )}

      <Card>
        <p className="text-xs text-muted">
          {semAtribuicao > 0
            ? `${semAtribuicao} ficha(s) de caso sem advogado identificável (criada sem conversa vinculada, ou conversa sem "criado_por") não entram na contagem de "Casos" acima.`
            : "Todas as fichas de caso deste escritório têm um advogado identificável via a conversa que as originou."}
          {" "}Este relatório não inclui taxa de êxito/resultado do caso — o schema atual (`fichas_caso`) não tem
          um campo de desfecho do processo.
        </p>
      </Card>
    </div>
  );
}
