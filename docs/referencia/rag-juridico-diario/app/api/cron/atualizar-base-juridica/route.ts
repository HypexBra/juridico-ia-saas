// app/api/cron/atualizar-base-juridica/route.ts
// (Next.js App Router — ajuste o caminho/formato se o projeto usa Pages Router)
//
// Job diário: busca conteúdo novo em cada fonte, gera embedding e salva no banco.
// Disparado automaticamente pela Vercel Cron (ver vercel-cron-config.json).

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { sql } from "@vercel/postgres"; // troque pelo cliente de banco real do projeto
import { gerarEmbeddingsEmLote, quebrarEmChunks } from "@/lib/embeddings";
import { FONTES_JURIDICAS, DocumentoJuridico } from "@/lib/fontes-juridicas";

// Aumenta o tempo máximo de execução da função. Requer plano Pro da Vercel
// para ir além de 60s (Hobby trava em 10-60s dependendo da configuração).
// Se seu volume diário for muito grande mesmo com 300s, o próximo passo é
// separar isso em uma fila (ex: Vercel Queue, Inngest, Trigger.dev) em vez
// de um único request-response — sinalizado no README.
export const maxDuration = 300;

const TAMANHO_LOTE_EMBEDDING = 50; // chunks por chamada à API de embeddings

