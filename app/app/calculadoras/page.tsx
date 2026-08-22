import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import {
  CalculadoraAtualizacao,
} from "@/components/app/calculadora-atualizacao";
import { CalculadoraSucumbenciais } from "@/components/app/calculadora-sucumbenciais";
import { CalculadoraPrazo, CalculadoraPrescricao } from "@/components/app/calculadora-prazos";

export const metadata = { title: "Calculadoras Jurídicas — Jurídico IA" };

/**
 * Fase 16 — Calculadoras jurídicas com fonte e premissa explícitas.
 * Índices econômicos vêm AO VIVO da API oficial do Banco Central (sem chave,
 * série SGS); os motores são puros, testados e mostram fórmula/premissas
 * junto ao resultado (regra de produto: cálculo é apoio, não certeza).
 */
export default async function CalculadorasPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Calculadoras Jurídicas</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Atualização monetária com índices oficiais do Banco Central, honorários do art. 85 CPC,
            prazos processuais em dias úteis com feriados nacionais e prescrição por área.
            Todo resultado mostra a fórmula, as premissas e a fonte — confira antes de protocolar.
          </p>
        </div>
        <LinkButton href="/app/dashboard" variant="ghost" size="sm">
          ← Voltar
        </LinkButton>
      </div>

      <div className="space-y-4">
        <CalculadoraPrazo />
        <CalculadoraAtualizacao />
        <CalculadoraSucumbenciais />
        <CalculadoraPrescricao />
      </div>

      <Card className="border-dashed bg-transparent">
        <p className="text-xs text-muted">
          Sugestão de fluxo: cole o trecho da sentença no{" "}
          <Link href="/app/documentos" className="underline underline-offset-2 text-silver-2">
            Document Intelligence
          </Link>{" "}
          para extrair valor e datas automaticamente, depois traga aqui para calcular. Os resultados não substituem
          liquidação judicial quando exigida pelo juízo.
        </p>
      </Card>
    </div>
  );
}
