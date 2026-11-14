import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip } from '@/components/InfraKit';
import * as vault from '@/services/vault';
import { useVaultActivity } from '@/hooks/useVaultActivity';
import { detectMode } from '@/services/mode';
import { cofre2fa, temSessao, type Status2fa } from '@/services/cofre2fa';
import { CofreAcesso } from './cofre/CofreAcesso';
import { Credenciais } from './cofre/Credenciais';
import { BackupCard } from './cofre/BackupCard';
import { AbrirComCodigo, Painel2fa } from './cofre/Painel2fa';
import '@/styles/telas/carreira.css';

/**
 * Cofre de credenciais. Travado, nada da lista nem das fichas é montado: a lista,
 * a ficha e qualquer segredo revelado somem junto com o destravamento.
 * Com o segundo fator ativo, o servidor guarda o blob cifrado e só o entrega depois do código;
 * a senha-mestra nunca sai do navegador.
 */
export function Cofre() {
  const [initialized, setInitialized] = useState(vault.isInitialized());
  const [unlocked, setUnlocked] = useState(vault.isUnlocked());
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  // null = ainda consultando; false = API fora do ar (Cofre só local)
  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status2fa | null>(null);
  const [comSessao, setComSessao] = useState(temSessao());

  const atualizarStatus = useCallback(async () => {
    if ((await detectMode()) !== 'servidor') { setOnline(false); return; }
    try {
      const s = await cofre2fa.status();
      // o servidor manda: 2FA ativo = Cofre no servidor; desligado em outro aparelho = volta ao local
      vault.definirModoServidor(s.ativo);
      setStatus(s);
      setOnline(true);
      setComSessao(temSessao());
      setInitialized(vault.isInitialized());
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => { void atualizarStatus(); }, [atualizarStatus]);

  const servidor = !!status?.ativo;

  // Auto-lock (inatividade ou aba oculta): volta para a tela de destravar.
  const handleAutoLock = useCallback(() => {
    setUnlocked(false);
    setComSessao(temSessao());
    setErro('Cofre travado automaticamente por inatividade.');
  }, []);
  useVaultActivity(unlocked, handleAutoLock);

  /** A sessão do código venceu no meio do uso: trava e volta para a etapa do código. */
  const sessaoExpirou = useCallback(() => {
    vault.lock();
    setUnlocked(false);
    setComSessao(false);
    setErro('A sessão do segundo fator expirou. Digite um código novo para continuar.');
  }, []);

  function travar() {
    vault.lock();
    setUnlocked(false);
    setErro('');
    // travar na mão também encerra a sessão do código (a trava automática não)
    if (servidor) void cofre2fa.sair().then(() => setComSessao(false));
  }

  function aberto() {
    if (servidor && status) setStatus({ ...status, temCofre: true });
    setInitialized(true); setUnlocked(true); setErro(''); setAviso('');
  }

  const precisaCodigo = servidor && !comSessao;
  const mostrarCriar = servidor ? !!status && !status.temCofre : !initialized;
  const semServidorProtegido = online === false && vault.modoServidor();
  const textoStatus = unlocked
    ? `Cofre destravado nesta sessão${servidor ? ' (guardado no servidor, protegido pelo segundo fator)' : ''}. Os segredos continuam mascarados até você revelar um.`
    : online === null ? 'Verificando o servidor…'
    : precisaCodigo ? 'Cofre protegido pelo segundo fator. Informe o código do celular.'
    : mostrarCriar ? 'Nenhum cofre ainda. Crie uma senha-mestra.'
    : 'Cofre travado. Informe a senha-mestra.';

  return (
    <div>
      <ConfirmDialog />
      <PageHeader
        title="Cofre de Credenciais"
        subtitle="Suas senhas cifradas com AES-GCM. A senha-mestra nunca é salva: sem ela, o cofre é ilegível."
      />

      <StatusStrip tone={unlocked ? 'ok' : 'warn'} icon={unlocked ? 'pi-unlock' : servidor ? 'pi-shield' : 'pi-lock'}>
        {textoStatus}
      </StatusStrip>

      {semServidorProtegido && (
        <Message severity="error" className="iv-mt ca-w100"
          text="Não consegui falar com o servidor. Com o segundo fator ativo, o Cofre só abre com a API no ar." />
      )}

      {unlocked && <Credenciais onLock={travar} onSessaoExpirou={sessaoExpirou} />}

      {!unlocked && online !== null && !semServidorProtegido && (
        precisaCodigo && status ? (
          <div className="iv-card iv-mt ca-acesso">
            <AbrirComCodigo status={status} onAberto={(a) => { setErro(''); setAviso(a ?? ''); setComSessao(true); }} />
          </div>
        ) : (
          <CofreAcesso initialized={!mostrarCriar} servidor={servidor} erroInicial={erro} aviso={aviso}
            onAberto={aberto} onSessaoExpirou={sessaoExpirou}
            onSemCofre={() => { if (status) setStatus({ ...status, temCofre: false }); }} />
        )
      )}

      {unlocked && online !== null && (
        <Painel2fa online={online} status={status} onMudou={() => { void atualizarStatus(); }} />
      )}

      <BackupCard />
    </div>
  );
}
