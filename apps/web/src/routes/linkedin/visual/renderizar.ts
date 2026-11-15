import { TAMANHOS_VISUAIS, type SlideVisual, type TamanhoVisual } from '@seginfo/shared';

/**
 * Desenho dos slides em canvas (tema escuro). Tudo roda no navegador: o texto sai sempre correto
 * e o resultado é o mesmo em qualquer máquina com a mesma fonte. Nada aqui chama IA.
 */

export const ACENTOS = {
  ciano: { rotulo: 'Ciano', cor: '#2de2d3' },
  ambar: { rotulo: 'Âmbar', cor: '#ffb347' },
  violeta: { rotulo: 'Violeta', cor: '#a78bfa' },
} as const;
export type Acento = keyof typeof ACENTOS;

const TEMA = { fundo: '#0a0f1f', fundo2: '#121b36', painel: '#18233f', texto: '#f3f6fb', suave: '#aab5cd', linha: '#2a3860' };
const FONTE = '"Inter","Segoe UI","Helvetica Neue",Arial,sans-serif';

export interface OpcoesDesenho {
  tamanho: TamanhoVisual;
  acento: Acento;
  /** posição do slide e total, para o rodapé (ex.: 3/8) */
  indice: number;
  total: number;
  autor: string;
  ilustracao?: CanvasImageSource | null;
}

type Ctx = CanvasRenderingContext2D;
const fonte = (peso: number, tam: number) => `${peso} ${Math.round(tam)}px ${FONTE}`;

/** Quebra o texto em linhas que cabem na largura (respeita quebras de linha explícitas). */
export function quebrarLinhas(ctx: Ctx, texto: string, larguraMax: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tenta = atual ? `${atual} ${palavra}` : palavra;
      if (atual && ctx.measureText(tenta).width > larguraMax) { linhas.push(atual); atual = palavra; } else atual = tenta;
    }
    linhas.push(atual);
  }
  return linhas.filter((l, i) => l || i < linhas.length - 1);
}

/** Maior fonte (entre max e min) em que o texto cabe na largura e na altura dadas. */
export function ajustarTexto(ctx: Ctx, texto: string, peso: number, largura: number, altura: number, tamMax: number, tamMin: number, entrelinha = 1.2) {
  let tam = tamMax;
  for (;;) {
    ctx.font = fonte(peso, tam);
    const linhas = quebrarLinhas(ctx, texto, largura);
    if (linhas.length * tam * entrelinha <= altura || tam <= tamMin) return { tam, linhas, entrelinha };
    tam -= 2;
  }
}

function retangulo(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const raio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + w, y, x + w, y + h, raio);
  ctx.arcTo(x + w, y + h, x, y + h, raio);
  ctx.arcTo(x, y + h, x, y, raio);
  ctx.arcTo(x, y, x + w, y, raio);
  ctx.closePath();
}

/** Desenha as linhas a partir de y; devolve o y logo abaixo da última. */
function escrever(ctx: Ctx, linhas: string[], x: number, y: number, tam: number, entrelinha: number, cor: string, peso: number, alinhar: CanvasTextAlign = 'left'): number {
  ctx.font = fonte(peso, tam);
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'top';
  linhas.forEach((l, i) => ctx.fillText(l, x, y + i * tam * entrelinha));
  return y + linhas.length * tam * entrelinha;
}

function cobrir(ctx: Ctx, img: CanvasImageSource, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  if (!iw || !ih) return;
  const escala = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * escala) / 2, (h - ih * escala) / 2, iw * escala, ih * escala);
}

