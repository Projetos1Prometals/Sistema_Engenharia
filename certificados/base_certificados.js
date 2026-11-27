// =====================================================================
//  certificados/base_certificados.js — base do módulo Certificados de Qualidade
//  Usada pelas telas (cada tela é uma página própria): lista/ (busca por OP,
//  corrida, cliente…), certificado/ (editado direto na folha, salva sozinho)
//  e assinatura_backup/. Carrega os dados, confere o acesso e guarda os
//  ajudantes comuns: vínculo com o retorno, gravação automática e impressão.
//  Ligação com o Cálculo de Liga: o certificado pode nascer de uma corrida
//  (corrida, material, OP da liga e análise do laboratório já preenchidos)
//  e a conferência usa as normas de "Ligas e normas".
// =====================================================================
import * as banco from '../comum/banco.js?v=2.0.0';
import { montar, aviso, esc, fmtData, podeEditar, podeVer, semAcesso, endereco, ir } from '../comum/casca.js?v=2.0.0';
import { COL as COL_LIGA, acharLiga, numeroCorrida, temAnalise, ELEMENTOS, ELEMENTOS_LAB_EXTRA } from '../calculo_liga/calculo.js?v=2.0.0';
import { criarCertificadosAuto, codigoRetornoDoCert as codigoRetornoDoCertAuto } from './auto.js?v=2.0.0';
import {
  QALL, clone, parseNum, upgradeCert, certHTML, unidadesProdutos, produtosParte, rotuloPagina, certContinuacao,
} from './folha_certificado.js?v=2.0.0';

export const COL = { certs: 'eng_certificados' };
export const CFG_ID = 'certificado';                       // eng_config/certificado → { assinatura }
export const LOGO = banco.raiz('comum/logo.png');

export const S = { certs: [], corridas: [], ligas: [], retornos: [], cfg: null, chegou: {} };
export let C = null;
export let ED = true;
export const assinatura = () => (S.cfg && S.cfg.assinatura) || '';

// Endereço de uma tela do módulo: url('certificado', { id }) → certificados/certificado/index.html?id=…
export const url = (tela, params) => endereco('certificados/' + tela, params);

// ---------------------------------------------------------------------
// Início de cada tela: desenhar() monta a tela quando os dados chegam;
// depois aoMudarDados(fn) diz o que refazer quando os dados mudam no banco.
// ---------------------------------------------------------------------
let desenhar = null, desenhado = false, atualizarTela = null;
export const aoMudarDados = fn => { atualizarTela = fn; };

export async function iniciarTela({ trilha, desenhar: d }) {
  await montar({ ativo: 'certificados', trilha });
  C = document.getElementById('conteudo');
  ED = podeEditar('certificados');
  if (!podeVer('certificados')) { semAcesso(C); return false; }   // sem acesso aos Certificados: nem lê os dados
  C.innerHTML = '<div class="vazio">Carregando dados…</div>';
  desenhar = d;
  const erro = e => { C.innerHTML = `<div class="faixa verm">${e && /permission/i.test(e.code || e.message || '') ? 'Seu usuário não tem permissão para ver os certificados. Peça para a Engenharia liberar em Usuários e acessos.' : 'Erro ao ler o banco: ' + esc(e && (e.message || e.code))}</div>`; };
  banco.ouvirColecao(COL.certs, l => { S.certs = l.map(upgradeCert); chegou('certs'); }, erro);
  banco.ouvirColecao(COL_LIGA.corridas, l => { S.corridas = l; chegou('corridas'); }, erro);
  banco.ouvirColecao(COL_LIGA.ligas, l => { S.ligas = l; chegou('ligas'); }, erro);
  banco.ouvirColecao(COL_LIGA.retornos, l => { S.retornos = l; chegou('retornos'); }, erro);
  banco.ouvirDoc(COL_LIGA.config, CFG_ID, d2 => { S.cfg = d2 || {}; chegou('cfg'); }, erro);
  return true;
}

function chegou(nome) {
  S.chegou[nome] = true;
  if (!['certs', 'corridas', 'ligas', 'retornos', 'cfg'].every(k => S.chegou[k])) return;
  if (!desenhado) { desenhado = true; window.scrollTo(0, 0); desenhar(); }
  else if (atualizarTela) atualizarTela();
  verCertificadosAuto();
}
// Retornos com análise que ainda não têm certificado ganham um (só quem edita; uma rodada por vez)
let criandoAuto = false;
async function verCertificadosAuto() {
  if (!ED || criandoAuto) return;
  criandoAuto = true;
  try {
    const novos = await criarCertificadosAuto(S, banco);
    if (novos.length) aviso(novos.length === 1 ? `Certificado criado para o retorno ${novos[0].criadoDoRetorno}.` : `${novos.length} certificados criados para os retornos com análise.`);
  } catch (e) { console.error('certificados automáticos', e); aviso('Não consegui criar o certificado automático (' + e.message + ').', 'erro'); }
  finally { criandoAuto = false; }
}

