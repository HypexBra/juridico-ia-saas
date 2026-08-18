"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ativarSchema = z
  .object({
    token: z.string().trim().min(10, "Convite inválido."),
    senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirmarSenha: z.string().min(1, "Confirme a senha."),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export type AtivarContaState = {
  error: string | null;
  /** Supabase exige confirmação de e-mail antes de abrir sessão. */
  precisaConfirmarEmail: boolean;
  /** Já existe conta de portal com este e-mail (outro caso já ativado) —
   * a UI deve oferecer o link de login com o token preso, em vez de tentar
   * `signUp` de novo. */
  emailJaExiste: boolean;
};

const INITIAL_ERROR_STATE = { precisaConfirmarEmail: false, emailJaExiste: false };

export async function ativarContaPortalAction(
  _prev: AtivarContaState,
  formData: FormData,
): Promise<AtivarContaState> {
  const parsed = ativarSchema.safeParse({
    token: formData.get("token"),
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ...INITIAL_ERROR_STATE };
  }

  const supabase = await createClient();

  const { data: convite, error: erroConvite } = await supabase
    .rpc("consultar_convite_cliente_portal", { p_token: parsed.data.token })
    .maybeSingle<{ nome: string; email: string; valido: boolean }>();

  if (erroConvite || !convite || !convite.valido) {
    return {
      error: "Convite inválido ou expirado. Peça um novo link ao seu advogado.",
      ...INITIAL_ERROR_STATE,
    };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: convite.email,
    password: parsed.data.senha,
    options: {
      // Guardado no metadata do auth.users para o caso de o projeto exigir
      // confirmação de e-mail: o vínculo com `clientes_portal` (RPC
      // `ativar_convite_cliente_portal`) só pode rodar com sessão ativa, e
      // aqui ainda não há uma (ver lib/app/current-client-portal.ts).
      data: { portal_token_convite: parsed.data.token },
    },
  });

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return {
        error:
          "Já existe uma conta de portal com este e-mail (você já tem acesso a outro caso). Entre com sua senha atual para vincular este caso também.",
        precisaConfirmarEmail: false,
        emailJaExiste: true,
      };
    }
    return { error: "Não foi possível criar sua conta. Tente novamente.", ...INITIAL_ERROR_STATE };
  }

  if (!signUpData.session) {
    return { error: null, precisaConfirmarEmail: true, emailJaExiste: false };
  }

  const { error: erroVinculo } = await supabase.rpc("ativar_convite_cliente_portal", {
    p_token: parsed.data.token,
  });

  if (erroVinculo) {
    return {
      error: "Sua conta foi criada, mas houve um erro ao vincular seu caso. Contate o escritório.",
      ...INITIAL_ERROR_STATE,
    };
  }

  redirect("/portal");
}
