import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { AdvogadoContraForm } from "@/components/app/advogado-contra-form";

export const metadata = { title: "Nova análise — Advogado do Contra — Jurídico IA" };

/**
 * A chamada de IA aqui roda de forma síncrona dentro da própria Server
 * Action disparada pelo formulário desta página — mesmo mecanismo de
 * `app/app/auditor/page.tsx`. Teto de 120s (ADR 0013, sem lote nesta
 * feature).
 */
export const maxDuration = 120;

/**
 * Formulário de nova análise do Advogado do Contra (`/app/advogado-contra/novo`,
 * ADR 0013): colar texto, enviar arquivo ou selecionar uma tese já
 * cadastrada. Aceita `?fichaId=` na query string para pré-filtrar as teses
 * daquela ficha no seletor e pré-vincular a análise — mesmo padrão de
 * `?fichaId=` do Auditor de Peças, chegando pelo atalho de
 * `/app/fichas/[id]`.
 */
export default async function NovaAnaliseAdvogadoContraPage({
  searchParams,
}: {
  searchParams: Promise<{ fichaId?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "advogado_do_contra");
  if (!temAcesso) redirect("/app/advogado-contra");

  const { fichaId } = await searchParams;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/app/advogado-contra" className="text-xs font-medium text-silver hover:text-silver-2">
          ← Voltar para Advogado do Contra
        </Link>
      </div>

      <Card>
        <CardTitle className="mb-1">Nova análise adversarial</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Cole o texto, envie um arquivo (PDF, DOCX ou imagem) ou selecione uma tese já cadastrada no caso.
        </p>
        <AdvogadoContraForm fichaCasoId={fichaId ?? null} />
      </Card>
    </div>
  );
}
