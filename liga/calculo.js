// =====================================================================
//  liga/calculo.js — as contas do Cálculo de Liga (sem tela).
//  Mesma lógica da aba CALCULO DE CARGA da planilha:
//    composição estimada (%) = soma(kg do material × teor %) ÷ carga total
// =====================================================================

export const ELEMENTOS = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'V', 'Nb', 'Mo', 'S', 'Cu', 'W', 'Ti', 'Al'];

export const COL = {
  config: 'eng_config',
  ligas: 'eng_ligas',
  materiais: 'eng_materiais',
  retornos: 'eng_retornos',
  corridas: 'eng_corridas',
};

// "CF8 M", "cf8-m" → "CF8M" (para comparar nomes de liga)
export function normLiga(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function acharLiga(ligas, nome) {
  const n = normLiga(nome);
  if (!n) return null;
  return ligas.find(l => normLiga(l.nome) === n) ||
    ligas.find(l => (l.apelidos || []).some(a => normLiga(a) === n)) || null;
}

// Mesma liga? (considera apelidos: FB = A-532, DF = DRF…)
export function mesmaLiga(ligas, a, b) {
  const la = acharLiga(ligas, a), lb = acharLiga(ligas, b);
  if (la && lb) return la.id === lb.id;
  return normLiga(a) === normLiga(b);
}

// Lista de tudo que entra no forno, com kg e teores.
export function itensDaCarga(corrida, { materiais, retornosPorCodigo }) {
  const itens = [];
  for (const r of corrida.retornos || []) {
    const kg = +r.kg || 0;
    if (!r.codigo && !kg) continue;
    const ret = retornosPorCodigo.get(r.codigo);
    itens.push({ tipo: 'retorno', nome: r.codigo, kg, teores: (ret && ret.analise) || {}, semAnalise: !ret || !temAnalise(ret.analise) });
  }
  for (const m of corrida.manuais || []) {
    const kg = +m.kg || 0;
    if (!kg) continue;
    itens.push({ tipo: 'manual', nome: m.desc || 'Entrada manual', kg, teores: m.analise || {}, semAnalise: !temAnalise(m.analise) });
  }
  const qtd = corrida.materiais || {};
  for (const mat of materiais) {
    const kg = +qtd[mat.id] || 0;
    if (!kg) continue;
    itens.push({ tipo: mat.tipo, nome: mat.nome, mp: mat.mp, id: mat.id, kg, teores: mat.teores || {} });
  }
  return itens;
}

export function temAnalise(a) {
  return !!a && ELEMENTOS.some(e => a[e] != null && a[e] !== '');
}

export function calcular(corrida, ctx) {
  const itens = itensDaCarga(corrida, ctx);
  const carga = itens.reduce((s, i) => s + i.kg, 0);
  const estimado = {};
  for (const e of ELEMENTOS) {
    let soma = 0;
    for (const i of itens) soma += i.kg * (+i.teores[e] || 0);
    estimado[e] = carga ? soma / carga : 0;
  }
  return { itens, carga, estimado };
}

// 'baixo' | 'ok' | 'alto' | null (sem faixa para o elemento)
export function situacaoElemento(valor, faixa) {
  if (!faixa || valor == null || valor === '') return null;
  const [min, max] = faixa;
  const v = +valor;
  if (min != null && v < min - 1e-9) return 'baixo';
  if (max != null && max !== '' && v > max + 1e-9) return 'alto';
  return 'ok';
}

// Resume uma composição contra a norma: { foraDaNorma: ['C alto', ...] }
export function conferir(comp, liga) {
  const fora = [];
  if (!comp || !liga) return fora;
  for (const e of ELEMENTOS) {
    const f = liga.faixas && liga.faixas[e];
    if (!f) continue;
    const v = comp[e];
    if (v == null || v === '') continue;
    const s = situacaoElemento(v, f);
    if (s === 'baixo' || s === 'alto') fora.push(e + (s === 'baixo' ? ' baixo' : ' alto'));
  }
  return fora;
}

// Saldo de cada retorno.
// saldo = kg verificado − baixa trazida da planilha − kg usados nas corridas do sistema
// (corridas importadas da planilha não contam, porque a baixa delas já veio na coluna "Utilizado")
export function saldos(retornos, corridas) {
  const mapa = new Map();
  for (const r of retornos) {
    mapa.set(r.codigo, { verificado: +r.kgVerificado || 0, baixaPlanilha: +r.baixaPlanilha || 0, usado: 0, usos: [] });
  }
  for (const c of corridas) {
    if (c.origem === 'planilha') continue;
    for (const u of c.retornos || []) {
      if (!u.codigo || !(+u.kg)) continue;
      let s = mapa.get(u.codigo);
      if (!s) { s = { verificado: 0, baixaPlanilha: 0, usado: 0, usos: [], semCadastro: true }; mapa.set(u.codigo, s); }
      s.usado += +u.kg;
      s.usos.push({ corridaId: c.id, kg: +u.kg, numero: numeroCorrida(c), data: c.data });
    }
  }
  for (const s of mapa.values()) s.saldo = Math.round((s.verificado - s.baixaPlanilha - s.usado) * 10) / 10;
  return mapa;
}

export function numeroCorrida(c) {
  if (!c) return '';
  const ref = c.refratario != null && c.refratario !== '' ? c.refratario : '?';
  const an = c.anual != null && c.anual !== '' ? c.anual : '?';
  return `${ref} / ${an}`;
}

export function codigoRetornoDaCorrida(c, nomeLiga) {
  return `${c.refratario ?? ''}-${c.anual ?? ''}-${nomeLiga || c.liga || ''}`.replace(/^-+|-+$/g, '');
}

export function idCorrida(c) {
  const ano = String(c.data || '').slice(0, 4) || String(new Date().getFullYear());
  return `${ano}-${String(c.anual).padStart(3, '0')}`;
}

// Situação da corrida para a lista
export function statusCorrida(c, liga, retornoGerado) {
  const real = temAnalise(c.real) ? c.real : (retornoGerado && temAnalise(retornoGerado.analise) ? retornoGerado.analise : null);
  // Corridas antigas da planilha: só mostramos a análise do retorno, sem julgar dentro/fora
  if (c.origem === 'planilha' && !temAnalise(c.real)) {
    return { cod: 'historico', texto: 'Histórico', cls: 'neutro', real, fora: conferir(real, liga) };
  }
  if (!real) return { cod: 'aguardando', texto: 'Aguardando análise', cls: 'alerta', real: null, fora: [] };
  const fora = conferir(real, liga);
  return fora.length
    ? { cod: 'fora', texto: 'Fora da norma', cls: 'erro', real, fora }
    : { cod: 'ok', texto: 'Dentro da norma', cls: 'ok', real, fora };
}

// Lista as OPs escritas de qualquer jeito: "OP:3216--", "op 1396 / 1397" → ["3216"], ["1396","1397"]
export function lerOps(texto) {
  return (String(texto == null ? '' : texto).match(/\d{3,}/g) || []).filter((v, i, a) => a.indexOf(v) === i);
}
