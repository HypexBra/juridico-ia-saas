import type { Metadata } from "next";
import { ComparisonPage } from "@/components/marketing/comparison-page";
import { obterComparativo } from "@/lib/comparativos";

const comparativo = obterComparativo("juridico-ia-vs-astrea")!;

export const metadata: Metadata = {
  title: `${comparativo.titulo} — Jurídico IA`,
  description: comparativo.descricao,
  alternates: {
    canonical: "/comparativo/juridico-ia-vs-astrea",
  },
};

export default function ComparativoAstreaPage() {
  return <ComparisonPage comparativo={comparativo} />;
}
