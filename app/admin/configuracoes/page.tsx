import { buscarConfiguracoesPlataforma } from "@/lib/admin/configuracoes";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfiguracaoToggle } from "@/components/admin/configuracao-toggle";
import { LIMITE_MENSAGENS_FREE } from "@/lib/types";

export const metadata = { title: "Configurações — Admin" };

/**
 * Só configurações com efeito REAL no backend (seção 13 do pedido — nunca
 * preenche a tela com toggle decorativo). `modo_manutencao` bloqueia novos
 * logins de quem não é admin da plataforma (app/login/actions.ts);
 * `novos_cadastros_habilitados` bloqueia o signup (app/cadastro/actions.ts).
 * O limite de mensagens do plano free ainda é uma constante em código
 * (usada em 4 pontos diferentes do app) — mostrado aqui só como informação,
 * tornar editável é um passo futuro que exige revisar cada um desses pontos.
 */
export default async function AdminConfiguracoesPage() {
  const config = await buscarConfiguracoesPlataforma();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ice">Configurações da plataforma</h1>
        <p className="mt-1 text-sm text-muted">Últimas alterações aplicadas: {new Date(config.atualizadoEm).toLocaleString("pt-BR")}.</p>
      </div>

      <Card>
        <CardTitle className="mb-1">Acesso</CardTitle>
        <div className="divide-y divide-ink/10">
          <ConfiguracaoToggle
            campo="modo_manutencao"
            valorInicial={config.modoManutencao}
            label="Modo manutenção"
            descricao="Bloqueia novos logins de quem não é administrador da plataforma. Sessões já ativas não são encerradas."
            confirmarAoAtivar="Ativar modo manutenção? Usuários comuns não conseguirão mais fazer login até você desativar."
          />
          <ConfiguracaoToggle
            campo="novos_cadastros_habilitados"
            valorInicial={config.novosCadastrosHabilitados}
            label="Novos cadastros"
            descricao="Quando desligado, a tela de cadastro passa a rejeitar novas contas."
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-1">Limites da IA (informativo)</CardTitle>
        <p className="text-sm text-muted">
          Plano Free: <span className="text-ice">{LIMITE_MENSAGENS_FREE} mensagens/mês</span> de IA por escritório.
          Ainda não editável por aqui — valor fixo em <code className="text-xs">lib/types.ts</code>.
        </p>
      </Card>
    </div>
  );
}
