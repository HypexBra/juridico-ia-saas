import "server-only";

/** Signatário informado no formulário de envio — ainda sem status (isso só existe depois de criado no provedor). */
export type SignatarioEnvio = {
  nome: string;
  email: string;
};

export type ResultadoEnvioAssinatura =
  | {
      ok: true;
      /** Id do documento na API do provedor externo — persistido em `id_externo_provedor`. */
      idExterno: string;
      /** Link de assinatura por e-mail do signatário, quando o provedor retorna (usado só para exibição/debug). */
      linksPorEmail: Record<string, string>;
    }
  | { ok: false; error: string };

export type EventoWebhookAssinatura = {
  /** Id do documento no provedor — usado para localizar a linha em `documentos_para_assinatura`. */
  idExterno: string;
  /** Novo status agregado do documento, se o evento permitir inferir (senão null = só atualiza o signatário). */
  novoStatusDocumento: "assinado" | "recusado" | null;
  /** Atualizações pontuais de status por e-mail de signatário (evento de assinatura individual). */
  signatariosAtualizados: Array<{ email: string; status: "assinado" | "recusado" }>;
};
