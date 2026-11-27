// =====================================================================
//  calculo_liga/base_liga.js — base do módulo Cálculo de Liga
//  Usada por todas as telas do módulo (cada tela é uma página própria):
//  carrega os dados do banco, confere o acesso e guarda os ajudantes comuns.
//  Telas: corridas/, ficha_corrida/, amostras_dia/, retornos/, ligas_normas/,
//  sucatas_ferroligas/ e sistema/configuracoes/.
// =====================================================================
import * as banco from '../comum/banco.js?v=2.0.2';
import { montar, esc, fmt, podeEditar, podeVer, modoLeitura, semAcesso, aviso, endereco } from '../comum/casca.js?v=2.0.2';
import { COL, acharLiga, saldos, normLiga } from './calculo.js?v=2.0.2';
import { LIGAS_INICIAIS, MATERIAIS_INICIAIS, CONFIG_INICIAL } from './dados_iniciais.js?v=2.0.2';
import { corPadrao } from './etiquetas_amostras.js?v=2.0.2';

// ---------------------------------------------------------------------
// Estado (dados que chegam do banco)
// ---------------------------------------------------------------------
export const S = {
  ligas: [], materiais: [], retornos: [], corridas: [], config: null,
  saldos: new Map(), retPorCod: new Map(),
  chegou: {}, servidor: {}, semeado: false,
};
export let C = null;        // #conteudo da página
export let ED = true;       // pode editar a tela aberta? (Usuários e acessos)
export let est = null;      // estado do banco (modo, cfg do Firebase)

export const cfg = () => S.config || CONFIG_INICIAL;
export const ligaDe = nome => acharLiga(S.ligas, nome);
// cor de marcação do retorno: a cadastrada na liga ou, sem ela, a da tabela de cores (etiquetas_amostras.js)
export const corPadraoLiga = l => l ? corPadrao([l.nome, ...(l.apelidos || [])]) : '';
export const corDaLiga = nome => { const l = ligaDe(nome); return (l && l.cor) || corPadraoLiga(l) || corPadrao([nome]); };
export const sucatas = () => S.materiais.filter(m => m.tipo === 'sucata');
export const ferroligas = () => S.materiais.filter(m => m.tipo !== 'sucata');
export function semMeta(o) { const x = { ...o }; delete x.id; delete x._em; delete x._por; return x; }

// Endereço de uma tela do módulo: url('ficha_corrida', { id }) → calculo_liga/ficha_corrida/index.html?id=…
export const url = (tela, params) => endereco(tela === 'configuracoes' ? 'sistema/configuracoes' : 'calculo_liga/' + tela, params);

function recalcular() {
  S.retPorCod = new Map(S.retornos.map(r => [r.codigo, r]));
  S.saldos = saldos(S.retornos, S.corridas);
}

// ---------------------------------------------------------------------
// Início de cada tela
//   tela: id em Usuários e acessos (corridas, retornos…)   menu: item do menu marcado
//   desenhar(): monta a tela quando os dados chegam. Depois, a tela registra em
//   aoMudarDados() o que refazer quando os dados mudam no banco.
// ---------------------------------------------------------------------
let desenhar = null, desenhado = false, atualizarTela = null;
export const aoMudarDados = fn => { atualizarTela = fn; };

export async function iniciarTela({ tela, menu, trilha, desenhar: d }) {
  est = await montar({ ativo: menu || tela, trilha });
  C = document.getElementById('conteudo');
  if (!podeVer(tela)) { semAcesso(C); return false; }   // sem acesso: nem lê os dados
  ED = podeEditar(tela);
  modoLeitura(!ED);
  C.innerHTML = '<div class="vazio">Carregando dados…</div>';
  desenhar = d;
  banco.ouvirColecao(COL.ligas, (l, i) => { S.ligas = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(b.nome)); chegou('ligas', i); }, erroBanco);
  banco.ouvirColecao(COL.materiais, (l, i) => { S.materiais = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)); chegou('materiais', i); }, erroBanco);
  banco.ouvirColecao(COL.retornos, (l, i) => { S.retornos = l; chegou('retornos', i); }, erroBanco);
  banco.ouvirColecao(COL.corridas, (l, i) => { S.corridas = l; chegou('corridas', i); }, erroBanco);
  banco.ouvirDoc(COL.config, 'liga', (d2, i) => { S.config = d2; chegou('config', i); }, erroBanco);
  return true;
}

