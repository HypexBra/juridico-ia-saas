"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, Label, FieldError } from "@/components/ui/input";
import { uploadDocumentoAction, type ResultadoUpload } from "@/app/app/base-conhecimento/actions";

const ESTADO_INICIAL: ResultadoUpload = { ok: true };

export function UploadDocumentoForm() {
  const [estado, formAction, isPending] = useActionState(uploadDocumentoAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <Label htmlFor="arquivo">Arquivo (.pdf ou .txt)</Label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          required
          className="block w-full text-sm text-ice file:mr-3 file:rounded-lg file:border-0 file:bg-navy-3 file:px-3 file:py-2 file:text-sm file:text-ice hover:file:bg-navy-3/70"
        />
      </div>
      <div className="sm:w-56">
        <Label htmlFor="tipoConteudo">Tipo de conteúdo</Label>
        <Select id="tipoConteudo" name="tipoConteudo" defaultValue="legislacao" required>
          <option value="legislacao">Legislação</option>
          <option value="jurisprudencia">Jurisprudência</option>
          <option value="doutrina">Doutrina</option>
          <option value="outro">Outro</option>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Processando…" : "Enviar"}
      </Button>
      {!estado.ok && <FieldError>{estado.error}</FieldError>}
    </form>
  );
}
