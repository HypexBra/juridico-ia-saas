"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea, FieldError } from "@/components/ui/input";
import { criarTeseManualAction } from "@/app/app/fichas/actions";
import type { TeseCaso } from "@/lib/types";

/**
 * Cadastro manual de tese jurídica (`teses_caso`) direto da ficha do caso —
 * complementa o write-back automático da IA (chat/análise de processo), que
 * até então era a única forma de uma tese entrar em `teses_caso`.
 */
export function NovaTeseDialog({
  fichaCasoId,
  onCriada,
}: {
  fichaCasoId: string;
  onCriada: (tese: TeseCaso) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fechar() {
    setAberto(false);
    setTitulo("");
    setDescricao("");
    setErro(null);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await criarTeseManualAction({ fichaCasoId, titulo, descricao });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      onCriada(resultado.tese);
      fechar();
    });
  }

  if (!aberto) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setAberto(true)}>
        + Adicionar tese
      </Button>
    );
  }

  return (
    <Dialog aberto={aberto} onFechar={fechar} titulo="Nova tese jurídica">
      <div className="space-y-4">
        <div>
          <Label htmlFor="tituloTese">Tese</Label>
          <Textarea
            id="tituloTese"
            name="tituloTese"
            required
            rows={3}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Prescrição intercorrente da execução"
          />
        </div>
        <div>
          <Label htmlFor="descricaoTese">Fundamentação (opcional)</Label>
          <Textarea
            id="descricaoTese"
            name="descricaoTese"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Base legal, jurisprudência ou raciocínio que sustenta a tese."
          />
        </div>

        <FieldError>{erro}</FieldError>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={fechar} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={isPending || titulo.trim().length === 0}>
            {isPending ? "Salvando…" : "Salvar tese"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
