"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { excluirDocumentoAction } from "@/app/app/base-conhecimento/actions";
import type { DocumentoConhecimento } from "@/lib/types";

const TONE_POR_STATUS = {
  pendente: "muted",
  processando: "blue",
  pronto: "green",
  erro: "red",
} as const;

export function DocumentoConhecimentoRow({ documento }: { documento: DocumentoConhecimento }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [removido, setRemovido] = useState(false);

  if (removido) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-navy-3/40 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-ice">{documento.nome_arquivo}</p>
        <p className="mt-0.5 text-xs text-muted">
          {documento.tipo_conteudo}
          {documento.status === "pronto" && ` · ${documento.total_chunks} trechos indexados`}
          {documento.status === "erro" && documento.erro && ` · ${documento.erro}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={TONE_POR_STATUS[documento.status]}>{documento.status}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setErro(null);
            startTransition(async () => {
              const resultado = await excluirDocumentoAction(documento.id);
              if (!resultado.ok) setErro(resultado.error);
              else setRemovido(true);
            });
          }}
        >
          Excluir
        </Button>
      </div>
      {erro && <p className="text-xs text-red-700">{erro}</p>}
    </div>
  );
}
