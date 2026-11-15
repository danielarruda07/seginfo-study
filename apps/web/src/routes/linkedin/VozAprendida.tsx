import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { MIN_INSPIRACOES_VOZ, MIN_POSTS_VOZ, podeGerarVoz, type PerfilVozIA } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { gerarVoz, getVoz, listInspiracoes, salvarAjustesVoz } from '@/services/linkedinPerfil';
import { usePublicados, useStatusIA } from './dados';

const Lista = ({ titulo, itens }: { titulo: string; itens: string[] }) => (itens.length ? (
  <div>
    <h4 className="ca-h4">{titulo}</h4>
    <ul className="ca-bullets">{itens.map((x) => <li key={x}>{x}</li>)}</ul>
  </div>
) : null);
const Texto = ({ titulo, texto }: { titulo: string; texto: string }) => (texto.trim() ? (
  <div><h4 className="ca-h4">{titulo}</h4><p className="ca-small ca-mb0 ca-pre">{texto}</p></div>
) : null);

function PerfilAprendido({ v }: { v: PerfilVozIA }) {
  return (
    <div className="pv-voz">
      <Texto titulo="Em resumo" texto={v.resumo} />
      <Lista titulo="Tom" itens={v.tom} />
      <Texto titulo="Estrutura dos seus posts" texto={v.estrutura} />
      <Lista titulo="Ganchos que você usa" itens={v.ganchosTipicos} />
      <Texto titulo="Formatação" texto={v.formatacao} />
      <Texto titulo="Tamanho" texto={v.tamanhoTipico} />
      <Texto titulo="Como você fecha" texto={v.fechamento} />
      <Lista titulo="Palavras e construções suas" itens={v.palavrasQueUso} />
      <Lista titulo="Evitar" itens={v.palavrasEvitar} />
      <Lista titulo="Assuntos fortes" itens={v.assuntosFortes} />
      <Lista titulo="Aproveitar do que você admira" itens={v.adotarDasInspiracoes} />
      <Lista titulo="Não copiar das inspirações" itens={v.naoCopiar} />
      <Texto titulo="Cadência sugerida" texto={v.cadenciaSugerida} />
      <Texto titulo="Direção visual" texto={v.orientacaoVisual} />
    </div>
  );
}

/** Perfil de voz: o que a IA aprendeu dos seus posts e das suas inspirações, mais as regras que você impõe. */
export function VozAprendida() {
  const invalidate = useInvalidate();
  const { data: voz, isLoading } = useQuery({ queryKey: ['linkedin-voz'], queryFn: getVoz });
  const { data: inspiracoes = [] } = useQuery({ queryKey: ['linkedin-inspiracoes'], queryFn: listInspiracoes });
  const { data: publicados = [] } = usePublicados();
  const { data: ia } = useStatusIA();
  const [ajustes, setAjustes] = useState('');
  const [ajustesSujo, setAjustesSujo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (voz && !ajustesSujo) setAjustes(voz.ajustes); }, [voz]); // eslint-disable-line react-hooks/exhaustive-deps

  const pode = podeGerarVoz(publicados.length, inspiracoes.length);

  async function gerar() {
    setGerando(true); setMsg(null);
    try {
      await gerarVoz();
      invalidate('linkedin-voz');
      setMsg({ sev: 'success', text: 'Perfil de voz atualizado. Os próximos rascunhos já usam ele.' });
    } catch (e) {
      setMsg({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setGerando(false);
    }
  }

  async function salvarAjustes() {
    setMsg(null);
    try {
      await salvarAjustesVoz(ajustes.trim());
      setAjustesSujo(false);
      invalidate('linkedin-voz');
      setMsg({ sev: 'success', text: 'Regras salvas. Elas valem mais que o perfil aprendido.' });
    } catch (e) {
      setMsg({ sev: 'error', text: mensagemErro(e) });
    }
  }

  return (
    <div className="iv-col iv-gap">
      <section className="iv-card pv-secao">
        <div className="ca-toolbar">
          <h3 className="ca-h3"><i className="pi pi-microphone" aria-hidden="true" /> Minha voz</h3>
          <div className="iv-row iv-wrap">
            {voz?.geradoEm && <Pill label={`Atualizada em ${new Date(voz.geradoEm).toLocaleDateString('pt-BR')}`} tone="muted" />}
            <Button label={voz?.perfil ? 'Atualizar com a IA' : 'Aprender minha voz'} icon="pi pi-sparkles" loading={gerando}
              disabled={!pode || !ia?.configurada} onClick={() => void gerar()} />
          </div>
        </div>
        <p className="iv-muted ca-small">
          A IA lê os seus posts publicados e as inspirações que você cadastrou, descobre como você escreve e o que vale aproveitar de quem você admira.
          Esse perfil e até 3 posts seus por inteiro vão em todo rascunho e em todo refino. Atualize quando tiver posts novos ou mudar de gosto.
        </p>
        <p className="ca-small ca-mb0">
          Material disponível: <strong>{publicados.length}</strong> {publicados.length === 1 ? 'post seu' : 'posts seus'} e <strong>{inspiracoes.length}</strong> {inspiracoes.length === 1 ? 'inspiração' : 'inspirações'}.
          {voz?.perfil && <> Último perfil usou {voz.baseadoEm.posts} posts e {voz.baseadoEm.inspiracoes} inspirações.</>}
        </p>
        {!pode && (
          <Message severity="info" className="ca-w100" text={`Para aprender a voz é preciso ter pelo menos ${MIN_POSTS_VOZ} posts seus (aba Publicados, pode importar o Shares.csv) ou ${MIN_INSPIRACOES_VOZ} inspirações.`} />
        )}
        {ia && !ia.configurada && <Message severity="warn" className="ca-w100" text="A IA não está configurada no servidor." />}
        {msg && <Message severity={msg.sev} text={msg.text} className="ca-w100" />}
      </section>

      <section className="iv-card pv-secao">
        <h3 className="ca-h3">Minhas regras</h3>
        <p className="iv-muted ca-small ca-mb0">Valem mais que o perfil aprendido, em todo texto que a IA escrever ou refinar.</p>
        <InputTextarea value={ajustes} rows={4} autoResize maxLength={1500} aria-label="Minhas regras de escrita"
          placeholder={'Ex.: Nunca use emoji. Sempre feche com uma pergunta técnica. Não escreva "jornada". Prefiro frases com no máximo 20 palavras.'}
          onChange={(e) => { setAjustes(e.target.value); setAjustesSujo(true); }} />
        <div className="iv-row">
          <Button label="Salvar regras" icon="pi pi-save" size="small" disabled={!ajustesSujo} onClick={() => void salvarAjustes()} />
        </div>
      </section>

      {isLoading ? <p className="iv-muted" role="status">Carregando…</p> : voz?.perfil ? (
        <section className="iv-card pv-secao">
          <h3 className="ca-h3">O que a IA aprendeu</h3>
          <PerfilAprendido v={voz.perfil} />
        </section>
      ) : null}
    </div>
  );
}
