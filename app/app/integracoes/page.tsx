import { getUsuarioAtual } from "@/lib/app/current-user";
import { planoTemAcesso } from "@/lib/planos/gating";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { listarEndpointsAction } from "./actions";
import { ListaEndpoints } from "./ui-cliente";

export const metadata = { title: "Integrações — Jurídico IA" };

export default async function IntegracoesPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;

  const temAcesso = planoTemAcesso(usuario.perfil.escritorio, "api_integracoes");
  if (!temAcesso) {
    // Mesmo padrão visual das demais seções gated (ver card "API/Integrações"
    // em /app/perfil): explicação do recurso + caminho para liberar.
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Integrações / Webhooks</h1>
          <p className="mt-1 text-sm text-muted">Notificações automáticas de eventos para sistemas externos.</p>
        </div>
        <Card>
          <CardTitle className="mb-1">Recurso do plano Pro</CardTitle>
          <p className="text-sm text-muted">
            Cadastre URLs de webhook e receba um POST assinado sempre que um prazo for criado/atualizado, um caso
            for criado/atualizado ou um documento for analisado — para integrar com Zapier, n8n ou sistemas
            internos do escritório.{" "}
            {usuario.perfil.role === "owner"
              ? "Assine o Plano Pro no seu perfil para liberar."
              : "Peça ao titular do escritório para assinar o Plano Pro."}
          </p>
          <div className="mt-4">
            <LinkButton href="/app/perfil" variant="secondary" size="sm">
              Ir para perfil / assinatura
            </LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  const endpoints = await listarEndpointsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Integrações / Webhooks</h1>
        <p className="mt-1 text-sm text-muted">
          Entregas assinadas de eventos do escritório {usuario.perfil.escritorio.nome}.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-1">Webhooks de saída ({endpoints.length})</CardTitle>
        <ListaEndpoints endpointsIniciais={endpoints} />
      </Card>
    </div>
  );
}
