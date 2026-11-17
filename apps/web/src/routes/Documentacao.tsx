import { PageHeader } from '@/components/ui/PageHeader';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { DOC_OBJETIVO, DOC_BLOCOS, DOC_TESTES } from '@/data/documentacao';
import '@/styles/telas/documentacao.css';

/** Rola até a âncora sem recarregar a rota. */
function irPara(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: string[][] }) {
  return (
    <div className="doc-tabela-wrap">
      <table className="doc-tabela">
        <thead><tr>{colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Documentacao() {
  return (
    <div>
      <PageHeader
        title="Documentação do ambiente"
        subtitle="Como o ambiente de estudo foi montado — rede, firewall, VLANs, VMs, switch e exposição — e um índice de testes por tipo. Sem dados reais: o repositório é público."
      />

      {DOC_OBJETIVO.map((p, i) => <p key={i} className="iv-muted doc-intro">{p}</p>)}

      <section className="iv-card iv-mt doc-indice" aria-label="Índice">
        <h2 className="iv-section-label">Índice</h2>
        <ol className="doc-indice__lista">
          {DOC_BLOCOS.map((b) => (
            <li key={b.id}>
              <button type="button" className="attack-link" onClick={() => irPara(b.id)}>
                <i className={`pi ${b.icone}`} aria-hidden="true" /> {b.titulo}
              </button>
              <span className="iv-muted doc-indice__resumo">{b.resumo}</span>
            </li>
          ))}
          <li>
            <button type="button" className="attack-link" onClick={() => irPara('testes')}>
              <i className="pi pi-list-check" aria-hidden="true" /> Testes por tipo
            </button>
            <span className="iv-muted doc-indice__resumo">{DOC_TESTES.length} tipos de teste, cada um com sua âncora.</span>
          </li>
        </ol>
      </section>

      {DOC_BLOCOS.map((b) => (
        <section key={b.id} id={b.id} className="iv-card iv-mt doc-bloco" aria-label={b.titulo}>
          <h2 className="doc-bloco__titulo"><i className={`pi ${b.icone}`} aria-hidden="true" /> {b.titulo}</h2>
          {b.paragrafos?.map((p, i) => <p key={i} className="doc-paragrafo">{p}</p>)}
          {b.itens && <ul className="doc-itens">{b.itens.map((it, i) => <li key={i}>{it}</li>)}</ul>}
          {b.tabela && <Tabela {...b.tabela} />}
        </section>
      ))}

      <section id="testes" className="iv-mt" aria-label="Testes por tipo">
        <h2 className="iv-section-label doc-testes__titulo">Testes por tipo</h2>
        <StatusStrip icon="pi-info-circle">
          Cada tipo de teste descreve como a superfície é aberta ao ataque, o que o atacante faz e como o Wazuh detecta.
        </StatusStrip>

        <div className="iv-card iv-mt doc-indice" aria-label="Índice dos testes">
          <ol className="doc-indice__lista doc-indice__lista--testes">
            {DOC_TESTES.map((t) => (
              <li key={t.id}>
                <button type="button" className="attack-link" onClick={() => irPara(t.id)}>
                  <span className="mono">{t.codigo}</span> · {t.titulo}
                </button>
                <span className="iv-muted doc-indice__resumo">{t.tatica}</span>
              </li>
            ))}
          </ol>
        </div>

        {DOC_TESTES.map((t) => (
          <section key={t.id} id={t.id} className="iv-card iv-mt doc-teste" aria-label={`${t.codigo} ${t.titulo}`}>
            <div className="doc-teste__cab">
              <h3 className="doc-teste__titulo">{t.titulo}</h3>
              <Pill label={<><span className="mono">{t.codigo}</span></>} />
            </div>
            <p className="iv-muted doc-teste__tatica">{t.tatica} · alvo: {t.alvo}</p>
            <dl className="doc-teste__linhas">
              <dt>Como fica aberto</dt><dd>{t.comoAbre}</dd>
              <dt>Como é atacado</dt><dd>{t.comoAtaca}</dd>
              <dt>Como é detectado</dt><dd>{t.deteccao}</dd>
              <dt>O que foi observado</dt><dd>{t.resultado}</dd>
            </dl>
          </section>
        ))}
      </section>
    </div>
  );
}
