"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/input";
import { auditarPecaColadaAction, auditarPecaUploadAction } from "@/app/app/auditor/actions";

const ACCEPT_PECA =
  ".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

type ModoEntrada = "colado" | "upload";

/**
 * Formulário do Auditor de Peças (`/app/auditor`, ADR 0012, seção 2): aceita
 * texto colado OU upload de arquivo — dois modos do mesmo formulário (toggle
 * explícito), mesmo padrão de `RedlineAnaliseForm` (texto) e
 * `DocumentoUploadForm` (upload) combinados numa tela só. Em sucesso, as
 * Server Actions redirecionam direto para `/app/auditor/[id]` — este
 * componente só precisa tratar o caminho de erro, que mantém o usuário na
 * tela para tentar de novo.
 */
export function AuditorForm({ fichaCasoId }: { fichaCasoId?: string | null }) {
  const [modo, setModo] = useState<ModoEntrada>("colado");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setErro(null);
    if (fichaCasoId) formData.set("fichaCasoId", fichaCasoId);

    startTransition(async () => {
      const resultado =
        modo === "colado" ? await auditarPecaColadaAction(formData) : await auditarPecaUploadAction(formData);
      if (!resultado.ok) setErro(resultado.error);
    });
  }

  return (
    <div className="space-y-4">
      {fichaCasoId && (
        <p className="text-xs text-muted">Esta auditoria será vinculada à ficha de caso de origem.</p>
      )}

      <div className="inline-flex rounded-lg border border-white/10 bg-navy-2 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "colado"}
          onClick={() => setModo("colado")}
          disabled={isPending}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            modo === "colado" ? "bg-silver/15 text-silver-2" : "text-muted hover:text-ice"
          }`}
        >
          Colar texto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "upload"}
          onClick={() => setModo("upload")}
          disabled={isPending}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            modo === "upload" ? "bg-silver/15 text-silver-2" : "text-muted hover:text-ice"
          }`}
        >
          Enviar arquivo
        </button>
      </div>

      <form action={enviar} className="space-y-4">
        <div>
          <Label htmlFor="auditor-titulo">Título/identificação (opcional)</Label>
          <Input
            id="auditor-titulo"
            name="titulo"
            placeholder="Ex: Contestação — Processo 0001234-56.2026"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            disabled={isPending}
          />
        </div>

        {modo === "colado" ? (
          <div>
            <Label htmlFor="auditor-texto">Texto da peça</Label>
            <Textarea
              id="auditor-texto"
              name="texto"
              rows={14}
              placeholder="Cole aqui o texto integral da peça processual a ser auditada…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={isPending}
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="auditor-arquivo">Peça processual (PDF, DOCX ou imagem — até 15MB)</Label>
            <input
              id="auditor-arquivo"
              name="arquivo"
              type="file"
              accept={ACCEPT_PECA}
              required
              disabled={isPending}
              className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending || (modo === "colado" && !texto.trim())}
          size="sm"
        >
          {isPending ? "Auditando peça…" : "Auditar peça"}
        </Button>

        <FieldError>{erro}</FieldError>

        {isPending && (
          <p className="text-xs text-muted">
            A auditoria pode levar até 2 minutos — não saia desta página. Você será redirecionado para o resultado
            assim que terminar.
          </p>
        )}
      </form>
    </div>
  );
}
