import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarDocx } from "@/lib/documentos/gerar-docx";
import { gerarDocumentoDaFicha } from "@/lib/peticoes/gerar-documento-ficha";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ modeloId: z.string().uuid() });

/**
 * Gera e baixa, em um único clique a partir da tela da ficha, o .docx já
 * preenchido pelo mail-merge jurídico (migration 0010) do modelo escolhido
 * com os dados reais do caso. Route Handler (não Server Action) porque o
 * download precisa controlar `Content-Disposition`, que Server Actions não
 * expõem (mesmo padrão já usado em `app/api/propostas/[id]/documento`).
 *
 * O binário nunca é persistido: é regenerado a cada download a partir do
 * texto resolvido por `gerarDocumentoDaFicha` (mesma orquestração usada pelo
 * preview em texto de `gerarPeticaoDeModeloAction`) — não duplica o motor de
 * mail-merge nem o de geração de .docx, só encaminha o resultado de um para
 * o outro.
 *
 * Variável não resolvida (ex: ficha sem contrato de honorário vinculado)
 * NUNCA bloqueia o download — o documento sai com o placeholder original no
 * lugar e a lista de variáveis pendentes vai no header
 * `X-Variaveis-Nao-Resolvidas` (CSV simples, nomes de variável sem
 * acentuação/espaço, seguro para header HTTP) para o cliente avisar o
 * advogado antes de protocolar.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Ficha inválida." }, { status: 400 });

  const parsedQuery = querySchema.safeParse({ modeloId: request.nextUrl.searchParams.get("modeloId") });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Selecione um modelo para gerar o documento." }, { status: 400 });
  }

  const supabase = await createClient();
  const resultado = await gerarDocumentoDaFicha(supabase, {
    fichaId: parsedParams.data.id,
    modeloId: parsedQuery.data.modeloId,
    escritorioId: usuario.perfil.escritorio_id,
    perfilId: usuario.perfil.id,
  });

  if (!resultado.ok) {
    const status = resultado.error === "Modelo não encontrado." || resultado.error === "Ficha não encontrada." ? 404 : 400;
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
