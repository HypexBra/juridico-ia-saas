import type { Metadata } from "next";
import { LegalPageShell } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso — Jurídico IA",
  description:
    "Condições de uso do Jurídico IA: cadastro, responsabilidade sobre a revisão jurídica das peças geradas, planos, cancelamento e canal de contato oficial.",
  alternates: {
    canonical: "/termos-de-uso",
  },
};

export default function TermosDeUsoPage() {
  return (
    <LegalPageShell
      kicker="Legal · Documento 1 de 3"
      titulo="Termos de Uso"
      atualizadoEm="1 de setembro de 2026"
    >
      <h2>1. Sobre este documento</h2>
      <p>
        Estes Termos de Uso regem o acesso e o uso do Jurídico IA, um serviço de
        software oferecido em fase inicial (early-stage). O Jurídico IA ainda não
        possui pessoa jurídica constituída (CNPJ/razão social); o serviço é
        operado diretamente pelo desenvolvedor responsável, identificado apenas
        pelo canal de contato oficial abaixo. Assim que houver uma pessoa
        jurídica formal, este documento será atualizado com os dados
        correspondentes.
      </p>
      <p>
        Contato oficial: <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>.
      </p>

      <h2>2. O que é o Jurídico IA</h2>
      <p>
        O Jurídico IA é um software de apoio à advocacia: organiza casos,
        clientes, prazos, tarefas e documentos, e usa inteligência artificial
        (Google Gemini, ver seção 5) para auxiliar em análise de documentos,
        pesquisa jurisprudencial, geração de minutas e automações do dia a dia
        de um escritório.
      </p>

      <h2>3. Cadastro e conta</h2>
      <p>
        Para usar o Jurídico IA é necessário criar uma conta com um e-mail
        válido. Você é responsável por manter a confidencialidade das suas
        credenciais de acesso e por toda atividade realizada na sua conta.
        Cada escritório cadastrado opera em um ambiente isolado dos demais
        (ver Política de Privacidade, seção sobre isolamento de dados).
      </p>

      <h2>4. Responsabilidade sobre o conteúdo jurídico</h2>
      <ul>
        <li>
          O Jurídico IA é uma ferramenta auxiliar. Ele não presta serviços
          advocatícios nem substitui o julgamento profissional do advogado.
        </li>
        <li>
          Peças, minutas, análises e pesquisas geradas pelo sistema são
          sugestões que exigem revisão, conferência e responsabilidade final
          do advogado que as utiliza, exatamente como aconteceria com o
          trabalho de qualquer associado ou estagiário.
        </li>
        <li>
          O sistema é instruído a não inventar leis, súmulas ou precedentes,
          mas nenhuma ferramenta de IA é infalível: é dever do usuário
          conferir toda fonte citada antes de usá-la em uma peça protocolada.
        </li>
      </ul>

      <h2>5. Uso de inteligência artificial</h2>
      <p>
        O Jurídico IA utiliza o modelo de linguagem Google Gemini como
        fornecedor de inteligência artificial para processar o conteúdo dos
        casos (documentos, mensagens de chat e demais textos inseridos na
        plataforma) e gerar as respostas, análises e minutas do produto.
      </p>

      <h2>6. Planos e cobrança</h2>
      <p>
        O Jurídico IA oferece um plano gratuito com uso limitado de IA e um
        plano pago (Pro), cobrado mensalmente via Stripe, sem fidelidade: o
        cancelamento pode ser feito a qualquer momento diretamente no perfil
        da conta, e produz efeito ao final do período já pago.
      </p>

      <h2>7. Uso razoável do plano Pro</h2>
      <p>
        O plano Pro é oferecido sem limite de <strong>mensagens</strong> de IA,
        para cobrir o uso profissional normal de um escritório de advocacia
        (análise de documentos, pesquisa jurisprudencial, geração de minutas
        e demais funcionalidades de IA da plataforma). Essa oferta está
        sujeita a uma política de uso razoável: o processamento de IA deve
        ser compatível com o volume e o padrão de uso de um escritório real,
        não com finalidades alheias ao propósito do produto (por exemplo,
        revenda de acesso, uso automatizado em massa desvinculado da
        atividade jurídica do escritório, ou qualquer uso que sobrecarregue
        desproporcionalmente a infraestrutura do serviço).
      </p>
      <p>
        Em caso de uso muito acima da média de um escritório Pro, o Jurídico
        IA se reserva o direito de entrar em contato com o titular da conta
        para entender o caso, e, se necessário, ajustar condições comerciais
        específicas ou revisar as condições do plano aplicáveis àquela conta.
        Nenhuma dessas medidas é aplicada de forma automática nem interrompe
        o acesso do escritório sem contato prévio: o objetivo desta cláusula
        é preservar a qualidade do serviço para todos os clientes, não
        restringir o uso profissional normal do plano Pro.
      </p>

      <h2>8. Disponibilidade e limitações</h2>
      <p>
        Por ser um serviço em fase inicial, o Jurídico IA pode passar por
        instabilidades, manutenções e mudanças de funcionalidade sem aviso
        prévio extenso. Esforços razoáveis são feitos para preservar a
        integridade dos dados dos usuários em qualquer circunstância.
      </p>

      <h2>9. Alterações destes termos</h2>
      <p>
        Estes termos podem ser atualizados conforme o produto evolui. A data
        de &ldquo;última atualização&rdquo; no topo desta página reflete a versão mais
        recente. Alterações relevantes serão comunicadas pelo canal de
        contato oficial sempre que razoavelmente possível.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre estes Termos de Uso podem ser enviadas para{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>{" "}
        ou pelo WhatsApp <a href="https://wa.me/5561981399051">+55 (61) 98139-9051</a>.
      </p>
    </LegalPageShell>
  );
}
