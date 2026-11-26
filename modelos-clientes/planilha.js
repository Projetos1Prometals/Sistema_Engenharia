// =====================================================================
//  modelos-clientes/planilha.js — leitura de planilha (Excel/CSV/colado)
//  e montagem das planilhas de exportação. Sem tela.
// =====================================================================
const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let carregando = null;
export function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!carregando) carregando = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => res(window.XLSX);
    s.onerror = () => { carregando = null; rej(new Error('Não foi possível carregar a biblioteca do Excel. Verifique a internet.')); };
    document.head.appendChild(s);
  });
  return carregando;
}

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const digitos = s => String(s ?? '').replace(/\D+/g, '');
const p2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

// Colunas que dá para importar, com os títulos que a planilha costuma ter (sem acento, minúsculas)
export const CAMPOS_IMPORTACAO = {
  clientes: [
    { k: 'codigo', label: 'Código do cliente', syn: ['codigo', 'cod', 'codigo cliente', 'cod cliente', 'codigo do cliente', 'id', 'id cliente'] },
    { k: 'nome', label: 'Nome / razão social', req: true, syn: ['nome', 'razao social', 'cliente', 'nome cliente', 'nome do cliente', 'fantasia', 'nome fantasia', 'empresa'] },
    { k: 'cnpj', label: 'CNPJ', syn: ['cnpj', 'cpf cnpj', 'cnpj cpf', 'documento'] },
    { k: 'ie', label: 'Inscrição estadual', syn: ['ie', 'inscricao estadual', 'ins est', 'insc estadual', 'i e'] },
    { k: 'endereco', label: 'Endereço', syn: ['endereco', 'logradouro', 'rua', 'end'] },
    { k: 'bairro', label: 'Bairro', syn: ['bairro'] },
    { k: 'cidade', label: 'Cidade', syn: ['cidade', 'municipio'] },
    { k: 'uf', label: 'UF', syn: ['uf', 'estado'] },
    { k: 'cep', label: 'CEP', syn: ['cep'] },
    { k: 'telefone', label: 'Telefone', syn: ['telefone', 'fone', 'tel', 'telefone 1'] },
    { k: 'fax', label: 'Fax/800 ou celular', syn: ['fax', 'fax 800', 'celular', 'whatsapp', 'telefone 2'] },
    { k: 'email', label: 'E-mail', syn: ['email', 'e mail'] },
  ],
  modelos: [
    { k: 'clienteCodigo', label: 'Código do cliente', syn: ['codigo cliente', 'cod cliente', 'cliente codigo', 'codigo do cliente', 'id cliente'] },
    { k: 'clienteNome', label: 'Nome do cliente', syn: ['cliente', 'nome cliente', 'nome do cliente', 'razao social'] },
    { k: 'codigo', label: 'Código do modelo', syn: ['codigo modelo', 'cod modelo', 'codigo do modelo', 'codigo', 'cod'] },
    { k: 'codProduto', label: 'Código do produto', syn: ['codigo do produto', 'codigo produto', 'cod produto', 'cod do produto', 'produto codigo', 'codigo nw', 'cod nw'] },
    { k: 'descricao', label: 'Descrição', req: true, syn: ['descricao', 'descricao modelo', 'descricao do modelo', 'produto', 'peca', 'descricao do produto', 'descricao da peca'] },
    { k: 'referencia', label: 'Modelo / referência', syn: ['modelo', 'referencia', 'modelo referencia', 'ref', 'desenho', 'codigo peca', 'codigo da peca'] },
    { k: 'partes', label: 'Total de partes', syn: ['partes', 'total de partes', 'qtd partes', 'quantidade de partes', 'qtd', 'quantidade'] },
    { k: 'nfEntrada', label: 'NF de entrada', syn: ['nf', 'nf entrada', 'nf de entrada', 'nota', 'nota fiscal', 'nfe', 'n nf', 'numero nf'] },
    { k: 'dataEntrada', label: 'Data de entrada', syn: ['data', 'data entrada', 'data de entrada', 'emissao', 'data nf', 'data emissao', 'entrada'] },
    { k: 'localizacao', label: 'Localização', syn: ['local', 'localizacao', 'prateleira', 'posicao'] },
    { k: 'material', label: 'Material do modelo', syn: ['material', 'material modelo', 'material do modelo'] },
    { k: 'liga', label: 'Liga', syn: ['liga', 'liga da peca'] },
    { k: 'obs', label: 'Observações', syn: ['obs', 'observacao', 'observacoes'] },
  ],
};

export function autoMapear(tipo, titulos) {
  const mapa = {}, usados = new Set(), nt = titulos.map(norm);
  for (const f of CAMPOS_IMPORTACAO[tipo]) {
    const i = nt.findIndex((h, idx) => !usados.has(idx) && f.syn.includes(h));
    if (i >= 0) { mapa[f.k] = i; usados.add(i); }
  }
  return mapa;
}

export function paraData(v) {
  if (v instanceof Date && !isNaN(v)) return ymd(new Date(v.getTime() + 12 * 3600000));
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m;
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s))) { let a = m[3]; if (a.length === 2) a = '20' + a; return `${a}-${p2(m[2])}-${p2(m[1])}`; }
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}
export function textoCelula(v) {
  if (v instanceof Date) { const d = paraData(v); return d ? d.split('-').reverse().join('/') : ''; }
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
  return String(v ?? '').trim();
}
// CEP e CNPJ que o Excel transformou em número perdem os zeros da esquerda
export const arrumarCep = s => { const d = digitos(s); return d && d.length < 8 && /^\d+$/.test(String(s).trim()) ? d.padStart(8, '0') : String(s || '').trim(); };
export const arrumarCnpj = s => { const d = digitos(s); return /^\d+$/.test(String(s).trim()) && d.length > 11 && d.length < 14 ? d.padStart(14, '0') : String(s || '').trim(); };

function dividirLinha(linha, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (q) { if (ch === '"') { if (linha[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"' && cur.trim() === '') { q = true; cur = ''; }
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Acha a linha de títulos (a 1ª com pelo menos 2 colunas preenchidas). Devolve {titulos, linhas} ou null.
export function separarTitulos(aoa) {
  const hi = aoa.findIndex(r => r.filter(c => String(c ?? '').trim() !== '').length >= 2);
  if (hi < 0) return null;
  return {
    titulos: aoa[hi].map((h, i) => String(h ?? '').trim() || 'Coluna ' + (i + 1)),
    linhas: aoa.slice(hi + 1).filter(r => r.some(c => String(c ?? '').trim() !== '')),
  };
}
export async function lerArquivoPlanilha(arquivo) {
  const XLSX = await carregarSheetJS();
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}
export function lerTextoColado(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!linhas.length) return [];
  const l0 = linhas[0];
  const sep = l0.includes('\t') ? '\t' : (l0.split(';').length > l0.split(',').length ? ';' : ',');
  return linhas.map(l => dividirLinha(l, sep));
}

// Planilha .xlsx a partir de abas {nome: [objetos]} → Blob
export async function montarXlsx(abas) {
  const XLSX = await carregarSheetJS();
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) {
    const ws = Array.isArray(linhas[0]) ? XLSX.utils.aoa_to_sheet(linhas) : XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ '': '' }]);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
