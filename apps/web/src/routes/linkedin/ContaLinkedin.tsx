import { useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import { Pill } from '@/components/InfraKit';
import { DetailFields } from '@/components/ui/Detail';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { desconectarLinkedin, urlConectarLinkedin } from '@/services/linkedinPipeline';
import { useContaLinkedin } from './dados';
import { dataHoraCurta, fusoDoNavegador } from './pipelineRegras';

/**
 * Conexão com a API oficial do LinkedIn (OAuth). Com ela o servidor publica posts de texto
 * aprovados, na hora ou agendados. O token fica cifrado no servidor e nunca chega ao navegador.
 */
export function ContaLinkedin() {
  const invalidate = useInvalidate();
  const { data: conta, error, isLoading } = useContaLinkedin();
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function conectar() {
    setErro(''); setIndo(true);
    try {
      const { url } = await urlConectarLinkedin();
      window.location.href = url; // vai ao LinkedIn e volta para /posts?linkedin=conectado
    } catch (e) {
      setErro(mensagemErro(e)); setIndo(false);
    }
  }

  function desconectar() {
    confirmDialog({
      header: 'Desconectar o LinkedIn',
      message: 'O servidor apaga o token e deixa de publicar. Posts agendados "pela API" vão falhar na hora marcada: reagende como lembrete ou reconecte antes.',
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Desconectar', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        setErro('');
        try { await desconectarLinkedin(); invalidate('linkedin-conta'); }
        catch (e) { setErro(mensagemErro(e)); }
      },
    });
  }

  const expirando = conta?.conectado && conta.diasRestantes !== null && conta.diasRestantes <= 7;
  const expirado = conta?.conectado && conta.diasRestantes !== null && conta.diasRestantes <= 0;
  const selo = !conta ? { label: 'Verificando…', tone: 'muted' as const }
    : expirado ? { label: 'Autorização vencida', tone: 'danger' as const }
      : conta.conectado ? { label: 'Conectado', tone: 'ok' as const }
        : conta.configurado ? { label: 'Não conectado', tone: 'muted' as const } : { label: 'App não configurado', tone: 'muted' as const };

  return (
    <section className="iv-card iv-mt" aria-labelledby="conta-linkedin-titulo">
      <div className="ca-toolbar">
        <h3 id="conta-linkedin-titulo" className="ca-h3"><i className="pi pi-linkedin" aria-hidden="true" /> Conexão com o LinkedIn</h3>
        <Pill label={selo.label} tone={selo.tone} />
      </div>
      <p className="iv-muted ca-small">
        Opcional. Sem a conexão o pipeline funciona por lembrete: o app avisa e você publica à mão. Com ela, o servidor publica
        posts de <strong>texto</strong> que você aprovou. Só a API oficial é usada; nada de automação de navegador.
      </p>
      {isLoading && <p className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Consultando o servidor…</p>}
      {error && <Message severity="error" text={mensagemErro(error)} className="ca-w100" />}
      {erro && <Message severity="error" text={erro} className="ca-w100" />}

      {conta?.conectado && (
        <>
          <DetailFields items={[
            ['Perfil', conta.nome ?? ''],
            ['Autorização vale até', conta.expiraEm ? `${dataHoraCurta(conta.expiraEm, fusoDoNavegador())}${conta.diasRestantes !== null ? ` (${Math.max(0, conta.diasRestantes)} ${conta.diasRestantes === 1 ? 'dia' : 'dias'})` : ''}` : ''],
          ]} />
          {expirando && <p className="ca-aviso" role="status"><i className="pi pi-clock" aria-hidden="true" /> {expirado ? 'A autorização venceu.' : `A autorização vence em ${conta.diasRestantes} ${conta.diasRestantes === 1 ? 'dia' : 'dias'}.`} O LinkedIn exige um novo login a cada 60 dias: clique em Reconectar para não perder os agendamentos.</p>}
        </>
      )}
      {conta?.ultimoErro && <p className="ca-aviso" role="alert"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Último erro: {conta.ultimoErro}</p>}
      {conta && !conta.configurado && (
        <Message severity="warn" className="ca-w100" content={
          <div className="ca-small">
            <strong>Faltam variáveis na API:</strong> {conta.faltando.map((v) => <code key={v} className="lp-codigo">{v}</code>)}
          </div>
        } />
      )}

      <div className="iv-row iv-wrap iv-mt">
        <Button label={conta?.conectado ? 'Reconectar' : 'Conectar ao LinkedIn'} icon="pi pi-link" loading={indo} disabled={!conta?.configurado} outlined={!!conta?.conectado && !expirando} onClick={conectar}
          tooltip={conta && !conta.configurado ? 'Cadastre as variáveis do app do LinkedIn na API primeiro' : undefined} tooltipOptions={{ showOnDisabled: true }} />
        {conta?.conectado && <Button label="Desconectar" icon="pi pi-times" text severity="danger" onClick={desconectar} />}
      </div>

      <h4 className="ca-h4">O que a conexão faz e o que não faz</h4>
      <ul className="ca-bullets">
        <li>Publica posts de texto aprovados, na hora ("Publicar agora") ou no horário agendado.</li>
        <li>Não publica imagem, carrossel, vídeo nem enquete: para esses, use o lembrete e suba a mídia à mão.</li>
        <li>Não lê métricas: o LinkedIn não entrega números de posts pessoais pela API. Continue anotando em Publicados.</li>
      </ul>
      <details className="ca-ajuda">
        <summary>Como criar o app do LinkedIn (uma vez)</summary>
        <ol className="ca-bullets">
          <li>Em <em>developers.linkedin.com</em>, crie um app e associe a uma Página do LinkedIn (pode ser uma página sua).</li>
          <li>Na aba <em>Products</em>, adicione <strong>Share on LinkedIn</strong> e <strong>Sign In with LinkedIn using OpenID Connect</strong>.</li>
          <li>Na aba <em>Auth</em>, cadastre a URL de redirecionamento: <code>https://&lt;domínio do app&gt;/api/linkedin/conta/callback</code>.</li>
          <li>No Coolify, no serviço da API, cadastre como Secrets <code>LINKEDIN_CLIENT_ID</code> e <code>LINKEDIN_CLIENT_SECRET</code>. A API também usa <code>PUBLIC_BASE_URL</code> e <code>STORAGE_TOKEN_KEY</code>, que o backup já usa.</li>
          <li>Faça redeploy e clique em <em>Conectar ao LinkedIn</em> aqui.</li>
        </ol>
      </details>
    </section>
  );
}
