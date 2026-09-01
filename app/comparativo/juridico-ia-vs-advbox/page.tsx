import type { Metadata } from "next";
import { ComparisonPage } from "@/components/marketing/comparison-page";
import { obterComparativo } from "@/lib/comparativos";

const comparativo = obterComparativo("juridico-ia-vs-advbox")!;

export const metadata: Metadata = {
  title: `${comparativo.titulo} — Jurídico IA`,
  description: comparativo.descricao,
  alternates: {
    canonical: "/comparativo/juridico-ia-vs-advbox",
  },
};

export default function ComparativoAdvboxPage() {
  return <ComparisonPage comparativo={comparativo} />;
}
