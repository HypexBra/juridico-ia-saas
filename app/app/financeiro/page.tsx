import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { NovoContratoHonorarioDialog } from "@/components/app/novo-contrato-honorario-dialog";
import { ContratoHonorarioCard, type ContratoHonorarioComRelacoes } from "@/components/app/contrato-honorario-card";
import { sincronizarParcelasAtrasadas } from "@/app/app/financeiro/actions";
import { LIMITE_MENSAGENS_FREE } from "@/lib/types";

export const metadata = { title: "Financeiro — Jurídico IA" };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  const recebidoNoMes = todasParcelas
    .filter((p) => p.status === "pago" && (p.pago_em ?? "").startsWith(mesAtual))
    .reduce((soma, p) => soma + p.valor, 0);
  const aReceberNoMes = todasParcelas
    .filter((p) => p.status !== "pago" && p.vencimento.startsWith(mesAtual))
    .reduce((soma, p) => soma + p.valor, 0);
  const parcelasAtrasadas = todasParcelas.filter((p) => p.status === "atrasado");
  const totalAtrasado = parcelasAtrasadas.reduce((soma, p) => soma + p.valor, 0);

  const usoIaMesAtual = (usoRows ?? []).filter((linha) => linha.mes_ref === mesAtual);
  const chamadasIaNoMes = usoIaMesAtual.length;
  const percentualUsoIa = Math.min(100, Math.round((chamadasIaNoMes / LIMITE_MENSAGENS_FREE) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Financeiro</h1>
          <p className="mt-1 text-sm text-muted">
            Contratos de honorário, parcelas e rateio entre sócios do escritório.
          </p>
        </div>
        <NovoContratoHonorarioDialog fichas={fichas ?? []} perfis={perfis ?? []} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Recebido no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">{formatarMoeda(recebidoNoMes)}</p>
          <p className="mt-2 text-xs text-muted">Parcelas pagas com vencimento neste mês.</p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">A receber no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-gold-2">{formatarMoeda(aReceberNoMes)}</p>
          <p className="mt-2 text-xs text-muted">Parcelas pendentes/atrasadas com vencimento neste mês.</p>
        </Card>

        <Card className={parcelasAtrasadas.length > 0 ? "border-red-500/30" : ""}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Em atraso</p>
          <p className="mt-2 font-display text-3xl font-bold text-red-400">{formatarMoeda(totalAtrasado)}</p>
          <p className="mt-2 text-xs text-muted">
            {parcelasAtrasadas.length} parcela(s) vencida(s) sem pagamento.
          </p>
        </Card>
      </div>

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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Uso de IA no plano gratuito</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {chamadasIaNoMes} / {LIMITE_MENSAGENS_FREE} chamadas de IA usadas este mês.
            </p>
          </div>
          <span className="font-display text-xl font-semibold text-ice">{percentualUsoIa}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${percentualUsoIa >= 90 ? "bg-red-400" : "bg-gold"}`}
            style={{ width: `${percentualUsoIa}%` }}
          />
        </div>
      </Card>
    </div>
  );
}
