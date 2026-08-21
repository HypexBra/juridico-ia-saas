import { notFound } from "next/navigation";
import Link from "next/link";
import { buscarUsuarioAdminDetalhe } from "@/lib/admin/usuarios";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsuarioLinhaAcoes } from "@/components/admin/usuario-linha-acoes";

export const metadata = { title: "Detalhe do usuário — Admin" };

const ROLE_LABEL = { owner: "Titular", admin: "Administrador(a)", advogado: "Advogado(a)" } as const;

function formatarDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default async function AdminUsuarioDetalhePage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  const usuario = await buscarUsuarioAdminDetalhe(id);
  if (!usuario) notFound();

  const supabase = await createClient();
  const { data: adminRow } = await supabase
    .from("plataforma_admins")
    .select("auth_user_id")
    .eq("auth_user_id", usuario.authUserId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/usuarios" className="text-xs text-muted hover:text-ice">
            ← Voltar para Usuários
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ice">{usuario.nome}</h1>
          <p className="mt-1 text-sm text-muted">{usuario.escritorioNome}</p>
        </div>
        <UsuarioLinhaAcoes
          perfilId={usuario.perfilId}
          ativo={usuario.ativo}
          role={usuario.role}
          isAdminPlataforma={!!adminRow}
          escritorioId={usuario.escritorioId}
          plano={usuario.plano}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">Dados da conta</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">E-mail</dt>
              <dd className="text-ice">{usuario.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Cadastro</dt>
              <dd className="text-ice">{formatarDataHora(usuario.criadoEm)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Último acesso</dt>
              <dd className="text-ice">{formatarDataHora(usuario.ultimoAcesso)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Status</dt>
              <dd>
                <Badge tone={usuario.ativo ? "green" : "red"}>{usuario.ativo ? "Ativo" : "Inativo"}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Tipo</dt>
              <dd className="text-ice">{ROLE_LABEL[usuario.role]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Plano do escritório</dt>
              <dd>
                <Badge tone={usuario.plano === "pro" ? "silver" : "muted"}>{usuario.plano === "pro" ? "Pro" : "Free"}</Badge>
              </dd>
            </div>
            {!!adminRow && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Admin da plataforma</dt>
                <dd>
                  <Badge tone="blue">Sim</Badge>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardTitle className="mb-3">Estatísticas de uso da IA</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Conversas</dt>
              <dd className="text-ice">{usuario.totalConversas}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Mensagens</dt>
              <dd className="text-ice">{usuario.totalMensagens}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Última conversa</dt>
              <dd className="text-ice">{formatarDataHora(usuario.conversas[0]?.iniciadaEm ?? null)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">Histórico de conversas</CardTitle>
        {usuario.conversas.length === 0 ? (
          <p className="text-sm text-muted">Este usuário ainda não iniciou nenhuma conversa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Título</th>
                  <th className="pb-2 pr-3 font-medium">Data</th>
                  <th className="pb-2 font-medium">Mensagens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usuario.conversas.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3 text-ice">
                      <Link href={`/admin/conversas/${c.id}`} className="hover:underline">
                        {c.titulo ?? "Sem título"}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted">{formatarDataHora(c.iniciadaEm)}</td>
                    <td className="py-2 text-muted">{c.totalMensagens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
