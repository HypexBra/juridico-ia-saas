"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  criarContratoHonorarioAction,
  type CriarContratoHonorarioState,
} from "@/app/app/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { TipoContratoHonorario } from "@/lib/types";

const INITIAL_STATE: CriarContratoHonorarioState = { error: null };

const TIPO_LABEL: Record<TipoContratoHonorario, string> = {
  fixo: "Fixo",
  exito: "Êxito",
  aaj: "AAJ (fixo + êxito)",
};

const TOLERANCIA_RATEIO = 0.01;

type FichaOpcao = { id: string; nome_cliente: string | null };
type PerfilOpcao = { id: string; nome: string };

export function NovoContratoHonorarioForm({
  fichas,
  perfis,
  onSucesso,
}: {
  fichas: FichaOpcao[];
  perfis: PerfilOpcao[];
  onSucesso?: () => void;
}) {
  const [state, formAction, isPending] = useActionState(criarContratoHonorarioAction, INITIAL_STATE);
  const [tipo, setTipo] = useState<TipoContratoHonorario>("fixo");
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const estavaPendente = useRef(false);

  useEffect(() => {
    // Transição de "salvando" -> "ocioso" sem erro = submit concluído com
    // sucesso: reseta o form (inclusive os campos não-controlados) e o
    // rateio local, e avisa o pai (ex: fechar o diálogo).
    if (estavaPendente.current && !isPending && state.error === null) {
      formRef.current?.reset();
      setPercentuais({});
      setTipo("fixo");
      onSucesso?.();
    }
    estavaPendente.current = isPending;
  }, [isPending, state.error, onSucesso]);

  const somaRateio = useMemo(
    () => Object.values(percentuais).reduce((acumulado, valor) => acumulado + (Number(valor) || 0), 0),
    [percentuais],
  );
  const rateioFechado = Math.abs(somaRateio - 100) < TOLERANCIA_RATEIO;

  const mostraPercentualExito = tipo === "exito" || tipo === "aaj";

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fichaCasoId">Ficha do caso</Label>
          <Select id="fichaCasoId" name="fichaCasoId" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {fichas.map((ficha) => (
              <option key={ficha.id} value={ficha.id}>
                {ficha.nome_cliente ?? "Cliente sem nome"}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tipo">Tipo de honorário</Label>
          <Select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoContratoHonorario)}
          >
            {(Object.keys(TIPO_LABEL) as TipoContratoHonorario[]).map((valorTipo) => (
              <option key={valorTipo} value={valorTipo}>
                {TIPO_LABEL[valorTipo]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="valorTotal">
            Valor total {tipo === "exito" ? "(estimado, opcional)" : "(R$)"}
          </Label>
          <Input id="valorTotal" name="valorTotal" type="number" min="0.01" step="0.01" placeholder="15000.00" />
        </div>
        {mostraPercentualExito && (
          <div>
            <Label htmlFor="percentualExito">Percentual de êxito (%)</Label>
            <Input
              id="percentualExito"
              name="percentualExito"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="20"
              required={tipo === "exito"}
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="numeroParcelas">Número de parcelas</Label>
          <Input id="numeroParcelas" name="numeroParcelas" type="number" min="1" max="120" defaultValue="1" />
        </div>
        <div>
          <Label htmlFor="primeiraVencimento">1º vencimento</Label>
          <Input id="primeiraVencimento" name="primeiraVencimento" type="date" />
        </div>
      </div>
      <p className="text-xs text-muted">
        Informe valor total + 1º vencimento para gerar as parcelas automaticamente (vencimento mensal). Contratos
        de êxito sem valor definido podem ser criados só com o percentual — as parcelas entram depois.
      </p>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Rateio entre sócios (a soma deve fechar 100%)
        </p>
        {perfis.length === 0 ? (
          <p className="text-sm text-muted">Nenhum membro ativo na equipe para ratear.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {perfis.map((perfil) => (
              <div
                key={perfil.id}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-navy-2 px-3 py-2"
              >
                <label htmlFor={`percentual_${perfil.id}`} className="flex-1 truncate text-sm text-ice-2">
                  {perfil.nome}
                </label>
                <Input
                  id={`percentual_${perfil.id}`}
                  name={`percentual_${perfil.id}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className="w-20 text-right"
                  value={percentuais[perfil.id] ?? ""}
                  onChange={(evento) =>
                    setPercentuais((atual) => ({ ...atual, [perfil.id]: evento.target.value }))
                  }
                />
                <span className="text-xs text-muted">%</span>
              </div>
            ))}
          </div>
        )}
        <p className={`mt-2 text-xs font-medium ${rateioFechado ? "text-green" : "text-muted"}`}>
          Soma atual: {somaRateio.toFixed(2)}%
        </p>
      </div>

      <FieldError>{state.error}</FieldError>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Criar contrato"}
        </Button>
      </div>
    </form>
  );
}
