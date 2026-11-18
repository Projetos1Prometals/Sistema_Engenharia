// =====================================================================
//  modelos/regras.js — regras do Controle de Modelos (sem tela)
//  - Cada modelo tem um CÓDIGO ÚNICO (o id do documento sai do código
//    normalizado, então não existe como gravar dois modelos com o mesmo código).
//  - Cada posição de prateleira (Rua + nº, ex.: K15) guarda no máximo um modelo.
//  - Situação: "manutencao" quando foi mandado para manutenção (a posição fica reservada);
//    sem isso, "disponivel" se tem posição, "fora" (fora do estoque) se não tem.
// =====================================================================

export const COL = { modelos: 'eng_modelos', ruas: 'eng_ruas' };

export const SITUACOES = {
  disponivel: { texto: 'Disponível', cls: 'ok' },
  manutencao: { texto: 'Em manutenção', cls: 'alerta' },
  fora: { texto: 'Fora do estoque', cls: 'neutro' },
};

export const EXTENSOES = { 1: 'Não', 2: 'Over Hang', 3: 'Inner Hang' };

// Campos da ficha comercial (aba Comercial da planilha), na ordem da planilha
export const CAMPOS_COMERCIAIS = [
  ['diametro', 'Diâmetro (pol)'], ['variacao', 'Variação'], ['extensao', 'Extensão disco'],
  ['refinador', 'Refinador'], ['descRefinador', 'Descrição refinador'], ['area', 'Área refinadora'],
  ['setores', 'Qtd setores'], ['kmRev', 'Km/rev'], ['segmentos', 'Qtd segmentos/disco'],
  ['discos', 'Qtd disco'], ['embalagem', 'Dimensão embalagem'], ['peso', 'Peso embalagem'],
];

// "opt 01 " → "OPT 01" (para comparar códigos sem ligar para maiúsculas e espaços)
export function normCodigo(s) {
  return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toUpperCase();
}
export function idModelo(codigo) {
  return normCodigo(codigo).replace(/[\/\\#?\[\]]+/g, '_').slice(0, 140);
}
// chave do PDF do desenho no banco de arquivos
export const chaveDesenho = id => 'modelo_' + id;

export function situacao(m) {
  if (!m) return 'fora';
  if (m.situacao === 'manutencao') return 'manutencao';
  return m.posicao ? 'disponivel' : 'fora';
}

// "k15" → { rua: 'K', n: 15, pos: 'K15' }
export function lerPosicao(p) {
  const m = String(p == null ? '' : p).trim().toUpperCase().match(/^([A-Z]+)\s*-?\s*(\d+)$/);
  return m ? { rua: m[1], n: +m[2], pos: m[1] + (+m[2]) } : null;
}

export function posicoesDaRua(rua) {
  const out = [];
  for (let i = 1; i <= (+rua.posicoes || 0); i++) out.push(rua.letra + i);
  return out;
}

// Mapa posição → modelo
export function ocupacao(modelos) {
  const mapa = new Map();
  for (const m of modelos) if (m.posicao) mapa.set(m.posicao, m);
  return mapa;
}

// número do diâmetro para ordenar ("20\"/22\"" → 20)
export function chaveDiametro(d) {
  const m = String(d == null ? '' : d).match(/\d+([.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 9999;
}

// "4 Vol", "1vol", "3" → número
export function lerVolumes(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const m = String(v == null ? '' : v).match(/\d+/);
  return m ? +m[0] : null;
}
