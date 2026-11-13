import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Checkbox } from 'primereact/checkbox';
import * as vault from '@/services/vault';
import { cofre2fa, mensagemErro, sessaoExpiraEm, ROTULO_EVENTO, type EventoCofre, type Status2fa } from '@/services/cofre2fa';
import { copySensitiveToClipboard } from '@/lib/clipboard';

const hora = (iso: string | number) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Código de 6 dígitos ou, alternando, um código de recuperação. */
export function CampoFator({ onEnviar, rotulo = 'Confirmar', ocupado = false, permitirRecuperacao = true }: {
  onEnviar: (fator: { codigo?: string; recuperacao?: string }) => void;
  rotulo?: string;
  ocupado?: boolean;
  permitirRecuperacao?: boolean;
}) {
  const [recuperacao, setRecuperacao] = useState(false);
  const [valor, setValor] = useState('');
  const pronto = recuperacao ? valor.replace(/[^A-Za-z2-7]/g, '').length === 10 : valor.replace(/\D/g, '').length === 6;
  const enviar = () => {
    if (!pronto || ocupado) return;
    onEnviar(recuperacao ? { recuperacao: valor } : { codigo: valor.replace(/\D/g, '') });
    setValor('');
  };
  return (
    <div className="iv-col iv-gap">
      <InputText
        value={valor}
        autoFocus
        inputMode={recuperacao ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={recuperacao ? 11 : 7}
        placeholder={recuperacao ? 'XXXXX-XXXXX' : '000000'}
        aria-label={recuperacao ? 'Código de recuperação' : 'Código de 6 dígitos do autenticador'}
        style={{ fontSize: '1.4rem', letterSpacing: '.3rem', textAlign: 'center', fontFamily: 'monospace' }}
        onChange={(e) => setValor(recuperacao ? e.target.value.toUpperCase() : e.target.value.replace(/[^\d ]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && enviar()}
      />
      <Button label={rotulo} icon={ocupado ? 'pi pi-spinner pi-spin' : 'pi pi-check'} onClick={enviar} disabled={!pronto || ocupado} />
      {permitirRecuperacao && (
        <Button type="button" link size="small" style={{ alignSelf: 'flex-start', padding: 0 }}
          label={recuperacao ? 'Usar o código do autenticador' : 'Perdi o celular: usar um código de recuperação'}
          onClick={() => { setRecuperacao(!recuperacao); setValor(''); }} />
      )}
    </div>
  );
}

/** Etapa 1 do Cofre protegido: o servidor confere o código e libera o blob por 15 min. */
export function AbrirComCodigo({ status, onAberto }: { status: Status2fa; onAberto: (aviso?: string) => void }) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function enviar(fator: { codigo?: string; recuperacao?: string }) {
    setErro('');
    setOcupado(true);
    try {
      const r = await cofre2fa.verificar(fator);
      onAberto(fator.recuperacao ? `Código de recuperação usado. Restam ${r.codigosRestantes}.${r.codigosRestantes <= 3 ? ' Gere novos códigos no painel do segundo fator.' : ''}` : undefined);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="iv-col iv-gap">
      <h3 style={{ margin: 0 }}><i className="pi pi-mobile" /> Código do autenticador</h3>
      <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>
        Abra o Google Authenticator no celular e digite o código de 6 dígitos de <strong>SegInfo Cofre</strong>.
        O servidor confere o código e só então entrega o Cofre, ainda cifrado.
      </p>
      {status.bloqueadoAte && <Message severity="warn" text={`Bloqueado por tentativas erradas até ${hora(status.bloqueadoAte)}.`} />}
      {erro && <Message severity="error" text={erro} />}
      <CampoFator onEnviar={enviar} ocupado={ocupado} rotulo="Verificar código" />
    </div>
  );
}

function ListaCodigos({ codigos }: { codigos: string[] }) {
  const texto = `SegInfo Cofre - codigos de recuperacao (cada um vale UMA vez)\nGerados em ${new Date().toLocaleString('pt-BR')}\n\n${codigos.join('\n')}\n`;
  function baixar() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }));
    a.download = 'seginfo-cofre-codigos-recuperacao.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="iv-col iv-gap">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '.4rem', fontFamily: 'monospace', fontSize: '1.05rem' }}>
        {codigos.map((c) => <code key={c} style={{ padding: '.35rem .5rem', border: '1px solid var(--surface-border, #ccc)', borderRadius: 6, textAlign: 'center' }}>{c}</code>)}
      </div>
      <div className="iv-row iv-wrap">
        <Button label="Baixar .txt" icon="pi pi-download" outlined size="small" onClick={baixar} />
        <Button label="Copiar" icon="pi pi-copy" outlined size="small" onClick={() => { void copySensitiveToClipboard(codigos.join('\n')); }} />
      </div>
    </div>
  );
}

