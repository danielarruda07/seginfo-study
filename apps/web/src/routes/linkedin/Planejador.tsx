import { useState } from 'react';
import { Button } from 'primereact/button';
import { SelectButton } from 'primereact/selectbutton';
import { Message } from 'primereact/message';
import { diaLocal, type ProjetoLinkedin, type SugestaoPauta } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { criarIdeia, planejarSemana } from '@/services/linkedinPipeline';
import { detalheDoErro } from './dados';
import { fusoDoNavegador, nomeDoProjeto, somarDias } from './pipelineRegras';

const JANELAS = [{ value: 7, label: '7 dias' }, { value: 14, label: '14 dias' }];
const dataBr = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const chave = (s: SugestaoPauta) => `${s.dia}|${s.titulo}`;

/**
 * Planejador: a IA propõe a pauta dos próximos dias a partir dos projetos ativos, pilares esquecidos,
 * marcos recentes do diário e do backlog. Nada é criado sozinho: você guarda as sugestões como ideias.
 */
export function Planejador({ projetos, iaPronta }: { projetos: ProjetoLinkedin[]; iaPronta: boolean }) {
  const invalidate = useInvalidate();
  const [dias, setDias] = useState(7);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [sugestoes, setSugestoes] = useState<SugestaoPauta[] | null>(null);
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());

  async function sugerir() {
    setGerando(true); setErro(''); setSugestoes(null); setGuardadas(new Set());
    try {
      const inicio = somarDias(diaLocal(new Date(), fusoDoNavegador()), 1);
      const r = await planejarSemana({ inicio, dias });
      setSugestoes([...r.sugestoes].sort((a, b) => a.dia.localeCompare(b.dia)));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function guardar(lista: SugestaoPauta[]) {
    setErro('');
    const feitas = new Set(guardadas);
    for (const s of lista) {
      try {
        await criarIdeia({
          titulo: s.titulo.slice(0, 200), briefing: s.briefing.slice(0, 3_000), pilar: s.pilar || null, formato: s.formato, origem: 'planejador',
          sugeridaPara: /^\d{4}-\d{2}-\d{2}$/.test(s.dia) ? s.dia : null,
          projetoId: s.projetoId && projetos.some((p) => p.id === s.projetoId) ? s.projetoId : null,
        });
        feitas.add(chave(s));
      } catch (e) {
        // 409: a ideia já estava no backlog; conta como guardada
        if (detalheDoErro(e).status === 409) feitas.add(chave(s));
        else { setErro(mensagemErro(e)); break; }
      }
    }
    setGuardadas(feitas);
    invalidate('linkedin-ideias');
  }

  const pendentes = (sugestoes ?? []).filter((s) => !guardadas.has(chave(s)));

  return (
    <details className="iv-card lp-planejador">
      <summary><i className="pi pi-sparkles" aria-hidden="true" /> <strong>Planejador da semana</strong> <span className="iv-muted">· a IA sugere a pauta; você decide o que guardar</span></summary>
      <div className="iv-row iv-wrap iv-gap iv-mt">
        <SelectButton value={dias} options={JANELAS} allowEmpty={false} onChange={(e) => setDias(e.value)} aria-label="Janela do planejamento" />
        <Button label={gerando ? 'Pensando na pauta…' : 'Sugerir pauta'} icon="pi pi-sparkles" loading={gerando} disabled={!iaPronta} onClick={sugerir} />
        {pendentes.length > 1 && <Button label={`Guardar todas (${pendentes.length})`} icon="pi pi-inbox" outlined onClick={() => guardar(pendentes)} />}
      </div>
      {!iaPronta && <p className="iv-muted ca-small">A IA não está configurada: defina o Secret <code>ANTHROPIC_API_KEY</code> na API (veja "Marca pessoal & IA").</p>}
      {gerando && <p className="iv-muted ca-small" role="status">A geração roda em segundo plano no servidor e pode levar até um minuto.</p>}
      {erro && <Message severity="error" text={erro} className="ca-msg" />}
      {sugestoes && sugestoes.length === 0 && <p className="iv-muted ca-small iv-mt">A IA não devolveu sugestões. Tente de novo ou registre mais marcos e ideias.</p>}
      {sugestoes && sugestoes.length > 0 && (
        <ul className="lp-sugestoes iv-mt">
          {sugestoes.map((s) => {
            const projeto = nomeDoProjeto(projetos, s.projetoId);
            const ok = guardadas.has(chave(s));
            return (
              <li key={chave(s)}>
                <div className="ca-post__meta">
                  <span className="tabular"><strong>{dataBr(s.dia)}</strong></span>
                  <Pill label={s.formato} />
                  {s.pilar && <Pill label={s.pilar} tone="info" />}
                  {projeto && <Pill label={projeto} icon="pi-folder" />}
                  <span className="iv-right">
                    {ok ? <Pill label="Guardada nas ideias" tone="ok" icon="pi-check" />
                      : <Button label="Guardar como ideia" icon="pi pi-inbox" text size="small" onClick={() => guardar([s])} />}
                  </span>
                </div>
                <p className="ca-post__titulo">{s.titulo}</p>
                <p className="ca-small ca-mb0">{s.briefing}</p>
                <p className="iv-muted ca-small ca-mb0"><strong>Por quê:</strong> {s.porque}</p>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
