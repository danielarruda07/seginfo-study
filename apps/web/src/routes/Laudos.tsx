import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailSection } from '@/components/ui/Detail';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { getPericia, listarPericias, type PericiaItem } from '@/services/pericia';

/**
 * Laudos dos alvos reais do honeypot: o que o invasor deixou na máquina em cada janela
 * (entre um reset e outro), visto de fora pelo agente QEMU, sem nada instalado no alvo.
 */

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const tamanho = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

/** Quanto o invasor avançou nesta janela: guia a cor do cartão. */
function gravidade(p: PericiaItem): 'danger' | 'serious' | 'warning' | 'muted' {
  const r = p.resumo;
  if (r.persistencia > 0) return 'danger';
  if (r.executaveis > 0 || r.amostras > 0) return 'serious';
  if (r.saidasBloqueadas > 0 || r.arquivos > 0) return 'warning';
  return 'muted';
}
const ROTULO_GRAVIDADE = { danger: 'deixou persistência', serious: 'deixou executável', warning: 'atividade', muted: 'limpo' } as const;

function Cartao({ p, onOpen, selected }: { p: PericiaItem; onOpen: () => void; selected: boolean }) {
  const g = gravidade(p);
  const r = p.resumo;
  return (
    <ClickCard onOpen={onOpen} selected={selected} tone={g} label={`Abrir laudo de ${p.alvo} de ${dataHora(p.janelaFim)}`}>
      <div className="iv-row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <strong>{p.alvo}</strong>
        <Pill label={ROTULO_GRAVIDADE[g]} tone={g} />
      </div>
      <p className="iv-muted" style={{ margin: '.2rem 0 .5rem', fontSize: '.82rem' }}>
        {p.sistema === 'linux' ? 'Linux' : 'Windows'} · {dataHora(p.janelaInicio)} → {hora(p.janelaFim)}
      </p>
      <div className="laudo-numeros">
        <span><strong>{r.arquivos}</strong> arquivos</span>
        <span><strong>{r.executaveis}</strong> executáveis</span>
        <span><strong>{r.persistencia}</strong> persistência</span>
        <span><strong>{r.saidasBloqueadas}</strong> saídas bloqueadas</span>
      </div>
    </ClickCard>
  );
}