/** Assistente: QR code -> primeiro código (ativa e leva o Cofre ao servidor) -> códigos de recuperação. */
function Ativacao({ status, onFim, onCancelar }: { status: Status2fa; onFim: () => void; onCancelar: () => void }) {
  const [etapa, setEtapa] = useState<'qr' | 'codigos'>('qr');
  const [dados, setDados] = useState<{ segredo: string; qr: string } | null>(null);
  const [codigos, setCodigos] = useState<string[]>([]);
  const [guardei, setGuardei] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    cofre2fa.iniciar()
      .then(async (r) => { const qr = await QRCode.toDataURL(r.otpauth, { margin: 1, width: 220 }); if (vivo) setDados({ segredo: r.segredo, qr }); })
      .catch((e) => vivo && setErro(mensagemErro(e)));
    return () => { vivo = false; };
  }, []);

  async function confirmar(fator: { codigo?: string }) {
    if (!fator.codigo) return;
    setErro('');
    setOcupado(true);
    try {
      const r = await cofre2fa.ativar(fator.codigo, await vault.blobAtual());
      vault.concluirMigracao(r.atualizadoEm);
      setCodigos(r.codigos);
      setEtapa('codigos');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  if (etapa === 'codigos') {
    return (
      <div className="iv-col iv-gap">
        <Message severity="success" style={{ width: '100%' }} text="Segundo fator ativado. O Cofre foi para o servidor (cifrado) e saiu deste navegador." />
        <h4 style={{ margin: 0 }}>Códigos de recuperação</h4>
        <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>
          Se perder o celular, cada código abre o Cofre <strong>uma vez</strong>. Eles aparecem só agora:
          imprima ou guarde fora deste computador (não no próprio Cofre).
        </p>
        <ListaCodigos codigos={codigos} />
        <label className="iv-row" style={{ fontSize: '.88rem' }}>
          <Checkbox checked={guardei} onChange={(e) => setGuardei(!!e.checked)} /> Guardei os códigos em local seguro
        </label>
        <Button label="Concluir" icon="pi pi-check" disabled={!guardei} onClick={onFim} />
      </div>
    );
  }

  return (
    <div className="iv-col iv-gap">
      <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '.88rem', lineHeight: 1.6 }}>
        <li>No celular, abra o <strong>Google Authenticator</strong> e toque em <strong>+</strong> → <strong>Ler código QR</strong>.</li>
        <li>Aponte para o QR abaixo. Vai aparecer <strong>SegInfo Cofre</strong> com um código de 6 dígitos.</li>
        <li>Digite o código atual para confirmar.</li>
      </ol>
      {status.temCofre && (
        <Message severity="warn" style={{ width: '100%' }}
          text="Já existe um Cofre antigo guardado no servidor (de uma importação anterior). Ele será substituído pelo Cofre deste navegador." />
      )}
      {erro && <Message severity="error" style={{ width: '100%' }} text={erro} />}
      {!dados && !erro && <p className="iv-muted"><i className="pi pi-spinner pi-spin" /> Gerando o QR code...</p>}
      {dados && (
        <>
          <img src={dados.qr} alt="QR code para o Google Authenticator" width={220} height={220} style={{ alignSelf: 'center', background: '#fff', padding: 8, borderRadius: 8 }} />
          <details style={{ fontSize: '.82rem' }}>
            <summary className="iv-muted" style={{ cursor: 'pointer' }}>Não consigo ler o QR: digitar a chave</summary>
            <p style={{ margin: '.5rem 0' }}>No app: <strong>+</strong> → <strong>Inserir chave de configuração</strong>, nome <em>SegInfo Cofre</em>, tipo <em>baseado no tempo</em>, chave:</p>
            <code style={{ wordBreak: 'break-all', fontSize: '.95rem' }}>{dados.segredo.replace(/(.{4})/g, '$1 ').trim()}</code>
          </details>
          <CampoFator onEnviar={confirmar} ocupado={ocupado} rotulo="Ativar e levar o Cofre ao servidor" permitirRecuperacao={false} />
        </>
      )}
      <Button label="Cancelar" text size="small" style={{ alignSelf: 'flex-start' }} onClick={onCancelar} disabled={ocupado} />
    </div>
  );
}

