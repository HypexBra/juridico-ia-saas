import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { gerarDocx } from "@/lib/documentos/gerar-docx";
import { gerarDocumentoCondicionalAction } from "@/app/app/fichas/[id]/mail-merge-condicional-actions";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ modeloId: z.string().uuid() });

/**
 * Gera e baixa, em um único clique, o .docx já resolvido pelo motor de
 * mail-merge condicional (`gerarDocumentoCondicionalAction`, migration
 * 0020) — mesmo padrão de `/api/fichas/[id]/documento` (mail-merge simples,
 * plano free), mas encaminhando o resultado da automação com lógica
 * condicional (feature Pro "automacao_documento_condicional"). Route
 * Handler (não Server Action) pelo mesmo motivo do irmão simples: download
 * precisa controlar `Content-Disposition`, que Server Actions não expõem.
 *
 * Gate de plano/validação de existência de ficha/modelo já acontece dentro
 * de `gerarDocumentoCondicionalAction` — este handler só traduz o
 * resultado `{ok, error}` em status HTTP e, no caso de sucesso, gera o
 * binário a partir do texto já resolvido.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Ficha inválida." }, { status: 400 });

  const parsedQuery = querySchema.safeParse({ modeloId: request.nextUrl.searchParams.get("modeloId") });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Selecione um modelo para gerar o documento." }, { status: 400 });
  }

  const resultado = await gerarDocumentoCondicionalAction(parsedParams.data.id, parsedQuery.data.modeloId);

  if (!resultado.ok) {
    const status =
      resultado.error === "Modelo não encontrado." || resultado.error === "Ficha não encontrada."
        ? 404
        : resultado.error === "Sessão expirada. Faça login novamente."
          ? 401
          : 400;
    return NextResponse.json({ error: resultado.error }, { status });
  }

  const bytes = await gerarDocx(resultado.modelo.nome, resultado.resultado.textoFinal);
  const nomeArquivoBase = resultado.modelo.nome.replace(/[^\w\-À-ÿ ]/g, "").trim() || "documento";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nomeArquivoBase}.docx"`,
      "X-Variaveis-Nao-Resolvidas": resultado.resultado.variaveisNaoResolvidas.join(","),
    },
  });
}
