// =====================================================================
//  modelos_clientes/base_mcli.js — base do módulo Modelos de clientes
//  Porte do app antigo "Controle de Modelos — T.M Gastão / PROMETALS"
//  (app-modelos-clientes/, só estudo). Cada tela é uma página própria:
//  painel/, modelos/, ficha_modelo/ (fotos e histórico), devolucoes/,
//  devolucao/ (documento A4), clientes/, importar_exportar/, configuracoes/
//  e produto/ (consulta pelo código do produto; a Instrução de Processo abre).
//  Aqui ficam os dados, o acesso, as janelas e as ações comuns às telas.
//  Permissão: tela "modelosClientes" em Usuários e acessos.
// =====================================================================
import * as banco from '../comum/banco.js?v=2.0.2';
import { montar, definirTrilha, marcarMenu, aviso, janela, esc, fmtData, icone, hoje, podeEditar, podeVer, semAcesso, modoLeitura, endereco, filtroDaTela, ir } from '../comum/casca.js?v=2.0.2';
import { empresa, fmtDataHora } from './folha_devolucao.js?v=2.0.2';
import { TIPOS_FOTO, enviarFotos, preencherFotos, urlFoto, apagarFoto } from './fotos.js?v=2.0.2';
import { norm } from './planilha.js?v=2.0.2';

export const COL = {
  clientes: 'eng_clientes', modelos: 'eng_mcli_modelos', eventos: 'eng_mcli_eventos', devolucoes: 'eng_mcli_devolucoes',
  config: 'eng_config',
};
export const CFG_ID = 'modelosClientes';
export const TELA = 'modelosClientes';

export const STATUS = {
  na_empresa: { texto: 'Na empresa', cls: 'ok' },
  em_conserto: { texto: 'Em conserto', cls: 'alerta' },
  separado: { texto: 'Aguardando retirada', cls: 'info' },
  devolvido: { texto: 'Devolvido', cls: 'neutro' },
};
export const DEV_STATUS = {
  emitida: { texto: 'Aguardando retirada', cls: 'info' },
  entregue: { texto: 'Entregue', cls: 'ok' },
  cancelada: { texto: 'Cancelada', cls: 'neutro' },
};
export const EV = {
  entrada: { texto: 'Chegada', cor: 'var(--verde)' },
  conserto: { texto: 'Conserto', cor: 'var(--amar)' },
  ocorrencia: { texto: 'Ocorrência', cor: 'var(--lar)' },
  saida: { texto: 'Devolução ao cliente', cor: 'var(--az)' },
  movimentacao: { texto: 'Movimentação', cor: 'var(--mut)' },
};
export const EV_TITULO = { entrada: 'Nova chegada do modelo', conserto: 'Conserto do modelo', ocorrencia: 'Ocorrência' };
export const MATERIAIS = ['Madeira', 'Alumínio', 'Resina', 'Isopor (EPS)', 'Aço', 'Ferro fundido', 'Madeira + alumínio'];

// ---------------------------------------------------------------------
// Estado e dados
// ---------------------------------------------------------------------
export const S = { clientes: new Map(), modelos: new Map(), devolucoes: new Map(), eventos: new Map(), config: null, chegou: {} };
// filtros das listas: lembrados enquanto a aba estiver aberta (o painel também escolhe o filtro de Modelos)
export const filtros = {
  modelos: filtroDaTela('mcli_modelos', { q: '', status: 'ativos', cliente: '' }),
  dev: filtroDaTela('mcli_devolucoes', { q: '', status: '' }),
  cli: filtroDaTela('mcli_clientes', { q: '' }),
};
export let C = null;
export let ED = false;
let pagina = null;     // { atualizar, fixa } da tela aberta (ver mostrar())

// Endereço de uma tela do módulo: url('ficha_modelo', { id }) → modelos_clientes/ficha_modelo/index.html?id=…
export const url = (tela, params) => endereco('modelos_clientes/' + tela, params);
export function redesenhar() { if (pagina) pagina.atualizar(); }
// Ações próprias de uma tela (botões com data-acao), somadas às comuns (ACOES)
export const registrarAcoes = o => Object.assign(ACOES, o);

