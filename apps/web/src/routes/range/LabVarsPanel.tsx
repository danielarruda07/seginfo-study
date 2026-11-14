import { useState, type ChangeEvent } from 'react';
import { InputText } from 'primereact/inputtext';
import { StatusStrip } from '@/components/InfraKit';
import { valorVar, type LabVars } from '@/services/rangePrompt';
import { GRUPO_LAB_VAR_LABEL, GRUPOS_LAB_VAR, LAB_VARS } from '@/data/rangeLab';

/** Aba "Configurar meu ambiente": dados do lab que entram nos prompts e recursos. Ficam só neste navegador. */
export function LabVarsPanel({ vars, onChange }: { vars: LabVars; onChange: (v: LabVars) => void }) {
  const faltando = LAB_VARS.filter((v) => !valorVar(v.chave, vars)).length;
  const [importacao, setImportacao] = useState<{ ok: boolean; texto: string } | null>(null);

  function importar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((texto) => {
      const dados: unknown = JSON.parse(texto);
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('formato');
      const validos = Object.entries(dados).filter(([k, v]) => typeof v === 'string' && LAB_VARS.some((d) => d.chave === k));
      onChange({ ...vars, ...Object.fromEntries(validos) as LabVars });
      setImportacao({ ok: true, texto: `${validos.length} ${validos.length === 1 ? 'dado importado' : 'dados importados'} de ${file.name}.` });
    }).catch(() => setImportacao({ ok: false, texto: 'Arquivo inválido: esperado um JSON com { "CHAVE": "valor" }.' }));
  }

  return (
    <div>
      <StatusStrip tone={faltando ? 'warn' : 'ok'} icon="pi-sliders-h">
        {faltando ? `${faltando} de ${LAB_VARS.length} dados ainda em branco.` : 'Todos os dados preenchidos.'}{' '}
        Eles entram nos prompts e na lista de recursos de cada etapa e ficam salvos só neste navegador. Não coloque senhas aqui.
      </StatusStrip>
      <div className="iv-row iv-wrap iv-mt">
        <label className="p-button p-component p-button-outlined p-button-sm pr-upload">
          <span className="p-button-icon p-button-icon-left pi pi-upload" aria-hidden="true" />
          <span className="p-button-label">Importar arquivo</span>
          <input type="file" accept="application/json,.json" hidden onChange={importar} />
        </label>
        <span className="pr-vazio">Carrega os dados levantados direto nos equipamentos.</span>
        {importacao && <span role="status" className={importacao.ok ? 'pr-ok' : 'p-error'}>{importacao.texto}</span>}
      </div>
      <div className="iv-form iv-mt">
        {GRUPOS_LAB_VAR.map((g) => (
          <fieldset key={g}>
            <legend>{GRUPO_LAB_VAR_LABEL[g]}</legend>
            <div className="iv-form__grid">
              {LAB_VARS.filter((v) => v.grupo === g).map((v) => (
                <div key={v.chave} className="iv-field">
                  <label htmlFor={`labvar-${v.chave}`}>{v.rotulo}</label>
                  <InputText id={`labvar-${v.chave}`} value={vars[v.chave] ?? v.padrao ?? ''} placeholder={`Ex.: ${v.exemplo}`}
                    onChange={(e) => onChange({ ...vars, [v.chave]: e.target.value })} />
                  {v.dica && <span className="iv-field__hint">{v.dica}</span>}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
