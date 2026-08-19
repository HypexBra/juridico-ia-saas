"use client";

import { useActionState } from "react";
import { consultarStatusPublicoAction, type ConsultaPublicaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INITIAL_STATE: ConsultaPublicaState = { error: null, resultados: null };

export function ConsultarStatusForm({ slugInicial }: { slugInicial: string | null }) {
  const [state, formAction, isPending] = useActionState(consultarStatusPublicoAction, INITIAL_STATE);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="slug">Identificador do escritório</Label>
          <Input
            id="slug"
            name="slug"
            type="text"
            autoComplete="off"
            placeholder="nome-do-escritorio"
            defaultValue={slugInicial ?? ""}
            required
          />
          <p className="mt-1.5 text-xs text-muted">
            É o identificador usado no link do escritório (ex: enviado por e-mail ou WhatsApp).
          </p>
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            maxLength={14}
            required
          />
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3.5 py-2.5 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Consultando…" : "Consultar"}
        </Button>
      </form>

      {state.resultados && state.resultados.length > 0 && (
        <div className="space-y-3">
          {state.resultados.map((resultado, indice) => (
            <Card key={indice}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{resultado.nomeCliente}</CardTitle>
                <Badge tone="silver">{resultado.statusResumido}</Badge>
              </div>
              <p className="text-sm text-muted">{resultado.areaDireito ?? "Área não informada"}</p>
              <p className="mt-1 text-xs text-muted">
                Aberto em{" "}
                {new Date(resultado.criadoEm).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
