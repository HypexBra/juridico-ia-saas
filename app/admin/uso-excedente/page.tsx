import Link from "next/link";
import { listarEscritoriosProExcedentes } from "@/lib/admin/uso-excedente";
import { TETO_CUSTO_USD_PRO_MES } from "@/lib/uso/agregar";
import { mesReferencia } from "@/lib/ia/registro-uso";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Uso excedente (Pro) — Admin" };

function formatarUsd(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

/**
 * Alerta técnico de uso razoável (Fase 5, decisão do dono do produto):
 * escritórios do plano Pro cujo custo estimado de IA no mês corrente
 * ultrapassa `TETO_CUSTO_USD_PRO_MES` (referência interna, nunca exposta ao
 * cliente). SÓ VISIBILIDADE — nenhuma ação de bloqueio ou downgrade de
 * modelo é disparada por este painel; o plano Pro continua "sem limite
 * mensal de IA" para o cliente final. Calculado sob demanda a partir de
 * `uso_ia` (sem tabela nova), reaproveitando `agruparCustoPorEscritorio` e
 * `calcularCustoEstimado` — mesmo cálculo honesto usado em `/app/uso`.
 */
export default async function AdminUsoExcedentePage() {
  const agora = new Date();
  const escritorios = await listarEscritoriosProExcedentes(agora);
  const mesAtual = mesReferencia(agora);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Uso excedente (Pro)</h1>
        <p className="mt-1 text-sm text-muted">
          Escritórios do plano Pro com custo estimado de IA acima de {formatarUsd(TETO_CUSTO_USD_PRO_MES)} no
          mês corrente ({mesAtual}). Alerta interno de uso razoável — não bloqueia nem degrada o escritório.
        </p>
      </div>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{escritorios.length} escritório(s) acima do teto de referência</CardTitle>
          <Badge tone={escritorios.length > 0 ? "amber" : "green"}>
            {escritorios.length > 0 ? "Requer atenção" : "Tudo dentro do esperado"}
          </Badge>
        </div>
        <p className="mb-4 text-xs text-muted">
          Custo calculado com preços públicos de referência ({"lib/uso/agregar.ts"}) — registros com modelo
          não identificado ficam fora do cálculo, nunca com valor inventado. Teto de referência: uso interno,
          não exposto ao cliente (ver cláusula de uso razoável nos Termos de Uso).
        </p>

        {escritorios.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Nenhum escritório Pro excedeu o teto de referência em {mesAtual}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-3 font-medium">Escritório</th>
                  <th className="pb-3 pr-3 font-medium">Custo estimado</th>
                  <th className="pb-3 pr-3 font-medium">% do teto</th>
                  <th className="pb-3 pr-3 font-medium">Registros precificados</th>
                  <th className="pb-3 font-medium text-right">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {escritorios.map((e) => (
                  <tr key={e.escritorioId}>
                    <td className="py-3 pr-3 text-ice">{e.escritorioNome}</td>
                    <td className="py-3 pr-3 tabular-nums text-silver-2">{formatarUsd(e.totalUsd)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={e.percentualDoTeto >= 200 ? "red" : "amber"}>{e.percentualDoTeto}%</Badge>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-muted">
                      {e.registrosPrecificados} de {e.registrosTotal}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/usuarios?q=${encodeURIComponent(e.escritorioNome)}`}
                        className="text-xs text-silver-2 hover:underline"
                      >
                        Ver usuários →
                      </Link>
                    </td>
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
