import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

export type UsuarioAdminLinha = {
  perfilId: string;
  authUserId: string;
  nome: string;
  email: string | null;
  role: Role;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
  escritorioId: string;
  escritorioNome: string;
  plano: "free" | "pro";
  totalConversas: number;
  totalMensagens: number;
};

/**
 * `email`/`ultimoAcesso` só existem em `auth.users` (não replicados em
 * `perfis` — ver docs/adrs/0003-admin-plataforma.md), então dependem de
 * `SUPABASE_SERVICE_ROLE_KEY` (Admin API do Supabase Auth). Sem essa env
 * var, a função degrada graciosamente: todo o resto do painel (nome, role,
 * status, plano, contagens) continua funcionando via RLS normal, só esses
 * dois campos voltam `null` — nunca inventa um valor.
 */
async function buscarDadosAuthPorId(): Promise<Map<string, { email: string | null; ultimoAcesso: string | null }>> {
  const mapa = new Map<string, { email: string | null; ultimoAcesso: string | null }>();
  try {
    const admin = createAdminClient();
    let pagina = 1;
    // listUsers pagina 1000/req por padrão — laço cobre bases maiores sem hardcodar um teto arbitrário.
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) {
        console.error("[admin/usuarios] auth.admin.listUsers falhou:", error);
        break;
      }
      for (const u of data.users) {
        mapa.set(u.id, { email: u.email ?? null, ultimoAcesso: u.last_sign_in_at ?? null });
      }
      if (data.users.length < 1000) break;
      pagina += 1;
    }
  } catch (erro) {
    // SUPABASE_SERVICE_ROLE_KEY ausente — esperado neste ambiente até ser configurada.
    console.error("[admin/usuarios] Admin API indisponível (SUPABASE_SERVICE_ROLE_KEY ausente?):", erro);
  }
  return mapa;
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdminLinha[]> {
  const supabase = await createClient();

  const [{ data: perfis, error: erroPerfis }, { data: conversas }, { data: mensagens }, dadosAuth] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, auth_user_id, nome, role, ativo, criado_em, escritorio_id, escritorio:escritorios(id, nome, plano)")
      .returns<
        {
          id: string;
          auth_user_id: string;
          nome: string;
          role: Role;
          ativo: boolean;
          criado_em: string;
          escritorio_id: string;
          escritorio: { id: string; nome: string; plano: "free" | "pro" } | null;
        }[]
      >(),
    supabase.from("conversas").select("id, criado_por").returns<{ id: string; criado_por: string | null }[]>(),
    supabase.from("mensagens").select("conversa_id").returns<{ conversa_id: string }[]>(),
    buscarDadosAuthPorId(),
  ]);

  if (erroPerfis) throw erroPerfis;

  const conversaParaAutor = new Map<string, string | null>();
  const conversasPorAutor = new Map<string, number>();
  for (const conversa of conversas ?? []) {
    conversaParaAutor.set(conversa.id, conversa.criado_por);
    if (conversa.criado_por) {
      conversasPorAutor.set(conversa.criado_por, (conversasPorAutor.get(conversa.criado_por) ?? 0) + 1);
    }
  }

  const mensagensPorAutor = new Map<string, number>();
  for (const mensagem of mensagens ?? []) {
    const autor = conversaParaAutor.get(mensagem.conversa_id);
    if (autor) mensagensPorAutor.set(autor, (mensagensPorAutor.get(autor) ?? 0) + 1);
  }

  return (perfis ?? []).map((perfil) => {
    const auth = dadosAuth.get(perfil.auth_user_id);
    return {
      perfilId: perfil.id,
      authUserId: perfil.auth_user_id,
      nome: perfil.nome,
      email: auth?.email ?? null,
      role: perfil.role,
      ativo: perfil.ativo,
      criadoEm: perfil.criado_em,
      ultimoAcesso: auth?.ultimoAcesso ?? null,
      escritorioId: perfil.escritorio_id,
      escritorioNome: perfil.escritorio?.nome ?? "—",
      plano: perfil.escritorio?.plano ?? "free",
      totalConversas: conversasPorAutor.get(perfil.id) ?? 0,
      totalMensagens: mensagensPorAutor.get(perfil.id) ?? 0,
    };
  });
}

export type ConversaResumoAdmin = {
  id: string;
  titulo: string | null;
  iniciadaEm: string;
  totalMensagens: number;
  autorNome: string;
  autorEmail: string | null;
};

/** Lista todas as conversas cross-tenant (seção 8 do pedido: /admin/conversas). */
export async function listarConversasAdmin(): Promise<ConversaResumoAdmin[]> {
  const supabase = await createClient();
  const [{ data: conversas }, dadosAuth, { data: perfis }] = await Promise.all([
    supabase
      .from("conversas")
      .select("id, titulo, iniciada_em, total_msgs, criado_por")
      .eq("tipo", "interno")
      .order("iniciada_em", { ascending: false })
      .returns<{ id: string; titulo: string | null; iniciada_em: string; total_msgs: number; criado_por: string | null }[]>(),
    buscarDadosAuthPorId(),
    supabase.from("perfis").select("id, auth_user_id, nome").returns<{ id: string; auth_user_id: string; nome: string }[]>(),
  ]);

  const perfilPorId = new Map((perfis ?? []).map((p) => [p.id, p]));

  return (conversas ?? []).map((c) => {
    const perfil = c.criado_por ? perfilPorId.get(c.criado_por) : null;
    const auth = perfil ? dadosAuth.get(perfil.auth_user_id) : null;
    return {
      id: c.id,
      titulo: c.titulo,
      iniciadaEm: c.iniciada_em,
      totalMensagens: c.total_msgs,
      autorNome: perfil?.nome ?? "—",
      autorEmail: auth?.email ?? null,
    };
  });
}

export type ConversaResumoSimples = { id: string; titulo: string | null; iniciadaEm: string; totalMensagens: number };

export async function buscarUsuarioAdminDetalhe(
  perfilId: string,
): Promise<(UsuarioAdminLinha & { conversas: ConversaResumoSimples[] }) | null> {
  const linhas = await listarUsuariosAdmin();
  const linha = linhas.find((l) => l.perfilId === perfilId);
  if (!linha) return null;

  const supabase = await createClient();
  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, titulo, iniciada_em, total_msgs")
    .eq("criado_por", perfilId)
    .order("iniciada_em", { ascending: false })
    .returns<{ id: string; titulo: string | null; iniciada_em: string; total_msgs: number }[]>();

  return {
    ...linha,
    conversas: (conversas ?? []).map((c) => ({ id: c.id, titulo: c.titulo, iniciadaEm: c.iniciada_em, totalMensagens: c.total_msgs })),
  };
}
