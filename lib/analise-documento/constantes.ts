/**
 * Constante compartilhada entre server (actions/Server Components) e client
 * (`components/app/documento-lote-form.tsx`) do lote de análise de documento
 * avulso (feature Pro "analise_documento", ADR 0011, seção 7/8).
 *
 * Vive num módulo PRÓPRIO sem `import "server-only"` de propósito: embora o
 * restante da lógica de análise (`lib/analise-documento/analisar.ts`) seja
 * server-only (chama Gemini, extrai texto de PDF/DOCX), este valor puro
 * também precisa ser lido por um Client Component para renderizar a label do
 * input de arquivos e a mensagem de ajuda — reexportar a constante a partir
 * de um módulo com `import "server-only"` no topo quebraria o build (o
 * marcador `server-only` bloqueia QUALQUER import do módulo, mesmo de um
 * valor que não toca I/O nenhum, assim que o módulo é alcançado a partir de
 * um Client Component). `analisar.ts` importa e reexporta este valor para
 * quem já está em contexto server (actions/Server Components); o Client
 * Component importa direto daqui.
 */
export const MAX_ARQUIVOS_LOTE_DOCUMENTO = 15;
