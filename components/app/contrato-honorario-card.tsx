import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParcelaHonorarioRow } from "@/components/app/parcela-honorario-row";
import type { ParcelaHonorario, TipoContratoHonorario } from "@/lib/types";

export type ContratoHonorarioComRelacoes = {
  id: string;
  tipo: TipoContratoHonorario;
  valor_total: number | null;
  percentual_exito: number | null;
  criado_em: string;
  ficha_caso: { nome_cliente: string | null } | null;
  rateio: { percentual: number; perfil: { nome: string } | null }[];
  parcelas: ParcelaHonorario[];
};

const TIPO_LABEL: Record<TipoContratoHonorario, string> = {
  fixo: "Fixo",
  exito: "Êxito",
  aaj: "AAJ",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ContratoHonorarioCard({ contrato }: { contrato: ContratoHonorarioComRelacoes }) {
  const parcelas = [...contrato.parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela);
  const totalPago = parcelas.filter((p) => p.status === "pago").reduce((soma, p) => soma + p.valor, 0);
  const totalAtrasado = parcelas.filter((p) => p.status === "atrasado").length;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{contrato.ficha_caso?.nome_cliente ?? "Cliente sem nome"}</CardTitle>
          <p className="mt-1 text-xs text-muted">
            {TIPO_LABEL[contrato.tipo]}
            {contrato.valor_total !== null ? ` · ${formatarMoeda(contrato.valor_total)}` : ""}
            {contrato.percentual_exito !== null ? ` · ${contrato.percentual_exito}% de êxito` : ""}
          </p>
        </div>
        {totalAtrasado > 0 && <Badge tone="red">{totalAtrasado} parcela(s) em atraso</Badge>}
      </div>

      {contrato.rateio.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          Rateio:{" "}
          {contrato.rateio
            .map((item) => `${item.perfil?.nome ?? "—"} (${item.percentual}%)`)
            .join(" · ")}
        </p>
      )}

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Parcelas ({parcelas.length}) · Recebido: {formatarMoeda(totalPago)}
      </p>

      {parcelas.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma parcela gerada ainda para este contrato (aguardando valor total definido).
        </p>
      ) : (
        <ul>
          {parcelas.map((parcela) => (
            <ParcelaHonorarioRow key={parcela.id} parcela={parcela} />
          ))}
        </ul>
      )}
    </Card>
  );
}
