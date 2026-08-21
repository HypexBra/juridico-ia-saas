import { listarChavesIa } from "@/lib/ia/chaves/gestao-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { CriarChaveIaForm, ChaveIaLinha } from "@/components/admin/ia-chave-form-e-linhas";

export const metadata = { title: "Chaves de IA — Admin" };

/**
 * Gestão do pool interno de chaves de API dos provedores de LLM (Gemini/
 * Groq) — substitui as antigas env vars fixas `GEMINI_API_KEY`/
 * `GROQ_API_KEY` por N chaves rotacionadas via `ia_provider_chaves` (ver
 * migration 0032). Lê exclusivamente a view `ia_provider_chaves_admin`
 * (lib/ia/chaves/gestao-actions.ts#listarChavesIa) — nunca vê
 * `chave_cifrada`, só a prévia mascarada em `chave_preview`.
 */
export default async function AdminIaChavesPage() {
  const chaves = await listarChavesIa();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Chaves de provedores de IA</h1>
        <p className="mt-1 text-sm text-muted">
          Pool interno de chaves usadas pela plataforma para chamar Gemini/Groq. Cadastre quantas quiser por provedor
          — a seleção roda em round-robin pela menos usada, respeitando o limite de rpm de cada uma.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Cadastrar nova chave</CardTitle>
        <CriarChaveIaForm />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="pb-3 pr-3 font-medium">Provedor</th>
              <th className="pb-3 pr-3 font-medium">Nome</th>
              <th className="pb-3 pr-3 font-medium">Prévia</th>
              <th className="pb-3 pr-3 font-medium">RPM limite</th>
              <th className="pb-3 pr-3 font-medium">Uso na janela</th>
              <th className="pb-3 pr-3 font-medium">Status</th>
              <th className="pb-3 pr-3 font-medium">Último uso</th>
              <th className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {chaves.map((chave) => (
              <ChaveIaLinha key={chave.id} chave={chave} />
            ))}
          </tbody>
        </table>
        {chaves.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            Nenhuma chave cadastrada ainda — enquanto isso, o app usa `GEMINI_API_KEY`/`GROQ_API_KEY` do ambiente
            como transição.
          </p>
        )}
      </Card>
    </div>
  );
}
