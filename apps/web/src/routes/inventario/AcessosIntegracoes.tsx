import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';
import { Pill } from '@/components/InfraKit';
import { listIntegracoes, type Integracao } from '@/services/integracoes';
import * as vault from '@/services/vault';
import { getLabVars } from '@/services/range';
import { LAB_VARS } from '@/data/rangeLab';
import type { Tone } from '@/theme/status';

/**
 * "Acessos e integrações" do Meu Ambiente: onde fica cada referência a endereços e credenciais
 * do laboratório. Na página é só uma barra de uma linha; o detalhe abre na ficha lateral.
 * Nenhum segredo aparece aqui: senhas ficam no Cofre (cifrado no navegador) e os tokens dos
 * agentes no servidor (variáveis do Coolify).
 */

interface Lugar {
  icon: string;
  dado: string;
  onde: string;
  situacao: string;
  tone: Tone;
  link?: { to: '/cofre' | '/range' | '/agents/ferramentas'; label: string };
}

function useAcessos(ativosComEndereco: number) {
  const q = useQuery({ queryKey: ['integracoes'], queryFn: listIntegracoes, staleTime: 60_000 });
  const integracoes = q.data ?? [];
  const prontas = integracoes.filter((i) => i.configurada).length;

  const vars = getLabVars();
  const varsPreenchidas = LAB_VARS.filter((v) => (vars[v.chave] ?? '').trim()).length;
  const cofreIniciado = vault.isInitialized();
  const credenciais = vault.isUnlocked() ? vault.listEntries().length : null;

  const integTone: Tone = q.isError ? 'danger' : q.isSuccess && prontas < integracoes.length ? 'warning' : 'muted';
  const lugares: Lugar[] = [
    {
      icon: 'pi-server', dado: 'Ativos, endereços IP e funções', onde: 'Esta tela (navegador e backup)',
      situacao: `${ativosComEndereco} com endereço`, tone: 'muted',
    },
    {
      icon: 'pi-lock', dado: 'Senhas e credenciais', onde: 'Cofre, cifrado no navegador com a senha-mestra',
      situacao: !cofreIniciado ? 'ainda não criado' : credenciais === null ? 'trancado' : `${credenciais} credencial(is)`,
      tone: !cofreIniciado ? 'warning' : 'muted', link: { to: '/cofre', label: 'Abrir o Cofre' },
    },
    {
      icon: 'pi-sliders-h', dado: 'Variáveis do laboratório', onde: 'Range Vulnerável (VLANs, portas, IPs do range)',
      situacao: `${varsPreenchidas} de ${LAB_VARS.length} preenchidas`,
      tone: varsPreenchidas < LAB_VARS.length ? 'warning' : 'muted', link: { to: '/range', label: 'Abrir o Range' },
    },
    {
      icon: 'pi-cloud', dado: 'Tokens e senhas dos agentes', onde: 'Servidor: variáveis do serviço da API no Coolify',
      situacao: q.isSuccess ? `${prontas} de ${integracoes.length} integrações prontas` : q.isError ? 'API indisponível' : 'consultando…',
      tone: integTone, link: { to: '/agents/ferramentas', label: 'Ferramentas dos agentes' },
    },
  ];
  return { q, integracoes, prontas, lugares, cofreIniciado, credenciais, varsPreenchidas, integTone };
}

function CartaoIntegracao({ i }: { i: Integracao }) {
  const semVerificacao = i.tls?.startsWith('Sem verificação');
  return (
    <article className="ac-integ" data-pendente={!i.configurada || undefined}>
      <header className="ac-integ__topo">
        <div>
          <strong>{i.nome}</strong>
          <small>{i.uso}</small>
        </div>
        {i.configurada
          ? <Pill label="Configurada" tone="ok" icon="pi-check" />
          : <Pill label="Incompleta" tone="serious" icon="pi-exclamation-triangle" />}
      </header>
      <dl className="iv-dl ac-integ__dl">
        <dt>Endereço</dt><dd>{i.endereco ? <span className="mono">{i.endereco}</span> : '—'}</dd>
        <dt>Identidade</dt><dd>{i.identidade ?? '—'}</dd>
        <dt>Certificado</dt>
        <dd>
          {i.tls ?? '—'}
          {semVerificacao && <small className="ac-integ__aviso"><i className="pi pi-info-circle" aria-hidden="true" /> Aceitável no laboratório; troque antes de usar fora dele.</small>}
        </dd>
        <dt>Variáveis</dt>
        <dd className="ac-vars">
          {i.variaveis.map((v) => (
            <span key={v} className="mono ac-var" data-falta={i.faltando.includes(v) || undefined}
              title={i.faltando.includes(v) ? 'Falta configurar no servidor' : 'Configurada'}>
              {i.faltando.includes(v) && <i className="pi pi-times" aria-hidden="true" />}{v}
            </span>
          ))}
        </dd>
      </dl>
    </article>
  );
}

