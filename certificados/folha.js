// =====================================================================
//  certificados/folha.js — a folha do Certificado de Qualidade (sem banco)
//  Mesmo layout do app antigo / da planilha: 12 colunas, A4, cada campo
//  editável direto na folha (contenteditable) quando "ed" = true.
// =====================================================================

export const Q1 = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Al', 'Co'];
export const Q1N = ['Carbono', 'Silício', 'Manganês', 'Fósforo', 'Enxofre', 'Cromo', 'Molibd.', 'Níquel', 'Alumínio', 'Cobalto'];
export const Q2 = ['Cu', 'Nb', 'Ti', 'V', 'W', 'Pb', 'Sn', 'B', 'Mg', 'Fe'];
export const Q2N = ['Cobre', 'Nióbio', 'Titânio', 'Vanádio', 'Tungst.', 'Chumbo', 'Estanho', 'Boro', 'Magnésio', 'Ferro'];
export const QALL = Q1.concat(Q2);

// contenteditable "plaintext-only" quando o navegador aceita (não deixa colar formatação)
export const CE = (() => { const d = document.createElement('div'); try { d.contentEditable = 'plaintext-only'; } catch (e) { /* */ } return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();

// Campos fixos: um certificado novo herda do mais recente
export const FIXED = ['tipoNorma', 'pagina', 'fabRazao', 'fabEndereco', 'fabContato', 'fabTelefones', 'tituloQuimica', 'metodo', 'tituloOpLiga', 'tituloOpsItens', 'tituloAspectos', 'resultado', 'declaracao', 'aprovadoPor', 'analista', 'assinaturaLabel', 'rodapeMarca', 'rodapeEndereco', 'rodapeTelefones', 'titulo', 'subtitulo'];
export const DEF = {
  aba: '', certNo: '', dataEmissao: '', nfe: '', pagina: '1 de 1', revisao: '1', tipoNorma: '3.1 — ISO 10474',
  fabRazao: 'PROMETALS LTDA.', fabEndereco: 'R. Jaime Rodriguez - Azenha, Nº 1100 - Nova Odessa / SP', fabContato: 'qualidade1@prometals.co', fabTelefones: '19 9.8888-3525  /  19 9.8855-4442',
  cliente: '', pedido: '', referencia: '', produtos: [], material: '', corrida: '',
  tituloQuimica: '1 — ANÁLISE QUÍMICA', metodo: 'Método: Espectrometria de Emissão Óptica (OES).   Unidade: % em massa.', quimica: {},
  tituloOpLiga: '2 — OPs LIGA', tituloOpsItens: '3 - OPs Itens', opLiga: '', opsItens: '',
  tituloAspectos: '4 — ASPECTOS GERAIS E DIMENSIONAL', resultado: 'APROVADO CONFORME ANÁLISE CRÍTICA.',
  declaracao: 'Declaramos que os produtos fornecidos estão em conformidade com os requisitos do pedido. Os resultados referem-se exclusivamente à amostra ensaiada. Este certificado é do tipo 3.1, validado por representante de inspeção autorizado, independente do setor de fabricação. Este documento não deve ser reproduzido, exceto integralmente.',
  aprovadoPor: 'APROVADO POR (representante de inspeção autorizado): Luiz', dataAprovacao: '',
  analista: 'Caio Deodato dos Santos Silva  —  Analista de Qualidade', assinaturaLabel: 'Assinatura:',
  rodapeMarca: '●  PROMETALS.CO', rodapeEndereco: 'R. Jaime Rodriguez - Azenha, 1100 - Nova Odessa / SP', rodapeTelefones: '19 9.8888-3525  /  19 9.8855-4442',
  titulo: 'CERTIFICADO DE QUALIDADE', subtitulo: 'Documento conforme padrões da ISO',
  opsBusca: '', obs: '', ligaRef: '', mostrarAssinatura: true, mostrarQuimica: true, abaAuto: true,
  corridaId: '',
};

export const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = n => String(n).padStart(2, '0');
export const hojeBR = () => { const d = new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
export const dateKey = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + pad(m[2]) + pad(m[1]) : ''; };
export const abaFrom = c => (String(c || '').trim() ? 'CORRIDA ' + String(c).trim().replace(/\s*-\s*/g, '-') : '');
export function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
export function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
export function fmtNum(s) { s = String(s ?? '').trim(); return /^-?\d+\.\d+$/.test(s) ? s.replace('.', ',') : s; }
// "0,45" → 0.45 · vazio/"nd" → null · texto inválido → NaN
export function parseNum(s) {
  s = String(s ?? '').trim();
  if (!s || /^(nd|n\.d\.?|na|n\/a|-|—|–)$/i.test(s)) return null;
  const m = s.match(/^[<>≤≥]?\s*(\d+(?:[.,]\d+)?)$/);
  return m ? parseFloat(m[1].replace(',', '.')) : NaN;
}
export function upgradeCert(c) {
  for (const k in DEF) if (c[k] === undefined) c[k] = clone(DEF[k]);
  if (!Array.isArray(c.produtos)) c.produtos = [];
  if (!c.quimica || typeof c.quimica !== 'object') c.quimica = {};
  return c;
}
// Liga/desliga a análise química; as seções seguintes mudam de número para continuar 1, 2, 3…
export const SEC_AFTER_Q = ['tituloOpLiga', 'tituloOpsItens', 'tituloAspectos'];
export const shiftNum = (t, d) => String(t || '').replace(/^(\s*)(\d+)(?=\s*[—–-])/, (m, sp, n) => sp + Math.max(1, +n + d));
export function setQuimica(r, on) {
  if ((r.mostrarQuimica !== false) === on) return;
  r.mostrarQuimica = on;
  if (/^\s*\d+\s*[—–-]/.test(r.tituloQuimica || '')) SEC_AFTER_Q.forEach(k => { r[k] = shiftNum(r[k], on ? +1 : -1); });
}

export function certHTML(r, ed, { assinatura = '', logo = '' } = {}) {
  const ceA = ed ? ` contenteditable="${CE}" spellcheck="false"` : '';
  const F = (path, ph) => ` data-f="${path}" data-ph="${esc(ph || '')}"${ceA}`;
  const V = path => esc(getPath(r, path) ?? '');
  const cell = (span, cls, path, ph, extra = '') => `<td colspan="${span}" class="${cls}"${F(path, ph)}${extra}>${V(path)}</td>`;
  const lab = (span, t) => `<td colspan="${span}" class="lab">${t}</td>`;
  const sec = (path, ph) => `<tr style="height:18pt">${cell(12, 'sec', path, ph)}</tr>`;
  const secF = t => `<tr style="height:18pt"><td colspan="12" class="sec">${t}</td></tr>`;
  const qBlock = (els, names) => `
    <tr style="height:21.75pt"><td colspan="2" class="q ql c">Elemento</td>${els.map(e => `<td class="q qs">${e}</td>`).join('')}</tr>
    <tr style="height:10.5pt"><td colspan="2" class="q"></td>${names.map(n => `<td class="q qn">${n}</td>`).join('')}</tr>
    <tr style="height:18pt"><td colspan="2" class="q ql">Conc. obtida (%)</td>${els.map(e => `<td class="q qv" data-el="${e}"${F('quimica.' + e, '')}>${V('quimica.' + e)}</td>`).join('')}</tr>`;
  const sig = r.mostrarAssinatura !== false && assinatura ? `<img class="sig" src="${assinatura}" alt="">` : '';
  const quim = r.mostrarQuimica === false
    ? (ed ? `<tr class="qoff"><td colspan="12"><div class="qoffw"><span>Análise química <b>removida</b> deste certificado — não sai na impressão. Os valores continuam guardados.</span><button data-act="qOn" tabindex="-1">Incluir análise química</button></div></td></tr>` : '')
    : `<tr style="height:18pt">${ed ? cell(9, 'sec', 'tituloQuimica') + `<td colspan="3" class="sec qtog"><button data-act="qOff" tabindex="-1" title="Tirar a análise química deste certificado (os valores ficam guardados)">Remover do certificado</button></td>` : cell(12, 'sec', 'tituloQuimica')}</tr>
    <tr style="height:12.75pt">${cell(12, 'met', 'metodo')}</tr>
    ${qBlock(Q1, Q1N)}
    <tr class="sp" style="height:3.75pt"><td colspan="12"></td></tr>
    ${qBlock(Q2, Q2N)}`;
  return `<table class="cert"><colgroup>${'<col>'.repeat(12)}</colgroup>
    <tr style="height:19.5pt"><td colspan="5" rowspan="3" class="logo"><img src="${logo}" alt="Prometals"></td><td colspan="7"></td></tr>
    <tr style="height:19.5pt">${cell(7, 'ttl', 'titulo')}</tr>
    <tr style="height:18pt">${cell(7, 'sub', 'subtitulo')}</tr>
    <tr class="bar" style="height:3.75pt"><td colspan="12"></td></tr>
    ${secF('IDENTIFICAÇÃO DO DOCUMENTO')}
    <tr style="height:17.1pt">${lab(2, 'Certificado Nº')}${cell(4, 'val', 'certNo', 'nº do certificado')}${lab(2, 'Data de emissão')}${cell(4, 'val', 'dataEmissao', 'dd/mm/aaaa')}</tr>
    <tr style="height:17.1pt">${lab(2, 'NF-e')}${cell(4, 'val', 'nfe', '')}${lab(2, 'Página')}${cell(4, 'val', 'pagina')}</tr>
    <tr style="height:17.1pt">${lab(2, 'Revisão')}${cell(4, 'val', 'revisao')}${lab(2, 'Tipo / Norma')}${cell(4, 'val', 'tipoNorma')}</tr>
    ${secF('FABRICANTE (EMISSOR)')}
    <tr style="height:17.1pt">${lab(2, 'Razão social')}${cell(10, 'val', 'fabRazao')}</tr>
    <tr style="height:17.1pt">${lab(2, 'Endereço')}${cell(10, 'val', 'fabEndereco')}</tr>
    <tr style="height:17.1pt">${lab(2, 'Contato')}${cell(4, 'val lnk', 'fabContato')}${lab(2, 'Telefones')}${cell(4, 'val', 'fabTelefones')}</tr>
    ${secF('CLIENTE / COMPRADOR')}
    <tr style="height:17.1pt">${lab(2, 'Razão social')}${cell(10, 'val', 'cliente', 'razão social do cliente')}</tr>
    <tr style="height:17.1pt">${lab(2, 'Pedido nº')}${cell(4, 'val', 'pedido', '')}${lab(2, 'Referência')}${cell(4, 'val', 'referencia', '')}</tr>
    <tr><td colspan="12" class="prtd">${prodsHTML(r, ed, F)}</td></tr>
    ${secF('IDENTIFICAÇÃO E RASTREABILIDADE')}
    <tr style="height:17.1pt">${lab(2, 'Material / Esp.')}${cell(4, 'val c', 'material', 'material')}${lab(2, 'Corrida / Lote')}${cell(4, 'val c', 'corrida', 'corrida')}</tr>
    ${quim}
    <tr style="height:18pt">${cell(2, 'sec c', 'tituloOpLiga')}${cell(10, 'sec c', 'tituloOpsItens')}</tr>
    <tr style="height:17.1pt">${cell(2, 'val c opl', 'opLiga', 'OP liga')}${cell(10, 'val c', 'opsItens', 'OPs dos itens')}</tr>
    ${sec('tituloAspectos')}
    <tr style="height:17.1pt">${lab(2, 'Resultado')}${cell(10, 'val', 'resultado')}</tr>
    ${secF('DECLARAÇÃO DE CONFORMIDADE')}
    <tr style="height:39.75pt">${cell(12, 'decl', 'declaracao')}</tr>
    <tr style="height:15.75pt">${cell(6, 'apr', 'aprovadoPor')}<td colspan="6" class="apr" title="Acompanha a Data de emissão">Data:&nbsp; <span data-mirror="dataEmissao">${esc(r.dataEmissao || r.dataAprovacao || '')}</span></td></tr>
    <tr style="height:25.5pt">${cell(6, 'ana', 'analista')}<td colspan="6" class="asg"><div class="asgw">${esc(r.assinaturaLabel || 'Assinatura:')} ________________________________${sig}</div></td></tr>
    <tr class="sp" style="height:6pt"><td colspan="12"></td></tr>
    <tr style="height:27.75pt">${cell(3, 'ft ftb', 'rodapeMarca')}${cell(6, 'ft fts', 'rodapeEndereco')}${cell(3, 'ft fts', 'rodapeTelefones')}</tr>
  </table>`;
}

function prodsHTML(r, ed, F) {
  const P = r.produtos || [];
  let h = '';
  if (!P.length) h += `<div class="prod"><div class="pt">PRODUTOS RELACIONADOS/QUANTIDADES</div></div>`;
  P.forEach((p, i) => {
    h += `<div class="prod" data-i="${i}">`;
    if (ed) h += `<div class="ptools" contenteditable="false">
        <button data-act="addLine" data-i="${i}" tabindex="-1" title="Adicionar linha (Item / Quantidade)">+ linha</button>
        <button data-act="up" data-i="${i}" tabindex="-1" title="Mover para cima" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button data-act="down" data-i="${i}" tabindex="-1" title="Mover para baixo" ${i === P.length - 1 ? 'disabled' : ''}>↓</button>
        <button data-act="delProd" data-i="${i}" tabindex="-1" class="del" title="Excluir produto">Excluir</button></div>`;
    h += `<div class="pt"${F(`produtos.${i}.titulo`, 'Descrição do produto')}>${esc(p.titulo)}</div>`;
    (p.linhas || []).forEach((l, j) => {
      h += `<div class="plw"><div class="pl"${F(`produtos.${i}.linhas.${j}`, 'Item / Quantidade')}>${esc(l)}</div>${ed ? `<button class="px" data-act="delLine" data-i="${i}" data-j="${j}" tabindex="-1" title="Remover linha">×</button>` : ''}</div>`;
    });
    h += `</div>`;
  });
  if (ed) h += `<button class="padd" data-act="addProd" tabindex="-1">+ Adicionar produto</button>`;
  return `<div class="prods" style="position:relative">${h}</div>`;
}
