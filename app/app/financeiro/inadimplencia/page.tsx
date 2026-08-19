import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { sincronizarParcelasAtrasadas } from "@/app/app/financeiro/actions";

export const metadata = { title: "Inadimplência — Jurídico IA" };

type FichaMini = { nome_cliente: string | null; cliente: { cpf: string | null } | { cpf: string | null }[] | null };
type ContratoMini = { ficha_caso: FichaMini | FichaMini[] | null } | { ficha_caso: FichaMini | FichaMini[] | null }[] | null;

type ParcelaAtrasadaRow = {
  id: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  contrato: ContratoMini;
};

type ParcelaAtrasadaExibida = {
  id: string;
  nomeCliente: string;
  cpf: string | null;
  valor: number;
  vencimento: string;
  diasAtraso: number;
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

function diasEntre(dataAnteriorIso: string, dataPosteriorIso: string): number {
  const inicio = new Date(`${dataAnteriorIso}T00:00:00Z`).getTime();
  const fim = new Date(`${dataPosteriorIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((fim - inicio) / 86_400_000));
}

/** Extrai o primeiro item de uma relação PostgREST que pode vir como objeto único ou array (a depender de cardinalidade inferida). */
function primeiroItem<T>(valor: T | T[] | null): T | null {
  if (valor === null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function corDiasAtraso(dias: number): "red" | "silver" {
  return dias >= 30 ? "red" : "silver";
}

export default async function InadimplenciaPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const escritorioId = usuario.perfil.escritorio_id;

  // Mesmo raciocínio da página principal de financeiro: recalcula
  // pendente -> atrasado antes de listar, sem depender de um cron dedicado.
  await sincronizarParcelasAtrasadas(escritorioId);

  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("parcelas_honorario")
    .select(
      "id, valor, vencimento, pago_em, " +
        "contrato:contrato_id(ficha_caso:ficha_caso_id(nome_cliente, cliente:clientes(cpf)))",
    )
    .eq("status", "atrasado")
    .order("vencimento", { ascending: true })
    .returns<ParcelaAtrasadaRow[]>();

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-ice">Inadimplência</h1>
        <Card className="border-red-500/30">
          <p className="text-sm text-red-300">
            Não foi possível carregar as parcelas em atraso. Tente novamente em instantes.
          </p>
        </Card>
      </div>
    );
  }

  const parcelas: ParcelaAtrasadaExibida[] = (data ?? []).map((parcela) => {
    const contrato = primeiroItem(parcela.contrato);
    const ficha = primeiroItem(contrato?.ficha_caso ?? null);
    const cliente = primeiroItem(ficha?.cliente ?? null);
    return {
      id: parcela.id,
      nomeCliente: ficha?.nome_cliente ?? "Cliente sem nome",
      cpf: cliente?.cpf ?? null,
      valor: parcela.valor,
      vencimento: parcela.vencimento,
      diasAtraso: diasEntre(parcela.vencimento, hoje),
    };
  });

  const totalAtrasado = parcelas.reduce((soma, p) => soma + p.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Inadimplência</h1>
          <p className="mt-1 text-sm text-muted">
            Parcelas de honorário vencidas e ainda não pagas, ordenadas do mais atrasado para o mais recente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/api/financeiro/export?periodo=todas" variant="secondary" size="sm">
            Exportar CSV (tudo)
          </LinkButton>
          <LinkButton href="/app/financeiro" variant="ghost" size="sm">
            Voltar ao financeiro
          </LinkButton>
        </div>
      </div>

      <Card className={parcelas.length > 0 ? "border-red-500/30" : ""}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Total em atraso</p>
        <p className="mt-2 font-display text-3xl font-bold text-red-400">{formatarMoeda(totalAtrasado)}</p>
        <p className="mt-2 text-xs text-muted">{parcelas.length} parcela(s) vencida(s) sem pagamento.</p>
      </Card>

      <div>
        <CardTitle className="mb-4">Clientes inadimplentes ({parcelas.length})</CardTitle>
        {parcelas.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Nenhuma parcela em atraso no momento. Tudo em dia.</p>
          </Card>
        ) : (
          <Card className="!p-0">
            <ul>
              {parcelas.map((parcela) => (
                <li
                  key={parcela.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-red-500/5 px-5 py-3.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ice">{parcela.nomeCliente}</span>
                    <span className="text-xs text-muted">
                      {parcela.cpf ? `CPF ${parcela.cpf} · ` : ""}
                      Venceu em {formatarData(parcela.vencimento)} · {formatarMoeda(parcela.valor)}
                    </span>
                  </div>
                  <Badge tone={corDiasAtraso(parcela.diasAtraso)}>
                    {parcela.diasAtraso} dia(s) de atraso
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
