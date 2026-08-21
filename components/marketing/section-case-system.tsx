"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import {
  IconClock,
  IconDossier,
  IconFileAudit,
  IconFileText,
  IconScale,
  IconUsers,
} from "./icons";

interface CaseDimension {
  id: string;
  label: string;
  tag: string;
  icon: typeof IconDossier;
  summary: string;
  details: { title: string; subtitle: string; status?: string }[];
}

const CASE_DIMENSIONS: CaseDimension[] = [
  {
    id: "documentos",
    label: "Documentos",
    tag: "3 ARQUIVOS VINCULADOS",
    icon: IconFileText,
    summary: "Todos os PDFs, contratos e procurações organizados, indexados e consultáveis instantaneamente pela IA.",
    details: [
      { title: "Contrato_Prestacao_Servicos_v2.pdf", subtitle: "24 páginas · Extração de cláusulas de multa concluída", status: "Analisado" },
      { title: "Comprovantes_Pagamento_Rescisao.pdf", subtitle: "12 páginas · Divergência de valores detectada", status: "Alerta" },
      { title: "Procuracao_Ad_Judicia_Mariana.pdf", subtitle: "Assinatura digital válida via ICP-Brasil", status: "Válido" },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas & Partes",
    tag: "4 ENVOLVIDOS",
    icon: IconUsers,
    summary: "Cadastro completo do cliente, patronos contrários, magistrado e testemunhas associados ao caso.",
    details: [
      { title: "Mariana L. Vasconcelos (Autora)", subtitle: "Acesso ativo ao Portal do Cliente · CPF validado", status: "Cliente" },
      { title: "Banco Horizonte S/A (Réu)", subtitle: "CNPJ 04.192.482/0001-90 · Patronos habilitados", status: "Parte Contrária" },
      { title: "Dr. Roberto Silveira (Juiz Titular)", subtitle: "14ª Vara Cível da Capital · Histórico de decisões favorável ao Tema 971", status: "Juízo" },
    ],
  },
  {
    id: "prazos",
    label: "Prazos & DJEN",
    tag: "2 EVENTOS",
    icon: IconClock,
    summary: "Sincronização diária com diários de justiça. Contagem de dias úteis com exclusão automática de feriados locais.",
    details: [
      { title: "Contestação à Reconvenção", subtitle: "Vencimento em 6 dias úteis · Publicado no DJEN", status: "Fatal" },
      { title: "Audiência de Conciliação Virtual", subtitle: "Data designada para 14/10 às 14h30 via Teams", status: "Agendado" },
    ],
  },
  {
    id: "estrategia",
    label: "Estratégia & Teses",
    tag: "3 TESES VINCULADAS",
    icon: IconScale,
    summary: "Teses consolidadas, jurisprudência do STJ/STF aplicável e contrapontos preparados para a réplica.",
    details: [
      { title: "Tema 971 / STJ — Inversão de Cláusula Penal", subtitle: "Precedente vinculante em favor do consumidor", status: "Principal" },
      { title: "Súmula 543 / STJ — Restituição Imediata", subtitle: "Rescisão por culpa exclusiva da promitente vendedora", status: "Subsidiária" },
      { title: "Impugnação de Foro de Eleição Abusivo", subtitle: "Competência do domicílio do autor (CDC art. 101, I)", status: "Preliminar" },
    ],
  },
];

export function SectionCaseSystem() {
  const [selectedDimension, setSelectedDimension] = useState<string>("documentos");
  const current = CASE_DIMENSIONS.find((d) => d.id === selectedDimension) ?? CASE_DIMENSIONS[0];

  return (
    <section id="caso-sistema" className="relative overflow-hidden border-t border-silver/10 bg-[#090f1a] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-silver">
              02 · A Arquitetura do Caso
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ice sm:text-4xl lg:text-5xl">
              Um lugar para o <br />
              <span className="font-normal italic text-silver-2">caso inteiro.</span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
              Em vez de arquivos soltos em pastas, mensagens perdidas no WhatsApp e
              anotações manuais em cadernos, cada caso se torna uma unidade viva de conhecimento.
            </p>
          </Reveal>
        </div>

        {/* Case Architecture Visualizer */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:items-stretch">
          {/* Navigation Facets */}
          <div className="flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
            {CASE_DIMENSIONS.map((dim) => {
              const isSelected = dim.id === selectedDimension;
              const Icon = dim.icon;
              return (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => setSelectedDimension(dim.id)}
                  className={`flex flex-1 shrink-0 items-center justify-between gap-3 rounded-sm border p-4 text-left transition-all duration-150 lg:flex-initial ${
                    isSelected
                      ? "border-silver bg-silver/15 text-ice shadow-[0_4px_16px_rgba(199,210,232,0.1)]"
                      : "border-silver/15 bg-navy-2/20 text-muted hover:border-silver/30 hover:bg-navy-2/40 hover:text-ice-2"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-silver" : "text-muted"}`} />
                    <span className="text-sm font-semibold whitespace-nowrap">{dim.label}</span>
                  </div>
                  <span className="hidden font-mono text-[10px] uppercase text-silver-2/80 lg:inline-block">
                    {dim.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detailed Facet Board */}
          <div className="rounded-md border border-silver/20 bg-[#0c1422] p-6 sm:p-8 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver/10 pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-silver">
                  DIMENSÃO ATIVA
                </span>
                <h3 className="font-display text-xl font-bold text-ice mt-0.5">{current.label}</h3>
              </div>
              <span className="font-mono text-xs text-silver-2 bg-silver/10 px-3 py-1 rounded border border-silver/20">
                {current.tag}
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">{current.summary}</p>

            {/* List of Case Objects */}
            <div className="mt-6 space-y-3">
              {current.details.map((item, idx) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-2 rounded-sm border border-silver/10 bg-black/20 p-4 transition-all hover:border-silver/25 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs text-silver/60">0{idx + 1}</span>
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-ice">{item.title}</p>
                      <p className="text-[11px] sm:text-xs text-muted mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <span className="self-start sm:self-auto font-mono text-[10px] uppercase px-2.5 py-0.5 rounded border border-silver/20 bg-silver/5 text-silver-2">
                      {item.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
