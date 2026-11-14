import type { ReactNode } from 'react';
import { ClickCard } from '@/components/ui/ClickCard';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import type { StorageStatus } from '@/services/armazenamento';
import { fmtData, fmtTam, resumoBackups } from './regras';

function selo(s: StorageStatus | undefined, erro = false) {
  if (!s) return erro ? <Pill label="Sem resposta da API" tone="warning" icon="pi-exclamation-triangle" /> : <Pill label="Carregando" tone="muted" icon="pi-spinner" />;
  if (!s.configurado) return <Pill label="Configuração pendente" tone="warning" icon="pi-cog" />;
  if (!s.conectado) return <Pill label="Não conectado" tone="warning" icon="pi-link" />;
  if (s.ultimoErro) return <Pill label="Último backup falhou" tone="danger" icon="pi-times-circle" />;
  return <Pill label="Conectado" tone="ok" icon="pi-check" />;
}

/** Cartão do destino (OneDrive pessoal) com as ações; o clique abre a ficha com o que é guardado e como. */
export function DestinoCard({ s, erro, selected, onOpen, acoes }: { s: StorageStatus | undefined; erro?: boolean; selected: boolean; onOpen: () => void; acoes: ReactNode }) {
  const r = resumoBackups(s?.backups ?? [], s?.retencao ?? 14);
  const tone = !s ? undefined : s.ultimoErro ? 'danger' : !s.configurado || !s.conectado ? 'warning' : undefined;
  return (
    <ClickCard onOpen={onOpen} selected={selected} tone={tone} label="Abrir detalhes do destino OneDrive" className="iv-mt">
      <div className="ca-post__meta">
        <i className="pi pi-cloud ca-destino__icone" aria-hidden="true" />
        <strong className="ca-flex1">OneDrive pessoal</strong>
        {selo(s, erro)}
      </div>
      <p className="iv-muted ca-small ca-destino__linha">
        {s?.conectado ? <>Conta <strong>{s.contaNome ?? 'conectada'}</strong> · </> : null}
        Backup {s?.automatico ? 'automático a cada 24 h' : 'só manual'} · mantém {s?.retencao ?? 14} cópias
        {r.usoBytes > 0 && <> · ~{fmtTam(r.usoBytes)} em uso</>}
      </p>
      {s && !s.configurado && s.faltando.length > 0 && (
        <div className="iv-row iv-wrap ca-small ca-mb">
          <span className="iv-muted">Falta no servidor (Coolify):</span>
          {s.faltando.map((v) => <Pill key={v} label={v} tone="warning" />)}
        </div>
      )}
      <div className="iv-row iv-wrap">{acoes}</div>
    </ClickCard>
  );
}

/** Ficha do destino: o que vai no backup, proteção, última execução e uso estimado. */
export function DestinoDrawer({ s, onClose }: { s: StorageStatus; onClose: () => void }) {
  const r = resumoBackups(s.backups, s.retencao);
  return (
    <DetailDrawer onClose={onClose} kind={{ icon: 'pi-cloud', label: 'Destino de backup' }} ariaLabel="Ficha do destino OneDrive"
      status={selo(s)} title="OneDrive pessoal" subtitle="Cópia cifrada fora do lab: sobrevive à perda da VM ou do Proxmox.">
      <section>
        <h3 className="iv-section-label">O que guarda</h3>
        <ul className="ca-bullets">
          <li>O que está no banco do servidor (PostgreSQL): LinkedIn, Radar e Segundo Cérebro. Memórias corporativas ficam de fora.</li>
          <li>Um arquivo <code>.sgb</code> por execução, em <code>/Apps/…/backups</code> no seu OneDrive.</li>
        </ul>
        <p className="ca-aviso"><i className="pi pi-info-circle" aria-hidden="true" /> A maioria das telas de estudo ainda grava no navegador: isso não entra aqui. Use Cofre → Backup e restauração (ou "Importar no servidor").</p>
      </section>
      <section>
        <h3 className="iv-section-label">Como é protegido</h3>
        <ul className="ca-bullets">
          <li>AES-256-GCM com chave aleatória por backup, embrulhada na chave pública RSA. O servidor só cifra; para ler é preciso a chave privada, que fica fora do lab.</li>
          <li>Permissão <code>Files.ReadWrite.AppFolder</code>: o app só enxerga a própria pasta, não o resto do OneDrive.</li>
        </ul>
      </section>
      <section>
        <h3 className="iv-section-label">Execução</h3>
        <DetailFields items={[
          ['Último backup enviado', r.ultimoOk ? `${fmtData(r.ultimoOk.criadoEm)} · ${fmtTam(r.ultimoOk.tamanhoBytes)}` : 'Nenhum ainda'],
          ['Última falha', r.ultimaFalha ? `${fmtData(r.ultimaFalha.criadoEm)}${r.ultimaFalha.erro ? ` · ${r.ultimaFalha.erro}` : ''}` : 'Nenhuma no histórico'],
          ['Agendamento', s.automatico ? 'Automático, a cada 24 h' : 'Desligado: só pelo botão "Fazer backup agora"'],
          ['Histórico', `${r.enviados} enviados e ${r.falhas} com erro nos últimos ${s.backups.length} registros`],
        ]} />
      </section>
      <section>
        <h3 className="iv-section-label">Uso</h3>
        <DetailFields items={[
          ['Retenção', `${s.retencao} backups mais recentes; os mais antigos são apagados do OneDrive`],
          ['Uso estimado', r.usoBytes ? `~${fmtTam(r.usoBytes)} (soma dos enviados dentro da retenção)` : ''],
          ['Conta', s.conectado ? (s.contaNome ?? 'Conectada') : 'Não conectada'],
          ['Conectada desde', s.conectado ? fmtData(s.conectadoEm) : ''],
        ]} />
      </section>
      {!s.configurado && s.faltando.length > 0 && (
        <section>
          <h3 className="iv-section-label">Falta configurar no servidor</h3>
          <div className="iv-row iv-wrap">{s.faltando.map((v) => <Pill key={v} label={v} tone="warning" />)}</div>
          <p className="iv-muted ca-small">Defina no Coolify (guia: <code>docs/ARMAZENAMENTO.md</code>) e faça redeploy.</p>
        </section>
      )}
    </DetailDrawer>
  );
}
