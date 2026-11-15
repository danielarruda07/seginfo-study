import type { FonteExposicao } from './tipos.js';
import { fontes as esperadaReal } from './esperadaReal.js';
import { fontes as reputacao } from './reputacao.js';
import { fontes as saudeSite } from './saudeSite.js';
import { fontes as shodanCensys } from './shodanCensys.js';
import { fontes as typosquatting } from './typosquatting.js';
import { fontes as wayback } from './wayback.js';
import { fontes as vazamentos } from './vazamentos.js';
import { fontes as github } from './github.js';
import { fontes as reputacaoUrl } from './reputacaoUrl.js';

/** Registro das fontes extras, na ordem em que aparecem na ficha do alvo. */
export const FONTES: FonteExposicao[] = [
  ...esperadaReal,
  ...reputacao,
  ...shodanCensys,
  ...saudeSite,
  ...typosquatting,
  ...reputacaoUrl,
  ...vazamentos,
  ...wayback,
  ...github,
];

export const fontePorId = (id: string) => FONTES.find((f) => f.id === id);
