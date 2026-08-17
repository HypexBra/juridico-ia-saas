import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { LIMITE_MENSAGENS_FREE } from "@/lib/types";

export const metadata = { title: "Financeiro — Jurídico IA" };

function nomeDoMes(mesRef: string) {
  const [ano, mes] = mesRef.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default async function FinanceiroPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const mesAtual = new Date().toISOString().slice(0, 7);

  const { data: usoRows } = await supabase
    .from("uso_ia")
    .select("tokens_in, tokens_out, mes_ref")
    .order("mes_ref", { ascending: false });

  const linhas = usoRows ?? [];

  const porMes = new Map<string, { chamadas: number; tokensIn: number; tokensOut: number }>();
  for (const linha of linhas) {
    const atual = porMes.get(linha.mes_ref) ?? { chamadas: 0, tokensIn: 0, tokensOut: 0 };
    atual.chamadas += 1;
    atual.tokensIn += linha.tokens_in ?? 0;
    atual.tokensOut += linha.tokens_out ?? 0;
    porMes.set(linha.mes_ref, atual);
  }

  const historico = Array.from(porMes.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 12);

  const usoMesAtual = porMes.get(mesAtual) ?? { chamadas: 0, tokensIn: 0, tokensOut: 0 };
  const percentual = Math.min(100, Math.round((usoMesAtual.chamadas / LIMITE_MENSAGENS_FREE) * 100));
  const diaAtual = new Date().getDate();
  const diasNoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projecao = diaAtual > 0 ? Math.round((usoMesAtual.chamadas / diaAtual) * diasNoMes) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Financeiro / Uso de IA</h1>
        <p className="mt-1 text-sm text-muted">
          O escritório está no plano gratuito: acompanhe o consumo de IA (Gemini) para não estourar a camada
          grátis.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Uso em {nomeDoMes(mesAtual)}
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">
            {usoMesAtual.chamadas}
            <span className="text-base font-normal text-muted"> / {LIMITE_MENSAGENS_FREE}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${percentual >= 90 ? "bg-red-400" : "bg-gold"}`}
              style={{ width: `${percentual}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">{percentual}% do limite mensal do plano free.</p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Projeção do mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">{projecao}</p>
          <p className="mt-2 text-xs text-muted">
            Baseada no ritmo de uso até o dia {diaAtual} de {diasNoMes}.
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Tokens no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">
            {(usoMesAtual.tokensIn + usoMesAtual.tokensOut).toLocaleString("pt-BR")}
          </p>
          <p className="mt-2 text-xs text-muted">
            {usoMesAtual.tokensIn.toLocaleString("pt-BR")} entrada · {usoMesAtual.tokensOut.toLocaleString("pt-BR")} saída
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-4">Histórico mensal</CardTitle>
        {historico.length === 0 ? (
          <p className="text-sm text-muted">Nenhum uso de IA registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-4 font-medium">Mês</th>
                  <th className="pb-2 pr-4 font-medium">Chamadas de IA</th>
                  <th className="pb-2 pr-4 font-medium">Tokens entrada</th>
                  <th className="pb-2 font-medium">Tokens saída</th>
                </tr>
              </thead>
              <tbody>
                {historico.map(([mes, dados]) => (
                  <tr key={mes} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 capitalize text-ice">{nomeDoMes(mes)}</td>
                    <td className="py-2 pr-4 text-ice-2">
                      {dados.chamadas} / {LIMITE_MENSAGENS_FREE}
                    </td>
                    <td className="py-2 pr-4 text-ice-2">{dados.tokensIn.toLocaleString("pt-BR")}</td>
                    <td className="py-2 text-ice-2">{dados.tokensOut.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
