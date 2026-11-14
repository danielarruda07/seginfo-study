import { useCallback, useState } from 'react';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip } from '@/components/InfraKit';
import * as vault from '@/services/vault';
import { useVaultActivity } from '@/hooks/useVaultActivity';
import { CofreAcesso } from './cofre/CofreAcesso';
import { Credenciais } from './cofre/Credenciais';
import { BackupCard } from './cofre/BackupCard';
import '@/styles/telas/carreira.css';

/**
 * Cofre de credenciais. Travado, nada da lista nem das fichas é montado: a lista,
 * a ficha e qualquer segredo revelado somem junto com o destravamento.
 */
export function Cofre() {
  const [initialized, setInitialized] = useState(vault.isInitialized());
  const [unlocked, setUnlocked] = useState(vault.isUnlocked());
  const [aviso, setAviso] = useState('');

  // Auto-lock (inatividade ou aba oculta): volta para a tela de destravar.
  const handleAutoLock = useCallback(() => {
    setUnlocked(false);
    setAviso('Cofre travado automaticamente por inatividade.');
  }, []);
  useVaultActivity(unlocked, handleAutoLock);

  function travar() {
    vault.lock();
    setUnlocked(false);
    setAviso('');
  }

  return (
    <div>
      <ConfirmDialog />
      <PageHeader
        title="Cofre de Credenciais"
        subtitle="Suas senhas cifradas com AES-GCM. A senha-mestra nunca é salva: sem ela, o cofre é ilegível."
      />

      <StatusStrip tone={unlocked ? 'ok' : 'warn'} icon={unlocked ? 'pi-unlock' : 'pi-lock'}>
        {unlocked ? 'Cofre destravado nesta sessão. Os segredos continuam mascarados até você revelar um.'
          : initialized ? 'Cofre travado. Informe a senha-mestra.' : 'Nenhum cofre ainda. Crie uma senha-mestra.'}
      </StatusStrip>

      {unlocked
        ? <Credenciais onLock={travar} />
        : <CofreAcesso initialized={initialized} erroInicial={aviso} onAberto={() => { setInitialized(true); setUnlocked(true); setAviso(''); }} />}

      <BackupCard />
    </div>
  );
}
