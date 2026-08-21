import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarUsuariosAdmin } from "@/lib/admin/usuarios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsuarioLinhaAcoes } from "@/components/admin/usuario-linha-acoes";
import type { Role } from "@/lib/types";

export const metadata = { title: "Usuários — Admin" };

const ROLE_LABEL: Record<Role, string> = { owner: "Titular", admin: "Administrador(a)", advogado: "Advogado(a)" };

type Filtro = "todos" | "ativos" | "inativos" | "admins" | "comuns" | "assinantes" | "nao_assinantes";
type Ordenacao = "nome" | "criado_em" | "ultimo_acesso" | "conversas";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "ativos", label: "Ativos" },
  { valor: "inativos", label: "Inativos" },
  { valor: "admins", label: "Administradores" },
  { valor: "comuns", label: "Usuários comuns" },
  { valor: "assinantes", label: "Assinantes" },
  { valor: "nao_assinantes", label: "Não assinantes" },
];

const ORDENACOES: { valor: Ordenacao; label: string }[] = [
  { valor: "nome", label: "Nome" },
  { valor: "criado_em", label: "Data de cadastro" },
  { valor: "ultimo_acesso", label: "Último acesso" },
  { valor: "conversas", label: "Qtd. conversas" },
];

function formatarData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function AdminUsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const params = await searchParams;
  const busca = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const filtro = (typeof params.filtro === "string" ? params.filtro : "todos") as Filtro;
  const ordenacao = (typeof params.ordenar === "string" ? params.ordenar : "criado_em") as Ordenacao;

  const [usuarios, { data: admins }] = await Promise.all([
    listarUsuariosAdmin(),
    (await createClient()).from("plataforma_admins").select("auth_user_id").returns<{ auth_user_id: string }[]>(),
  ]);

  const authIdsAdmin = new Set((admins ?? []).map((a) => a.auth_user_id));

  let linhas = usuarios.map((u) => ({ ...u, isAdminPlataforma: authIdsAdmin.has(u.authUserId) }));

  if (busca) {
    linhas = linhas.filter(
      (u) => u.nome.toLowerCase().includes(busca) || (u.email ?? "").toLowerCase().includes(busca),
    );
  }

  switch (filtro) {
    case "ativos":
      linhas = linhas.filter((u) => u.ativo);
      break;
    case "inativos":
      linhas = linhas.filter((u) => !u.ativo);
      break;
    case "admins":
      linhas = linhas.filter((u) => u.isAdminPlataforma);
      break;
    case "comuns":
      linhas = linhas.filter((u) => !u.isAdminPlataforma);
      break;
    case "assinantes":
      linhas = linhas.filter((u) => u.plano === "pro");
      break;
    case "nao_assinantes":
      linhas = linhas.filter((u) => u.plano === "free");
      break;
  }

  linhas.sort((a, b) => {
    switch (ordenacao) {
      case "nome":
        return a.nome.localeCompare(b.nome);
      case "ultimo_acesso":
        return (b.ultimoAcesso ?? "").localeCompare(a.ultimoAcesso ?? "");
      case "conversas":
        return b.totalConversas - a.totalConversas;
      default:
        return b.criadoEm.localeCompare(a.criadoEm);
    }
  });

  function urlCom(params2: Record<string, string>) {
    const usp = new URLSearchParams({ q: busca, filtro, ordenar: ordenacao, ...params2 });
    if (!usp.get("q")) usp.delete("q");
    return `/admin/usuarios?${usp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Usuários</h1>
        <p className="mt-1 text-sm text-muted">{linhas.length} usuário(s) encontrado(s).</p>
      </div>

      <Card>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/admin/usuarios">
          <input type="hidden" name="filtro" value={filtro} />
          <input type="hidden" name="ordenar" value={ordenacao} />
          <input
            type="text"
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome ou e-mail…"
            className="flex-1 rounded-lg border border-white/10 bg-navy-3 px-3 py-2 text-sm text-ice placeholder:text-muted"
          />
          <button type="submit" className="rounded-lg bg-silver/15 px-4 py-2 text-sm font-medium text-silver-2 hover:bg-silver/25">
            Buscar
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={urlCom({ filtro: f.valor })}
              className={`rounded-full border px-3 py-1 text-xs ${
                filtro === f.valor ? "border-silver/40 bg-silver/15 text-silver-2" : "border-white/10 text-muted hover:text-ice"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          Ordenar por:
          {ORDENACOES.map((o) => (
            <Link
              key={o.valor}
              href={urlCom({ ordenar: o.valor })}
              className={`rounded-md px-2 py-1 ${ordenacao === o.valor ? "bg-white/10 text-ice" : "hover:text-ice"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Nome</th>
              <th className="pb-3 pr-3 font-medium">E-mail</th>
              <th className="pb-3 pr-3 font-medium">Cadastro</th>
              <th className="pb-3 pr-3 font-medium">Últ. acesso</th>
              <th className="pb-3 pr-3 font-medium">Status</th>
              <th className="pb-3 pr-3 font-medium">Tipo</th>
              <th className="pb-3 pr-3 font-medium">Plano</th>
              <th className="pb-3 pr-3 font-medium">Conversas</th>
              <th className="pb-3 pr-3 font-medium">Msgs</th>
              <th className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {linhas.map((u) => (
              <tr key={u.perfilId}>
                <td className="py-3 pr-3 text-ice">
                  {u.nome}
                  {u.isAdminPlataforma && (
                    <span className="ml-1.5">
                      <Badge tone="blue">Admin</Badge>
                    </span>
                  )}
                  <p className="text-xs text-muted">{u.escritorioNome}</p>
                </td>
                <td className="py-3 pr-3 text-muted">{u.email ?? "—"}</td>
                <td className="py-3 pr-3 text-muted">{formatarData(u.criadoEm)}</td>
                <td className="py-3 pr-3 text-muted">{formatarData(u.ultimoAcesso)}</td>
                <td className="py-3 pr-3">
                  <Badge tone={u.ativo ? "green" : "red"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="py-3 pr-3 text-muted">{ROLE_LABEL[u.role]}</td>
                <td className="py-3 pr-3">
                  <Badge tone={u.plano === "pro" ? "silver" : "muted"}>{u.plano === "pro" ? "Pro" : "Free"}</Badge>
                </td>
                <td className="py-3 pr-3 text-muted">{u.totalConversas}</td>
                <td className="py-3 pr-3 text-muted">{u.totalMensagens}</td>
                <td className="py-3">
                  <UsuarioLinhaAcoes
                    perfilId={u.perfilId}
                    ativo={u.ativo}
                    role={u.role}
                    isAdminPlataforma={u.isAdminPlataforma}
                    escritorioId={u.escritorioId}
                    plano={u.plano}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhum usuário encontrado.</p>}
      </Card>
    </div>
  );
}
