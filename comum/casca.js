// =====================================================================
//  comum/casca.js — barra lateral, topo, login obrigatório e ajudantes
//  de tela (avisos, janelas, ícones, formatação) usados por todos os módulos.
// =====================================================================
import * as banco from './banco.js?v=2.0.2';

export const VERSAO = '2.0.2';

// ---------- quem acessa o quê (tela Usuários e acessos) ----------
// Cada usuário tem um documento em eng_acessos (id = e-mail em minúsculas):
//   { email, nome, telas: { corridas: 'editar', retornos: 'ver', … } }   (tela fora da lista = sem acesso)
// O administrador vê e edita tudo e é o único que mexe nos acessos. A proteção de verdade
// está no firestore.rules (que lê o mesmo eng_acessos); aqui é só o que aparece na tela.
export const ADMINS = ['projetos1@prometals.co'];          // → admin() no firestore.rules
export const COL_ACESSOS = 'eng_acessos';
// niveis: o que dá para escolher na tela de usuários
export const TELAS = [
  { id: 'corridas', grupo: 'Cálculo de Liga', nome: 'Corridas', niveis: ['ver', 'editar'], dica: 'Lista, ficha e boletim das corridas' },
  { id: 'amostras', grupo: 'Cálculo de Liga', nome: 'Amostras do dia', niveis: ['ver', 'editar'], dica: 'Editar = mudar os Dados do formulário do laboratório' },
  { id: 'retornos', grupo: 'Cálculo de Liga', nome: 'Retornos', niveis: ['ver', 'editar'], dica: 'Peso, análise e PDF do laboratório' },
  { id: 'ligas', grupo: 'Cálculo de Liga', nome: 'Ligas e normas', niveis: ['ver', 'editar'] },
  { id: 'materiais', grupo: 'Cálculo de Liga', nome: 'Sucatas e ferroligas', niveis: ['ver', 'editar'] },
  { id: 'mapa', grupo: 'Almoxarifado modelos', nome: 'Prateleiras', niveis: ['ver', 'editar'], dica: 'Editar = pôr um modelo sem posição numa vaga livre' },
  { id: 'modelos', grupo: 'Almoxarifado modelos', nome: 'Modelos', niveis: ['ver', 'editar'], dica: 'Cadastro, posição e PDF do desenho' },
  { id: 'manutencao', grupo: 'Almoxarifado modelos', nome: 'Manutenção de modelos', niveis: ['ver', 'editar'], semMenu: true, dica: 'Editar = registrar a ida e a volta da manutenção na ficha do modelo (Só ver não muda nada: é só um botão)' },
  { id: 'comercial', grupo: 'Modelos Prometals', nome: 'Modelos Prometals (lista comercial)', niveis: ['ver', 'editar'], dica: 'Tela de consulta: os dados da ficha comercial se editam na ficha do modelo (Editar de Modelos)' },
  { id: 'ruas', grupo: 'Almoxarifado modelos', nome: 'Ruas e importação', niveis: ['ver', 'editar'] },
  { id: 'modelosClientes', grupo: 'Modelos de clientes', nome: 'Modelos de clientes', niveis: ['ver', 'editar'], dica: 'Painel, modelos, devoluções, clientes, planilhas e configurações (todo o módulo)' },
  { id: 'certificados', grupo: 'Qualidade', nome: 'Certificados', niveis: ['ver', 'editar'] },
  { id: 'instrucao', grupo: 'Processo', nome: 'Instrução de Processo (atalho)', niveis: ['ver', 'editar'], dica: 'Só o atalho no menu (Só ver e Editar dão o mesmo): o app fica no Supabase, com login próprio' },
  { id: 'config', grupo: 'Sistema', nome: 'Configurações', niveis: ['ver', 'editar'], dica: 'Forno, numeração, importação das planilhas e cópia de segurança' },
];
export const TELAS_LIGA = ['corridas', 'amostras', 'retornos', 'ligas', 'materiais', 'config'];
export const TELAS_MODELOS = ['mapa', 'modelos', 'comercial', 'ruas'];

