"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reindexarDadosInternosAction } from "@/app/app/base-conhecimento/actions";

export function ReindexarInternoButton() {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {mensagem && <span className="text-xs text-muted">{mensagem}</span>}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setMensagem(null);
          startTransition(async () => {
            const resultado = await reindexarDadosInternosAction();
            setMensagem(resultado.ok ? "Reindexado com sucesso." : resultado.error);
          });
        }}
      >
        {isPending ? "Reindexando…" : "Reindexar dados internos"}
      </Button>
    </div>
  );
}
