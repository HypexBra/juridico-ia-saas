"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { reindexarFichaCaso, reindexarPrazo } from "@/lib/rag/indexacao-interna";
import { gerarDocx } from "@/lib/documentos/gerar-docx";
import { gerarPdf } from "@/lib/documentos/gerar-pdf";
import { autentiqueEstaConfigurado, criarDocumentoParaAssinatura } from "@/lib/assinatura/autentique";
import type { DocumentoParaAssinatura, PropostaAcao, SignatarioDocumento } from "@/lib/types";

export type ResultadoProposta = { ok: true } | { ok: false; error: string };

const uuidSchema = z.string().uuid();

export async function buscarPropostaAction(propostaId: string): Promise<PropostaAcao | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("propostas_acao").select("*").eq("id", parsed.data).maybeSingle();
  return (data as PropostaAcao) ?? null;
}

/**
 * Carrega e valida uma proposta pendente. Trata proposta expirada (>24h sem
 * resolução) como caminho de escape automático: nunca fica pendurada
 * indefinidamente esperando aprovação de uma ação potencialmente
 * desatualizada — é marcada como 'expired' e recusada.
 */
type CargaProposta = { bloqueada: false; proposta: PropostaAcao } | { bloqueada: true; motivo: string };

async function carregarPropostaPendente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propostaId: string,
): Promise<CargaProposta> {
  const { data, error } = await supabase.from("propostas_acao").select("*").eq("id", propostaId).maybeSingle();
  if (error || !data) return { bloqueada: true, motivo: "Proposta não encontrada." };

  const proposta = data as PropostaAcao;
  if (proposta.status !== "pending") {
    return { bloqueada: true, motivo: "Esta proposta já foi resolvida anteriormente." };
  }

  if (new Date(proposta.expira_em).getTime() < Date.now()) {
    await supabase
      .from("propostas_acao")
      .update({ status: "expired", resolvido_em: new Date().toISOString() })
      .eq("id", proposta.id);
    return {
      bloqueada: true,
      motivo: "Esta proposta expirou (mais de 24h pendente) e foi descartada automaticamente.",
    };
  }

  return { bloqueada: false, proposta };
}

export async function rejeitarPropostaAction(propostaId: string): Promise<ResultadoProposta> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return { ok: false, error: "Proposta inválida." };

  const supabase = await createClient();
  const carregada = await carregarPropostaPendente(supabase, parsed.data);
  if (carregada.bloqueada) return { ok: false, error: carregada.motivo };

  const { error } = await supabase
    .from("propostas_acao")
    .update({ status: "rejected", resolvido_em: new Date().toISOString(), resolvido_por: usuario.perfil.id })
    .eq("id", parsed.data);

  if (error) return { ok: false, error: "Não foi possível rejeitar a proposta." };

  revalidatePath("/app/chat");
  return { ok: true };
}

