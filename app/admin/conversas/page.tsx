import Link from "next/link";
import { listarConversasAdmin } from "@/lib/admin/usuarios";
import { Card } from "@/components/ui/card";
import { ExcluirConversaBotao } from "@/components/admin/excluir-conversa-botao";
import { formatarDataHora } from "@/lib/app/formatar-data";

export const metadata = { title: "Conversas — Admin" };

export default async function AdminConversasPage({ searchParams }: PageProps<"/admin/conversas">) {
  const params = await searchParams;
  const busca = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const de = typeof params.de === "string" ? params.de : "";
  const ate = typeof params.ate === "string" ? params.ate : "";

  let conversas = await listarConversasAdmin();

  if (busca) {
    conversas = conversas.filter(
      (c) =>
        c.autorNome.toLowerCase().includes(busca) ||
        (c.autorEmail ?? "").toLowerCase().includes(busca) ||
        (c.titulo ?? "").toLowerCase().includes(busca),
    );
  }
  if (de) conversas = conversas.filter((c) => c.iniciadaEm.slice(0, 10) >= de);
  if (ate) conversas = conversas.filter((c) => c.iniciadaEm.slice(0, 10) <= ate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Conversas</h1>
        <p className="mt-1 text-sm text-muted">{conversas.length} conversa(s) encontrada(s) em todos os escritórios.</p>
      </div>

      <Card>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/admin/conversas">
          <input
            type="text"
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome, e-mail ou título…"
            className="flex-1 rounded-lg border border-ink/10 bg-navy-3 px-3 py-2 text-sm text-ice placeholder:text-muted"
          />
          <div className="flex items-center gap-2 text-xs text-muted">
            <label htmlFor="de">De</label>
            <input id="de" type="date" name="de" defaultValue={de} className="rounded-lg border border-ink/10 bg-navy-3 px-2 py-1.5 text-sm text-ice" />
            <label htmlFor="ate">até</label>
            <input id="ate" type="date" name="ate" defaultValue={ate} className="rounded-lg border border-ink/10 bg-navy-3 px-2 py-1.5 text-sm text-ice" />
          </div>
          <button type="submit" className="rounded-lg bg-silver/15 px-4 py-2 text-sm font-medium text-silver-2 hover:bg-silver/25">
            Buscar
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Usuário</th>
              <th className="pb-3 pr-3 font-medium">E-mail</th>
              <th className="pb-3 pr-3 font-medium">Título</th>
              <th className="pb-3 pr-3 font-medium">Data</th>
              <th className="pb-3 pr-3 font-medium">Mensagens</th>
              <th className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {conversas.map((c) => (
              <tr key={c.id}>
                <td className="py-3 pr-3 text-ice">{c.autorNome}</td>
                <td className="py-3 pr-3 text-muted">{c.autorEmail ?? "—"}</td>
                <td className="py-3 pr-3 text-ice">
                  <Link href={`/admin/conversas/${c.id}`} className="hover:underline">
                    {c.titulo ?? "Sem título"}
                  </Link>
                </td>
                <td className="py-3 pr-3 text-muted">{formatarDataHora(c.iniciadaEm)}</td>
                <td className="py-3 pr-3 text-muted">{c.totalMensagens}</td>
                <td className="py-3">
                  <ExcluirConversaBotao conversaId={c.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {conversas.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhuma conversa encontrada.</p>}
      </Card>
    </div>
  );
}
