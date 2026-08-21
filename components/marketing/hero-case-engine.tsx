"use client";

import { useEffect, useState } from "react";
import {
  IconClock,
  IconDossier,
  IconFileAudit,
  IconFileText,
  IconLockSecure,
  IconCheck,
} from "./icons";

interface EventStep {
  id: string;
  tag: string;
  title: string;
  detail: string;
  status: "idle" | "active" | "done";
  timestamp: string;
}

const SIMULATION_STEPS: EventStep[] = [
  {
    id: "doc-received",
    tag: "DOCUMENTO RECEBIDO",
    title: "Contrato de Prestação & Rescisão.pdf",
    detail: "18 páginas lidas · Extração de cláusulas de tolerância e multas",
    status: "done",
    timestamp: "10:14:02",
  },
  {
    id: "djen-sync",
    tag: "VARREDURA DJEN",
    title: "Publicação do Tribunal de Justiça",
    detail: "Prazo para contestação (15 dias úteis) · Art. 335 do CPC",
    status: "active",
    timestamp: "10:14:08",
  },
  {
    id: "precedent-link",
    tag: "CRUZAMENTO DE TESES",
    title: "Tema 971 / STJ aplicado à impugnação",
    detail: "Fundamentação vinculante anexada · 0 alucinações",
    status: "idle",
    timestamp: "10:14:15",
  },
  {
    id: "draft-ready",
    tag: "MINUTA ESTRUTURADA",
    title: "Petição Inicial com Pedido Liminar",
    detail: "Pronta para revisão do advogado antes da assinatura",
    status: "idle",
    timestamp: "10:14:21",
  },
];

