import { useState, type KeyboardEvent } from 'react';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import * as vault from '@/services/vault';
import { cofre2fa, codigoErro, mensagemErro } from '@/services/cofre2fa';
import { senhaMestraScore } from './regras';

/** Campo de senha padrão do Cofre (sem medidor do PrimeReact, com botão de mostrar). */
export function SecretInput({ id, value, onChange, placeholder, ariaLabel, onKeyDown, autoComplete = 'off' }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <Password inputId={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel}
      onKeyDown={onKeyDown} toggleMask feedback={false} autoComplete={autoComplete} style={{ width: "100%" }} inputStyle={{ width: "100%" }} />
  );
}

/**
 * Criar ou destravar o cofre. A senha digitada só vive no estado deste cartão.
 * Com o segundo fator ativo (`servidor`), o blob cifrado vem da API depois do código;
 * a senha-mestra continua só neste navegador.
 */
export function CofreAcesso({ initialized, servidor, erroInicial, aviso, onAberto, onSessaoExpirou, onSemCofre }: {
  /** false = mostrar "Criar cofre" */
  initialized: boolean;
  servidor: boolean;
  erroInicial: string;
  aviso?: string;
  onAberto: () => void;
  onSessaoExpirou: () => void;
  /** o servidor diz que ainda não há cofre guardado lá */
  onSemCofre: () => void;
}) {
  const [erro, setErro] = useState('');
  const [master, setMaster] = useState('');
  const [master2, setMaster2] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const score = senhaMestraScore(master);
  const msg = erro || erroInicial;

  async function criar() {
    setErro('');
    if (master.length < 12) return setErro('Use uma senha-mestra com pelo menos 12 caracteres.');
    if (master !== master2) return setErro('As senhas não conferem.');
    setOcupado(true);
    try {
      if (servidor) await vault.initVaultServidor(master); else await vault.initVault(master);
    } catch (e) {
      vault.lock();
      if (codigoErro(e) === '2FA_NECESSARIO') return onSessaoExpirou();
      return setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
    setMaster(''); setMaster2('');
    onAberto();
  }

  async function destravar() {
    setErro('');
    setOcupado(true);
    let ok: boolean;
    try {
      if (servidor) {
        const blob = await cofre2fa.lerBlob();
        if (!blob) return onSemCofre();
        ok = await vault.unlockServidor(master, blob);
      } else {
        ok = await vault.unlock(master);
      }
    } catch (e) {
      if (codigoErro(e) === '2FA_NECESSARIO') return onSessaoExpirou();
      return setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
    if (!ok) { const s = vault.unlockWaitSeconds(); return setErro(`Senha-mestra incorreta.${s ? ` Aguarde ${s} s antes da próxima tentativa.` : ''}`); }
    setMaster('');
    onAberto();
  }

  return (
    <form className="iv-card iv-mt ca-acesso" onSubmit={(e) => { e.preventDefault(); void (initialized ? destravar() : criar()); }}>
      {msg && <Message severity="error" text={msg} className="ca-w100 ca-mb" />}
      {aviso && <Message severity="warn" text={aviso} className="ca-w100 ca-mb" />}
      {!initialized ? (
        <div className="iv-col iv-gap">
          <h3 className="ca-h3">Criar cofre</h3>
          <p className="iv-muted ca-small ca-mb0">Use uma frase-senha com pelo menos 12 caracteres. Ela protege tudo e não pode ser recuperada se esquecida.</p>
          <SecretInput value={master} onChange={setMaster} placeholder="Senha-mestra" ariaLabel="Senha-mestra" autoComplete="new-password" />
          <div className="vault-strength" aria-live="polite">
            <div className="vault-strength__track" role="progressbar" aria-label="Força da frase-senha" aria-valuemin={0} aria-valuemax={6} aria-valuenow={score}>
              <span style={{ width: `${(score / 6) * 100}%` }} />
            </div>
            <span className="iv-muted">{!master ? 'Mínimo 12 caracteres; uma frase longa é mais fácil de lembrar.' : score >= 5 ? 'Boa frase-senha' : 'Adicione comprimento e variedade.'}</span>
          </div>
          <SecretInput value={master2} onChange={setMaster2} placeholder="Confirmar senha-mestra" ariaLabel="Confirmar senha-mestra" autoComplete="new-password" />
          <Button type="submit" label="Criar cofre" icon="pi pi-lock" loading={ocupado} />
        </div>
      ) : (
        <div className="iv-col iv-gap">
          <h3 className="ca-h3">Destravar</h3>
          {servidor && <p className="iv-muted ca-small ca-mb0"><i className="pi pi-check" aria-hidden="true" /> Código aceito. Agora a senha-mestra (ela nunca sai deste navegador).</p>}
          <SecretInput value={master} onChange={setMaster} placeholder="Senha-mestra" ariaLabel="Senha-mestra" autoComplete="current-password" />
          <Button type="submit" label="Destravar cofre" icon="pi pi-unlock" loading={ocupado} />
        </div>
      )}
    </form>
  );
}
