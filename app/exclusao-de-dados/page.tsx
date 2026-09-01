import type { Metadata } from "next";
import { LegalPageShell } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Exclusão de Dados — Jurídico IA",
  description:
    "Como solicitar a exportação ou exclusão definitiva dos dados do seu escritório no Jurídico IA, conforme a LGPD.",
  alternates: {
    canonical: "/exclusao-de-dados",
  },
};

export default function ExclusaoDeDadosPage() {
  return (
    <LegalPageShell
      kicker="Legal · Documento 3 de 3"
      titulo="Exclusão de dados"
      atualizadoEm="1 de setembro de 2026"
    >
      <h2>1. Seu direito de exclusão</h2>
      <p>
        Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode
        solicitar a exclusão definitiva da sua conta e de todos os dados do
        seu escritório no Jurídico IA a qualquer momento, sem necessidade de
        justificativa.
      </p>

      <h2>2. Como solicitar</h2>
      <p>
        Envie um e-mail para{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados">
          pedrohenriquesanchesleal4@gmail.com
        </a>{" "}
        com o assunto &ldquo;Solicitação de exclusão de dados&rdquo;, a partir do e-mail
        cadastrado na sua conta, informando o nome do escritório. Se preferir,
        pode iniciar o pedido pelo WhatsApp{" "}
        <a href="https://wa.me/5561981399051">+55 (61) 98139-9051</a> — a
        confirmação final é sempre feita por e-mail, para garantir que o
        pedido parte do titular da conta.
      </p>

      <h2>3. Exportação antes da exclusão</h2>
      <p>
        Se quiser uma cópia dos dados do seu escritório antes de excluí-los
        (casos, clientes, prazos, tarefas e documentos), informe isso no mesmo
        pedido. A exportação é enviada antes da exclusão ser efetivada.
      </p>

      <h2>4. O que é excluído</h2>
      <ul>
        <li>
          Todos os dados do escritório: casos, fichas de clientes, prazos,
          tarefas, documentos enviados e gerados, mensagens de chat e
          histórico de atividade.
        </li>
        <li>Credenciais de acesso da conta (login e senha).</li>
        <li>
          Registros de auditoria de acesso vinculados ao escritório, exceto
          quando sua manutenção temporária for exigida por obrigação legal.
        </li>
      </ul>

      <h2>5. Prazo</h2>
      <p>
        A confirmação do recebimento do pedido é enviada em até 1 dia útil. A
        exclusão efetiva dos dados é realizada em seguida, após a confirmação
        de identidade do titular da conta.
      </p>

      <h2>6. Isolamento até a exclusão</h2>
      <p>
        Enquanto sua conta permanece ativa, os dados do seu escritório ficam
        isolados dos demais escritórios cadastrados na plataforma (Row Level
        Security no banco de dados), como descrito na{" "}
        <a href="/privacidade">Política de Privacidade</a>.
      </p>

      <h2>7. Contato</h2>
      <p>
        Qualquer dúvida sobre este processo pode ser enviada para{" "}
        <a href="mailto:pedrohenriquesanchesleal4@gmail.com">
          pedrohenriquesanchesleal4@gmail.com
        </a>
        .
      </p>
    </LegalPageShell>
  );
}
