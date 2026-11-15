import { Link } from '@tanstack/react-router';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { CATEGORIA_LABEL, RISCO_LABEL, type FerramentaCatalogo } from '@/data/agentesFerramentas';
import type { RuntimeInfo } from '@/services/agentes';
import { ESTADO_SERVIDOR, RISCO_TONE, agentesQueUsam, noServidor } from '../regras';
import { Linhas, MetaPill, Secao, Vazio, useAgentesCompletos } from './comum';
import { EXEMPLOS_FERRAMENTA } from '../guia/conteudo';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha da ferramenta: permissão sugerida, cuidados, estado no servidor e quais agentes a usam. */
export function FerramentaFicha({ f, runtime, nav }: { f: FerramentaCatalogo; runtime?: RuntimeInfo; nav: Nav }) {
  const srv = noServidor(runtime?.ferramentas, f.id);
  const completos = useAgentesCompletos(true);
  const uso = agentesQueUsam(completos.data ?? [], f.id);

  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-wrench', label: `Ferramenta · ${CATEGORIA_LABEL[f.categoria]}` }} ariaLabel={`Ficha de ${f.nome}`}
      status={<>
        <Pill label={`Risco ${RISCO_LABEL[f.risco].toLowerCase()}`} tone={RISCO_TONE[f.risco]} icon="pi-shield" />
        {runtime && <MetaPill m={ESTADO_SERVIDOR[srv.estado]} />}
      </>}
      title={f.nome}
      subtitle={f.descricao}>

      <Secao titulo="Como ligar com segurança">
        <DetailFields items={[
          ['Permissão sugerida', f.permissaoSugerida === 'escrita' ? 'Escrita (altera o ambiente)' : 'Leitura'],
          ['Aprovação humana', f.aprovacaoSugerida ? 'Sim, a cada ação' : 'Não precisa'],
          ['Cuidados', f.cuidados],
        ]} />
      </Secao>

      {(EXEMPLOS_FERRAMENTA[f.id]?.length ?? 0) > 0 && (
        <Secao titulo="Como pedir (exemplos)">
          <ul className="ag-guia-exemplos">{EXEMPLOS_FERRAMENTA[f.id].map((x) => <li key={x}><q>{x}</q></li>)}</ul>
          <p className="agd-mudo iv-mt">Ligue a ferramenta no agente (editor, aba Ferramentas) e peça no playground. Pelo MCP, peça igual no Claude Code.</p>
        </Secao>
      )}

      <Secao titulo="No servidor">
        {!runtime ? <Vazio>API indisponível: não dá para saber se o servidor executa esta ferramenta.</Vazio>
          : srv.estado === 'so-projeto' ? (
            <Vazio>O servidor ainda não executa esta ferramenta. Dá para ligá-la no projeto do agente, mas no playground ela não roda.</Vazio>
          ) : (
            <>
              {srv.faltando.length > 0 && (
                <p className="agd-texto agd-falta">
                  <i className="pi pi-exclamation-triangle" aria-hidden="true" /> Vai falhar até você definir{' '}
                  {srv.faltando.map((v, i) => <span key={v}>{i > 0 && ' e '}<code className="mono">{v}</code></span>)}{' '}
                  no serviço da API e fazer redeploy.
                </p>
              )}
              <ul className="agd-lista iv-mt">
                {srv.reais.map((r) => (
                  <li key={r.nome} className="agd-item">
                    <i className={`pi ${r.permissao === 'escrita' ? 'pi-pencil' : 'pi-eye'} agd-item__icone`} aria-hidden="true" />
                    <span className="agd-item__corpo"><code className="mono">{r.nome}</code>{r.descricao && <small className="agd-mudo"> · {r.descricao}</small>}</span>
                    <Pill label={r.permissao === 'escrita' ? 'Escrita' : 'Leitura'} tone={r.permissao === 'escrita' ? 'info' : 'muted'} />
                  </li>
                ))}
              </ul>
            </>
          )}
      </Secao>

      <Secao titulo={`Agentes que usam${uso.length ? ` (${uso.length})` : ''}`}>
        {completos.isLoading ? <Linhas n={2} /> : completos.isError ? <Vazio>Não foi possível carregar os agentes.</Vazio>
          : uso.length === 0 ? <Vazio>Nenhum agente ligou esta ferramenta. Adicione na aba Ferramentas do editor.</Vazio> : (
            <ul className="agd-lista">
              {uso.map((u, i) => (
                <li key={`${u.agenteId}-${i}`} className="agd-item">
                  <i className="pi pi-sparkles agd-item__icone" aria-hidden="true" />
                  <span className="agd-item__corpo">
                    <Link to="/agents/agente/$agenteId" params={{ agenteId: u.agenteId }} className="agd-link">{u.agenteNome}</Link>
                  </span>
                  <span className="iv-row">
                    <Pill label={u.permissao === 'escrita' ? 'Escrita' : 'Leitura'} tone={u.permissao === 'escrita' ? 'info' : 'muted'} />
                    {u.permissao === 'escrita' && !u.exigeAprovacao && <Pill label="Sem aprovação" tone="danger" icon="pi-exclamation-circle" />}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Secao>
    </DetailDrawer>
  );
}
