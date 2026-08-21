import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConviteEquipe, Escritorio } from "@/lib/types";

const TAGS_PADRAO = [
  { nome: "Trabalhista", cor: "#3b82f6" },
  { nome: "Cível", cor: "#8b5cf6" },
  { nome: "Penal", cor: "#ef4444" },
  { nome: "Tributário", cor: "#f59e0b" },
  { nome: "Consumidor", cor: "#10b981" },
  { nome: "Família", cor: "#ec4899" },
  { nome: "Empresarial", cor: "#6366f1" },
  { nome: "Previdenciário", cor: "#14b8a6" },
  { nome: "Administrativo", cor: "#f97316" },
  { nome: "LGPD", cor: "#64748b" },
];

function slugify(nome: string) {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7)
  );
}

/** Cria o escritório (tenant), o perfil "owner" do usuário recém-cadastrado
 * e as tags padrão. Deve rodar logo após o signUp do Supabase Auth. */
export async function criarEscritorioEPerfil(
  supabase: SupabaseClient,
  authUserId: string,
  nomeUsuario: string,
  nomeEscritorio: string,
) {
  // Gera o id do tenant no client (em vez de deixar o Postgres aplicar o
  // default `gen_random_uuid()` e devolver via `.select()`/RETURNING).
  //
  // Causa raiz do bug "Conta criada, mas houve um erro ao configurar o
  // escritório": a policy `escritorios_select` só libera SELECT quando
  // `id = escritorio_atual()`, e `escritorio_atual()` lê o `escritorio_id`
  // do perfil do usuário. No fluxo antigo (`insert(...).select().single()`),
  // o RETURNING do INSERT já é filtrado por essa policy de SELECT — mas o
  // perfil (criado só no passo seguinte) ainda não existe nesse instante,
  // então `escritorio_atual()` retorna null e o RETURNING vem vazio. O
  // supabase-js interpreta isso como erro ("JSON object requested, ... no
  // rows returned") mesmo com o INSERT tendo sido commitado com sucesso —
  // por isso "conta criada" (auth ok) + "erro ao configurar" (onboarding).
  //
  // Gerando o id aqui, não precisamos ler o registro de volta antes de criar
  // o perfil: o INSERT em `escritorios` só depende da policy de INSERT
  // (`escritorios_insert`), que não exige perfil prévio.
  const escritorioId = crypto.randomUUID();

  const { error: erroEscritorio } = await supabase.from("escritorios").insert({
    id: escritorioId,
    nome: nomeEscritorio,
    slug: slugify(nomeEscritorio),
  });
  if (erroEscritorio) {
    // Loga a causa real (ex: RLS negando o insert porque o usuário já tem
    // perfil, colisão de slug, coluna NOT NULL faltando) — sem isso, o
    // usuário só vê "erro ao configurar o escritório" e o time não tem
    // nenhum rastro pra diagnosticar em produção.
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao criar escritório:", erroEscritorio, {
      authUserId,
    });
    throw erroEscritorio;
  }

  const { error: erroPerfil } = await supabase.from("perfis").insert({
    auth_user_id: authUserId,
    escritorio_id: escritorioId,
    nome: nomeUsuario,
    role: "owner",
  });
  if (erroPerfil) {
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao criar perfil:", erroPerfil, {
      authUserId,
      escritorioId,
    });
    throw erroPerfil;
  }

  const { error: erroTags } = await supabase
    .from("tags")
    .insert(TAGS_PADRAO.map((tag) => ({ ...tag, escritorio_id: escritorioId })));
  if (erroTags) {
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao criar tags padrão:", erroTags, {
      authUserId,
      escritorioId,
    });
    throw erroTags;
  }

  // A partir daqui o perfil já existe, então `escritorio_atual()` resolve
  // e a leitura respeita a policy `escritorios_select` normalmente.
  const { data: escritorio, error: erroLeitura } = await supabase
    .from("escritorios")
    .select()
    .eq("id", escritorioId)
    .single();
  if (erroLeitura) {
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao ler escritório recém-criado:", erroLeitura, {
      authUserId,
      escritorioId,
    });
    throw erroLeitura;
  }

  return escritorio;
}

/**
 * Onboarding alternativo: em vez de criar um escritório novo (fluxo acima),
 * JUNTA o usuário recém-confirmado a um escritório existente via convite de
 * equipe pendente (migration 0038). Chamado por `lib/app/current-user.ts`
 * ANTES do fluxo de metadata `nome_escritorio` — um usuário convidado nunca
 * tem esse metadata, então cairia em onboarding "sem dados" e ficaria preso
 * sem perfil se este caminho não existisse.
 *
 * Usa o client normal (respeitando RLS, nunca `service_role`): a policy
 * `convites_equipe_select_proprio` (migration 0038) já garante que só o
 * convite pendente/válido do PRÓPRIO e-mail (via `auth.jwt()`) é visível, e
 * `perfis_insert` só aceita este INSERT se ele bater exatamente
 * `escritorio_id`/`role` de um convite pendente no mesmo formato — dupla
 * checagem client+RLS, mas a garantia real contra escalada cross-tenant é a
 * RLS.
 *
 * Retorna `null` (sem lançar) quando não há convite pendente para o e-mail
 * da sessão — caller decide o próximo fallback (onboarding normal ou erro).
 */
export async function aceitarConviteEquipeSePendente(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<Escritorio | null> {
  const { data: convite, error: erroConvite } = await supabase
    .from("convites_equipe")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<ConviteEquipe>();

  if (erroConvite) {
    console.error("[onboarding/aceitarConviteEquipeSePendente] Falha ao buscar convite pendente:", erroConvite, {
      authUserId,
    });
    return null;
  }
  if (!convite) return null;

  const { error: erroPerfil } = await supabase.from("perfis").insert({
    auth_user_id: authUserId,
    escritorio_id: convite.escritorio_id,
    nome: convite.nome,
    role: convite.role,
  });
  if (erroPerfil) {
    console.error("[onboarding/aceitarConviteEquipeSePendente] Falha ao criar perfil via convite:", erroPerfil, {
      authUserId,
      conviteId: convite.id,
    });
    throw erroPerfil;
  }

  const { error: erroAceite } = await supabase
    .from("convites_equipe")
    .update({ status: "aceito", aceito_em: new Date().toISOString() })
    .eq("id", convite.id);
  if (erroAceite) {
    // Perfil já foi criado com sucesso (não é revertido) — o convite ficar
    // "pendente" indevidamente é só cosmético na tela de equipe, não bloqueia
    // o usuário. Loga para eventual limpeza manual.
    console.error("[onboarding/aceitarConviteEquipeSePendente] Perfil criado, mas falha ao marcar convite aceito:", erroAceite, {
      authUserId,
      conviteId: convite.id,
    });
  }

  const { data: escritorio, error: erroLeitura } = await supabase
    .from("escritorios")
    .select()
    .eq("id", convite.escritorio_id)
    .single();
  if (erroLeitura) {
    console.error("[onboarding/aceitarConviteEquipeSePendente] Falha ao ler escritório do convite:", erroLeitura, {
      authUserId,
      conviteId: convite.id,
    });
    throw erroLeitura;
  }

  return escritorio;
}
