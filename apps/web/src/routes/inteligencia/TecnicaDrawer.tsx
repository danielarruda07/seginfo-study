import { useState } from 'react';
import { MODULO_ESTUDO_ATIVO } from '@/config/modulos';
import { Link } from '@tanstack/react-router';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { toneClass } from '@/theme/status';
import { getTopico } from '@/services/catalog';
import { getLab } from '@/services/inventario';
import { TATICAS, marcarDeteccao, removerDeteccao, type CoberturaTecnica } from '@/services/attack';
import { ExtLink, FichaLista } from './ExtLink';
import { CAMADAS, DETECCAO_LABEL, acaoMeta, acoesDaTecnica, cvesDosExercicios, proximoPassoTecnica, temCamada } from './regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de uma técnica ATT&CK: cobertura, próximo passo, tópicos, labs, exercícios, Radar e detecção. */
export function TecnicaDrawer({ tecnica: t, nav, onChange, periodo = '30 dias' }: { tecnica: CoberturaTecnica; nav: Nav; onChange: () => void; periodo?: string }) {
  const tatica = TATICAS.find((x) => x.id === t.tatica)?.nome ?? t.tatica;
  const passo = proximoPassoTecnica(t);
  const acoes = acoesDaTecnica(t.id);
  const cves = cvesDosExercicios(t.exercicios);
  const executados = t.exercicios.filter((e) => e.status !== 'planejado');
  const sinais = executados.filter((e) => e.detection === 'detectado' || e.detection === 'parcial');
  const respostas = executados.filter((e) => e.blueResponse.trim());
  const wz = t.alertaWazuh;
  const estadoAlerta = [
    wz ? `${wz.alertas.toLocaleString('pt-BR')} alerta(s) do Wazuh` : null,
    sinais.length ? `${sinais.length} sinal(is) em exercício` : null,
  ].filter(Boolean).join(' · ') || (executados.length ? 'Teste sem alerta ou sem sinal parcial' : 'Nenhuma regra do Wazuh disparou e não há exercício registrado');

  return (
    <DetailDrawer {...nav} ariaLabel={`Ficha da técnica ${t.id} ${t.nome}`}
      kind={{ icon: 'pi-th-large', label: `Técnica · ${tatica}` }}
      status={CAMADAS.map((c) => (
        <span key={c.id} className={`in-camada in-camada--${c.id}`} data-on={temCamada(t, c.id) || undefined}>
          <span className="in-dot" aria-hidden="true" />{c.label}: {temCamada(t, c.id) ? 'sim' : 'não'}
        </span>
      ))}
      title={<><span className="mono">{t.id}</span> · {t.nome}</>}
      subtitle={`Tática: ${tatica}${t.observada > 0 ? ` · ${t.observada} evento(s) no Radar em ${periodo}` : ''}`}
      actions={<ExtLink button href={`https://attack.mitre.org/techniques/${t.id}/`}>Ficha oficial no MITRE</ExtLink>}
    >
      <section>
        <h3 className="iv-section-label">Ciclo operacional</h3>
        <div className="in-ciclo-detalhe">
          <Etapa icon="pi-eye" titulo="1 · Observação" estado={t.observada ? `${t.observada} evento(s) real(is) no Radar` : 'Sem evento no período'} detalhe="Telemetria coletada; não significa que houve alerta." ativa={t.observada > 0} />
          <Etapa icon="pi-bell" titulo="2 · Alerta" estado={estadoAlerta} detalhe="Regra do Wazuh com esta técnica (rule.mitre.id) que disparou de verdade, ou sinal registrado no diário do Lab." ativa={!!wz || sinais.length > 0} />
          <Etapa icon="pi-check-circle" titulo="3 · Validação" estado={t.detectada ? `Regra registrada em ${t.detectada.testadoEm}` : 'Regra ainda não validada'} detalhe={t.detectada ? `${t.detectada.automatico ? 'Resultado do diário Red × Blue' : 'Confirmação manual'} · ${t.detectada.regra || 'sem regra descrita'}` : 'Registre a regra e confirme o sinal com evidência do teste.'} ativa={!!t.detectada} />
          <Etapa icon="pi-shield" titulo="4 · Resposta" estado={respostas.length ? `${respostas.length} resposta(s) documentada(s)` : 'Resposta não documentada'} detalhe={respostas.length ? respostas.map((e) => e.blueResponse).join(' · ') : 'Anote triagem, contenção e recuperação no diário do Lab.'} ativa={respostas.length > 0} />
        </div>
        <p className="in-ciclo-nota">Os eventos do Radar são observações reais. O alerta vem das regras do Wazuh que dispararam com esta técnica ou dos exercícios; validação e resposta continuam vindo dos registros dos exercícios, porque dependem do seu julgamento (o alerta estava certo? o que foi feito?).</p>
        <div className="iv-row iv-wrap iv-mt">
          <Link to="/radar" className="in-ext"><i className="pi pi-eye" aria-hidden="true" />Abrir eventos do Radar</Link>
          <Link to="/labs" className="in-ext"><i className="pi pi-wrench" aria-hidden="true" />Abrir diário Red × Blue</Link>
        </div>
      </section>

      <section>
        <h3 className="iv-section-label">Próximo passo</h3>
        <p className={`in-passo ${toneClass(passo.tone)}`} data-alert={passo.tone ? true : undefined}>{passo.texto}</p>
      </section>

      {MODULO_ESTUDO_ATIVO && <section>
        <h3 className="iv-section-label">Tópicos que cobrem</h3>
        <FichaLista vazio="Nenhum tópico mapeado ainda.">
          {t.topicos.flatMap((id) => {
            const tp = getTopico(id);
            return tp ? [<li key={id}><Link to="/trilhas/$trilhaId" params={{ trilhaId: tp.trilhaId }}>{tp.titulo}</Link></li>] : [];
          })}
        </FichaLista>
      </section>}

      <section>
        <h3 className="iv-section-label">Labs que praticam</h3>
        <FichaLista vazio="Nenhum lab mapeado. Anote a técnica no campo MITRE de um lab.">
          {t.labs.map((id) => <li key={id}><Link to="/labs">{getLab(id)?.titulo ?? id}</Link></li>)}
        </FichaLista>
      </section>

      <section>
        <h3 className="iv-section-label">Exercícios Red × Blue</h3>
        <FichaLista vazio="Nenhuma execução registrada para esta técnica.">
          {t.exercicios.map((e) => (
            <li key={e.id} className="in-list__row">
              <Link to="/labs">{getLab(e.labId)?.titulo ?? e.title}</Link>
              <span className="iv-muted">{e.status.replaceAll('_', ' ')} · detecção {DETECCAO_LABEL[e.detection]}</span>
            </li>
          ))}
        </FichaLista>
        {cves.length > 0 && <p className="in-muted-p">CVEs validadas com esta técnica: {cves.map((c) => <Link key={c} to="/ameacas" className="mono in-gap">{c}</Link>)}</p>}
      </section>

      {wz && (
        <section>
          <h3 className="iv-section-label">Alertas do Wazuh ({periodo})</h3>
          <DetailFields items={[
            ['Alertas', wz.alertas.toLocaleString('pt-BR')],
            ['Último', wz.ultimo ? new Date(wz.ultimo).toLocaleString('pt-BR') : '—'],
            ['Agentes', wz.agentes.join(', ') || '—'],
          ]} />
          <FichaLista vazio="">
            {wz.regras.map((r) => (
              <li key={r.id} className="in-list__row">
                <span><span className="mono">{r.id}</span> · {r.descricao || 'regra sem descrição'}</span>
                <span className="iv-muted">nível {r.nivel} · {r.alertas.toLocaleString('pt-BR')} alerta(s)</span>
              </li>
            ))}
          </FichaLista>
          <Link to="/wazuh" className="in-ext"><i className="pi pi-shield" aria-hidden="true" />Abrir Wazuh</Link>
        </section>
      )}

      {acoes.length > 0 && (
        <section>
          <h3 className="iv-section-label">No Radar</h3>
          <DetailFields items={[
            [`Eventos (${periodo})`, t.observada > 0 ? <Link to="/radar">{t.observada} evento(s)</Link> : 'Nenhum'],
            ['Ações que geram', acoes.map((a) => acaoMeta(a).label).join(', ')],
          ]} />
        </section>
      )}

      <Deteccao key={t.id} tecnica={t} onChange={onChange} />
    </DetailDrawer>
  );
}

