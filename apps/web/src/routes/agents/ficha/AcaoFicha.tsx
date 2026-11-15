import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { DECISAO_META, duracao, formatarJson, type AcaoComId } from '../regras';
import { Codigo, MetaPill, Secao } from './comum';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de uma ação de ferramenta registrada na auditoria. */
export function AcaoFicha({ a, nav }: { a: AcaoComId; nav: Nav }) {
  const navigate = useNavigate();
  const entrada = formatarJson(a.entrada);
  const saida = formatarJson(a.saida);
  const abrir = () => navigate({ to: '/agents/agente/$agenteId/playground', params: { agenteId: a.agenteId }, search: { exec: a.execucaoId } });

  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-history', label: 'Ação de ferramenta' }} ariaLabel={`Ação ${a.ferramenta} de ${a.agenteNome}`}
      status={<>
        <MetaPill m={DECISAO_META[a.decisao]} />
        {a.erro && a.decisao !== 'negada' ? <Pill label="Falhou" tone="danger" icon="pi-times-circle" /> : <Pill label="Sem erro" tone="muted" icon="pi-check" />}
      </>}
      title={<span className="mono">{a.ferramenta}</span>}
      subtitle={`Pedida por ${a.agenteNome}`}
      actions={<>
        <Button label="Abrir a execução" icon="pi pi-external-link" size="small" onClick={abrir} />
        <Button label="Editar o agente" icon="pi pi-pencil" size="small" outlined
          onClick={() => navigate({ to: '/agents/agente/$agenteId', params: { agenteId: a.agenteId } })} />
      </>}>

      <Secao titulo="Resumo">
        <DetailFields items={[
          ['Decisão', a.decisao === 'automatica' ? 'Leitura: executada sem pedir aprovação' : a.decisao === 'aprovada' ? 'Você aprovou; o servidor executou' : a.decisao === 'autonoma' ? 'Escrita leve executada sem aprovação (modo autônomo ou cliente MCP)' : 'Você negou; nada foi executado'],
          ['Decidido em', a.decididoEm ? new Date(a.decididoEm).toLocaleString('pt-BR') : ''],
          ['Duração', duracao(a.ms)],
          ['Execução', <span className="mono" key="e">{a.execucaoId}</span>],
        ]} />
      </Secao>

      <Secao titulo="Parâmetros (entrada validada)" aside={entrada && <Button label="Copiar" icon="pi pi-copy" text size="small" onClick={() => copyToClipboard(entrada)} />}>
        <Codigo texto={entrada} rotulo="Parâmetros da ação" />
      </Secao>

      <Secao titulo={a.erro ? 'Erro devolvido ao modelo' : 'Resultado devolvido ao modelo'} aside={saida && <Button label="Copiar" icon="pi pi-copy" text size="small" onClick={() => copyToClipboard(saida)} />}>
        <Codigo texto={saida} rotulo="Resultado da ação" />
        <p className="agd-mudo iv-mt">O modelo recebe isto como dado, nunca como instrução.</p>
      </Secao>
    </DetailDrawer>
  );
}
