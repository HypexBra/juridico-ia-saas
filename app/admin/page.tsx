import { createClient } from "@/lib/supabase/server";
import { getAdminAtual } from "@/lib/admin/auth";
import { registrarLogAdmin } from "@/lib/admin/log";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard Admin — Jurídico IA" };

function StatCard({ label, valor, tone }: { label: string; valor: number | string; tone?: "green" | "red" | "amber" }) {
  const cor = tone === "green" ? "text-green" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-ice";
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${cor}`}>{valor}</p>
    </Card>
  );
}

/**
 * Todos os números vêm de `count: "exact", head: true` (contagem real do
 * Postgres, sem baixar linhas) — nenhum dado fictício (seção 3 do pedido).
 * Cross-tenant graças às policies `*_select_admin_plataforma` (migration
 * 0014); mesmo client de sessão normal, sem `service_role`.
 */
export default async function AdminDashboardPage() {
  const admin = await getAdminAtual();
  if (admin) {
    // Best-effort, sem bloquear o render — aproxima "login administrativo"
    // (seção 10 do pedido) pelo acesso ao dashboard, ponto de entrada do painel.
    void registrarLogAdmin(admin, { acao: "acesso_painel_admin" });
  }

  const supabase = await createClient();
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsuarios },
    { count: usuariosAtivos },
    { count: usuariosInativos },
    { count: novosUsuarios },
    { count: totalConversas },
    { count: conversasHoje },
    { count: totalMensagens },
    { count: escritoriosPro },
    { count: escritoriosFree },
  ] = await Promise.all([
    supabase.from("perfis").select("id", { count: "exact", head: true }),
    supabase.from("perfis").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("perfis").select("id", { count: "exact", head: true }).eq("ativo", false),
    supabase.from("perfis").select("id", { count: "exact", head: true }).gte("criado_em", trintaDiasAtras),
    supabase.from("conversas").select("id", { count: "exact", head: true }),
    supabase.from("conversas").select("id", { count: "exact", head: true }).gte("iniciada_em", hoje),
    supabase.from("mensagens").select("id", { count: "exact", head: true }),
    supabase.from("escritorios").select("id", { count: "exact", head: true }).eq("plano", "pro"),
    supabase.from("escritorios").select("id", { count: "exact", head: true }).eq("plano", "free"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Dashboard administrativo</h1>
        <p className="mt-1 text-sm text-muted">Visão geral do SaaS — todos os escritórios/usuários.</p>
      </div>

      <div>
        <CardTitle className="mb-3 text-sm text-muted">Usuários</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total de usuários" valor={totalUsuarios ?? 0} />
          <StatCard label="Ativos" valor={usuariosAtivos ?? 0} tone="green" />
          <StatCard label="Inativos" valor={usuariosInativos ?? 0} tone="red" />
          <StatCard label="Novos (30 dias)" valor={novosUsuarios ?? 0} tone="amber" />
        </div>
      </div>

      <div>
        <CardTitle className="mb-3 text-sm text-muted">Uso do chat de IA</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total de conversas" valor={totalConversas ?? 0} />
          <StatCard label="Conversas hoje" valor={conversasHoje ?? 0} tone="amber" />
          <StatCard label="Total de mensagens" valor={totalMensagens ?? 0} />
        </div>
      </div>

      <div>
        <CardTitle className="mb-3 text-sm text-muted">Assinatura</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Escritórios com plano Pro" valor={escritoriosPro ?? 0} tone="green" />
          <StatCard label="Escritórios sem assinatura (Free)" valor={escritoriosFree ?? 0} />
        </div>
      </div>
    </div>
  );
}
