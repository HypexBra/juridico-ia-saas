import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NovaFichaDialog } from "@/components/app/nova-ficha-dialog";
import type { FichaCaso } from "@/lib/types";

export const metadata = { title: "Fichas — Jurídico IA" };

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const URGENCIA_TONE = {
  alta: "red",
  normal: "gold",
  baixa: "muted",
} as const;

const RISCO_TONE = {
  alto: "red",
  medio: "gold",
  baixo: "green",
} as const;

const RISCO_LABEL = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
} as const;

export default async function FichasPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: fichas } = await supabase
    .from("fichas_caso")
    .select("*")
    .order("criado_em", { ascending: false })
    .returns<FichaCaso[]>();

  const lista = fichas ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Fichas de triagem</h1>
          <p className="mt-1 text-sm text-muted">Casos captados e a análise preliminar de cada um.</p>
        </div>
        <NovaFichaDialog />
      </div>

      {lista.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nenhuma ficha cadastrada ainda. Clique em &quot;Nova ficha&quot; para registrar a triagem de um cliente.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((ficha) => (
            <Link key={ficha.id} href={`/app/fichas/${ficha.id}`}>
              <Card className="h-full transition-colors hover:border-gold/30">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-ice">
                    {ficha.nome_cliente ?? "Cliente sem nome"}
                  </h3>
                  {!ficha.lida && <Badge tone="blue">Não lida</Badge>}
                </div>
                <p className="mb-3 text-xs text-muted">{ficha.area_direito ?? "Área não informada"}</p>
                <p className="mb-4 line-clamp-3 text-sm text-ice-2">{ficha.resumo_fatos}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={URGENCIA_TONE[ficha.urgencia]}>Urgência {ficha.urgencia}</Badge>
                    {ficha.nivel_risco && (
                      <Badge tone={RISCO_TONE[ficha.nivel_risco]}>Risco {RISCO_LABEL[ficha.nivel_risco]}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted">{formatarDataHora(ficha.criado_em)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
