// =====================================================================
//  liga/laudo.js — lê o PDF do certificado de análise do laboratório
//  (Priner, "CERTIFICADO DE ANÁLISE DE MATERIAL", FOR-LAB-0035) e devolve
//  a análise e os dados do certificado, para preencher a ficha da corrida.
//  Usa a biblioteca pdf.js, carregada só quando precisa. Funciona com PDF
//  de texto (o que o laboratório manda); PDF escaneado (foto) não tem texto.
// =====================================================================
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function carregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return rej(new Error('leitor de PDF não carregou'));
      lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
      res(lib);
    };
    s.onerror = () => rej(new Error('Não foi possível carregar o leitor de PDF (sem internet?).'));
    document.head.appendChild(s);
  });
}

// Símbolos que podem aparecer no cabeçalho da tabela de resultados
const SIMBOLOS = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Al', 'Co', 'Cu', 'Nb', 'Ti', 'V', 'W', 'Pb', 'Sn', 'B', 'Fe', 'Mg', 'N', 'Zr', 'Ca', 'As', 'Sb', 'Bi', 'Zn', 'Ce', 'Ta', 'Te', 'Se', 'La'];

// "0,51" → 0.51 · "<0,0010" → 0.001 · "-" → null
function numero(t) {
  const s = String(t || '').replace(/\s/g, '').replace(/^[<>≤≥]/, '');
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null;
  const x = parseFloat(s.replace(',', '.'));
  return isFinite(x) ? x : null;
}
const dataISO = t => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(t || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

// Itens de texto da página com a posição (x do centro, y da linha)
async function itensDaPagina(pg) {
  const tc = await pg.getTextContent();
  return tc.items.filter(i => i.str && i.str.trim()).map(i => ({
    t: i.str.trim(), x: i.transform[4] + (i.width || 0) / 2, y: i.transform[5], h: Math.abs(i.transform[3]) || 8,
  }));
}

// Agrupa itens na mesma altura (tolerância em pontos)
function linhas(itens, tol = 3) {
  const ls = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y)) {
    const l = ls.find(l => Math.abs(l.y - it.y) <= tol);
    if (l) l.itens.push(it); else ls.push({ y: it.y, itens: [it] });
  }
  ls.forEach(l => l.itens.sort((a, b) => a.x - b.x));
  return ls;
}

// Tabela "Composição (%peso)": linha de símbolos + linha "Resultado" logo abaixo.
// Cada valor vai para o símbolo de x mais próximo.
function analiseDaPagina(itens) {
  const analise = {};
  const ls = linhas(itens);
  const cabecalhos = ls.map(l => ({ y: l.y, sim: l.itens.filter(i => SIMBOLOS.includes(i.t)) })).filter(l => l.sim.length >= 3);
  const rotulos = itens.filter(i => /^Resultado\b/i.test(i.t));
  for (const cab of cabecalhos) {
    // "Resultado" mais perto abaixo do cabeçalho (y menor no PDF)
    const r = rotulos.filter(i => i.y < cab.y).sort((a, b) => b.y - a.y)[0];
    if (!r) continue;
    const prox = cabecalhos.filter(c => c.y < cab.y).sort((a, b) => b.y - a.y)[0];
    if (prox && r.y < prox.y) continue;       // o "Resultado" é da tabela de baixo
    const valores = itens.filter(i => Math.abs(i.y - r.y) <= Math.max(6, r.h) && i !== r && numero(i.t) != null);
    for (const v of valores) {
      const s = cab.sim.reduce((a, b) => (Math.abs(b.x - v.x) < Math.abs(a.x - v.x) ? b : a));
      if (Math.abs(s.x - v.x) < 40 && analise[s.t] == null) analise[s.t] = numero(v.t);
    }
  }
  return analise;
}

// Lê o arquivo (File/Blob) e devolve { analise: {C: 0.51, …}, relatorio, emissao (AAAA-MM-DD), corrida: {refratario, anual}, laboratorio }
export async function lerLaudo(arquivo) {
  const lib = await carregarPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  let analise = {}, texto = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const itens = await itensDaPagina(await pdf.getPage(p));
    texto += '\n' + linhas(itens).map(l => l.itens.map(i => i.t).join(' ')).join('\n');
    analise = { ...analiseDaPagina(itens), ...analise };
  }
  if (!texto.trim()) throw new Error('o PDF não tem texto (parece escaneado). Digite a análise à mão.');
  const m = (re, i = 1) => { const r = re.exec(texto); return r ? r[i].trim() : ''; };
  const corr = /CORRIDA\s*(\d+)\s*[-–—/]\s*(\d+)/i.exec(texto);
  return {
    analise,
    relatorio: m(/\b(\d{3,}\.\d{3,}-\d+\/[A-Z]{2,}(?:-[A-Z]{2,})*)/),
    emissao: dataISO(m(/Emiss[aã]o[^\n]{0,60}?(\d{2}\/\d{2}\/\d{4})/i)),
    corrida: corr ? { refratario: +corr[1], anual: +corr[2] } : null,
    laboratorio: /priner/i.test(texto) ? 'Priner' : '',
  };
}

// Para as telas: lê o PDF e avisa o problema (aviso = função da casca). Devolve o resultado ou null.
export async function lerLaudoOuAvisar(arquivo, aviso) {
  if (!arquivo) return null;
  if (!/pdf$/i.test(arquivo.type) && !/\.pdf$/i.test(arquivo.name)) { aviso('Escolha o arquivo PDF do laboratório.', 'erro'); return null; }
  let r;
  try { r = await lerLaudo(arquivo); }
  catch (e) { console.error(e); aviso('Não consegui ler o PDF: ' + e.message, 'erro'); return null; }
  if (!Object.keys(r.analise).length) { aviso('Não achei a tabela de resultados neste PDF. Digite a análise à mão.', 'erro'); return null; }
  return r;
}
