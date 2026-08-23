"use client";

import { useActionState, useEffect, useState } from "react";
import { EVENTOS_WEBHOOK } from "@/lib/webhooks/deliver";
import {
  alternarEndpointAtivoAction,
  criarEndpointAction,
  excluirEndpointAction,
  listarDeliveriesAction,
  type WebhookDeliveryListada,
  type WebhookEndpointListado,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CRIAR_INITIAL_STATE = { error: null, segredoNovo: null };
const ACAO_INITIAL_STATE: { error: string | null } = { error: null };

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarDataOpcional(iso: string | null): string {
  return iso ? formatarData(iso) : "—";
}

// ── Criar endpoint ───────────────────────────────────────────────────────

function SegredoGeradoAviso({ segredo }: { segredo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5">
      <p className="text-xs font-medium text-amber-600">
        Copie o segredo agora — ele não será mostrado novamente. Ele assina cada entrega
        (HMAC-SHA256 no header <code>X-JuridicoIA-Signature</code>); se perdê-lo, exclua e crie outro webhook.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-navy px-2.5 py-1.5 text-xs text-ice-2">{segredo}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(segredo).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            });
          }}
        >
          {copiado ? "Copiado!" : "Copiar segredo"}
        </Button>
      </div>
    </div>
  );
}