function gerarHashConteudo(texto: string): string {
  return createHash("sha256").update(texto.trim()).digest("hex");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado: Record<
    string,
    { novos: number; ignoradosPorDuplicidade: number; falhas: number; status: string }
  > = {};

  for (const fonte of FONTES_JURIDICAS) {
    let novos = 0;
    let ignoradosPorDuplicidade = 0;
    let falhas = 0;

    try {
      // Checkpoint com timestamp completo — não usa mais MAX(data_publicacao)
      // (que só tem granularidade de dia e poderia pular conteúdo publicado
      // entre duas execuções do mesmo dia).
      const cursor = await sql`
        SELECT ultima_busca_em FROM rag_fonte_cursor WHERE fonte = ${fonte.nome}
      `;
      const desde = cursor.rows[0]?.ultima_busca_em
        ? new Date(cursor.rows[0].ultima_busca_em)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // primeira execução: últimos 30 dias

      // Marca o início ANTES de buscar — o próximo "desde" será este
      // momento, garantindo que nada publicado durante o processamento
      // desta execução seja pulado na próxima.
      const inicioDestaExecucao = new Date();

      const documentosNovos = await fonte.buscar(desde);

      // Quebra todos os documentos da fonte em chunks de uma vez, já
      // calculando o hash de cada um — isso permite deduplicar E gerar
      // os embeddings em lote, em vez de um chunk por vez.
      const todosChunks: { doc: DocumentoJuridico; chunk: string; hash: string }[] = [];
      for (const doc of documentosNovos) {
        for (const chunk of quebrarEmChunks(doc.conteudo)) {
          todosChunks.push({ doc, chunk, hash: gerarHashConteudo(chunk) });
        }
      }

      if (todosChunks.length === 0) {
        await sql`
          INSERT INTO rag_fonte_cursor (fonte, ultima_busca_em)
          VALUES (${fonte.nome}, ${inicioDestaExecucao.toISOString()})
          ON CONFLICT (fonte) DO UPDATE SET ultima_busca_em = EXCLUDED.ultima_busca_em
        `;
        resultado[fonte.nome] = { novos: 0, ignoradosPorDuplicidade: 0, falhas: 0, status: "sucesso" };
        continue;
      }

      // Remove da lista o que já existe no banco (deduplicação por hash).
      const hashesExistentes = await sql`
        SELECT hash_conteudo FROM base_juridica
        WHERE hash_conteudo = ANY(${todosChunks.map((c) => c.hash)}::text[])
      `;
      const jaExistem = new Set(hashesExistentes.rows.map((r) => r.hash_conteudo));
      const chunksParaIndexar = todosChunks.filter((c) => !jaExistem.has(c.hash));
      ignoradosPorDuplicidade = todosChunks.length - chunksParaIndexar.length;

      // Gera embeddings em lotes (a API de embeddings aceita array de
      // textos numa única chamada) — muito mais rápido que um por vez,
      // e é o que evita estourar o tempo limite da função.
      for (let i = 0; i < chunksParaIndexar.length; i += TAMANHO_LOTE_EMBEDDING) {
        const lote = chunksParaIndexar.slice(i, i + TAMANHO_LOTE_EMBEDDING);

        let embeddings: number[][];
        try {
          embeddings = await gerarEmbeddingsEmLote(lote.map((c) => c.chunk));
        } catch (erroLote) {
          // Um lote inteiro falhou (ex: API fora do ar) — registra e segue
          // para o próximo lote em vez de derrubar a fonte inteira.
          falhas += lote.length;
          continue;
        }

        // Insere cada item do lote isoladamente: se UM insert falhar
        // (ex: dado malformado), os outros do mesmo lote não são perdidos.
        for (let j = 0; j < lote.length; j++) {
          const { doc, chunk, hash } = lote[j];
          const embedding = embeddings[j];
          try {
            const insercao = await sql`
              INSERT INTO base_juridica
                (fonte, tipo, titulo, conteudo, hash_conteudo, url_original,
                 tribunal_vara, relator, data_publicacao, embedding)
              VALUES
                (${doc.fonte}, ${doc.tipo}, ${doc.titulo}, ${chunk}, ${hash}, ${doc.urlOriginal},
                 ${doc.tribunalVara ?? null}, ${doc.relator ?? null}, ${doc.dataPublicacao},
                 ${JSON.stringify(embedding)}::vector)
              ON CONFLICT (hash_conteudo) DO NOTHING
            `;
            // ON CONFLICT DO NOTHING não lança erro quando a linha já existe —
            // ele só não insere nada. Sem checar rowCount, esse caso seria
            // contado como "novo" por engano (ex: hash duplicado dentro do
            // próprio lote, que o pré-filtro contra o banco não pega).
            if (insercao.rowCount && insercao.rowCount > 0) {
              novos++;
            } else {
              ignoradosPorDuplicidade++;
            }
          } catch (erroInsert) {
            falhas++;
          }
        }
      }

      // Só avança o checkpoint se a fonte foi processada até o fim sem
      // exceção não tratada — assim, se algo quebrar no meio, a próxima
      // execução tenta essa mesma janela de novo em vez de pular conteúdo.
      await sql`
        INSERT INTO rag_fonte_cursor (fonte, ultima_busca_em)
        VALUES (${fonte.nome}, ${inicioDestaExecucao.toISOString()})
        ON CONFLICT (fonte) DO UPDATE SET ultima_busca_em = EXCLUDED.ultima_busca_em
      `;

      await sql`
        INSERT INTO rag_execucao_log (fonte, status, documentos_novos)
        VALUES (${fonte.nome}, ${falhas > 0 ? "sucesso_parcial" : "sucesso"}, ${novos})
      `;

      resultado[fonte.nome] = {
        novos,
        ignoradosPorDuplicidade,
        falhas,
        status: falhas > 0 ? "sucesso_parcial" : "sucesso",
      };
    } catch (erro: any) {
      await sql`
        INSERT INTO rag_execucao_log (fonte, status, mensagem_erro)
        VALUES (${fonte.nome}, 'erro', ${erro.message ?? String(erro)})
      `;
      resultado[fonte.nome] = { novos, ignoradosPorDuplicidade, falhas, status: "erro" };

      // Critério de aceite do P0.4: alertar o time quando uma fonte falha
      // por completo. Plugar no canal real (e-mail, Slack, etc.).
      // Exemplo: await notificarFalhaRAG(fonte.nome, erro);
    }
  }

  return NextResponse.json({ executadoEm: new Date().toISOString(), resultado });
}
