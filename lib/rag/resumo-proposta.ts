import "server-only";

import type { NomeTool } from "./tools";

/** Descrição humana e determinística da proposta — nunca depende do texto livre do modelo. */
export function montarResumoProposta(nomeTool: NomeTool, args: Record<string, unknown>): string {
  switch (nomeTool) {
    case "propose_update_prazo": {
      const mudancas = args.mudancas as Record<string, unknown>;
      const campos = Object.entries(mudancas)
        .map(([campo, valor]) => `${campo}: "${valor}"`)
        .join(", ");
      return `Atualizar prazo (${campos}). Motivo: ${args.motivo}`;
    }
    case "propose_update_ficha": {
      const mudancas = args.mudancas as Record<string, unknown>;
      const campos = Object.entries(mudancas)
        .map(([campo, valor]) => `${campo}: "${valor}"`)
        .join(", ");
      return `Atualizar ficha de caso (${campos}). Motivo: ${args.motivo}`;
    }
    case "propose_create_prazo": {
      const dados = args.dados as Record<string, unknown>;
      return `Criar novo prazo "${dados.titulo}" para ${dados.data_prazo}${dados.cliente_nome ? ` (cliente: ${dados.cliente_nome})` : ""}. Motivo: ${args.motivo}`;
    }
    case "propose_create_ficha": {
      const dados = args.dados as Record<string, unknown>;
      return `Criar nova ficha de caso${dados.nome_cliente ? ` para ${dados.nome_cliente}` : ""}${dados.area_direito ? ` (${dados.area_direito})` : ""}. Motivo: ${args.motivo}`;
    }
    case "propose_generate_document": {
      return `Gerar documento "${args.titulo}" (${args.tipo_documento}) em formato ${args.formato ?? "docx"}.`;
    }
    default:
      return "Ação proposta pelo copiloto.";
  }
}
