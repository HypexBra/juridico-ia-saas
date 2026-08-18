import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpretarEventoWebhookAutentique, validarAssinaturaWebhookAutentique } from "@/lib/assinatura/autentique";
import type { DocumentoParaAssinatura, SignatarioDocumento } from "@/lib/types";

/**
 * Recebe callbacks do Autentique quando um documento é assinado/recusado.
 *
 * Segurança: NUNCA confia no payload sem antes validar a assinatura
 * HMAC-SHA256 (header `x-autentique-signature`) contra `AUTENTIQUE_WEBHOOK_SECRET`
 * — payload não verificado é rejeitado com 401 antes de tocar no banco. Usa o
 * corpo BRUTO da requisição pro HMAC (a assinatura é sobre os bytes exatos
 * enviados, não sobre o objeto já parseado/reserializado, que pode diferir em
 * espaçamento/ordem de chaves).
 *
 * Roda sem sessão de usuário (chamada server-to-server pelo provedor), por
 * isso usa o cliente `service_role` — RLS normal não teria como resolver
 * `escritorio_atual()` aqui.
 */
export async function POST(request: NextRequest) {
  const corpoBruto = await request.text();
  const assinaturaRecebida = request.headers.get("x-autentique-signature");

  if (!validarAssinaturaWebhookAutentique(corpoBruto, assinaturaRecebida)) {
    return NextResponse.json({ error: "Assinatura do webhook inválida ou ausente." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ error: "Payload não é JSON válido." }, { status: 400 });
  }

  const evento = interpretarEventoWebhookAutentique(payload);
  if (!evento) {
    // Assinatura válida mas payload sem id de documento reconhecível: não é
    // um erro do provedor, só não há o que atualizar. Responde 200 para não
    // gerar retry desnecessário.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const supabase = createAdminClient();
  const { data: documento } = await supabase
    .from("documentos_para_assinatura")
    .select("*")
    .eq("id_externo_provedor", evento.idExterno)
    .maybeSingle<DocumentoParaAssinatura>();

  if (!documento) {
    // Documento não rastreado nesta instância (ex: webhook de teste do
    // provedor) — não é uma falha da rota, só não há registro pra atualizar.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  let signatariosAtualizados: SignatarioDocumento[] = documento.signatarios;
  if (evento.signatariosAtualizados.length > 0) {
    signatariosAtualizados = documento.signatarios.map((signatario) => {
      const atualizacao = evento.signatariosAtualizados.find(
        (s) => s.email.toLowerCase() === signatario.email.toLowerCase(),
      );
      return atualizacao ? { ...signatario, status: atualizacao.status } : signatario;
    });
  }

  const novoStatusDocumento =
    evento.novoStatusDocumento ??
    (signatariosAtualizados.length > 0 && signatariosAtualizados.every((s) => s.status === "assinado")
      ? "assinado"
      : signatariosAtualizados.some((s) => s.status === "recusado")
        ? "recusado"
        : documento.status);

  const { error } = await supabase
    .from("documentos_para_assinatura")
    .update({ status: novoStatusDocumento, signatarios: signatariosAtualizados })
    .eq("id", documento.id);

  if (error) {
    return NextResponse.json({ error: "Falha ao persistir atualização de status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
