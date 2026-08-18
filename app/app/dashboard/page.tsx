import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { LIMITE_MENSAGENS_FREE } from "@/lib/types";
import type { FichaCaso, Prazo } from "@/lib/types";

export const metadata = { title: "Dashboard — Jurídico IA" };

function formatarData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diasAte(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function urgenciaPrazo(dias: number): { label: string; tone: "red" | "gold" | "green" | "muted" } {
  if (dias < 0) return { label: "Vencido", tone: "red" };
  if (dias <= 1) return { label: "Urgente", tone: "red" };
  if (dias <= 3) return { label: `Em ${dias} dias`, tone: "gold" };
  if (dias <= 7) return { label: `Em ${dias} dias`, tone: "gold" };
  return { label: `Em ${dias} dias`, tone: "green" };
}

export default async function DashboardPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const supabase = await createClient();
  const mesRef = new Date().toISOString().slice(0, 7);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limiteAlerta = new Date(hoje);
  limiteAlerta.setDate(limiteAlerta.getDate() + 3);
  const dataLimiteAlerta = limiteAlerta.toISOString().slice(0, 10);

  const [prazosRes, alertasPrazoRes, fichasRes, usoRes] = await Promise.all([
    supabase
      .from("prazos")
      .select("*")
      .eq("concluido", false)
      .order("data_prazo", { ascending: true })
      .limit(6)
      .returns<Prazo[]>(),
    // Alertas: só leitura, prazos vencidos ou que vencem nos próximos 3 dias
    // — ordenado por urgência (mais vencido/mais próximo primeiro).
    supabase
      .from("prazos")
      .select("*")
      .eq("concluido", false)
      .lte("data_prazo", dataLimiteAlerta)
      .order("data_prazo", { ascending: true })
      .limit(10)
      .returns<Prazo[]>(),
    supabase
      .from("fichas_caso")
      .select("*")
      .eq("lida", false)
      .order("criado_em", { ascending: false })
      .limit(6)
      .returns<FichaCaso[]>(),
    supabase.from("uso_ia").select("id").eq("mes_ref", mesRef),
  ]);

  const prazos = prazosRes.data ?? [];
  const alertasPrazo = alertasPrazoRes.data ?? [];
  const fichas = fichasRes.data ?? [];
  const usoMes = usoRes.data?.length ?? 0;
  const percentualUso = Math.min(100, Math.round((usoMes / LIMITE_MENSAGENS_FREE) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">
          Olá, {usuario.perfil.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">Visão geral do escritório {usuario.perfil.escritorio.nome}.</p>
      </div>

      {alertasPrazo.length > 0 && (
        <Card className="border-red-500/30 bg-red-950/10">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-400" />
              <CardTitle className="text-ice">Prazos que exigem atenção</CardTitle>
            </div>
            <LinkButton href="/app/prazos" variant="ghost" size="sm">
              Ver todos →
            </LinkButton>
          </div>
          <ul className="space-y-2.5">
            {alertasPrazo.map((prazo) => {
              const dias = diasAte(prazo.data_prazo);
              const urgencia = urgenciaPrazo(dias);
              return (
                <li
                  key={prazo.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-navy-3/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ice">{prazo.titulo}</p>
                    <p className="text-xs text-muted">
                      {formatarData(prazo.data_prazo)}
                      {prazo.cliente_nome ? ` · ${prazo.cliente_nome}` : ""}
                      {prazo.processo ? ` · ${prazo.processo}` : ""}
                    </p>
                  </div>
                  <Badge tone={urgencia.tone}>{urgencia.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Prazos em aberto</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">{prazos.length}</p>
          <Link href="/app/prazos" className="mt-3 inline-block text-xs font-medium text-gold hover:text-gold-2">
            Ver todos →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Fichas não lidas</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">{fichas.length}</p>
          <Link href="/app/fichas" className="mt-3 inline-block text-xs font-medium text-gold hover:text-gold-2">
            Ver todas →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Uso de IA no mês</p>
          <p className="mt-2 font-display text-3xl font-bold text-ice">
            {usoMes}
            <span className="text-base font-normal text-muted"> / {LIMITE_MENSAGENS_FREE}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${percentualUso >= 90 ? "bg-red-400" : "bg-gold"}`}
              style={{ width: `${percentualUso}%` }}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Próximos prazos</CardTitle>
            <LinkButton href="/app/prazos" variant="ghost" size="sm">
              Gerenciar
            </LinkButton>
          </div>
          {prazos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum prazo em aberto. Você está em dia.</p>
          ) : (
            <ul className="space-y-3">
              {prazos.map((prazo) => {
                const urgencia = urgenciaPrazo(diasAte(prazo.data_prazo));
                return (
                  <li key={prazo.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">{prazo.titulo}</p>
                      <p className="text-xs text-muted">
                        {formatarData(prazo.data_prazo)}
                        {prazo.cliente_nome ? ` · ${prazo.cliente_nome}` : ""}
                      </p>
                    </div>
                    <Badge tone={urgencia.tone}>{urgencia.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Fichas de triagem não lidas</CardTitle>
            <LinkButton href="/app/fichas" variant="ghost" size="sm">
              Ver fichas
            </LinkButton>
          </div>
          {fichas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma ficha pendente de leitura.</p>
          ) : (
            <ul className="space-y-3">
              {fichas.map((ficha) => (
                <li key={ficha.id}>
                  <Link
                    href={`/app/fichas/${ficha.id}`}
                    className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ice">
                        {ficha.nome_cliente ?? "Cliente sem nome"}
                      </p>
                      <p className="truncate text-xs text-muted">{ficha.area_direito ?? "Área não informada"}</p>
                    </div>
                    <Badge tone={ficha.urgencia === "alta" ? "red" : ficha.urgencia === "normal" ? "gold" : "muted"}>
                      {ficha.urgencia}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
