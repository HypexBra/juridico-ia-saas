import type { Metadata } from "next";
import { LegalPageShell } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade — Jurídico IA",
  description:
    "Como o Jurídico IA trata dados pessoais: isolamento por escritório via RLS, uso de IA (Google Gemini) para análise de casos e seus direitos sob a LGPD.",
  alternates: {
    canonical: "/politica-de-privacidade",
  },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPageShell
      kicker="Legal · Documento 2 de 3"
      titulo="Política de Privacidade"
      atualizadoEm="1 de setembro de 2026"
    >
      <h2>1. Quem trata os seus dados</h2>
      <p>
        O Jurídico IA está em fase inicial (early-stage) e ainda não possui
        pessoa jurídica constituída (CNPJ/razão social). O tratamento de dados
        descrito nesta política é feito diretamente pelo desenvolvedor
        responsável pelo produto, identificado pelo canal de contato oficial:{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>
        . Assim que houver uma pessoa jurídica formal, esta política será
        atualizada com os dados correspondentes.
      </p>

      <h2>2. Quais dados são coletados</h2>
      <ul>
        <li>Dados de cadastro: nome, e-mail e senha (armazenada com hash).</li>
        <li>
          Dados do escritório: casos, clientes, prazos, tarefas, documentos e
          mensagens de chat inseridos por você e sua equipe na plataforma.
        </li>
        <li>
          Dados de uso técnico: registros de acesso e ações realizadas na
          conta, usados para auditoria de segurança (ver seção 5).
        </li>
      </ul>

      <h2>3. Para que os dados são usados</h2>
      <p>
        Os dados são usados para operar o produto: exibir seus casos,
        localizar prazos publicados no diário oficial, gerar tarefas
        automáticas, permitir o chat jurídico com contexto do caso e habilitar
        o portal do cliente. Nenhum dado do seu escritório é compartilhado com
        outros escritórios cadastrados na plataforma.
      </p>

      <h2>4. Uso de inteligência artificial (Google Gemini)</h2>
      <p>
        O Jurídico IA usa o Google Gemini como fornecedor de inteligência
        artificial para processar o conteúdo de documentos, mensagens de chat
        e demais textos que você insere no sistema, com o objetivo de gerar
        análises, respostas e minutas.
      </p>
      <p>
        Os dados dos seus casos <strong className="font-medium text-ink">não são usados para treinar
        modelos de IA</strong> — nem os do Jurídico IA, nem os de terceiros.
      </p>

      <h2>5. Isolamento e segurança dos dados</h2>
      <ul>
        <li>
          Cada escritório opera em um ambiente logicamente isolado no banco de
          dados, com Row Level Security (RLS): nenhuma consulta do sistema
          consegue cruzar a fronteira entre escritórios diferentes.
        </li>
        <li>
          Permissões de acesso dentro do escritório são definidas por papéis,
          atribuídos pelo titular da conta.
        </li>
        <li>
          Ações relevantes ficam registradas em um log de auditoria de acesso,
          consultável pelo titular do escritório.
        </li>
      </ul>

      <h2>6. Seus direitos (LGPD)</h2>
      <p>
        Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você
        pode solicitar a qualquer momento:
      </p>
      <ul>
        <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
        <li>Exportação dos dados do seu escritório;</li>
        <li>
          Correção de dados incompletos, inexatos ou desatualizados;
        </li>
        <li>
          Exclusão dos seus dados e da sua conta, sob pedido (ver{" "}
          <a href="/exclusao-de-dados">página de exclusão de dados</a>);
        </li>
        <li>Revogação do consentimento, quando aplicável.</li>
      </ul>
      <p>
        Para exercer qualquer um desses direitos, envie um e-mail para{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>
        . O prazo de resposta é de até 1 dia útil para a confirmação do
        recebimento do pedido.
      </p>

      <h2>7. Compartilhamento com terceiros</h2>
      <p>
        Os dados são compartilhados apenas com os provedores estritamente
        necessários para operar o serviço (por exemplo, infraestrutura de
        banco de dados e o provedor de IA mencionado na seção 4), e apenas na
        medida necessária para prestar a funcionalidade correspondente. O
        Jurídico IA não vende dados pessoais a terceiros.
      </p>

      <h2>8. Retenção de dados</h2>
      <p>
        Os dados do seu escritório são mantidos enquanto a conta estiver
        ativa. Após um pedido de exclusão, os dados são apagados conforme
        descrito na <a href="/exclusao-de-dados">página de exclusão de dados</a>.
      </p>

      <h2>9. Alterações desta política</h2>
      <p>
        Esta política pode ser atualizada conforme o produto evolui. A data de
        &ldquo;última atualização&rdquo; no topo desta página reflete a versão mais
        recente.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos
        seus dados podem ser enviadas para{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>{" "}
        ou pelo WhatsApp <a href="https://wa.me/5561981399051">+55 (61) 98139-9051</a>.
      </p>
    </LegalPageShell>
  );
}
