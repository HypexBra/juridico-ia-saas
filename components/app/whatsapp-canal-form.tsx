"use client";

import { useActionState } from "react";
import {
  salvarCanalWhatsappAction,
  alternarCanalWhatsappAction,
  type CanalWhatsappState,
} from "@/app/app/perfil/whatsapp-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const INITIAL_STATE: CanalWhatsappState = { error: null, sucesso: null };

export function WhatsappCanalForm({
  canalExistente,
}: {
  canalExistente: { phoneNumberId: string; numeroExibicao: string | null; ativo: boolean } | null;
}) {
  const [state, formAction, isPending] = useActionState(salvarCanalWhatsappAction, INITIAL_STATE);
  const [toggleState, toggleAction, isTogglePending] = useActionState(
    alternarCanalWhatsappAction,
    INITIAL_STATE,
  );

  return (
    <div className="space-y-4">
      {canalExistente && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-navy-3/40 px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium text-ice">
              Canal cadastrado{canalExistente.numeroExibicao ? ` — ${canalExistente.numeroExibicao}` : ""}
            </p>
            <p className="text-xs text-muted">Phone Number ID: {canalExistente.phoneNumberId}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={canalExistente.ativo ? "green" : "muted"}>
              {canalExistente.ativo ? "Ativo" : "Desativado"}
            </Badge>
            <form action={toggleAction}>
              <input type="hidden" name="ativar" value={canalExistente.ativo ? "false" : "true"} />
              <Button type="submit" variant="ghost" size="sm" disabled={isTogglePending}>
                {canalExistente.ativo ? "Desativar" : "Reativar"}
              </Button>
            </form>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="phoneNumberId">Phone Number ID (Meta Cloud API)</Label>
          <Input
            id="phoneNumberId"
            name="phoneNumberId"
            defaultValue={canalExistente?.phoneNumberId ?? ""}
            placeholder="123456789012345"
            required
          />
        </div>

        <div>
          <Label htmlFor="numeroExibicao">Número de exibição (opcional)</Label>
          <Input
            id="numeroExibicao"
            name="numeroExibicao"
            defaultValue={canalExistente?.numeroExibicao ?? ""}
            placeholder="(11) 99999-8888"
            maxLength={20}
          />
        </div>

        <div>
          <Label htmlFor="tokenAcesso">Token de acesso (Meta Cloud API)</Label>
          <Input
            id="tokenAcesso"
            name="tokenAcesso"
            type="password"
            autoComplete="off"
            placeholder={canalExistente ? "Deixe em branco para manter o token atual" : "Cole o token de acesso permanente"}
          />
          <p className="mt-1.5 text-xs text-muted">
            Gerado no WhatsApp Manager da Meta, com token de sistema de longa duração. Fica criptografado no
            banco e nunca é exibido de volta na tela.
          </p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar canal"}
        </Button>

        {(state.error || toggleState.error) && (
          <p className="text-xs text-red-400">{state.error ?? toggleState.error}</p>
        )}
        {(state.sucesso || toggleState.sucesso) && (
          <p className="text-xs text-muted">{state.sucesso ?? toggleState.sucesso}</p>
        )}
      </form>
    </div>
  );
}
