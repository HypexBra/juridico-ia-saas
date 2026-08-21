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
    summary: "Todos os PDFs, contratos e procurações organizados, indexados e consultáveis instantaneamente pelo sistema.",
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
      { title: "Dr. Roberto Silveira (Juiz Titular)", subtitle: "14ª Vara Cível da Capital · Histórico favorável ao Tema 971", status: "Juízo" },
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
    <section id="dossie" className="relative overflow-hidden border-t border-white/[0.08] bg-[#0c0c0f] py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
              02 · A Arquitetura do Caso
            </span>
          </Reveal>
          <Reveal delayMs={100}>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight text-[#fafaf9] sm:text-5xl lg:text-6xl">
              Um lugar para o <br />
              <span className="font-normal italic text-[#d4af37]">caso inteiro.</span>
            </h2>
          </Reveal>
          <Reveal delayMs={200}>
            <p className="mt-6 text-base leading-relaxed text-[#a1a1aa] sm:text-lg">
              Em vez de arquivos soltos em pastas, mensagens perdidas no WhatsApp e
              anotações manuais em cadernos, cada caso se torna uma unidade viva de conhecimento.
            </p>
          </Reveal>
        </div>

        {/* Case Architecture Visualizer */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:items-stretch">
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
                  className={`flex flex-1 shrink-0 items-center justify-between gap-3 rounded-md border p-4 text-left transition-all duration-200 lg:flex-initial ${
                    isSelected
                      ? "border-[#d4af37] bg-[#18181f] text-[#fafaf9] shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
                      : "border-white/[0.08] bg-[#121216] text-[#a1a1aa] hover:border-white/[0.18] hover:bg-[#18181f] hover:text-[#fafaf9]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#d4af37]" : "text-[#a1a1aa]"}`} />
                    <span className="text-sm font-semibold whitespace-nowrap">{dim.label}</span>
                  </div>
                  <span className="hidden font-mono text-[10px] uppercase text-[#d4af37] lg:inline-block">
                    {dim.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detailed Facet Board */}
          <div className="rounded-xl border border-white/[0.1] bg-[#121216] p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#d4af37]">
                    DIMENSÃO DO CASO ATIVA
                  </span>
                  <h3 className="font-display text-2xl font-bold text-[#fafaf9] mt-0.5">{current.label}</h3>
                </div>
                <span className="font-mono text-xs text-[#d4af37] bg-[#d4af37]/10 px-3.5 py-1 rounded border border-[#d4af37]/30">
                  {current.tag}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa]">{current.summary}</p>

              {/* List of Case Objects */}
              <div className="mt-6 space-y-3">
                {current.details.map((item, idx) => (
                  <div
                    key={item.title}
                    className="flex flex-col gap-2 rounded-md border border-white/[0.06] bg-[#0c0c0f] p-4 transition-all hover:border-[#d4af37]/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="font-mono text-xs text-[#d4af37]/70 pt-0.5">0{idx + 1}</span>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-[#fafaf9]">{item.title}</p>
                        <p className="text-[11px] sm:text-xs text-[#a1a1aa] mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                    {item.status && (
                      <span className="self-start sm:self-auto font-mono text-[10px] uppercase px-3 py-1 rounded border border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]">
                        {item.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#a1a1aa]">
              <span>Tudo centralizado no mesmo registro do caso.</span>
              <span className="font-mono text-[10px] text-[#10b981]">INTEGRAÇÃO COMPLETA</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
