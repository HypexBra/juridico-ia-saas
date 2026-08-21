"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/input";
import { analisarDocumentoAction } from "@/app/app/documentos/actions";

const ACCEPT_DOCUMENTO =
  ".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

/**
 * Upload + análise individual de documento avulso (`/app/documentos/novo`).
 * Em sucesso a Server Action redireciona direto para `/app/documentos/[id]`
 * (a página de resultado) — este componente só precisa tratar o caminho de
 * erro, que mantém o usuário na tela para tentar de novo.
 */
export function DocumentoUploadForm({ fichaCasoId }: { fichaCasoId?: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setErro(null);
    if (fichaCasoId) formData.set("fichaCasoId", fichaCasoId);
    startTransition(async () => {
      const resultado = await analisarDocumentoAction(formData);
      if (!resultado.ok) setErro(resultado.error);
    });
  }

  return (
    <form action={enviar} className="space-y-4">
      {fichaCasoId && (
        <p className="text-xs text-muted">
          Este documento será vinculado à ficha de caso de origem.
        </p>
      )}
      <div>
        <Label htmlFor="documento-upload-arquivo">Documento (PDF, DOCX ou imagem — até 15MB)</Label>
        <input
          id="documento-upload-arquivo"
          name="arquivo"
          type="file"
          accept={ACCEPT_DOCUMENTO}
          required
          disabled={isPending}
          className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Analisando documento…" : "Analisar documento"}
      </Button>
      <FieldError>{erro}</FieldError>
      {isPending && (
        <p className="text-xs text-muted">
          A análise pode levar até 2 minutos — não saia desta página. Você será redirecionado para o resultado
          assim que terminar.
        </p>
      )}
    </form>
  );
}
