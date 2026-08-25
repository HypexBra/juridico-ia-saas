import { Reveal } from "./reveal";
import { Section } from "./section";

/* 13 · SEGURANÇA (spec v3 §6): a seção mais limpa da página — quatro
   afirmações em blocos de texto puros com hairline superior. Sem cadeados,
   sem ícones decorativos, sem cards: segurança aqui é sobriedade.
   O escopo das afirmações é exatamente o do produto (spec §7): RLS por
   escritório, permissões por equipe, auditoria de acesso e LGPD.
   Server Component puro. */

interface PilarSeguranca {
  readonly titulo: string;
  readonly descricao: string;
}

const PILARES: readonly PilarSeguranca[] = [
  {
    titulo: "Isolamento por escritório",
    descricao:
      "Row Level Security no banco: nenhuma consulta cruza a fronteira entre escritórios.",
  },
  {
    titulo: "Permissões por equipe",
    descricao: "Convites por e-mail e papéis definidos pelo titular.",
  },
  {
    titulo: "Auditoria de acesso",
    descricao: "Registros de quem acessou o quê.",
  },
  {
    titulo: "Controle dos dados",
    descricao: "Exportação e exclusão sob pedido, conforme LGPD.",
  },
] as const;

/** Passo da cascata entre os pilares (ms). */
const PASSO_CASCATA_MS = 70;

export function SecuritySection() {
  return (
    <Section
      numero="13"
      kicker="SEGURANÇA"
      titulo={
        <>
          Seus casos não são conteúdo para{" "}
          <em className="italic">treinar</em> um produto.
        </>
      }
      intro={
        <>Arquitetura multi-escritório com isolamento real no banco de dados.</>
      }
    >
      <div className="grid gap-x-16 gap-y-10 md:grid-cols-2">
        {PILARES.map((pilar, index) => (
          <Reveal
            key={pilar.titulo}
            delayMs={index * PASSO_CASCATA_MS}
            className="border-t border-ink/15 pt-6"
          >
            <h3 className="font-sans-ed text-base font-medium text-ink">
              {pilar.titulo}
            </h3>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
              {pilar.descricao}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
