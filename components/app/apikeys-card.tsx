"use client";

import { useActionState, useState } from "react";
import {
  criarApiKeyAction,
  revogarApiKeyAction,
  type ApiKeyListada,
  type CriarApiKeyState,
  type RevogarApiKeyState,
} from "@/app/app/perfil/apikeys-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const CRIAR_INITIAL_STATE: CriarApiKeyState = { error: null, chaveCompleta: null, chaves: [] };
const REVOGAR_INITIAL_STATE: RevogarApiKeyState = { error: null, chaves: [] };

function formatarData(iso: string | null): string {
  if (!iso) return "Nunca utilizada";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ChaveGeradaAviso({ chave }: { chave: string }) {
  const [copiada, setCopiada] = useState(false);

  return (
    // Aviso em papel-2 com hairline de tinta: bloco neutro, o texto carrega a
    // urgência (âmbar AA) e o chip mono destaca a chave única exibida.
    <div className="space-y-2 rounded-lg border border-ink/10 bg-paper-2 p-3.5">
      <p className="text-xs font-medium text-amber-700">
        Copie esta chave agora — por segurança, ela não será mostrada novamente. Se perdê-la, revogue e crie
        uma nova.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-navy px-2.5 py-1.5 font-mono text-xs text-ink">{chave}</code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(chave).then(() => {
              setCopiada(true);
              setTimeout(() => setCopiada(false), 2000);
            });
          }}
        >
          {copiada ? "Copiado!" : "Copiar chave"}
        </Button>
      </div>
    </div>
  );
}

function CriarChaveForm() {
  const [state, formAction, isPending] = useActionState(criarApiKeyAction, CRIAR_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-ink/10 bg-navy-3/40 p-3.5">
      <div>
        <Label htmlFor="nomeApiKey">Nome da chave</Label>
        <Input id="nomeApiKey" name="nome" placeholder="Ex: Zapier, n8n, sistema interno" maxLength={100} required />
        <FieldError>{state.error}</FieldError>
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? "Criando…" : "Criar nova chave"}
      </Button>
      {state.chaveCompleta && <ChaveGeradaAviso chave={state.chaveCompleta} />}
    </form>
  );
}

function RevogarChaveForm({ apiKeyId }: { apiKeyId: string }) {
  const [state, formAction, isPending] = useActionState(revogarApiKeyAction, REVOGAR_INITIAL_STATE);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
        Revogar
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={apiKeyId} />
      <span className="text-xs text-muted">Confirma revogar?</span>
      <Button type="submit" variant="danger" size="sm" disabled={isPending}>
        {isPending ? "Revogando…" : "Sim, revogar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)} disabled={isPending}>
        Cancelar
      </Button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export function ApiKeysCard({ chavesIniciais }: { chavesIniciais: ApiKeyListada[] }) {
  // As Server Actions revalidam `/app/perfil` a cada criação/revogação, o
  // que já refaz o fetch de `chavesIniciais` no Server Component pai — não
  // precisamos duplicar esse estado aqui, só renderizar o que veio de props.
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Crie chaves de API para integrar o sistema com outras ferramentas do escritório (Zapier, n8n, sistemas
        internos). Cada chave dá acesso de leitura às fichas de caso e prazos do seu escritório via{" "}
        <code className="text-ice-2">Authorization: Bearer &lt;chave&gt;</code>.
      </p>

      <CriarChaveForm />

      {chavesIniciais.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma chave criada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {chavesIniciais.map((chave) => (
            <li
              key={chave.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-navy-3/40 px-3.5 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-ice">
                  {chave.nome} <code className="text-xs text-muted">{chave.prefixoVisivel}…</code>
                </p>
                <p className="text-xs text-muted">
                  Criada em {formatarData(chave.criadoEm)} · Último uso: {formatarData(chave.ultimaUtilizacaoEm)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={chave.ativa ? "green" : "muted"}>{chave.ativa ? "Ativa" : "Revogada"}</Badge>
                {chave.ativa && <RevogarChaveForm apiKeyId={chave.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
