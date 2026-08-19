import type { SupabaseClient } from "@supabase/supabase-js";

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
  const { data: escritorio, error: erroEscritorio } = await supabase
    .from("escritorios")
    .insert({ nome: nomeEscritorio, slug: slugify(nomeEscritorio) })
    .select()
    .single();
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
    escritorio_id: escritorio.id,
    nome: nomeUsuario,
    role: "owner",
  });
  if (erroPerfil) {
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao criar perfil:", erroPerfil, {
      authUserId,
      escritorioId: escritorio.id,
    });
    throw erroPerfil;
  }

  const { error: erroTags } = await supabase
    .from("tags")
    .insert(TAGS_PADRAO.map((tag) => ({ ...tag, escritorio_id: escritorio.id })));
  if (erroTags) {
    console.error("[onboarding/criarEscritorioEPerfil] Falha ao criar tags padrão:", erroTags, {
      authUserId,
      escritorioId: escritorio.id,
    });
    throw erroTags;
  }

  return escritorio;
}
