"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { gerarAnaliseIaAction } from "@/app/app/fichas/actions";

export function GerarAnaliseButton({ fichaId, jaTemAnalise }: { fichaId: string; jaTemAnalise: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarAnaliseIaAction(fichaId);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={gerar} disabled={isPending} size="sm">
        {isPending ? "Gerando análise…" : jaTemAnalise ? "Gerar nova análise com IA" : "Gerar análise com IA"}
      </Button>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
