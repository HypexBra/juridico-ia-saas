"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/input";
import { compararDocumentosAction } from "@/app/app/documentos/actions";
import type { ResultadoComparacaoDocumento } from "@/lib/document-intelligence/tipos";
import { ComparacaoResultado } from "./comparacao-resultado";

const ACCEPT_COMPARACAO =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Formulário de comparação A x B (`/app/documentos/comparar`). Como nenhum
 * binário original fica armazenado (ver ADR 0011, seção 3), quando a página
 * chega com `?a=[id]` (vindo de "Comparar com outro documento" em
 * `/app/documentos/[id]`) o Documento A é só um vínculo de metadado —
 * o usuário ainda precisa reenviar o arquivo para a comparação rodar de
 * verdade.
 */
export function ComparacaoForm({
  analiseDocumentoAId,
  nomeArquivoAReferencia,
}: {
  analiseDocumentoAId?: string | null;
  nomeArquivoAReferencia?: string | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoComparacaoDocumento | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setErro(null);
    setResultado(null);
    if (analiseDocumentoAId) formData.set("analiseDocumentoAId", analiseDocumentoAId);
    startTransition(async () => {
      const resposta = await compararDocumentosAction(formData);
      if (!resposta.ok) {
        setErro(resposta.error);
        return;
      }
      setResultado(resposta.comparacao.resultado_comparacao);
    });
  }

  return (
    <div className="space-y-6">
      <form action={enviar} className="space-y-4">
        {analiseDocumentoAId && nomeArquivoAReferencia && (
          <p className="text-xs text-muted">
            Documento A de referência: <span className="text-ice">{nomeArquivoAReferencia}</span>. O arquivo
            original não fica armazenado — reenvie o mesmo arquivo abaixo para comparar.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="comparacao-arquivo-a">Documento A (PDF ou DOCX)</Label>
            <input
              id="comparacao-arquivo-a"
              name="arquivoA"
              type="file"
              accept={ACCEPT_COMPARACAO}
              required
              disabled={isPending}
              className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
            />
          </div>
          <div>
            <Label htmlFor="comparacao-arquivo-b">Documento B (PDF ou DOCX)</Label>
            <input
              id="comparacao-arquivo-b"
              name="arquivoB"
              type="file"
              accept={ACCEPT_COMPARACAO}
              required
              disabled={isPending}
              className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
            />
          </div>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Comparando…" : "Comparar documentos"}
        </Button>
        <FieldError>{erro}</FieldError>
        {isPending && (
          <p className="text-xs text-muted">A comparação pode levar até 2 minutos — não saia desta página.</p>
        )}
      </form>

      {resultado && <ComparacaoResultado resultado={resultado} />}
    </div>
  );
}
