import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { RedlineAnaliseForm } from "@/components/app/redline-analise-form";

export const metadata = { title: "Redline — Jurídico IA" };

/**
 * Análise de risco contratual clause-by-clause ("redline", feature Pro
 * "analise_risco_contratual"). Página própria (não um card dentro de uma
 * ficha) porque a análise é AVULSA por decisão de v1 — o usuário cola o
 * texto de qualquer contrato, sem precisar estar vinculado a uma ficha de
 * caso aberta (ver comentário da migration 0017). Página inteira é gated
 * (ao contrário de `RedacaoAssistidaCard`, que convive com conteúdo free na
 * mesma página) porque não há nenhuma variante free desta feature.
 */
export default async function RedlinePage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "analise_risco_contratual");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Redline — Análise de risco contratual</h1>
        <p className="mt-1 text-sm text-muted">
          Cole o texto de um contrato e a IA aponta cláusula por cláusula quais merecem atenção — sempre revise
          antes de agir sobre a análise.
        </p>
      </div>

      {temAcesso ? (
        <RedlineAnaliseForm />
      ) : (
        <Card>
          <CardTitle className="mb-1">Análise de risco contratual</CardTitle>
          <p className="text-sm text-muted">
            Análise clause-by-clause de contratos (cláusulas abusivas, ambíguas ou desequilibradas, com sugestão de
            ajuste) é uma feature do <span className="font-medium text-ice">Plano Pro</span>. Assine em{" "}
            <a href="/app/perfil" className="text-ice underline underline-offset-2">
              Meu perfil
            </a>{" "}
            para liberar.
          </p>
        </Card>
      )}
    </div>
  );
}
