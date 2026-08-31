import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { ExcluirConversaBotao } from "@/components/admin/excluir-conversa-botao";
import { formatarDataHora } from "@/lib/app/formatar-data";
import type { Mensagem } from "@/lib/types";

export const metadata = { title: "Conversa — Admin" };

/**
 * Só leitura (seção 8 do pedido: "não permitir que o administrador altere
 * mensagens do usuário sem necessidade") — a única ação disponível aqui é
 * excluir a conversa inteira, nunca editar o conteúdo de uma mensagem.
 */
export default async function AdminConversaDetalhePage({ params }: PageProps<"/admin/conversas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id, titulo, iniciada_em, criado_por")
    .eq("id", id)
    .maybeSingle<{ id: string; titulo: string | null; iniciada_em: string; criado_por: string | null }>();

  if (!conversa) notFound();

  const [{ data: mensagens }, { data: perfil }] = await Promise.all([
    supabase.from("mensagens").select("*").eq("conversa_id", id).order("criado_em", { ascending: true }).returns<Mensagem[]>(),
    conversa.criado_por
      ? supabase.from("perfis").select("nome").eq("id", conversa.criado_por).maybeSingle<{ nome: string }>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/conversas" className="text-xs text-muted hover:text-ice">
            ← Voltar para Conversas
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ice">{conversa.titulo ?? "Conversa sem título"}</h1>
          <p className="mt-1 text-sm text-muted">
            {perfil?.nome ?? "Usuário removido"} · {formatarDataHora(conversa.iniciada_em)}
          </p>
        </div>
        <ExcluirConversaBotao conversaId={conversa.id} aposExcluirVoltar />
      </div>

      <Card className="space-y-4">
        <CardTitle>Histórico de mensagens</CardTitle>
        {!mensagens || mensagens.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma mensagem nesta conversa.</p>
        ) : (
          mensagens.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-silver/15 text-ice" : "bg-navy-3/80 text-ice"}`}>
                <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                <p className="mt-1.5 text-right text-[10px] text-muted">{formatarDataHora(m.criado_em)}</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
