"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TIPOS_PESSOA_CASO, labelTipoPessoaCaso } from "@/lib/casos/pessoas";
import type { PessoaCaso, TipoPessoaCaso } from "@/lib/types";
import {
  criarPessoaCasoAction,
  atualizarPessoaCasoAction,
  removerPessoaCasoAction,
} from "./pessoas-actions";

const TONE_TIPO: Record<TipoPessoaCaso, "silver" | "red" | "muted" | "blue"> = {
  parte: "silver",
  adverso: "red",
  testemunha: "blue",
  terceiro: "muted",
};

type FormValores = {
  tipo: TipoPessoaCaso;
  nome: string;
  documento: string;
  contato: string;
  papelProcessual: string;
};

const FORM_VAZIO: FormValores = { tipo: "parte", nome: "", documento: "", contato: "", papelProcessual: "" };

export function PessoasCasoSection({
  fichaCasoId,
  pessoasIniciais,
}: {
  fichaCasoId: string;
  pessoasIniciais: PessoaCaso[];
}) {
  const [pessoas, setPessoas] = useState(pessoasIniciais);
  const [formAberto, setFormAberto] = useState(false);
  const [edicaoId, setEdicaoId] = useState<string | null>(null);
  const [valores, setValores] = useState<FormValores>(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirNovo() {
    setEdicaoId(null);
    setValores(FORM_VAZIO);
    setErro(null);
    setFormAberto(true);
  }

  function abrirEdicao(pessoa: PessoaCaso) {
    setEdicaoId(pessoa.id);
    setValores({
      tipo: pessoa.tipo,
      nome: pessoa.nome,
      documento: pessoa.documento ?? "",
      contato: pessoa.contato ?? "",
      papelProcessual: pessoa.papel_processual ?? "",
    });
    setErro(null);
    setFormAberto(true);
  }

  function cancelar() {
    setFormAberto(false);
    setEdicaoId(null);
    setErro(null);
  }

  function salvar() {
    if (!valores.nome.trim()) {
      setErro("Informe o nome da pessoa.");
      return;
    }
    setErro(null);

    const dados = {
      tipo: valores.tipo,
      nome: valores.nome,
      documento: valores.documento || null,
      contato: valores.contato || null,
      papelProcessual: valores.papelProcessual || null,
    };

    startTransition(async () => {
      const resultado = edicaoId
        ? await atualizarPessoaCasoAction(edicaoId, dados)
        : await criarPessoaCasoAction(fichaCasoId, dados);

      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }

      setPessoas((atual) =>
        edicaoId
          ? atual.map((p) => (p.id === resultado.pessoa.id ? resultado.pessoa : p))
          : [...atual, resultado.pessoa],
      );
      setFormAberto(false);
      setEdicaoId(null);
    });
  }

  function remover(pessoaId: string) {
    if (!confirm("Remover esta pessoa do caso?")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await removerPessoaCasoAction(pessoaId);
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setPessoas((atual) => atual.filter((p) => p.id !== pessoaId));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ice">Pessoas do caso ({pessoas.length})</h3>
        {!formAberto && <Button size="sm" onClick={abrirNovo}>+ Adicionar pessoa</Button>}
      </div>

      {formAberto && (
        <div className="rounded-lg border border-ink/10 bg-navy/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pessoa-tipo">Tipo</Label>
              <Select
                id="pessoa-tipo"
                value={valores.tipo}
                onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoPessoaCaso }))}
              >
                {TIPOS_PESSOA_CASO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {labelTipoPessoaCaso(tipo)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pessoa-nome">Nome</Label>
              <Input
                id="pessoa-nome"
                value={valores.nome}
                onChange={(e) => setValores((v) => ({ ...v, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="pessoa-documento">Documento (opcional)</Label>
              <Input
                id="pessoa-documento"
                value={valores.documento}
                onChange={(e) => setValores((v) => ({ ...v, documento: e.target.value }))}
                placeholder="CPF, CNPJ, RG…"
              />
            </div>
            <div>
              <Label htmlFor="pessoa-contato">Contato (opcional)</Label>
              <Input
                id="pessoa-contato"
                value={valores.contato}
                onChange={(e) => setValores((v) => ({ ...v, contato: e.target.value }))}
                placeholder="Telefone ou e-mail"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pessoa-papel">Papel processual (opcional)</Label>
              <Input
                id="pessoa-papel"
                value={valores.papelProcessual}
                onChange={(e) => setValores((v) => ({ ...v, papelProcessual: e.target.value }))}
                placeholder="Ex: Autor, Réu, Advogado da parte adversa…"
              />
            </div>
          </div>

          <FieldError>{erro}</FieldError>

          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={salvar} disabled={isPending}>
              {isPending ? "Salvando…" : edicaoId ? "Salvar alterações" : "Adicionar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelar} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!formAberto && erro && <p className="text-xs text-red-700">{erro}</p>}

      {pessoas.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma pessoa cadastrada ainda. Adicione partes, adverso, testemunhas ou terceiros envolvidos no caso.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {pessoas.map((pessoa) => (
            <li key={pessoa.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ice">{pessoa.nome}</p>
                  <Badge tone={TONE_TIPO[pessoa.tipo]}>{labelTipoPessoaCaso(pessoa.tipo)}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {pessoa.documento ? pessoa.documento : "Sem documento"}
                  {pessoa.contato ? ` · ${pessoa.contato}` : ""}
                  {pessoa.papel_processual ? ` · ${pessoa.papel_processual}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => abrirEdicao(pessoa)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-ink/5 hover:text-ice disabled:opacity-40"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => remover(pessoa.id)}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
