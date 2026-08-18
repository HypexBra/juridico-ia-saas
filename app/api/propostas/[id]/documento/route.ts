import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { gerarDocx } from "@/lib/documentos/gerar-docx";
import { gerarPdf } from "@/lib/documentos/gerar-pdf";
import type { PropostaAcao } from "@/lib/types";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Gera e baixa o arquivo de uma proposta `generate_documento` JÁ APROVADA.
 * O binário nunca é persistido: é regenerado a cada download a partir do
 * texto validado (`payload.conteudo`) guardado em `propostas_acao` — evita
 * precisar configurar Supabase Storage para esta feature e mantém o gate de
 * aprovação como única porta de entrada (uma proposta 'pending' ou
 * 'rejected' nunca produz arquivo, mesmo que alguém adivinhe a URL).
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Proposta inválida." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propostas_acao")
    .select("*")
    .eq("id", parsedParams.data.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  const proposta = data as PropostaAcao;
  if (proposta.tipo !== "generate_documento") {
    return NextResponse.json({ error: "Esta proposta não gera documento." }, { status: 400 });
  }
  if (proposta.status !== "approved" && proposta.status !== "applied") {
    return NextResponse.json({ error: "Documento ainda não aprovado." }, { status: 403 });
  }

  const payload = proposta.payload as { titulo: string; conteudo: string; formato?: "docx" | "pdf" };
  const formato = payload.formato ?? "docx";
  const nomeArquivoBase = payload.titulo.replace(/[^\w\-À-ÿ ]/g, "").trim() || "documento";

  if (formato === "pdf") {
    const bytes = await gerarPdf(payload.titulo, payload.conteudo);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoBase}.pdf"`,
      },
    });
  }

  const bytes = await gerarDocx(payload.titulo, payload.conteudo);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${nomeArquivoBase}.docx"`,
    },
  });
}
