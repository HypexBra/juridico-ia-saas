import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EditarModeloForm } from "@/components/app/editar-modelo-form";
import { ExcluirModeloButton } from "@/components/app/excluir-modelo-button";
import type { Modelo } from "@/lib/types";

export default async function ModeloDetalhePage({ params }: PageProps<"/app/modelos/[id]">) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();
  const { data: modelo } = await supabase
    .from("modelos")
    .select("*")
    .eq("id", id)
    .maybeSingle<Modelo>();

  if (!modelo) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/app/modelos" className="text-xs font-medium text-gold hover:text-gold-2">
          ← Voltar para modelos
        </Link>
        <ExcluirModeloButton modeloId={modelo.id} />
      </div>

      <Card>
        <EditarModeloForm modelo={modelo} />
      </Card>
    </div>
  );
}
