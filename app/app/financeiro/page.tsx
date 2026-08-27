import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { NovoContratoHonorarioDialog } from "@/components/app/novo-contrato-honorario-dialog";
import { ContratoHonorarioCard, type ContratoHonorarioComRelacoes } from "@/components/app/contrato-honorario-card";
import { sincronizarParcelasAtrasadas } from "@/app/app/financeiro/actions";
import { calcularResumoFinanceiro } from "@/lib/financeiro/resumo";
import { BorderGlow } from "@/components/ui/border-glow/border-glow";
import { BarChart } from "@/components/app/charts/bar-chart";
import { UsageRing } from "@/components/app/charts/usage-ring";
import { limiteMensagensIaPara } from "@/lib/types";

export const metadata = { title: "Financeiro — Jurídico IA" };

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Últimos `meses` mes_ref (YYYY-MM) terminando no mês atual, mais antigo primeiro. */
function ultimosMesesRef(meses: number): string[] {
  const referencia = new Date();
  referencia.setDate(1);
  const resultado: string[] = [];
  for (let i = meses - 1; i >= 0; i -= 1) {
    const data = new Date(referencia);
    data.setMonth(data.getMonth() - i);
    resultado.push(data.toISOString().slice(0, 7));
  }
  return resultado;
}

export default async function FinanceiroPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const escritorioId = usuario.perfil.escritorio_id;

  // Recalcula pendente -> atrasado antes de qualquer leitura (ver doc da
  // função: substitui um cron dedicado, sem risco de race condition).
  await sincronizarParcelasAtrasadas(escritorioId);

  const supabase = await createClient();

  const [{ data: contratosData }, { data: fichas }, { data: perfis }, { data: usoRows }] = await Promise.all([
    supabase
      .from("contratos_honorario")
      .select(
        "id, tipo, valor_total, percentual_exito, criado_em, " +
          "ficha_caso:fichas_caso(nome_cliente), " +
          "rateio:rateio_socios(percentual, perfil:perfis(nome)), " +
          "parcelas:parcelas_honorario(*)",
      )
      .order("criado_em", { ascending: false })
      .returns<ContratoHonorarioComRelacoes[]>(),
    supabase
      .from("fichas_caso")
      .select("id, nome_cliente")
      .order("criado_em", { ascending: false })
      .returns<{ id: string; nome_cliente: string | null }[]>(),
    supabase
      .from("perfis")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome")
      .returns<{ id: string; nome: string }[]>(),
    supabase
      .from("uso_ia")
      .select("tokens_in, tokens_out, mes_ref")
      .returns<{ tokens_in: number; tokens_out: number; mes_ref: string }[]>(),
  ]);

  const contratos = contratosData ?? [];
  const todasParcelas = contratos.flatMap((contrato) => contrato.parcelas);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const { recebidoNoMes, aReceberNoMes, totalAtrasado, parcelasAtrasadasCount } = calcularResumoFinanceiro(
    todasParcelas,
    mesAtual,
  );

  const usoIaMesAtual = (usoRows ?? []).filter((linha) => linha.mes_ref === mesAtual);
  const chamadasIaNoMes = usoIaMesAtual.length;
  // Mesmo bug já corrigido em app/app/dashboard/page.tsx: usava sempre o
  // teto do plano FREE (25) como denominador, então um escritório Pro (300)
  // aparecia sempre perto de 100% mesmo com uso baixo.
  const limiteIaEscritorio = limiteMensagensIaPara(usuario.perfil.escritorio.plano);
  const percentualUsoIa = Math.min(100, Math.round((chamadasIaNoMes / limiteIaEscritorio) * 100));

  // Faturamento (parcelas pagas) dos últimos 6 meses — alimenta o gráfico de
  // barras mobile. Mês corrente à direita, sempre em destaque.
  const meses6 = ultimosMesesRef(6);
  const faturamentoPorMes = new Map<string, number>();
  for (const mes of meses6) faturamentoPorMes.set(mes, 0);
  for (const parcela of todasParcelas) {
    if (parcela.status !== "pago" || !parcela.pago_em) continue;
    const mesRef = parcela.pago_em.slice(0, 7);
    if (!faturamentoPorMes.has(mesRef)) continue;
    faturamentoPorMes.set(mesRef, (faturamentoPorMes.get(mesRef) ?? 0) + parcela.valor);
  }
  const dadosFaturamento = meses6.map((mes) => ({
    label: MESES_ABREV[Number(mes.slice(5, 7)) - 1] ?? mes,
    value: faturamentoPorMes.get(mes) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Financeiro</h1>
          <p className="mt-1 text-sm text-muted">
            Contratos de honorário, parcelas e rateio entre sócios do escritório.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/app/financeiro/inadimplencia" variant="secondary" size="sm">
            Inadimplência{parcelasAtrasadasCount > 0 ? ` (${parcelasAtrasadasCount})` : ""}
          </LinkButton>
          <LinkButton href="/app/financeiro/projecao-exito" variant="secondary" size="sm">
            Projeção de êxito
          </LinkButton>
          <LinkButton href="/api/financeiro/export?periodo=mes" variant="secondary" size="sm">
            Exportar CSV (mês)
          </LinkButton>
          <NovoContratoHonorarioDialog fichas={fichas ?? []} perfis={perfis ?? []} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="transition-transform duration-150 ease-out active:scale-[0.98]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Recebido no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">{formatarMoeda(recebidoNoMes)}</p>
          <p className="mt-2 text-xs text-muted">Parcelas pagas com vencimento neste mês.</p>
        </Card>

        <Card className="transition-transform duration-150 ease-out active:scale-[0.98]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">A receber no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-silver-2">{formatarMoeda(aReceberNoMes)}</p>
          <p className="mt-2 text-xs text-muted">Parcelas pendentes/atrasadas com vencimento neste mês.</p>
        </Card>

        <Card
          className={`transition-transform duration-150 ease-out active:scale-[0.98] ${parcelasAtrasadasCount > 0 ? "border-red-500/30" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Em atraso</p>
          <p className="mt-2 font-display text-3xl font-bold text-red-400">{formatarMoeda(totalAtrasado)}</p>
          <p className="mt-2 text-xs text-muted">
            {parcelasAtrasadasCount} parcela(s) vencida(s) sem pagamento.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-1">Faturamento recebido — últimos 6 meses</CardTitle>
        <p className="mb-4 text-xs text-muted">Soma de parcelas pagas por mês de pagamento.</p>
        <BarChart data={dadosFaturamento} format="moeda-compacta" />
      </Card>

      <div>
        <CardTitle className="mb-4">Contratos ({contratos.length})</CardTitle>
        {contratos.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Nenhum contrato de honorário cadastrado ainda. Clique em &quot;Novo contrato&quot; para começar.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {contratos.map((contrato) => (
              <ContratoHonorarioCard key={contrato.id} contrato={contrato} />
            ))}
          </div>
        )}
      </div>

      <BorderGlow
        glowColor="42 75 70"
        backgroundColor="var(--color-navy-2)"
        borderRadius={12}
        glowRadius={30}
        glowIntensity={0.9}
        colors={["var(--color-silver)", "var(--color-ice-2)", "var(--color-silver-2)"]}
      >
        <div className="flex flex-wrap items-center gap-5 p-5">
          <UsageRing
            percent={percentualUsoIa}
            label="Uso de IA no mês"
            tone={percentualUsoIa >= 90 ? "red" : "silver"}
          />
          <div className="min-w-0">
            <CardTitle>Uso de IA no mês</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {chamadasIaNoMes} / {limiteIaEscritorio} chamadas de IA usadas este mês.
            </p>
          </div>
        </div>
      </BorderGlow>
    </div>
  );
}
