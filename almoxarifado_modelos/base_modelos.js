// =====================================================================
//  almoxarifado_modelos/base_modelos.js — base dos Modelos da Prometals
//  Usada por todas as telas (cada tela é uma página própria): carrega os
//  modelos e as ruas, confere o acesso e guarda os ajudantes comuns.
//  Telas: prateleiras/, modelos/, ficha_modelo/, ruas_importacao/ e
//  modelos_prometals/lista_comercial/. Só a Engenharia edita; os outros consultam.
// =====================================================================
import * as banco from '../comum/banco.js?v=2.0.2';
import { montar, aviso, esc, icone, hoje, podeEditar, podeVer, semAcesso, endereco } from '../comum/casca.js?v=2.0.2';
import { COL, SITUACOES, situacao, ocupacao, chaveDesenho } from './regras.js?v=2.0.2';

export const S = { modelos: [], ruas: [], porId: new Map(), ocup: new Map(), chegou: {} };
export let C = null;
export let ED = true;   // pode editar os dados dos modelos (ou as ruas, na tela de ruas)?
export let MAN = true;  // pode registrar manutenção (ida e volta)?

// Endereço de uma tela: url('ficha_modelo', { id }) → almoxarifado_modelos/ficha_modelo/index.html?id=…
export const url = (tela, params) => endereco(tela === 'lista_comercial' ? 'modelos_prometals/lista_comercial' : 'almoxarifado_modelos/' + tela, params);

function recalcular() {
  S.porId = new Map(S.modelos.map(m => [m.id, m]));
  S.ocup = ocupacao(S.modelos);
}

// ---------------------------------------------------------------------
// Início de cada tela
//   ver: telas (Usuários e acessos) que dão acesso a esta página (basta uma)
//   edita: tela cujo "Editar" libera a edição aqui (nenhuma = só consulta)
//   desenhar(): monta a tela quando os dados chegam; depois aoMudarDados(fn) diz o que refazer.
// ---------------------------------------------------------------------
let desenhar = null, desenhado = false, atualizarTela = null;
export const aoMudarDados = fn => { atualizarTela = fn; };

export async function iniciarTela({ ver, edita, menu, trilha, desenhar: d }) {
  await montar({ ativo: menu, trilha });
  C = document.getElementById('conteudo');
  MAN = podeEditar('manutencao');
  ED = !!edita && podeEditar(edita);
  if (!ver.some(podeVer)) { semAcesso(C); return false; }   // sem acesso: nem lê os dados
  C.innerHTML = '<div class="vazio">Carregando dados…</div>';
  desenhar = d;
  banco.ouvirColecao(COL.modelos, l => { S.modelos = l; chegou('modelos'); }, erroBanco);
  banco.ouvirColecao(COL.ruas, l => { S.ruas = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.letra).localeCompare(b.letra)); chegou('ruas'); }, erroBanco);
  return true;
}

function chegou(nome) {
  S.chegou[nome] = true;
  recalcular();
  if (!(S.chegou.modelos && S.chegou.ruas)) return;
  if (!desenhado) { desenhado = true; window.scrollTo(0, 0); desenhar(); }
  else if (atualizarTela) atualizarTela();
}

function erroBanco(e) {
  const permissao = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${permissao
    ? 'Seu usuário não tem permissão para ver os modelos. Peça para a Engenharia liberar em Usuários e acessos.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}

// ---------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------
export const ent = (attrs, valor = '') => `<input class="ent" ${attrs} ${ED ? '' : 'disabled'} value="${esc(valor == null ? '' : valor)}">`;
export const tagSit = m => { const s = SITUACOES[situacao(m)]; return `<span class="tag ${s.cls}">${s.texto}</span>`; };
export const fmtValor = v => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : esc(v == null ? '' : v));
export const fmtTamanho = b => (b > 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const kpi = (n, rot, cls, chip) => chip
  ? `<button class="kpi ${cls}" data-chip="${chip}"><b>${n}</b><span>${rot}</span></button>`
  : `<div class="kpi ${cls}"><b>${n}</b><span>${rot}</span></div>`;
export const somenteLeitura = () => ED ? '' : `<div class="faixa">${icone('olho')} ${MAN
  ? 'Você pode registrar a ida e a volta da manutenção (na ficha do modelo). Os demais dados são alterados pela Engenharia.'
  : 'Você está só consultando. Alterações são feitas pela Engenharia.'}</div>`;

export function evento(tipo, extra = {}) {
  const u = banco.usuario();
  return { data: hoje(), tipo, por: u && banco.modo() === 'firebase' ? u.email : '', ...extra };
}
export function semMeta(o) { const x = { ...o }; delete x.id; delete x._em; delete x._por; return x; }
export function gravarModelo(m) {
  return banco.salvar(COL.modelos, m.id, semMeta(m)).catch(e => aviso('Erro ao salvar: ' + e.message, 'erro'));
}

export async function abrirDesenho(m, baixar) {
  // a janela abre já no clique, senão o navegador bloqueia como "pop-up"
  const w = baixar ? null : window.open('', '_blank');
  if (w) w.document.write('<p style="font:14px Arial;padding:20px">Abrindo o desenho…</p>');
  try {
    const blob = await banco.lerArquivo(chaveDesenho(m.id));
    if (!blob) throw new Error('arquivo não encontrado');
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    if (baixar || !w) {
      const a = document.createElement('a'); a.href = url; a.download = (m.desenho && m.desenho.nome) || (m.codigo + '.pdf');
      document.body.appendChild(a); a.click(); a.remove();
    } else w.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (w) w.close();
    aviso('Não consegui abrir o desenho: ' + e.message, 'erro');
  }
}