export async function aprovarPropostaAction(propostaId: string): Promise<ResultadoProposta> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return { ok: false, error: "Proposta inválida." };

  const supabase = await createClient();
  const carregada = await carregarPropostaPendente(supabase, parsed.data);
  if (carregada.bloqueada) return { ok: false, error: carregada.motivo };
  const proposta = carregada.proposta;

  const { escritorio_id: escritorioId, id: perfilId } = usuario.perfil;
  const agora = new Date().toISOString();

  try {
    switch (proposta.tipo) {
      case "update_prazo": {
        const payload = proposta.payload as { prazo_id: string; mudancas: Record<string, unknown> };
        const { error } = await supabase.from("prazos").update(payload.mudancas).eq("id", payload.prazo_id);
        if (error) throw new Error(error.message);
        await reindexarPrazo(supabase, escritorioId, payload.prazo_id);
        break;
      }
      case "update_ficha": {
        const payload = proposta.payload as { ficha_id: string; mudancas: Record<string, unknown> };
        const { error } = await supabase.from("fichas_caso").update(payload.mudancas).eq("id", payload.ficha_id);
        if (error) throw new Error(error.message);
        await reindexarFichaCaso(supabase, escritorioId, payload.ficha_id);
        break;
      }
      case "create_prazo": {
        const payload = proposta.payload as { dados: Record<string, unknown> };
        const { data: novo, error } = await supabase
          .from("prazos")
          .insert({ ...payload.dados, escritorio_id: escritorioId, criado_por: perfilId })
          .select("id")
          .single();
        if (error || !novo) throw new Error(error?.message ?? "Falha ao criar prazo.");
        await reindexarPrazo(supabase, escritorioId, novo.id);
        break;
      }
      case "create_ficha": {
        const payload = proposta.payload as { dados: Record<string, unknown> };
        const { data: nova, error } = await supabase
          .from("fichas_caso")
          .insert({ ...payload.dados, escritorio_id: escritorioId, conversa_id: proposta.conversa_id })
          .select("id")
          .single();
        if (error || !nova) throw new Error(error?.message ?? "Falha ao criar ficha.");
        await reindexarFichaCaso(supabase, escritorioId, nova.id);
        break;
      }
      case "generate_documento": {
        // Nada a escrever em tabela de negócio: o arquivo é gerado sob demanda
        // no download (rota /api/propostas/[id]/documento), a partir do
        // payload já validado. Aprovar aqui só libera o link de download.
        break;
      }
    }

    await supabase
      .from("propostas_acao")
      .update({
        status: proposta.tipo === "generate_documento" ? "approved" : "applied",
        resolvido_em: agora,
        resolvido_por: perfilId,
      })
      .eq("id", proposta.id);
  } catch (erro) {
    await supabase
      .from("propostas_acao")
      .update({
        status: "failed",
        erro: erro instanceof Error ? erro.message : "Erro desconhecido ao aplicar a proposta.",
        resolvido_em: agora,
        resolvido_por: perfilId,
      })
      .eq("id", proposta.id);
    return { ok: false, error: "Não foi possível aplicar a ação. A proposta foi marcada como falha." };
  }

  revalidatePath("/app/chat");
  revalidatePath("/app/prazos");
  revalidatePath("/app/fichas");
  revalidatePath("/app/dashboard");

  // Webhooks de saída (Fase 22): a ação aplicada pela IA é um evento real
  // do escritório. Fire-and-forget best-effort — nunca bloqueia a resposta
  // nem falha a operação se não houver endpoints configurados.
  const eventoProposta: Record<typeof proposta.tipo, "prazo.criado" | "prazo.atualizado" | "caso.criado" | "caso.atualizado"> = {
    create_prazo: "prazo.criado",
    update_prazo: "prazo.atualizado",
    create_ficha: "caso.criado",
    update_ficha: "caso.atualizado",
    generate_documento: "caso.atualizado",
  };
  void import("@/lib/webhooks/emitir").then(({ emitirEventoWebhook }) =>
    emitirEventoWebhook(supabase, escritorioId, eventoProposta[proposta.tipo], {
      proposta_id: proposta.id,
      tipo: proposta.tipo,
      resumo: proposta.resumo,
    }),
  );

  return { ok: true };
}

const signatarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome de todos os signatários."),
  email: z.string().trim().email("Um dos e-mails de signatário é inválido."),
});

const enviarAssinaturaSchema = z.object({
  signatarios: z.array(signatarioSchema).min(1, "Adicione ao menos um signatário."),
});

export type EnviarAssinaturaState = { error: string | null; ok: boolean };

/**
 * Envia para assinatura eletrônica o documento de uma proposta `generate_documento`
 * já aprovada — reusa o mesmo texto validado do payload (nunca lê texto arbitrário
 * do formulário) e o mesmo formato (docx/pdf) escolhido na geração.
 */
