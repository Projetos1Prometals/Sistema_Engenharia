// =====================================================================
//  certificados/auto.js — vínculo certificado ↔ retorno e certificado
//  automático (sem tela). Usado pelos Certificados e pelo Cálculo de Liga.
//  - O certificado segue a análise do retorno (só nesse sentido).
//  - Todo retorno com análise (menos os importados da planilha) ganha um
//    certificado: corrida, material e análise; cliente e produtos em branco.
//    O retorno guarda "certificadoAuto" para não criar de novo (nem se o
//    certificado for excluído).
// =====================================================================
import { COL, acharLiga, temAnalise } from '../calculo_liga/calculo.js?v=2.0.1';
import { DEF, FIXED, QALL, SEC_AFTER_Q, clone, hojeBR, abaFrom, shiftNum } from './folha_certificado.js?v=2.0.1';

export const COL_CERTS = 'eng_certificados';
const fmtQ = v => (v == null || v === '' ? '' : String(v).replace('.', ','));
export function quimicaDe(valores) {
  const q = {};
  for (const e of QALL) if (valores && valores[e] != null && valores[e] !== '') q[e] = fmtQ(valores[e]);
  return q;
}

// "48-242", "CORRIDA 48 - 242", "48/242" → "48-242" ("" se não achar)
export function parCorrida(texto) {
  const m = /(\d+)\s*[-/]\s*(\d+)/.exec(String(texto || ''));
  return m ? `${+m[1]}-${+m[2]}` : '';
}

// Retorno que o certificado segue: o escolhido (cert.retorno); senão o gerado pela corrida ligada;
// senão o retorno com o mesmo nº de corrida ("48-242" → retorno "48-242" ou "48-242-CF8"). '-' = sem vínculo.
export function codigoRetornoDoCert(c, { corridas = [], retornos = [] }) {
  if (c.retorno === '-') return '';
  if (c.retorno) return c.retorno;
  const cor = c.corridaId && corridas.find(x => x.id === c.corridaId);
  if (cor && cor.retornoGerado) return cor.retornoGerado;
  const par = parCorrida(c.corrida);
  if (!par) return '';
  const r = retornos.find(x => parCorrida(x.codigo) === par && /^\s*\d+\s*-\s*\d+(\s*-|\s*$)/.test(x.codigo));
  return r ? r.codigo : '';
}

// Certificado novo a partir do retorno (textos fixos do certificado mais recente, como no "Novo certificado")
function certificadoDoRetorno(r, { certs, ligas, corridas }) {
  const c = clone(DEF);
  const L = certs.slice().sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0];
  if (L) {
    FIXED.forEach(k => { if (L[k] !== undefined) c[k] = clone(L[k]); });
    if (L.mostrarQuimica === false && /^\s*\d+\s*[—–-]/.test(c.tituloQuimica || '')) SEC_AFTER_Q.forEach(k => { c[k] = shiftNum(c[k], +1); });
  }
  const corrida = parCorrida(r.codigo) || r.codigo;
  const liga = acharLiga(ligas, r.liga);
  const cor = r.corridaId && corridas.find(x => x.id === r.corridaId);
  const ordem = Math.max(Date.now(), certs.reduce((m, x) => Math.max(m, +x.ordem || 0), 0) + 1);
  return Object.assign(c, {
    id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ordem,
    corrida, aba: abaFrom(corrida), abaAuto: true, material: liga ? liga.nome : (r.liga || ''),
    opLiga: cor && (cor.ops || []).length ? cor.ops.join(' - ') : '',
    produtos: [{ titulo: '', linhas: ['Item: ', 'Quantidade(s): '] }],
    dataEmissao: hojeBR(), dataAprovacao: hojeBR(),
    quimica: quimicaDe(r.analise), quimicaManual: {}, retorno: r.codigo, corridaId: cor ? cor.id : '',
    criadoDoRetorno: r.codigo,
  });
}

const criadosNestaSessao = new Set();
// Retornos com análise que nenhum certificado segue (para o botão "Retornos sem certificado": todos, até os da planilha)
export function retornosSemCertificado(dados) {
  const { retornos = [], certs = [] } = dados;
  const seguidos = new Set(certs.map(c => codigoRetornoDoCert(c, dados)).filter(Boolean));
  return retornos.filter(r => r.codigo && temAnalise(r.analise) && !seguidos.has(r.codigo) && !criadosNestaSessao.has(r.codigo));
}
// Cria sozinho os que faltam: menos os da planilha e os que já tiveram certificado (excluído depois).
// dados = { retornos, certs, corridas, ligas }; banco = módulo comum/banco.js. Devolve os certificados criados.
export function criarCertificadosAuto(dados, banco) {
  return criarCertificadosDe(retornosSemCertificado(dados).filter(r => r.origem !== 'planilha' && !r.certificadoAuto), dados, banco);
}
// Cria um certificado para cada retorno da lista
export async function criarCertificadosDe(faltam, dados, banco) {
  const criados = [];
  const todos = (dados.certs || []).slice();
  for (const r of faltam) {
    if (criadosNestaSessao.has(r.codigo)) continue;
    criadosNestaSessao.add(r.codigo);
    const c = certificadoDoRetorno(r, { ...dados, certs: todos });
    const u = banco.usuario();
    c.alteradoEm = Date.now(); c.alteradoPor = u && banco.modo() === 'firebase' ? u.email : '';
    const { id, ...semId } = c;
    const ret = { ...r }; delete ret.id; delete ret._em; delete ret._por;
    try {
      await banco.emLote([
        { col: COL_CERTS, id, dados: semId },
        { col: COL.retornos, id: r.id || banco.idSeguro(r.codigo), dados: { ...ret, certificadoAuto: id } },
      ]);
    } catch (e) {
      criadosNestaSessao.delete(r.codigo);   // deixa tentar de novo
      e.message = `retorno ${r.codigo}: ${e.message}`;
      throw e;
    }
    todos.push(c); criados.push(c);
  }
  return criados;
}
