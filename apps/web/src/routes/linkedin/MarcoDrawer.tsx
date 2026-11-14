import { useState } from 'react';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { CATEGORIA_DIARIO_LABEL, diarioEmMarkdown, type EntradaDiarioComOrigem } from '@/services/linkedin';
import { CATEGORIA_COR } from './regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de um marco do diário do projeto: texto completo, categoria, tags e atalho para virar post. */
export function MarcoDrawer({ marco: e, nav, onGerarPost, onRemover }: {
  marco: EntradaDiarioComOrigem; nav: Nav; onGerarPost: () => void; onRemover?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    // o Markdown do diário inclui um título geral; para um marco só, fica a parte do marco
    copyToClipboard(diarioEmMarkdown([e]).split('\n').slice(2).join('\n').trim());
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-book', label: 'Marco do diário' }} ariaLabel={`Ficha do marco ${e.titulo}`}
      status={<>
        <Pill label={CATEGORIA_DIARIO_LABEL[e.categoria]} color={CATEGORIA_COR[e.categoria]} />
        <Pill label={e.origem === 'voce' ? 'seu registro' : 'registrado no código'} icon={e.origem === 'voce' ? 'pi-user' : 'pi-github'} />
      </>}
      title={e.titulo}
      subtitle={e.data}
      actions={<>
        <Button label="Escrever post sobre este marco" icon="pi pi-pencil" size="small" onClick={onGerarPost} />
        <Button label={copiado ? 'Copiado!' : 'Copiar (Markdown)'} icon="pi pi-copy" size="small" outlined onClick={copiar} />
        {onRemover && <Button label="Remover" icon="pi pi-trash" size="small" text severity="danger" onClick={onRemover} />}
      </>}>
      <section>
        <h3 className="iv-section-label">O que aconteceu</h3>
        <div className="ca-texto">{e.descricao}</div>
      </section>
      <section>
        <h3 className="iv-section-label">Classificação</h3>
        <DetailFields items={[
          ['Data', e.data],
          ['Categoria', CATEGORIA_DIARIO_LABEL[e.categoria]],
          ['Tags', e.tags.length ? <span className="iv-row iv-wrap">{e.tags.map((t) => <Pill key={t} label={`#${t}`} />)}</span> : ''],
          ['Origem', e.origem === 'voce' ? 'Você registrou aqui (fica no banco; pode remover)' : 'Assistente de desenvolvimento, junto com o código (somente leitura)'],
        ]} />
      </section>
    </DetailDrawer>
  );
}