function Etapa({ icon, titulo, estado, detalhe, ativa }: { icon: string; titulo: string; estado: string; detalhe: string; ativa: boolean }) {
  return <article className="in-etapa" data-active={ativa || undefined}>
    <div className="in-etapa__titulo"><i className={`pi ${icon}`} aria-hidden="true" /><strong>{titulo}</strong><span className="in-etapa__estado">{ativa ? 'Registrado' : 'Pendente'}</span></div>
    <strong>{estado}</strong><p>{detalhe}</p>
  </article>;
}

function Deteccao({ tecnica: t, onChange }: { tecnica: CoberturaTecnica; onChange: () => void }) {
  const [regra, setRegra] = useState(t.detectada?.regra ?? '');
  return (
    <section>
      <h3 className="iv-section-label">Detecção</h3>
      {t.detectada && (
        <DetailFields items={[
          ['Regra', t.detectada.regra],
          ['Testada em', <span className="tabular">{t.detectada.testadoEm}</span>],
          ['Origem', t.detectada.automatico ? 'Registro Red × Blue' : 'Marcação manual'],
        ]} />
      )}
      <p className="in-muted-p">Marque só depois de testar: execute a técnica num lab isolado e confirme que o alerta disparou.</p>
      <label className="iv-col in-field">
        <span>Regra ou consulta que detecta</span>
        <InputText value={regra} maxLength={300} onChange={(e) => setRegra(e.target.value)} placeholder="Ex.: Wazuh rule 100210 (tarefa agendada nova)" />
      </label>
      <div className="iv-row iv-wrap iv-mt">
        <Button label={t.detectada?.automatico ? 'Confirmar manualmente' : t.detectada ? 'Atualizar teste' : 'Marcar como detectada'} icon="pi pi-check"
          onClick={() => { marcarDeteccao(t.id, regra); onChange(); }} />
        {t.detectada && !t.detectada.automatico && (
          <Button label="Remover marcação" icon="pi pi-trash" severity="secondary" outlined
            onClick={() => { removerDeteccao(t.id); setRegra(''); onChange(); }} />
        )}
      </div>
    </section>
  );
}
