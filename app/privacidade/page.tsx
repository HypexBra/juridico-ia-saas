import type { Metadata } from "next";
import { Nav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Política de Privacidade e Cookies — Jurídico IA",
  description:
    "Como o Jurídico IA coleta, usa, compartilha e protege dados pessoais, e quais cookies/tecnologias similares o site utiliza — em conformidade com a LGPD (Lei nº 13.709/2018).",
};

/**
 * ATENÇÃO — preencher antes de publicar:
 *  - [RAZÃO SOCIAL], [CNPJ], [ENDEREÇO]: dados do controlador (empresa por
 *    trás do produto).
 *  - [E-MAIL DO ENCARREGADO]: contato do encarregado de dados (DPO) exigido
 *    pelo art. 41 da LGPD — pode ser o mesmo e-mail de suporte no início.
 * O conteúdo abaixo descreve o tratamento de dados REAL da plataforma tal
 * como implementado no código nesta data — qualquer integração nova
 * (provider de IA, meio de pagamento, canal de notificação) precisa
 * atualizar esta página junto, não depois.
 */
const ULTIMA_ATUALIZACAO = "31 de agosto de 2026";

export default function PoliticaPrivacidadePage() {
  return (
    <main className="bg-paper">
      <Nav />
      <div className="mx-auto max-w-3xl px-5 py-20 md:px-10 md:py-28">
        <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">Legal</p>
        <h1 className="mt-4 font-serif-ed text-3xl leading-[1.05] tracking-tight text-ink md:text-4xl">
          Política de Privacidade e Cookies
        </h1>
        <p className="mt-3 font-sans-ed text-sm text-ink-3">Última atualização: {ULTIMA_ATUALIZACAO}</p>

        <div className="mt-10 space-y-10 font-sans-ed text-base leading-relaxed text-ink-2">
          <section>
            <h2 className="font-serif-ed text-xl text-ink">1. Quem somos (controlador dos dados)</h2>
            <p className="mt-3">
              O Jurídico IA é operado por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO] (&ldquo;nós&rdquo;).
              Esta política explica como tratamos dados pessoais de visitantes do site, de advogados e equipes que
              usam a plataforma (&ldquo;usuários&rdquo;) e, indiretamente, de clientes dos escritórios que a
              utilizam — em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018,
              &ldquo;LGPD&rdquo;).
            </p>
            <p className="mt-3">
              Dúvidas sobre esta política ou sobre seus dados: [E-MAIL DO ENCARREGADO].
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">2. Quais dados coletamos</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Cadastro:</strong> nome, e-mail, número de OAB (quando informado) e dados do escritório
                (nome, plano contratado).
              </li>
              <li>
                <strong>Uso da plataforma:</strong> conversas com o assistente de IA, documentos enviados para a
                base de conhecimento, fichas de caso, prazos e modelos de peça que você cadastra.
              </li>
              <li>
                <strong>Dados processados em nome do escritório:</strong> quando você usa a plataforma para gerir
                casos de clientes, pode inserir dados desses clientes (nome, CPF, processo). Nesse caso, o
                escritório é o controlador desses dados e nós atuamos como operador, nos termos do art. 5º, VII da
                LGPD.
              </li>
              <li>
                <strong>Dados de uso técnico:</strong> IP, navegador e páginas acessadas, coletados de forma
                agregada e anônima pelo Vercel Web Analytics (ver seção 5 — não usa cookies nem identifica
                indivíduos).
              </li>
              <li>
                <strong>Dados de pagamento:</strong> processados diretamente pelo Stripe — não armazenamos número
                de cartão de crédito em nossos servidores.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">3. Cookies e tecnologias similares</h2>
            <p className="mt-3">Usamos três categorias de cookies/armazenamento local:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Estritamente necessários (sempre ativos):</strong> cookies de sessão de autenticação
                (Supabase Auth) que mantêm você conectado depois do login. Sem eles, a plataforma não funciona —
                por isso não pedimos consentimento para esses, conforme permite o art. 7º, IX combinado com a
                natureza de execução de contrato do tratamento.
              </li>
              <li>
                <strong>Preferências locais:</strong> algumas escolhas de interface (ex: tema claro/escuro, se você
                já viu o aviso de cookies) são salvas no `localStorage` do seu navegador — nunca saem do seu
                dispositivo, nunca são lidas por nós.
              </li>
              <li>
                <strong>Analytics:</strong> Vercel Web Analytics, que é <em>cookieless</em> por padrão — não grava
                identificador nenhum no seu navegador e não permite reconstruir sua navegação individual, apenas
                contagens agregadas de página vista.
              </li>
            </ul>
            <p className="mt-3">
              Não usamos cookies de publicidade nem de rastreamento entre sites. Se isso mudar no futuro, esta
              política e o aviso de cookies do site serão atualizados antes da mudança entrar em vigor.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">4. Para que usamos seus dados</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Fornecer o serviço contratado (execução de contrato, art. 7º, V).</li>
              <li>Gerar respostas de IA a partir das suas perguntas e dos documentos que você indexa.</li>
              <li>Enviar lembretes de prazo por WhatsApp, quando você habilita esse canal.</li>
              <li>Processar cobrança e gerenciar sua assinatura.</li>
              <li>Cumprir obrigação legal ou regulatória, quando aplicável.</li>
              <li>Melhorar a plataforma com métricas agregadas e anônimas de uso.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">5. Com quem compartilhamos dados</h2>
            <p className="mt-3">
              Não vendemos dados pessoais. Compartilhamos o mínimo necessário com prestadores de serviço que
              processam dados em nosso nome, sob contrato:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Google (Gemini)</strong> e <strong>Groq</strong>: geram as respostas de IA — recebem o
                texto da sua pergunta e o contexto recuperado da sua base de conhecimento.
              </li>
              <li>
                <strong>Jina AI</strong> (somente se o escritório ativar o reranker de busca — recurso opcional):
                recebe o texto dos trechos recuperados para refinar a ordem de relevância antes da resposta.
              </li>
              <li>
                <strong>Supabase</strong>: hospeda o banco de dados e a autenticação da plataforma.
              </li>
              <li>
                <strong>Vercel</strong>: hospeda a aplicação web.
              </li>
              <li>
                <strong>Stripe</strong>: processa pagamentos e assinaturas.
              </li>
              <li>
                <strong>Meta (WhatsApp Business Cloud API)</strong>: envia lembretes de prazo, somente para os
                números que você cadastra e somente se o canal estiver habilitado pelo seu escritório.
              </li>
            </ul>
            <p className="mt-3">
              Todos esses prestadores têm acesso restrito ao necessário para prestar o serviço contratado e estão
              sujeitos a obrigações contratuais de confidencialidade e segurança.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">6. Segurança</h2>
            <p className="mt-3">
              Dados de cada escritório são isolados por controle de acesso em nível de linha no banco de dados
              (Row Level Security) — um escritório nunca acessa dados de outro. Toda comunicação é criptografada em
              trânsito (HTTPS/TLS). Senhas nunca são armazenadas em texto plano.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">7. Retenção e exclusão</h2>
            <p className="mt-3">
              Mantemos seus dados enquanto sua conta estiver ativa e pelo período adicional necessário para cumprir
              obrigação legal (ex: dados fiscais). Você pode solicitar a exclusão da sua conta e dos dados
              associados a qualquer momento pelo contato da seção 1 — atendemos no prazo legal aplicável.
            </p>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">8. Seus direitos (art. 18 da LGPD)</h2>
            <p className="mt-3">Você pode, a qualquer momento e mediante solicitação:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Confirmar a existência de tratamento e acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
              <li>Solicitar portabilidade dos dados a outro fornecedor;</li>
              <li>Revogar consentimento, quando o tratamento se basear nele;</li>
              <li>Obter informação sobre com quem compartilhamos seus dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif-ed text-xl text-ink">9. Alterações desta política</h2>
            <p className="mt-3">
              Podemos atualizar esta política para refletir mudanças no produto ou na legislação. Mudanças
              relevantes serão comunicadas por e-mail ou aviso na plataforma antes de entrarem em vigor.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
