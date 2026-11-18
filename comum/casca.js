// =====================================================================
//  comum/casca.js — barra lateral, topo, login obrigatório e ajudantes
//  de tela (avisos, janelas, ícones, formatação) usados por todos os módulos.
// =====================================================================
import * as banco from './banco.js';

export const VERSAO = '1.1.1';

// ---------- ícones (traço simples, estilo do PCP) ----------
const P = {
  casa: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  chama: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 4 0-3 0-5 0-7z"/>',
  lista: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  reciclar: '<path d="M7 19H4l3-5"/><path d="M17 19h3l-3-5"/><path d="M9 5l3-2 3 2"/><path d="M12 3v7"/><path d="M4 19l8-14 8 14"/>',
  frasco: '<path d="M9 3h6"/><path d="M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3"/><path d="M7 14h10"/>',
  caixas: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  cubo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  certificado: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 14l2 2 4-4"/>',
  prancheta: '<path d="M9 4h6v3H9z"/><path d="M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3"/><path d="M9 12h6M9 16h4"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  impressora: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  lixo: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  salvar: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  voltar: '<path d="M15 18l-6-6 6-6"/>',
  fechar: '<path d="M18 6L6 18M6 6l12 12"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  tubo: '<path d="M8 3h8"/><path d="M9 3v14a3 3 0 0 0 6 0V3"/><path d="M9 11h6"/>',
};
export function icone(nome, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;
}

// ---------- menu lateral ----------
// pronto:false = módulo ainda não migrado (aparece com cadeado, como no PCP)
const MENU = [
  { itens: [{ id: 'inicio', nome: 'Visão geral', ic: 'casa', href: 'index.html' }] },
  { sec: 'Cálculo de Liga', itens: [
    { id: 'corridas', nome: 'Corridas', ic: 'chama', href: 'liga/index.html#/corridas' },
    { id: 'retornos', nome: 'Retornos', ic: 'reciclar', href: 'liga/index.html#/retornos' },
    { id: 'ligas', nome: 'Ligas e normas', ic: 'frasco', href: 'liga/index.html#/ligas' },
    { id: 'materiais', nome: 'Sucatas e ferroligas', ic: 'caixas', href: 'liga/index.html#/materiais' },
  ] },
  { sec: 'Modelos', itens: [{ id: 'modelos', nome: 'Controle de Modelos', ic: 'cubo', pronto: false }] },
  { sec: 'Qualidade', itens: [{ id: 'certificados', nome: 'Certificados', ic: 'certificado', pronto: false }] },
  { sec: 'Processo', itens: [{ id: 'instrucao', nome: 'Instrução de Processo', ic: 'prancheta', pronto: false }] },
  { sec: 'Sistema', itens: [{ id: 'config', nome: 'Configurações', ic: 'engrenagem', href: 'liga/index.html#/config' }] },
];

function htmlMenu(ativo) {
  return MENU.map(g => (g.sec ? `<div class="sec">${g.sec}</div>` : '') + g.itens.map(it =>
    it.pronto === false
      ? `<span class="item" title="Em migração para o sistema">${icone(it.ic)}${it.nome}${icone('cadeado', 'cad')}</span>`
      : `<a href="${banco.raiz(it.href)}" data-menu="${it.id}" class="${it.id === ativo ? 'ativo' : ''}">${icone(it.ic)}${it.nome}</a>`
  ).join('')).join('');
}

// ---------- tema claro/escuro ----------
export function aplicarTema() {
  const t = localStorage.getItem('pmt_tema') || 'escuro';
  document.documentElement.dataset.tema = t;
  return t;
}
aplicarTema();

