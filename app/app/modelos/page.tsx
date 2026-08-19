import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NovoModeloDialog } from "@/components/app/novo-modelo-dialog";
import type { Modelo } from "@/lib/types";

export const metadata = { title: "Modelos — Jurídico IA" };

export default async function ModelosPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: modelos } = await supabase
    .from("modelos")
    .select("*")
    .order("atualizado_em", { ascending: false })
    .returns<Modelo[]>();

  const lista = modelos ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Modelos de peças</h1>
          <p className="mt-1 text-sm text-muted">Templates reutilizáveis para agilizar a produção jurídica.</p>
        </div>
        <NovoModeloDialog />
      </div>

      {lista.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Nenhum modelo cadastrado ainda. Crie o primeiro em &quot;Novo modelo&quot;.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((modelo) => (
            <Link key={modelo.id} href={`/app/modelos/${modelo.id}`}>
              <Card className="h-full transition-colors hover:border-silver/30">
                <h3 className="mb-1 font-display text-base font-semibold text-ice">{modelo.nome}</h3>
                {modelo.tipo && <p className="mb-2 text-xs text-muted">{modelo.tipo}</p>}
                {modelo.descricao && (
                  <p className="mb-3 line-clamp-2 text-sm text-ice-2">{modelo.descricao}</p>
                )}
                <div className="flex items-center justify-between">
                  {modelo.area ? <Badge tone="silver">{modelo.area}</Badge> : <span />}
                  <span className="text-xs text-muted">usado {modelo.uso_count}x</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