// Sair da página (link, fechar a aba) grava o que ainda estava esperando os 0,7 s
window.addEventListener('beforeunload', () => salvarPendente());
window.addEventListener('click', e => { if (pendentes.size && e.target.closest && e.target.closest('a[href]')) salvarPendente(); }, true);
// Ctrl+S: grava na hora
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarPendente(); aviso('Salvo.'); }
});

// ---------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const opTokens = s => String(s || '').split(/[^0-9A-Za-z]+/).filter(Boolean);
export const primeiraLinha = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
export const fmtQ = v => (v == null || v === '' ? '' : String(v).replace('.', ','));
export const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const nextOrdem = () => Math.max(Date.now(), S.certs.reduce((m, c) => Math.max(m, +c.ordem || 0), 0) + 1);
export const maisRecente = () => S.certs.slice().sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0];
export const corridaDe = id => S.corridas.find(c => c.id === id);
export const nomeCorrida = c => `${c.refratario ?? '?'}-${c.anual ?? '?'}`;     // formato do certificado: "33-229"
export const descCorrida = c => `${numeroCorrida(c)} · ${c.liga || '?'} · ${fmtData(c.data)}${(c.ops || []).length ? ' · OP ' + c.ops.join(', ') : ''}${c.fs ? ' · ' + c.fs : ''}`;

// ---- Vínculo certificado → retorno (só nesse sentido) ----
// Retorno vinculado: o escolhido; senão o da corrida ligada; senão o de mesmo nº de corrida (auto.js). '-' = sem vínculo.
export const codigoRetornoDoCert = c => codigoRetornoDoCertAuto(c, S);
export function retornoDoCert(c) { const cod = codigoRetornoDoCert(c); return cod ? S.retornos.find(r => r.codigo === cod) || null : null; }
// Leva a análise do retorno para a folha, menos os elementos mudados à mão no certificado (cert.quimicaManual).
// O que muda no certificado nunca volta para o retorno. Devolve true se a folha mudou.
export function sincronizarQuimica(c) {
  const r = retornoDoCert(c);
  if (!r || !temAnalise(r.analise)) return false;
  const alvo = quimicaDe(r.analise), man = c.quimicaManual || {};
  c.quimica = c.quimica || {};
  let mudou = false;
  for (const e of QALL) {
    if (man[e]) continue;
    const v = alvo[e] ?? '';
    if ((c.quimica[e] ?? '') !== v) { if (v) c.quimica[e] = v; else delete c.quimica[e]; mudou = true; }
  }
  return mudou;
}
export const marcarManual = (c, els) => { c.quimicaManual = c.quimicaManual || {}; els.forEach(e => { c.quimicaManual[e] = true; }); };

// Análise da corrida para o certificado: a do retorno que ela gerou (PDF do laboratório); se não houver, a antiga da corrida
export function analiseDaCorrida(c) {
  if (!c) return null;
  const r = c.retornoGerado && S.retornos.find(x => x.codigo === c.retornoGerado);
  if (r && temAnalise(r.analise)) return { valores: r.analise, fonte: 'análise do retorno ' + r.codigo };
  if (temAnalise(c.real)) return { valores: c.real, fonte: 'resultado do laboratório da corrida' };
  return null;
}
export function quimicaDe(valores) {
  const q = {};
  for (const e of [...ELEMENTOS, ...ELEMENTOS_LAB_EXTRA]) if (valores[e] != null && valores[e] !== '') q[e] = fmtQ(valores[e]);
  return q;
}

// Norma usada na conferência: a escolhida, ou a da liga da corrida, ou a do material
export function ligaRef(r) {
  if (r.ligaRef === '-') return null;
  if (r.ligaRef) return S.ligas.find(l => l.nome === r.ligaRef) || null;
  const c = corridaDe(r.corridaId);
  return (c && acharLiga(S.ligas, c.liga)) || acharLiga(S.ligas, r.material) || null;
}
export function conferir(r) {
  const liga = ligaRef(r), fora = [], invalidos = [], ok = [];
  for (const e of QALL) {
    const raw = (r.quimica || {})[e], v = parseNum(raw);
    if (Number.isNaN(v)) { invalidos.push({ e, raw }); continue; }
    if (!liga || v === null) continue;
    const f = (liga.faixas || {})[e]; if (!f) continue;
    const mn = f[0] == null || f[0] === '' ? 0 : +f[0], mx = f[1] == null || f[1] === '' ? null : +f[1];
    if (!mn && !mx) continue;
    (v < mn - 1e-9 || (mx != null && v > mx + 1e-9) ? fora : ok).push({ e, raw, mn, mx });
  }
  return { liga, fora, invalidos, ok };
}

