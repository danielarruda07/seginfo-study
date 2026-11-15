import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { getRuntime, listAgentes, listAuditoria } from '@/services/agentes';
import { listIntegracoes } from '@/services/integracoes';
import { Linhas, Secao, Vazio } from '../ficha/comum';
import { GUIAS, TELAS, type TelaAgents } from './conteudo';
import { sugestoesDeMelhoria, type NivelFerramenta } from './aprendizado';
import '@/styles/telas/agents.css';

/**
 * Guia discreto de cada tela de Agents: uma barra de uma linha logo abaixo do título que abre uma
 * ficha com para que serve, passo a passo, o que já funciona no servidor, exemplos e sugestões de
 * melhoria tiradas da auditoria e das avaliações.
 */
export function GuiaDaTela({ tela, agenteId }: { tela: TelaAgents; agenteId?: string }) {
  const [aberto, setAberto] = useState(false);
  const g = GUIAS[tela];

  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime, staleTime: 60_000 });
  const integracoes = useQuery({ queryKey: ['integracoes'], queryFn: listIntegracoes, staleTime: 60_000, enabled: !!g.mostrarServidor });
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes, staleTime: 60_000 });
  const auditoria = useQuery({ queryKey: ['agentes-guia-auditoria'], queryFn: () => listAuditoria({ limite: 500 }), staleTime: 120_000 });

  const sugestoes = useMemo(() => {
    if (!agentes.data || !auditoria.data) return [];
    const niveis: Record<string, NivelFerramenta | undefined> = {};
    for (const f of runtime.data?.ferramentas ?? []) niveis[f.nome] = f.nivel;
    return sugestoesDeMelhoria({ acoes: auditoria.data.acoes, agentes: agentes.data, niveis, agenteId });
  }, [agentes.data, auditoria.data, runtime.data, agenteId]);

  const integ = integracoes.data ?? [];
  const prontas = integ.filter((i) => i.configurada).length;

  return (
    <>
      <button type="button" className="ac-barra ag-guia-barra" onClick={() => setAberto(true)} aria-haspopup="dialog">
        <span className="ac-barra__titulo"><i className="pi pi-compass" aria-hidden="true" /> Como usar</span>
        <span className="ac-barra__item ag-guia-barra__resumo">{g.resumo}</span>
        {g.mostrarServidor && integracoes.isSuccess && (
          <span className="ac-barra__item ac-barra__item--opcional">
            <i className="pi pi-server" aria-hidden="true" /> {prontas}/{integ.length} integrações prontas
          </span>
        )}
        {sugestoes.length > 0 && (
          <span className="ac-barra__item">
            <i className="pi pi-lightbulb" aria-hidden="true" /> {sugestoes.length} sugest{sugestoes.length === 1 ? 'ão' : 'ões'}
          </span>
        )}
        <span className="ac-barra__ver">Abrir o guia <i className="pi pi-angle-right" aria-hidden="true" /></span>
      </button>

      {aberto && (
        <DetailDrawer onClose={() => setAberto(false)} wide kind={{ icon: 'pi-compass', label: 'Guia de uso' }}
          ariaLabel={`Guia de uso: ${g.titulo}`} title={g.titulo} subtitle={g.resumo}>

          <Secao titulo="Para que serve">
            <p className="agd-texto">{g.paraQueServe}</p>
          </Secao>

          <Secao titulo="Como usar">
            <ol className="ag-guia-passos">{g.passos.map((p) => <li key={p}>{p}</li>)}</ol>
          </Secao>

          {g.capacidades?.map((c) => (
            <Secao key={c.titulo} titulo={c.titulo}>
              <ul className="ag-guia-lista">{c.itens.map((i) => <li key={i}>{i}</li>)}</ul>
            </Secao>
          ))}

          {g.exemplos && (
            <Secao titulo="Exemplos para copiar e adaptar">
              <ul className="ag-guia-exemplos">{g.exemplos.map((x) => <li key={x}><q>{x}</q></li>)}</ul>
            </Secao>
          )}

          {g.mostrarServidor && (
            <Secao titulo="O que já funciona no servidor">
              {integracoes.isLoading || runtime.isLoading ? <Linhas n={3} /> : integracoes.isError ? <Vazio>API indisponível agora.</Vazio> : (
                <>
                  <ul className="agd-lista">
                    {integ.map((i) => (
                      <li key={i.id} className="agd-item" data-falta={!i.configurada || undefined}>
                        <i className={`pi ${i.configurada ? 'pi-check-circle' : 'pi-exclamation-triangle'} agd-item__icone`} aria-hidden="true" />
                        <span className="agd-item__corpo">
                          {i.nome}
                          {!i.configurada && i.faltando.length > 0 && <small className="agd-mudo"> · falta {i.faltando.join(', ')}</small>}
                        </span>
                        <Pill label={i.configurada ? 'Pronta' : 'Incompleta'} tone={i.configurada ? 'ok' : 'serious'} />
                      </li>
                    ))}
                  </ul>
                  {runtime.data && (
                    <p className="agd-mudo iv-mt">
                      Por pedido: até {runtime.data.limites.voltas} chamadas ao modelo. Hoje: {runtime.data.custoHoje.execucoes} de {runtime.data.limites.execucoesPorDia} pedidos
                      e {runtime.data.custoHoje.escritasAprovadas} de {runtime.data.limites.escritasAprovadasPorDia} ações de escrita.
                      "Pronta" quer dizer que as variáveis existem; para provar que conecta, use "Testar conexão" em <Link to="/ambiente" className="agd-link">Meu Ambiente</Link>.
                    </p>
                  )}
                </>
              )}
            </Secao>
          )}

          {g.cuidados && (
            <Secao titulo="Cuidados">
              <ul className="ag-guia-lista">{g.cuidados.map((c) => <li key={c}>{c}</li>)}</ul>
            </Secao>
          )}

          <Secao titulo="Melhorar com o tempo">
            <ul className="ag-guia-lista">{g.melhorar.map((m) => <li key={m}>{m}</li>)}</ul>
            <h4 className="ag-guia-sub">O que os seus dados sugerem{agenteId ? ' para este agente' : ''}</h4>
            {agentes.isLoading || auditoria.isLoading ? <Linhas n={2} /> : auditoria.isError ? <Vazio>Auditoria indisponível agora.</Vazio>
              : sugestoes.length === 0 ? <Vazio>Nada por enquanto. As sugestões aparecem conforme os agentes rodam: falhas repetidas, ações negadas, aprovações que o modo autônomo dispensaria e casos de teste com falha.</Vazio> : (
                <ul className="agd-lista">
                  {sugestoes.map((s) => (
                    <li key={s.id} className="agd-item">
                      <i className={`pi ${s.tom === 'atencao' ? 'pi-exclamation-circle' : 'pi-lightbulb'} agd-item__icone ag-guia-sug--${s.tom}`} aria-hidden="true" />
                      <span className="agd-item__corpo">
                        {s.texto}
                        {s.agenteId && s.agenteId !== agenteId && (
                          <> <Link to="/agents/agente/$agenteId" params={{ agenteId: s.agenteId }} className="agd-link" onClick={() => setAberto(false)}>Abrir o agente</Link></>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </Secao>

          <Secao titulo="Outras telas">
            <nav className="ag-guia-telas" aria-label="Telas de Agents">
              {TELAS.filter((t) => t.tela !== tela).map((t) => (
                <Link key={t.to} to={t.to} className="agd-link" onClick={() => setAberto(false)}>{t.rotulo}</Link>
              ))}
            </nav>
          </Secao>
        </DetailDrawer>
      )}
    </>
  );
}
