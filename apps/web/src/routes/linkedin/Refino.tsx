import { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ACOES_REFINO, ROTULO_REFINO, type AcaoRefino, type RefinoIA } from '@seginfo/shared';
import { mensagemErro } from '@/services/linkedin';
import { refinarTexto } from '@/services/linkedinPipeline';

const ICONE: Record<AcaoRefino, string> = {
  encurtar: 'pi-arrows-v', concreto: 'pi-bullseye', ganchos: 'pi-bolt', direto: 'pi-forward', carrossel: 'pi-images', livre: 'pi-comment',
};

export interface UltimoRefino { acao: AcaoRefino; oQueMudou: string; alternativasGancho: string[] }

/**
 * Refino com IA sobre o texto que está no editor. Cada refino pode ser desfeito e, ao salvar,
 * vira uma versão nova do rascunho (o texto anterior fica no histórico).
 */
export function Refino({ gancho, corpo, iaPronta, ultimo, podeDesfazer, onResultado, onEscolherGancho, onDesfazer }: {
  gancho: string; corpo: string; iaPronta: boolean;
  ultimo: UltimoRefino | null; podeDesfazer: boolean;
  onResultado: (acao: AcaoRefino, r: RefinoIA) => void;
  onEscolherGancho: (g: string) => void;
  onDesfazer: () => void;
}) {
  const [rodando, setRodando] = useState<AcaoRefino | null>(null);
  const [livreAberto, setLivreAberto] = useState(false);
  const [instrucao, setInstrucao] = useState('');
  const [erro, setErro] = useState('');
  const temTexto = gancho.trim().length + corpo.trim().length >= 40;

  async function refinar(acao: AcaoRefino) {
    if (acao === 'livre' && instrucao.trim().length < 5) return setErro('Descreva o que a IA deve mudar (pelo menos 5 caracteres).');
    setErro(''); setRodando(acao);
    try {
      const r = await refinarTexto({ acao, gancho, corpo, ...(acao === 'livre' ? { instrucao: instrucao.trim() } : {}) });
      onResultado(acao, r);
      if (acao === 'livre') { setInstrucao(''); setLivreAberto(false); }
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setRodando(null);
    }
  }

  return (
    <section className="lp-refino" aria-label="Refino com IA">
      <div className="iv-row iv-wrap">
        <span className="iv-section-label lp-refino__rotulo"><i className="pi pi-sparkles" aria-hidden="true" /> Refinar com IA</span>
        {ACOES_REFINO.map((acao) => (
          <Button key={acao} label={ROTULO_REFINO[acao]} icon={`pi ${ICONE[acao]}`} size="small" outlined
            loading={rodando === acao} disabled={!iaPronta || !temTexto || (!!rodando && rodando !== acao)}
            onClick={() => (acao === 'livre' ? setLivreAberto((a) => !a) : refinar(acao))} aria-expanded={acao === 'livre' ? livreAberto : undefined} />
        ))}
        {podeDesfazer && <Button label="Desfazer refino" icon="pi pi-undo" size="small" text onClick={onDesfazer} />}
      </div>
      {!iaPronta && <p className="iv-muted ca-small ca-mb0">Disponível quando a IA estiver configurada.</p>}
      {iaPronta && !temTexto && <p className="iv-muted ca-small ca-mb0">Escreva ou gere um texto para a IA ter o que refinar.</p>}
      {livreAberto && (
        <form className="iv-row iv-wrap lp-refino__livre" onSubmit={(e) => { e.preventDefault(); void refinar('livre'); }}>
          <InputText value={instrucao} onChange={(e) => setInstrucao(e.target.value)} maxLength={1_000} className="ca-flex1" autoFocus
            aria-label="Pedido para a IA" placeholder='Ex.: "troque o exemplo por um de firewall" ou "feche com uma pergunta para quem opera rede"' />
          <Button type="submit" label="Aplicar" icon="pi pi-check" size="small" loading={rodando === 'livre'} />
        </form>
      )}
      {rodando && <p className="iv-muted ca-small ca-mb0" role="status">Refinando em segundo plano…</p>}
      {erro && <p className="ca-aviso" role="alert"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> {erro}</p>}
      {ultimo && (
        <div className="lp-refino__resultado" role="status">
          <p className="ca-small ca-mb0"><strong>{ROTULO_REFINO[ultimo.acao]}:</strong> {ultimo.oQueMudou}</p>
          {ultimo.alternativasGancho.length > 0 && (
            <ul className="linkedin-ideias">
              {ultimo.alternativasGancho.map((g) => (
                <li key={g}>
                  <span>{g}</span>
                  <Button label="Usar" icon="pi pi-check" text size="small" onClick={() => onEscolherGancho(g)} aria-label={`Usar o gancho: ${g}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