function Ficha({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['pericia', id], queryFn: () => getPericia(id) });
  if (q.isLoading) return <p className="iv-muted">Carregando o laudo…</p>;
  if (q.isError || !q.data) return <Message severity="warn" text="Não foi possível carregar o laudo." />;
  const { dados: d, invasores } = q.data;
  const executaveis = d.arquivos.filter((a) => a.executavel || a.tipo === 'elf' || a.tipo === 'pe');
  const outros = d.arquivos.filter((a) => !executaveis.includes(a));
  const saidas = [...d.saidas].sort((a, b) => b.tentativas - a.tentativas);

  return (
    <>
      {d.erros.length > 0 && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          Parte da coleta falhou: {d.erros.join(' · ')}
        </StatusStrip>
      )}

      <DetailSection title={`Quem agiu nesta janela (${invasores.length})`}>
        {invasores.length === 0
          ? <p className="iv-muted">Nenhum login, comando ou arquivo registrado no Radar para este alvo na janela.</p>
          : (
            <table className="laudo-tabela">
              <thead><tr><th>IP</th><th>Entradas</th><th>Comandos</th><th>Arquivos</th><th>Período</th></tr></thead>
              <tbody>{invasores.map((i) => (
                <tr key={i.ip}>
                  <td><code>{i.ip}</code>{i.pais ? ` · ${i.pais}` : ''}</td>
                  <td>{i.logins}</td><td>{i.comandos}</td><td>{i.arquivos}</td>
                  <td>{hora(i.primeira)}–{hora(i.ultima)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        <p className="iv-muted" style={{ fontSize: '.8rem' }}>Abra o Radar e clique num evento de um desses IPs para ver a sessão comando a comando.</p>
      </DetailSection>

      <DetailSection title={`Para onde o malware tentou ligar (${saidas.length} destinos)`}>
        {saidas.length === 0
          ? <p className="iv-muted">Nenhuma tentativa de saída bloqueada pelo firewall na janela.</p>
          : (
            <table className="laudo-tabela">
              <thead><tr><th>Destino</th><th>Porta</th><th>Tentativas</th><th>Período</th></tr></thead>
              <tbody>{saidas.slice(0, 60).map((s) => (
                <tr key={`${s.destino}:${s.porta}:${s.protocolo}`}>
                  <td><code>{s.destino}</code></td><td>{s.porta ?? '—'}{s.protocolo ? `/${s.protocolo}` : ''}</td>
                  <td>{s.tentativas}</td><td>{hora(s.primeira)}–{hora(s.ultima)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        <p className="iv-muted" style={{ fontSize: '.8rem' }}>
          O alvo não tem saída para a internet: cada linha é uma conexão que o firewall barrou. Porta 80/443 costuma ser
          download do próximo estágio ou servidor de comando; 3333, 4444, 5555 e 14444 são típicas de pool de mineração.
        </p>
      </DetailSection>

      <DetailSection title={`Executáveis criados ou alterados (${executaveis.length})`}>
        {executaveis.length === 0 ? <p className="iv-muted">Nenhum.</p> : executaveis.map((a) => (
          <div key={a.caminho} className="laudo-arquivo">
            <code>{a.caminho}</code> <Pill label={a.tipo.toUpperCase()} color="#b91c1c" /> <span className="iv-muted">{tamanho(a.tamanho)}</span>
            {a.sha256 && <div>SHA-256 <code>{a.sha256}</code>{' '}
              <a href={`https://www.virustotal.com/gui/file/${a.sha256}`} target="_blank" rel="noreferrer noopener">VirusTotal</a></div>}
          </div>
        ))}
        {d.amostras.some((a) => a.guardada) && (
          <p className="iv-muted" style={{ fontSize: '.8rem' }}>
            {d.amostras.filter((a) => a.guardada).length} amostra(s) guardada(s) na VM do Wazuh (inertes, só leitura, nome = SHA-256)
            para análise. O app guarda só o hash.
          </p>
        )}
      </DetailSection>

      <DetailSection title={`Persistência (${d.persistencia.length})`}>
        {d.persistencia.length === 0 ? <p className="iv-muted">Nada que garanta a volta do invasor depois de um reboot.</p> : d.persistencia.map((x, i) => (
          <div key={`${x.onde}${i}`} className="laudo-arquivo">
            <Pill label={x.tipo} color="#7c3aed" /> <code>{x.onde}</code>
            <pre className="laudo-pre">{x.conteudo}</pre>
          </div>
        ))}
      </DetailSection>

      <DetailSection title={`Processos do invasor em execução (${d.processos.length})`}>
        {d.processos.length === 0 ? <p className="iv-muted">Nenhum processo iniciado na janela continua rodando.</p> : (
          <table className="laudo-tabela">
            <thead><tr><th>PID</th><th>Usuário</th><th>Comando</th></tr></thead>
            <tbody>{d.processos.map((p) => <tr key={p.pid}><td>{p.pid}</td><td>{p.usuario ?? '—'}</td><td><code>{p.comando}</code></td></tr>)}</tbody>
          </table>
        )}
      </DetailSection>

      {d.conexoes.length > 0 && (
        <DetailSection title={`Conexões abertas no momento da coleta (${d.conexoes.length})`}>
          <table className="laudo-tabela">
            <thead><tr><th>Remoto</th><th>Estado</th><th>Processo</th></tr></thead>
            <tbody>{d.conexoes.map((c, i) => <tr key={i}><td><code>{c.remoto}</code></td><td>{c.estado ?? '—'}</td><td>{c.processo ?? '—'}</td></tr>)}</tbody>
          </table>
        </DetailSection>
      )}

      <DetailSection title={`Outros arquivos alterados (${outros.length})`}>
        {outros.length === 0 ? <p className="iv-muted">Nenhum.</p> : (
          <ul className="laudo-lista">{outros.slice(0, 150).map((a) => <li key={a.caminho}><code>{a.caminho}</code> <span className="iv-muted">{tamanho(a.tamanho)}</span></li>)}</ul>
        )}
      </DetailSection>

      {d.observacoes.length > 0 && (
        <DetailSection title="Observações da coleta">
          <ul className="laudo-lista">{d.observacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </DetailSection>
      )}
    </>
  );
}

export function Laudos() {
  const q = useQuery({ queryKey: ['pericias'], queryFn: listarPericias, refetchInterval: 60_000 });
  const lista = useMemo(() => q.data ?? [], [q.data]);
  const sel = useDrawerSelection(lista);

  return (
    <div>
      <PageHeader
        title="Laudos do laboratório"
        subtitle="O que os invasores deixaram nas máquinas reais do honeypot, coletado antes de cada reset."
      />
      <StatusStrip icon="pi-info-circle">
        Os alvos reais voltam ao estado limpo a cada 6 horas. Logo antes, a VM do Wazuh inspeciona cada um pelo agente do
        Proxmox (nada é instalado no alvo, para o invasor não perceber) e registra arquivos novos, persistência, processos,
        conexões e as tentativas de saída que o firewall bloqueou.
      </StatusStrip>

      {q.isError && <Message severity="warn" style={{ width: '100%', marginTop: '1rem' }} text="API indisponível." />}
      {q.isSuccess && lista.length === 0 && (
        <p className="iv-muted iv-mt">Nenhum laudo ainda. O primeiro chega no próximo reset (00h, 06h, 12h ou 18h).</p>
      )}

      <div className="grid-cards iv-mt">
        {lista.map((p) => <Cartao key={p.id} p={p} selected={sel.isOpen(p.id)} onOpen={() => sel.open(p.id)} />)}
      </div>

      {sel.item && (
        <DetailDrawer
          {...sel.nav}
          wide
          kind={{ icon: 'pi-file-check', label: 'Laudo' }}
          status={<Pill label={ROTULO_GRAVIDADE[gravidade(sel.item)]} tone={gravidade(sel.item)} />}
          title={sel.item.alvo}
          subtitle={`${sel.item.sistema === 'linux' ? 'Linux' : 'Windows'} · janela ${dataHora(sel.item.janelaInicio)} → ${dataHora(sel.item.janelaFim)}`}
          ariaLabel={`Laudo de ${sel.item.alvo}`}
        >
          <Ficha id={sel.item.id} />
        </DetailDrawer>
      )}
    </div>
  );
}
