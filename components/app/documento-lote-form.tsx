"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError, Label } from "@/components/ui/input";
import type { AnaliseDocumento, StatusAnaliseDocumento } from "@/lib/types";
import { analisarDocumentosLoteAction } from "@/app/app/documentos/actions";
import { MAX_ARQUIVOS_LOTE_DOCUMENTO } from "@/lib/analise-documento/constantes";

const ACCEPT_DOCUMENTO =
  ".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

const STATUS_TONE: Record<StatusAnaliseDocumento, "silver" | "green" | "red"> = {
  processando: "silver",
  pronto: "green",
  erro: "red",
};

const STATUS_LABEL: Record<StatusAnaliseDocumento, string> = {
  processando: "Processando…",
  pronto: "Pronta",
  erro: "Erro",
};

/**
 * Upload + análise em lote (`/app/documentos/lote`). Processamento
 * sequencial no servidor (ADR 0011 seção 8) — este formulário só dispara a
 * Server Action e exibe o resultado por item quando ela retorna; não há
 * atualização incremental de progresso item-a-item durante o processamento
 * (sem infraestrutura de streaming/fila nesta v1).
 */
export function DocumentoLoteForm({ fichaCasoId }: { fichaCasoId?: string | null }) {
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AnaliseDocumento[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setErro(null);
    setResultado(null);
    if (fichaCasoId) formData.set("fichaCasoId", fichaCasoId);
    startTransition(async () => {
      const resposta = await analisarDocumentosLoteAction(formData);
      if (!resposta.ok) {
        setErro(resposta.error);
        return;
      }
      setResultado(resposta.analises);
    });
  }

  return (
    <div className="space-y-6">
      <form action={enviar} className="space-y-4">
        {fichaCasoId && (
          <p className="text-xs text-muted">Os documentos deste lote serão vinculados à ficha de caso de origem.</p>
        )}
        <div>
          <Label htmlFor="documento-lote-arquivos">
            Documentos (até {MAX_ARQUIVOS_LOTE_DOCUMENTO} arquivos — PDF, DOCX ou imagem, até 15MB cada)
          </Label>
          <input
            id="documento-lote-arquivos"
            name="arquivos"
            type="file"
            multiple
            accept={ACCEPT_DOCUMENTO}
            required
            disabled={isPending}
            className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Processando lote…" : "Analisar em lote"}
        </Button>
        <FieldError>{erro}</FieldError>
        {isPending && (
          <p className="text-xs text-muted">
            Processamento sequencial — um lote de {MAX_ARQUIVOS_LOTE_DOCUMENTO} arquivos pode levar vários minutos.
            Não saia desta página.
          </p>
        )}
      </form>

      {resultado && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-ice">Resultado do lote ({resultado.length} documento(s))</h3>
          <ul className="divide-y divide-white/5">
            {resultado.map((analise) => (
              <li key={analise.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ice">{analise.nome_arquivo}</p>
                  {analise.status === "erro" && analise.erro && (
                    <p className="text-xs text-red-400">{analise.erro}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[analise.status]}>{STATUS_LABEL[analise.status]}</Badge>
                  {analise.status === "pronto" && (
                    <Link
                      href={`/app/documentos/${analise.id}`}
                      className="text-xs font-medium text-silver hover:text-silver-2"
                    >
                      Ver resultado
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
