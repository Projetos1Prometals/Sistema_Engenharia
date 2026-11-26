// =====================================================================
//  modelos-clientes/mcli.js — módulo Modelos de clientes
//  Porte do app antigo "Controle de Modelos — T.M Gastão / PROMETALS"
//  (app-modelos-clientes/, só estudo). Mesmas telas e regras:
//  Painel, Modelos (ficha com fotos e histórico), Devoluções (documento A4),
//  Clientes, Importar/Exportar e Configurações. Mais: código do produto e a
//  página de consulta #/produto/<código> (a Instrução de Processo vai abrir).
//  Permissão: tela "modelosClientes" em Usuários e acessos.
// =====================================================================
import * as banco from '../comum/banco.js?v=1.7.3';
import { montar, definirTrilha, marcarMenu, aviso, janela, esc, fmtData, icone, hoje, podeEditar, podeVer, semAcesso, modoLeitura, baixarArquivo } from '../comum/casca.js?v=1.7.3';
import { empresa, htmlFolha, fmtDataHora, DECL_PADRAO, CHAVES_EMPRESA } from './folha.js?v=1.7.3';
import { TIPOS_FOTO, enviarFotos, preencherFotos, urlFoto, apagarFoto } from './fotos.js?v=1.7.3';
import { entrarInstrucao, ipsDeCliente, fotoDaIP, FOTOS_IP } from './instrucao.js?v=1.7.3';
import {
  CAMPOS_IMPORTACAO, autoMapear, paraData, textoCelula, arrumarCep, arrumarCnpj, separarTitulos,
  lerArquivoPlanilha, lerTextoColado, montarXlsx, norm, digitos,
} from './planilha.js?v=1.7.3';

export const COL = {
  clientes: 'eng_clientes', modelos: 'eng_mcli_modelos', eventos: 'eng_mcli_eventos', devolucoes: 'eng_mcli_devolucoes',
  config: 'eng_config',
};
const CFG_ID = 'modelosClientes';
const TELA = 'modelosClientes';

const STATUS = {
  na_empresa: { texto: 'Na empresa', cls: 'ok' },
  em_conserto: { texto: 'Em conserto', cls: 'alerta' },
  separado: { texto: 'Aguardando retirada', cls: 'info' },
  devolvido: { texto: 'Devolvido', cls: 'neutro' },
};
const DEV_STATUS = {
  emitida: { texto: 'Aguardando retirada', cls: 'info' },
  entregue: { texto: 'Entregue', cls: 'ok' },
  cancelada: { texto: 'Cancelada', cls: 'neutro' },
};
const EV = {
  entrada: { texto: 'Chegada', cor: 'var(--verde)' },
  conserto: { texto: 'Conserto', cor: 'var(--amar)' },
  ocorrencia: { texto: 'Ocorrência', cor: 'var(--lar)' },
  saida: { texto: 'Devolução ao cliente', cor: 'var(--az)' },
  movimentacao: { texto: 'Movimentação', cor: 'var(--mut)' },
};
const EV_TITULO = { entrada: 'Nova chegada do modelo', conserto: 'Conserto do modelo', ocorrencia: 'Ocorrência' };
const MATERIAIS = ['Madeira', 'Alumínio', 'Resina', 'Isopor (EPS)', 'Aço', 'Ferro fundido', 'Madeira + alumínio'];

// ---------------------------------------------------------------------
// Estado e dados
// ---------------------------------------------------------------------
const S = { clientes: new Map(), modelos: new Map(), devolucoes: new Map(), eventos: new Map(), config: null, chegou: {} };
const filtros = { modelos: { q: '', status: 'ativos', cliente: '' }, dev: { q: '', status: '' }, cli: { q: '' } };
const imp = { tipo: 'modelos', titulos: [], linhas: [], mapa: {}, nome: '', rodando: false, progresso: 0, resultado: null };
let ED = false;
let pagina = null;

await montar({ ativo: 'mcli-painel', trilha: ['Modelos de clientes'] });
const C = document.getElementById('conteudo');
C.innerHTML = '<div class="vazio">Carregando dados…</div>';

