import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClientePortalAtual } from "@/lib/app/current-client-portal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrazoViewRow } from "@/components/portal/prazo-view-row";
import { NotificacoesPanel } from "@/components/portal/notificacoes-panel";
import { ChatCaso } from "@/components/portal/chat-caso";
import { escritorioTemAcesso } from "@/lib/planos/gating";
import type { FichaCaso, MensagemPortalCliente, NotificacaoCliente, Prazo } from "@/lib/types";

export const metadata: Metadata = {
  title: "Meu processo — Portal do Cliente",
};

const URGENCIA_TONE = { alta: "red", normal: "silver", baixa: "muted" } as const;
const URGENCIA_LABEL = { alta: "Alta", normal: "Normal", baixa: "Baixa" } as const;

export default async function PortalDashboardPage() {
  const clientePortalAtual = await getClientePortalAtual();
  if (!clientePortalAtual) redirect("/portal/login");

  const supabase = await createClient();
  const { clientePortal } = clientePortalAtual;

  // Somente-leitura: nenhuma das três consultas abaixo tem escrita
  // correspondente nesta área — a RLS de `fichas_caso`/`prazos`
  // (`ficha_ids_do_cliente_portal()`, migration 0003) já restringe ao
  // próprio caso, e as três tabelas não têm policy de INSERT/UPDATE/DELETE
  // para o papel de cliente do portal (só a leitura das próprias
  // notificações tem UPDATE, tratado à parte em `NotificacoesPanel`).
  const temAcessoChat = await escritorioTemAcesso(clientePortal.escritorio_id, "portal_cliente_rico");

  const [{ data: ficha }, { data: prazos }, { data: notificacoes }, { data: mensagens }] = await Promise.all([
    supabase
      .from("fichas_caso")
      .select("*")
      .eq("id", clientePortal.ficha_caso_id)
      .maybeSingle<FichaCaso>(),
    supabase
      .from("prazos")
      .select("*")
      .eq("ficha_caso_id", clientePortal.ficha_caso_id)
      .order("concluido", { ascending: true })
      .order("data_prazo", { ascending: true })
      .returns<Prazo[]>(),
    supabase
      .from("notificacoes_cliente")
      .select("*")
      .eq("cliente_portal_id", clientePortal.id)
      .order("criado_em", { ascending: false })
      .returns<NotificacaoCliente[]>(),
    // Só busca o histórico do chat quando o escritório tem a feature — evita
    // um round-trip inútil (e uma tela vazia confusa) para escritórios Free.
    temAcessoChat
      ? supabase
          .from("mensagens_portal_cliente")
          .select("*")
          .eq("cliente_portal_id", clientePortal.id)
          .order("criado_em", { ascending: true })
          .returns<MensagemPortalCliente[]>()
      : Promise.resolve({ data: [] as MensagemPortalCliente[] | null }),
  ]);

  const listaPrazos = prazos ?? [];
  const pendentes = listaPrazos.filter((prazo) => !prazo.concluido);
  const concluidos = listaPrazos.filter((prazo) => prazo.concluido);
  const listaNotificacoes = notificacoes ?? [];
  const naoLidas = listaNotificacoes.filter((notificacao) => !notificacao.lida).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">
          Olá, {clientePortal.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Acompanhe aqui o andamento do seu caso, sem precisar ligar.</p>
      </div>

      {!ficha ? (
        <Card>
          <p className="text-sm text-muted">
            Não encontramos o seu processo no momento. Entre em contato com o escritório responsável.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <CardTitle>Meu caso</CardTitle>
            <Badge tone={URGENCIA_TONE[ficha.urgencia]}>Prioridade {URGENCIA_LABEL[ficha.urgencia]}</Badge>
          </div>
          <p className="mb-3 text-sm text-muted">{ficha.area_direito ?? "Área não informada"}</p>
          {ficha.resumo_fatos && (
            <div>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Resumo informado na abertura do caso
              </h2>
              <p className="whitespace-pre-wrap text-sm text-ice-2">{ficha.resumo_fatos}</p>
            </div>
          )}
        </Card>
      )}

      {ficha && temAcessoChat && (
        <Card>
          <CardTitle className="mb-4">Fale com o escritório</CardTitle>
          <ChatCaso fichaId={ficha.id} mensagensIniciais={mensagens ?? []} />
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <CardTitle>Notificações</CardTitle>
          {naoLidas > 0 && (
            <Badge tone="silver">
              {naoLidas} nova{naoLidas > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <NotificacoesPanel notificacoes={listaNotificacoes} />
      </Card>

      <Card>
        <CardTitle className="mb-4">Prazos pendentes ({pendentes.length})</CardTitle>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted">Nenhum prazo pendente no momento.</p>
        ) : (
          <ul>
            {pendentes.map((prazo) => (
              <PrazoViewRow key={prazo.id} prazo={prazo} />
            ))}
          </ul>
        )}
      </Card>

      {concluidos.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Prazos concluídos ({concluidos.length})</CardTitle>
          <ul>
            {concluidos.map((prazo) => (
              <PrazoViewRow key={prazo.id} prazo={prazo} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
