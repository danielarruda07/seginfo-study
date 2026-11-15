import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import {
  criarAlvo, getExposicao, nomeDoAlvo, ordenarMudancas, removerAlvo, tipoDoTexto, varrerAlvo,
  type AlvoExposicao,
} from '@/services/exposicao';
import { quando, SEVERIDADE } from './inteligencia/exposicao/comum';
import { ExposicaoDrawer } from './inteligencia/exposicao/ExposicaoDrawer';
import '@/styles/telas/inteligencia.css';
import '@/styles/telas/exposicao.css';

const erroDe = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;

const TIPO_ROTULO = { dominio: 'Domínio', ip: 'IP', 'ip-publico': 'IP público' } as const;

export function Exposicao() {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [varrendo, setVarrendo] = useState<Set<string>>(new Set());

  const painel = useQuery({ queryKey: ['exposicao'], queryFn: getExposicao, retry: false, staleTime: 60_000 });
  const alvos = useMemo(() => painel.data?.alvos ?? [], [painel.data]);
  const temIpPublico = alvos.some((a) => a.tipo === 'ip-publico');
  const atualizar = () => qc.invalidateQueries({ queryKey: ['exposicao'] });

  async function varrer(id: string) {
    setErro(null);
    setVarrendo((s) => new Set(s).add(id));
    try {
      await varrerAlvo(id);
    } catch (e) {
      setErro(erroDe(e, 'A varredura falhou.'));
    } finally {
      setVarrendo((s) => { const n = new Set(s); n.delete(id); return n; });
      void atualizar();
    }
  }

  const adicionar = useMutation({
    mutationFn: ({ tipo, valor }: { tipo: AlvoExposicao['tipo']; valor?: string }) => criarAlvo(tipo, valor),
    onSuccess: async (alvo) => {
      setTexto('');
      await atualizar();
      void varrer(alvo.id); // primeira varredura já na inclusão
    },
    onError: (e) => setErro(erroDe(e, 'Não foi possível incluir o alvo.')),
  });

  function incluirTexto() {
    const v = texto.trim();
    if (!v) return;
    setErro(null);
    adicionar.mutate({ tipo: tipoDoTexto(v), valor: v });
  }

  function remover(a: AlvoExposicao) {
    confirmDialog({
      header: 'Parar de acompanhar',
      message: `Remover "${nomeDoAlvo(a)}" e todo o histórico de varreduras dele?`,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await removerAlvo(a.id);
          if (aberto === a.id) setAberto(null);
          await atualizar();
        } catch (e) {
          setErro(erroDe(e, 'Falha ao remover.'));
        }
      },
    });
  }

  const nomePorId = useMemo(() => new Map(alvos.map((a) => [a.id, nomeDoAlvo(a)])), [alvos]);
  const mudancas = useMemo(() => ordenarMudancas(painel.data?.mudancas ?? []), [painel.data]);
  const totais = useMemo(() => alvos.reduce((t, a) => ({
    portas: t.portas + (a.ultima?.resumo.portas ?? 0),
    cves: t.cves + (a.ultima?.resumo.cves ?? 0),
    avisos: t.avisos + (a.ultima?.resumo.avisosDns ?? 0),
  }), { portas: 0, cves: 0, avisos: 0 }), [alvos]);
  const semana = Date.now() - 7 * 86_400_000;
  const altasSemana = mudancas.filter((m) => m.severidade === 'alta' && new Date(m.criadoEm).getTime() >= semana).length;
  const alvoAberto = alvos.find((a) => a.id === aberto) ?? null;

  return (
    <div>
      <ConfirmDialog />
      <PageHeader title="Minha exposição"
        subtitle="O que a internet já sabe sobre os seus domínios e IPs, e o que mudou desde a última olhada." />

      <form className="ex-incluir iv-card" onSubmit={(e) => { e.preventDefault(); incluirTexto(); }}>
        <label htmlFor="ex-alvo" className="iv-section-label">Acompanhar</label>
        <div className="ex-incluir__linha">
          <InputText id="ex-alvo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="seu domínio ou IP público (ex.: exemplo.com.br)"
            maxLength={253} className="ex-incluir__campo" aria-describedby="ex-fontes" />
          <Button type="submit" label="Acompanhar" icon="pi pi-plus" disabled={!texto.trim()} loading={adicionar.isPending} />
          <Button type="button" label="Meu IP público" icon="pi pi-globe" outlined disabled={temIpPublico || adicionar.isPending}
            tooltip={temIpPublico ? 'Já está na lista' : 'O IP de saída do servidor (a sua conexão, se o app roda em casa)'}
            onClick={() => { setErro(null); adicionar.mutate({ tipo: 'ip-publico' }); }} />
        </div>
        <p id="ex-fontes" className="in-muted-p">
          Só fontes públicas, nada toca no alvo: certificados emitidos (crt.sh), o que o Shodan viu nas varreduras dele (InternetDB) e o DNS público
          (Cloudflare e Google).{painel.data && (painel.data.intervaloHoras > 0
            ? ` Repete sozinho a cada ${painel.data.intervaloHoras} h.`
            : ' Repetição automática desligada (EXPOSICAO_INTERVALO_HORAS=0).')} Use só com o que é seu ou autorizado.
        </p>
      </form>

      {erro && <StatusStrip tone="crit" icon="pi-exclamation-triangle">{erro}</StatusStrip>}
      {painel.isError && (
        <StatusStrip tone="crit" icon="pi-exclamation-triangle">
          Não foi possível carregar. Esta página precisa da API (modo servidor).{' '}
          <button type="button" className="iv-linkbtn" onClick={() => void painel.refetch()}>Tentar de novo</button>
        </StatusStrip>
      )}

      <div className="iv-kpis iv-mt">
        <Kpi label="Alvos" icon="pi-bullseye" value={painel.isLoading ? '…' : alvos.length} hint="domínios e IPs acompanhados" />
        <Kpi label="Portas expostas" icon="pi-sitemap" tone="serious" value={totais.portas} hint="vistas pelo Shodan" />
        <Kpi label="CVEs prováveis" icon="pi-shield" tone="danger" value={totais.cves} hint="pela versão do software" />
        <Kpi label="Mudanças graves (7 dias)" icon="pi-bell" tone="danger" value={altasSemana} hint="porta nova ou CVE nova" />
      </div>

      <section className="iv-mt" aria-labelledby="ex-alvos">
        <h3 id="ex-alvos" className="iv-section-label">Alvos</h3>
        {painel.isLoading ? <p className="in-muted-p" role="status">Carregando…</p>
          : alvos.length === 0 ? (
            <EmptyState icon="pi-globe" title="Nada acompanhado ainda"
              text={'Comece por "Meu IP público": mostra as portas que a internet enxerga na sua conexão.'} />
          ) : (
            <ul className="ex-alvos">
              {alvos.map((a) => (
                <AlvoCard key={a.id} a={a} varrendo={varrendo.has(a.id)}
                  onAbrir={() => setAberto(a.id)} onVarrer={() => void varrer(a.id)} onRemover={() => remover(a)} />
              ))}
            </ul>
          )}
      </section>

      <section className="iv-card iv-mt" aria-labelledby="ex-mudou">
        <h3 id="ex-mudou" className="iv-section-label">O que mudou</h3>
        {mudancas.length === 0 ? (
          <p className="in-muted-p">
            Nenhuma mudança registrada. A primeira varredura de cada alvo vira a referência; a partir da segunda, aparece aqui o que entrou ou saiu.
          </p>
        ) : (
          <ol className="ex-mudancas">
            {mudancas.map((m) => {
              const s = SEVERIDADE[m.severidade];
              return (
                <li key={m.id} className="ex-mudanca">
                  <Pill label={s.rotulo} tone={s.tone} icon={s.icon} />
                  <span className="ex-mudanca__texto">{m.texto}</span>
                  <span className="ex-mudanca__meta">{nomePorId.get(m.alvoId) ?? 'alvo removido'} · {quando(m.criadoEm)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {alvoAberto && <ExposicaoDrawer alvo={alvoAberto} varrendo={varrendo.has(alvoAberto.id)} onVarrer={() => void varrer(alvoAberto.id)} onClose={() => setAberto(null)} />}
    </div>
  );
}

function AlvoCard({ a, varrendo, onAbrir, onVarrer, onRemover }: {
  a: AlvoExposicao; varrendo: boolean; onAbrir: () => void; onVarrer: () => void; onRemover: () => void;
}) {
  const u = a.ultima;
  const r = u?.resumo;
  const falhas = u?.resultado.erros ?? [];
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);
  return (
    <li className="iv-card ex-alvo">
      <div className="ex-alvo__topo">
        <button type="button" className="ex-alvo__nome" onClick={onAbrir}>{nomeDoAlvo(a)}</button>
        <Pill label={TIPO_ROTULO[a.tipo]} tone="muted" />
      </div>
      <p className="ex-alvo__sub">
        {varrendo ? 'Varrendo agora… (crt.sh pode levar até 1 minuto)'
          : u ? `Última varredura: ${quando(u.criadoEm)}${a.tipo === 'ip-publico' && r?.ips[0] ? ` · ${r.ips[0]}` : ''}`
          : 'Ainda não varrido.'}
      </p>
      {u?.erro ? <p className="ex-alvo__erro"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Nenhuma fonte respondeu: {u.erro}</p>
        : falhas.length > 0 && <p className="ex-alvo__erro"><i className="pi pi-info-circle" aria-hidden="true" /> Sem resposta de: {falhas.map((f) => f.fonte).join(', ')}. O resto foi salvo.</p>}
      <dl className="ex-numeros">
        <div><dt>Portas</dt><dd data-alerta={(r?.portas ?? 0) > 0 || undefined}>{num(r?.portas)}</dd></div>
        {a.tipo === 'dominio' && <div><dt>Subdomínios</dt><dd>{num(r?.subdominios)}</dd></div>}
        <div><dt>CVEs</dt><dd data-alerta={(r?.cves ?? 0) > 0 || undefined}>{num(r?.cves)}</dd></div>
        {a.tipo === 'dominio' && <div><dt>Avisos DNS</dt><dd data-alerta={(r?.avisosDns ?? 0) > 0 || undefined}>{num(r?.avisosDns)}</dd></div>}
      </dl>
      <div className="ex-alvo__acoes">
        <Button label="Detalhes" icon="pi pi-list" size="small" text onClick={onAbrir} disabled={!u} />
        <Button label="Varrer agora" icon="pi pi-refresh" size="small" outlined loading={varrendo} onClick={onVarrer} />
        <Button icon="pi pi-trash" size="small" text severity="danger" aria-label={`Remover ${nomeDoAlvo(a)}`} onClick={onRemover} />
      </div>
    </li>
  );
}