// ---------------------------------------------------------------------
// Início de cada tela: desenhar() chama mostrar() quando os dados chegam
// ---------------------------------------------------------------------
let desenhar = null, desenhado = false;
export async function iniciarTela({ menu, desenhar: d }) {
  await montar({ ativo: menu, trilha: ['Modelos de clientes'] });
  C = document.getElementById('conteudo');
  if (!podeVer(TELA)) { semAcesso(C); return false; }   // sem acesso: nem lê os dados
  ED = podeEditar(TELA);
  modoLeitura(!ED);
  C.innerHTML = '<div class="vazio">Carregando dados…</div>';
  desenhar = d;
  banco.ouvirColecao(COL.clientes, paraMapa(S.clientes, 'clientes'), erroBanco);
  banco.ouvirColecao(COL.modelos, paraMapa(S.modelos, 'modelos'), erroBanco);
  banco.ouvirColecao(COL.eventos, paraMapa(S.eventos, 'eventos'), erroBanco);
  banco.ouvirColecao(COL.devolucoes, paraMapa(S.devolucoes, 'devolucoes'), erroBanco);
  banco.ouvirDoc(COL.config, CFG_ID, x => { S.config = x; if (pagina && !pagina.fixa) pagina.atualizar(); }, () => {});
  return true;
}
function chegou(nome) {
  S.chegou[nome] = true;
  if (!['clientes', 'modelos', 'eventos', 'devolucoes'].every(k => S.chegou[k])) return;
  if (!desenhado) { desenhado = true; window.scrollTo(0, 0); desenhar(); }
  else if (pagina && !pagina.fixa) pagina.atualizar();
}
const paraMapa = (mapa, nome) => l => { mapa.clear(); l.forEach(x => mapa.set(x.id, x)); chegou(nome); };
function erroBanco(e) {
  const perm = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${perm
    ? 'Seu usuário não tem permissão para ver os modelos de clientes. Peça para a Engenharia liberar em Usuários e acessos.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}


export const E = () => empresa(S.config);
export const cli = id => S.clientes.get(id) || null;
export const nomeCli = id => (cli(id) || {}).nome || '—';
export const rotuloCli = id => { const c = cli(id); return c ? (c.codigo ? c.codigo + ' · ' : '') + (c.nome || '') : '—'; };
export const prefixo = k => (k === 'dev' ? E().prefixoDev || 'DEV-' : E().prefixoModelo || 'MOD-');
export const autorDe = x => (x && x._por ? String(x._por).split('@')[0] : '');
export const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const agoraISO = () => new Date().toISOString();
export const maxData = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
export function diasDesde(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 86400000);
}
export function proximoCodigo(pref, codigos) {
  let max = 0;
  const re = new RegExp('^' + pref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i');
  codigos.forEach(c => { const m = re.exec(String(c || '').trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return pref + String(max + 1).padStart(4, '0');
}
export const parados = () => [...S.modelos.values()].filter(m => m.status === 'na_empresa' && (diasDesde(m.ultimaMov || m.dataEntrada) ?? 0) > 365);
export const consertosAbertos = () => [...S.eventos.values()].filter(e => e.tipo === 'conserto' && e.situacao === 'aberto');

// Gravação: o documento inteiro (banco.salvar substitui). Não esperamos a resposta: sem internet
// o Firebase guarda e envia depois. O mapa local é atualizado na hora para gravações seguidas.
export const semMeta = o => { const { id, _em, _por, ...r } = o || {}; return r; };
export function gravar(col, mapa, id, dados) {
  mapa.set(id, { ...dados, id });
  return banco.salvar(col, id, dados).catch(e => { console.error(e); aviso('Não foi possível salvar: ' + (e.code || e.message), 'erro'); });
}
export const atualizar = (col, mapa, id, mud) => gravar(col, mapa, id, { ...semMeta(mapa.get(id)), ...mud });
export function apagarDoc(col, mapa, id) {
  mapa.delete(id);
  return banco.apagar(col, id).catch(e => { console.error(e); aviso('Não foi possível apagar: ' + (e.code || e.message), 'erro'); });
}
export const gravarModelo = (id, mud) => atualizar(COL.modelos, S.modelos, id, mud);
export function novoEvento(ev) {
  const id = novoId();
  gravar(COL.eventos, S.eventos, id, { fotos: [], ...ev, criadoEm: agoraISO() });
  return id;
}
// Foto ainda usada por algum documento de devolução? (aí o arquivo não é apagado)
export const fotoEmDocumento = id => [...S.devolucoes.values()].some(d => (d.fotos || []).some(f => f.id === id));
export function apagarFotos(ids) { ids.filter(id => !fotoEmDocumento(id)).forEach(id => apagarFoto(id).catch(e => console.warn(e))); }

// Mostra a página e guarda como redesenhar quando os dados mudam (mantém o foco da busca)
export function mostrar(menu, trilha, desenhar, fixa = false, depois = null) {
  marcarMenu(menu);
  definirTrilha(['Modelos de clientes', ...trilha]);
  const pintar = () => {
    const ae = document.activeElement, chave = ae && ae.dataset && ae.dataset.manter;
    const sel = chave ? [ae.selectionStart, ae.selectionEnd] : null;
    C.innerHTML = desenhar();
    if (chave) { const el = C.querySelector(`[data-manter="${chave}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* select */ } } }
    ligar(C);
    if (depois) depois();
    preencherFotos(C);
  };
  pagina = { atualizar: pintar, fixa };
  pintar();
}

export const tagSit = (st, mapa = STATUS) => { const s = mapa[st] || { texto: st || '—', cls: 'neutro' }; return `<span class="tag ${s.cls}">${esc(s.texto)}</span>`; };
export const bt = (texto, acao, cls = '', attrs = '') => (ED ? `<button class="btn so-ed ${cls}" data-acao="${acao}" ${attrs}>${texto}</button>` : '');
export const opcoesClientes = sel => [...S.clientes.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  .map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}${c.codigo ? ' (' + esc(c.codigo) + ')' : ''}</option>`).join('');

// ---------------------------------------------------------------------
// Ações (botões com data-acao, em qualquer lugar da página ou das janelas)
// ---------------------------------------------------------------------
export const ACOES = {
  'novo-modelo': () => janelaModelo(null),
  'nova-devolucao': () => janelaDevolucao({}),
  'novo-cliente': () => janelaCliente(null),
  'abrir-cliente': t => janelaCliente(cli(t.dataset.id)),
  'ir': t => { ir(t.dataset.href); },
  'tile': t => { Object.assign(filtros.modelos, { q: '', cliente: '', status: t.dataset.v }); ir(url('modelos')); },
  'f-status': t => { filtros.modelos.status = t.dataset.v; pagina.atualizar(); },
  'fd-status': t => { filtros.dev.status = t.dataset.v; pagina.atualizar(); },
  'editar-modelo': t => janelaModelo(S.modelos.get(t.dataset.id)),
  'excluir-modelo': t => excluirModelo(t.dataset.id),
  'ev-novo': t => janelaEvento(t.dataset.tipo, t.dataset.id),
  'ev-editar': t => { const e = S.eventos.get(t.dataset.id); if (e) janelaEvento(e.tipo, e.modeloId, e); },
  'ev-concluir': t => { const e = S.eventos.get(t.dataset.id); if (e) janelaEvento('conserto', e.modeloId, e, { situacao: 'concluido' }); },
  'ev-excluir': t => excluirEvento(t.dataset.id),
  'mover': t => janelaMover(t.dataset.id),
  'foto': t => janelaFoto(t.dataset.id, t.dataset.modelo),
  'devolver': t => { const m = S.modelos.get(t.dataset.id); if (m) janelaDevolucao({ clienteId: m.clienteId, modeloIds: [m.id] }); },
  'dev-imprimir': async () => { await preencherFotos(C); window.print(); },
  'dev-retirada': t => janelaRetirada(t.dataset.id, false),
  'dev-editar': t => janelaRetirada(t.dataset.id, true),
  'dev-cancelar': t => cancelarDevolucao(t.dataset.id),
  'dev-excluir': t => excluirDevolucao(t.dataset.id),
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-acao]');
  if (!t || !ACOES[t.dataset.acao]) return;
  e.preventDefault();
  ACOES[t.dataset.acao](t, e);
});
// Ligações que dependem da página desenhada (buscas, filtros, envio de fotos)
export function ligar(raiz) {
  raiz.querySelectorAll('[data-filtro]').forEach(el => {
    const [grupo, campo] = el.dataset.filtro.split('.');
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { filtros[grupo][campo] = el.value; pagina.atualizar(); });
  });
  raiz.querySelectorAll('input[type=file][data-enviar-tipo]').forEach(inp => {
    inp.onchange = () => adicionarFotos(inp.dataset.modelo, inp.dataset.enviarTipo, [...inp.files]).finally(() => { inp.value = ''; });
  });
}

// ---------------------------------------------------------------------
// FICHA DO MODELO
// ---------------------------------------------------------------------
export const eventosOrdenados = l => [...l].sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
export const eventosDoModelo = id => eventosOrdenados([...S.eventos.values()].filter(e => e.modeloId === id));
export const fato = (l, v) => `<div><dt>${l}</dt><dd>${v || '<span class="mut">—</span>'}</dd></div>`;

export function htmlFotosPorTipo(m, editar) {
  const fotos = m.fotos || [];
  return `<div class="mc-fotos">${Object.entries(TIPOS_FOTO).map(([tipo, nome]) => {
    const fs = fotos.filter(f => (f.tipo || 'outra') === tipo);
    return `<div class="mc-foto-grupo"><div class="mc-foto-tit">${nome}${tipo === 'macho' ? ' <span class="mut">(opcional)</span>' : ''}</div>
      <div class="galeria">${fs.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f.id)}" data-modelo="${esc(m.id)}"><img data-foto="${esc(f.id)}" alt="${nome}"></button>`).join('')}
        ${editar ? `<label class="add-foto so-ed">${icone('camera')} Adicionar<input type="file" accept="image/*" ${tipo === 'outra' ? 'multiple' : ''} data-enviar-tipo="${tipo}" data-modelo="${esc(m.id)}"></label>` : ''}
        ${!fs.length && !editar ? '<span class="mut peq">Sem foto.</span>' : ''}</div></div>`;
  }).join('')}</div>`;
}

export function linhaDoTempo(evs, mostrarModelo) {
  return `<ul class="tl">${evs.map(e => {
    const t = EV[e.tipo] || EV.movimentacao, m = S.modelos.get(e.modeloId);
    const w = ED && !mostrarModelo;
    const sit = e.tipo === 'conserto' ? (e.situacao === 'aberto' ? '<span class="tag alerta">Em aberto</span>' : `<span class="tag ok">Concluído${e.dataFim ? ' em ' + fmtData(e.dataFim) : ''}</span>`) : '';
    const fotos = (e.fotos || []).length ? `<div class="galeria">${e.fotos.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f)}"><img data-foto="${esc(f)}" alt=""></button>`).join('')}</div>` : '';
    const dev = e.devolucaoId && S.devolucoes.get(e.devolucaoId);
    return `<li class="ev" style="--c:${t.cor}"><div class="ev-ponto"></div><div>
      <div class="ev-cab"><b>${t.texto}</b>${sit}<span class="mut">${fmtData(e.data)}</span>${e.nf ? `<span class="pilula">NF ${esc(e.nf)}</span>` : ''}${e.partes != null && e.partes !== '' && e.tipo === 'entrada' ? `<span class="pilula">${esc(e.partes)} parte(s)</span>` : ''}</div>
      ${mostrarModelo ? `<a class="ev-modelo" href="${url('ficha_modelo', { id: e.modeloId })}">${m ? esc(m.codigo) + ' · ' + esc(m.descricao) : 'Modelo removido'}</a>` : ''}
      ${e.titulo ? `<div class="ev-txt">${esc(e.titulo)}</div>` : ''}
      ${e.descricao ? `<div class="ev-txt">${e.tipo === 'conserto' ? '<span class="mut">Variação observada: </span>' : ''}${esc(e.descricao)}</div>` : ''}
      ${e.solucao ? `<div class="ev-txt"><span class="mut">Conserto realizado: </span>${esc(e.solucao)}</div>` : ''}
      ${e.responsavel ? `<div class="ev-txt mut peq">Responsável: ${esc(e.responsavel)}</div>` : ''}
      ${fotos}
      <div class="mut peq" style="margin-top:4px">${autorDe(e) ? 'por ' + esc(autorDe(e)) + ' · ' : ''}${fmtDataHora(e.criadoEm)}</div>
      ${w || (dev && !mostrarModelo) ? `<div class="ev-ferr">
        ${dev && !mostrarModelo ? `<a class="btn peq" href="${url('devolucao', { id: dev.id })}">Documento ${esc(dev.numero)}</a>` : ''}
        ${w && e.tipo === 'conserto' && e.situacao === 'aberto' ? bt('Concluir conserto', 'ev-concluir', 'peq pri', `data-id="${esc(e.id)}"`) : ''}
        ${w && ['entrada', 'conserto', 'ocorrencia'].includes(e.tipo) ? bt('Editar', 'ev-editar', 'peq', `data-id="${esc(e.id)}"`) : ''}
        ${w ? bt('Excluir', 'ev-excluir', 'peq perigo', `data-id="${esc(e.id)}"`) : ''}</div>` : ''}
    </div></li>`;
  }).join('')}</ul>`;
}

// Janela: cadastro / edição do modelo
export function janelaModelo(m, pre = {}) {
  const novo = !m; m = m || {};
  const cod = m.codigo || proximoCodigo(prefixo('modelo'), [...S.modelos.values()].map(x => x.codigo));
  const v = k => esc(m[k] ?? '');
  const j = janela({
    titulo: novo ? 'Registrar chegada de modelo' : 'Editar modelo ' + m.codigo, larga: true,
    html: `<div class="mc-form">
      <label class="campo l2">Cliente *<span class="mc-linha"><select class="ent" id="fCliente"><option value="">Selecione…</option>${opcoesClientes(m.clienteId || pre.clienteId)}</select><button type="button" class="btn peq" id="fNovoCli">+ Novo</button></span></label>
      <label class="campo">Código interno *<input class="ent" id="fCodigo" value="${esc(cod)}"></label>
      <label class="campo">Código do produto<input class="ent" id="fCodProduto" value="${v('codProduto')}" placeholder="O mesmo do NW e da Instrução de Processo"></label>
      <label class="campo l3">Descrição *<input class="ent" id="fDescricao" value="${v('descricao')}" placeholder="Ex.: CORPO FUNDIDO VR-100 INOX CF-8"></label>
      <label class="campo">Modelo / referência<input class="ent" id="fReferencia" value="${v('referencia')}" placeholder="Código do desenho ou do cliente"></label>
      <label class="campo">Total de partes<input class="ent" id="fPartes" type="number" min="0" step="1" value="${v('partes')}"></label>
      <label class="campo">Localização<input class="ent" id="fLocal" value="${v('localizacao')}" placeholder="Ex.: Galpão 2 · Prateleira B3"></label>
      <label class="campo">Material do modelo<input class="ent" id="fMaterial" list="dlMaterial" value="${v('material')}"></label>
      <label class="campo">Liga da peça<input class="ent" id="fLiga" value="${v('liga')}" placeholder="Ex.: INOX CF-8"></label>
      <span></span>
      <label class="campo">NF de entrada<input class="ent" id="fNf" value="${esc(novo ? pre.nf || '' : m.nfEntrada || '')}"></label>
      <label class="campo">Data de chegada<input class="ent" id="fData" type="date" value="${esc(novo ? pre.data || hoje() : m.dataEntrada || '')}"></label>
      <span></span>
      <label class="campo l3">${novo ? 'Condição na chegada / observações' : 'Observações'}<textarea class="ent" id="fObs">${esc(novo ? '' : m.obs || '')}</textarea></label>
      ${novo ? `<div class="l3 mc-fotos-novas"><div class="mc-foto-tit">${icone('camera')} Fotos</div>
        ${Object.entries(TIPOS_FOTO).map(([t, n]) => `<label class="campo">${n}${t === 'macho' ? ' (opcional)' : ''}<input class="ent" type="file" accept="image/*" data-tipo="${t}" ${t === 'outra' ? 'multiple' : ''}></label>`).join('')}</div>` : ''}
      <datalist id="dlMaterial">${MATERIAIS.map(x => `<option value="${x}">`).join('')}</datalist>
    </div>`,
    aoAbrir: el => {
      el.querySelector('#fNovoCli').onclick = () => janelaCliente(null, novoCli => {
        const sel = el.querySelector('#fCliente');
        sel.innerHTML = '<option value="">Selecione…</option>' + opcoesClientes(novoCli);
        sel.value = novoCli;
      });
      setTimeout(() => el.querySelector('#fDescricao').focus(), 40);
    },
    botoes: [
      { texto: 'Cancelar' },
      ...(novo ? [{ texto: 'Salvar e cadastrar outro da mesma NF', acao: el => salvarModelo(el, null, true) }] : []),
      { texto: 'Salvar', cls: 'pri', acao: el => salvarModelo(el, novo ? null : m.id, false) },
    ],
  });
  return j;
}
export async function salvarModelo(el, id, deNovo) {
  const g = s => el.querySelector(s).value.trim();
  const base = {
    clienteId: g('#fCliente'), codigo: g('#fCodigo'), codProduto: g('#fCodProduto'), descricao: g('#fDescricao'), referencia: g('#fReferencia'),
    partes: g('#fPartes') === '' ? null : Number(g('#fPartes')), material: g('#fMaterial'), liga: g('#fLiga'), localizacao: g('#fLocal'),
    nfEntrada: g('#fNf'), dataEntrada: g('#fData'), obs: g('#fObs'),
  };
  if (!base.clienteId) { aviso('Escolha o cliente.', 'erro'); return false; }
  if (!base.codigo || !base.descricao) { aviso('Preencha o código interno e a descrição.', 'erro'); return false; }
  const dup = [...S.modelos.values()].find(x => x.codigo && norm(x.codigo) === norm(base.codigo) && x.id !== id);
  if (dup) { aviso('Já existe um modelo com o código ' + base.codigo + '.', 'erro'); return false; }
  if (id) {
    gravarModelo(id, { ...base, atualizadoEm: agoraISO() });
    aviso('Modelo atualizado.');
    return;
  }
  // novo: primeiro as fotos (precisam terminar de subir)
  const fotos = [];
  el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
  try {
    for (const inp of el.querySelectorAll('input[type=file][data-tipo]')) {
      const ids = await enviarFotos([...inp.files], (i, n) => aviso(`Enviando foto ${i} de ${n}…`));
      ids.forEach(fid => fotos.push({ id: fid, tipo: inp.dataset.tipo }));
    }
  } catch (e) {
    console.error(e);
    aviso('Falha ao enviar foto: ' + e.message, 'erro');
    el.querySelectorAll('footer button').forEach(b => { b.disabled = false; });
    return false;
  }
  const mid = novoId(), data = base.dataEntrada || hoje();
  gravar(COL.modelos, S.modelos, mid, { ...base, status: 'na_empresa', fotos, ultimaMov: data, criadoEm: agoraISO() });
  novoEvento({ tipo: 'entrada', modeloId: mid, clienteId: base.clienteId, data, nf: base.nfEntrada, partes: base.partes, descricao: base.obs });
  aviso('Chegada registrada: ' + base.codigo);
  if (deNovo) setTimeout(() => janelaModelo(null, { clienteId: base.clienteId, nf: base.nfEntrada, data: base.dataEntrada }), 50);
  else ir(url('ficha_modelo', { id: mid }));   // espera a gravação antes de abrir
}

export async function adicionarFotos(mid, tipo, arquivos) {
  if (!arquivos.length) return;
  try {
    const ids = await enviarFotos(arquivos, (i, n) => aviso(`Enviando foto ${i} de ${n}…`));
    const m = S.modelos.get(mid);
    gravarModelo(mid, { fotos: [...((m && m.fotos) || []), ...ids.map(id => ({ id, tipo }))] });
    aviso(ids.length + ' foto(s) adicionada(s).');
  } catch (e) { console.error(e); aviso('Falha ao enviar foto: ' + e.message, 'erro'); }
}

export function janelaFoto(fid, mid) {
  const m = mid && S.modelos.get(mid);
  const f = m && (m.fotos || []).find(x => x.id === fid);
  janela({
    titulo: f ? 'Foto · ' + (TIPOS_FOTO[f.tipo || 'outra'] || '') : 'Foto', larga: true, soLeitura: !ED,
    html: `<img class="mc-grande" data-foto="${esc(fid)}" alt="Foto">
      ${f && ED ? `<label class="campo" style="margin-top:12px;max-width:240px">Tipo da foto<select class="ent" id="fTipo">${Object.entries(TIPOS_FOTO).map(([t, n]) => `<option value="${t}" ${(f.tipo || 'outra') === t ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}`,
    aoAbrir: el => {
      preencherFotos(el);
      const s = el.querySelector('#fTipo');
      if (s) s.onchange = () => { gravarModelo(mid, { fotos: (S.modelos.get(mid).fotos || []).map(x => (x.id === fid ? { ...x, tipo: s.value } : x)) }); aviso('Tipo da foto alterado.'); };
    },
    botoes: [
      ...(f ? [{ texto: icone('lixo') + ' Remover do modelo', cls: 'perigo', esquerda: true, acao: () => {
        if (!confirm('Remover esta foto do modelo?')) return false;
        gravarModelo(mid, { fotos: (S.modelos.get(mid).fotos || []).filter(x => x.id !== fid) });
        apagarFotos([fid]);
        aviso('Foto removida.');
      } }] : []),
      { texto: 'Baixar', livre: true, acao: async () => { const u = await urlFoto(fid); if (u) { const a = document.createElement('a'); a.href = u; a.download = (m ? m.codigo + ' ' : '') + 'foto.jpg'; a.click(); } return false; } },
      { texto: 'Fechar' },
    ],
  });
}

export function excluirModelo(id) {
  const m = S.modelos.get(id);
  if (!m || !confirm(`Excluir o modelo ${m.codigo} e todo o histórico dele? Essa ação não pode ser desfeita.`)) return;
  const evs = [...S.eventos.values()].filter(e => e.modeloId === id);
  const fotos = [...(m.fotos || []).map(f => f.id), ...evs.flatMap(e => e.fotos || [])];
  evs.forEach(e => apagarDoc(COL.eventos, S.eventos, e.id));
  apagarDoc(COL.modelos, S.modelos, id);
  apagarFotos(fotos);
  aviso('Modelo excluído.');
  ir(url('modelos'));   // espera a exclusão ser gravada antes de sair da página
}

// Janela: chegada / conserto / ocorrência
export function janelaEvento(tipo, mid, ev = null, pre = {}) {
  const m = S.modelos.get(mid) || {}; ev = ev || {};
  const t = hoje();
  const fotoIn = `<label class="campo l3">${ev.id ? 'Adicionar fotos' : 'Fotos'}<input class="ent" type="file" id="eFotos" accept="image/*" multiple></label>`;
  let corpo;
  if (tipo === 'entrada') corpo = `
    <label class="campo">Data de chegada *<input class="ent" type="date" id="eData" value="${esc(ev.data || t)}"></label>
    <label class="campo">NF de entrada<input class="ent" id="eNf" value="${esc(ev.nf || '')}"></label>
    <label class="campo">Partes recebidas<input class="ent" type="number" min="0" id="ePartes" value="${esc(ev.partes ?? m.partes ?? '')}"></label>
    <label class="campo l3">Condição na chegada / observações<textarea class="ent" id="eDesc">${esc(ev.descricao || '')}</textarea></label>`;
  else if (tipo === 'conserto') {
    const sit = pre.situacao || ev.situacao || 'aberto';
    corpo = `
    <label class="campo">Data de início *<input class="ent" type="date" id="eData" value="${esc(ev.data || t)}"></label>
    <label class="campo">Situação<select class="ent" id="eSit"><option value="aberto" ${sit === 'aberto' ? 'selected' : ''}>Em aberto</option><option value="concluido" ${sit === 'concluido' ? 'selected' : ''}>Concluído</option></select></label>
    <label class="campo">Data de conclusão<input class="ent" type="date" id="eFim" value="${esc(ev.dataFim || (sit === 'concluido' ? t : ''))}"></label>
    <label class="campo l3">Variação observada na peça / problema *<textarea class="ent" id="eDesc" placeholder="Ex.: espessura da flange 2 mm abaixo do desenho; marcação de macho deslocada">${esc(ev.descricao || '')}</textarea></label>
    <label class="campo l3">Conserto realizado<textarea class="ent" id="eSol" placeholder="O que foi feito no modelo">${esc(ev.solucao || '')}</textarea></label>
    <label class="campo l2">Responsável / modelaria<input class="ent" id="eResp" value="${esc(ev.responsavel || '')}"></label>`;
  } else corpo = `
    <label class="campo">Data *<input class="ent" type="date" id="eData" value="${esc(ev.data || t)}"></label>
    <label class="campo l2">Assunto *<input class="ent" id="eTit" value="${esc(ev.titulo || '')}" placeholder="Ex.: caixa de macho trincada"></label>
    <label class="campo l3">Descrição<textarea class="ent" id="eDesc">${esc(ev.descricao || '')}</textarea></label>`;
  janela({
    titulo: (ev.id ? 'Editar · ' : '') + (pre.situacao === 'concluido' ? 'Concluir conserto' : EV_TITULO[tipo]), larga: true,
    html: `<p class="mut" style="margin:0 0 12px">${esc(m.codigo || '')} · ${esc(m.descricao || '')}</p><div class="mc-form">${corpo}${fotoIn}</div>`,
    aoAbrir: el => { const foco = el.querySelector(pre.situacao ? '#eSol' : tipo === 'entrada' ? '#eNf' : tipo === 'conserto' ? '#eDesc' : '#eTit'); if (foco) setTimeout(() => foco.focus(), 40); },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', cls: 'pri', acao: el => salvarEvento(el, tipo, mid, ev.id) }],
  });
}
export async function salvarEvento(el, tipo, mid, eid) {
  const g = s => { const x = el.querySelector(s); return x ? x.value.trim() : ''; };
  const m = S.modelos.get(mid);
  const corpo = { tipo, modeloId: mid, clienteId: (m && m.clienteId) || '', data: g('#eData') || hoje() };
  if (tipo === 'entrada') { corpo.nf = g('#eNf'); corpo.partes = g('#ePartes') === '' ? null : Number(g('#ePartes')); corpo.descricao = g('#eDesc'); }
  if (tipo === 'conserto') {
    corpo.descricao = g('#eDesc'); corpo.solucao = g('#eSol'); corpo.responsavel = g('#eResp'); corpo.situacao = g('#eSit');
    corpo.dataFim = corpo.situacao === 'concluido' ? (g('#eFim') || hoje()) : '';
    if (!corpo.descricao) { aviso('Descreva a variação observada / o problema.', 'erro'); return false; }
  }
  if (tipo === 'ocorrencia') { corpo.titulo = g('#eTit'); corpo.descricao = g('#eDesc'); if (!corpo.titulo) { aviso('Preencha o assunto.', 'erro'); return false; } }
  let novas = [];
  const arqs = [...el.querySelector('#eFotos').files];
  if (arqs.length) {
    el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
    try { novas = await enviarFotos(arqs, (i, n) => aviso(`Enviando foto ${i} de ${n}…`)); }
    catch (e) { aviso('Falha ao enviar foto: ' + e.message, 'erro'); el.querySelectorAll('footer button').forEach(b => { b.disabled = false; }); return false; }
  }
  if (eid) { const velho = S.eventos.get(eid) || {}; atualizar(COL.eventos, S.eventos, eid, { ...corpo, fotos: [...(velho.fotos || []), ...novas] }); }
  else novoEvento({ ...corpo, fotos: novas });
  if (m) {
    const mud = { ultimaMov: maxData(m.ultimaMov, corpo.data) };
    if (tipo === 'entrada') { mud.status = 'na_empresa'; if (corpo.nf) mud.nfEntrada = corpo.nf; mud.dataEntrada = maxData(m.dataEntrada, corpo.data); if (corpo.partes != null) mud.partes = corpo.partes; }
    if (tipo === 'conserto') {
      if (corpo.situacao === 'aberto' && m.status !== 'devolvido') mud.status = 'em_conserto';
      else if (corpo.situacao === 'concluido' && m.status === 'em_conserto' && !consertosAbertos().some(e => e.modeloId === mid && e.id !== eid)) mud.status = 'na_empresa';
    }
    gravarModelo(mid, mud);
  }
  aviso(tipo === 'conserto' && corpo.situacao === 'concluido' ? 'Conserto concluído.' : 'Registro salvo.');
}
export function excluirEvento(eid) {
  const e = S.eventos.get(eid);
  if (!e || !confirm('Excluir este registro do histórico?')) return;
  apagarDoc(COL.eventos, S.eventos, eid);
  apagarFotos(e.fotos || []);
  const m = S.modelos.get(e.modeloId);
  if (e.tipo === 'conserto' && e.situacao === 'aberto' && m && m.status === 'em_conserto' && !consertosAbertos().some(x => x.modeloId === m.id)) gravarModelo(m.id, { status: 'na_empresa' });
  aviso('Registro excluído.');
}

export function janelaMover(mid) {
  const m = S.modelos.get(mid) || {};
  janela({
    titulo: 'Local e situação',
    html: `<div class="mc-form">
      <label class="campo">Situação<select class="ent" id="mSit">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${v.texto}</option>`).join('')}</select></label>
      <label class="campo l2">Localização<input class="ent" id="mLocal" value="${esc(m.localizacao || '')}"></label>
      <label class="campo">Data<input class="ent" type="date" id="mData" value="${hoje()}"></label>
      <label class="campo l2">Motivo / observação<input class="ent" id="mObs" placeholder="Ex.: levado para a moldagem"></label></div>`,
    aoAbrir: el => setTimeout(() => el.querySelector('#mLocal').focus(), 40),
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', cls: 'pri', acao: el => {
      const g = s => el.querySelector(s).value.trim();
      const st = g('#mSit'), local = g('#mLocal'), obs = g('#mObs'), data = g('#mData') || hoje();
      const mud = [];
      if (st !== m.status) mud.push(`Situação: ${(STATUS[m.status] || {}).texto || '—'} → ${STATUS[st].texto}`);
      if (local !== (m.localizacao || '')) mud.push(`Local: ${m.localizacao || '—'} → ${local || '—'}`);
      if (!mud.length && !obs) return;
      gravarModelo(mid, { status: st, localizacao: local, ultimaMov: maxData(m.ultimaMov, data) });
      novoEvento({ tipo: 'movimentacao', modeloId: mid, clienteId: m.clienteId || '', data, titulo: mud.join(' · '), descricao: obs });
      aviso('Modelo atualizado.');
    } }],
  });
}