export function HeroCaseEngine() {
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [activeTab, setActiveTab] = useState<"dossie" | "auditoria" | "prazos">("dossie");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % SIMULATION_STEPS.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Subtle ambient mineral backlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-2xl opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(199,210,232,0.12) 0%, rgba(19,41,75,0.4) 60%, transparent 80%)",
        }}
      />

      {/* Main Dossier Surface */}
      <div className="overflow-hidden rounded-md border border-silver/20 bg-[#0d1626]/95 shadow-[0_24px_64px_rgba(0,0,0,0.65)] backdrop-blur-md">
        {/* Terminal Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-silver/10 bg-black/30 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400/80 animate-pulse" />
            <span className="font-mono text-[11px] font-medium tracking-wider text-silver-2 uppercase">
              CASO #0241 · COMARCA DA CAPITAL
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
            <IconLockSecure className="h-3 w-3 text-silver/60" />
            <span>ISOLAMENTO ATIVO</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-silver/10 bg-black/15 text-[11px] font-medium text-muted">
          <button
            type="button"
            onClick={() => setActiveTab("dossie")}
            className={`flex flex-1 items-center justify-center gap-2 border-r border-silver/10 py-2.5 transition-colors ${
              activeTab === "dossie"
                ? "bg-silver/10 text-ice border-b-2 border-b-silver"
                : "hover:text-ice-2"
            }`}
          >
            <IconDossier className="h-3.5 w-3.5" />
            Visão do Caso
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("auditoria")}
            className={`flex flex-1 items-center justify-center gap-2 border-r border-silver/10 py-2.5 transition-colors ${
              activeTab === "auditoria"
                ? "bg-silver/10 text-ice border-b-2 border-b-silver"
                : "hover:text-ice-2"
            }`}
          >
            <IconFileAudit className="h-3.5 w-3.5" />
            Auditoria Ativa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prazos")}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 transition-colors ${
              activeTab === "prazos"
                ? "bg-silver/10 text-ice border-b-2 border-b-silver"
                : "hover:text-ice-2"
            }`}
          >
            <IconClock className="h-3.5 w-3.5" />
            DJEN & Prazos
          </button>
        </div>

        {/* Case Body Content */}
        <div className="p-5 sm:p-6">
          {activeTab === "dossie" && (
            <div className="space-y-4">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 rounded-sm border border-silver/10 bg-black/20 p-3.5 text-xs">
                <div>
                  <span className="block font-mono text-[10px] uppercase text-muted">Cliente</span>
                  <span className="font-medium text-ice">Mariana L. Vasconcelos</span>
                </div>
                <div>
                  <span className="block font-mono text-[10px] uppercase text-muted">Processo</span>
                  <span className="font-mono text-[11px] text-silver-2">5002931-82.2026.8.21.0001</span>
                </div>
                <div>
                  <span className="block font-mono text-[10px] uppercase text-muted">Área & Ação</span>
                  <span className="text-ice-2">Cível · Rescisão Contratual c/c Danos</span>
                </div>
                <div>
                  <span className="block font-mono text-[10px] uppercase text-muted">Status do Fluxo</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Em análise estratégica
                  </span>
                </div>
              </div>

              {/* Event Pipeline Stream */}
              <div className="space-y-2.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                  ATIVIDADES DO SISTEMA EM SEGUNDO PLANO
                </p>
                <div className="space-y-2">
                  {SIMULATION_STEPS.map((step, idx) => {
                    const isActive = idx === currentStepIndex;
                    const isPassed = idx < currentStepIndex;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 rounded-sm border p-3 transition-all duration-300 ${
                          isActive
                            ? "border-silver/40 bg-silver/10 shadow-[0_0_15px_rgba(199,210,232,0.06)]"
                            : isPassed
                            ? "border-white/5 bg-white/[0.02] opacity-80"
                            : "border-white/5 bg-transparent opacity-40"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-mono ${
                            isPassed || isActive
                              ? "bg-silver/20 text-silver-2 border border-silver/40"
                              : "bg-white/5 text-muted border border-white/10"
                          }`}
                        >
                          {isPassed ? <IconCheck className="h-2.5 w-2.5" /> : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[9px] tracking-wider text-silver uppercase">
                              {step.tag}
                            </span>
                            <span className="font-mono text-[9px] text-muted">{step.timestamp}</span>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-ice truncate">{step.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted leading-relaxed">{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "auditoria" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-sm border border-silver/15 bg-black/20 p-4">
                <div className="flex items-center justify-between border-b border-silver/10 pb-2.5">
                  <span className="font-mono text-[11px] font-semibold text-silver uppercase">
                    Auditoria de Conformidade Pré-Assinatura
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400">100% VERIFICADO</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-ice-2">
                    <span>Fundamentação fática e legal (CCB art. 389 e 475)</span>
                    <span className="font-mono text-emerald-400">✓ Conforme</span>
                  </div>
                  <div className="flex items-center justify-between text-ice-2">
                    <span>Liquidação preliminar de pedidos (R$ 84.200,00)</span>
                    <span className="font-mono text-emerald-400">✓ Conciliado</span>
                  </div>
                  <div className="flex items-center justify-between text-ice-2">
                    <span>Súmula 543 STJ (Devolução integral de parcelas)</span>
                    <span className="font-mono text-emerald-400">✓ Anexada</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-300/90">
                    <span>Cláusula 14.2 do Contrato (Foro de Eleição abusivo)</span>
                    <span className="font-mono text-amber-300">! Impugnada</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted italic">
                A IA audita consistência interna, teses jurisprudenciais vigentes e pedidos antes do protocolo.
              </p>
            </div>
          )}

          {activeTab === "prazos" && (
            <div className="space-y-3 text-xs">
              <div className="rounded-sm border border-silver/15 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-silver">
                  <IconClock className="h-4 w-4" />
                  <span className="font-mono text-[11px] font-semibold uppercase">
                    Sincronização Diária com DJEN / PJe
                  </span>
                </div>
                <div className="mt-3 rounded-sm border border-amber-400/20 bg-amber-400/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-200 text-xs">Prazo Fatal: Contestação</span>
                    <span className="font-mono text-[10px] bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded">
                      Vence em 6 dias úteis
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Publicado no DJEN Caderno 3 · Disponibilização em 19.08 · Contagem automática sem feriados locais.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted">
                Sem necessidade de conferir publicações manuais ou montar planilhas paralelas.
              </p>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t border-silver/10 bg-black/40 px-5 py-2.5 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <IconFileText className="h-3.5 w-3.5 text-silver" />
            <span className="font-mono text-[10px]">Minuta gerada: 14 páginas</span>
          </div>
          <span className="font-mono text-[10px] text-silver-2">Revisão Pendente pelo Advogado</span>
        </div>
      </div>
    </div>
  );
}
