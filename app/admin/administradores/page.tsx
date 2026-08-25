import { getAdminAtual } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { AdicionarAdminForm, AdministradorLinha } from "@/components/admin/administrador-form-e-linhas";
import type { PlataformaAdmin } from "@/lib/types";

export const metadata = { title: "Administradores — Admin" };

export default async function AdminAdministradoresPage() {
  const admin = await getAdminAtual();
  const supabase = await createClient();
  const { data: admins } = await supabase
    .from("plataforma_admins")
    .select("*")
    .order("criado_em", { ascending: true })
    .returns<PlataformaAdmin[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Administradores da plataforma</h1>
        <p className="mt-1 text-sm text-muted">
          Acesso cross-tenant total ao painel /admin. O sistema nunca permite remover/desativar o último administrador ativo.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Adicionar administrador</CardTitle>
        <p className="mb-3 text-xs text-muted">
          Promove um usuário que já tem cadastro em algum escritório, pelo e-mail. Para adicionar um operador sem
          nenhuma conta de escritório, use o bootstrap por SQL documentado em docs/adrs/0003-admin-plataforma.md.
        </p>
        <AdicionarAdminForm />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Nome</th>
              <th className="pb-3 pr-3 font-medium">E-mail</th>
              <th className="pb-3 pr-3 font-medium">Desde</th>
              <th className="pb-3 pr-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(admins ?? []).map((a) => (
              <AdministradorLinha key={a.id} admin={a} souVoce={a.id === admin?.admin.id} />
            ))}
          </tbody>
        </table>
        {(!admins || admins.length === 0) && <p className="py-6 text-center text-sm text-muted">Nenhum administrador cadastrado.</p>}
      </Card>
    </div>
  );
}