export const modelosDisponiveis = cid => [...S.modelos.values()].filter(m => m.clienteId === cid && (m.status === 'na_empresa' || m.status === 'em_conserto')).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
export function emissorPadrao() {
  const u = banco.usuario();
  return banco.modo() === 'firebase' && u && u.nome ? u.nome.split(/\s+/)[0].replace(/^\w/, c => c.toUpperCase()) : E().emissorPadrao;
}
export function janelaDevolucao(pre) {
  const htmlItens = (cid, marcados) => {
    if (!cid) return '<p class="mut">Escolha o cliente para ver os modelos dele que estão na empresa.</p>';
    const ms = modelosDisponiveis(cid);
    if (!ms.length) return '<p class="mut">Nenhum modelo deste cliente está na empresa agora.</p>';
    return `<div class="campo-t">Modelos que serão devolvidos *</div><div class="mc-checks">${ms.map(m => `<label class="mc-check"><input type="checkbox" name="modelo" value="${esc(m.id)}" ${marcados.includes(m.id) ? 'checked' : ''}><span class="t"><b>${esc(m.codigo)}</b> · ${esc(m.descricao)}<span class="mut">${m.partes != null && m.partes !== '' ? ' · ' + esc(m.partes) + ' parte(s)' : ''}</span></span>${tagSit(m.status)}</label>`).join('')}</div>`;
  };
  const htmlFotos = ids => {
    if (!ids.length) return '';
    const fotos = [];
    ids.forEach((id, i) => { const m = S.modelos.get(id); ((m && m.fotos) || []).forEach(f => fotos.push({ f, item: i + 1, m })); });
    return `<div class="campo-t">Registro fotográfico no documento</div>${fotos.length ? `<div class="mc-escolha-fotos">${fotos.map(x => `<label><input type="checkbox" name="foto" value="${esc(x.f.id)}|${x.item}" checked><img data-foto="${esc(x.f.id)}" alt=""><span>Item ${x.item} · ${esc(x.m.codigo)} · ${TIPOS_FOTO[x.f.tipo || 'outra']}</span></label>`).join('')}</div>` : '<p class="mut">Os modelos escolhidos não têm fotos no cadastro.</p>'}
      <label class="campo" style="margin-top:10px">Anexar outras fotos agora (ex.: modelo embalado para a retirada)<input class="ent" type="file" id="dExtra" accept="image/*" multiple></label>`;
  };
  const marcados = el => [...el.querySelectorAll('input[name=modelo]:checked')].map(i => i.value);
  janela({
    titulo: 'Nova devolução de modelo', larga: true,
    html: `<div class="mc-form">
        <label class="campo l2">Cliente *<select class="ent" id="dCliente"><option value="">Selecione…</option>${opcoesClientes(pre.clienteId)}</select></label>
        <label class="campo">Data de entrega<input class="ent" type="date" id="dEntrega" value="${hoje()}"></label></div>
      <div id="dItens" style="margin:14px 0">${htmlItens(pre.clienteId, pre.modeloIds || [])}</div>
      <div class="mc-form">
        <label class="campo">NF de retorno<input class="ent" id="dNf" inputmode="numeric"></label>
        <label class="campo">OC<input class="ent" id="dOc"></label>
        <label class="campo">Emissor<input class="ent" id="dEmissor" value="${esc(emissorPadrao())}"></label>
        <label class="campo l3">Obs (aparece no documento)<input class="ent" id="dObs"></label></div>
      <div id="dFotos" style="margin-top:14px">${htmlFotos(pre.modeloIds || [])}</div>`,
    aoAbrir: el => {
      preencherFotos(el);
      el.addEventListener('change', e => {
        if (e.target.id === 'dCliente') { el.querySelector('#dItens').innerHTML = htmlItens(e.target.value, []); el.querySelector('#dFotos').innerHTML = ''; }
        else if (e.target.name === 'modelo') { el.querySelector('#dFotos').innerHTML = htmlFotos(marcados(el)); preencherFotos(el); }
      });
    },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Emitir documento', cls: 'pri', acao: async el => {
      const g = s => el.querySelector(s).value.trim();
      const ids = marcados(el), cid = g('#dCliente');
      if (!cid) { aviso('Escolha o cliente.', 'erro'); return false; }
      if (!ids.length) { aviso('Marque pelo menos um modelo para devolver.', 'erro'); return false; }
      const itens = ids.map(id => { const m = S.modelos.get(id) || {}; return { modeloId: id, codigo: m.codigo || '', descricao: m.descricao || '', referencia: m.referencia || '', partes: m.partes ?? '' }; });
      let fotos = [...el.querySelectorAll('input[name=foto]:checked')].map(i => { const [id, item] = i.value.split('|'); return { id, item: Number(item) || 0 }; });
      const ex = el.querySelector('#dExtra');
      if (ex && ex.files.length) {
        el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
        try { const up = await enviarFotos([...ex.files], (i, n) => aviso(`Enviando foto ${i} de ${n}…`)); fotos = fotos.concat(up.map(id => ({ id, item: 0 }))); }
        catch (e) { aviso('Falha ao enviar foto: ' + e.message, 'erro'); el.querySelectorAll('footer button').forEach(b => { b.disabled = false; }); return false; }
      }
      const did = novoId();
      const numero = proximoCodigo(prefixo('dev'), [...S.devolucoes.values()].map(d => d.numero));
      gravar(COL.devolucoes, S.devolucoes, did, {
        numero, clienteId: cid, itens, fotos, nf: g('#dNf'), oc: g('#dOc'), emissor: g('#dEmissor'), obs: g('#dObs'),
        dataEntrega: g('#dEntrega') || hoje(), dataEmissao: agoraISO(), status: 'emitida', retirada: {}, criadoEm: agoraISO(),
      });
      ids.forEach(id => gravarModelo(id, { status: 'separado', devolucaoId: did }));
      aviso('Documento ' + numero + ' emitido.');
      ir(url('devolucao', { id: did }));   // espera a gravação antes de abrir
    } }],
  });
}

