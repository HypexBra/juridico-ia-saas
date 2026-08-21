"use client";

import { useEffect, useState } from "react";
import {
  IconAdversarial,
  IconCheck,
  IconClock,
  IconDossier,
  IconFileAudit,
  IconFileText,
  IconLockSecure,
  IconScale,
  IconSearchFilter,
} from "./icons";

export function HeroInteractiveStudio() {
  const [activeMode, setActiveMode] = useState<"dossie" | "redline" | "contra" | "djen">("dossie");
  const [redlineApplied, setRedlineApplied] = useState(false);
  const [contraIntensity, setContraIntensity] = useState<"moderado" | "agressivo">("agressivo");

  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Golden halo glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(212,175,55,0.22) 0%, rgba(18,18,22,0.6) 70%, transparent 80%)",
        }}
      />

      {/* Main Studio Frame */}
      <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-[#121216]/95 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Studio Window Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] bg-[#0c0c0f] px-5 py-3.5 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
            </div>
            <span className="font-mono text-[11px] font-medium tracking-wider text-[#d4af37] uppercase">
              STUDIO DE CASO · PROCESSO 5002931-82.2026.8.21.0001
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#a1a1aa]">
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>SINCRONIA TOTAL ATIVA</span>
          </div>
        </div>

        {/* Studio Workspace Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/[0.08] bg-[#09090b]/80 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setActiveMode("dossie")}
            className={`flex items-center justify-center gap-2 py-3 px-2 transition-all border-r border-white/[0.06] ${
              activeMode === "dossie"
                ? "bg-[#18181f] text-[#fafaf9] border-b-2 border-b-[#d4af37]"
                : "text-[#a1a1aa] hover:text-[#fafaf9] hover:bg-white/[0.02]"
            }`}
          >
            <IconDossier className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Dossiê Vivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("redline")}
            className={`flex items-center justify-center gap-2 py-3 px-2 transition-all border-r border-white/[0.06] ${
              activeMode === "redline"
                ? "bg-[#18181f] text-[#fafaf9] border-b-2 border-b-[#d4af37]"
                : "text-[#a1a1aa] hover:text-[#fafaf9] hover:bg-white/[0.02]"
            }`}
          >
            <IconFileAudit className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Redline & Auditoria</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("contra")}
            className={`flex items-center justify-center gap-2 py-3 px-2 transition-all border-r border-white/[0.06] ${
              activeMode === "contra"
                ? "bg-[#18181f] text-[#fafaf9] border-b-2 border-b-[#d4af37]"
                : "text-[#a1a1aa] hover:text-[#fafaf9] hover:bg-white/[0.02]"
            }`}
          >
            <IconAdversarial className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Advogado do Contra</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("djen")}
            className={`flex items-center justify-center gap-2 py-3 px-2 transition-all ${
              activeMode === "djen"
                ? "bg-[#18181f] text-[#fafaf9] border-b-2 border-b-[#d4af37]"
                : "text-[#a1a1aa] hover:text-[#fafaf9] hover:bg-white/[0.02]"
            }`}
          >
            <IconClock className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Radar DJEN</span>
          </button>
        </div>

        {/* Interactive Studio Stage */}
        <div className="p-5 sm:p-7 min-h-[380px] flex flex-col justify-between">
          {/* MODE 1: DOSSIÊ VIVO */}
          {activeMode === "dossie" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#a1a1aa] block">
                    CLIENTE & PARTE
                  </span>
                  <p className="font-semibold text-sm text-[#fafaf9] mt-0.5">Mariana L. Vasconcelos</p>
                  <span className="font-mono text-[10px] text-[#10b981] mt-1 inline-block">
                    ● Triagem Concluída
                  </span>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#a1a1aa] block">
                    VALOR DA CAUSA
                  </span>
                  <p className="font-semibold text-sm text-[#fafaf9] mt-0.5">R$ 142.500,00</p>
                  <span className="font-mono text-[10px] text-[#d4af37] mt-1 inline-block">
                    ● Liquidação Automática
                  </span>
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-3.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#a1a1aa] block">
                    PRECEDENTE VINCULANTE
                  </span>
                  <p className="font-semibold text-sm text-[#fafaf9] mt-0.5">STJ · Tema 971</p>
                  <span className="font-mono text-[10px] text-[#10b981] mt-1 inline-block">
                    ● Tese Consolidada
                  </span>
                </div>
              </div>

              {/* Connected Graph Visualization */}
              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-4 space-y-3">
                <span className="font-mono text-[10px] font-semibold text-[#d4af37] uppercase block">
                  CONEXÕES VIVAS DO CASO #0241
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2.5 rounded border border-white/[0.05] bg-black/40 p-2.5 text-[#fafaf9]">
                    <IconFileText className="h-4 w-4 text-[#d4af37] shrink-0" />
                    <div className="truncate">
                      <p className="font-medium truncate">Contrato_Promessa_Compra.pdf</p>
                      <p className="text-[10px] text-[#a1a1aa]">Cláusula 8ª e 14ª extraídas</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded border border-white/[0.05] bg-black/40 p-2.5 text-[#fafaf9]">
                    <IconClock className="h-4 w-4 text-[#f59e0b] shrink-0" />
                    <div className="truncate">
                      <p className="font-medium truncate">DJEN · Caderno 3 (19/08)</p>
                      <p className="text-[10px] text-[#a1a1aa]">Prazo fatal: 6 dias úteis</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/5 p-3 flex items-center justify-between text-xs">
                <span className="text-[#fafaf9]">Minuta de Petição Inicial pronta para sua assinatura forense.</span>
                <span className="font-mono text-[10px] text-[#d4af37] font-semibold uppercase">100% REVISADA</span>
              </div>
            </div>
          )}

          {/* MODE 2: REDLINE & AUDITORIA */}
          {activeMode === "redline" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#d4af37] font-semibold">
                    AUDITORIA DE CLÁUSULA CONTRATUAL
                  </span>
                  <p className="text-xs text-[#a1a1aa] mt-0.5">Cláusula 8ª — Retenção por Inadimplemento</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRedlineApplied(!redlineApplied)}
                  className="rounded border border-[#d4af37]/50 bg-[#d4af37]/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-[#d4af37] hover:bg-[#d4af37]/25 transition-all"
                >
                  {redlineApplied ? "Ver Original" : "Aplicar Correção Jurisprudencial"}
                </button>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-4 font-serif text-xs leading-relaxed text-[#fafaf9]">
                {redlineApplied ? (
                  <div>
                    <p className="line-through text-red-400/80 mb-2">
                      &ldquo;Em caso de rescisão, a PROMITENTE VENDEDORA reterá 25% (vinte e cinco por cento) do valor total pago a título de multa compensatória.&rdquo;
                    </p>
                    <p className="text-[#10b981] bg-[#10b981]/10 p-2.5 rounded border border-[#10b981]/20 font-sans text-xs">
                      <strong>✓ Redline Corrigido (Tema 971 STJ & CDC art. 51):</strong> &ldquo;A retenção fica limitada a 10% do montante integralizado, com restituição imediata e integral do saldo remanescente com juros de mora.&rdquo;
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[#fafaf9] italic">
                      &ldquo;Em caso de rescisão, a PROMITENTE VENDEDORA reterá 25% (vinte e cinco por cento) do valor total pago a título de multa compensatória.&rdquo;
                    </p>
                    <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200 font-sans">
                      <span className="font-bold font-mono text-[10px] uppercase block mb-0.5">[!] ALERTA DE ILEGALIDADE:</span>
                      Percentual de 25% é abusivo segundo a pacificação do STJ. Clique no botão acima para aplicar a redação defensável.
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-[#a1a1aa]">
                O sistema reescreve cláusulas frágeis e aponta o artigo ou precedente exato para impugnação.
              </p>
            </div>
          )}

          {/* MODE 3: ADVOGADO DO CONTRA */}
          {activeMode === "contra" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <span className="font-mono text-[10px] uppercase text-[#d4af37] font-semibold">
                  SIMULADOR DE RED-TEAMING FORENSE
                </span>
                <div className="flex gap-1.5 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => setContraIntensity("moderado")}
                    className={`px-2.5 py-1 rounded border ${
                      contraIntensity === "moderado"
                        ? "border-[#d4af37] bg-[#d4af37]/20 text-[#d4af37]"
                        : "border-white/10 text-[#a1a1aa]"
                    }`}
                  >
                    Moderado
                  </button>
                  <button
                    type="button"
                    onClick={() => setContraIntensity("agressivo")}
                    className={`px-2.5 py-1 rounded border ${
                      contraIntensity === "agressivo"
                        ? "border-red-400 bg-red-400/20 text-red-300"
                        : "border-white/10 text-[#a1a1aa]"
                    }`}
                  >
                    Ataque Agressivo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/[0.08] bg-[#0c0c0f] p-3.5 space-y-2">
                  <span className="font-mono text-[9px] uppercase text-red-400 font-bold block">
                    Ataque Previsto da Outra Parte:
                  </span>
                  <p className="font-medium text-[#fafaf9]">
                    {contraIntensity === "agressivo"
                      ? "Arguição de preliminar de incompetência territorial pelo foro de eleição + alegação de fato de terceiro (atraso das chuvas)."
                      : "Pedido de retenção mínima de 20% com base no pacta sunt servanda."}
                  </p>
                </div>

                <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/5 p-3.5 space-y-2">
                  <span className="font-mono text-[9px] uppercase text-[#10b981] font-bold block">
                    Blindagem Preventiva da IA:
                  </span>
                  <p className="text-xs text-[#fafaf9]">
                    {contraIntensity === "agressivo"
                      ? "Juntada do laudo meteorológico comprovando regime normal de chuvas e citação da Súmula 161 do TJSP (fortuito interno)."
                      : "Aplicação imediata do Tema 971 STJ vinculando a inversão da cláusula penal."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#10b981]">
                <IconCheck className="h-4 w-4" />
                <span>Prevenção probatória embutida na petição antes do protocolo</span>
              </div>
            </div>
          )}

          {/* MODE 4: RADAR DJEN */}
          {activeMode === "djen" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f59e0b]" />
                  </span>
                  <span className="font-mono text-[10px] uppercase text-[#d4af37] font-semibold">
                    VARREDURA ATIVA NOS DIÁRIOS DE JUSTIÇA
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#a1a1aa]">COMARCA DA CAPITAL / TJRS</span>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-200">Publicação nº 88.291 · DJEN Caderno 3</span>
                  <span className="font-mono text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                    Prazo Fatal: 6 dias úteis
                  </span>
                </div>
                <p className="text-[#fafaf9] leading-relaxed">
                  &ldquo;Intime-se a parte autora para manifestação sobre os documentos juntados pela ré no prazo de 15 dias.&rdquo;
                </p>
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#a1a1aa]">
                  <span>Feriados locais excluídos automaticamente</span>
                  <span className="text-[#d4af37] font-semibold">Tarefa criada na pauta</span>
                </div>
              </div>

              <p className="text-[11px] text-[#a1a1aa]">
                Zero planilhas manuais: o sistema captura publicações e agenda a minuta sozinho.
              </p>
            </div>
          )}

          {/* Studio Stage Footer */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#a1a1aa]">
            <span className="font-mono text-[10px] text-[#d4af37]">JURÍDICO OS v3.5</span>
            <span className="flex items-center gap-1.5">
              <IconLockSecure className="h-3 w-3 text-[#d4af37]" />
              Isolamento Criptográfico AES-256
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
