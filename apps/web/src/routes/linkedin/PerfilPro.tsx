import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import {
  ROTULO_STATUS_CERTIFICACAO, STATUS_CERTIFICACAO, mesclarPerfil, perfilDoImportado,
  type Certificacao, type Curso, type Experiencia, type PerfilImportado, type PerfilPro as PerfilProTipo, type ProjetoPortfolio, type VagaAlvo,
} from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { extrairVagaDoTexto, getPerfilPro, importarPdfDoPerfil, salvarPerfilPro } from '@/services/linkedinPerfil';
import { BlocoRecolhivel, CampoLista, ListaEditavel } from './ListaEditavel';

const novoId = () => crypto.randomUUID();
const OPCOES_STATUS = STATUS_CERTIFICACAO.map((s) => ({ value: s, label: ROTULO_STATUS_CERTIFICACAO[s] }));

const contar = (i: PerfilImportado) => i.certificacoes.length + i.cursos.length + i.experiencias.length + i.projetos.length + i.competencias.length;

/**
 * Perfil profissional: os fatos que a IA pode afirmar nos posts. Importe o PDF do seu perfil do LinkedIn
 * e corrija à mão, ou preencha direto. Nada vira post sem você revisar, e o nome da empresa não é guardado.
 */
export function PerfilPro() {
  const invalidate = useInvalidate();
  const { data: registro, isLoading } = useQuery({ queryKey: ['linkedin-perfil-pro'], queryFn: getPerfilPro });
  const [perfil, setPerfil] = useState<PerfilProTipo | null>(null);
  const [sujo, setSujo] = useState(false);
  const [importadoNaSessao, setImportadoNaSessao] = useState(false);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [revisao, setRevisao] = useState<PerfilImportado | null>(null);
  const [vagaAberta, setVagaAberta] = useState(false);
  const [textoVaga, setTextoVaga] = useState('');
  const [lendoVaga, setLendoVaga] = useState(false);
  const [erroVaga, setErroVaga] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { if (registro && !sujo) setPerfil(registro.perfil); }, [registro]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !perfil) return <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando o perfil…</p>;

  const mudar = (p: Partial<PerfilProTipo>) => { setPerfil({ ...perfil, ...p }); setSujo(true); setMsg(null); };

  async function salvar() {
    if (!perfil) return;
    setSalvando(true); setMsg(null);
    try {
      await salvarPerfilPro(perfil, importadoNaSessao);
      setSujo(false); setImportadoNaSessao(false);
      invalidate('linkedin-perfil-pro');
      setMsg({ sev: 'success', text: 'Perfil salvo. A IA já usa estes fatos nos próximos rascunhos.' });
    } catch (e) {
      setMsg({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  async function aoEscolherPdf(f: File | undefined) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg({ sev: 'error', text: 'O PDF tem mais de 10 MB.' });
    setLendo(true); setMsg(null);
    try {
      const lido = await importarPdfDoPerfil(f);
      if (contar(lido) === 0 && !lido.headline && !lido.sobre) setMsg({ sev: 'error', text: 'Não encontrei dados de perfil neste PDF. Confira se é o PDF baixado em Perfil > Mais > Salvar como PDF.' });
      else setRevisao(lido);
    } catch (e) {
      setMsg({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setLendo(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  function aplicarImportacao(modo: 'mesclar' | 'substituir') {
    if (!revisao || !perfil) return;
    if (modo === 'mesclar') {
      const r = mesclarPerfil(perfil, revisao, novoId);
      setPerfil(r.perfil);
      setMsg({ sev: 'info', text: `${r.novos} ${r.novos === 1 ? 'item novo entrou' : 'itens novos entraram'}. O que você já tinha ficou como estava. Revise e clique em Salvar.` });
    } else {
      setPerfil(perfilDoImportado(revisao, perfil.vagasAlvo, novoId));
      setMsg({ sev: 'info', text: 'O perfil foi substituído pelo conteúdo do PDF (as vagas-alvo ficaram). Revise e clique em Salvar.' });
    }
    setSujo(true); setImportadoNaSessao(true); setRevisao(null);
  }

  async function lerVaga() {
    setLendoVaga(true); setErroVaga('');
    try {
      const v = await extrairVagaDoTexto(textoVaga.trim());
      mudar({ vagasAlvo: [...perfil!.vagasAlvo, { id: novoId(), titulo: v.titulo || 'Vaga', nivel: v.nivel, requisitos: v.requisitos, observacao: v.observacao }] });
      setVagaAberta(false); setTextoVaga('');
    } catch (e) {
      setErroVaga(mensagemErro(e));
    } finally {
      setLendoVaga(false);
    }
  }

  const obtidas = perfil.certificacoes.filter((c) => c.status === 'obtida').length;

  return (
    <div className="iv-col iv-gap">
      <BlocoRecolhivel titulo="Perfil profissional">
        <div className="iv-row iv-wrap">
          {registro?.importadoEm && <Pill label={`PDF importado em ${new Date(registro.importadoEm).toLocaleDateString('pt-BR')}`} tone="muted" />}
          {sujo && <Pill label="Alterações sem salvar" tone="serious" icon="pi-exclamation-circle" />}
        </div>
        <p className="iv-muted ca-small">
          Estes são os fatos que a IA pode afirmar sobre você. O que está como <em>obtida</em> ou concluído entra nos posts como conquista;
          <em> em andamento</em> vira "estudando para"; <em>planejada</em> nunca aparece como feita. Não há campo para o nome do empregador, de propósito.
        </p>
        <div className="iv-row iv-wrap">
          <input ref={arquivo} type="file" accept="application/pdf,.pdf" hidden aria-label="PDF do perfil do LinkedIn"
            onChange={(e) => void aoEscolherPdf(e.target.files?.[0])} />
          <Button label={lendo ? 'Lendo o PDF…' : 'Importar PDF do LinkedIn'} icon="pi pi-file-pdf" loading={lendo} outlined onClick={() => arquivo.current?.click()} />
          <span className="iv-muted ca-small">No LinkedIn: seu perfil, Mais, Salvar como PDF. O arquivo vai à IA só para leitura e não fica guardado.</span>
        </div>
        {msg && <Message severity={msg.sev} text={msg.text} className="ca-w100" />}
      </BlocoRecolhivel>

      <BlocoRecolhivel titulo="Headline e Sobre">
        <label className="ca-campo">
          <strong className="ca-small">Headline atual ({perfil.headline.length}/220)</strong>
          <InputTextarea value={perfil.headline} rows={2} autoResize maxLength={220} onChange={(e) => mudar({ headline: e.target.value })} />
        </label>
        <label className="ca-campo">
          <strong className="ca-small">Sobre atual ({perfil.sobre.length}/2600)</strong>
          <InputTextarea value={perfil.sobre} rows={5} autoResize maxLength={2600} onChange={(e) => mudar({ sobre: e.target.value })} />
        </label>
        <CampoLista value={perfil.competencias} separador="virgula" rotulo="Competências (separe por vírgula)" linhas={3}
          placeholder="Ex.: Proxmox, FortiGate, Wazuh, resposta a incidentes" onChange={(v) => mudar({ competencias: v })} />
      </BlocoRecolhivel>

      <ListaEditavel<Certificacao> titulo="Certificações" itens={perfil.certificacoes} max={40}
        recolhivel
        descricao={`${obtidas} obtida${obtidas === 1 ? '' : 's'}. Marque o status com cuidado: a IA só trata como conquista o que está obtida.`}
        vazio="Nenhuma certificação ainda. Importe o PDF ou adicione."
        rotuloItem={(c) => c.nome} onChange={(v) => mudar({ certificacoes: v })}
        novo={() => ({ id: novoId(), nome: '', emissor: '', status: 'planejada', data: '', credencial: '' })}
        campos={[
          { chave: 'nome', rotulo: 'Nome', placeholder: 'Ex.: Azure Administrator (AZ-104)' },
          { chave: 'emissor', rotulo: 'Emissor', placeholder: 'Ex.: Microsoft' },
          { chave: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: OPCOES_STATUS },
          { chave: 'data', rotulo: 'Data', placeholder: 'AAAA-MM ou "prova em dezembro"' },
          { chave: 'credencial', rotulo: 'ID ou link da credencial', larga: true },
        ]} />

      <ListaEditavel<Curso> titulo="Cursos" itens={perfil.cursos} max={60} recolhivel vazio="Nenhum curso ainda."
        rotuloItem={(c) => c.nome} onChange={(v) => mudar({ cursos: v })}
        novo={() => ({ id: novoId(), nome: '', instituicao: '', concluidoEm: '', cargaHoraria: '' })}
        campos={[
          { chave: 'nome', rotulo: 'Nome' }, { chave: 'instituicao', rotulo: 'Instituição ou plataforma' },
          { chave: 'concluidoEm', rotulo: 'Concluído em', placeholder: 'AAAA-MM' }, { chave: 'cargaHoraria', rotulo: 'Carga horária' },
        ]} />

      <ListaEditavel<Experiencia> titulo="Experiência" itens={perfil.experiencias} max={20}
        recolhivel
        descricao='Descreva o cargo e o que você fez. Em "Contexto" use só setor ou porte, sem o nome da empresa.'
        vazio="Nenhuma experiência ainda." rotuloItem={(e) => `${e.cargo}${e.periodo ? ` · ${e.periodo}` : ''}`} onChange={(v) => mudar({ experiencias: v })}
        novo={() => ({ id: novoId(), cargo: '', contexto: '', periodo: '', resumo: '', destaques: [] })}
        campos={[
          { chave: 'cargo', rotulo: 'Cargo' }, { chave: 'periodo', rotulo: 'Período', placeholder: 'jan 2019 - atual' },
          { chave: 'contexto', rotulo: 'Contexto (setor ou porte)', placeholder: 'Ex.: provedor de nuvem regional', larga: true },
          { chave: 'resumo', rotulo: 'O que eu fazia', tipo: 'area', larga: true },
          { chave: 'destaques', rotulo: 'Resultados e entregas (um por linha, só os que são verdade)', tipo: 'linhas', larga: true },
        ]} />

      <ListaEditavel<ProjetoPortfolio> titulo="Projetos de portfólio" itens={perfil.projetos} max={30} recolhivel
        vazio="Nenhum projeto ainda. Labs e a própria SegInfo Study contam." rotuloItem={(p) => p.nome} onChange={(v) => mudar({ projetos: v })}
        novo={() => ({ id: novoId(), nome: '', descricao: '', tecnologias: [], url: '' })}
        campos={[
          { chave: 'nome', rotulo: 'Nome' }, { chave: 'url', rotulo: 'Link (opcional)' },
          { chave: 'descricao', rotulo: 'O que é e o que provou', tipo: 'area', larga: true },
          { chave: 'tecnologias', rotulo: 'Tecnologias (separe por vírgula)', tipo: 'virgulas', larga: true },
        ]} />

      <BlocoRecolhivel titulo="Vagas-alvo" contagem={perfil.vagasAlvo.length}>
        <div className="iv-row iv-wrap">
          <Button label="Ler uma vaga" icon="pi pi-sparkles" size="small" outlined disabled={perfil.vagasAlvo.length >= 15} onClick={() => setVagaAberta(true)} />
        </div>
        <p className="iv-muted ca-small ca-mb0">
          Cole a descrição de vagas que você quer. A IA ajusta a ênfase e o vocabulário dos posts a esses requisitos, sem inventar experiência que você não tem.
        </p>
      </BlocoRecolhivel>
      <ListaEditavel<VagaAlvo> titulo="Vagas cadastradas" itens={perfil.vagasAlvo} max={15} recolhivel vazio="Nenhuma vaga-alvo. Use “Ler uma vaga” ou adicione à mão."
        rotuloItem={(v) => `${v.titulo}${v.nivel ? ` · ${v.nivel}` : ''}`} onChange={(v) => mudar({ vagasAlvo: v })}
        novo={() => ({ id: novoId(), titulo: '', nivel: '', requisitos: [], observacao: '' })}
        campos={[
          { chave: 'titulo', rotulo: 'Cargo' }, { chave: 'nivel', rotulo: 'Nível', placeholder: 'pleno, sênior…' },
          { chave: 'requisitos', rotulo: 'Requisitos (separe por vírgula)', tipo: 'virgulas', larga: true },
          { chave: 'observacao', rotulo: 'O que a vaga mais valoriza', tipo: 'area', larga: true },
        ]} />

      <div className="pv-barra">
        <Button label="Salvar perfil" icon="pi pi-save" loading={salvando} disabled={!sujo} onClick={salvar} />
        {sujo && <Button label="Descartar alterações" text onClick={() => { setPerfil(registro?.perfil ?? null); setSujo(false); setImportadoNaSessao(false); setMsg(null); }} />}
      </div>

      <Dialog header="O que a IA encontrou no PDF" visible={!!revisao} onHide={() => setRevisao(null)} style={{ width: 'min(560px, 96vw)' }}
        footer={(
          <div className="iv-row iv-wrap">
            <Button label="Mesclar (só acrescenta)" icon="pi pi-plus" onClick={() => aplicarImportacao('mesclar')} />
            <Button label="Substituir tudo" icon="pi pi-refresh" outlined severity="secondary" onClick={() => aplicarImportacao('substituir')} />
            <Button label="Cancelar" text onClick={() => setRevisao(null)} />
          </div>
        )}>
        {revisao && (
          <div className="iv-col iv-gap">
            <ul className="ca-bullets">
              <li>{revisao.certificacoes.length} certificações, {revisao.cursos.length} cursos, {revisao.experiencias.length} experiências, {revisao.projetos.length} projetos e {revisao.competencias.length} competências.</li>
              <li>Headline: {revisao.headline ? 'encontrada' : 'não encontrada'}. Sobre: {revisao.sobre ? 'encontrado' : 'não encontrado'}.</li>
            </ul>
            <p className="iv-muted ca-small ca-mb0">
              <strong>Mesclar</strong> mantém tudo o que você já tem e acrescenta só o que falta (compara pelo nome). <strong>Substituir</strong> troca o perfil inteiro pelo do PDF.
              Nada é gravado até você clicar em Salvar, e dá para corrigir cada item depois.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog header="Ler uma vaga" visible={vagaAberta} onHide={() => setVagaAberta(false)} style={{ width: 'min(640px, 96vw)' }}
        footer={(
          <div className="iv-row iv-wrap">
            <Button label="Ler e adicionar" icon="pi pi-sparkles" loading={lendoVaga} disabled={textoVaga.trim().length < 80} onClick={() => void lerVaga()} />
            <Button label="Cancelar" text onClick={() => setVagaAberta(false)} />
          </div>
        )}>
        <div className="iv-col iv-gap">
          <InputTextarea value={textoVaga} onChange={(e) => setTextoVaga(e.target.value)} rows={10} autoResize maxLength={15_000}
            placeholder="Cole aqui a descrição da vaga (título, responsabilidades e requisitos)." aria-label="Descrição da vaga" />
          {erroVaga && <Message severity="error" text={erroVaga} className="ca-w100" />}
        </div>
      </Dialog>
    </div>
  );
}
