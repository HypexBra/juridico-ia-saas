"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { DocumentoParaAssinatura, StatusDocumentoAssinatura } from "@/lib/types";

type EnviarAssinaturaState = { error: string | null; ok: boolean };
type Action = (prev: EnviarAssinaturaState, formData: FormData) => Promise<EnviarAssinaturaState>;

const ESTADO_INICIAL: EnviarAssinaturaState = { error: null, ok: false };

const RÓTULO_STATUS_DOC: Record<StatusDocumentoAssinatura, string> = {
  rascunho: "Não enviado",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  recusado: "Recusado",
};

const TONE_STATUS_DOC: Record<StatusDocumentoAssinatura, "muted" | "silver" | "green" | "red"> = {
  rascunho: "muted",
  aguardando_assinatura: "silver",
  assinado: "green",
  recusado: "red",
};

type SignatarioCampo = { id: string; nome: string; email: string };

function novoSignatarioVazio(): SignatarioCampo {
  return { id: crypto.randomUUID(), nome: "", email: "" };
}

/**
 * Formulário de envio para assinatura eletrônica + histórico de envios.
 * Recebe `action` já vinculada (via `.bind`) ao id do modelo/proposta de
 * origem — o componente em si não sabe de onde vem o documento.
 */
export function EnviarAssinaturaForm({
  action,
  historico,
  provedorConfigurado,
}: {
  action: Action;
  historico: DocumentoParaAssinatura[];
  provedorConfigurado: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, ESTADO_INICIAL);
  const [signatarios, setSignatarios] = useState<SignatarioCampo[]>([novoSignatarioVazio()]);
  const [formato, setFormato] = useState<"docx" | "pdf">("docx");

  function atualizarSignatario(id: string, campo: "nome" | "email", valor: string) {
    setSignatarios((atual) => atual.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
  }

  function removerSignatario(id: string) {
    setSignatarios((atual) => (atual.length > 1 ? atual.filter((s) => s.id !== id) : atual));
  }

  if (!provedorConfigurado) {
    return (
      <Card>
        <CardTitle>Assinatura eletrônica</CardTitle>
        <p className="mt-2 text-sm text-muted">
          Envio para assinatura eletrônica está desabilitado neste ambiente. Configure a variável de ambiente{" "}
          <code className="rounded bg-ink/10 px-1 py-0.5 text-xs">AUTENTIQUE_API_TOKEN</code> para habilitar.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Enviar para assinatura eletrônica</CardTitle>
      <p className="mt-1 text-sm text-muted">
        Gera o documento e envia para os signatários assinarem eletronicamente via Autentique.
      </p>

      <form
        action={(formData) => {
          formData.set("signatarios", JSON.stringify(signatarios.map(({ nome, email }) => ({ nome, email }))));
          formAction(formData);
        }}
        className="mt-4 space-y-4"
      >
        <div className="space-y-3">
          {signatarios.map((signatario, index) => (
            <div key={signatario.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <Label htmlFor={`nome-${signatario.id}`}>Signatário {index + 1} — nome</Label>
                <Input
                  id={`nome-${signatario.id}`}
                  required
                  value={signatario.nome}
                  onChange={(e) => atualizarSignatario(signatario.id, "nome", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor={`email-${signatario.id}`}>E-mail</Label>
                <Input
                  id={`email-${signatario.id}`}
                  type="email"
                  required
                  value={signatario.email}
                  onChange={(e) => atualizarSignatario(signatario.id, "email", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={signatarios.length === 1}
                onClick={() => removerSignatario(signatario.id)}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setSignatarios((a) => [...a, novoSignatarioVazio()])}>
            + Adicionar signatário
          </Button>

          <div className="ml-auto">
            <Label htmlFor="formato">Formato do arquivo</Label>
            <Select id="formato" name="formato" value={formato} onChange={(e) => setFormato(e.target.value as "docx" | "pdf")}>
              <option value="docx">Word (.docx)</option>
              <option value="pdf">PDF</option>
            </Select>
          </div>
        </div>

        <FieldError>{state.error}</FieldError>
        {state.ok && <p className="text-xs font-medium text-green">Documento enviado para assinatura com sucesso.</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enviando…" : "Enviar para assinatura"}
          </Button>
        </div>
      </form>

      {historico.length > 0 && (
        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Envios anteriores</p>
          <ul className="space-y-2">
            {historico.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ice-2">
                  {new Date(doc.criado_em).toLocaleDateString("pt-BR")} · {doc.signatarios.length} signatário(s)
                </span>
                <Badge tone={TONE_STATUS_DOC[doc.status]}>{RÓTULO_STATUS_DOC[doc.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