// Pedido do usuário: por enquanto TODOS que entram veem e editam tudo (menos Usuários e acessos).
// Para passar a valer o que está em Usuários e acessos: mudar para true (e publicar o firestore.rules).
export const RESTRINGIR = false;

// Telas fora do ar (somem do menu e da Visão geral; a página mostra "sem acesso", até para o administrador).
// Ex.: ['modelosClientes'] desliga os Modelos de clientes sem apagar nada.
export const TELAS_DESLIGADAS = [];

let ACESSO = null;   // { email, admin, telas }
export const ehAdmin = () => !!(ACESSO && ACESSO.admin);
export function nivel(tela) {
  if (!ACESSO) return '';
  if (TELAS_DESLIGADAS.includes(tela)) return '';
  if (ACESSO.admin) return 'editar';
  if (!RESTRINGIR) { const t = TELAS.find(x => x.id === tela); return t ? t.niveis[t.niveis.length - 1] : ''; }
  return ACESSO.telas[tela] || '';
}
export const podeVer = tela => !!nivel(tela);
export const podeEditar = tela => nivel(tela) === 'editar';
export const acessoCarregado = () => ACESSO;

// No modo local todo mundo é administrador. Para testar como outra pessoa vê, no console do navegador:
//   localStorage.setItem('pmt_simular', 'qualidade1@prometals.co')   (e remover depois)
async function carregarAcesso() {
  let email;
  if (banco.modo() !== 'firebase') {
    email = localStorage.getItem('pmt_simular');
    if (!email) { ACESSO = { email: '', admin: true, telas: {} }; return; }
  } else {
    const u = banco.usuario();
    email = u && u.email;
  }
  email = String(email || '').trim().toLowerCase();
  if (ADMINS.includes(email)) { ACESSO = { email, admin: true, telas: {} }; await semearAcessos(); return; }
  let doc = null;
  try { doc = email ? await banco.lerDoc(COL_ACESSOS, email) : null; }
  catch (e) { console.warn('acessos', e); }
  ACESSO = { email, admin: false, telas: (doc && doc.telas) || {} };
}

// Acessos gravados sozinhos quando o administrador entra, para ninguém ficar sem acesso ao ligar esta tela.
// Cada e-mail é gravado UMA vez só (a lista do que já foi gravado fica em eng_acessos/_semeados):
// se o administrador depois remover ou mudar a pessoa, não volta.
const ACESSOS_INICIAIS = [{
  email: 'qualidade1@prometals.co', nome: 'Qualidade',
  telas: { corridas: 'editar', amostras: 'editar', retornos: 'editar', ligas: 'editar', materiais: 'editar', config: 'editar',
    mapa: 'ver', modelos: 'ver', manutencao: 'editar', comercial: 'ver', ruas: 'ver', certificados: 'editar', instrucao: 'ver' },
}, {
  email: 'comercial2@prometals.co', nome: 'Comercial',          // só o módulo Modelos de clientes
  telas: { modelosClientes: 'editar' },
}];
async function semearAcessos() {
  const chave = 'pmt_acessos_ok:' + ACESSOS_INICIAIS.length + ':' + (banco.modo() === 'firebase' ? 'fb' : 'local');
  if (localStorage.getItem(chave)) return;
  try {
    const atuais = await banco.lerColecao(COL_ACESSOS);
    const marca = atuais.find(a => a.id === '_semeados');
    const feitos = new Set((marca && marca.lista) || []);
    const ops = ACESSOS_INICIAIS.filter(a => !feitos.has(a.email))
      .filter(a => !atuais.some(x => x.id === a.email))
      .map(a => ({ col: COL_ACESSOS, id: a.email, dados: a }));
    ACESSOS_INICIAIS.forEach(a => feitos.add(a.email));
    ops.push({ col: COL_ACESSOS, id: '_semeados', dados: { lista: [...feitos] } });
    await banco.emLote(ops);
    localStorage.setItem(chave, '1');
  } catch (e) { console.warn('semear acessos', e); }
}

