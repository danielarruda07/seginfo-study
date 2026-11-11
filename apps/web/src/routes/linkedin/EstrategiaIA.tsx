import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { ESTRATEGIA_PADRAO, getEstrategia, mensagemErro, saveEstrategia, statusIA, type Estrategia } from '@/services/linkedin';

export function EstrategiaIA() {
  const invalidate = useInvalidate();
  const { data: salva } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useQuery({ queryKey: ['ia-status'], queryFn: statusIA });
  const [e, setE] = useState<Estrategia>(ESTRATEGIA_PADRAO);
  const [novoPilar, setNovoPilar] = useState('');
  const [msg, setMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (salva) setE(salva); }, [salva]);

  async function salvar() {
    setMsg(null);
    try {
      await saveEstrategia({ ...e, pilares: e.pilares.map((p) => p.trim()).filter(Boolean) });
      invalidate('linkedin-estrategia');
      setMsg({ sev: 'success', text: 'Estratégia salva no servidor.' });
    } catch (err) {
      setMsg({ sev: 'error', text: mensagemErro(err) });
    }
  }

  return (
    <div className="linkedin-estrategia">
      <section className="iv-card">
        <h3 style={{ marginTop: 0 }}>Posicionamento</h3>
        <p className="iv-muted" style={{ fontSize: '.85rem', marginTop: 0 }}>
          A IA usa isto para analisar seus posts e escrever no seu tom. Pilares são os 3 a 5 assuntos pelos quais você quer ser lembrado.
        </p>
        <div className="iv-col iv-gap">
          <label className="iv-col" style={{ gap: '.25rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Objetivo</strong>
            <InputTextarea value={e.objetivo} onChange={(x) => setE({ ...e, objetivo: x.target.value })} rows={2} autoResize />
          </label>
          <label className="iv-col" style={{ gap: '.25rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Público</strong>
            <InputTextarea value={e.publico} onChange={(x) => setE({ ...e, publico: x.target.value })} rows={2} autoResize />
          </label>
          <label className="iv-col" style={{ gap: '.25rem' }}>
            <strong style={{ fontSize: '.85rem' }}>Voz</strong>
            <InputTextarea value={e.voz} onChange={(x) => setE({ ...e, voz: x.target.value })} rows={3} autoResize />
          </label>
          <div>
            <strong style={{ fontSize: '.85rem' }}>Pilares de conteúdo</strong>
            <ul className="linkedin-pilares">
              {e.pilares.map((p, i) => (
                <li key={i}>
                  <InputText value={p} maxLength={80} onChange={(x) => setE({ ...e, pilares: e.pilares.map((v, j) => (j === i ? x.target.value : v)) })} aria-label={`Pilar ${i + 1}`} />
                  <Button icon="pi pi-times" text severity="secondary" aria-label="Remover pilar" disabled={e.pilares.length <= 1}
                    onClick={() => setE({ ...e, pilares: e.pilares.filter((_, j) => j !== i) })} />
                </li>
              ))}
            </ul>
            <div className="iv-row">
              <InputText value={novoPilar} maxLength={80} onChange={(x) => setNovoPilar(x.target.value)} placeholder="Novo pilar" />
              <Button icon="pi pi-plus" outlined aria-label="Adicionar pilar" disabled={!novoPilar.trim() || e.pilares.length >= 6}
                onClick={() => { setE({ ...e, pilares: [...e.pilares, novoPilar.trim()] }); setNovoPilar(''); }} />
            </div>
          </div>
          {msg && <Message severity={msg.sev} text={msg.text} style={{ width: '100%' }} />}
          <div className="iv-row">
            <Button label="Salvar estratégia" icon="pi pi-save" onClick={salvar} />
            <Button label="Restaurar sugestão" text onClick={() => setE(ESTRATEGIA_PADRAO)} />
          </div>
        </div>
      </section>

      <section className="iv-card">
        <div className="iv-row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>IA (Claude)</h3>
          <Pill label={ia?.configurada ? 'Pronta' : 'Não configurada'} color={ia?.configurada ? '#16a34a' : '#94a3b8'} />
        </div>
        <p className="iv-muted" style={{ fontSize: '.85rem' }}>
          Modelo: <code>{ia?.modelo ?? '—'}</code>. A IA roda na API, no seu Coolify. A chave fica só no servidor,
          como Secret, e nunca chega ao navegador. Cada análise ou rascunho custa poucos centavos de dólar.
        </p>
        {ia && !ia.configurada && (
          <Message severity="warn" style={{ width: '100%' }} content={
            <div style={{ fontSize: '.85rem' }}>
              <strong>Para ligar a IA:</strong>
              <ol style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }}>
                <li>Crie uma chave em console.anthropic.com → API Keys (e defina um limite de gasto mensal).</li>
                <li>No Coolify, no recurso da SegInfo: <em>Environment Variables</em> → <code>ANTHROPIC_API_KEY</code>, marcada como secreta.</li>
                <li>Faça redeploy. Esta tela passa a mostrar "Pronta".</li>
              </ol>
            </div>
          } />
        )}

        <h4 style={{ marginBottom: '.4rem' }}>O que vai para a IA</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem' }}>
          <li>Texto dos seus posts (já são públicos) e os briefings que você escreve.</li>
          <li>Títulos do catálogo de estudo, labs concluídos, notas de sessões e o diário do projeto.</li>
          <li>Trechos de notas <strong>pessoais</strong> do Segundo Cérebro ligadas ao briefing.</li>
        </ul>
        <h4 style={{ marginBottom: '.4rem' }}>O que nunca vai</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem' }}>
          <li>Inventário do homelab (IPs, hosts, riscos), segredos do Cofre e notas corporativas.</li>
          <li>Notas e sessões que citem IP, nome de servidor ou senha (filtradas antes do envio).</li>
        </ul>
      </section>
    </div>
  );
}
