import type { Metadata } from "next";
import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Termos de Uso — Jurídico IA",
  description: "Termos e condições de uso da plataforma Jurídico IA.",
};

/** ATENÇÃO — preencher [RAZÃO SOCIAL]/[CNPJ]/[ENDEREÇO]/[FORO] antes de publicar (mesmos placeholders de app/privacidade/page.tsx). */
const ULTIMA_ATUALIZACAO = "31 de agosto de 2026";

export default function TermosDeUsoPage() {
  return (
    <main className="bg-paper">
      <Nav />
      <div className="mx-auto max-w-3xl px-5 py-20 md:px-10 md:py-28">
        <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">Legal</p>
        <h1 className="mt-4 font-serif-ed text-3xl leading-[1.05] tracking-tight text-ink md:text-4xl">
          Termos de Uso
        </h1>
        <p className="mt-3 font-sans-ed text-sm text-ink-3">Última atualização: {ULTIMA_ATUALIZACAO}</p>

        <div className="mt-10 space-y-10 font-sans-ed text-base leading-relaxed text-ink-2">
          <section>
            <h2 className="font-serif-ed text-xl text-ink">1. Aceitação</h2>
            <p className="mt-3">
              Ao criar uma conta ou usar o Jurídico IA, operado por [RAZÃO SOCIAL], CNPJ [CNPJ]
              (&ldquo;nós&rdquo;), você concorda com estes Termos de Uso e com a nossa{" "}
              <a href="/privacidade" className="underline hover:text-ink">
                Política de Privacidade
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">2. O que é o serviço</h2>
            <p className="mt-3">
              O Jurídico IA é uma plataforma de apoio à advocacia: assistente de IA com busca sobre legislação e
              jurisprudência, gestão de casos, prazos e documentos, e geração assistida de peças processuais.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">3. A IA erra — a responsabilidade profissional é sua</h2>
            <p className="mt-3">
              As respostas geradas pela IA, incluindo minutas de peças, pareceres e cálculos de prazo sugeridos, são
              apoio ao seu trabalho — <strong>nunca substituem a revisão e o julgamento profissional de um
              advogado habilitado</strong>. Você é integralmente responsável por conferir toda citação legal,
              jurisprudencial e prazo antes de usar em qualquer procedimento, e por qualquer consequência do uso
              sem essa conferência. Onde a plataforma sinaliza uma sugestão para aprovação (ex: criação de prazo
              a partir de intimação), a ação só é aplicada depois da sua aprovação explícita.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">4. Sua conta</h2>
            <p className="mt-3">
              Você é responsável por manter a confidencialidade das suas credenciais de acesso e por toda atividade
              realizada na sua conta. Avise-nos imediatamente em caso de uso não autorizado.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">5. Uso aceitável</h2>
            <p className="mt-3">
              Você concorda em não usar a plataforma para fins ilícitos, para violar direitos de terceiros, para
              tentar acessar dados de outro escritório, ou para sobrecarregar/comprometer a infraestrutura do
              serviço.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">6. Dados de clientes do escritório</h2>
            <p className="mt-3">
              Ao inserir dados de clientes seus na plataforma (fichas de caso, documentos), você declara ter base
              legal e, quando aplicável, autorização para esse tratamento, e permanece como controlador desses
              dados nos termos da nossa{" "}
              <a href="/privacidade" className="underline hover:text-ink">
                Política de Privacidade
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">7. Planos e cobrança</h2>
            <p className="mt-3">
              Planos pagos são cobrados de forma recorrente conforme o ciclo escolhido no momento da contratação.
              Cancelamentos podem ser feitos a qualquer momento pelo painel; o acesso ao plano pago permanece até
              o fim do período já pago.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">8. Disponibilidade do serviço</h2>
            <p className="mt-3">
              Nos esforçamos para manter o serviço disponível, mas não garantimos operação ininterrupta —
              manutenções, falhas de provedores terceiros (ex: provedores de IA) ou eventos fora do nosso controle
              podem causar indisponibilidade temporária.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">9. Alterações e encerramento</h2>
            <p className="mt-3">
              Podemos atualizar estes termos a qualquer momento, avisando com antecedência razoável mudanças
              relevantes. Você pode encerrar sua conta a qualquer momento; nós podemos suspender ou encerrar contas
              que violem estes termos.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">10. Foro</h2>
            <p className="mt-3">
              Fica eleito o foro da comarca de [CIDADE/UF] para dirimir controvérsias decorrentes destes termos,
              com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
