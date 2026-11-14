import { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { confirmDialog } from 'primereact/confirmdialog';
import type { ArsenalItem } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { addArtefato, removeArtefato } from '@/services/arsenal';
import { fmtData } from './regras';

/** Saídas produzidas por um item do arsenal (relatórios, notas) + formulário para anexar. */
export function Artefatos({ item, onChanged }: { item: ArsenalItem; onChanged: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [aberto, setAberto] = useState(false);
  /** artefato HTML em prévia: iframe com sandbox vazio (origem própria, sem scripts) */
  const [vendo, setVendo] = useState<string | null>(null);

  function anexar() {
    if (!titulo.trim()) return;
    const isHtml = conteudo.trimStart().startsWith('<');
    addArtefato(item.id, { titulo: titulo.trim(), tipo: 'relatorio', formato: isHtml ? 'html' : 'md', conteudo });
    setTitulo(''); setConteudo(''); setAberto(false);
    onChanged();
  }

  function remover(id: string, nome: string) {
    confirmDialog({
      header: 'Remover artefato', message: <span>Remover <strong>{nome}</strong> de {item.nome}?</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeArtefato(item.id, id); onChanged(); },
    });
  }

  return (
    <div className="iv-col co-gap-sm">
      {item.artefatos.length === 0 && <p className="co-vazio">Nenhum artefato ainda. Anexe relatórios ou saídas que este item produziu.</p>}
      {item.artefatos.length > 0 && (
        <ul className="co-rel">
          {item.artefatos.map((a) => (
            <li key={a.id} className="co-artefato">
              <span className="co-artefato__info">
                <span className="co-rel__titulo">{a.titulo}</span>
                <span className="co-rel__sub">{a.formato.toUpperCase()} · {fmtData(a.criadoEm)} · {a.conteudo.length.toLocaleString('pt-BR')} caracteres</span>
              </span>
              <span className="iv-row">
                <Pill label={a.formato} tone="muted" />
                {a.formato === 'html' && <Button icon={vendo === a.id ? 'pi pi-eye-slash' : 'pi pi-eye'} text size="small" aria-pressed={vendo === a.id}
                  aria-label={`Visualizar ${a.titulo}`} tooltip="Visualizar (isolado, sem scripts)" onClick={() => setVendo(vendo === a.id ? null : a.id)} />}
                <Button icon="pi pi-copy" text size="small" aria-label={`Copiar ${a.titulo}`} tooltip="Copiar conteúdo" onClick={() => copyToClipboard(a.conteudo)} />
                <Button icon="pi pi-trash" text size="small" severity="danger" aria-label={`Remover ${a.titulo}`} tooltip="Remover" onClick={() => remover(a.id, a.titulo)} />
              </span>
              {vendo === a.id && <iframe className="co-iframe" sandbox="" srcDoc={a.conteudo} title={`Prévia de ${a.titulo}`} />}
            </li>
          ))}
        </ul>
      )}
      {aberto ? (
        <div className="iv-preview iv-col co-gap-sm">
          <label className="co-label" htmlFor="co-art-titulo">Título</label>
          <InputText id="co-art-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Relatório do pentest da API de exemplo" />
          <label className="co-label" htmlFor="co-art-conteudo">Conteúdo (HTML, Markdown ou texto)</label>
          <InputTextarea id="co-art-conteudo" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={4} />
          <span className="iv-row">
            <Button label="Anexar" icon="pi pi-paperclip" size="small" disabled={!titulo.trim()} onClick={anexar} />
            <Button label="Cancelar" text size="small" onClick={() => setAberto(false)} />
          </span>
        </div>
      ) : (
        <span><Button label="Anexar artefato" icon="pi pi-paperclip" size="small" text onClick={() => setAberto(true)} /></span>
      )}
    </div>
  );
}
