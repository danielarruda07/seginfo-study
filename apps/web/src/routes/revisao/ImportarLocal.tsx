import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { StatusStrip } from '@/components/InfraKit';
import {
  importarVarredura, montarImportacao, ESFORCO_ROTULO, MODO_ROTULO,
  type ArquivoLido, type EsforcoVarredura, type ModoVarredura, type PacoteImportacao,
} from '@/services/revisaoCodigo';

const MAX_ARQUIVO = 20 * 1_048_576;

async function lerArquivos(lista: FileList | null): Promise<ArquivoLido[]> {
  const out: ArquivoLido[] = [];
  for (const f of Array.from(lista ?? [])) {
    if (f.size > MAX_ARQUIVO || !/\.(sarif|json|md|patch)$/i.test(f.name)) continue;
    out.push({ nome: f.name, texto: await f.text() });
  }
  return out;
}

/**
 * Importa o resultado de uma varredura feita no Claude Code da máquina do operador
 * (scripts/varredura-local.ps1 + /claude-security). Nada é executado: só lê os arquivos do relatório.
 */
export function ImportarLocal({ onImportada }: { onImportada: (id: string) => void }) {
  const qc = useQueryClient();
  const pastaRef = useRef<HTMLInputElement>(null);
  const arqRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState('');
  const [modo, setModo] = useState<ModoVarredura>('codebase');
  const [esforco, setEsforco] = useState<EsforcoVarredura>('medium');
  const [pacote, setPacote] = useState<PacoteImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = async (lista: FileList | null) => {
    setErro(null);
    setPacote(montarImportacao(await lerArquivos(lista)));
  };

  const enviar = useMutation({
    mutationFn: () => importarVarredura({ nome: nome.trim(), modo, esforco, sarif: pacote!.sarif, relatorioMd: pacote!.relatorioMd, patches: pacote!.patches }),
    onSuccess: (r) => {
      setPacote(null); setNome('');
      void qc.invalidateQueries({ queryKey: ['revisoes-codigo'] });
      onImportada(r.id);
    },
    onError: (e) => setErro((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Não foi possível importar.'),
  });

  const pronto = Boolean(pacote && pacote.sarif !== undefined && nome.trim());

  return (
    <div className="iv-card iv-mt">
      <h2 className="iv-section-label">Importar varredura local (Claude Code na sua máquina)</h2>
      <p className="iv-muted" style={{ marginTop: 0 }}>
        Rodou o <code>/claude-security</code> num clone local (veja <strong>Conhecimento → Prompts de pentest</strong>)? Escolha a pasta
        <code> CLAUDE-SECURITY-&lt;data&gt;</code> que ele gerou. O app só lê o SARIF, o relatório e os patches — nada é executado e nada vai ao GitHub.
      </p>
      <div className="iv-row iv-wrap" style={{ gap: '0.6rem', alignItems: 'center' }}>
        <InputText value={nome} onChange={(e) => setNome(e.target.value)} placeholder="nome (ex.: criptobrokers @ main)" style={{ flex: '1 1 220px' }} aria-label="Nome da varredura local" />
        <Dropdown value={modo} onChange={(e) => setModo(e.value as ModoVarredura)} aria-label="Modo"
          options={(Object.keys(MODO_ROTULO) as ModoVarredura[]).map((m) => ({ label: MODO_ROTULO[m], value: m }))} />
        <Dropdown value={esforco} onChange={(e) => setEsforco(e.value as EsforcoVarredura)} aria-label="Esforço"
          options={(Object.keys(ESFORCO_ROTULO) as EsforcoVarredura[]).map((x) => ({ label: `Esforço ${ESFORCO_ROTULO[x].toLowerCase()}`, value: x }))} />
      </div>
      <div className="iv-row iv-wrap iv-mt" style={{ gap: '0.6rem', alignItems: 'center' }}>
        <input ref={pastaRef} type="file" hidden multiple onChange={(e) => void escolher(e.target.files)} {...{ webkitdirectory: '' }} />
        <input ref={arqRef} type="file" hidden multiple accept=".sarif,.json,.md,.patch" onChange={(e) => void escolher(e.target.files)} />
        <Button label="Escolher pasta do relatório" icon="pi pi-folder-open" outlined onClick={() => pastaRef.current?.click()} />
        <Button label="Ou escolher arquivos" icon="pi pi-file" text onClick={() => arqRef.current?.click()} />
        <Button label={enviar.isPending ? 'Importando…' : 'Importar'} icon="pi pi-upload" disabled={!pronto || enviar.isPending} onClick={() => enviar.mutate()} />
      </div>
      {pacote && (
        <p className="iv-muted" style={{ marginBottom: 0 }}>
          {pacote.sarif !== undefined ? 'SARIF ok' : 'sem SARIF'} · {pacote.relatorioMd ? 'relatório .md ok' : 'sem relatório .md'} · {pacote.patches.length} patch(es)
        </p>
      )}
      {pacote && pacote.avisos.length > 0 && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">{pacote.avisos.slice(0, 5).join(' ')}</StatusStrip>
      )}
      {erro && <StatusStrip tone="warn" icon="pi-exclamation-triangle">{erro}</StatusStrip>}
    </div>
  );
}
