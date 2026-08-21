import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { OabForm } from "@/components/app/oab-form";
import { AssinaturaCard } from "@/components/app/assinatura-card";
import { WhatsappCanalForm } from "@/components/app/whatsapp-canal-form";
import { ApiKeysCard } from "@/components/app/apikeys-card";
import { LIMIAR_HORAS_ALERTA_FICHA_URGENTE } from "@/lib/whatsapp/lembretes";
import { planoTemAcesso } from "@/lib/planos/gating";
import { listarApiKeysAction } from "@/app/app/perfil/apikeys-actions";

export const metadata = { title: "Meu perfil — Jurídico IA" };

export default async function PerfilPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const podeGerenciarWhatsapp = usuario.perfil.role === "owner" || usuario.perfil.role === "admin";
  const temAcessoApiIntegracoes = planoTemAcesso(usuario.perfil.escritorio, "api_integracoes");
  const chavesApi = temAcessoApiIntegracoes ? await listarApiKeysAction() : [];

  // A RLS `canais_whatsapp_admin` (migration 0008) já restringe esta leitura
  // a owner/admin do próprio escritório — para `advogado` a query volta
  // vazia por política, então nem tentamos buscar (evita um round-trip
  // que sempre retornaria nulo para esse papel).
  let canalExistente: {
    phoneNumberId: string;
    numeroExibicao: string | null;
    telefoneAlertaUrgencia: string | null;
    ativo: boolean;
  } | null = null;
  if (podeGerenciarWhatsapp) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("canais_whatsapp_escritorio")
      .select("phone_number_id, numero_exibicao, telefone_alerta_urgencia, ativo")
      .eq("escritorio_id", usuario.perfil.escritorio_id)
      .maybeSingle();

    canalExistente = data
      ? {
          phoneNumberId: data.phone_number_id,
          numeroExibicao: data.numero_exibicao,
          telefoneAlertaUrgencia: data.telefone_alerta_urgencia,
          ativo: data.ativo,
        }
      : null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted">{usuario.perfil.nome} — {usuario.perfil.escritorio.nome}</p>
      </div>

      {usuario.perfil.role === "owner" && (
        <Card>
          <CardTitle className="mb-1">Assinatura</CardTitle>
          <AssinaturaCard plano={usuario.perfil.escritorio.plano} />
        </Card>
      )}

      <Card>
        <CardTitle className="mb-1">OAB</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Cadastre sua OAB para importar intimações automaticamente do DJEN (Diário de Justiça Eletrônico
          Nacional). Uma vez por dia o sistema consulta as novas intimações publicadas para essa OAB e cria
          propostas de prazo para você revisar e aprovar — nenhum prazo é criado sem aprovação.
        </p>
        <OabForm oabAtual={usuario.perfil.oab} />
      </Card>

      <Card>
        <CardTitle className="mb-1">API/Integrações</CardTitle>
        {temAcessoApiIntegracoes ? (
          <ApiKeysCard chavesIniciais={chavesApi} />
        ) : (
          <p className="text-sm text-muted">
            Disponível no plano Pro: gere chaves de API para integrar fichas de caso e prazos com Zapier, n8n
            ou sistemas internos do escritório.{" "}
            {usuario.perfil.role === "owner"
              ? "Assine o Plano Pro no card de assinatura acima para liberar."
              : "Peça ao titular do escritório para assinar o Plano Pro."}
          </p>
        )}
      </Card>

      {podeGerenciarWhatsapp && (
        <Card>
          <CardTitle className="mb-1">Lembretes via WhatsApp</CardTitle>
          <p className="mb-4 text-sm text-muted">
            Conecte o número do WhatsApp Business do escritório (Meta Cloud API) para enviar lembretes
            automáticos aos clientes 3 dias antes, 1 dia antes e no dia do vencimento de prazos e parcelas de
            honorários — e um aviso caso passem do vencimento. Opcionalmente, cadastre também um número interno
            para receber um alerta quando uma ficha de urgência alta ficar sem contato do advogado. Só titular e
            administradores veem e configuram esta credencial.
          </p>
          <WhatsappCanalForm
            canalExistente={canalExistente}
            limiarHorasAlertaUrgente={LIMIAR_HORAS_ALERTA_FICHA_URGENTE}
          />
        </Card>
      )}
    </div>
  );
}