function chegou(nome, info) {
  S.chegou[nome] = true;
  if (!info || !info.doCache) S.servidor[nome] = true;
  recalcular();
  if (!['ligas', 'materiais', 'retornos', 'corridas', 'config'].every(k => S.chegou[k])) return;
  semearSePreciso();
  if (!desenhado) { desenhado = true; window.scrollTo(0, 0); desenhar(); }
  else if (atualizarTela) atualizarTela();
}

function erroBanco(e) {
  const permissao = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${permissao
    ? 'Seu usuário não tem permissão para ler os dados do Cálculo de Liga. Peça para a Engenharia liberar em Usuários e acessos.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}

// Primeira vez (banco vazio): grava ligas, sucatas/ferroligas e configuração da planilha.
// Só decide depois que o servidor confirmar que está vazio, para nunca sobrescrever dados reais.
async function semearSePreciso() {
  if (S.semeado) return;
  if (!podeEditar('config') && !podeEditar('ligas')) return;
  const confirmado = ['ligas', 'materiais', 'config'].every(k => S.servidor[k]);
  if (!confirmado) return;
  S.semeado = true;
  const ops = [];
  if (!S.ligas.length) LIGAS_INICIAIS.forEach((l, i) => { const { id, ...dados } = l; ops.push({ col: COL.ligas, id: id || normLiga(l.nome), dados: { ...dados, ordem: i } }); });
  // 2026-11: a liga "FB" passou a se chamar "A-532 (FB)" (o retorno continua 34-227-FB; o FB vira apelido)
  const fb = S.ligas.find(l => l.nome === 'FB');
  if (fb && podeEditar('ligas')) ops.push({ col: COL.ligas, id: fb.id, dados: { ...semMeta(fb), nome: 'A-532 (FB)', apelidos: [...new Set(['FB', ...(fb.apelidos || [])])] } });
  if (!S.materiais.length) MATERIAIS_INICIAIS.forEach(m => ops.push({ col: COL.materiais, id: m.id, dados: m }));
  if (!S.config) ops.push({ col: COL.config, id: 'liga', dados: CONFIG_INICIAL });
  if (ops.length) {
    try { await banco.emLote(ops); } catch (e) { console.warn('semear', e); return; }
    if (ops.length > 1 || !fb) aviso('Primeiro acesso: ligas, sucatas e ferroligas carregadas da planilha.');
  }
}

// ---------------------------------------------------------------------
// Pequenos ajudantes de HTML
// ---------------------------------------------------------------------
export const ent = (attrs, valor = '') => `<input class="ent" ${attrs} value="${esc(valor == null ? '' : valor)}">`;
export const entNum = (attrs, valor) => `<input class="ent num" inputmode="decimal" autocomplete="off" ${attrs} value="${esc(valor == null || valor === '' ? '' : String(valor).replace('.', ','))}">`;
export const optLigas = (sel, vazio = 'Escolha a liga…') => `<option value="">${vazio}</option>` +
  S.ligas.map(l => `<option value="${esc(l.nome)}" ${ligaDe(sel) && ligaDe(sel).id === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('');
export const fmtComp = v => (v == null || v === '' ? '' : fmt(v, 2));
export const fmtFaixa = f => !f ? '' : `${fmtComp(f[0])} – ${f[1] == null || f[1] === '' ? '…' : fmtComp(f[1])}`;
