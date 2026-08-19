import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { listarDocumentosAction } from "./actions";
import { Card } from "@/components/ui/card";
import { UploadDocumentoForm } from "@/components/app/upload-documento-form";
import { DocumentoConhecimentoRow } from "@/components/app/documento-conhecimento-row";
import { ReindexarInternoButton } from "@/components/app/reindexar-interno-button";

export const metadata = { title: "Base de Conhecimento — Jurídico IA" };

export default async function BaseConhecimentoPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const documentos = await listarDocumentosAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Base de Conhecimento</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Alimenta o RAG do copiloto (
          <Link href="/app/chat" className="text-silver-2 underline underline-offset-2">
            Chat IA
          </Link>
          ). Suba legislação, jurisprudência ou doutrina em PDF/texto — o conteúdo é dividido em trechos,
          transformado em embeddings e passa a ser buscado automaticamente quando você pergunta algo no chat.
          Fichas de caso, prazos e modelos já cadastrados também entram como fonte de busca.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-ice">Enviar documento</h2>
        <UploadDocumentoForm />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-ice">Dados internos indexados</h2>
          <ReindexarInternoButton />
        </div>
        <p className="text-sm text-muted">
          Fichas de caso, prazos e modelos não são reindexados automaticamente a cada edição. Use o botão acima
          depois de fazer mudanças em massa (ex: importar dados) para atualizar a busca do copiloto.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-base font-semibold text-ice">Documentos enviados</h2>
        {documentos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <DocumentoConhecimentoRow key={doc.id} documento={doc} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
