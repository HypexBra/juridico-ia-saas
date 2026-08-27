import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { createClient } from "@/lib/supabase/server";
import type { StatusParcelaHonorario } from "@/lib/types";

const querySchema = z.object({
  periodo: z.enum(["mes", "todas"]).default("mes"),
});

type FichaMini = { nome_cliente: string | null; cliente: { cpf: string | null } | { cpf: string | null }[] | null };
type ContratoMini = { ficha_caso: FichaMini | FichaMini[] | null } | { ficha_caso: FichaMini | FichaMini[] | null }[] | null;

type ParcelaExportRow = {
  valor: number;
  vencimento: string;
  status: StatusParcelaHonorario;
  pago_em: string | null;
  contrato: ContratoMini;
};

const STATUS_LABEL: Record<StatusParcelaHonorario, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
};

/** Extrai o primeiro item de uma relação PostgREST que pode vir como objeto único ou array. */
function primeiroItem<T>(valor: T | T[] | null): T | null {
  if (valor === null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatarDataBr(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Formata número com vírgula decimal (padrão BR), sem separador de milhar (evita ambiguidade com o delimitador ";"). */
function formatarValorBr(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

/**
 * Escapa um campo para CSV: envolve em aspas duplas se contiver o delimitador,
 * aspas ou quebra de linha.
 *
 * Neutraliza tambem CSV/Formula Injection (CWE-1236): campos vindos de dado
 * de escritorio podem ter sido digitados por alguem nao confiavel (ex: nome
 * de cliente originado de um formulario publico de triagem) - se o campo
 * comecar com um caractere que Excel/Sheets interpretam como inicio de
 * formula (=, +, -, @, tab, CR), uma formula maliciosa rodaria ao abrir a
 * planilha. Prefixamos com um apostrofo (forca texto literal no Excel) ANTES
 * de aplicar o escaping normal de aspas/delimitador.
 */
function escaparCampoCsv(campo: string): string {
  const semFormula = /^[=+\-@\t\r]/.test(campo) ? `'${campo}` : campo;
  if (/[";\n\r]/.test(semFormula)) {
    return `"${semFormula.replace(/"/g, '""')}"`;
  }
  return semFormula;
}

function linhaCsv(campos: string[]): string {
  return campos.map(escaparCampoCsv).join(";");
}

/**
 * Exporta as parcelas de honorário do escritório em CSV (delimitador `;`,
 * decimal com vírgula) para consumo direto por contador em Excel/planilha
 * pt-BR. Route Handler (não Server Action) porque download de arquivo
 * precisa controlar `Content-Disposition`, que Server Actions não expõem.
 *
 * `periodo=mes` (padrão): só parcelas com vencimento no mês corrente.
 * `periodo=todas`: todo o histórico de parcelas do escritório (RLS já
 * restringe ao escritório do usuário autenticado).
 */
export async function GET(request: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const parsedQuery = querySchema.safeParse({
    periodo: request.nextUrl.searchParams.get("periodo") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Parâmetro de período inválido." }, { status: 400 });
  }
  const { periodo } = parsedQuery.data;

  const supabase = await createClient();

  let query = supabase
    .from("parcelas_honorario")
    .select(
      "valor, vencimento, status, pago_em, " +
        "contrato:contrato_id(ficha_caso:ficha_caso_id(nome_cliente, cliente:clientes(cpf)))",
    )
    .order("vencimento", { ascending: true });

  if (periodo === "mes") {
    const hoje = new Date();
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const inicioProximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));
    query = query
      .gte("vencimento", inicioMes.toISOString().slice(0, 10))
      .lt("vencimento", inicioProximoMes.toISOString().slice(0, 10));
  }

  const { data, error } = await query.returns<ParcelaExportRow[]>();

  if (error) {
    return NextResponse.json({ error: "Não foi possível gerar o export." }, { status: 500 });
  }

  const linhas: string[] = [linhaCsv(["Cliente", "CPF", "Valor", "Vencimento", "Status", "Data de pagamento"])];

  for (const parcela of data ?? []) {
    const contrato = primeiroItem(parcela.contrato);
    const ficha = primeiroItem(contrato?.ficha_caso ?? null);
    const cliente = primeiroItem(ficha?.cliente ?? null);

    linhas.push(
      linhaCsv([
        ficha?.nome_cliente ?? "Cliente sem nome",
        cliente?.cpf ?? "",
        formatarValorBr(parcela.valor),
        formatarDataBr(parcela.vencimento),
        STATUS_LABEL[parcela.status],
        formatarDataBr(parcela.pago_em),
      ]),
    );
  }

  // BOM UTF-8 no início: sem isso o Excel no Windows abre acentos (ç, ã, é)
  // corrompidos ao interpretar o arquivo como Latin-1 por padrão.
  const conteudoCsv = "﻿" + linhas.join("\r\n") + "\r\n";
  const sufixoArquivo = periodo === "mes" ? new Date().toISOString().slice(0, 7) : "completo";

  return new NextResponse(conteudoCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="parcelas-honorario-${sufixoArquivo}.csv"`,
    },
  });
}
