import { useEffect } from 'react';
import * as vault from '@/services/vault';

/**
 * Enquanto o cofre estiver destravado, reinicia o timer de inatividade a cada
 * interação do usuário. Também reage ao auto-lock chamando onAutoLock.
 */
export function useVaultActivity(enabled: boolean, onAutoLock: () => void) {
  useEffect(() => {
    if (!enabled) return;

    const activity = () => vault.resetIdleTimer();
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((ev) => document.addEventListener(ev, activity, { passive: true }));

    const unsub = vault.onLock(onAutoLock);
    vault.resetIdleTimer();

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, activity));
      unsub();
    };
  }, [enabled, onAutoLock]);
}