// Tela sem acesso: mensagem no lugar do conteúdo
export function semAcesso(el = document.getElementById('conteudo')) {
  el.innerHTML = `<div class="faixa verm">${icone('cadeado')} Seu usuário não tem acesso a esta tela. Se precisar, peça para a Engenharia (${esc(ADMINS[0])}) liberar em <b>Usuários e acessos</b>.</div>
    <a class="btn" href="${banco.raiz('index.html')}">${icone('voltar')} Visão geral</a>`;
}

// ---------- páginas: cada tela é uma página própria (pasta do módulo / pasta da tela / index.html) ----------
// endereco('calculo_liga/ficha_corrida', { id }) → endereço completo da página, com os parâmetros (?id=…)
export function endereco(caminho, params) {
  const q = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString() : '';
  return banco.raiz(caminho.replace(/\/+$/, '') + '/index.html') + (q ? '?' + q : '');
}
// Parâmetro do endereço da página aberta (?id=…)
export const parametro = nome => new URLSearchParams(location.search).get(nome) || '';

// Trocar de página sem perder gravação: espera as gravações em andamento (até 1,5 s; sem internet o
// Firebase já guardou no computador e envia depois) e só então sai da página.
function esperarGravacoes(maxMs = 1500) {
  if (!banco.situacao().pendentes) return Promise.resolve();
  return new Promise(ok => {
    const fim = () => { clearTimeout(t); parar(); ok(); };
    const t = setTimeout(fim, maxMs);
    const parar = banco.aoMudarEstado(s => { if (!s.pendentes) fim(); });
  });
}
export async function ir(url, { trocar = false } = {}) {
  await esperarGravacoes();
  if (trocar) location.replace(url); else location.href = url;
}
// Link clicado com gravação em andamento: espera antes de sair (mesma regra do ir())
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || e.defaultPrevented || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  if (a.origin !== location.origin || !banco.situacao().pendentes) return;
  e.preventDefault();
  ir(a.href);
});

// Filtros e escolhas de uma tela, lembrados enquanto a aba estiver aberta (voltar para a tela mantém a busca)
export function filtroDaTela(chave, padrao) {
  let f = { ...padrao };
  try { f = { ...padrao, ...JSON.parse(sessionStorage.getItem('pmt_filtro:' + chave) || '{}') }; } catch (e) { /* sem armazenamento */ }
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem('pmt_filtro:' + chave, JSON.stringify(f, (k, v) => (v instanceof Set ? undefined : v))); } catch (e) { /* sem armazenamento */ }
  });
  return f;
}