function Acessos() {
  const [eventos, setEventos] = useState<EventoCofre[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { cofre2fa.eventos().then(setEventos).catch((e) => setErro(mensagemErro(e))); }, []);
  if (erro) return <Message severity="error" text={erro} />;
  if (!eventos) return <p className="iv-muted"><i className="pi pi-spinner pi-spin" /> Carregando...</p>;
  if (!eventos.length) return <p className="iv-muted">Nenhum acesso registrado ainda.</p>;
  return (
    <table style={{ width: '100%', fontSize: '.82rem', borderCollapse: 'collapse' }}>
      <thead><tr className="iv-muted" style={{ textAlign: 'left' }}><th>Quando</th><th>O quê</th><th>De onde</th></tr></thead>
      <tbody>
        {eventos.map((ev) => (
          <tr key={ev.id} style={{ borderTop: '1px solid var(--surface-border, #ddd)', color: ev.tipo === '2fa_falha' || ev.tipo === '2fa_bloqueado' ? 'var(--red-500, #c62828)' : undefined }}>
            <td style={{ padding: '.3rem .4rem .3rem 0', whiteSpace: 'nowrap' }}>{dataHora(ev.criadoEm)}</td>
            <td style={{ padding: '.3rem .4rem' }}>{ROTULO_EVENTO[ev.tipo] ?? ev.tipo}{ev.detalhe ? ` (${ev.detalhe})` : ''}</td>
            <td style={{ padding: '.3rem 0' }} title={ev.agente ?? ''}>{ev.ip ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Painel com o Cofre destravado: ativar, ver acessos, refazer códigos ou desligar o 2FA. */
export function Painel2fa({ online, status, onMudou }: { online: boolean; status: Status2fa | null; onMudou: () => void }) {
  const [modo, setModo] = useState<'nada' | 'ativar' | 'codigos' | 'desativar' | 'acessos'>('nada');
  const [novos, setNovos] = useState<string[] | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!online || !status) {
    return (
      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}><i className="pi pi-shield" /> Segundo fator</h3>
        <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>
          Indisponível: o segundo fator é conferido pelo servidor, e a API não respondeu. Neste modo o Cofre fica só neste navegador.
        </p>
      </div>
    );
  }

  async function regenerar(fator: { codigo?: string; recuperacao?: string }) {
    setErro(''); setOcupado(true);
    try { setNovos(await cofre2fa.novosCodigos(fator)); onMudou(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function desativar(fator: { codigo?: string; recuperacao?: string }) {
    if (!window.confirm('Desligar o segundo fator? O Cofre volta a ficar só neste navegador e é apagado do servidor.')) return;
    setErro(''); setOcupado(true);
    try {
      await vault.voltarParaLocal();
      try {
        await cofre2fa.desativar(fator);
      } catch (e) {
        vault.definirModoServidor(true); // servidor recusou: continua protegido; apaga a cópia local recém-gravada
        vault.apagarCopiaLocal();
        throw e;
      }
      setModo('nada');
      onMudou();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }

  const expira = sessaoExpiraEm();
  return (
    <div className="iv-card iv-mt">
      <h3 style={{ marginTop: 0 }}><i className="pi pi-shield" /> Segundo fator (Google Authenticator)</h3>
      {!status.ativo ? (
        modo === 'ativar' ? (
          <Ativacao status={status} onCancelar={() => setModo('nada')} onFim={() => { setModo('nada'); onMudou(); }} />
        ) : (
          <div className="iv-col iv-gap">
            <Message severity="warn" style={{ width: '100%' }} text="Desligado: o Cofre está só neste navegador, protegido apenas pela senha-mestra." />
            <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>
              Ao ativar, o Cofre (sempre cifrado) passa a morar no servidor e abre em qualquer aparelho, mas só depois do
              código do celular e da senha-mestra. O servidor confere o código; a senha-mestra nunca sai do navegador.
            </p>
            <Button label="Ativar segundo fator" icon="pi pi-mobile" style={{ alignSelf: 'flex-start' }} onClick={() => setModo('ativar')} />
          </div>
        )
      ) : (
        <div className="iv-col iv-gap">
          <div style={{ fontSize: '.88rem' }}>
            <i className="pi pi-check-circle" style={{ color: 'var(--green-500, #2e7d32)' }} /> Ativo
            {status.ativadoEm ? ` desde ${new Date(status.ativadoEm).toLocaleDateString('pt-BR')}` : ''}
            {' · '}{status.codigosRestantes} código(s) de recuperação
            {expira ? ` · sessão até ${hora(expira)}` : ''}
          </div>
          {status.codigosRestantes <= 3 && <Message severity="warn" text="Restam poucos códigos de recuperação: gere novos." />}
          <div className="iv-row iv-wrap">
            <Button label="Acessos" icon="pi pi-history" outlined size="small" onClick={() => setModo(modo === 'acessos' ? 'nada' : 'acessos')} />
            <Button label="Novos códigos de recuperação" icon="pi pi-refresh" outlined size="small" onClick={() => { setNovos(null); setErro(''); setModo('codigos'); }} />
            <Button label="Desativar" icon="pi pi-times" outlined severity="danger" size="small" onClick={() => { setErro(''); setModo('desativar'); }} />
          </div>
          {erro && <Message severity="error" text={erro} />}
          {modo === 'acessos' && <Acessos />}
          {modo === 'codigos' && (novos ? (
            <>
              <Message severity="success" text="Códigos novos gerados. Os antigos deixaram de valer." />
              <ListaCodigos codigos={novos} />
              <Button label="Fechar" text size="small" style={{ alignSelf: 'flex-start' }} onClick={() => setModo('nada')} />
            </>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <p className="iv-muted" style={{ fontSize: '.85rem' }}>Confirme com um código do autenticador. Os códigos de recuperação atuais deixam de valer.</p>
              <CampoFator onEnviar={regenerar} ocupado={ocupado} rotulo="Gerar novos códigos" />
            </div>
          ))}
          {modo === 'desativar' && (
            <div style={{ maxWidth: 360 }}>
              <p className="iv-muted" style={{ fontSize: '.85rem' }}>
                Confirme com um código. O Cofre volta a ficar só neste navegador e é apagado do servidor.
              </p>
              <CampoFator onEnviar={desativar} ocupado={ocupado} rotulo="Desativar segundo fator" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
