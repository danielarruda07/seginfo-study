import { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import type { Ativo } from '@seginfo/shared';
import { Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { TIPO_ATIVO_LABEL, type Tone } from '@/theme/status';
import { getDescoberta, type Descoberta, type FonteDescoberta } from '@/services/descoberta';
import { aplicarSincronizacao, previaSincronizacao } from '@/services/inventario';
import { erroApi } from '@/services/agentes';
import { TIPO_ICON } from './regras';

const NOME_FONTE: Record<FonteDescoberta['fonte'], string> = { proxmox: 'Proxmox', fortigate: 'FortiGate', switch: 'Switch' };
const ESTADO_FONTE: Record<FonteDescoberta['estado'], { label: string; tone?: Tone; icon: string }> = {
  ok: { label: 'respondeu', tone: 'ok', icon: 'pi-check' },
  parcial: { label: 'respondeu em parte', tone: 'serious', icon: 'pi-exclamation-triangle' },
  erro: { label: 'falhou', tone: 'danger', icon: 'pi-times' },
  nao_configurado: { label: 'não configurado', icon: 'pi-minus' },
};

interface Props {
  visible: boolean;
  onHide: () => void;
  onAplicado: (r: { novos: number; atualizados: number }) => void;
}

function Linha({ a, extra }: { a: Ativo; extra?: string }) {
  return (
    <li className="iv-row" style={{ gap: '.5rem', fontSize: '.85rem', padding: '.15rem 0' }}>
      <i className={`pi ${TIPO_ICON[a.tipo]}`} aria-hidden="true" title={TIPO_ATIVO_LABEL[a.tipo]} />
      <span style={{ flex: 1, minWidth: 0 }}>{a.nome}{a.endereco ? <span className="iv-muted mono"> · {a.endereco}</span> : null}</span>
      {extra && <span className="iv-muted" style={{ fontSize: '.78rem' }}>{extra}</span>}
    </li>
  );
}

function Grupo({ titulo, itens, limite = 25 }: { titulo: string; itens: { a: Ativo; extra?: string }[]; limite?: number }) {
  if (itens.length === 0) return null;
  return (
    <details open={itens.length <= 8} style={{ marginTop: '.75rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{titulo} ({itens.length})</summary>
      <ul style={{ listStyle: 'none', margin: '.35rem 0 0', padding: 0 }}>
        {itens.slice(0, limite).map((i) => <Linha key={i.a.id} a={i.a} extra={i.extra} />)}
      </ul>
      {itens.length > limite && <p className="iv-muted" style={{ fontSize: '.78rem', margin: '.25rem 0 0' }}>e mais {itens.length - limite}.</p>}
    </details>
  );
}

/**
 * Prévia de "Sincronizar com o ambiente": o servidor consulta o laboratório (só leitura), aqui
 * você vê o que entra e o que muda, e só então aplica. Nada é apagado do inventário.
 */
export function SincronizarAmbiente({ visible, onHide, onAplicado }: Props) {
  const [dados, setDados] = useState<Descoberta | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const consultar = () => {
    setCarregando(true);
    setErro('');
    setDados(null);
    getDescoberta()
      .then(setDados)
      .catch((e) => setErro(erroApi(e, 'Não foi possível consultar o ambiente.')))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { if (visible) consultar(); }, [visible]);

  const todasOk = !!dados && dados.fontes.every((f) => f.estado === 'ok' || f.estado === 'nao_configurado');
  const plano = useMemo(() => (dados ? previaSincronizacao(dados.ativos, todasOk) : null), [dados, todasOk]);
  const mudancas = (plano?.novos.length ?? 0) + (plano?.atualizados.length ?? 0);

  const aplicar = () => {
    if (!dados) return;
    onAplicado(aplicarSincronizacao(dados.ativos));
    onHide();
  };

  return (
    <Dialog header="Sincronizar com o ambiente" visible={visible} onHide={onHide} style={{ width: 'min(760px, 96vw)' }} modal dismissableMask
      footer={<>
        <Button label="Cancelar" text onClick={onHide} />
        <Button label="Consultar de novo" icon="pi pi-refresh" outlined onClick={consultar} disabled={carregando} />
        <Button label={mudancas ? `Aplicar (${plano?.novos.length} novos, ${plano?.atualizados.length} atualizados)` : 'Nada para aplicar'}
          icon="pi pi-check" onClick={aplicar} disabled={!plano || mudancas === 0} />
      </>}>
      <p className="iv-muted" style={{ marginTop: 0, fontSize: '.88rem' }}>
        O servidor consulta o Proxmox, o FortiGate e o switch <strong>só com leitura</strong> e mostra o que encontrou. Nada muda no inventário até você aplicar,
        e nada é apagado: função, criticidade, exposição e labs que você preencheu continuam como estão.
      </p>

      {carregando && (
        <div className="iv-row" style={{ gap: '.75rem', padding: '1rem 0' }}>
          <ProgressSpinner style={{ width: 32, height: 32 }} strokeWidth="5" />
          <span>Consultando o laboratório… pode levar alguns segundos.</span>
        </div>
      )}
      {erro && <Message severity="error" text={erro} style={{ width: '100%' }} />}

      {dados && plano && (
        <>
          <div className="iv-row iv-wrap" style={{ gap: '.5rem' }}>
            {dados.fontes.map((f) => {
              const e = ESTADO_FONTE[f.estado];
              return (
                <span key={f.fonte} title={f.detalhe}>
                  <Pill label={`${NOME_FONTE[f.fonte]}: ${e.label}${f.estado === 'ok' || f.estado === 'parcial' ? ` (${f.itens})` : ''}`} tone={e.tone} icon={e.icon} />
                </span>
              );
            })}
            <span className="iv-muted" style={{ fontSize: '.78rem' }}>em {(dados.duracaoMs / 1000).toFixed(1)} s</span>
          </div>
          {dados.fontes.filter((f) => f.detalhe && f.estado !== 'ok').map((f) => (
            <p key={f.fonte} className="iv-muted" style={{ fontSize: '.78rem', margin: '.35rem 0 0' }}><strong>{NOME_FONTE[f.fonte]}:</strong> {f.detalhe}</p>
          ))}

          <div className="iv-kpis iv-mt">
            <Kpi label="Novos" icon="pi-plus" value={plano.novos.length} />
            <Kpi label="Atualizados" icon="pi-pencil" value={plano.atualizados.length} />
            <Kpi label="Sem mudança" icon="pi-check" value={plano.iguais.length} />
            <Kpi label="Não vistos agora" icon="pi-eye-slash" value={todasOk ? plano.naoVistos.length : '—'}
              hint={todasOk ? 'continuam no inventário' : 'uma fonte não respondeu'} />
          </div>

          <Grupo titulo="Novos" itens={plano.novos.map((a) => ({ a }))} />
          <Grupo titulo="Atualizados" itens={plano.atualizados.map((u) => ({ a: u.depois, extra: u.campos.join(', ') }))} />
          {todasOk && plano.naoVistos.length > 0 && (
            <>
              <Grupo titulo="Não vistos nesta varredura" itens={plano.naoVistos.map((a) => ({ a }))} />
              <StatusStrip icon="pi-info-circle">
                Itens desligados, fora da rede ou celulares que trocaram de MAC não aparecem numa varredura. Eles <strong>não</strong> são apagados; remova à mão se não existirem mais.
              </StatusStrip>
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
