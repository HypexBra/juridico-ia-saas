"use client";

import { useActionState, useState } from "react";
import {
  convidarClientePortalAction,
  notificarClienteAction,
  type ConvidarClienteState,
  type NotificarClienteState,
} from "@/app/app/fichas/[id]/portal-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ClientePortal } from "@/lib/types";

const CONVIDAR_INITIAL_STATE: ConvidarClienteState = { error: null, linkConvite: null };
const NOTIFICAR_INITIAL_STATE: NotificarClienteState = { error: null, ok: false, notificado: false };

function CopiarLinkConvite({ path }: { path: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div className="space-y-2 rounded-lg border border-gold/30 bg-gold/5 p-3.5">
      <p className="text-xs font-medium text-gold-2">
        Convite gerado. Copie o link abaixo e envie manualmente ao cliente (WhatsApp, e-mail, etc.) — o
        projeto ainda não tem um serviço de e-mail configurado para enviar automaticamente.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-navy px-2.5 py-1.5 text-xs text-ice-2">
          {url}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(url).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            });
          }}
        >
          {copiado ? "Copiado!" : "Copiar link"}
        </Button>
      </div>
      <p className="text-xs text-muted">Válido por 7 dias.</p>
    </div>
  );
}

function ConvidarClienteForm({ fichaId }: { fichaId: string }) {
  const [state, formAction, isPending] = useActionState(convidarClientePortalAction, CONVIDAR_INITIAL_STATE);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="fichaId" value={fichaId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nomeClientePortal">Nome do cliente</Label>
            <Input id="nomeClientePortal" name="nome" placeholder="Nome completo" required />
          </div>
          <div>
            <Label htmlFor="emailClientePortal">E-mail do cliente</Label>
            <Input id="emailClientePortal" name="email" type="email" placeholder="cliente@email.com" required />
          </div>
        </div>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          {isPending ? "Gerando convite…" : "Convidar cliente pro portal"}
        </Button>
      </form>
      {state.linkConvite && <CopiarLinkConvite path={state.linkConvite} />}
    </div>
  );
}

function NotificarClienteForm({ fichaId }: { fichaId: string }) {
  const [state, formAction, isPending] = useActionState(notificarClienteAction, NOTIFICAR_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="fichaId" value={fichaId} />
      <Label htmlFor="mensagemCliente">Enviar atualização ao cliente</Label>
      <Textarea
        id="mensagemCliente"
        name="mensagem"
        rows={2}
        placeholder="Ex: Recebemos a resposta do processo, entraremos em contato em breve."
        required
      />
      {state.error && <FieldError>{state.error}</FieldError>}
      {state.ok && !state.notificado && (
        <p className="text-xs text-muted">
          Mensagem não enviada: este cliente ainda não ativou o acesso ao portal.
        </p>
      )}
      {state.ok && state.notificado && <p className="text-xs text-green">Notificação enviada ao cliente.</p>}
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar"}
      </Button>
    </form>
  );
}

export function PortalClienteCard({
  fichaId,
  clientePortal,
}: {
  fichaId: string;
  clientePortal: ClientePortal | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Dê ao cliente acesso somente-leitura ao andamento do caso, sem precisar ligar pro escritório.
        </p>
        {clientePortal?.auth_user_id && <Badge tone="green">Portal ativo</Badge>}
        {clientePortal && !clientePortal.auth_user_id && <Badge tone="gold">Convite pendente</Badge>}
      </div>

      {!clientePortal?.auth_user_id && <ConvidarClienteForm fichaId={fichaId} />}

      {clientePortal?.auth_user_id && (
        <p className="text-sm text-ice-2">
          {clientePortal.nome} ({clientePortal.email}) já pode acompanhar este caso pelo portal do cliente.
        </p>
      )}

      {clientePortal?.auth_user_id && <NotificarClienteForm fichaId={fichaId} />}
    </div>
  );
}
