import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/app/formatar-data";
import type { AdminLog } from "@/lib/types";

export const metadata = { title: "Logs — Admin" };

const ACOES_LABEL: Record<string, string> = {
  ativar_usuario: "Ativou usuário",
  desativar_usuario: "Desativou usuário",
  alterar_role_usuario: "Alterou tipo de usuário",
  excluir_usuario: "Excluiu usuário",
  promover_admin_plataforma: "Promoveu admin da plataforma",
  adicionar_admin_plataforma: "Adicionou admin da plataforma",
  ativar_admin_plataforma: "Ativou admin da plataforma",
  desativar_admin_plataforma: "Desativou admin da plataforma",
  remover_admin_plataforma: "Removeu admin da plataforma",
  excluir_conversa: "Excluiu conversa",
  atualizar_configuracao_plataforma: "Alterou configuração da plataforma",
  acesso_painel_admin: "Acessou o painel admin",
};

export default async function AdminLogsPage({ searchParams }: PageProps<"/admin/logs">) {
  const params = await searchParams;
  const acaoFiltro = typeof params.acao === "string" ? params.acao : "";
  const adminFiltro = typeof params.admin === "string" ? params.admin.trim().toLowerCase() : "";
  const alvoFiltro = typeof params.alvo === "string" ? params.alvo.trim() : "";
  const de = typeof params.de === "string" ? params.de : "";
  const ate = typeof params.ate === "string" ? params.ate : "";

  const supabase = await createClient();
  let query = supabase.from("admin_logs").select("*").order("criado_em", { ascending: false }).limit(500);
  if (acaoFiltro) query = query.eq("acao", acaoFiltro);
  if (alvoFiltro) query = query.eq("alvo_id", alvoFiltro);
  if (de) query = query.gte("criado_em", de);
  if (ate) query = query.lte("criado_em", `${ate}T23:59:59`);

  const { data } = await query.returns<AdminLog[]>();
  let logs = data ?? [];
  if (adminFiltro) logs = logs.filter((l) => l.admin_nome.toLowerCase().includes(adminFiltro));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Logs de auditoria</h1>
        <p className="mt-1 text-sm text-muted">{logs.length} evento(s) — últimos 500 registros.</p>
      </div>

      <Card>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" action="/admin/logs">
          <input
            type="text"
            name="admin"
            defaultValue={adminFiltro}
            placeholder="Admin…"
            className="rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice placeholder:text-muted"
          />
          <select name="acao" defaultValue={acaoFiltro} className="rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice">
            <option value="">Todas as ações</option>
            {Object.entries(ACOES_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="alvo"
            defaultValue={alvoFiltro}
            placeholder="ID do alvo…"
            className="rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice placeholder:text-muted"
          />
          <input type="date" name="de" defaultValue={de} className="rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice" />
          <input type="date" name="ate" defaultValue={ate} className="rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice" />
          <button type="submit" className="rounded-lg bg-silver/15 px-4 py-2 text-sm font-medium text-silver-2 hover:bg-silver/25 sm:col-span-2 lg:col-span-1">
            Filtrar
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Data</th>
              <th className="pb-3 pr-3 font-medium">Admin</th>
              <th className="pb-3 pr-3 font-medium">Ação</th>
              <th className="pb-3 pr-3 font-medium">Alvo</th>
              <th className="pb-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="py-2.5 pr-3 whitespace-nowrap text-muted">{formatarDataHora(log.criado_em)}</td>
                <td className="py-2.5 pr-3 text-ice">{log.admin_nome}</td>
                <td className="py-2.5 pr-3 text-ice">{ACOES_LABEL[log.acao] ?? log.acao}</td>
                <td className="py-2.5 pr-3 text-muted">
                  {log.alvo_tipo && log.alvo_id ? (
                    <Link href={`/admin/logs?alvo=${log.alvo_id}`} className="hover:underline" title={log.alvo_id}>
                      {log.alvo_tipo}:{log.alvo_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 text-xs text-muted">{log.detalhes ? JSON.stringify(log.detalhes) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhum evento encontrado.</p>}
      </Card>
    </div>
  );
}