export async function enviarPropostaParaAssinaturaAction(
  propostaId: string,
  _prev: EnviarAssinaturaState,
  formData: FormData,
): Promise<EnviarAssinaturaState> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return { error: "Sessão expirada. Faça login novamente.", ok: false };

  if (!autentiqueEstaConfigurado()) {
    return {
      error: "Assinatura eletrônica não está configurada neste ambiente (defina AUTENTIQUE_API_TOKEN).",
      ok: false,
    };
  }

  const parsedId = uuidSchema.safeParse(propostaId);
  if (!parsedId.success) return { error: "Proposta inválida.", ok: false };

  let signatariosBrutos: unknown;
  try {
    signatariosBrutos = JSON.parse(String(formData.get("signatarios") ?? "[]"));
  } catch {
    return { error: "Lista de signatários inválida.", ok: false };
  }
  const parsed = enviarAssinaturaSchema.safeParse({ signatarios: signatariosBrutos });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ok: false };

  const supabase = await createClient();
  const { data: propostaRaw } = await supabase
    .from("propostas_acao")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();
  const proposta = propostaRaw as PropostaAcao | null;

  if (!proposta || proposta.tipo !== "generate_documento") {
    return { error: "Proposta de documento não encontrada.", ok: false };
  }
  if (proposta.status !== "approved" && proposta.status !== "applied") {
    return { error: "O documento precisa estar aprovado antes de enviar para assinatura.", ok: false };
  }

  const payload = proposta.payload as { titulo: string; conteudo: string; formato?: "docx" | "pdf" };
  const formato = payload.formato ?? "docx";
  const arquivo =
    formato === "pdf" ? await gerarPdf(payload.titulo, payload.conteudo) : await gerarDocx(payload.titulo, payload.conteudo);
  const nomeBase = payload.titulo.replace(/[^\w\-À-ÿ ]/g, "").trim() || "documento";
  const nomeArquivo = `${nomeBase}.${formato}`;

  const signatariosIniciais: SignatarioDocumento[] = parsed.data.signatarios.map((s) => ({
    nome: s.nome,
    email: s.email,
    status: "pendente",
  }));

  const { data: registro, error: erroInsercao } = await supabase
    .from("documentos_para_assinatura")
    .insert({
      escritorio_id: usuario.perfil.escritorio_id,
      criado_por: usuario.perfil.id,
      proposta_acao_id: proposta.id,
      nome_documento: payload.titulo,
      status: "rascunho",
      signatarios: signatariosIniciais,
    })
    .select("id")
    .single();

  if (erroInsercao || !registro) {
    return { error: "Não foi possível registrar o documento para assinatura.", ok: false };
  }

  const resultado = await criarDocumentoParaAssinatura({
    nomeDocumento: payload.titulo,
    arquivo,
    nomeArquivo,
    formato,
    signatarios: parsed.data.signatarios,
  });

  if (!resultado.ok) {
    return { error: `Falha ao enviar para o Autentique: ${resultado.error}`, ok: false };
  }

  const { error: erroUpdate } = await supabase
    .from("documentos_para_assinatura")
    .update({
      status: "aguardando_assinatura",
      arquivo_gerado_em: new Date().toISOString(),
      provedor: "autentique",
      id_externo_provedor: resultado.idExterno,
    })
    .eq("id", registro.id);

  if (erroUpdate) {
    console.error("[assinatura] falha ao atualizar documentos_para_assinatura após envio ao Autentique", {
      documentoId: registro.id,
      idExternoAutentique: resultado.idExterno,
      codigo: erroUpdate.code,
      mensagem: erroUpdate.message,
      detalhes: erroUpdate.details,
      dica: erroUpdate.hint,
    });
    return {
      error: "Documento foi enviado ao Autentique, mas houve falha ao salvar o status localmente.",
      ok: false,
    };
  }

  revalidatePath("/app/chat");
  return { error: null, ok: true };
}

export async function buscarDocumentoAssinaturaDaPropostaAction(
  propostaId: string,
): Promise<DocumentoParaAssinatura | null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) return null;
  const parsed = uuidSchema.safeParse(propostaId);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos_para_assinatura")
    .select("*")
    .eq("proposta_acao_id", parsed.data)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<DocumentoParaAssinatura>();

  return data ?? null;
}