function CriarEndpointForm() {
  const [state, formAction, isPending] = useActionState(criarEndpointAction, CRIAR_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-ink/10 bg-navy-3/40 p-3.5">
      <div>
        <Label htmlFor="urlWebhook">URL de destino (https)</Label>
        <Input
          id="urlWebhook"
          name="url"
          type="url"
          placeholder="https://exemplo.com/webhooks/juridico"
          maxLength={2000}
          required
        />
      </div>
      <div>
        <Label htmlFor="descricaoWebhook">Descrição (opcional)</Label>
        <Input id="descricaoWebhook" name="descricao" placeholder="Ex: Zapier do financeiro" maxLength={300} />
      </div>
      <fieldset>
        <legend className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
          Eventos recebidos
        </legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {EVENTOS_WEBHOOK.map((evento) => (
            <label key={evento} className="flex cursor-pointer items-center gap-2 text-sm text-ice-2">
              <Checkbox name="eventos" value={evento} />
              <code className="text-xs">{evento}</code>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Nenhum marcado = receber todos os eventos.</p>
      </fieldset>

      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? "Criando…" : "Criar webhook"}
      </Button>
      <FieldError>{state.error}</FieldError>
      {state.segredoNovo && <SegredoGeradoAviso segredo={state.segredoNovo} />}
    </form>
  );
}

// ── Ações por endpoint (toggle/excluir com confirmação inline) ───────────

function ToggleAtivoForm({ endpointId, ativo }: { endpointId: string; ativo: boolean }) {
  const [state, formAction, isPending] = useActionState(alternarEndpointAtivoAction, ACAO_INITIAL_STATE);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        {ativo ? "Desativar" : "Ativar"}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={endpointId} />
      <span className="text-xs text-muted">{ativo ? "Parar entregas?" : "Retomar entregas?"}</span>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? "Alterando…" : "Confirmar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={isPending}>
        Cancelar
      </Button>
      {state.error && <span className="w-full text-xs text-red-400">{state.error}</span>}
    </form>
  );
}

function ExcluirEndpointForm({ endpointId }: { endpointId: string }) {
  const [state, formAction, isPending] = useActionState(excluirEndpointAction, ACAO_INITIAL_STATE);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        Excluir
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={endpointId} />
      <span className="text-xs text-red-400">Exclui também o histórico de entregas.</span>
      <Button type="submit" variant="danger" size="sm" disabled={isPending}>
        {isPending ? "Excluindo…" : "Sim, excluir"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={isPending}>
        Cancelar
      </Button>
      {state.error && <span className="w-full text-xs text-red-400">{state.error}</span>}
    </form>
  );
}

// ── Log de entregas (carrega sob demanda, últimas 20) ────────────────────

const STATUS_TONE = {
  entregue: "green",
  falha: "red",
  pendente: "amber",
} as const;

const STATUS_LABEL = {
  entregue: "Entregue",
  falha: "Falha",
  pendente: "Pendente",
} as const;

function DeliveriesPanel({ endpointId }: { endpointId: string }) {
  const [estado, setEstado] = useState<
    { tipo: "carregando" } | { tipo: "ok"; dados: WebhookDeliveryListada[] } | { tipo: "erro" }
  >({ tipo: "carregando" });

  useEffect(() => {
    let vivo = true;
    listarDeliveriesAction(endpointId)
      .then((dados) => {
        if (vivo) setEstado({ tipo: "ok", dados });
      })
      .catch(() => {
        if (vivo) setEstado({ tipo: "erro" });
      });
    return () => {
      vivo = false;
    };
  }, [endpointId]);

  if (estado.tipo === "carregando") return <p className="py-2 text-xs text-muted">Carregando entregas…</p>;
  if (estado.tipo === "erro") {
    return <p className="py-2 text-xs text-red-400">Não foi possível carregar as entregas. Tente novamente.</p>;
  }
  const deliveries = estado.dados;
  if (deliveries.length === 0) {
    return <p className="py-2 text-xs text-muted">Nenhuma entrega registrada ainda para este webhook.</p>;
  }

  return (
    <ul className="divide-y divide-ink/10">
      {deliveries.map((delivery) => (
        <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ice">
              <code>{delivery.evento}</code>{" "}
              <span className="font-normal text-muted">
                · {formatarData(delivery.criadoEm)} · {delivery.tentativas}{" "}
                {delivery.tentativas === 1 ? "tentativa" : "tentativas"} · resposta{" "}
                {delivery.respostaStatus ?? "—"}
              </span>
            </p>
            {delivery.ultimoErro && (
              <p className="truncate text-xs text-red-400" title={delivery.ultimoErro}>
                {delivery.ultimoErro}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[delivery.status]}>{STATUS_LABEL[delivery.status]}</Badge>
            <span className="text-[11px] text-muted">{formatarDataOpcional(delivery.entregueEm)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EndpointLinha({ endpoint }: { endpoint: WebhookEndpointListado }) {
  const [verEntregas, setVerEntregas] = useState(false);

  return (
    <li className="rounded-lg border border-ink/10 bg-navy-3/40 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-sm font-medium text-ice">{endpoint.url}</p>
          {endpoint.descricao && <p className="text-xs text-muted">{endpoint.descricao}</p>}
          <p className="mt-1 text-xs text-muted">Criado em {formatarData(endpoint.criadoEm)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {endpoint.eventos.includes("all") ? (
              <Badge tone="blue">Todos os eventos</Badge>
            ) : (
              endpoint.eventos.map((evento) => (
                <Badge key={evento} tone="muted">
                  {evento}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={endpoint.ativo ? "green" : "muted"}>{endpoint.ativo ? "Ativo" : "Inativo"}</Badge>
          <ToggleAtivoForm endpointId={endpoint.id} ativo={endpoint.ativo} />
          <ExcluirEndpointForm endpointId={endpoint.id} />
        </div>
      </div>

      <div className="mt-3 border-t border-ink/10 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setVerEntregas((v) => !v)}>
          {verEntregas ? "Ocultar entregas recentes" : "Ver entregas recentes (últimas 20)"}
        </Button>
        {verEntregas && (
          <div className="mt-1">
            <DeliveriesPanel endpointId={endpoint.id} />
          </div>
        )}
      </div>
    </li>
  );
}

export function ListaEndpoints({ endpointsIniciais }: { endpointsIniciais: WebhookEndpointListado[] }) {
  // As Server Actions revalidam `/app/integracoes` a cada mutação, refazendo
  // o fetch dos props no Server Component pai — sem estado duplicado aqui.
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Cada evento dispara um POST https assinado (HMAC-SHA256) para as URLs abaixo. O receptor valida
        recomputando o HMAC sobre o corpo bruto e comparando em tempo constante — veja o header{" "}
        <code className="text-ice-2">X-JuridicoIA-Signature: t=&lt;timestamp&gt;,v1=&lt;hmac&gt;</code>.
      </p>

      <CriarEndpointForm />

      {endpointsIniciais.length === 0 ? (
        <p className="text-sm text-muted">Nenhum webhook cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {endpointsIniciais.map((endpoint) => (
            <EndpointLinha key={endpoint.id} endpoint={endpoint} />
          ))}
        </ul>
      )}
    </div>
  );
}
