// =====================================================================
//  liga/importar.js — lê a planilha Calculo_de_Ligas (.xlsm / .xlsx)
//  e transforma nas fichas do sistema: ligas, retornos, histórico de
//  corridas (aba Banco de dados) e contadores (aba SET.).
//  Usa a biblioteca SheetJS, carregada só quando precisa.
// =====================================================================
import { ELEMENTOS, acharLiga, normLiga, lerOps, temAnalise } from './calculo.js?v=1.1.0';
import { idSeguro } from '../comum/banco.js';

const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => res(window.XLSX);
    s.onerror = () => rej(new Error('Não foi possível carregar o leitor de planilhas (sem internet?).'));
    document.head.appendChild(s);
  });
}

function n(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s || /[a-z]/i.test(s.replace(/e-?\d+$/i, ''))) return null;
  const t = /,\d*$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const x = parseFloat(t);
  return isFinite(x) ? x : null;
}
const txt = v => (v == null ? '' : String(v).trim());
const cab = v => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, '');

function dataISO(v) {
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number' && v > 30000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000));
  if (!d || isNaN(d)) return '';
  // datas do Excel chegam à meia-noite; somar 12h evita "voltar um dia" por fuso
  const x = new Date(d.getTime() + 12 * 3600000);
  return x.toISOString().slice(0, 10);
}

function aba(wb, XLSX, ...nomes) {
  const alvo = nomes.map(cab);
  const nome = wb.SheetNames.find(s => alvo.includes(cab(s)));
  if (!nome) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true });
}

// Colunas da aba "Banco de dados" (linha 2 de cabeçalho), na ordem da planilha.
const BD_MATERIAIS = [
  [12, 'grafite'], [13, 'fesi'], [14, 'femn_ac'], [15, 'fecr_bc'], [16, 'fecr_ac'], [17, 'fev'], [18, 'fenb'],
  [19, 'femo'], [21, 'cu'], [22, 'few'], [23, 'feti'], [25, 'ni'],
  [26, 'sae430'], [27, 'sae304'], [28, 'sae1020'], [29, 'sae316'], [30, 'sae420'],
];
const BD_ESTIMADO = 33; // AH..AT = C, Si, Mn, Cr, Ni, V, Nb, Mo, S, Cu, W, Ti, Al

