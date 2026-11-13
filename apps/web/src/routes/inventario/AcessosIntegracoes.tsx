import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { Pill } from '@/components/InfraKit';
import { listIntegracoes, type Integracao } from '@/services/integracoes';
import * as vault from '@/services/vault';
import { getLabVars } from '@/services/range';
import { LAB_VARS } from '@/data/rangeLab';

/**
 * Painel "Acessos e integrações" do Meu Ambiente: mostra, num lugar só, onde fica cada referência
 * a endereços e credenciais do laboratório. Nenhum segredo aparece aqui: as senhas ficam no Cofre
 * (cifrado no navegador) e os tokens dos agentes no servidor (variáveis do Coolify).
 */

const celula = { padding: '.45rem .6rem', borderBottom: '1px solid var(--surface-200, #e2e8f0)', verticalAlign: 'top', textAlign: 'left' } as const;

function Estado({ i }: { i: Integracao }) {
  if (i.configurada) return <Pill label="configurada" color="#16a34a" />;
  return <Pill label={i.faltando.length ? `falta ${i.faltando.join(', ')}` : 'incompleta'} color="#d97706" />;
}

export function AcessosIntegracoes({ ativosComEndereco }: { ativosComEndereco: number }) {
  const [aberto, setAberto] = useState(true);
  const q = useQuery({ queryKey: ['integracoes'], queryFn: listIntegracoes, staleTime: 60_000 });
  const integracoes = q.data ?? [];
  const prontas = integracoes.filter((i) => i.configurada).length;

  const vars = getLabVars();
  const varsPreenchidas = LAB_VARS.filter((v) => (vars[v.chave] ?? '').trim()).length;
  const cofreIniciado = vault.isInitialized();
  const credenciais = vault.isUnlocked() ? vault.listEntries().length : null;

  return (
    <div className="iv-card" style={{ marginBottom: '1rem' }}>
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}><i className="pi pi-key" aria-hidden="true" /> Acessos e integrações</h3>
        <Button text size="small" icon={aberto ? 'pi pi-chevron-up' : 'pi pi-chevron-down'} label={aberto ? 'Recolher' : 'Mostrar'}
          aria-expanded={aberto} onClick={() => setAberto((a) => !a)} />
      </div>
      <p className="iv-muted" style={{ fontSize: '.86rem', margin: '.3rem 0 0' }}>
        Onde fica cada referência a endereços e credenciais do laboratório. Os valores secretos nunca aparecem nesta tela.
      </p>

      {aberto && (
        <>
          <h4 style={{ margin: '1rem 0 .4rem' }}>Onde fica cada dado</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.88rem' }}>
              <thead>
                <tr><th style={celula}>Dado</th><th style={celula}>Onde fica</th><th style={celula}>Situação</th><th style={celula} /></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={celula}>Ativos, endereços IP e funções</td>
                  <td style={celula}>Esta tela (salvo no navegador e no backup)</td>
                  <td style={celula}>{ativosComEndereco} ativo(s) com endereço</td>
                  <td style={celula} />
                </tr>
                <tr>
                  <td style={celula}>Senhas e credenciais de acesso</td>
                  <td style={celula}>Cofre (cifrado no navegador com a sua senha-mestra)</td>
                  <td style={celula}>{!cofreIniciado ? 'ainda não criado' : credenciais === null ? 'trancado' : `${credenciais} credencial(is)`}</td>
                  <td style={celula}><Link to="/cofre">Abrir o Cofre</Link></td>
                </tr>
                <tr>
                  <td style={celula}>Variáveis do laboratório (VLANs, portas, IPs do range)</td>
                  <td style={celula}>Range Vulnerável (salvo no navegador)</td>
                  <td style={celula}>{varsPreenchidas} de {LAB_VARS.length} preenchidas</td>
                  <td style={celula}><Link to="/range">Abrir o Range</Link></td>
                </tr>
                <tr>
                  <td style={celula}>Tokens e senhas usados pelos agentes</td>
                  <td style={celula}>Servidor: variáveis de ambiente do serviço da API no Coolify</td>
                  <td style={celula}>{q.isSuccess ? `${prontas} de ${integracoes.length} integrações prontas` : q.isError ? 'API indisponível' : 'consultando…'}</td>
                  <td style={celula}><Link to="/agents/auditoria">Auditoria dos agentes</Link></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 style={{ margin: '1.2rem 0 .4rem' }}>Integrações do servidor (agentes)</h4>
          <p className="iv-muted" style={{ fontSize: '.82rem', margin: '0 0 .5rem' }}>
            Como a API se conecta a cada sistema. Para mudar, edite as variáveis no serviço <code>seginfo-api</code> do Coolify e faça redeploy.
          </p>
          {q.isError && <p style={{ color: 'var(--iv-crit)', fontSize: '.86rem' }}>Não foi possível consultar a API.</p>}
          {q.isSuccess && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.86rem' }}>
                <thead>
                  <tr>
                    <th style={celula}>Sistema</th><th style={celula}>Endereço</th><th style={celula}>Identidade</th>
                    <th style={celula}>Certificado</th><th style={celula}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {integracoes.map((i) => (
                    <tr key={i.id}>
                      <td style={celula}>
                        <strong>{i.nome}</strong><br /><small className="iv-muted">{i.uso}</small>
                        <details style={{ marginTop: '.2rem' }}>
                          <summary style={{ cursor: 'pointer', fontSize: '.78rem' }}>Variáveis</summary>
                          <span className="mono" style={{ fontSize: '.78rem' }}>{i.variaveis.join(', ')}</span>
                        </details>
                      </td>
                      <td style={celula}>{i.endereco ? <span className="mono">{i.endereco}</span> : <span className="iv-muted">—</span>}</td>
                      <td style={celula}>{i.identidade ?? <span className="iv-muted">—</span>}</td>
                      <td style={celula}>
                        {i.tls ?? <span className="iv-muted">—</span>}
                        {i.tls?.startsWith('Sem verificação') && <><br /><small style={{ color: '#b45309' }}>aceitável no laboratório; troque antes de usar fora dele</small></>}
                      </td>
                      <td style={celula}><Estado i={i} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