export function janelaRetirada(id, editar) {
  const d = S.devolucoes.get(id) || {}, r = d.retirada || {};
  const v = (k, o = r) => esc(o[k] || '');
  janela({
    titulo: editar ? 'Editar documento ' + d.numero : 'Registrar retirada', larga: editar,
    html: `${editar ? `<div class="mc-form">
        <label class="campo">NF de retorno<input class="ent" id="rNfD" value="${v('nf', d)}"></label>
        <label class="campo">OC<input class="ent" id="rOc" value="${v('oc', d)}"></label>
        <label class="campo">Emissor<input class="ent" id="rEmissor" value="${v('emissor', d)}"></label>
        <label class="campo">Data de entrega<input class="ent" type="date" id="rEntrega" value="${v('dataEntrega', d)}"></label>
        <label class="campo l2">Obs (aparece no documento)<input class="ent" id="rObsD" value="${v('obs', d)}"></label></div>
        <div class="campo-t" style="margin-top:16px">Dados da retirada</div>`
      : `<p class="mut" style="margin-top:0">Ao confirmar, ${(d.itens || []).length} modelo(s) passam para “Devolvido” e o histórico de cada um registra a saída.</p>`}
      <div class="mc-form">
        <label class="campo l2">Nome de quem retirou${editar ? '' : ' *'}<input class="ent" id="rNome" value="${v('nome')}"></label>
        <label class="campo">Data da retirada<input class="ent" type="date" id="rData" value="${esc(r.data || (editar ? '' : hoje()))}"></label>
        <label class="campo">CPF<input class="ent" id="rCpf" value="${v('cpf')}" inputmode="numeric"></label>
        <label class="campo">RG<input class="ent" id="rRg" value="${v('rg')}"></label><span></span>
        <label class="campo">Veículo<input class="ent" id="rVeiculo" value="${v('veiculo')}" placeholder="Ex.: Fiat Strada branca"></label>
        <label class="campo">Placa<input class="ent" id="rPlaca" value="${v('placa')}" style="text-transform:uppercase"></label></div>`,
    aoAbrir: el => setTimeout(() => el.querySelector('#rNome').focus(), 40),
    botoes: [{ texto: 'Cancelar' }, { texto: editar ? 'Salvar' : 'Confirmar entrega', cls: 'pri', acao: el => {
      const g = s => el.querySelector(s).value.trim();
      const ret = { nome: g('#rNome'), cpf: g('#rCpf'), rg: g('#rRg'), data: g('#rData'), veiculo: g('#rVeiculo'), placa: g('#rPlaca').toUpperCase() };
      if (editar) {
        atualizar(COL.devolucoes, S.devolucoes, id, { nf: g('#rNfD'), oc: g('#rOc'), emissor: g('#rEmissor'), dataEntrega: g('#rEntrega'), obs: g('#rObsD'), retirada: ret });
        aviso('Documento atualizado.');
        return;
      }
      if (!ret.nome) { aviso('Preencha o nome de quem retirou.', 'erro'); return false; }
      if (!ret.data) ret.data = hoje();
      atualizar(COL.devolucoes, S.devolucoes, id, { retirada: ret, status: 'entregue', dataEntrega: ret.data });
      for (const it of d.itens || []) {
        const m = S.modelos.get(it.modeloId);
        if (!m) continue;
        gravarModelo(it.modeloId, { status: 'devolvido', ultimaMov: maxData(m.ultimaMov, ret.data) });
        novoEvento({ tipo: 'saida', modeloId: it.modeloId, clienteId: d.clienteId, data: ret.data, nf: d.nf || '', devolucaoId: id,
          titulo: 'Devolvido ao cliente · ' + d.numero, descricao: [ret.nome && 'Retirado por ' + ret.nome, ret.veiculo && 'veículo ' + ret.veiculo, ret.placa && 'placa ' + ret.placa].filter(Boolean).join(' · ') });
      }
      aviso('Entrega confirmada.');
    } }],
  });
}
export function cancelarDevolucao(id) {
  const d = S.devolucoes.get(id);
  if (!d || !confirm(`Cancelar a devolução ${d.numero}? Os modelos voltam para “Na empresa”.`)) return;
  atualizar(COL.devolucoes, S.devolucoes, id, { status: 'cancelada', canceladaEm: agoraISO() });
  for (const it of d.itens || []) {
    const m = S.modelos.get(it.modeloId);
    if (m && m.status === 'separado' && m.devolucaoId === id) gravarModelo(m.id, { status: 'na_empresa', devolucaoId: '' });
  }
  aviso('Devolução cancelada.');
}
export function excluirDevolucao(id) {
  const d = S.devolucoes.get(id);
  if (!d || !confirm(`Excluir o documento cancelado ${d.numero}?`)) return;
  // fotos anexadas só ao documento (as "outras fotos" da retirada) também saem
  const soDoc = (d.fotos || []).map(f => f.id).filter(fid => ![...S.modelos.values()].some(m => (m.fotos || []).some(x => x.id === fid)));
  apagarDoc(COL.devolucoes, S.devolucoes, id);
  apagarFotos(soDoc);
  aviso('Documento excluído.');
  ir(url('devolucoes'));   // espera a exclusão ser gravada antes de sair da página
}

