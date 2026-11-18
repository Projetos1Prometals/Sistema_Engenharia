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

// =====================================================================
//  Planilha CONTROLE_CORRIDA_ENGENHARIA — abas "Controle Corrida AAAA"
//  Uma linha por corrida: data, nº (refratário), nº anual, liga, retorno, OP,
//  kg de cada material, Recarga, Total (= carga do forno + recarga) e laboratório.
//  - Corrida que já veio da aba Banco de dados (mesma data, nº e liga): só é completada
//    (nº anual real, recarga, relatório e datas do laboratório) — ver aplicarControle().
//  - Corrida que só existe aqui: entra como histórico ("hist-AAAA-NNN"), sem estimado.
// =====================================================================

// Cabeçalho (normalizado por cab()) → material do cadastro
const CT_MATERIAIS = {
  SUCATA430KG: 'sae430', '316KG': 'sae316', '304KG': 'sae304', SUCATA304KG: 'sae304', SUCATA316KG: 'sae316',
  SIKG: 'fesi', CRACKG: 'fecr_ac', MNACKG: 'femn_ac', MNBCKG: 'femn_bc', MOKG: 'femo', NBKG: 'fenb',
  CRBCKG: 'fecr_bc', VKG: 'fev', NIQUELNI: 'ni', NIQUELKG: 'ni', CUKG: 'cu', GRAFITEKG: 'grafite', INOX420: 'sae420',
};
// Materiais da planilha que não estão no cadastro: entram como entrada manual (kg sem composição)
const CT_MANUAIS = { INOX410: 'Inox 410', SUCATA1010KG: 'Sucata 1010' };

// Junta à corrida os dados da planilha Controle (usado na importação da Controle e
// também ao reimportar a Calculo de Ligas, para não perder o que veio da Controle).
export function aplicarControle(c, ct) {
  if (!ct) return c;
  const x = { ...c, controle: ct };
  if (ct.anual != null) { x.anual = ct.anual; x.anualInferido = false; }
  if (!(x.ops || []).length && ct.ops && ct.ops.length) { x.ops = ct.ops; x.opsTexto = ct.opsTexto; }
  x.lab = { ...(c.lab || {}) };
  if (ct.relatorio && !x.lab.relatorio) x.lab.relatorio = ct.relatorio;
  if (ct.dataColeta && !x.lab.dataColeta) x.lab.dataColeta = ct.dataColeta;
  if (ct.dataResultado && !x.lab.data) x.lab.data = ct.dataResultado;
  if (ct.recarga) {
    const rets = (c.retornos || []).map(r => ({ ...r }));
    const alvo = rets.find(r => ct.retorno && r.codigo === ct.retorno) || rets[0];
    if (alvo) alvo.recarga = ct.recarga;
    else rets.push({ codigo: ct.retorno || '', kg: 0, recarga: ct.recarga });
    x.retornos = rets;
  }
  if (!x.retornoGerado && ct.retornoGerado) x.retornoGerado = ct.retornoGerado;
  return x;
}


