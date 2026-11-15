import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { RascunhoIA } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { FORMATOS } from '@/services/linkedin';

export interface PedidoIA { briefing: string; pilar?: string; incluirDiario: boolean }
export type SugestaoIA = RascunhoIA & { notasUsadas: number };

/** Cartão "Rascunho com IA": briefing, pilar, formato e o resumo do que a IA entregou. */
export function EstudioIA({ pedido, onPedido, formato, onFormato, pilares, iaPronta, iaConhecida, gerando, erro, sugestao, onGerar }: {
  pedido: PedidoIA; onPedido: (p: PedidoIA) => void;
  formato: string; onFormato: (f: string) => void;
  pilares: string[]; iaPronta: boolean; iaConhecida: boolean;
  gerando: boolean; erro: string; sugestao: SugestaoIA | null; onGerar: () => void;
}) {
  return (
    <section className="iv-card iv-mt">
      <div className="ca-toolbar">
        <h3 className="ca-h3"><i className="pi pi-sparkles" aria-hidden="true" /> Rascunho com IA</h3>
        <Pill label={iaPronta ? 'IA pronta' : 'IA não configurada'} tone={iaPronta ? 'ok' : 'muted'} />
      </div>
      {iaConhecida && !iaPronta && (
        <p className="iv-muted ca-small">Defina o Secret <code>ANTHROPIC_API_KEY</code> na API no Coolify (veja a aba Marca pessoal & IA).</p>
      )}
      <div className="iv-col iv-gap iv-mt">
        <InputTextarea value={pedido.briefing} onChange={(e) => onPedido({ ...pedido, briefing: e.target.value })} rows={3} autoResize
          aria-label="Briefing do post" placeholder="Sobre o que é o post? Ex.: o que aprendi montando um honeypot e analisando as primeiras tentativas de login." />
        <div className="iv-row iv-wrap iv-gap">
          <Dropdown value={pedido.pilar} options={pilares} onChange={(e) => onPedido({ ...pedido, pilar: e.value })} placeholder="Pilar (a IA escolhe)" ariaLabel="Pilar" showClear style={{ minWidth: 240 }} />
          <Dropdown value={formato} options={[...FORMATOS]} onChange={(e) => onFormato(e.value)} ariaLabel="Formato" style={{ minWidth: 140 }} />
          <label className="iv-row ca-small">
            <Checkbox checked={pedido.incluirDiario} onChange={(e) => onPedido({ ...pedido, incluirDiario: !!e.checked })} />
            Usar o diário do projeto (posts sobre a SegInfo)
          </label>
          <Button label={gerando ? 'Gerando...' : 'Gerar rascunho'} icon="pi pi-sparkles" loading={gerando} disabled={!iaPronta || pedido.briefing.trim().length < 5} onClick={onGerar} />
        </div>
        {gerando && <p className="iv-muted ca-small ca-mb0" role="status">A geração roda em segundo plano no servidor e pode levar até um minuto. Pode continuar na página.</p>}
        {erro && <Message severity="error" text={erro} className="ca-w100" />}
        {sugestao && (
          <Message severity="info" className="ca-w100" content={
            <div className="ca-small">
              <div><strong>Por que funciona:</strong> {sugestao.porQueFunciona}</div>
              {sugestao.dadosParaConfirmar.length > 0 && <div className="iv-mt"><strong>Confira antes de publicar:</strong> {sugestao.dadosParaConfirmar.join(' · ')}</div>}
              <div className="iv-muted iv-mt">Contexto usado: estratégia, estudo, histórico de posts{pedido.incluirDiario ? ', diário do projeto' : ''}{sugestao.notasUsadas ? `, ${sugestao.notasUsadas} notas do Segundo Cérebro` : ''}. O rascunho já está no editor abaixo.</div>
            </div>
          } />
        )}
      </div>
    </section>
  );
}
