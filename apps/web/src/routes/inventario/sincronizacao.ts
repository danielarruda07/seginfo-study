import type { Ativo } from '@seginfo/shared';

/**
 * Regras puras de "Sincronizar com o ambiente" (testadas em sincronizacao.test.ts).
 *
 * O servidor devolve o que encontrou no laboratório; aqui se decide como isso entra no inventário
 * do navegador sem apagar o que você escreveu à mão:
 *  - nome, endereço, tipo, estado e detalhes vêm da varredura (é o que o equipamento diz hoje);
 *  - função, criticidade, exposição e labs ligados são seus: ficam como estão (a função só é
 *    preenchida pela varredura se estiver vazia);
 *  - tags são somadas; detalhes antigos que a varredura não traz continuam lá;
 *  - nada é apagado: o que não apareceu na varredura só é listado como "não visto".
 */

/** Tags que marcam ativos vindos de varredura (botão ou scripts do range). */
export const MARCAS_DE_VARREDURA = ['sincronizado', 'descoberta-rede'];

export function mesclar(existente: Ativo, descoberto: Ativo): Ativo {
  return {
    ...descoberto,
    funcao: existente.funcao.trim() ? existente.funcao : descoberto.funcao,
    criticidade: existente.criticidade,
    exposicao: existente.exposicao,
    labsRelacionados: existente.labsRelacionados,
    tags: [...new Set([...existente.tags, ...descoberto.tags])],
    detalhes: { ...existente.detalhes, ...descoberto.detalhes },
  };
}

const ordenado = (o: Record<string, string>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

/** Campos que mudaram (nomes para a tela). Data de confirmação e fonte não contam como mudança. */
export function camposAlterados(antes: Ativo, depois: Ativo): string[] {
  const campos: string[] = [];
  if (antes.nome !== depois.nome) campos.push('nome');
  if ((antes.endereco ?? '') !== (depois.endereco ?? '')) campos.push('endereço');
  if (antes.tipo !== depois.tipo) campos.push('tipo');
  if (antes.estado !== depois.estado) campos.push('estado');
  if (antes.funcao !== depois.funcao) campos.push('função');
  if (ordenado(antes.detalhes) !== ordenado(depois.detalhes)) campos.push('detalhes');
  if ([...antes.tags].sort().join('|') !== [...depois.tags].sort().join('|')) campos.push('tags');
  return campos;
}

export interface PlanoSincronizacao {
  novos: Ativo[];
  atualizados: { antes: Ativo; depois: Ativo; campos: string[] }[];
  iguais: Ativo[];
  /** ativos de varredura anteriores que não apareceram agora (só informativo; não são apagados) */
  naoVistos: Ativo[];
  /** inventário completo depois de aplicar */
  resultado: Ativo[];
}

/**
 * @param calcularNaoVistos só quando todas as fontes configuradas responderam: com uma fonte em
 * erro, tudo o que ela traria pareceria "sumido".
 */
export function planejarSincronizacao(existentes: Ativo[], descobertos: Ativo[], calcularNaoVistos: boolean): PlanoSincronizacao {
  const porId = new Map(existentes.map((a) => [a.id, a]));
  const mesclados = new Map<string, Ativo>();
  const plano: PlanoSincronizacao = { novos: [], atualizados: [], iguais: [], naoVistos: [], resultado: [] };

  for (const d of descobertos) {
    const atual = porId.get(d.id);
    if (!atual) { plano.novos.push(d); continue; }
    const depois = mesclar(atual, d);
    mesclados.set(d.id, depois);
    const campos = camposAlterados(atual, depois);
    if (campos.length) plano.atualizados.push({ antes: atual, depois, campos }); else plano.iguais.push(depois);
  }

  const vistos = new Set(descobertos.map((d) => d.id));
  if (calcularNaoVistos) {
    plano.naoVistos = existentes.filter((a) => !vistos.has(a.id) && a.tags.some((t) => MARCAS_DE_VARREDURA.includes(t)));
  }
  plano.resultado = [...existentes.map((a) => mesclados.get(a.id) ?? a), ...plano.novos];
  return plano;
}