export async function lerControle(arquivo, { ligas, retornos, corridas }) {
  const XLSX = await carregarSheetJS();
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true });
  const avisos = [];
  // A Controle escreve a liga de vários jeitos ("A-532 (FB)", "304 CF8", "316 CF8 M", "Inox 430", "Aço MN", "A27/1030").
  // Tenta: o texto todo, sem o parêntese, o que está no parêntese, os finais ("CF8 M"), cada pedaço.
  const nomeLiga = bruto => {
    const s = txt(bruto);
    const pal = s.replace(/\(.*?\)/g, ' ').split(/[\s/]+/).filter(Boolean);
    const cands = [s, s.replace(/\(.*?\)/g, ''), ...(s.match(/\((.*?)\)/g) || []).map(p => p.slice(1, -1)),
      ...pal.map((_, i) => pal.slice(i).join(' ')), ...pal];
    for (const c of cands) { const l = acharLiga(ligas, c); if (l) return l.nome; }
    return s;
  };
  const normRel = s => txt(s).toUpperCase().replace(/\s/g, '');

  // Retornos do cadastro: pelo começo do código ("57-223" → "57-223-CRK") e pelo nº do relatório
  const porRelatorio = new Map();
  for (const r of retornos) { const k = normRel(r.relatorio); if (k) porRelatorio.set(k, porRelatorio.has(k) ? null : r.codigo); }
  const acharRetorno = bruto => {
    const s = txt(bruto);
    if (!/^\d+\s*-\s*\d+$/.test(s)) return s;
    const p = s.replace(/\s/g, '') + '-';
    const achados = retornos.filter(r => String(r.codigo).replace(/\s/g, '').startsWith(p));
    return achados.length === 1 ? achados[0].codigo : s.replace(/\s/g, '');
  };

  // Retorno gerado pela corrida: o código "68-190-SFK" é a corrida nº 68, anual 190 (só quando o par é único)
  const porRefAnual = new Map();
  for (const r of retornos) {
    const m = String(r.codigo).match(/^\s*(\d+)\s*-\s*(\d+)\s*-/);
    const k = r.corridaRef ? `${r.corridaRef.refratario}-${r.corridaRef.anual}` : m ? `${+m[1]}-${+m[2]}` : '';
    if (k) porRefAnual.set(k, porRefAnual.has(k) ? null : r);
  }

  // Corridas que vieram da aba Banco de dados, para completar em vez de duplicar.
  // As datas das duas planilhas às vezes diferem em alguns dias: casa pelo mesmo nº da corrida
  // até 7 dias de diferença, confirmando pela OP, pelo nº anual ou pela liga.
  const doBanco = corridas.filter(c => c.origem === 'planilha' && String(c.id).startsWith('planilha-'));
  const dias = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
  const acharNoBanco = (data, ref, anual, liga, ops, carga, usados) => {
    let melhor = null, nota = 0;
    for (const c of doBanco) {
      if (usados.has(c.id) || c.refratario !== ref || !c.data || dias(c.data, data) > 7) continue;
      let p = 0;
      if (ops.length && (c.ops || []).some(o => ops.includes(o))) p += 4;
      if (anual != null && c.anual === anual) p += 3;
      if (liga && normLiga(c.liga) === normLiga(liga)) p += 2;
      if (carga && c.carga && Math.abs(c.carga - carga) <= 1) p += 2;
      if (p < 2) continue;
      p += c.data === data ? 1 : -dias(c.data, data) * 0.1;
      if (p > nota) { nota = p; melhor = c; }
    }
    return melhor;
  };

  const out = { completar: [], novas: [], abas: [], avisos, ultima: null };
  const usados = new Set();
  const abas = wb.SheetNames.map(nome => ({ nome, ano: (nome.match(/^\s*controle[\s_]*corrida[\s_]*(\d{4})\s*$/i) || [])[1] }))
    .filter(a => a.ano).sort((a, b) => a.ano - b.ano);
  if (!abas.length) avisos.push('Nenhuma aba "Controle Corrida AAAA" encontrada nesta planilha.');

  for (const { nome, ano } of abas) {
    const L = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true });
    const cabCt = v => cab(txt(v).normalize('NFD').replace(/[̀-ͯ]/g, ''));   // "Relatório" → RELATORIO
    const iCab = L.slice(0, 6).findIndex(r => (r || []).some(v => cabCt(v) === 'DATACORRIDA'));
    if (iCab < 0) { avisos.push(`Aba "${nome}": não achei o cabeçalho (Data corrida); aba ignorada.`); continue; }
    const h = (L[iCab] || []).map(cabCt);
    const col = (...nomes) => h.findIndex(x => nomes.includes(x));
    const cData = col('DATACORRIDA'), cRef = col('NCORRIDA'), cAnual = col('NCORRIDAANUAL');
    const cLiga = col('LIGAMATERIALTECHMELT', 'LIGAMATERIALPROMETALS'), cTerc = col('LIGAMATERIALTERCEIROS');
    const cOp = col('OPLIGA'), cRetKg = col('RETORNOKG'), cRec = col('RECARGAKG'), cTot = col('TOTALCORRIDAKG');
    const cRel = col('NRELATORIO'), cColeta = col('DATACOLETALABORATORIO'), cEntrega = col('DATAENTREGARELATORIO');
    // Coluna do retorno: a de "Rastreio"/"Retorno" logo antes da OP (as outras viram observação)
    const cRastreios = h.map((x, i) => (/^N(RASTREIO|RETORNO)/.test(x) ? i : -1)).filter(i => i >= 0);
    const antesDaOp = cRastreios.filter(i => cOp < 0 || i < cOp);
    const cRet = antesDaOp.length ? antesDaOp[antesDaOp.length - 1] : (cRastreios.length ? cRastreios[0] : -1);
    const cOutrosRastreios = cRastreios.filter(i => i !== cRet);
    const cMat = [], cMan = [];
    h.forEach((x, i) => { if (CT_MATERIAIS[x]) cMat.push([i, CT_MATERIAIS[x]]); else if (CT_MANUAIS[x]) cMan.push([i, CT_MANUAIS[x]]); });
    if (cRef < 0 || cAnual < 0 || cRetKg < 0) { avisos.push(`Aba "${nome}": colunas diferentes do esperado; aba ignorada.`); continue; }
    const resumo = { aba: nome, ano: +ano, lidas: 0, completadas: 0, novas: 0 };

    for (let r = iCab + 1; r < L.length; r++) {
      const row = L[r] || [];
      const data = dataISO(row[cData]);
      const ref = n(row[cRef]), anual = n(row[cAnual]);
      if (!data || (ref == null && anual == null)) continue;      // linhas de total / em branco
      resumo.lidas++;
      const ligaBruta = txt(row[cLiga]) || txt(row[cTerc]).replace(/\(\s*terceir\w*\s*\)/i, '').trim();
      const liga = nomeLiga(ligaBruta);
      const recarga = cRec >= 0 ? (n(row[cRec]) || 0) : 0;
      const total = cTot >= 0 ? n(row[cTot]) : null;
      const retorno = cRet >= 0 && txt(row[cRet]) ? acharRetorno(row[cRet]) : '';
      const relatorio = cRel >= 0 ? txt(row[cRel]) : '';
      const opsTexto = cOp >= 0 ? txt(row[cOp]) : '';
      const ct = {
        aba: nome, linha: r + 1, anual, recarga, total, retorno, relatorio,
        ops: lerOps(opsTexto).length ? lerOps(opsTexto) : (/^\d+$/.test(opsTexto) ? [opsTexto] : []), opsTexto,
        dataColeta: cColeta >= 0 ? dataISO(row[cColeta]) : '', dataResultado: cEntrega >= 0 ? dataISO(row[cEntrega]) : '',
        terceiros: !txt(row[cLiga]) && !!txt(row[cTerc]),
        outrosRastreios: cOutrosRastreios.map(i => txt(row[i])).filter(Boolean),
        retornoGerado: relatorio ? (porRelatorio.get(normRel(relatorio)) || '') : '',
      };
      if (!ct.retornoGerado && +data.slice(0, 4) >= 2025) {
        const rg = porRefAnual.get(`${ref}-${anual}`);
        if (rg && normLiga(nomeLiga(rg.liga)) === normLiga(liga)) ct.retornoGerado = rg.codigo;
      }
      if (!ct.outrosRastreios.length) delete ct.outrosRastreios;
      Object.keys(ct).forEach(k => { if (ct[k] === '' || ct[k] == null || ct[k] === false) delete ct[k]; });

      const existente = acharNoBanco(data, ref, anual, liga, ct.ops || [], total != null ? total - recarga : null, usados);
      if (existente) {
        usados.add(existente.id);
        out.completar.push({ id: existente.id, ct });
        resumo.completadas++;
      } else {
        const materiais = {};
        for (const [i, id] of cMat) { const kg = n(row[i]); if (kg) materiais[id] = (materiais[id] || 0) + kg; }
        const manuais = [];
        for (const [i, desc] of cMan) { const kg = n(row[i]); if (kg) manuais.push({ desc: desc + ' (sem composição)', kg, analise: {} }); }
        const retKg = n(row[cRetKg]) || 0;
        const rets = retorno || retKg || recarga ? [{ codigo: retorno || 'Retorno (sem nº na planilha)', kg: retKg, recarga: 0 }] : [];
        const somaKg = retKg + Object.values(materiais).reduce((s, v) => s + v, 0) + manuais.reduce((s, m) => s + m.kg, 0);
        let id = `hist-${ano}-${String(anual != null ? anual : 'r' + ref).padStart(3, '0')}`;
        if (out.novas.some(c => c.id === id)) {
          let k = 2; while (out.novas.some(c => c.id === `${id}-${k}`)) k++;
          id = `${id}-${k}`;
          avisos.push(`${nome}: a corrida anual ${anual} aparece mais de uma vez (linha ${r + 1}).`);
        }
        out.novas.push(aplicarControle({
          id, origem: 'planilha', data, ano: +data.slice(0, 4), refratario: ref, anual, anualInferido: false,
          liga, ligaPlanilha: ligaBruta, ligaId: normLiga(liga),
          ops: [], opsTexto: '', carga: Math.round((total != null ? total - recarga : somaKg) * 10) / 10, temperatura: null,
          retornos: rets, manuais, materiais, estimadoPlanilha: {},
          real: {}, lab: {}, retornoGerado: '',
          obs: ct.outrosRastreios ? 'Rastreio na planilha: ' + ct.outrosRastreios.join(', ') : '',
        }, ct));
        resumo.novas++;
      }
      if (!out.ultima || data > out.ultima.data || (data === out.ultima.data && (anual || 0) > (out.ultima.anual || 0))) out.ultima = { data, anual, refratario: ref };
    }
    out.abas.push(resumo);
  }

  const ligasDesconhecidas = [...new Set(out.novas.filter(c => c.liga && !acharLiga(ligas, c.liga)).map(c => c.ligaPlanilha))];
  if (ligasDesconhecidas.length) avisos.push('Ligas que não estão no cadastro (entram com o nome da planilha): ' + ligasDesconhecidas.join(', ') + '.');
  const semLiga = out.novas.filter(c => !c.liga).length;
  if (semLiga) avisos.push(`${semLiga} corridas sem liga na planilha.`);
  const todos = [...out.completar.map(x => x.ct), ...out.novas.map(c => c.controle)];
  out.resumo = {
    completadas: out.completar.length, novas: out.novas.length,
    comRecarga: todos.filter(ct => ct.recarga).length,
    comRelatorio: todos.filter(ct => ct.relatorio).length,
    ligadasAnalise: todos.filter(ct => ct.retornoGerado).length,
  };
  return out;
}
