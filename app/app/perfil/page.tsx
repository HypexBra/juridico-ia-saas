import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Card, CardTitle } from "@/components/ui/card";
import { OabForm } from "@/components/app/oab-form";

export const metadata = { title: "Meu perfil — Jurídico IA" };

export default async function PerfilPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted">{usuario.perfil.nome} — {usuario.perfil.escritorio.nome}</p>
      </div>

      <Card>
        <CardTitle className="mb-1">OAB</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Cadastre sua OAB para importar intimações automaticamente do DJEN (Diário de Justiça Eletrônico
          Nacional). Uma vez por dia o sistema consulta as novas intimações publicadas para essa OAB e cria
          propostas de prazo para você revisar e aprovar — nenhum prazo é criado sem aprovação.
        </p>
        <OabForm oabAtual={usuario.perfil.oab} />
      </Card>
    </div>
  );
}