const E = () => empresa(S.config);
const cli = id => S.clientes.get(id) || null;
const nomeCli = id => (cli(id) || {}).nome || '—';
const rotuloCli = id => { const c = cli(id); return c ? (c.codigo ? c.codigo + ' · ' : '') + (c.nome || '') : '—'; };
const prefixo = k => (k === 'dev' ? E().prefixoDev || 'DEV-' : E().prefixoModelo || 'MOD-');
const autorDe = x => (x && x._por ? String(x._por).split('@')[0] : '');
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const agoraISO = () => new Date().toISOString();
const maxData = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
function diasDesde(s) {
  if (!s) return null;
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 86400000);
}
function proximoCodigo(pref, codigos) {
  let max = 0;
  const re = new RegExp('^' + pref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i');
  codigos.forEach(c => { const m = re.exec(String(c || '').trim()); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return pref + String(max + 1).padStart(4, '0');
}
const parados = () => [...S.modelos.values()].filter(m => m.status === 'na_empresa' && (diasDesde(m.ultimaMov || m.dataEntrada) ?? 0) > 365);
const consertosAbertos = () => [...S.eventos.values()].filter(e => e.tipo === 'conserto' && e.situacao === 'aberto');

// Gravação: o documento inteiro (banco.salvar substitui). Não esperamos a resposta: sem internet
// o Firebase guarda e envia depois. O mapa local é atualizado na hora para gravações seguidas.
const semMeta = o => { const { id, _em, _por, ...r } = o || {}; return r; };
function gravar(col, mapa, id, dados) {
  mapa.set(id, { ...dados, id });
  return banco.salvar(col, id, dados).catch(e => { console.error(e); aviso('Não foi possível salvar: ' + (e.code || e.message), 'erro'); });
}
const atualizar = (col, mapa, id, mud) => gravar(col, mapa, id, { ...semMeta(mapa.get(id)), ...mud });
function apagarDoc(col, mapa, id) {
  mapa.delete(id);
  return banco.apagar(col, id).catch(e => { console.error(e); aviso('Não foi possível apagar: ' + (e.code || e.message), 'erro'); });
}
const gravarModelo = (id, mud) => atualizar(COL.modelos, S.modelos, id, mud);
function novoEvento(ev) {
  const id = novoId();
  gravar(COL.eventos, S.eventos, id, { fotos: [], ...ev, criadoEm: agoraISO() });
  return id;
}
// Foto ainda usada por algum documento de devolução? (aí o arquivo não é apagado)
const fotoEmDocumento = id => [...S.devolucoes.values()].some(d => (d.fotos || []).some(f => f.id === id));
function apagarFotos(ids) { ids.filter(id => !fotoEmDocumento(id)).forEach(id => apagarFoto(id).catch(e => console.warn(e))); }

// ---------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------
function chegou(nome) {
  S.chegou[nome] = true;
  if (!['clientes', 'modelos', 'eventos', 'devolucoes'].every(k => S.chegou[k])) return;
  if (!pagina) rotear(); else if (!pagina.fixa) pagina.atualizar();
}
const paraMapa = (mapa, nome) => l => { mapa.clear(); l.forEach(x => mapa.set(x.id, x)); chegou(nome); };
function erroBanco(e) {
  const perm = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${perm
    ? 'Seu usuário não tem permissão para ver os modelos de clientes. Peça para a Engenharia liberar em Usuários e acessos.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}
if (!podeVer(TELA)) semAcesso(C);
else {
  ED = podeEditar(TELA);
  banco.ouvirColecao(COL.clientes, paraMapa(S.clientes, 'clientes'), erroBanco);
  banco.ouvirColecao(COL.modelos, paraMapa(S.modelos, 'modelos'), erroBanco);
  banco.ouvirColecao(COL.eventos, paraMapa(S.eventos, 'eventos'), erroBanco);
  banco.ouvirColecao(COL.devolucoes, paraMapa(S.devolucoes, 'devolucoes'), erroBanco);
  banco.ouvirDoc(COL.config, CFG_ID, d => { S.config = d; if (pagina && !pagina.fixa) pagina.atualizar(); }, () => {});
  window.addEventListener('hashchange', rotear);
}

// ---------------------------------------------------------------------
// Rotas: #/painel #/modelos #/modelo/<id> #/devolucoes #/devolucao/<id>
//        #/clientes #/planilha #/config #/produto[/<código do produto>]
// ---------------------------------------------------------------------
function rotear() {
  const h = (location.hash || '#/painel').slice(2).split('/');
  const arg = decodeURIComponent(h.slice(1).join('/'));
  window.scrollTo(0, 0);
  modoLeitura(!ED);
  const P = {
    painel: paginaPainel, modelos: paginaModelos, modelo: () => paginaModelo(arg), devolucoes: paginaDevolucoes,
    devolucao: () => paginaDevolucao(arg), clientes: paginaClientes, planilha: paginaPlanilha, config: paginaConfig,
    produto: () => paginaProduto(arg),
  };
  (P[h[0]] || paginaPainel)();
}
// Mostra a página e guarda como redesenhar quando os dados mudam (mantém o foco da busca)
function mostrar(menu, trilha, desenhar, fixa = false, depois = null) {
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

const tagSit = (st, mapa = STATUS) => { const s = mapa[st] || { texto: st || '—', cls: 'neutro' }; return `<span class="tag ${s.cls}">${esc(s.texto)}</span>`; };
const bt = (texto, acao, cls = '', attrs = '') => (ED ? `<button class="btn so-ed ${cls}" data-acao="${acao}" ${attrs}>${texto}</button>` : '');
const opcoesClientes = sel => [...S.clientes.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
  .map(c => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}${c.codigo ? ' (' + esc(c.codigo) + ')' : ''}</option>`).join('');

// ---------------------------------------------------------------------
// Ações (botões com data-acao, em qualquer lugar da página ou das janelas)
// ---------------------------------------------------------------------
const ACOES = {
  'novo-modelo': () => janelaModelo(null),
  'nova-devolucao': () => janelaDevolucao({}),
  'novo-cliente': () => janelaCliente(null),
  'abrir-cliente': t => janelaCliente(cli(t.dataset.id)),
  'ir': t => { location.hash = t.dataset.href; },
  'tile': t => { Object.assign(filtros.modelos, { q: '', cliente: '', status: t.dataset.v }); location.hash = '#/modelos'; },
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
  'imp-tipo': t => { imp.tipo = t.dataset.v; imp.mapa = autoMapear(imp.tipo, imp.titulos); imp.resultado = null; pagina.atualizar(); },
  'imp-colado': () => { const aoa = lerTextoColado((C.querySelector('#impColado') || {}).value); if (!aoa.length) return aviso('Cole as linhas da planilha (com a linha de títulos).', 'erro'); carregarImportacao(aoa, 'dados colados'); },
  'imp-rodar': () => rodarImportacao(),
  'imp-limpar': () => { Object.assign(imp, { titulos: [], linhas: [], mapa: {}, nome: '', resultado: null, progresso: 0 }); pagina.atualizar(); },
  'exp-xlsx': t => exportarXlsx(t),
  'exp-json': () => exportarJson(),
  'exp-modelo': t => exportarPlanilhaModelo(t),
  'ip-importar': () => janelaInstrucao(),
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-acao]');
  if (!t || !ACOES[t.dataset.acao]) return;
  e.preventDefault();
  ACOES[t.dataset.acao](t, e);
});
// Ligações que dependem da página desenhada (buscas, filtros, envio de fotos)
function ligar(raiz) {
  raiz.querySelectorAll('[data-filtro]').forEach(el => {
    const [grupo, campo] = el.dataset.filtro.split('.');
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { filtros[grupo][campo] = el.value; pagina.atualizar(); });
  });
  raiz.querySelectorAll('input[type=file][data-enviar-tipo]').forEach(inp => {
    inp.onchange = () => adicionarFotos(inp.dataset.modelo, inp.dataset.enviarTipo, [...inp.files]).finally(() => { inp.value = ''; });
  });
}

// ---------------------------------------------------------------------
// PAINEL
// ---------------------------------------------------------------------
function paginaPainel() {
  mostrar('mcli-painel', ['Painel'], () => {
    const ms = [...S.modelos.values()];
    const cnt = k => ms.filter(m => m.status === k).length;
    const par = parados().sort((a, b) => (a.ultimaMov || '').localeCompare(b.ultimaMov || ''));
    const aguard = [...S.devolucoes.values()].filter(d => d.status === 'emitida').sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));
    const abertos = consertosAbertos().sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const ultimos = eventosOrdenados([...S.eventos.values()]).slice(0, 12);
    const tile = (l, n, cls, v) => `<button class="kpi ${cls}" data-acao="tile" data-v="${v}"><b>${n}</b><span>${l}</span></button>`;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Painel</h1><p class="sub">Onde está cada modelo de cliente, o que está em conserto e o que falta devolver.</p></div>
        ${bt(icone('mais') + ' Registrar chegada', 'novo-modelo', 'pri')}${bt(icone('caminhao') + ' Nova devolução', 'nova-devolucao')}</div>
      ${!ms.length ? `<div class="faixa lar"><b>Nenhum modelo cadastrado ainda.</b> Registre a chegada de um modelo com a NF de entrada, ou traga a lista em <a href="#/planilha">Importar / Exportar</a>.</div>` : ''}
      <div class="kpis">
        ${tile('Na empresa', cnt('na_empresa'), 'verde', 'na_empresa')}
        ${tile('Em conserto', cnt('em_conserto'), 'amar', 'em_conserto')}
        ${tile('Aguardando retirada', cnt('separado'), '', 'separado')}
        ${tile('Devolvidos', cnt('devolvido'), 'roxo', 'devolvido')}
        ${tile('Parados há +1 ano', par.length, 'verm', 'parados')}
      </div>
      <div class="grade2">
        <div class="cartao"><h2>Consertos em aberto <span class="pilula">${abertos.length}</span></h2>
          ${abertos.length ? `<ul class="mc-lista">${abertos.slice(0, 8).map(e => { const m = S.modelos.get(e.modeloId) || {};
            return `<li data-acao="ir" data-href="#/modelo/${esc(e.modeloId)}"><div class="t"><div><b>${esc(m.codigo || '')}</b> · ${esc(m.descricao || 'Modelo removido')}</div><div class="mut peq">${esc(e.descricao || '')}</div></div><span class="mut peq">desde ${fmtData(e.data)}</span></li>`; }).join('')}</ul>`
            : '<p class="vazio">Nenhum conserto em aberto.</p>'}</div>
        <div class="cartao"><h2>Aguardando retirada <span class="pilula">${aguard.length}</span></h2>
          ${aguard.length ? `<ul class="mc-lista">${aguard.slice(0, 8).map(d => `<li data-acao="ir" data-href="#/devolucao/${esc(d.id)}"><div class="t"><div><b>${esc(d.numero)}</b> · ${esc(nomeCli(d.clienteId))}</div><div class="mut peq">${(d.itens || []).length} item(ns)${d.nf ? ' · NF ' + esc(d.nf) : ''}</div></div><span class="mut peq">entrega ${fmtData(d.dataEntrega)}</span></li>`).join('')}</ul>`
            : '<p class="vazio">Nenhum documento aguardando retirada.</p>'}</div>
      </div>
      <div class="cartao"><h2>Últimas movimentações</h2><div class="corpo">${ultimos.length ? linhaDoTempo(ultimos, true) : '<p class="vazio">Ainda não há movimentações.</p>'}</div></div>
      ${par.length ? `<div class="cartao"><h2>Parados há mais de 1 ano <span class="pilula">${par.length}</span></h2><ul class="mc-lista">${par.slice(0, 8).map(m => `<li data-acao="ir" data-href="#/modelo/${esc(m.id)}"><div class="t"><div><b>${esc(m.codigo)}</b> · ${esc(m.descricao)}</div><div class="mut peq">${esc(rotuloCli(m.clienteId))}${m.localizacao ? ' · ' + esc(m.localizacao) : ''}</div></div><span class="mut peq">última mov. ${fmtData(m.ultimaMov || m.dataEntrada)}</span></li>`).join('')}</ul></div>` : ''}`;
  });
}

// ---------------------------------------------------------------------
// MODELOS (lista)
// ---------------------------------------------------------------------
function filtrarModelos() {
  const f = filtros.modelos;
  let l = [...S.modelos.values()];
  if (f.status === 'ativos') l = l.filter(m => m.status !== 'devolvido');
  else if (f.status === 'parados') { const p = new Set(parados().map(m => m.id)); l = l.filter(m => p.has(m.id)); }
  else if (f.status !== 'todos') l = l.filter(m => m.status === f.status);
  if (f.cliente) l = l.filter(m => m.clienteId === f.cliente);
  if (f.q) {
    const q = norm(f.q);
    l = l.filter(m => { const c = cli(m.clienteId) || {}; return norm([m.codigo, m.codProduto, m.descricao, m.referencia, m.nfEntrada, m.localizacao, m.liga, c.nome, c.codigo].join(' ')).includes(q); });
  }
  return l.sort((a, b) => (b.ultimaMov || '').localeCompare(a.ultimaMov || '') || (a.codigo || '').localeCompare(b.codigo || ''));
}
function paginaModelos() {
  mostrar('mcli-modelos', ['Modelos'], () => {
    const f = filtros.modelos;
    const chips = [['ativos', 'Ativos'], ['na_empresa', 'Na empresa'], ['em_conserto', 'Em conserto'], ['separado', 'Aguard. retirada'], ['devolvido', 'Devolvidos'], ['parados', 'Parados +1 ano'], ['todos', 'Todos']];
    const l = filtrarModelos();
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Modelos</h1><p class="sub">Cada modelo com cliente, NF de entrada, localização, fotos e histórico.</p></div>
        <a class="btn" href="#/produto">${icone('busca')} Consulta por código do produto</a>${bt(icone('mais') + ' Registrar chegada', 'novo-modelo', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar código, código do produto, descrição, cliente, NF, local…" value="${esc(f.q)}" data-filtro="modelos.q" data-manter="mq"></label>
        <select class="ent" data-filtro="modelos.cliente" style="max-width:260px"><option value="">Todos os clientes</option>${opcoesClientes(f.cliente)}</select>
        <div class="fichas">${chips.map(([v, t]) => `<button class="ficha ${f.status === v ? 'sel' : ''}" data-acao="f-status" data-v="${v}">${t}</button>`).join('')}</div>
      </div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.modelos.size ? 'Nenhum modelo encontrado com esses filtros.' : 'Nenhum modelo cadastrado ainda. Use “Registrar chegada” ou importe uma planilha.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Código</th><th>Cód. produto</th><th>Descrição</th><th>Cliente</th><th class="cen">Partes</th><th>Local</th><th>NF entrada</th><th class="cen">Fotos</th><th>Situação</th><th>Última mov.</th></tr></thead><tbody>
        ${l.map(m => `<tr class="clic" data-acao="ir" data-href="#/modelo/${esc(m.id)}">
          <td class="num"><b>${esc(m.codigo)}</b></td><td class="num">${esc(m.codProduto || '')}</td>
          <td>${esc(m.descricao)}${m.referencia ? `<div class="mut peq">${esc(m.referencia)}</div>` : ''}</td>
          <td>${esc(nomeCli(m.clienteId))}</td><td class="cen">${esc(m.partes ?? '')}</td><td>${esc(m.localizacao || '')}</td><td>${esc(m.nfEntrada || '')}</td>
          <td class="cen mut">${(m.fotos || []).length || ''}</td><td>${tagSit(m.status)}</td><td class="mut">${fmtData(m.ultimaMov)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <p class="mut peq">${l.length} de ${S.modelos.size} modelo(s)</p>`}`;
  });
}

// ---------------------------------------------------------------------
// FICHA DO MODELO
// ---------------------------------------------------------------------
const eventosOrdenados = l => [...l].sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
const eventosDoModelo = id => eventosOrdenados([...S.eventos.values()].filter(e => e.modeloId === id));
const fato = (l, v) => `<div><dt>${l}</dt><dd>${v || '<span class="mut">—</span>'}</dd></div>`;

function htmlFotosPorTipo(m, editar) {
  const fotos = m.fotos || [];
  return `<div class="mc-fotos">${Object.entries(TIPOS_FOTO).map(([tipo, nome]) => {
    const fs = fotos.filter(f => (f.tipo || 'outra') === tipo);
    return `<div class="mc-foto-grupo"><div class="mc-foto-tit">${nome}${tipo === 'macho' ? ' <span class="mut">(opcional)</span>' : ''}</div>
      <div class="galeria">${fs.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f.id)}" data-modelo="${esc(m.id)}"><img data-foto="${esc(f.id)}" alt="${nome}"></button>`).join('')}
        ${editar ? `<label class="add-foto so-ed">${icone('camera')} Adicionar<input type="file" accept="image/*" ${tipo === 'outra' ? 'multiple' : ''} data-enviar-tipo="${tipo}" data-modelo="${esc(m.id)}"></label>` : ''}
        ${!fs.length && !editar ? '<span class="mut peq">Sem foto.</span>' : ''}</div></div>`;
  }).join('')}</div>`;
}

function paginaModelo(id) {
  const desenhar = () => {
    const m = S.modelos.get(id);
    if (!m) return `<div class="faixa verm">Este modelo não existe (pode ter sido excluído).</div><a class="btn" href="#/modelos">${icone('voltar')} Modelos</a>`;
    definirTrilha(['Modelos de clientes', 'Modelos', m.codigo || '']);
    const podeDevolver = m.status === 'na_empresa' || m.status === 'em_conserto';
    const dev = m.status === 'separado' && m.devolucaoId ? S.devolucoes.get(m.devolucaoId) : null;
    const evs = eventosDoModelo(id);
    return `
      <div class="cab"><div class="cresce"><div class="mc-cod">${esc(m.codigo)}${m.codProduto ? ` · produto <b>${esc(m.codProduto)}</b>` : ''}</div>
        <h1 class="titulo">${esc(m.descricao)}</h1><p class="sub">${esc(rotuloCli(m.clienteId))} · ${tagSit(m.status)}</p></div>
        <a class="btn" href="#/modelos">${icone('voltar')} Modelos</a>
        ${m.codProduto ? `<a class="btn" href="#/produto/${encodeURIComponent(m.codProduto)}">${icone('olho')} Página do produto</a>` : ''}</div>
      ${ED || dev ? `<div class="mc-acoes">
        ${bt('+ Conserto', 'ev-novo', '', `data-tipo="conserto" data-id="${esc(id)}"`)}
        ${bt('+ Ocorrência', 'ev-novo', '', `data-tipo="ocorrencia" data-id="${esc(id)}"`)}
        ${bt('+ Nova chegada', 'ev-novo', '', `data-tipo="entrada" data-id="${esc(id)}"`)}
        ${bt('Local / situação', 'mover', '', `data-id="${esc(id)}"`)}
        ${podeDevolver ? bt(icone('caminhao') + ' Devolver ao cliente', 'devolver', 'pri', `data-id="${esc(id)}"`) : ''}
        ${dev ? `<a class="btn pri" href="#/devolucao/${esc(dev.id)}">Ver documento ${esc(dev.numero)}</a>` : ''}
        <span class="cresce"></span>
        ${bt('Editar', 'editar-modelo', '', `data-id="${esc(id)}"`)}
        ${bt(icone('lixo') + ' Excluir', 'excluir-modelo', 'perigo', `data-id="${esc(id)}"`)}</div>` : ''}
      <div class="cartao"><div class="corpo"><dl class="mc-fatos">
        ${fato('Código do produto', esc(m.codProduto))}${m.ip ? fato('Instrução de Processo', 'IP ' + esc(m.ip)) : ''}${fato('Modelo / referência', esc(m.referencia))}
        ${fato('Total de partes', esc(m.partes ?? ''))}${fato('Material do modelo', esc(m.material))}
        ${fato('Liga da peça', esc(m.liga))}${fato('Localização', esc(m.localizacao))}
        ${fato('NF de entrada', esc(m.nfEntrada))}${fato('Chegada', fmtData(m.dataEntrada))}
        ${fato('Última movimentação', fmtData(m.ultimaMov))}
        ${m.obs ? `<div style="grid-column:1/-1"><dt>Observações</dt><dd style="white-space:pre-wrap">${esc(m.obs)}</dd></div>` : ''}
      </dl></div></div>
      <div class="cartao"><h2>${icone('camera')} Fotos (${(m.fotos || []).length})</h2><div class="corpo">${htmlFotosPorTipo(m, ED)}</div></div>
      <div class="cartao"><h2>Histórico</h2><div class="corpo">${evs.length ? linhaDoTempo(evs, false) : '<p class="vazio">Sem registros ainda.</p>'}</div></div>`;
  };
  mostrar('mcli-modelos', ['Modelos'], desenhar);
}

function linhaDoTempo(evs, mostrarModelo) {
  return `<ul class="tl">${evs.map(e => {
    const t = EV[e.tipo] || EV.movimentacao, m = S.modelos.get(e.modeloId);
    const w = ED && !mostrarModelo;
    const sit = e.tipo === 'conserto' ? (e.situacao === 'aberto' ? '<span class="tag alerta">Em aberto</span>' : `<span class="tag ok">Concluído${e.dataFim ? ' em ' + fmtData(e.dataFim) : ''}</span>`) : '';
    const fotos = (e.fotos || []).length ? `<div class="galeria">${e.fotos.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f)}"><img data-foto="${esc(f)}" alt=""></button>`).join('')}</div>` : '';
    const dev = e.devolucaoId && S.devolucoes.get(e.devolucaoId);
    return `<li class="ev" style="--c:${t.cor}"><div class="ev-ponto"></div><div>
      <div class="ev-cab"><b>${t.texto}</b>${sit}<span class="mut">${fmtData(e.data)}</span>${e.nf ? `<span class="pilula">NF ${esc(e.nf)}</span>` : ''}${e.partes != null && e.partes !== '' && e.tipo === 'entrada' ? `<span class="pilula">${esc(e.partes)} parte(s)</span>` : ''}</div>
      ${mostrarModelo ? `<a class="ev-modelo" href="#/modelo/${esc(e.modeloId)}">${m ? esc(m.codigo) + ' · ' + esc(m.descricao) : 'Modelo removido'}</a>` : ''}
      ${e.titulo ? `<div class="ev-txt">${esc(e.titulo)}</div>` : ''}
      ${e.descricao ? `<div class="ev-txt">${e.tipo === 'conserto' ? '<span class="mut">Variação observada: </span>' : ''}${esc(e.descricao)}</div>` : ''}
      ${e.solucao ? `<div class="ev-txt"><span class="mut">Conserto realizado: </span>${esc(e.solucao)}</div>` : ''}
      ${e.responsavel ? `<div class="ev-txt mut peq">Responsável: ${esc(e.responsavel)}</div>` : ''}
      ${fotos}
      <div class="mut peq" style="margin-top:4px">${autorDe(e) ? 'por ' + esc(autorDe(e)) + ' · ' : ''}${fmtDataHora(e.criadoEm)}</div>
      ${w || (dev && !mostrarModelo) ? `<div class="ev-ferr">
        ${dev && !mostrarModelo ? `<a class="btn peq" href="#/devolucao/${esc(dev.id)}">Documento ${esc(dev.numero)}</a>` : ''}
        ${w && e.tipo === 'conserto' && e.situacao === 'aberto' ? bt('Concluir conserto', 'ev-concluir', 'peq pri', `data-id="${esc(e.id)}"`) : ''}
        ${w && ['entrada', 'conserto', 'ocorrencia'].includes(e.tipo) ? bt('Editar', 'ev-editar', 'peq', `data-id="${esc(e.id)}"`) : ''}
        ${w ? bt('Excluir', 'ev-excluir', 'peq perigo', `data-id="${esc(e.id)}"`) : ''}</div>` : ''}
    </div></li>`;
  }).join('')}</ul>`;
}

// Janela: cadastro / edição do modelo
function janelaModelo(m, pre = {}) {
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
async function salvarModelo(el, id, deNovo) {
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
  else location.hash = '#/modelo/' + mid;
}

async function adicionarFotos(mid, tipo, arquivos) {
  if (!arquivos.length) return;
  try {
    const ids = await enviarFotos(arquivos, (i, n) => aviso(`Enviando foto ${i} de ${n}…`));
    const m = S.modelos.get(mid);
    gravarModelo(mid, { fotos: [...((m && m.fotos) || []), ...ids.map(id => ({ id, tipo }))] });
    aviso(ids.length + ' foto(s) adicionada(s).');
  } catch (e) { console.error(e); aviso('Falha ao enviar foto: ' + e.message, 'erro'); }
}

function janelaFoto(fid, mid) {
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

function excluirModelo(id) {
  const m = S.modelos.get(id);
  if (!m || !confirm(`Excluir o modelo ${m.codigo} e todo o histórico dele? Essa ação não pode ser desfeita.`)) return;
  const evs = [...S.eventos.values()].filter(e => e.modeloId === id);
  const fotos = [...(m.fotos || []).map(f => f.id), ...evs.flatMap(e => e.fotos || [])];
  evs.forEach(e => apagarDoc(COL.eventos, S.eventos, e.id));
  apagarDoc(COL.modelos, S.modelos, id);
  apagarFotos(fotos);
  aviso('Modelo excluído.');
  location.hash = '#/modelos';
}

// Janela: chegada / conserto / ocorrência
function janelaEvento(tipo, mid, ev = null, pre = {}) {
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
async function salvarEvento(el, tipo, mid, eid) {
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
function excluirEvento(eid) {
  const e = S.eventos.get(eid);
  if (!e || !confirm('Excluir este registro do histórico?')) return;
  apagarDoc(COL.eventos, S.eventos, eid);
  apagarFotos(e.fotos || []);
  const m = S.modelos.get(e.modeloId);
  if (e.tipo === 'conserto' && e.situacao === 'aberto' && m && m.status === 'em_conserto' && !consertosAbertos().some(x => x.modeloId === m.id)) gravarModelo(m.id, { status: 'na_empresa' });
  aviso('Registro excluído.');
}

function janelaMover(mid) {
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

// ---------------------------------------------------------------------
// DEVOLUÇÕES
// ---------------------------------------------------------------------
function paginaDevolucoes() {
  mostrar('mcli-devolucoes', ['Devoluções'], () => {
    const f = filtros.dev;
    const chips = [['', 'Todas'], ['emitida', 'Aguardando retirada'], ['entregue', 'Entregues'], ['cancelada', 'Canceladas']];
    let l = [...S.devolucoes.values()];
    if (f.status) l = l.filter(d => d.status === f.status);
    if (f.q) { const q = norm(f.q); l = l.filter(d => norm([d.numero, d.nf, d.oc, nomeCli(d.clienteId), ...(d.itens || []).map(i => i.descricao + ' ' + i.codigo)].join(' ')).includes(q)); }
    l.sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Devoluções</h1><p class="sub">Documentos de devolução de modelo ao cliente, com registro fotográfico e declaração de retirada.</p></div>
        ${bt(icone('mais') + ' Nova devolução', 'nova-devolucao', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar nº, cliente, NF, OC…" value="${esc(f.q)}" data-filtro="dev.q" data-manter="dq"></label>
        <div class="fichas">${chips.map(([v, t]) => `<button class="ficha ${f.status === v ? 'sel' : ''}" data-acao="fd-status" data-v="${v}">${t}</button>`).join('')}</div>
      </div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.devolucoes.size ? 'Nenhum documento com esses filtros.' : 'Nenhuma devolução emitida ainda. Abra um modelo e clique em “Devolver ao cliente”, ou use “Nova devolução”.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Nº</th><th>Cliente</th><th>Itens</th><th>NF</th><th>OC</th><th>Emissão</th><th>Entrega</th><th>Situação</th></tr></thead><tbody>
        ${l.map(d => `<tr class="clic" data-acao="ir" data-href="#/devolucao/${esc(d.id)}"><td class="num"><b>${esc(d.numero)}</b></td><td>${esc(nomeCli(d.clienteId))}</td>
          <td>${(d.itens || []).map(i => esc(i.codigo || i.descricao)).join(', ')}</td><td>${esc(d.nf || '')}</td><td>${esc(d.oc || '')}</td>
          <td class="mut">${fmtDataHora(d.dataEmissao)}</td><td>${fmtData(d.dataEntrega)}</td><td>${tagSit(d.status, DEV_STATUS)}</td></tr>`).join('')}
      </tbody></table></div></div><p class="mut peq">${l.length} documento(s)</p>`}`;
  });
}

const modelosDisponiveis = cid => [...S.modelos.values()].filter(m => m.clienteId === cid && (m.status === 'na_empresa' || m.status === 'em_conserto')).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
function emissorPadrao() {
  const u = banco.usuario();
  return banco.modo() === 'firebase' && u && u.nome ? u.nome.split(/\s+/)[0].replace(/^\w/, c => c.toUpperCase()) : E().emissorPadrao;
}
function janelaDevolucao(pre) {
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
      location.hash = '#/devolucao/' + did;
    } }],
  });
}

function paginaDevolucao(id) {
  mostrar('mcli-devolucoes', ['Devoluções'], () => {
    const d = S.devolucoes.get(id);
    if (!d) return `<div class="faixa verm">Este documento não existe mais.</div><a class="btn" href="#/devolucoes">${icone('voltar')} Devoluções</a>`;
    definirTrilha(['Modelos de clientes', 'Devoluções', d.numero]);
    const r = d.retirada || {}, c = cli(d.clienteId) || {};
    return `<div class="dev-info">
      <div class="cab"><div class="cresce"><div class="mc-cod">${esc(d.numero)}</div><h1 class="titulo">${esc(c.nome || 'Cliente')}</h1>
        <p class="sub">${(d.itens || []).length} item(ns)${d.nf ? ' · NF ' + esc(d.nf) : ''} · emitido em ${fmtDataHora(d.dataEmissao)}${d.emissor ? ' por ' + esc(d.emissor) : ''} · ${tagSit(d.status, DEV_STATUS)}</p></div>
        <a class="btn" href="#/devolucoes">${icone('voltar')} Devoluções</a></div>
      <div class="mc-acoes">
        <button class="btn pri" data-acao="dev-imprimir">${icone('impressora')} Imprimir / PDF</button>
        ${d.status === 'emitida' ? bt('Registrar retirada', 'dev-retirada', '', `data-id="${esc(id)}"`) : ''}
        ${d.status !== 'cancelada' ? bt('Editar dados', 'dev-editar', '', `data-id="${esc(id)}"`) : ''}
        <span class="cresce"></span>
        ${d.status === 'emitida' ? bt('Cancelar devolução', 'dev-cancelar', 'perigo', `data-id="${esc(id)}"`) : ''}
        ${d.status === 'cancelada' ? bt(icone('lixo') + ' Excluir', 'dev-excluir', 'perigo', `data-id="${esc(id)}"`) : ''}</div>
      ${d.status === 'emitida' ? '<div class="faixa">Imprima (Ctrl+P) para o cliente assinar na retirada. Os campos em branco da declaração saem para preencher à mão; se preferir, registre a retirada antes de imprimir e eles saem preenchidos.</div>' : ''}
      ${d.status === 'entregue' && r.nome ? `<div class="faixa">Retirado por <b>${esc(r.nome)}</b>${r.cpf ? ' · CPF ' + esc(r.cpf) : ''}${r.veiculo ? ' · ' + esc(r.veiculo) : ''}${r.placa ? ' · placa ' + esc(r.placa) : ''} em ${fmtData(r.data)}.</div>` : ''}
      <div class="cartao"><h2>Itens</h2><ul class="mc-lista">${(d.itens || []).map((it, i) => `<li data-acao="ir" data-href="#/modelo/${esc(it.modeloId)}"><span class="pilula">${i + 1}</span><div class="t"><b>${esc(it.codigo)}</b> · ${esc(it.descricao)}</div><span class="mut peq">${esc(it.partes)} parte(s)</span></li>`).join('')}</ul></div>
      <h2 class="mc-sec">Documento</h2></div>
      <div class="folha-wrap">${htmlFolha(d, E(), c)}</div>`;
  });
}
function janelaRetirada(id, editar) {
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
function cancelarDevolucao(id) {
  const d = S.devolucoes.get(id);
  if (!d || !confirm(`Cancelar a devolução ${d.numero}? Os modelos voltam para “Na empresa”.`)) return;
  atualizar(COL.devolucoes, S.devolucoes, id, { status: 'cancelada', canceladaEm: agoraISO() });
  for (const it of d.itens || []) {
    const m = S.modelos.get(it.modeloId);
    if (m && m.status === 'separado' && m.devolucaoId === id) gravarModelo(m.id, { status: 'na_empresa', devolucaoId: '' });
  }
  aviso('Devolução cancelada.');
}
function excluirDevolucao(id) {
  const d = S.devolucoes.get(id);
  if (!d || !confirm(`Excluir o documento cancelado ${d.numero}?`)) return;
  // fotos anexadas só ao documento (as "outras fotos" da retirada) também saem
  const soDoc = (d.fotos || []).map(f => f.id).filter(fid => ![...S.modelos.values()].some(m => (m.fotos || []).some(x => x.id === fid)));
  apagarDoc(COL.devolucoes, S.devolucoes, id);
  apagarFotos(soDoc);
  aviso('Documento excluído.');
  location.hash = '#/devolucoes';
}

// ---------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------
function paginaClientes() {
  mostrar('mcli-clientes', ['Clientes'], () => {
    const f = filtros.cli;
    let l = [...S.clientes.values()];
    if (f.q) { const q = norm(f.q); l = l.filter(c => norm([c.nome, c.codigo, c.cnpj, c.cidade].join(' ')).includes(q) || (digitos(f.q).length > 3 && digitos(c.cnpj).includes(digitos(f.q)))); }
    l.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    const ms = [...S.modelos.values()];
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Clientes</h1><p class="sub">Dados que saem no campo “ID Cliente” do documento de devolução.</p></div>
        ${bt(icone('mais') + ' Novo cliente', 'novo-cliente', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros"><label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar nome, código, CNPJ, cidade…" value="${esc(f.q)}" data-filtro="cli.q" data-manter="cq"></label></div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.clientes.size ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado. Cadastre aqui ou importe a lista em Importar / Exportar.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Código</th><th>Nome</th><th>Cidade</th><th>CNPJ</th><th class="cen">Na empresa</th><th class="cen">Total de modelos</th></tr></thead><tbody>
        ${l.map(c => { const mc = ms.filter(m => m.clienteId === c.id); return `<tr class="clic" data-acao="abrir-cliente" data-id="${esc(c.id)}"><td class="num">${esc(c.codigo || '')}</td><td><b>${esc(c.nome)}</b></td><td>${esc([c.cidade, c.uf].filter(Boolean).join('/'))}</td><td class="num">${esc(c.cnpj || '')}</td><td class="cen">${mc.filter(m => m.status !== 'devolvido').length}</td><td class="cen">${mc.length}</td></tr>`; }).join('')}
      </tbody></table></div></div><p class="mut peq">${l.length} cliente(s)</p>`}`;
  });
}
// aoCriar(id): usado pelo "+ Novo" do cadastro do modelo
function janelaCliente(c, aoCriar) {
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
        ${ms.length ? `<ul class="mc-lista borda">${ms.map(m => `<li><a href="#/modelo/${esc(m.id)}" data-fecha><b>${esc(m.codigo)}</b> · ${esc(m.descricao)}</a>${tagSit(m.status)}</li>`).join('')}</ul>` : '<p class="mut">Nenhum modelo cadastrado para este cliente.</p>'}` : ''}`,
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

// ---------------------------------------------------------------------
// IMPORTAR / EXPORTAR
// ---------------------------------------------------------------------
function carregarImportacao(aoa, nome) {
  const r = separarTitulos(aoa);
  if (!r) { aviso('Não encontrei uma linha de títulos com pelo menos duas colunas.', 'erro'); return; }
  Object.assign(imp, { titulos: r.titulos, linhas: r.linhas, nome, mapa: autoMapear(imp.tipo, r.titulos), resultado: null, progresso: 0 });
  pagina.atualizar();
}
function paginaPlanilha() {
  mostrar('mcli-planilha', ['Importar / Exportar'], () => {
    const campos = CAMPOS_IMPORTACAO[imp.tipo], tem = imp.linhas.length > 0;
    const opc = k => '<option value="">— não importar —</option>' + imp.titulos.map((h, i) => `<option value="${i}" ${imp.mapa[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const fs = campos.filter(f => imp.mapa[f.k] != null);
    const res = imp.resultado;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Importar / Exportar</h1><p class="sub">Traga clientes e modelos por planilha (Excel ou CSV) e leve os dados daqui para fora.</p></div></div>
      ${ED ? `<div class="cartao so-ed"><h2>1 · O que você vai importar</h2><div class="corpo">
        <div class="fichas"><button class="ficha ${imp.tipo === 'modelos' ? 'sel' : ''}" data-acao="imp-tipo" data-v="modelos">Modelos + NF de entrada</button><button class="ficha ${imp.tipo === 'clientes' ? 'sel' : ''}" data-acao="imp-tipo" data-v="clientes">Clientes</button></div>
        <p class="mut peq">${imp.tipo === 'modelos' ? 'Cada linha vira um modelo “Na empresa”, com a chegada registrada no histórico. Clientes que ainda não existem são criados pelo nome/código. Modelo com código que já existe é atualizado.' : 'Clientes já cadastrados são atualizados pelo código, CNPJ ou nome; os outros são criados.'}</p>
        <div class="mc-form" style="margin-top:12px">
          <label class="campo">Arquivo Excel ou CSV<input class="ent" type="file" id="impArq" accept=".xlsx,.xls,.xlsm,.csv,.ods,.txt"></label>
          <label class="campo l2">ou cole aqui as linhas copiadas do Excel (com a linha de títulos)<textarea class="ent" id="impColado" rows="3" placeholder="Código do cliente&#9;Cliente&#9;Descrição&#9;Total de partes&#9;NF de entrada …"></textarea></label></div>
        <div class="mc-acoes" style="margin-top:10px"><button class="btn" data-acao="imp-colado">Ler dados colados</button><button class="btn" data-acao="exp-modelo">${icone('baixar')} Baixar planilha modelo para importação</button></div>
      </div></div>
      ${tem ? `<div class="cartao so-ed"><h2>2 · Confira as colunas</h2><div class="corpo">
        <p class="mut peq" style="margin-top:0">${esc(imp.nome)} · ${imp.linhas.length} linha(s). As colunas foram associadas pelos títulos; ajuste o que estiver errado.</p>
        <div class="mc-form">${campos.map(f => `<label class="campo">${esc(f.label)}${f.req ? ' *' : ''}<select class="ent" data-imp-mapa="${f.k}">${opc(f.k)}</select></label>`).join('')}</div>
        ${fs.length ? `<div class="tab-wrap" style="margin-top:12px"><table class="tab"><thead><tr>${fs.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${imp.linhas.slice(0, 5).map(r => `<tr>${fs.map(f => `<td>${esc(f.k === 'dataEntrada' ? fmtData(paraData(r[imp.mapa[f.k]])) : textoCelula(r[imp.mapa[f.k]]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      </div></div>
      <div class="cartao so-ed"><h2>3 · Importar</h2><div class="corpo">
        ${res ? `<p style="margin-top:0"><b>Pronto.</b> ${res.criados} criado(s), ${res.atualizados} atualizado(s)${res.clientesCriados ? `, ${res.clientesCriados} cliente(s) novo(s)` : ''}${res.ignorados ? `, ${res.ignorados} linha(s) sem ${imp.tipo === 'modelos' ? 'descrição' : 'nome'} ignorada(s)` : ''}.</p>` : ''}
        <div class="mc-acoes"><button class="btn pri" data-acao="imp-rodar" ${imp.rodando ? 'disabled' : ''}>${imp.rodando ? 'Importando…' : `Importar ${imp.linhas.length} linha(s)`}</button><button class="btn" data-acao="imp-limpar" ${imp.rodando ? 'disabled' : ''}>Limpar</button></div>
      </div></div>` : ''}` : ''}
      ${ED ? `<div class="cartao so-ed"><h2>Da Instrução de Processo</h2><div class="corpo">
        <p class="mut" style="margin-top:0">Traz as IPs com <b>Destino do molde = Retorno para o cliente</b>: cliente, código do produto, descrição, liga e as fotos
          (caixa frente, caixa traseira e macho). Pode rodar de novo: IP já trazida não é duplicada, só completa o que estiver em branco aqui. Nada é mudado na Instrução de Processo.</p>
        <div class="mc-acoes"><button class="btn" data-acao="ip-importar">${icone('baixar')} Importar da Instrução de Processo…</button></div>
      </div></div>` : ''}
      <div class="cartao"><h2>Exportar</h2><div class="corpo">
        <p class="mut" style="margin-top:0">Planilha com modelos, clientes, devoluções e histórico, ou uma cópia completa em JSON.</p>
        <div class="mc-acoes"><button class="btn" data-acao="exp-xlsx">${icone('baixar')} Planilha completa (.xlsx)</button><button class="btn" data-acao="exp-json">${icone('baixar')} Cópia de segurança (.json)</button></div>
      </div></div>`;
  }, true);
}
C.addEventListener('change', e => {
  if (!location.hash.startsWith('#/planilha')) return;
  const t = e.target;
  if (t.id === 'impArq' && t.files[0]) {
    const f = t.files[0];
    lerArquivoPlanilha(f).then(aoa => carregarImportacao(aoa, f.name)).catch(er => aviso('Não consegui ler o arquivo: ' + (er.message || er), 'erro'));
  } else if (t.dataset.impMapa) {
    imp.mapa[t.dataset.impMapa] = t.value === '' ? null : Number(t.value);
    imp.resultado = null;
    pagina.atualizar();
  }
});
async function rodarImportacao() {
  if (!imp.linhas.length || imp.rodando) return;
  for (const f of CAMPOS_IMPORTACAO[imp.tipo].filter(x => x.req)) if (imp.mapa[f.k] == null) { aviso(`Escolha a coluna de “${f.label}”.`, 'erro'); return; }
  imp.rodando = true; imp.resultado = null; pagina.atualizar();
  const res = { criados: 0, atualizados: 0, ignorados: 0, clientesCriados: 0 };
  const ops = [];
  const clientes = new Map([...S.clientes].map(([k, v]) => [k, { ...v }]));
  const porCod = new Map(), porNome = new Map(), porCnpj = new Map();
  const indexar = (id, c) => { if (c.codigo) porCod.set(norm(c.codigo), id); if (c.nome) porNome.set(norm(c.nome), id); if (digitos(c.cnpj)) porCnpj.set(digitos(c.cnpj), id); };
  clientes.forEach((c, id) => indexar(id, c));
  const modPorCod = new Map([...S.modelos.values()].filter(m => m.codigo).map(m => [norm(m.codigo), m.id]));
  const codigos = [...S.modelos.values()].map(m => m.codigo);
  const naoVazio = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
  const agora = agoraISO();
  for (const row of imp.linhas) {
    const v = k => (imp.mapa[k] == null ? '' : textoCelula(row[imp.mapa[k]]));
    if (imp.tipo === 'clientes') {
      const corpo = { codigo: v('codigo'), nome: v('nome'), cnpj: arrumarCnpj(v('cnpj')), ie: v('ie'), endereco: v('endereco'), bairro: v('bairro'), cidade: v('cidade'),
        uf: v('uf').toUpperCase().slice(0, 2), cep: arrumarCep(v('cep')), telefone: v('telefone'), fax: v('fax'), email: v('email') };
      if (!corpo.nome) { res.ignorados++; continue; }
      const ex = (corpo.codigo && porCod.get(norm(corpo.codigo))) || (digitos(corpo.cnpj) && porCnpj.get(digitos(corpo.cnpj))) || porNome.get(norm(corpo.nome));
      if (ex) { const d = { ...semMeta(clientes.get(ex)), ...naoVazio(corpo), atualizadoEm: agora }; clientes.set(ex, d); ops.push({ col: COL.clientes, id: ex, dados: d }); res.atualizados++; }
      else { const id = novoId(); const d = { ...corpo, criadoEm: agora, origem: 'importacao' }; clientes.set(id, d); indexar(id, d); ops.push({ col: COL.clientes, id, dados: d }); res.criados++; }
    } else {
      const desc = v('descricao');
      if (!desc) { res.ignorados++; continue; }
      const cc = v('clienteCodigo'), cn = v('clienteNome');
      let cid = (cc && porCod.get(norm(cc))) || (cn && porNome.get(norm(cn))) || '';
      if (!cid && (cc || cn)) { cid = novoId(); const c = { codigo: cc, nome: cn || 'Cliente ' + cc, criadoEm: agora, origem: 'importacao' }; clientes.set(cid, c); indexar(cid, c); ops.push({ col: COL.clientes, id: cid, dados: c }); res.clientesCriados++; }
      const pn = parseInt(digitos(v('partes')), 10);
      const corpo = { descricao: desc, codProduto: v('codProduto'), referencia: v('referencia'), partes: isNaN(pn) ? null : pn, material: v('material'), liga: v('liga'), localizacao: v('localizacao'),
        nfEntrada: v('nfEntrada'), dataEntrada: imp.mapa.dataEntrada == null ? '' : paraData(row[imp.mapa.dataEntrada]), obs: v('obs') };
      if (cid) corpo.clienteId = cid;
      const cod = v('codigo'), ex = cod && modPorCod.get(norm(cod));
      if (ex) { ops.push({ col: COL.modelos, id: ex, dados: { ...semMeta(S.modelos.get(ex)), ...naoVazio(corpo), atualizadoEm: agora } }); res.atualizados++; }
      else {
        const id = novoId(), codigo = cod || proximoCodigo(prefixo('modelo'), codigos);
        codigos.push(codigo); modPorCod.set(norm(codigo), id);
        const data = corpo.dataEntrada || hoje();
        ops.push({ col: COL.modelos, id, dados: { ...corpo, clienteId: cid, codigo, status: 'na_empresa', fotos: [], ultimaMov: data, criadoEm: agora, origem: 'importacao' } });
        ops.push({ col: COL.eventos, id: novoId(), dados: { tipo: 'entrada', modeloId: id, clienteId: cid, data, nf: corpo.nfEntrada, partes: corpo.partes, descricao: 'Importado de planilha (' + imp.nome + ')', fotos: [], criadoEm: agora } });
        res.criados++;
      }
    }
  }
  try { await banco.emLote(ops); }
  catch (e) { console.error(e); aviso('Erro ao gravar a importação: ' + (e.code || e.message), 'erro'); }
  imp.rodando = false; imp.resultado = res; pagina.atualizar();
  aviso(`Importação concluída: ${res.criados} criado(s), ${res.atualizados} atualizado(s).`);
}

// ---------- Da Instrução de Processo (instrucao.js) ----------
// IP já trazida = modelo com o mesmo nº de IP (campo ip) ou, sem ele, o mesmo código do produto
function modeloDaIP(ip) {
  const todos = [...S.modelos.values()];
  return todos.find(m => Number(m.ip) === ip.n)
    || (ip.codigo && todos.find(m => !m.ip && m.codProduto && norm(m.codProduto) === norm(ip.codigo))) || null;
}
function janelaInstrucao() {
  janela({
    titulo: 'Importar da Instrução de Processo',
    html: `<p class="mut" style="margin-top:0">Use o login da Instrução de Processo. Ele só serve para ler as IPs agora: não fica guardado.</p>
      <div class="mc-form">
        <label class="campo l2">E-mail<input class="ent" id="ipEmail" type="email" autocomplete="off"></label>
        <label class="campo l2">Senha<input class="ent" id="ipSenha" type="password" autocomplete="off"></label>
        <label class="l3"><input type="checkbox" id="ipFotos" checked> Trazer as fotos (caixa frente, caixa traseira e macho)</label>
      </div>`,
    botoes: [
      { texto: 'Cancelar' },
      { texto: 'Buscar IPs de cliente', cls: 'pri', acao: async el => {
        const email = el.querySelector('#ipEmail').value.trim(), senha = el.querySelector('#ipSenha').value, fotos = el.querySelector('#ipFotos').checked;
        if (!email || !senha) { aviso('Preencha o e-mail e a senha da Instrução de Processo.', 'erro'); return false; }
        el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
        try {
          aviso('Lendo a Instrução de Processo…');
          const supa = await entrarInstrucao(email, senha);
          const ips = await ipsDeCliente(supa);
          setTimeout(() => janelaIPsEncontradas(supa, ips, fotos), 30);
        } catch (e) {
          console.error(e);
          aviso('Não foi possível ler a Instrução de Processo: ' + (e.message || e), 'erro');
          el.querySelectorAll('footer button').forEach(b => { b.disabled = false; });
          return false;
        }
      } },
    ],
  });
}
function janelaIPsEncontradas(supa, ips, fotos) {
  if (!ips.length) { aviso('Nenhuma IP com destino "Retorno para o cliente" na Instrução de Processo.', 'erro'); return; }
  const linhas = ips.map(ip => ({ ip, m: modeloDaIP(ip) }));
  const novos = linhas.filter(l => !l.m).length;
  janela({
    titulo: `Instrução de Processo: ${ips.length} IP(s) de cliente`, larga: true,
    html: `<p class="mut" style="margin-top:0">${novos} nova(s) viram modelo “Na empresa” com a chegada no histórico; ${ips.length - novos} já trazida(s) só completam o que estiver em branco${fotos ? ' (e as fotos que faltarem)' : ''}. Cliente que ainda não existe é criado pelo nome.</p>
      <div class="tab-wrap"><table class="tab"><thead><tr><th>IP</th><th>Código do produto</th><th>Cliente</th><th>Descrição</th><th>Liga</th><th>Aqui</th></tr></thead><tbody>
        ${linhas.map(({ ip, m }) => `<tr><td>${ip.n}</td><td>${esc(ip.codigo)}</td><td>${esc(ip.cliente || '—')}</td><td>${esc(ip.descricao)}</td><td>${esc(ip.liga)}</td>
          <td>${m ? `já existe: <b>${esc(m.codigo)}</b>` : '<span class="ok">novo</span>'}</td></tr>`).join('')}
      </tbody></table></div>`,
    botoes: [
      { texto: 'Cancelar' },
      { texto: `Importar ${ips.length} IP(s)`, cls: 'pri', acao: el => {
        el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
        importarIPs(supa, ips, fotos);
      } },
    ],
  });
}
async function importarIPs(supa, ips, comFotos) {
  const res = { criados: 0, completados: 0, clientes: 0, fotos: 0, falhas: 0 };
  const agora = agoraISO();
  const porNome = new Map([...S.clientes.values()].filter(c => c.nome).map(c => [norm(c.nome), c.id]));
  const codigos = [...S.modelos.values()].map(m => m.codigo);
  const fotosFaltando = async (n, jaTem) => {
    const out = [];
    if (!comFotos) return out;
    for (const [slot, tipo] of Object.entries(FOTOS_IP)) {
      if (jaTem.has(tipo)) continue;
      try {
        const blob = await fotoDaIP(supa, n, slot);
        if (!blob) continue;
        const [id] = await enviarFotos([blob]);
        out.push({ id, tipo }); res.fotos++;
      } catch (e) { console.warn('foto da IP', n, slot, e); res.falhas++; }
    }
    return out;
  };
  for (let i = 0; i < ips.length; i++) {
    const ip = ips[i];
    aviso(`Importando IP ${ip.n} (${i + 1} de ${ips.length})…`);
    try {
      const ops = [];
      let cid = '';
      if (ip.cliente) {
        cid = porNome.get(norm(ip.cliente)) || '';
        if (!cid) {
          cid = novoId(); porNome.set(norm(ip.cliente), cid);
          const c = { nome: ip.cliente, criadoEm: agora, origem: 'instrucao' };
          S.clientes.set(cid, { ...c, id: cid });
          ops.push({ col: COL.clientes, id: cid, dados: c }); res.clientes++;
        }
      }
      const corpo = { clienteId: cid, codProduto: ip.codigo, descricao: ip.descricao || ip.codigo || 'IP ' + ip.n, liga: ip.liga, ip: ip.n };
      const m = modeloDaIP(ip);
      if (m) {
        const mud = Object.fromEntries(Object.entries(corpo).filter(([k, v]) => v !== '' && v != null && (m[k] === '' || m[k] == null)));
        const novas = await fotosFaltando(ip.n, new Set((m.fotos || []).map(f => f.tipo)));
        if (novas.length) mud.fotos = [...(m.fotos || []), ...novas];
        if (Object.keys(mud).length) {
          const d = { ...semMeta(S.modelos.get(m.id)), ...mud, atualizadoEm: agora };
          S.modelos.set(m.id, { ...d, id: m.id });
          ops.push({ col: COL.modelos, id: m.id, dados: d }); res.completados++;
        }
      } else {
        const id = novoId(), codigo = proximoCodigo(prefixo('modelo'), codigos);
        codigos.push(codigo);
        const data = paraData(ip.data) || hoje();
        const fotos = await fotosFaltando(ip.n, new Set());
        const d = { ...corpo, codigo, referencia: '', partes: null, material: '', localizacao: '', nfEntrada: '', dataEntrada: data, obs: '',
          status: 'na_empresa', fotos, ultimaMov: data, criadoEm: agora, origem: 'instrucao' };
        S.modelos.set(id, { ...d, id });
        ops.push({ col: COL.modelos, id, dados: d });
        ops.push({ col: COL.eventos, id: novoId(), dados: { tipo: 'entrada', modeloId: id, clienteId: cid, data, nf: '', partes: null,
          descricao: `Importado da Instrução de Processo (IP ${ip.n})`, fotos: [], criadoEm: agora } });
        res.criados++;
      }
      if (ops.length) await banco.emLote(ops);   // grava IP por IP: se parar no meio, o que foi feito fica
    } catch (e) { console.error('IP', ip.n, e); res.falhas++; }
  }
  supa.auth.signOut().catch(() => {});
  aviso(`Instrução de Processo: ${res.criados} modelo(s) novo(s), ${res.completados} completado(s)` +
    (res.clientes ? `, ${res.clientes} cliente(s) novo(s)` : '') + (comFotos ? `, ${res.fotos} foto(s)` : '') +
    (res.falhas ? `. ${res.falhas} falha(s): veja o console (F12).` : '.'), res.falhas ? 'erro' : undefined);
  if (pagina && !pagina.fixa) pagina.atualizar();
}

async function exportarXlsx(btn) {
  btn.disabled = true;
  try {
    const c = id => cli(id) || {};
    const modelos = [...S.modelos.values()].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')).map(m => ({
      'Código': m.codigo, 'Código do produto': m.codProduto || '', 'Descrição': m.descricao, 'Modelo/Referência': m.referencia || '', 'Total de partes': m.partes ?? '',
      'Cliente (código)': c(m.clienteId).codigo || '', 'Cliente': c(m.clienteId).nome || '', 'Situação': (STATUS[m.status] || {}).texto || m.status || '',
      'Localização': m.localizacao || '', 'Material': m.material || '', 'Liga': m.liga || '', 'NF de entrada': m.nfEntrada || '', 'Data de entrada': fmtData(m.dataEntrada),
      'Última movimentação': fmtData(m.ultimaMov), 'Fotos': (m.fotos || []).length, 'Observações': m.obs || '' }));
    const clientes = [...S.clientes.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(x => ({
      'Código': x.codigo || '', 'Nome': x.nome || '', 'CNPJ': x.cnpj || '', 'Inscrição estadual': x.ie || '', 'Endereço': x.endereco || '', 'Bairro': x.bairro || '',
      'Cidade': x.cidade || '', 'UF': x.uf || '', 'CEP': x.cep || '', 'Telefone': x.telefone || '', 'Fax/800': x.fax || '', 'E-mail': x.email || '' }));
    const devs = [...S.devolucoes.values()].sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map(d => ({
      'Nº': d.numero, 'Cliente': c(d.clienteId).nome || '', 'Modelos': (d.itens || []).map(i => i.codigo).join(', '), 'NF': d.nf || '', 'OC': d.oc || '',
      'Emissão': fmtDataHora(d.dataEmissao), 'Entrega': fmtData(d.dataEntrega), 'Situação': (DEV_STATUS[d.status] || {}).texto || d.status,
      'Retirado por': (d.retirada || {}).nome || '', 'Emissor': d.emissor || '' }));
    const evs = eventosOrdenados([...S.eventos.values()]).map(e => { const m = S.modelos.get(e.modeloId) || {}; return {
      'Data': fmtData(e.data), 'Tipo': (EV[e.tipo] || {}).texto || e.tipo, 'Modelo': m.codigo || '', 'Descrição do modelo': m.descricao || '',
      'Cliente': c(e.clienteId || m.clienteId).nome || '', 'NF': e.nf || '', 'Assunto': e.titulo || '', 'Detalhe': e.descricao || '',
      'Conserto realizado': e.solucao || '', 'Responsável': e.responsavel || '', 'Situação do conserto': e.tipo === 'conserto' ? (e.situacao === 'aberto' ? 'Em aberto' : 'Concluído') : '',
      'Registrado por': autorDe(e), 'Registrado em': fmtDataHora(e.criadoEm) }; });
    const blob = await montarXlsx({ 'Modelos': modelos, 'Clientes': clientes, 'Devoluções': devs, 'Histórico': evs });
    baixarArquivo(`Modelos de clientes ${hoje()}.xlsx`, blob, blob.type);
  } catch (e) { aviso('Não foi possível montar a planilha: ' + (e.message || e), 'erro'); }
  finally { btn.disabled = false; }
}
function exportarJson() {
  const dados = { sistema: 'modelos-clientes-prometals', versao: 1, exportadoEm: agoraISO(), config: S.config,
    clientes: [...S.clientes.values()], modelos: [...S.modelos.values()], devolucoes: [...S.devolucoes.values()], eventos: [...S.eventos.values()] };
  baixarArquivo(`Cópia Modelos de clientes ${hoje()}.json`, JSON.stringify(dados, null, 2));
}
async function exportarPlanilhaModelo(btn) {
  btn.disabled = true;
  try {
    const blob = await montarXlsx({
      'Modelos': [['Código do cliente', 'Cliente', 'Código do modelo', 'Código do produto', 'Descrição', 'Modelo', 'Total de partes', 'NF de entrada', 'Data de entrada', 'Localização', 'Material', 'Liga', 'Observações'],
        ['1000635', 'MARCENTRIC', '', '', 'CORPO FUNDIDO VR-100 INOX CF-8', 'VR-100', 3, '1588', '22/01/2026', '', '', 'INOX CF-8', '']],
      'Clientes': [['Código', 'Nome', 'CNPJ', 'Inscrição estadual', 'Endereço', 'Bairro', 'Cidade', 'UF', 'CEP', 'Telefone', 'Fax/800', 'E-mail'],
        ['1000635', 'MARCENTRIC', '03.042.907/0001-01', '535232598118', 'RUA SALVADOR GOBETH', '', 'PIRACICABA', 'SP', '13414115', '', '', '']],
    });
    baixarArquivo('Planilha modelo - importação Modelos de clientes.xlsx', blob, blob.type);
  } catch (e) { aviso('Não foi possível montar a planilha: ' + (e.message || e), 'erro'); }
  finally { btn.disabled = false; }
}

// ---------------------------------------------------------------------
// CONFIGURAÇÕES (eng_config/modelosClientes)
// ---------------------------------------------------------------------
function paginaConfig() {
  mostrar('mcli-config', ['Configurações'], () => {
    const Em = E();
    const fld = (k, l, cls = '') => `<label class="campo ${cls}">${l}<input class="ent" data-cfg="${k}" value="${esc(Em[k])}"></label>`;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Configurações</h1><p class="sub">Dados da empresa que saem no cabeçalho e na declaração do documento de devolução.</p></div></div>
      <div class="cartao"><div class="corpo"><div class="mc-form">
        ${fld('nome', 'Razão social', 'l2')}${fld('emissorPadrao', 'Emissor padrão')}
        ${fld('endereco', 'Endereço', 'l2')}${fld('numero', 'Número')}
        ${fld('bairro', 'Bairro')}${fld('cidade', 'Cidade/UF')}${fld('cep', 'CEP')}
        ${fld('telefone', 'Telefone')}${fld('fax', 'Fax/800')}<span></span>
        ${fld('cnpj', 'CNPJ')}${fld('ie', 'Inscrição estadual')}<span></span>
        ${fld('prefixoModelo', 'Prefixo do código de modelo')}${fld('prefixoDev', 'Prefixo do nº de devolução')}<span></span>
        <label class="campo l3">Texto da declaração de retirada<textarea class="ent" data-cfg="declaracao" rows="4">${esc(Em.declaracao)}</textarea>
          <span class="mut peq" style="text-transform:none;letter-spacing:0;font-weight:400">Campos automáticos: {nome} {cpf} {rg} {data} {veiculo} {placa} {empresa} {endereco}. Em branco, saem como linha para preencher à mão.</span></label>
      </div>
      <div class="mc-acoes" style="margin-top:14px"><span class="cresce"></span>
        ${ED ? `<button class="btn so-ed" id="cfgPadrao">Restaurar texto padrão</button><button class="btn pri so-ed" id="cfgSalvar">${icone('salvar')} Salvar configurações</button>` : ''}</div>
      </div></div>`;
  }, true);
  const b = C.querySelector('#cfgSalvar');
  if (b) b.onclick = () => {
    const corpo = {};
    for (const k of CHAVES_EMPRESA) { const el = C.querySelector(`[data-cfg="${k}"]`); corpo[k] = el ? el.value.trim() : ''; }
    banco.salvar(COL.config, CFG_ID, { ...corpo, atualizadoEm: agoraISO() }).catch(e => aviso('Erro ao salvar: ' + (e.code || e.message), 'erro'));
    aviso('Configurações salvas.');
  };
  const p = C.querySelector('#cfgPadrao');
  if (p) p.onclick = () => { C.querySelector('[data-cfg="declaracao"]').value = DECL_PADRAO; };
}

// ---------------------------------------------------------------------
// CONSULTA POR CÓDIGO DO PRODUTO: #/produto/<código>
// (a Instrução de Processo abre esta página)
// ---------------------------------------------------------------------
function paginaProduto(codigo) {
  mostrar('mcli-modelos', ['Consulta por código do produto'], () => {
    const ms = codigo ? [...S.modelos.values()].filter(m => m.codProduto && norm(m.codProduto) === norm(codigo)) : [];
    if (codigo) definirTrilha(['Modelos de clientes', 'Produto', codigo]);
    const fotosDe = (m, tipo) => (m.fotos || []).filter(f => (f.tipo || 'outra') === tipo);
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">${codigo ? 'Produto ' + esc(codigo) : 'Consulta por código do produto'}</h1>
        <p class="sub">Dados da peça e fotos do modelo do cliente, pelo código do produto (o mesmo do NW e da Instrução de Processo).</p></div></div>
      <div class="cartao livre"><div class="corpo"><form id="fProd" class="mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" id="pCod" placeholder="Código do produto" value="${esc(codigo)}"></label>
        <button class="btn pri" type="submit">Consultar</button></form></div></div>
      ${!codigo ? '' : !ms.length ? `<div class="faixa lar">Nenhum modelo de cliente com o código do produto <b>${esc(codigo)}</b>.</div>` : ms.map(m => `
        <div class="cartao mc-produto">
          <h2><span class="cresce">${esc(m.descricao)}</span>${tagSit(m.status)}</h2>
          <div class="corpo">
            <dl class="mc-fatos">
              ${fato('Código do produto', '<b>' + esc(m.codProduto) + '</b>')}${fato('Referência / desenho', esc(m.referencia))}
              ${fato('Cliente', esc(rotuloCli(m.clienteId)))}${fato('Liga', esc(m.liga))}
              ${fato('Total de partes', esc(m.partes ?? ''))}${fato('Material do modelo', esc(m.material))}
              ${fato('Localização', esc(m.localizacao))}${fato('Situação', tagSit(m.status))}
              ${fato('Código do modelo', `<a href="#/modelo/${esc(m.id)}">${esc(m.codigo)}</a>`)}
            </dl>
            <div class="mc-prod-fotos">${['frente', 'traseira', 'macho'].map(t => {
              const fs = fotosDe(m, t);
              if (t === 'macho' && !fs.length) return '';
              return `<figure><figcaption>${TIPOS_FOTO[t]}</figcaption>${fs.length ? fs.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f.id)}"><img data-foto="${esc(f.id)}" alt="${TIPOS_FOTO[t]}"></button>`).join('') : '<div class="mc-sem-foto">Sem foto</div>'}</figure>`;
            }).join('')}</div>
          </div></div>`).join('')}`;
  }, false, () => {
    C.querySelector('#fProd').onsubmit = e => { e.preventDefault(); const v = C.querySelector('#pCod').value.trim(); location.hash = '#/produto' + (v ? '/' + encodeURIComponent(v) : ''); };
  });
  if (!codigo) C.querySelector('#pCod').focus();
}