// ---------- montagem da casca ----------
// Exige login (no modo Firebase). Devolve o estado do banco.
export async function montar({ ativo, trilha }) {
  const est = await banco.iniciar();
  if (est.modo === 'firebase' && !est.usuario) {
    location.replace(banco.raiz('index.html') + '?voltar=' + encodeURIComponent(location.href));
    return new Promise(() => {});
  }
  const miolo = document.getElementById('app');
  const casca = document.createElement('div');
  casca.className = 'casca';
  casca.innerHTML = `
    <aside class="lateral">
      <a class="marca" href="${banco.raiz('index.html')}"><b>PROMETALS</b><small>Sistema Engenharia</small></a>
      <nav class="menu" id="menuLateral">${htmlMenu(ativo)}</nav>
      <div class="versao">v${VERSAO}</div>
    </aside>
    <div class="principal">
      <header class="topo">
        <button class="botao-ic menu-mobile" id="btMenuMobile" aria-label="Abrir menu">${icone('menu')}</button>
        <div class="trilha" id="trilha"></div>
        <div class="cresce"></div>
        <button class="botao-ic" id="btTema" title="Trocar tema claro/escuro"></button>
        <div class="quem"><span class="avatar" id="avatar"></span><div><b id="quemNome"></b><small>Engenharia</small></div></div>
        <button class="botao-ic" id="btSair" title="Sair">${icone('sair')}</button>
      </header>
      <main class="conteudo" id="conteudo"></main>
      <footer class="rodape"><span id="rodSit"></span><span class="cresce" style="flex:1"></span><span id="rodSessao"></span></footer>
    </div>`;
  miolo.replaceWith(casca);
  casca.querySelector('.conteudo').id = 'conteudo';
  definirTrilha(trilha);

  const btTema = casca.querySelector('#btTema');
  const pintarTema = () => { btTema.innerHTML = icone(document.documentElement.dataset.tema === 'claro' ? 'lua' : 'sol'); };
  pintarTema();
  btTema.onclick = () => {
    localStorage.setItem('pmt_tema', document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro');
    aplicarTema(); pintarTema();
  };
  casca.querySelector('#btMenuMobile').onclick = () => casca.classList.toggle('menu-aberto');
  casca.querySelector('#menuLateral').addEventListener('click', e => { if (e.target.closest('a')) casca.classList.remove('menu-aberto'); });
  casca.querySelector('#btSair').onclick = async () => {
    if (est.modo === 'local') { aviso('No modo local não há login. Configure o Firebase para usar contas.'); return; }
    if (!confirm('Sair da conta neste computador?')) return;
    await banco.sair();
    location.replace(banco.raiz('index.html'));
  };

  const pintarSituacao = s => {
    const u = s.usuario;
    if (s.modo === 'firebase' && !u) { location.replace(banco.raiz('index.html')); return; }
    const nome = u ? (u.nome || u.email) : '';
    casca.querySelector('#avatar').textContent = (nome || '?').trim().charAt(0).toUpperCase();
    casca.querySelector('#quemNome').textContent = nome.replace(/\b\w/g, c => c.toUpperCase());
    let sit;
    if (s.modo === 'local') sit = '<span class="ponto pend"></span>Modo local: os dados ficam só neste navegador';
    else if (!s.online) sit = '<span class="ponto off"></span>Sem internet: as alterações são enviadas quando a conexão voltar';
    else if (s.pendentes) sit = '<span class="ponto pend"></span>Salvando…';
    else sit = '<span class="ponto"></span>Conectado';
    casca.querySelector('#rodSit').innerHTML = sit;
    casca.querySelector('#rodSessao').textContent = u && s.modo === 'firebase' ? 'Sessão: ' + u.email : '';
  };
  pintarSituacao(banco.situacao());
  banco.aoMudarEstado(pintarSituacao);
  return est;
}

export function definirTrilha(partes) {
  const el = document.getElementById('trilha');
  if (!el || !partes) return;
  el.innerHTML = partes.map((p, i) => i === partes.length - 1 ? `<b>${esc(p)}</b>` : esc(p)).join(' / ');
}
export function marcarMenu(id) {
  document.querySelectorAll('#menuLateral a').forEach(a => a.classList.toggle('ativo', a.dataset.menu === id));
}

// ---------- avisos rápidos ----------
export function aviso(texto, tipo = 'ok') {
  let box = document.querySelector('.aviso');
  if (!box) { box = document.createElement('div'); box.className = 'aviso'; document.body.appendChild(box); }
  const d = document.createElement('div');
  if (tipo === 'erro') d.className = 'erro';
  d.textContent = texto;
  box.appendChild(d);
  setTimeout(() => d.remove(), tipo === 'erro' ? 7000 : 3500);
}

// ---------- janela (modal) ----------
// Devolve {el, fechar}. botoes: [{texto, cls, acao(el) -> false mantém aberta}]
export function janela({ titulo, html, botoes = [], larga = false, aoAbrir }) {
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="${larga ? 'max-width:1000px' : ''}">
    <header><h3>${esc(titulo)}</h3><button class="botao-ic" data-fechar aria-label="Fechar">${icone('fechar')}</button></header>
    <div class="corpo">${html}</div>
    <footer>${botoes.map((b, i) => b.esquerda ? `<button class="btn ${b.cls || ''}" data-b="${i}">${b.texto}</button><span class="cresce"></span>` : '').join('')}
      ${botoes.map((b, i) => !b.esquerda ? `<button class="btn ${b.cls || ''}" data-b="${i}">${b.texto}</button>` : '').join('')}</footer>
  </div>`;
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', tecla);
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
  fundo.querySelector('[data-fechar]').onclick = fechar;
  fundo.querySelectorAll('[data-b]').forEach(bt => {
    bt.onclick = async () => {
      const b = botoes[+bt.dataset.b];
      if (!b.acao) return fechar();
      const r = await b.acao(fundo.querySelector('.modal'));
      if (r !== false) fechar();
    };
  });
  document.body.appendChild(fundo);
  const el = fundo.querySelector('.modal');
  aoAbrir && aoAbrir(el);
  const primeiro = el.querySelector('input,select,textarea');
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
  return { el, fechar };
}

// ---------- formatação ----------
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Lê número escrito com vírgula ou ponto. Vazio → null.
export function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return null;
  const t = /,\d*$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}
export function fmt(v, casas = 2) {
  if (v == null || v === '' || !isFinite(v)) return '';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
export function fmtKg(v) {
  if (v == null || !isFinite(v)) return '';
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
export function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function fmtData(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}
export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
