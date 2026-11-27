import { useQuery } from '@tanstack/react-query';
import { ExportarRelatorio } from '@/components/ExportarRelatorio';
import { Button } from 'primereact/button';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { historicoAlvo, nomeDoAlvo, relatorioDaExposicao, type AlvoExposicao } from '@/services/exposicao';
import { quando, SEVERIDADE } from './comum';
import { FontesExtras } from './FontesExtras';

const FONTE: Record<string, string> = { certificados: 'Certificados (crt.sh)', dns: 'DNS público', ip: 'Shodan InternetDB' };

/** Ficha completa de um alvo: portas e CVEs por IP, subdomínios, DNS, falhas e histórico. */
export function ExposicaoDrawer({ alvo, varrendo, onVarrer, onClose }: {
  alvo: AlvoExposicao; varrendo: boolean; onVarrer: () => void; onClose: () => void;
}) {
  const historico = useQuery({ queryKey: ['exposicao-historico', alvo.id, alvo.ultima?.id], queryFn: () => historicoAlvo(alvo.id) });
  const u = alvo.ultima;
  const r = u?.resultado;

  return (
    <DetailDrawer onClose={onClose} wide kind={{ icon: 'pi-globe', label: 'Exposição' }} ariaLabel={`Exposição de ${nomeDoAlvo(alvo)}`}
      title={nomeDoAlvo(alvo)} subtitle={u ? `Última varredura: ${quando(u.criadoEm)}` : 'Ainda não varrido.'}
      actions={<><Button label="Varrer agora" icon="pi pi-refresh" outlined loading={varrendo} onClick={onVarrer} />{u && <ExportarRelatorio montar={() => relatorioDaExposicao(alvo)} nome={`exposicao_${alvo.valor}`} />}</>}>

      {!r ? <p className="in-muted-p">Rode a primeira varredura para ver os dados.</p> : (
        <>
          {r.erros.length > 0 && (
            <section>
              <h3 className="iv-section-label">Fontes sem resposta</h3>
              <ul className="ex-lista">
                {r.erros.map((e) => <li key={e.fonte}><strong>{FONTE[e.fonte] ?? e.fonte}:</strong> {e.mensagem}</li>)}
              </ul>
            </section>
          )}

          {r.ip && (
            <section>
              <h3 className="iv-section-label">Portas e serviços vistos pela internet</h3>
              <p className="in-muted-p">{r.ip.origem}. Dados das varreduras semanais do Shodan; as CVEs são inferidas pela versão, não confirmadas.</p>
              {r.ip.resultados.map((x) => (
                <div key={x.ip} className="ex-ip">
                  <div className="ex-ip__topo">
                    <code>{x.ip}</code>
                    {x.erro ? <Pill label="sem resposta" tone="warning" /> : !x.encontrado ? <Pill label="nada visto" tone="ok" icon="pi-check" /> : null}
                  </div>
                  {x.erro && <p className="in-muted-p">{x.erro}</p>}
                  {!x.erro && !x.encontrado && x.observacao && <p className="in-muted-p">{x.observacao}</p>}
                  {x.encontrado && (
                    <dl className="iv-dl ex-dl">
                      <dt>Portas</dt><dd>{x.portas?.length ? <span className="ex-chips">{x.portas.map((p) => <code key={p}>{p}</code>)}</span> : '—'}</dd>
                      {!!x.softwares?.length && <><dt>Softwares</dt><dd className="ex-quebra">{x.softwares.join(', ')}</dd></>}
                      {!!x.hostnames?.length && <><dt>Hostnames</dt><dd className="ex-quebra">{x.hostnames.join(', ')}</dd></>}
                      {!!x.tags?.length && <><dt>Tags</dt><dd>{x.tags.join(', ')}</dd></>}
                      <dt>CVEs</dt>
                      <dd>
                        {x.vulnerabilidades?.length ? (
                          <span className="ex-chips">
                            {x.vulnerabilidades.map((c) => (
                              <a key={c} href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(c)}`} target="_blank" rel="noreferrer noopener">{c}</a>
                            ))}
                            {!!x.vulnerabilidadesOmitidas && <span className="iv-muted">e mais {x.vulnerabilidadesOmitidas}</span>}
                          </span>
                        ) : 'nenhuma'}
                      </dd>
                    </dl>
                  )}
                </div>
              ))}
            </section>
          )}

          {r.certificados && (
            <section>
              <h3 className="iv-section-label">Subdomínios em certificados públicos ({r.certificados.subdominios})</h3>
              <p className="in-muted-p">
                Todo nome que ganhou certificado fica nos logs de Certificate Transparency: robôs leem esses logs e atacam nomes novos em minutos.
                {r.certificados.nomesOmitidos > 0 && ` Mostrando os 200 mais recentes; ${r.certificados.nomesOmitidos} ficaram de fora.`}
              </p>
              {r.certificados.nomes.length > 0 && (
                <div className="ex-tabela-wrap">
                  <table className="ex-tabela">
                    <thead><tr><th scope="col">Nome</th><th scope="col">Primeiro</th><th scope="col">Último</th><th scope="col" className="iv-right">Cert.</th></tr></thead>
                    <tbody>
                      {r.certificados.nomes.map((n) => (
                        <tr key={n.nome}>
                          <td className="ex-quebra">{n.curinga && <span className="iv-muted">*.</span>}{n.nome}</td>
                          <td>{n.primeiro || '—'}</td>
                          <td>{n.ultimo || '—'}</td>
                          <td className="iv-right">{n.certificados}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {r.certificados.emissores.length > 0 && (
                <p className="in-muted-p">Emissores: {r.certificados.emissores.map((e) => `${e.nome} (${e.total})`).join(', ')}.</p>
              )}
            </section>
          )}

          {r.dns && (
            <section>
              <h3 className="iv-section-label">DNS público</h3>
              {r.dns.avisos.length > 0 ? (
                <ul className="ex-lista ex-lista--avisos">{r.dns.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              ) : <p className="in-muted-p">Nenhum problema encontrado em SPF, DMARC e CAA.</p>}
              <dl className="iv-dl ex-dl">
                {([['A', r.dns.a], ['AAAA', r.dns.aaaa], ['CNAME', r.dns.cname], ['MX', r.dns.mx], ['NS', r.dns.ns], ['CAA', r.dns.caa], ['TXT', r.dns.txt]] as const)
                  .filter(([, v]) => v.length > 0)
                  .map(([k, v]) => <div key={k} className="ex-dl__linha"><dt>{k}</dt><dd className="ex-quebra">{v.join(' · ')}</dd></div>)}
                <div className="ex-dl__linha"><dt>DMARC</dt><dd className="ex-quebra">{r.dns.email.dmarc ?? '(nenhum)'}</dd></div>
              </dl>
            </section>
          )}

          <FontesExtras resultado={r} />
        </>
      )}

      <section>
        <h3 className="iv-section-label">Histórico</h3>
        {historico.isLoading ? <p className="in-muted-p" role="status">Carregando…</p>
          : !historico.data?.length ? <p className="in-muted-p">Sem varreduras.</p> : (
            <ol className="ex-historico">
              {historico.data.map((v) => (
                <li key={v.id}>
                  <span className="ex-historico__quando">{quando(v.criadoEm)}</span>
                  <span className="iv-muted">
                    {v.erro ? 'falhou' : `${v.resumo.portas} portas · ${v.resumo.cves} CVEs${v.resumo.subdominios !== null ? ` · ${v.resumo.subdominios} subdomínios` : ''}`}
                  </span>
                  {v.mudancas.length > 0 && (
                    <ul className="ex-historico__mudancas">
                      {v.mudancas.map((m, i) => (
                        <li key={i}><Pill label={SEVERIDADE[m.severidade].rotulo} tone={SEVERIDADE[m.severidade].tone} /> {m.texto}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
      </section>
    </DetailDrawer>
  );
}