// aoCriar(id): usado pelo "+ Novo" do cadastro do modelo
export function janelaCliente(c, aoCriar) {
  c = c || {};
  const v = k => esc(c[k] || '');
  const ms = c.id ? [...S.modelos.values()].filter(m => m.clienteId === c.id).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')) : [];
  janela({
    titulo: c.id ? c.nome || 'Cliente' : 'Novo cliente', larga: true, soLeitura: !ED,
    html: `<div class="mc-form">
      <label class="campo">Código<input class="ent" id="cCodigo" value="${v('codigo')}" placeholder="Ex.: 1000635"></label>
      <label class="campo l2">Nome / razão social *<input class="ent" id="cNome" value="${v('nome')}"></label>
      <label class="campo">CNPJ<input class="ent" id="cCnpj" value="${v('cnpj')}"></label>
      <label class="campo">Inscrição estadual<input class="ent" id="cIe" value="${v('ie')}"></label>
      <label class="campo">CEP<input class="ent" id="cCep" value="${v('cep')}" inputmode="numeric"></label>
      <label class="campo l2">Endereço<input class="ent" id="cEnd" value="${v('endereco')}"></label>
      <label class="campo">Bairro<input class="ent" id="cBairro" value="${v('bairro')}"></label>
      <label class="campo l2">Cidade<input class="ent" id="cCidade" value="${v('cidade')}"></label>
      <label class="campo">UF<input class="ent" id="cUf" value="${v('uf')}" maxlength="2" style="text-transform:uppercase"></label>
      <label class="campo">Telefone<input class="ent" id="cTel" value="${v('telefone')}"></label>
      <label class="campo">Fax/800 ou celular<input class="ent" id="cFax" value="${v('fax')}"></label>
      <label class="campo">E-mail<input class="ent" id="cEmail" type="email" value="${v('email')}"></label></div>
      ${c.id ? `<div class="campo-t" style="margin-top:18px">Modelos deste cliente (${ms.length})</div>
        ${ms.length ? `<ul class="mc-lista borda">${ms.map(m => `<li><a href="${url('ficha_modelo', { id: m.id })}" data-fecha><b>${esc(m.codigo)}</b> · ${esc(m.descricao)}</a>${tagSit(m.status)}</li>`).join('')}</ul>` : '<p class="mut">Nenhum modelo cadastrado para este cliente.</p>'}` : ''}`,
    aoAbrir: el => {
      el.querySelectorAll('[data-fecha]').forEach(a => a.addEventListener('click', () => el.closest('.fundo-modal').remove()));
      setTimeout(() => el.querySelector(c.id ? '#cCodigo' : '#cNome').focus(), 40);
    },
    botoes: [
      ...(c.id ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        const n = [...S.modelos.values()].filter(m => m.clienteId === c.id).length;
        if (n) { aviso(`Este cliente tem ${n} modelo(s) cadastrados. Exclua ou transfira os modelos antes.`, 'erro'); return false; }
        if (!confirm(`Excluir o cliente ${c.nome}?`)) return false;
        apagarDoc(COL.clientes, S.clientes, c.id);
        aviso('Cliente excluído.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const g = s => el.querySelector(s).value.trim();
        const corpo = { codigo: g('#cCodigo'), nome: g('#cNome'), cnpj: g('#cCnpj'), ie: g('#cIe'), cep: g('#cCep'), endereco: g('#cEnd'), bairro: g('#cBairro'),
          cidade: g('#cCidade'), uf: g('#cUf').toUpperCase(), telefone: g('#cTel'), fax: g('#cFax'), email: g('#cEmail') };
        if (!corpo.nome) { aviso('Preencha o nome do cliente.', 'erro'); return false; }
        if (corpo.codigo) {
          const dup = [...S.clientes.values()].find(x => x.id !== c.id && x.codigo && norm(x.codigo) === norm(corpo.codigo));
          if (dup) { aviso('O código ' + corpo.codigo + ' já é do cliente ' + dup.nome + '.', 'erro'); return false; }
        }
        if (c.id) { atualizar(COL.clientes, S.clientes, c.id, { ...corpo, atualizadoEm: agoraISO() }); aviso('Cliente atualizado.'); return; }
        const cid = novoId();
        gravar(COL.clientes, S.clientes, cid, { ...corpo, criadoEm: agoraISO() });
        aviso('Cliente cadastrado.');
        if (aoCriar) aoCriar(cid);
      } },
    ],
  });
}
