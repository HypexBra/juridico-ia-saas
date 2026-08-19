"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import {
  aprovarPropostaAction,
  buscarDocumentoAssinaturaDaPropostaAction,
  buscarPropostaAction,
  enviarPropostaParaAssinaturaAction,
  rejeitarPropostaAction,
} from "@/app/app/chat/propostas-actions";
import type { DocumentoParaAssinatura, PropostaAcao, StatusDocumentoAssinatura } from "@/lib/types";

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

function EnvioAssinaturaInline({
  propostaId,
  onEnviado,
}: {
  propostaId: string;
  onEnviado: (documento: DocumentoParaAssinatura | null) => void;
}) {
  const [signatarios, setSignatarios] = useState<SignatarioCampo[]>([{ id: crypto.randomUUID(), nome: "", email: "" }]);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("signatarios", JSON.stringify(signatarios.map(({ nome, email }) => ({ nome, email }))));
      const resultado = await enviarPropostaParaAssinaturaAction(propostaId, { error: null, ok: false }, formData);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      onEnviado(await buscarDocumentoAssinaturaDaPropostaAction(propostaId));
    });
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-navy-2/50 p-2.5">
      {signatarios.map((s, i) => (
        <div key={s.id} className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`na-${s.id}`} className="mb-1 text-[10px]">
              Signatário {i + 1}
            </Label>
            <Input
              id={`na-${s.id}`}
              placeholder="Nome"
              value={s.nome}
              onChange={(e) =>
                setSignatarios((atual) => atual.map((x) => (x.id === s.id ? { ...x, nome: e.target.value } : x)))
              }
            />
          </div>
          <div>
            <Label htmlFor={`ea-${s.id}`} className="mb-1 text-[10px]">
              E-mail
            </Label>
            <Input
              id={`ea-${s.id}`}
              type="email"
              placeholder="email@exemplo.com"
              value={s.email}
              onChange={(e) =>
                setSignatarios((atual) => atual.map((x) => (x.id === s.id ? { ...x, email: e.target.value } : x)))
              }
            />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSignatarios((a) => [...a, { id: crypto.randomUUID(), nome: "", email: "" }])}
        >
          + Signatário
        </Button>
        <Button type="button" size="sm" disabled={isPending} onClick={enviar}>
          {isPending ? "Enviando…" : "Confirmar envio"}
        </Button>
      </div>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}

const RÓTULO_TIPO: Record<PropostaAcao["tipo"], string> = {
  update_prazo: "Atualizar prazo",
  update_ficha: "Atualizar ficha de caso",
  create_prazo: "Criar prazo",
  create_ficha: "Criar ficha de caso",
  generate_documento: "Gerar documento",
};

const TONE_POR_STATUS = {
  pending: "silver",
  approved: "green",
  applied: "green",
  rejected: "red",
  failed: "red",
  expired: "muted",
} as const;

const RÓTULO_STATUS: Record<PropostaAcao["status"], string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  applied: "Aplicada",
  rejected: "Rejeitada",
  failed: "Falhou ao aplicar",
  expired: "Expirada",
};

export function PropostaAcaoCard({ propostaId }: { propostaId: string }) {
  const [proposta, setProposta] = useState<PropostaAcao | null>(null);
  const [documentoAssinatura, setDocumentoAssinatura] = useState<DocumentoParaAssinatura | null>(null);
  const [mostrarFormAssinatura, setMostrarFormAssinatura] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    buscarPropostaAction(propostaId).then((p) => {
      if (!cancelado) setProposta(p);
    });
    buscarDocumentoAssinaturaDaPropostaAction(propostaId).then((d) => {
      if (!cancelado) setDocumentoAssinatura(d);
    });
    return () => {
      cancelado = true;
    };
  }, [propostaId]);

  if (!proposta) return null;

  const payload = proposta.payload as Record<string, unknown>;
  const podeAgir = proposta.status === "pending";

  function agir(acao: "aprovar" | "rejeitar") {
    setErro(null);
    startTransition(async () => {
      const resultado = acao === "aprovar" ? await aprovarPropostaAction(proposta!.id) : await rejeitarPropostaAction(proposta!.id);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      const atualizada = await buscarPropostaAction(proposta!.id);
      setProposta(atualizada);
    });
  }

  return (
    <div className="mt-2 max-w-[85%] rounded-xl border border-silver/25 bg-navy-3/70 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-silver-2">
          {RÓTULO_TIPO[proposta.tipo]}
        </span>
        <Badge tone={TONE_POR_STATUS[proposta.status]}>{RÓTULO_STATUS[proposta.status]}</Badge>
      </div>

      <p className="text-sm text-ice-2">{proposta.resumo}</p>

      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}

      {podeAgir && (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" disabled={isPending} onClick={() => agir("aprovar")}>
            Aprovar
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={isPending} onClick={() => agir("rejeitar")}>
            Rejeitar
          </Button>
        </div>
      )}

      {proposta.tipo === "generate_documento" && (proposta.status === "approved" || proposta.status === "applied") && (
        <>
          <a
            href={`/api/propostas/${proposta.id}/documento`}
            className="mt-3 inline-block text-sm font-medium text-silver-2 underline underline-offset-2"
          >
            Baixar {String(payload.formato ?? "docx").toUpperCase()}
          </a>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Assinatura eletrônica</span>
            {documentoAssinatura && (
              <Badge tone={TONE_STATUS_DOC[documentoAssinatura.status]}>
                {RÓTULO_STATUS_DOC[documentoAssinatura.status]}
              </Badge>
            )}
          </div>

          {!documentoAssinatura && !mostrarFormAssinatura && (
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setMostrarFormAssinatura(true)}>
              Enviar pra assinatura
            </Button>
          )}

          {!documentoAssinatura && mostrarFormAssinatura && (
            <EnvioAssinaturaInline propostaId={proposta.id} onEnviado={setDocumentoAssinatura} />
          )}
        </>
      )}
    </div>
  );
}
