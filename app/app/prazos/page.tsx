import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { NovoPrazoForm } from "@/components/app/novo-prazo-form";
import { PrazoRow } from "@/components/app/prazo-row";
import { StatusDataJud } from "@/components/app/status-datajud";
import type { Prazo } from "@/lib/types";

export const metadata = { title: "Prazos — Jurídico IA" };

export default async function PrazosPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: prazos } = await supabase
    .from("prazos")
    .select("*")
    .order("concluido", { ascending: true })
    .order("data_prazo", { ascending: true })
    .returns<Prazo[]>();

  const lista = prazos ?? [];
  const pendentes = lista.filter((p) => !p.concluido);
  const concluidos = lista.filter((p) => p.concluido);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Prazos</h1>
        <p className="mt-1 text-sm text-muted">Acompanhe prazos processuais e administrativos do escritório.</p>
        <div className="mt-3">
          <StatusDataJud />
        </div>
      </div>

      <Card>
        <CardTitle className="mb-4">Novo prazo</CardTitle>
        <NovoPrazoForm />
      </Card>

      <Card>
        <CardTitle className="mb-4">Pendentes ({pendentes.length})</CardTitle>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted">Nenhum prazo pendente.</p>
        ) : (
          <ul>
            {pendentes.map((prazo) => (
              <PrazoRow key={prazo.id} prazo={prazo} />
            ))}
          </ul>
        )}
      </Card>

      {concluidos.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Concluídos ({concluidos.length})</CardTitle>
          <ul>
            {concluidos.map((prazo) => (
              <PrazoRow key={prazo.id} prazo={prazo} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