// ---------------------------------------------------------------------
// Gravação (salva sozinho, ~0,7 s depois de parar de digitar)
// ---------------------------------------------------------------------
export const pendentes = new Map();   // id → { cert, timer }
export function agendarSalvar(c) {
  const p = pendentes.get(c.id);
  if (p) clearTimeout(p.timer);
  pendentes.set(c.id, { cert: c, timer: setTimeout(() => salvarAgora(c.id), 700) });
  estadoSalvo('Salvando…');
}
export function salvarAgora(id) {
  const p = pendentes.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pendentes.delete(id);
  gravar(p.cert);
}
export function salvarPendente() { [...pendentes.keys()].forEach(salvarAgora); }
export function gravar(c) {
  const u = banco.usuario();
  c.alteradoEm = Date.now();
  c.alteradoPor = u && banco.modo() === 'firebase' ? u.email : '';
  const d = clone(c); delete d.id; delete d._em; delete d._por;
  return banco.salvar(COL.certs, c.id, d).then(() => estadoSalvo('Salvo')).catch(e => { estadoSalvo('Erro ao salvar', true); aviso('Erro ao salvar: ' + e.message, 'erro'); });
}
export function estadoSalvo(t, erro) { const el = document.getElementById('estadoSalvo'); if (el) { el.textContent = t; el.classList.toggle('txt-verm', !!erro); } }

export const abrir = id => ir(url('certificado', { id }));

// =====================================================================
//  IMPRESSÃO (A4, mesmo formato da planilha)
// =====================================================================
export const ALTURA_UTIL_MM = 296 - 2 * 19.05, PX_MM = 96 / 25.4;
export const ESCALA_MAX = 0.94, ESCALA_MIN = 0.9;            // abaixo disso, em vez de diminuir a letra, passa para outra folha
export const ALTURA_UTIL_PX = ALTURA_UTIL_MM * PX_MM - 4;
// Divide o certificado em folhas: a 1ª é a folha completa; os itens que não cabem vão para as seguintes.
export function folhasDoCert(r, medir) {
  const op = { assinatura: assinatura(), logo: LOGO };
  const cabe = html => medir(html) * ESCALA_MIN <= ALTURA_UTIL_PX;
  const inteiro = certHTML({ ...r, pagina: rotuloPagina(r, 1, 1) }, false, op);
  const u = unidadesProdutos(r.produtos);
  if (u.length <= 1 || cabe(inteiro)) return [inteiro];
  const P = r.produtos;
  // folha 1: o máximo de itens que cabe
  let k = u.length - 1;
  while (k > 0 && !cabe(certHTML({ ...r, produtos: produtosParte(P, u, 0, k, true) }, false, op))) k--;
  if (k > 0 && u[k - 1].j === -1) k--;                // não deixar título de produto sozinho no pé da folha
  const cortes = [[0, k]];
  // folhas seguintes
  for (let a = k; a < u.length;) {
    let b = u.length;
    while (b > a + 1 && !cabe(certContinuacao({ ...r, produtos: produtosParte(P, u, a, b, b < u.length) }, op))) b--;
    if (b < u.length && b > a + 1 && u[b - 1].j === -1) b--;
    cortes.push([a, b]); a = b;
  }
  const n = cortes.length;
  return cortes.map(([a, b], i) => {
    const prods = produtosParte(P, u, a, b, i < n - 1);
    return i === 0 ? certHTML({ ...r, produtos: prods, pagina: rotuloPagina(r, 1, n) }, false, op)
      : certContinuacao({ ...r, produtos: prods }, { ...op, pagina: rotuloPagina(r, i + 1, n) });
  });
}
export function medidor(area) {
  const tmp = document.createElement('div'); tmp.className = 'pagina-cert'; area.appendChild(tmp);
  return { medir: html => { tmp.innerHTML = html; return tmp.firstElementChild.getBoundingClientRect().height; }, fim: () => tmp.remove() };
}
let tituloAntes = null;
export function prepararImpressao(lista) {
  let area = document.getElementById('areaImpressao');
  if (!area) { area = document.createElement('div'); area.id = 'areaImpressao'; document.body.appendChild(area); }
  area.innerHTML = '';
  const m = medidor(area);
  const folhas = lista.flatMap(r => folhasDoCert(r, m.medir));
  m.fim();
  area.innerHTML = folhas.map(h => `<div class="pagina-cert">${h}</div>`).join('');
  area.querySelectorAll('.cert').forEach(t => { const h = t.getBoundingClientRect().height; t.style.zoom = Math.min(ESCALA_MAX, ALTURA_UTIL_PX / h).toFixed(4); });
  document.body.classList.add('imprimindo-cert');
  tituloAntes = document.title;
  document.title = lista.length === 1 ? `Certificado ${lista[0].aba || ''}`.trim() : `Certificados (${lista.length})`;
  return area;
}
export async function imprimir(lista) {
  lista = lista.filter(Boolean); if (!lista.length) return;
  salvarPendente();
  const area = prepararImpressao(lista);
  await Promise.all([...area.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : null)));
  window.print();
}
window.addEventListener('afterprint', () => {
  document.body.classList.remove('imprimindo-cert');
  const area = document.getElementById('areaImpressao'); if (area) area.innerHTML = '';
  if (tituloAntes !== null) { document.title = tituloAntes; tituloAntes = null; }
});