export function AcessosIntegracoes({ ativosComEndereco }: { ativosComEndereco: number }) {
  const [aberto, setAberto] = useState(false);
  const a = useAcessos(ativosComEndereco);
  const alerta = a.integTone === 'danger' || a.integTone === 'warning';

  return (
    <>
      <button type="button" className={`ac-barra ${alerta ? `tone-${a.integTone}` : ''}`} data-alert={alerta || undefined}
        onClick={() => setAberto(true)} aria-haspopup="dialog">
        <span className="ac-barra__titulo"><i className="pi pi-key" aria-hidden="true" /> Acessos e integrações</span>
        <span className="ac-barra__item" data-alert={alerta || undefined}>
          <i className={`pi ${alerta ? 'pi-exclamation-triangle' : 'pi-cloud'}`} aria-hidden="true" />
          {a.q.isSuccess ? `${a.prontas}/${a.integracoes.length} integrações` : a.q.isError ? 'API indisponível' : 'integrações…'}
        </span>
        <span className="ac-barra__item">
          <i className="pi pi-lock" aria-hidden="true" />
          Cofre {!a.cofreIniciado ? 'não criado' : a.credenciais === null ? 'trancado' : `com ${a.credenciais}`}
        </span>
        <span className="ac-barra__item ac-barra__item--opcional">
          <i className="pi pi-sliders-h" aria-hidden="true" />
          Variáveis {a.varsPreenchidas}/{LAB_VARS.length}
        </span>
        <span className="ac-barra__ver">Ver detalhes <i className="pi pi-angle-right" aria-hidden="true" /></span>
      </button>

      <Sidebar visible={aberto} position="right" onHide={() => setAberto(false)} className="iv-drawer" aria-label="Acessos e integrações"
        header={<span className="iv-drawer__kind"><i className="pi pi-key" aria-hidden="true" /> Acessos e integrações</span>}>
        <div className="iv-drawer__head">
          <h2 className="iv-drawer__title">Onde fica cada acesso</h2>
          <p className="iv-drawer__sub">Mapa de endereços e credenciais do laboratório. Nenhum valor secreto aparece aqui.</p>
        </div>

        <section aria-labelledby="ac-onde">
          <p id="ac-onde" className="iv-section-label">Onde fica cada dado</p>
          <ul className="ac-lugares">
            {a.lugares.map((l) => (
              <li key={l.dado} className="ac-lugar">
                <span className="ac-lugar__icone" aria-hidden="true"><i className={`pi ${l.icon}`} /></span>
                <div className="ac-lugar__texto">
                  <strong>{l.dado}</strong>
                  <small>{l.onde}</small>
                  {l.link && <Link to={l.link.to} onClick={() => setAberto(false)}>{l.link.label} <i className="pi pi-angle-right" aria-hidden="true" /></Link>}
                </div>
                <Pill label={l.situacao} tone={l.tone} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ac-integ">
          <p id="ac-integ" className="iv-section-label">Integrações do servidor (agentes)</p>
          <p className="ac-nota">
            Como a API se conecta a cada sistema. Para mudar, edite as variáveis no serviço <code>seginfo-api</code> do Coolify e faça redeploy.
          </p>
          {a.q.isLoading && <p className="iv-muted">Consultando a API…</p>}
          {a.q.isError && (
            <div className="iv-status iv-status--crit">
              <i className="pi pi-times-circle" aria-hidden="true" />
              <div style={{ flex: 1 }}>Não foi possível consultar a API.</div>
              <Button label="Tentar de novo" size="small" text onClick={() => a.q.refetch()} />
            </div>
          )}
          {a.q.isSuccess && <div className="ac-integs">{a.integracoes.map((i) => <CartaoIntegracao key={i.id} i={i} />)}</div>}
        </section>
      </Sidebar>
    </>
  );
}