// Tela só de consulta: os campos ficam travados e os botões de edição (classe "so-ed") somem.
// Campos que não mudam dados (busca, filtros, data das amostras…) levam a classe "livre".
export function modoLeitura(sim, texto = 'Você está só consultando esta tela. Alterações são feitas por quem tem acesso de edição.') {
  const C = document.getElementById('conteudo');
  if (!C) return;
  C.classList.toggle('leitura', !!sim);
  const f = document.getElementById('faixaLeitura');
  if (f) { f.hidden = !sim; f.innerHTML = sim ? `${icone('olho')} ${esc(texto)}` : ''; }
  if (sim) travarCampos(C);
}
function travarCampos(raiz) {
  raiz.querySelectorAll('input,select,textarea').forEach(i => { if (!i.disabled && !i.closest('.livre')) i.disabled = true; });
  raiz.querySelectorAll('[contenteditable="true"]').forEach(i => { i.contentEditable = 'false'; });
}
new MutationObserver(() => document.querySelectorAll('.leitura').forEach(travarCampos))
  .observe(document.documentElement, { childList: true, subtree: true });

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
  grade: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  documento: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  ferramenta: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  externo: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  tubo: '<path d="M8 3h8"/><path d="M9 3v14a3 3 0 0 0 6 0V3"/><path d="M9 11h6"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.8c2 .7 3.2 2.4 3.6 5.2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  caminhao: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
};
export function icone(nome, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[nome] || ''}</svg>`;
}

// ---------- menu lateral ----------
// pronto:false = módulo ainda não migrado (aparece com cadeado, como no PCP)
const MENU = [
  { itens: [{ id: 'inicio', nome: 'Visão geral', ic: 'casa', href: 'index.html' }] },
  { sec: 'Cálculo de Liga', itens: [
    { id: 'corridas', nome: 'Corridas', ic: 'chama', href: 'calculo_liga/corridas/index.html' },
    { id: 'amostras', nome: 'Amostras do dia', ic: 'tubo', href: 'calculo_liga/amostras_dia/index.html' },
    { id: 'retornos', nome: 'Retornos', ic: 'reciclar', href: 'calculo_liga/retornos/index.html' },
    { id: 'ligas', nome: 'Ligas e normas', ic: 'frasco', href: 'calculo_liga/ligas_normas/index.html' },
    { id: 'materiais', nome: 'Sucatas e ferroligas', ic: 'caixas', href: 'calculo_liga/sucatas_ferroligas/index.html' },
  ] },
  // Pedido do usuário: 3 tópicos. Item com filhos: as telas aparecem embaixo dele quando se está nele.
  { sec: 'Modelos', itens: [
    { id: 'almox', nome: 'Almoxarifado modelos', ic: 'grade', filhos: [
      { id: 'mapa', nome: 'Prateleiras', ic: 'grade', href: 'almoxarifado_modelos/prateleiras/index.html' },
      { id: 'modelos', nome: 'Modelos', ic: 'cubo', href: 'almoxarifado_modelos/modelos/index.html' },
      { id: 'ruas', nome: 'Ruas e importação', ic: 'caixas', href: 'almoxarifado_modelos/ruas_importacao/index.html' },
    ] },
    { id: 'prometals', nome: 'Modelos Prometals', ic: 'cubo', filhos: [
      { id: 'comercial', nome: 'Lista comercial', ic: 'documento', href: 'modelos_prometals/lista_comercial/index.html' },
    ] },
    { id: 'mcli', nome: 'Modelos de clientes', ic: 'cubo', filhos: [
      { id: 'mcli-painel', tela: 'modelosClientes', nome: 'Painel', ic: 'grade', href: 'modelos_clientes/painel/index.html' },
      { id: 'mcli-modelos', tela: 'modelosClientes', nome: 'Modelos', ic: 'cubo', href: 'modelos_clientes/modelos/index.html' },
      { id: 'mcli-devolucoes', tela: 'modelosClientes', nome: 'Devoluções', ic: 'documento', href: 'modelos_clientes/devolucoes/index.html' },
      { id: 'mcli-clientes', tela: 'modelosClientes', nome: 'Clientes', ic: 'usuarios', href: 'modelos_clientes/clientes/index.html' },
      { id: 'mcli-planilha', tela: 'modelosClientes', nome: 'Importar / Exportar', ic: 'subir', href: 'modelos_clientes/importar_exportar/index.html' },
      { id: 'mcli-config', tela: 'modelosClientes', nome: 'Configurações', ic: 'engrenagem', href: 'modelos_clientes/configuracoes/index.html' },
    ] },
  ] },
  { sec: 'Qualidade', itens: [{ id: 'certificados', nome: 'Certificados', ic: 'certificado', href: 'certificados/lista/index.html' }] },
  // Instrução de Processo: por enquanto é o app separado (Supabase), aberto numa aba nova
  { sec: 'Processo', itens: [{ id: 'instrucao', nome: 'Instrução de Processo', ic: 'prancheta', href: 'https://projetos1prometals.github.io/instrucao-processo-prometals/', externo: true }] },
  { sec: 'Sistema', itens: [
    { id: 'config', nome: 'Configurações', ic: 'engrenagem', href: 'sistema/configuracoes/index.html' },
    { id: 'usuarios', nome: 'Usuários e acessos', ic: 'cadeado', href: 'sistema/usuarios_acessos/index.html', admin: true },
  ] },
];
// Item do menu aparece se a pessoa pode ver a tela (visão geral e atalhos externos: sempre).
// Item com filhos (um módulo): aparece se algum filho aparece; os filhos só se abrem quando se está no módulo.
const noMenu = it => it.filhos ? it.filhos.some(noMenu)
  : it.admin ? ehAdmin() : (it.id === 'inicio' || podeVer(it.tela || it.id));

function htmlItem(it, ativo, cls = '') {
  return it.pronto === false
    ? `<span class="item" title="Em migração para o sistema">${icone(it.ic)}${it.nome}${icone('cadeado', 'cad')}</span>`
    : it.externo
      ? `<a href="${it.href}" target="_blank" rel="noopener" data-menu="${it.id}" title="Abre o app numa aba nova">${icone(it.ic)}${it.nome}${icone("externo", "cad")}</a>`
      : `<a href="${banco.raiz(it.href)}" data-menu="${it.id}" class="${cls} ${it.id === ativo ? "ativo" : ""}">${icone(it.ic)}${it.nome}</a>`;
}
function htmlMenu(ativo) {
  return MENU.map(g => ({ ...g, itens: g.itens.filter(noMenu) })).filter(g => g.itens.length).map(g => (g.sec ? `<div class="sec">${g.sec}</div>` : '') + g.itens.map(it => {
    if (!it.filhos) return htmlItem(it, ativo);
    const filhos = it.filhos.filter(noMenu);
    const aberto = it.id === ativo || filhos.some(f => f.id === ativo);
    // os filhos sempre vão no HTML; marcarMenu() mostra só os do item em que se está
    return htmlItem({ ...it, href: filhos[0].href }, null, 'pai' + (aberto ? ' aberto' : '')) +
      `<div class="filhos" ${aberto ? '' : 'style="display:none"'}>${filhos.map(f => htmlItem(f, ativo, 'filho')).join('')}</div>`;
  }).join('')).join('');
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
  await carregarAcesso();
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
        <div class="quem"><span class="avatar" id="avatar"></span><div><b id="quemNome"></b><small>${ehAdmin() ? 'Administrador' : 'Engenharia'}</small></div></div>
        <button class="botao-ic" id="btSair" title="Sair">${icone('sair')}</button>
      </header>
      <div class="faixa-leitura" id="faixaLeitura" hidden></div>
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
  // abre só o grupo de filhos que tem a tela atual (ex.: Prateleiras ↔ Modelos Prometals na mesma página)
  document.querySelectorAll('#menuLateral .filhos').forEach(f => {
    const dentro = [...f.querySelectorAll('a')].some(a => a.dataset.menu === id);
    f.style.display = dentro ? '' : 'none';
    const pai = f.previousElementSibling;
    if (pai && pai.classList.contains('pai')) pai.classList.toggle('aberto', dentro);
  });
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
// soLeitura: campos travados, botões de gravar somem e "Cancelar" vira "Fechar".
export function janela({ titulo, html, botoes = [], larga = false, aoAbrir, soLeitura = false }) {
  if (soLeitura) botoes = botoes.filter(b => !b.acao || b.livre).map(b => (b.texto === 'Cancelar' ? { ...b, texto: 'Fechar' } : b));
  const fundo = document.createElement('div');
  fundo.className = 'fundo-modal';
  fundo.innerHTML = `<div class="modal ${soLeitura ? 'leitura' : ''}" role="dialog" aria-modal="true" style="${larga ? 'max-width:1000px' : ''}">
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
