import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { ClickCard } from '@/components/ui/ClickCard';
import { EmptyState, Pill } from '@/components/InfraKit';
import type { TrechoEncontrado } from '@/services/cerebro';
import { ESCOPO_META } from './regras';

/** Busca no cérebro: trechos com a fonte; cada trecho é um cartão que abre a memória inteira. */
export function BuscaCerebro({ achados, buscando, onBuscar, onLimpar, onOpen, abertoId }: {
  achados: TrechoEncontrado[] | null;
  buscando: boolean;
  onBuscar: (q: string) => void;
  onLimpar: () => void;
  onOpen: (memoriaId: string) => void;
  abertoId?: string;
}) {
  const [consulta, setConsulta] = useState('');
  return (
    <div className="iv-card">
      <h2 className="iv-section-label">Perguntar ao cérebro</h2>
      <form className="co-add__linha" onSubmit={(e) => { e.preventDefault(); if (consulta.trim()) onBuscar(consulta.trim()); }}>
        <span className="p-input-icon-left co-grow">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText value={consulta} onChange={(e) => setConsulta(e.target.value)} className="co-w100" aria-label="Pergunta para o Segundo Cérebro"
            placeholder="Ex.: como funciona o kerberoasting?" />
        </span>
        <Button type="submit" label="Buscar" icon={buscando ? 'pi pi-spinner pi-spin' : 'pi pi-search'} disabled={buscando || !consulta.trim()} />
        {achados && <Button type="button" label="Limpar" text onClick={() => { setConsulta(''); onLimpar(); }} />}
      </form>
      {achados && (
        <div className="iv-col co-gap-sm iv-mt" aria-live="polite">
          {achados.length === 0 && <EmptyState icon="pi-search" title="Nada encontrado" text="Tente outras palavras ou guarde material sobre o assunto." />}
          {achados.map((a, i) => (
            <ClickCard key={`${a.memoriaId}-${i}`} as="div" className="co-trecho" onOpen={() => onOpen(a.memoriaId)} selected={abertoId === a.memoriaId}
              label={`Abrir a memória ${a.titulo}`}>
              <div className="co-card__top">
                <strong>{a.titulo}</strong>
                <span className="iv-row co-gap-xs">
                  {a.escopo === 'corporativo' && <Pill label={ESCOPO_META.corporativo.label} tone={ESCOPO_META.corporativo.tone} />}
                  <span className="co-nota" title="Pontuação da busca (BM25)">relevância {a.score}</span>
                </span>
              </div>
              <p className="co-trecho__texto">{a.trecho}</p>
              {a.tags.length > 0 && <div className="co-card__rodape">{a.tags.slice(0, 4).map((t) => <span key={t} className="co-tag">#{t}</span>)}</div>}
            </ClickCard>
          ))}
        </div>
      )}
    </div>
  );
}

/** Captura de página: o servidor busca (bloqueando endereços internos) e guarda o texto como dado. */
export function CapturaPagina({ ocupado, onCapturar }: { ocupado: boolean; onCapturar: (url: string) => Promise<boolean> }) {
  const [url, setUrl] = useState('');
  return (
    <div className="iv-card">
      <h2 className="iv-section-label">Guardar uma página da web</h2>
      <form className="co-add__linha" onSubmit={async (e) => { e.preventDefault(); if (url.trim() && await onCapturar(url.trim())) setUrl(''); }}>
        <span className="p-input-icon-left co-grow">
          <i className="pi pi-link" aria-hidden="true" />
          <InputText value={url} onChange={(e) => setUrl(e.target.value)} className="co-w100" aria-label="URL da página" placeholder="https://exemplo.example/artigo" />
        </span>
        <Button type="submit" label="Capturar" icon={ocupado ? 'pi pi-spinner pi-spin' : 'pi pi-download'} disabled={ocupado || !url.trim()} />
      </form>
      <p className="co-nota iv-mt">Conteúdo da web é guardado como dado e nunca tratado como instrução.</p>
    </div>
  );
}