function fundo(ctx: Ctx, w: number, h: number, cor: string, ilustracao?: CanvasImageSource | null) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, TEMA.fundo);
  g.addColorStop(1, TEMA.fundo2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (ilustracao) {
    cobrir(ctx, ilustracao, w, h);
    // escurece para o texto ficar legível, mais forte embaixo
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(10,15,31,0.15)');
    v.addColorStop(0.45, 'rgba(10,15,31,0.58)');
    v.addColorStop(1, 'rgba(10,15,31,0.92)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  } else {
    const brilho = ctx.createRadialGradient(w * 0.92, h * 0.05, 0, w * 0.92, h * 0.05, w * 0.7);
    brilho.addColorStop(0, `${cor}33`);
    brilho.addColorStop(1, `${cor}00`);
    ctx.fillStyle = brilho;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Desenha um slide no canvas, no tamanho do formato escolhido. */
export function desenharSlide(canvas: HTMLCanvasElement, s: SlideVisual, o: OpcoesDesenho): void {
  const { largura: w, altura: h } = TAMANHOS_VISUAIS[o.tamanho];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cor = ACENTOS[o.acento].cor;
  const u = w / 1080;
  const m = Math.round(Math.min(92 * u, h * 0.075));
  const util = w - 2 * m;
  const rodape = h - m - 34 * u;
  fundo(ctx, w, h, cor, o.ilustracao);

  let y = m;
  // rótulo
  if (s.rotulo) {
    ctx.fillStyle = cor;
    retangulo(ctx, m, y + 2 * u, 8 * u, 34 * u, 4 * u);
    ctx.fill();
    ctx.font = fonte(700, 30 * u);
    ctx.fillStyle = cor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(s.rotulo.toUpperCase().split('').join('\u200A'), m + 24 * u, y + 2 * u);
    y += 76 * u;
  }

  const areaBase = rodape - 28 * u;
  let areaFim = areaBase;
  const bloco = (texto: string, peso: number, tamMax: number, tamMin: number, altMax: number, corTexto: string, entrelinha = 1.2) => {
    if (!texto) return;
    // o mínimo acompanha a altura da arte: em formato baixo o texto encolhe mais em vez de invadir o rodapé
    const a = ajustarTexto(ctx, texto, peso, util, Math.max(0, Math.min(altMax, areaFim - y)), tamMax * u, Math.min(tamMin * u, h * 0.045), entrelinha);
    y = escrever(ctx, a.linhas, m, y, a.tam, a.entrelinha, corTexto, peso) + 26 * u;
  };

  const itens = s.itens.filter(Boolean);
  const painelItens = (numerar: boolean) => {
    if (!itens.length) return;
    // formato baixo (paisagem) com 3+ itens: duas colunas, para o texto não ficar minúsculo
    const colunas = w / h > 1.5 && itens.length > 2 ? 2 : 1;
    const linhasGrade = Math.ceil(itens.length / colunas);
    const folga = 18 * u;
    const largCard = (util - (colunas - 1) * folga) / colunas;
    const disponivel = areaFim - y;
    const altCard = Math.min(176 * u, (disponivel - (linhasGrade - 1) * folga) / linhasGrade);
    if (altCard < 22 * u) return;
    const topo = y;
    itens.forEach((it, idx) => {
      const x0 = m + (idx % colunas) * (largCard + folga);
      const y0 = topo + Math.floor(idx / colunas) * (altCard + folga);
      ctx.fillStyle = TEMA.painel;
      retangulo(ctx, x0, y0, largCard, altCard, 22 * u);
      ctx.fill();
      ctx.strokeStyle = TEMA.linha;
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      const marca = Math.min(40 * u, altCard * 0.6);
      const cx = x0 + 30 * u + marca / 2;
      const cy = y0 + altCard / 2;
      if (numerar) {
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.arc(cx, cy, marca / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TEMA.fundo; ctx.font = fonte(800, 26 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), cx, cy + 1 * u);
      } else {
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.arc(cx, cy, 9 * u, 0, Math.PI * 2); ctx.fill();
      }
      const xt = x0 + 30 * u + marca + 22 * u;
      const a = ajustarTexto(ctx, it, 600, largCard - (xt - x0) - 24 * u, altCard - 0.2 * altCard, 50 * u, Math.min(28 * u, altCard * 0.34), 1.18);
      const alturaTexto = a.linhas.length * a.tam * a.entrelinha;
      escrever(ctx, a.linhas, xt, y0 + (altCard - alturaTexto) / 2, a.tam, a.entrelinha, TEMA.texto, 600);
    });
    y = topo + linhasGrade * (altCard + folga);
  };

  switch (s.papel) {
    case 'capa': {
      y = Math.max(y, h * 0.16);
      bloco(s.titulo, 800, 104, 56, h * 0.46, TEMA.texto, 1.1);
      bloco(s.texto, 400, 46, 30, h * 0.2, TEMA.suave, 1.28);
      if (o.total > 1 && y < areaFim - 70 * u) {
        ctx.font = fonte(700, 34 * u); ctx.fillStyle = cor; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Deslize  →', m, areaFim - 34 * u);
      }
      break;
    }
    case 'numero': {
      y = Math.max(y, h * 0.1);
      const a = ajustarTexto(ctx, s.destaque || '—', 800, util, h * 0.3, 280 * u, Math.min(110 * u, h * 0.1), 1.05);
      y = escrever(ctx, a.linhas, m, y, a.tam, 1.05, cor, 800) + 20 * u;
      bloco(s.titulo, 700, 78, 42, h * 0.24, TEMA.texto, 1.14);
      bloco(s.texto, 400, 54, 30, areaFim - y, TEMA.suave, 1.3);
      painelItens(false);
      break;
    }
    case 'lista':
      bloco(s.titulo, 800, 78, 46, h * 0.24, TEMA.texto, 1.12);
      bloco(s.texto, 400, 40, 26, h * 0.12, TEMA.suave, 1.26);
      painelItens(true);
      break;
    case 'fecho': {
      y = Math.max(y, h * 0.2);
      // a assinatura fica no fim; o texto usa só o espaço acima dela
      if (o.autor) areaFim = areaBase - 90 * u;
      bloco(s.titulo, 800, 100, 52, h * 0.38, TEMA.texto, 1.1);
      bloco(s.texto, 400, 54, 32, h * 0.24, TEMA.suave, 1.3);
      painelItens(false);
      if (o.autor) {
        ctx.fillStyle = cor;
        retangulo(ctx, m, areaBase - 70 * u, 64 * u, 6 * u, 3 * u);
        ctx.fill();
        ctx.font = fonte(700, 40 * u); ctx.fillStyle = TEMA.texto; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(o.autor, m, areaBase - 50 * u);
      }
      break;
    }
    default:
      y = Math.max(y, h * 0.14);
      bloco(s.titulo, 800, 96, 50, h * 0.34, TEMA.texto, 1.1);
      bloco(s.texto, 400, 56, 30, areaFim - y, TEMA.suave, 1.32);
      painelItens(false);
  }

  // rodapé: autor à esquerda, posição à direita
  ctx.font = fonte(600, 28 * u);
  ctx.textBaseline = 'top';
  ctx.fillStyle = TEMA.suave;
  if (o.autor && s.papel !== 'fecho') { ctx.textAlign = 'left'; ctx.fillText(o.autor, m, rodape); }
  if (o.total > 1) { ctx.textAlign = 'right'; ctx.fillText(`${o.indice}/${o.total}`, w - m, rodape); }
}

export const paraBlob = (canvas: HTMLCanvasElement, tipo: 'image/png' | 'image/jpeg', qualidade = 0.92) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui gerar a imagem.'))), tipo, qualidade));

/** Imagem (PNG em base64 vindo do servidor) pronta para desenhar no fundo do slide. */
export function carregarImagem(mime: string, base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('A ilustração veio corrompida.'));
    img.src = `data:${mime};base64,${base64}`;
  });
}
