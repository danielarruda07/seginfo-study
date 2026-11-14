import { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import type { VaultEntry } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard, copySensitiveToClipboard } from '@/lib/clipboard';
import * as vault from '@/services/vault';
import { MASCARA, estadoTeste, hrefSeguro } from './regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Volta a mascarar sozinho depois deste tempo, mesmo com a ficha aberta. */
const REVELAR_MS = 30_000;

/**
 * Ficha da credencial. O segredo abre SEMPRE mascarado; "Revelar" mostra por 30 s ou até trocar de item
 * (o pai monta com key={id}) ou fechar a ficha. O segredo nunca vai para title, aria-label, URL ou console.
 */
export function CredencialDrawer({ entry: e, nav, nomeAtivo, onEditar, onTestadaHoje, onExcluir }: {
  entry: VaultEntry; nav: Nav; nomeAtivo?: string;
  onEditar: () => void; onTestadaHoje: () => void; onExcluir: () => void;
}) {
  const [revelado, setRevelado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const teste = estadoTeste(e.confirmadoEm);
  const href = hrefSeguro(e.url);

  useEffect(() => {
    if (!revelado) return;
    const t = setTimeout(() => setRevelado(false), REVELAR_MS);
    return () => clearTimeout(t);
  }, [revelado]);

  // lido só na hora de mostrar/copiar; com o cofre travado a tela inteira some antes disso
  const segredo = () => (vault.isUnlocked() ? vault.getSecret(e.id) : '');

  async function copiar() {
    await copySensitiveToClipboard(segredo());
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-key', label: 'Credencial' }} ariaLabel={`Ficha da credencial ${e.titulo}`}
      status={<>
        <Pill label={teste.rotulo} tone={teste.tone} icon={teste.tone === 'ok' ? 'pi-check' : 'pi-clock'} />
        {nomeAtivo && <Pill label={nomeAtivo} icon="pi-server" />}
      </>}
      title={e.titulo}
      subtitle={e.usuario ? `Usuário ${e.usuario}` : 'Sem usuário cadastrado'}
      actions={<>
        <Button label="Editar" icon="pi pi-pencil" size="small" onClick={onEditar} />
        <Button label="Testada hoje" icon="pi pi-check" size="small" outlined onClick={onTestadaHoje} />
        <Button label="Excluir" icon="pi pi-trash" size="small" text severity="danger" onClick={onExcluir} />
      </>}>

      <section aria-labelledby="ca-segredo-titulo">
        <h3 id="ca-segredo-titulo" className="iv-section-label">Segredo</h3>
        <div className="ca-segredo">
          <code className="ca-segredo__valor" data-revelado={revelado || undefined}>
            {revelado ? (segredo() || '(vazio)') : <span aria-label="Segredo oculto">{MASCARA}</span>}
          </code>
          <span className="iv-row">
            <Button label={revelado ? 'Ocultar' : 'Revelar'} icon={revelado ? 'pi pi-eye-slash' : 'pi pi-eye'} size="small" outlined
              aria-pressed={revelado} onClick={() => setRevelado((v) => !v)} />
            <Button label={copiado ? 'Copiado' : 'Copiar'} icon={copiado ? 'pi pi-check' : 'pi pi-copy'} size="small" onClick={() => void copiar()} />
          </span>
        </div>
        <p className="iv-muted ca-small ca-mb0" role="status">
          {copiado ? 'Copiado. A área de transferência é limpa em 30 s (se o navegador permitir).'
            : revelado ? 'Visível por 30 s; volta a mascarar ao fechar a ficha ou trocar de item.'
            : 'Mascarado. Revele só quando ninguém estiver olhando a tela.'}
        </p>
      </section>

      <section>
        <h3 className="iv-section-label">Acesso</h3>
        <DetailFields items={[
          ['Usuário', e.usuario ? (
            <span className="iv-row"><span className="mono">{e.usuario}</span>
              <Button icon="pi pi-copy" text size="small" aria-label="Copiar usuário" tooltip="Copiar usuário" onClick={() => copyToClipboard(e.usuario)} /></span>
          ) : ''],
          ['URL / host', e.url ? (
            <span className="iv-row iv-wrap">
              {href ? <a href={href} target="_blank" rel="noreferrer noopener" className="mono">{e.url}</a> : <span className="mono">{e.url}</span>}
              <Button icon="pi pi-copy" text size="small" aria-label="Copiar URL" tooltip="Copiar URL" onClick={() => copyToClipboard(e.url)} />
            </span>
          ) : ''],
          ['Ativo vinculado', e.ativoId ? (nomeAtivo ?? 'Ativo removido do inventário') : ''],
        ]} />
      </section>

      <section>
        <h3 className="iv-section-label">Manutenção</h3>
        <DetailFields items={[
          ['Testada em', teste.texto],
          ['Atualizada em', e.atualizadoEm ? new Date(e.atualizadoEm).toLocaleString('pt-BR') : ''],
        ]} />
      </section>

      {e.notas && (
        <section>
          <h3 className="iv-section-label">Notas</h3>
          <div className="ca-texto">{e.notas}</div>
        </section>
      )}
    </DetailDrawer>
  );
}