export async function lerPlanilha(arquivo, ligasAtuais) {
  const XLSX = await carregarSheetJS();
  const buf = await arquivo.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const avisos = [];
  const out = { ligas: [], retornos: [], corridas: [], config: null, avisos };

  // ---------- Ligas ----------
  const L = aba(wb, XLSX, 'Ligas');
  if (L) {
    const linhaEl = L[1] || [];
    const pos = {};
    linhaEl.forEach((v, i) => {
      const e = ELEMENTOS.find(x => cab(x) === cab(v));
      if (e) pos[e] = i;
    });
    for (let r = 3; r < L.length; r++) {
      const nomeBruto = txt(L[r][0]);
      if (!nomeBruto || nomeBruto === '0') continue;
      const nome = nomeBruto === 'CF8 M' ? 'CF8M' : nomeBruto;
      const faixas = {};
      for (const e of Object.keys(pos)) {
        const mn = n(L[r][pos[e]]), mx = n(L[r][pos[e] + 1]);
        if (mn == null && mx == null) continue;
        if (!mn && !mx) continue;
        faixas[e] = [mn || 0, mx];
      }
      const atual = acharLiga(ligasAtuais, nome);
      out.ligas.push({
        id: atual ? atual.id : normLiga(nome),
        nome: atual ? atual.nome : nome,
        apelidos: atual ? (atual.apelidos || []) : [],
        temperatura: atual ? atual.temperatura : undefined,
        faixas,
        mudou: atual ? JSON.stringify(atual.faixas || {}) !== JSON.stringify(faixas) : true,
        nova: !atual,
      });
    }
  } else avisos.push('Aba "Ligas" não encontrada.');

  const ligasRef = [...ligasAtuais];
  for (const l of out.ligas) if (!acharLiga(ligasRef, l.nome)) ligasRef.push(l);
  const nomeLiga = bruto => { const l = acharLiga(ligasRef, bruto); return l ? l.nome : txt(bruto); };

  // ---------- Dados Retorno ----------
  const R = aba(wb, XLSX, 'Dados Retorno');
  const ordemRet = [];
  if (R) {
    const h = (R[0] || []).map(cab);
    const ci = (...op) => h.findIndex(x => op.some(o => x.startsWith(cab(o))));
    const cNum = ci('N RETORNO', 'NRETORNO'), cLiga = ci('LIGA'), cCod = ci('ALTOMATICO', 'AUTOMATICO', 'CODIGO');
    const cRel = ci('N RELATORIO', 'NRELATORIO', 'RELATORIO'), cVer = ci('QTD VERIFICADA', 'QTDVERIFICADA'), cUso = ci('UTILIZADO');
    const cEl = {};
    ELEMENTOS.forEach(e => { const i = h.indexOf(cab(e)); if (i >= 0) cEl[e] = i; });
    if (cLiga < 0 || cVer < 0) avisos.push('Aba "Dados Retorno" com colunas diferentes do esperado; confira os retornos.');
    const vistos = new Map();
    for (let r = 1; r < R.length; r++) {
      const row = R[r] || [];
      const ligaBruta = txt(row[cLiga]);
      let codigo = cCod >= 0 ? txt(row[cCod]) : '';
      const numero = cNum >= 0 ? txt(row[cNum]) : '';
      if (!ligaBruta) continue;                    // linha só numerada, ainda sem retorno
      if (!codigo) codigo = numero ? `${numero}-${ligaBruta}` : '';
      if (!codigo) continue;
      const analise = {};
      for (const e of Object.keys(cEl)) { const v = n(row[cEl[e]]); if (v != null) analise[e] = v; }
      let id = idSeguro(codigo);
      if (vistos.has(id)) { const k = vistos.get(id) + 1; vistos.set(id, k); id = id + ' (' + k + ')'; codigo = codigo + ' (' + k + ')'; avisos.push(`Retorno ${codigo.replace(/ \(\d+\)$/, '')} aparece repetido; o repetido entrou como "${codigo}".`); }
      else vistos.set(id, 1);
      const m = numero.match(/^\s*(\d+)\s*-\s*(\d+)/);
      const ret = {
        id, codigo, liga: nomeLiga(ligaBruta), ligaPlanilha: ligaBruta,
        relatorio: cRel >= 0 ? txt(row[cRel]) : '',
        analise, kgVerificado: n(row[cVer]) || 0, baixaPlanilha: cUso >= 0 ? (n(row[cUso]) || 0) : 0,
        origem: 'planilha',
        corridaRef: m ? { refratario: +m[1], anual: +m[2] } : null,
      };
      out.retornos.push(ret);
      if (m) ordemRet.push({ ref: +m[1], anual: +m[2], liga: ligaBruta, codigo: ret.codigo });
    }
  } else avisos.push('Aba "Dados Retorno" não encontrada.');

  // ---------- Banco de dados (histórico de corridas) ----------
  const B = aba(wb, XLSX, 'Banco de dados');
  if (B) {
    const h = (B[1] || []).map(cab);
    const confere = cab(h[1]).startsWith('NCORRIDA') && cab(h[2]).startsWith('LIGA') && cab(h[12]) === 'GRAFITE' && cab(h[BD_ESTIMADO]) === 'C';
    if (!confere) avisos.push('Aba "Banco de dados" com colunas diferentes do esperado; o histórico de corridas não foi lido.');
    else {
      let p = 0, seq = 0;
      for (let r = 2; r < B.length; r++) {
        const row = B[r] || [];
        if (row[0] == null && row[1] == null && row[2] == null) continue;
        seq++;
        const ref = n(row[1]);
        const ligaBruta = txt(row[2]);
        // Acha o retorno gerado por esta corrida (mesmo nº do refratário e mesma liga, na sequência)
        let anual = null, retornoGerado = null;
        for (let j = p; j < Math.min(p + 8, ordemRet.length); j++) {
          const o = ordemRet[j];
          if (o.ref === ref && nomeLiga(o.liga) === nomeLiga(ligaBruta)) { anual = o.anual; retornoGerado = o.codigo; p = j + 1; break; }
        }
        const retornos = [];
        for (const [ci, ck] of [[6, 7], [8, 9], [10, 11]]) {
          const cod = txt(row[ci]), kg = n(row[ck]);
          if (!kg || !cod) continue;
          if (/^manual/i.test(cod)) continue;
          retornos.push({ codigo: cod, kg });
        }
        const manuais = [];
        for (const [ci, ck] of [[8, 9], [10, 11]]) {
          const cod = txt(row[ci]), kg = n(row[ck]);
          if (kg && /^manual/i.test(cod)) manuais.push({ desc: cod + ' (composição não ficou salva na planilha)', kg, analise: {} });
        }
        const materiais = {};
        for (const [ci, id] of BD_MATERIAIS) { const kg = n(row[ci]); if (kg) materiais[id] = kg; }
        const estimadoPlanilha = {};
        ELEMENTOS.forEach((e, i) => { const v = n(row[BD_ESTIMADO + i]); if (v != null) estimadoPlanilha[e] = v; });
        const temp = n(String(row[5] == null ? '' : row[5]).replace(/[^\d.,]/g, ''));
        out.corridas.push({
          id: 'planilha-' + String(seq).padStart(4, '0'),
          origem: 'planilha',
          data: dataISO(row[0]),
          refratario: ref, anual, anualInferido: anual != null,
          liga: nomeLiga(ligaBruta), ligaPlanilha: ligaBruta,
          ops: lerOps(row[3]), opsTexto: txt(row[3]),
          carga: n(row[4]) || 0, temperatura: temp || null,
          retornos, manuais, materiais, estimadoPlanilha,
          retornoGerado,
        });
      }
    }
  } else avisos.push('Aba "Banco de dados" não encontrada.');

  // ---------- SET. (contadores e limites do forno) ----------
  const T = aba(wb, XLSX, 'SET.', 'SET');
  if (T) {
    const anual = n((T[1] || [])[8]), ref = n((T[1] || [])[10]);
    const min = n((T[1] || [])[4]), max = n((T[3] || [])[4]);
    out.config = { contadores: { anual: anual || 0, refratario: ref || 0 }, forno: { min: min || 640, max: max || 650 } };
  }

  out.resumo = {
    ligas: out.ligas.length,
    ligasNovas: out.ligas.filter(l => l.nova).length,
    ligasMudaram: out.ligas.filter(l => !l.nova && l.mudou).map(l => l.nome),
    retornos: out.retornos.length,
    retornosComSaldo: out.retornos.filter(r => r.kgVerificado - r.baixaPlanilha > 0.05).length,
    retornosSemAnalise: out.retornos.filter(r => !temAnalise(r.analise)).length,
    corridas: out.corridas.length,
    corridasComRetornoGerado: out.corridas.filter(c => c.retornoGerado).length,
    periodo: out.corridas.length ? [out.corridas.map(c => c.data).filter(Boolean).sort()[0], out.corridas.map(c => c.data).filter(Boolean).sort().pop()] : null,
  };
  return out;
}
