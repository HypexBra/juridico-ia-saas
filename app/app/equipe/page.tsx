import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConvidarForm } from "@/components/app/convidar-form";
import { MembroLinhaAcoes } from "@/components/app/membro-linha-acoes";
import type { Perfil, Role } from "@/lib/types";

export const metadata = { title: "Equipe — Jurídico IA" };

const ROLE_LABEL: Record<Role, string> = {
  owner: "Titular",
  admin: "Administrador(a)",
  advogado: "Advogado(a)",
};

const ROLE_TONE: Record<Role, "silver" | "blue" | "muted"> = {
  owner: "silver",
  admin: "blue",
  advogado: "muted",
};

export default async function EquipePage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("*")
    .order("criado_em", { ascending: true })
    .returns<Perfil[]>();

  const lista = perfis ?? [];
  const souGestor = usuario.perfil.role === "owner" || usuario.perfil.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Equipe</h1>
        <p className="mt-1 text-sm text-muted">Membros do escritório {usuario.perfil.escritorio.nome}.</p>
      </div>

      <Card>
        <CardTitle className="mb-4">Convidar novo membro</CardTitle>
        <ConvidarForm />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <CardTitle>Membros ({lista.length})</CardTitle>
          {souGestor && (
            <p className="text-xs text-muted">
              Como {ROLE_LABEL[usuario.perfil.role]}, você pode gerenciar o papel e o status dos seus colegas — só
              dentro deste escritório.
            </p>
          )}
        </div>
        <ul className="divide-y divide-white/5">
          {lista.map((perfil) => {
            const ehVoceMesmo = perfil.auth_user_id === usuario.userId;
            const podeGerenciarEsteMembro =
              souGestor && !ehVoceMesmo && (perfil.role !== "owner" || usuario.perfil.role === "owner");

            return (
              <li key={perfil.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ice">
                    {perfil.nome}
                    {ehVoceMesmo && <span className="ml-2 text-xs font-normal text-muted">(você)</span>}
                  </p>
                  <p className="text-xs text-muted">{perfil.ativo ? "Ativo" : "Inativo"}</p>
                </div>
                {souGestor && !ehVoceMesmo ? (
                  <MembroLinhaAcoes
                    perfilId={perfil.id}
                    ativo={perfil.ativo}
                    role={perfil.role}
                    podeAlterarRole={podeGerenciarEsteMembro}
                  />
                ) : (
                  <Badge tone={ROLE_TONE[perfil.role]}>{ROLE_LABEL[perfil.role]}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
