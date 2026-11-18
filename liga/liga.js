// =====================================================================
//  liga/liga.js — módulo Cálculo de Liga
//  Telas: Corridas (lista e ficha), Retornos, Ligas e normas,
//  Sucatas e ferroligas, Configurações (forno, contadores, importação, backup).
// =====================================================================
import * as banco from '../comum/banco.js';
import { montar, definirTrilha, marcarMenu, aviso, janela, esc, num, fmt, fmtKg, hoje, fmtData, icone, baixarArquivo } from '../comum/casca.js';
import {
  ELEMENTOS, COL, acharLiga, mesmaLiga, calcular, situacaoElemento, conferir, saldos, numeroCorrida,
  codigoRetornoDaCorrida, idCorrida, statusCorrida, lerOps, temAnalise, normLiga, baixaDoRetorno,
} from './calculo.js?v=1.1.0';
import { LIGAS_INICIAIS, MATERIAIS_INICIAIS, CONFIG_INICIAL } from './dados-iniciais.js';
import { lerPlanilha } from './importar.js';

// ---------------------------------------------------------------------
// Estado (dados que chegam do banco)
// ---------------------------------------------------------------------
const S = {
  ligas: [], materiais: [], retornos: [], corridas: [], config: null,
  saldos: new Map(), retPorCod: new Map(),
  chegou: {}, servidor: {}, semeado: false,
};
const filtros = {
  corridas: { chip: 'todas', liga: '', q: '' },
  retornos: { chip: 'saldo', liga: '', q: '' },
};
let pagina = null;     // { nome, atualizar() }
let editor = null;     // corrida aberta: { id, d (rascunho), sujo }

const cfg = () => S.config || CONFIG_INICIAL;
const ligaDe = nome => acharLiga(S.ligas, nome);
const sucatas = () => S.materiais.filter(m => m.tipo === 'sucata');
const ferroligas = () => S.materiais.filter(m => m.tipo !== 'sucata');
const ordenarPor = (lista, f) => lista.sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));

function recalcular() {
  S.retPorCod = new Map(S.retornos.map(r => [r.codigo, r]));
  S.saldos = saldos(S.retornos, S.corridas);
}

// ---------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------
const est = await montar({ ativo: 'corridas', trilha: ['Cálculo de Liga'] });
const C = document.getElementById('conteudo');
C.innerHTML = '<div class="vazio">Carregando dados…</div>';

function chegou(nome, info) {
  S.chegou[nome] = true;
  if (!info || !info.doCache) S.servidor[nome] = true;
  recalcular();
  if (['ligas', 'materiais', 'retornos', 'corridas', 'config'].every(k => S.chegou[k])) {
    semearSePreciso();
    if (!pagina) rotear(); else pagina.atualizar();
  }
}
banco.ouvirColecao(COL.ligas, (l, i) => { S.ligas = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(b.nome)); chegou('ligas', i); }, erroBanco);
banco.ouvirColecao(COL.materiais, (l, i) => { S.materiais = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)); chegou('materiais', i); }, erroBanco);
banco.ouvirColecao(COL.retornos, (l, i) => { S.retornos = l; chegou('retornos', i); }, erroBanco);
banco.ouvirColecao(COL.corridas, (l, i) => { S.corridas = l; chegou('corridas', i); }, erroBanco);
banco.ouvirDoc(COL.config, 'liga', (d, i) => { S.config = d; chegou('config', i); }, erroBanco);

function erroBanco(e) {
  const permissao = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${permissao
    ? 'Seu usuário não tem permissão para ler os dados da Engenharia. Peça para incluir seu e-mail nas Regras do Firestore.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}

// Primeira vez (banco vazio): grava ligas, sucatas/ferroligas e configuração da planilha.
// Só decide depois que o servidor confirmar que está vazio, para nunca sobrescrever dados reais.
async function semearSePreciso() {
  if (S.semeado) return;
  const confirmado = ['ligas', 'materiais', 'config'].every(k => S.servidor[k]);
  if (!confirmado) return;
  S.semeado = true;
  const ops = [];
  if (!S.ligas.length) LIGAS_INICIAIS.forEach((l, i) => ops.push({ col: COL.ligas, id: normLiga(l.nome), dados: { ...l, ordem: i } }));
  if (!S.materiais.length) MATERIAIS_INICIAIS.forEach(m => ops.push({ col: COL.materiais, id: m.id, dados: m }));
  if (!S.config) ops.push({ col: COL.config, id: 'liga', dados: CONFIG_INICIAL });
  if (ops.length) {
    await banco.emLote(ops);
    aviso('Primeiro acesso: ligas, sucatas e ferroligas carregadas da planilha.');
  }
}

// ---------------------------------------------------------------------
// Rotas: #/corridas  #/corrida/nova  #/corrida/<id>  #/retornos  #/ligas  #/materiais  #/config
// ---------------------------------------------------------------------
window.addEventListener('hashchange', () => {
  if (editor && editor.sujo && !confirm('Há alterações não salvas nesta corrida. Sair mesmo assim?')) {
    history.replaceState(null, '', '#/corrida/' + (editor.id || 'nova'));
    return;
  }
  rotear();
});
window.addEventListener('beforeunload', e => { if (editor && editor.sujo) { e.preventDefault(); e.returnValue = ''; } });

function rotear() {
  const h = (location.hash || '#/corridas').slice(2).split('/');
  editor = null;
  window.scrollTo(0, 0);
  if (h[0] === 'corrida') return paginaCorrida(decodeURIComponent(h[1] || 'nova'));
  if (h[0] === 'retornos') return paginaRetornos();
  if (h[0] === 'ligas') return paginaLigas();
  if (h[0] === 'materiais') return paginaMateriais();
  if (h[0] === 'config') return paginaConfig();
  return paginaCorridas();
}

// Pequenos ajudantes de HTML
const ent = (attrs, valor = '') => `<input class="ent" ${attrs} value="${esc(valor == null ? '' : valor)}">`;
const entNum = (attrs, valor) => `<input class="ent num" inputmode="decimal" autocomplete="off" ${attrs} value="${esc(valor == null || valor === '' ? '' : String(valor).replace('.', ','))}">`;
const optLigas = (sel, vazio = 'Escolha a liga…') => `<option value="">${vazio}</option>` +
  S.ligas.map(l => `<option value="${esc(l.nome)}" ${ligaDe(sel) && ligaDe(sel).id === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('');
const fmtComp = v => (v == null || v === '' ? '' : fmt(v, 2));
const fmtFaixa = f => !f ? '' : `${fmtComp(f[0])} – ${f[1] == null || f[1] === '' ? '…' : fmtComp(f[1])}`;

// =====================================================================
//  CORRIDAS — lista
// =====================================================================
function paginaCorridas() {
  marcarMenu('corridas');
  definirTrilha(['Cálculo de Liga', 'Corridas']);
  const f = filtros.corridas;
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Corridas</h1><p class="sub">Carga do forno, boletim para o forneiro e resultado do laboratório de cada corrida.</p></div>
      <a class="btn pri" href="#/corrida/nova">${icone('mais')} Nova corrida</a>
    </div>
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fLiga" style="width:auto;min-width:150px">${optLigas(f.liga, 'Todas as ligas')}</select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar nº da corrida, OP, FS, liga ou retorno…" value="${esc(f.q)}"></div>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#fLiga').onchange = e => { f.liga = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  C.querySelector('#chips').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#kpis').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/corrida/' + encodeURIComponent(tr.dataset.id); };

  function linhas() {
    return S.corridas.map(c => {
      const liga = ligaDe(c.liga);
      const st = statusCorrida(c, liga, c.retornoGerado ? S.retPorCod.get(c.retornoGerado) : null);
      const est = c.origem === 'planilha' ? (c.estimadoPlanilha || {}) : (c.estimado || {});
      return { c, liga, st, foraEst: conferir(est, liga) };
    });
  }
  function atualizar() {
    const ano = String(new Date().getFullYear());
    const todas = linhas();
    const doSistema = todas.filter(x => x.c.origem !== 'planilha');
    const doAno = todas.filter(x => String(x.c.data || '').startsWith(ano));
    const aguardando = doSistema.filter(x => x.st.cod === 'aguardando');
    const fora = todas.filter(x => x.st.cod === 'fora');
    const cargas = doAno.map(x => +x.c.carga || 0).filter(Boolean);
    const kpi = (chip, n, rot, cls) => `<button class="kpi ${cls} ${f.chip === chip ? 'sel' : ''}" data-chip="${chip}"><b>${n}</b><span>${rot}</span></button>`;
    C.querySelector('#kpis').innerHTML =
      kpi('todas', doAno.length, 'Corridas em ' + ano, '') +
      kpi('aguardando', aguardando.length, 'Aguardando análise', 'amar') +
      kpi('fora', fora.length, 'Análise fora da norma', 'verm') +
      `<div class="kpi verde"><b>${cargas.length ? fmtKg(cargas.reduce((a, b) => a + b, 0) / cargas.length) : '–'}</b><span>Carga média ${ano} (kg)</span></div>`;
    const chips = [['todas', 'Todas'], ['aguardando', 'Aguardando análise'], ['fora', 'Fora da norma'], ['planilha', 'Histórico da planilha']];
    C.querySelector('#chips').innerHTML = chips.map(([k, t]) => `<button class="ficha ${f.chip === k ? 'sel' : ''}" data-chip="${k}">${t}</button>`).join('');

    const q = f.q.trim().toLowerCase();
    let lista = todas.filter(x => {
      if (f.chip === 'aguardando' && !(x.st.cod === 'aguardando' && x.c.origem !== 'planilha')) return false;
      if (f.chip === 'fora' && x.st.cod !== 'fora') return false;
      if (f.chip === 'planilha' && x.c.origem !== 'planilha') return false;
      if (f.liga && !mesmaLiga(S.ligas, x.c.liga, f.liga)) return false;
      if (q) {
        const alvo = [numeroCorrida(x.c), x.c.liga, x.c.fs, (x.c.ops || []).join(' '), x.c.opsTexto, (x.c.retornos || []).map(r => r.codigo).join(' '), x.c.retornoGerado].join(' ').toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    lista.sort((a, b) => String(b.c.data || '').localeCompare(String(a.c.data || '')) || (+b.c.anual || 0) - (+a.c.anual || 0) || String(b.c.id).localeCompare(String(a.c.id)));
    const total = lista.length;
    lista = lista.slice(0, 300);
    C.querySelector('#tabela').innerHTML = !total ? `<div class="vazio">${S.corridas.length ? 'Nenhuma corrida com esses filtros.' : 'Nenhuma corrida ainda. Clique em <b>Nova corrida</b> ou importe a planilha em Configurações.'}</div>` : `
      <table class="tab"><thead><tr>
        <th>Corrida</th><th>Data</th><th>Liga</th><th>FS / OPs</th><th class="dir">Carga (kg)</th><th class="dir">Temp.</th><th>Retornos usados</th><th>Estimado</th><th>Análise</th>
      </tr></thead><tbody>
      ${lista.map(({ c, st, foraEst }) => `<tr class="clic" data-id="${esc(c.id)}">
        <td class="num"><b>${esc(numeroCorrida(c))}</b>${c.origem === 'planilha' ? ' <span class="pilula" title="Importada da planilha">planilha</span>' : ''}</td>
        <td class="num">${fmtData(c.data)}</td>
        <td><span class="pilula lar">${esc(c.liga || '?')}</span></td>
        <td>${c.fs ? `<b>${esc(c.fs)}</b> ` : ''}<span class="mut">${esc((c.ops || []).join(', ') || c.opsTexto || '')}</span></td>
        <td class="dir num ${cargaClasse(c.carga)}">${fmtKg(c.carga)}</td>
        <td class="dir num">${c.temperatura ? esc(c.temperatura) + '°' : ''}</td>
        <td class="mut">${esc((c.retornos || []).map(r => r.codigo).join(', '))}</td>
        <td>${foraEst.length ? `<span class="tag alerta" title="${esc(foraEst.join(', '))}">${foraEst.length} fora</span>` : '<span class="tag ok">ok</span>'}</td>
        <td><span class="tag ${st.cls}" title="${esc(st.fora.join(', '))}">${st.texto}</span></td>
      </tr>`).join('')}</tbody></table>
      ${total > 300 ? `<div class="vazio">Mostrando as 300 mais recentes de ${total}. Use a busca para achar as outras.</div>` : ''}`;
  }
  pagina = { nome: 'corridas', atualizar };
  atualizar();
}

function cargaClasse(kg) {
  const { min, max } = cfg().forno || {};
  if (!kg) return '';
  if (max && kg > max) return 'txt-verm';
  if (min && kg < min) return 'txt-amar';
  return '';
}

// =====================================================================
//  CORRIDA — ficha (equivalente à aba PREENCHIMENTO + boletim + laboratório)
// =====================================================================
function rascunhoNovo() {
  const c = cfg().contadores || {};
  const maxAnual = Math.max(+c.anual || 0, ...S.corridas.filter(x => String(x.data || '').startsWith(String(new Date().getFullYear()))).map(x => +x.anual || 0));
  return {
    data: hoje(), anual: maxAnual + 1, refratario: (+c.refratario || 0) + 1,
    liga: '', fs: '', opsTexto: '', temperatura: '',
    retornos: [linhaRetVazia()], manuais: [], materiais: {},
    real: {}, lab: {}, obs: '', retornoGerado: '',
  };
}
// Linha de retorno da corrida: kg = Solicitado (entra no forno), recarga = separada (só baixa o saldo).
// solManual (só no rascunho, não é salvo) = o Solicitado foi digitado à mão, não recalcular sozinho.
function linhaRetVazia() { return { codigo: '', kg: '', recarga: '', solManual: false }; }
const numEntrada = v => String(Math.round(v * 10) / 10).replace('.', ',');
function rascunhoDe(c) {
  const d = JSON.parse(JSON.stringify(c));
  d.opsTexto = (c.ops || []).join(', ') || c.opsTexto || '';
  d.retornos = d.retornos && d.retornos.length ? d.retornos : [linhaRetVazia()];
  d.retornos.forEach(r => { if (r.recarga == null) r.recarga = ''; });
  d.manuais = d.manuais || []; d.materiais = d.materiais || {}; d.real = d.real || {}; d.lab = d.lab || {};
  return d;
}
// Versão "com números" do rascunho, para as contas
function normalizar(d) {
  const mats = {};
  for (const k of Object.keys(d.materiais || {})) { const v = num(d.materiais[k]); if (v) mats[k] = v; }
  const analise = a => { const o = {}; for (const e of ELEMENTOS) { const v = num(a && a[e]); if (v != null) o[e] = v; } return o; };
  return {
    ...d,
    anual: num(d.anual), refratario: num(d.refratario), temperatura: num(d.temperatura),
    ops: lerOps(d.opsTexto),
    retornos: (d.retornos || []).filter(r => r.codigo || num(r.kg) || num(r.recarga))
      .map(r => ({ codigo: r.codigo, kg: num(r.kg) || 0, recarga: num(r.recarga) || 0 })),
    manuais: (d.manuais || []).filter(m => m.desc || num(m.kg)).map(m => ({ desc: m.desc || '', kg: num(m.kg) || 0, analise: analise(m.analise) })),
    materiais: mats,
    real: analise(d.real),
  };
}

function paginaCorrida(id) {
  marcarMenu('corridas');
  const orig = id === 'nova' ? null : S.corridas.find(c => c.id === id);
  if (id !== 'nova' && !orig) { C.innerHTML = `<div class="faixa verm">Corrida não encontrada.</div><a class="btn" href="#/corridas">${icone('voltar')} Voltar</a>`; pagina = { atualizar() { if (S.corridas.find(c => c.id === id)) paginaCorrida(id); } }; return; }
  // "ed" é a corrida desta tela; "editor" (global) só serve para avisar de alterações não salvas
  const ed = editor = { id: orig ? orig.id : null, d: orig ? rascunhoDe(orig) : rascunhoNovo(), sujo: false, importada: orig && orig.origem === 'planilha' };
  const d = ed.d;
  definirTrilha(['Cálculo de Liga', 'Corridas', orig ? 'Corrida ' + numeroCorrida(orig) : 'Nova corrida']);
  // Corrida salva: o Solicitado conta como "digitado à mão" se não for igual a (disponível − recarga)
  d.retornos.forEach(r => {
    if (r.solManual != null) return;
    r.solManual = !!r.codigo && Math.abs((num(r.kg) || 0) - Math.max(0, disponivel(r.codigo) - (num(r.recarga) || 0))) > 0.05;
  });

  C.innerHTML = `
    <div class="cab nao-imprimir">
      <a class="btn" href="#/corridas">${icone('voltar')}</a>
      <div class="cresce"><h1 class="titulo" id="tituloCorrida"></h1><p class="sub" id="subCorrida"></p></div>
      ${orig ? `<button class="btn perigo" id="btExcluir">${icone('lixo')} Excluir</button>` : ''}
      <button class="btn" id="btBoletim">${icone('impressora')} Imprimir boletim</button>
      <button class="btn pri" id="btSalvar">${icone('salvar')} Salvar corrida</button>
    </div>
    ${ed.importada ? `<div class="faixa lar nao-imprimir">Corrida importada da planilha. A composição das entradas manuais não ficou salva na planilha, por isso o estimado mostrado é o que a planilha calculou na época.</div>` : ''}
    <div class="nao-imprimir" id="ficha">
      <div class="cartao"><h2>Dados de produção</h2><div class="corpo"><div class="linha-campos">
        <label class="campo">Liga<select class="ent" data-f="liga">${optLigas(d.liga)}</select></label>
        <label class="campo">Nº refratário${entNum('data-f="refratario"', d.refratario)}</label>
        <label class="campo">Nº anual${entNum('data-f="anual"', d.anual)}</label>
        <label class="campo">Data<input class="ent" type="date" data-f="data" value="${esc(d.data || '')}"></label>
        <label class="campo">Temperatura (°C)${entNum('data-f="temperatura" placeholder="ex.: 1650"', d.temperatura)}</label>
        <label class="campo">Corrida PCP (FS)${ent('data-f="fs" placeholder="ex.: FS-0225"', d.fs)}</label>
        <label class="campo" style="grid-column:span 2">OPs da liga${ent('data-f="opsTexto" placeholder="ex.: 3480, 3481, 3496"', d.opsTexto)}</label>
      </div></div></div>

      <div class="cartao"><h2>Norma × composição<span class="cresce"></span><span class="legenda"><i class="st-baixo">BAIXO</i><i class="st-ok">OK</i><i class="st-alto">ALTO</i></span></h2>
        <div class="corpo comp-grade"><div class="tab-wrap" id="tabComp"></div><div class="carga-box" id="cargaBox"></div></div>
        <div id="avisosCarga"></div>
      </div>

      <div class="grade2">
        <div class="cartao"><h2>Retornos<span class="cresce"></span><button class="btn peq" id="btAddRet">${icone('mais')} Retorno</button></h2><div class="corpo" id="boxRetornos"></div></div>
        <div class="cartao"><h2>Sucatas (kg)</h2><div class="corpo"><div class="grade-kg" id="boxSucatas"></div></div></div>
      </div>
      <div class="cartao"><h2>Correção — elementos de liga (kg)</h2><div class="corpo"><div class="grade-kg" id="boxLigas"></div></div></div>
      <div class="cartao"><h2>Entrada manual<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">material fora do cadastro (forma perdida, retorno sem análise…)</span><button class="btn peq" id="btAddMan">${icone('mais')} Entrada</button></h2><div class="corpo" id="boxManuais"></div></div>
      <div class="cartao"><h2>Laboratório — resultado real da corrida<span class="cresce"></span><span id="retGeradoInfo"></span></h2><div class="corpo" id="boxLab"></div></div>
      <div class="cartao"><h2>Observações</h2><div class="corpo"><textarea class="ent" data-f="obs" placeholder="Anotações da corrida">${esc(d.obs || '')}</textarea></div></div>
    </div>
    <div id="boletim"></div>`;

  const ficha = C.querySelector('#ficha');
  montarListas();

  // Edição: todo campo atualiza o rascunho e refaz as contas
  ficha.addEventListener('input', aoEditar);
  ficha.addEventListener('change', aoEditar);
  function aoEditar(e) {
    const t = e.target;
    let mexeu = true;
    if (t.dataset.f) {
      d[t.dataset.f] = t.value;
      if (t.dataset.f === 'liga' && e.type === 'change') {
        const l = ligaDe(t.value);
        if (l && l.temperatura && !d.temperatura) { d.temperatura = String(l.temperatura); ficha.querySelector('[data-f="temperatura"]').value = d.temperatura; }
        montarRetornos();
      }
    } else if (t.dataset.ret != null) {
      const i = +t.dataset.ret, r = d.retornos[i];
      if (t.dataset.k === 'codigo') {
        r.codigo = t.value;
        // Ao escolher o retorno, o Solicitado vem com o disponível (menos a recarga, se já digitada)
        if (e.type === 'change' && t.value && !r.solManual && S.saldos.has(t.value)) solicitadoAutomatico(r);
        if (e.type === 'change') montarRetornos();
      } else if (t.dataset.k === 'recarga') {
        r.recarga = t.value;
        // Solicitado = disponível − recarga, a não ser que o Solicitado tenha sido mudado à mão
        if (r.codigo && !r.solManual) {
          solicitadoAutomatico(r);
          const campo = ficha.querySelector(`[data-ret="${i}"][data-k="kg"]`);
          if (campo) campo.value = r.kg;
        }
      } else {
        r.kg = t.value;
        r.solManual = t.value.trim() !== '';   // apagou o Solicitado → volta a ser automático
      }
    } else if (t.dataset.mat) {
      d.materiais[t.dataset.mat] = t.value;
    } else if (t.dataset.man != null) {
      const m = d.manuais[+t.dataset.man];
      if (t.dataset.k === 'desc' || t.dataset.k === 'kg') m[t.dataset.k] = t.value;
      else { m.analise = m.analise || {}; m.analise[t.dataset.k] = t.value; }
    } else if (t.dataset.real) {
      d.real[t.dataset.real] = t.value;
    } else if (t.dataset.lab) {
      d.lab[t.dataset.lab] = t.value;
    } else mexeu = false;
    if (mexeu) { marcarSujo(); atualizarContas(); }
  }
  ficha.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.delRet != null) { d.retornos.splice(+b.dataset.delRet, 1); if (!d.retornos.length) d.retornos.push(linhaRetVazia()); montarRetornos(); marcarSujo(); atualizarContas(); }
    if (b.dataset.delMan != null) { d.manuais.splice(+b.dataset.delMan, 1); montarManuais(); marcarSujo(); atualizarContas(); }
    if (b.id === 'btGerarRet') gerarRetorno();
    if (b.id === 'btCopiarEst') { for (const e2 of ELEMENTOS) { const v = calcAtual().estimado[e2]; if (v) d.real[e2] = fmt(v, 2); } montarLab(); marcarSujo(); atualizarContas(); }
  });
  C.querySelector('#btAddRet').onclick = () => { d.retornos.push(linhaRetVazia()); montarRetornos(); };
  C.querySelector('#btAddMan').onclick = () => { d.manuais.push({ desc: '', kg: '', analise: {} }); montarManuais(); };
  C.querySelector('#btSalvar').onclick = salvarCorrida;
  C.querySelector('#btBoletim').onclick = () => { atualizarContas(); window.print(); };
  const btEx = C.querySelector('#btExcluir');
  if (btEx) btEx.onclick = excluirCorrida;

  function marcarSujo() { if (!ed.sujo) { ed.sujo = true; atualizarTitulo(); } }
  function atualizarTitulo() {
    C.querySelector('#tituloCorrida').textContent = (ed.id ? 'Corrida ' : 'Nova corrida ') + numeroCorrida(normalizar(d)) + (ed.sujo ? ' •' : '');
    C.querySelector('#subCorrida').textContent = ed.sujo ? 'Alterações não salvas' : (orig && orig._em ? 'Salva em ' + new Date(orig._em).toLocaleString('pt-BR') + (orig._por ? ' por ' + orig._por : '') : 'Preencha os dados e clique em Salvar corrida');
  }
  // kg que esta corrida já tirava do retorno (solicitado + recarga), para não contar duas vezes ao editar
  function usoOriginal(codigo) {
    if (!orig || orig.origem === 'planilha') return 0;
    return (orig.retornos || []).filter(r => r.codigo === codigo).reduce((s, r) => s + baixaDoRetorno(r), 0);
  }
  // Quanto do retorno esta corrida pode usar (saldo atual + o que ela mesma já tinha tirado)
  function disponivel(codigo) {
    const s = S.saldos.get(codigo);
    return (s ? s.saldo : 0) + usoOriginal(codigo);
  }
  function solicitadoAutomatico(r) {
    r.kg = numEntrada(Math.max(0, disponivel(r.codigo) - (num(r.recarga) || 0)));
  }
  function calcAtual() {
    return calcular(normalizar(d), { materiais: S.materiais, retornosPorCodigo: S.retPorCod });
  }

  function montarListas() { montarRetornos(); montarMateriais(); montarManuais(); montarLab(); atualizarTitulo(); atualizarContas(); }

  function montarRetornos() {
    const box = C.querySelector('#boxRetornos');
    const ligaAtual = d.liga;
    const disponiveis = S.retornos.map(r => ({ r, saldo: disponivel(r.codigo) }))
      .filter(x => x.saldo > 0.05 || d.retornos.some(u => u.codigo === x.r.codigo));
    const mesma = disponiveis.filter(x => ligaAtual && mesmaLiga(S.ligas, x.r.liga, ligaAtual));
    const outras = disponiveis.filter(x => !mesma.includes(x));
    const opt = (x, sel) => `<option value="${esc(x.r.codigo)}" ${sel === x.r.codigo ? 'selected' : ''}>${esc(x.r.codigo)} — ${fmtKg(x.saldo)} kg</option>`;
    box.innerHTML = `<div class="linha-ret cab-ret"><span>Retorno</span><span>Solicitado (kg)</span><span>Recarga (kg)</span><span></span></div>` + d.retornos.map((u, i) => {
      const conhecido = !u.codigo || S.retPorCod.has(u.codigo);
      return `<div class="linha-ret">
        <select class="ent" data-ret="${i}" data-k="codigo">
          <option value="">Escolha o retorno…</option>
          ${!conhecido ? `<option value="${esc(u.codigo)}" selected>${esc(u.codigo)} (não cadastrado)</option>` : ''}
          ${mesma.length ? `<optgroup label="Mesma liga (${esc(ligaAtual)})">${mesma.map(x => opt(x, u.codigo)).join('')}</optgroup>` : ''}
          ${outras.length ? `<optgroup label="${ligaAtual ? 'Outras ligas' : 'Retornos com saldo'}">${outras.map(x => opt(x, u.codigo)).join('')}</optgroup>` : ''}
        </select>
        ${entNum(`data-ret="${i}" data-k="kg" placeholder="solicitado" title="Solicitado (kg): entra no forno e na composição"`, u.kg)}
        ${entNum(`data-ret="${i}" data-k="recarga" placeholder="recarga" title="Recarga (kg): separada pelo forneiro; não entra no forno, mas sai do saldo"`, u.recarga)}
        <button class="botao-ic" data-del-ret="${i}" title="Tirar este retorno">${icone('lixo')}</button>
        <div class="ret-info" id="retInfo${i}"></div>
      </div>`;
    }).join('') + (disponiveis.length ? '' : '<div class="mut">Nenhum retorno com saldo cadastrado. Cadastre em Retornos ou importe a planilha.</div>');
    atualizarContas();
  }

  function montarMateriais() {
    const campo = m => `<label class="item-kg"><span>${esc(m.nome)}${m.mp ? `<small>${esc(m.mp)}</small>` : ''}</span>${entNum(`data-mat="${esc(m.id)}" placeholder="0"`, d.materiais[m.id])}</label>`;
    const ativos = l => l.filter(m => m.ativo !== false || num(d.materiais[m.id]));
    C.querySelector('#boxSucatas').innerHTML = ativos(sucatas()).map(campo).join('') || '<span class="mut">Nenhuma sucata cadastrada.</span>';
    C.querySelector('#boxLigas').innerHTML = ativos(ferroligas()).map(campo).join('') || '<span class="mut">Nenhum elemento cadastrado.</span>';
  }

  function montarManuais() {
    const box = C.querySelector('#boxManuais');
    if (!d.manuais.length) { box.innerHTML = '<div class="mut">Nenhuma entrada manual. Use para um material que não está no cadastro, informando o kg e a composição (%).</div>'; return; }
    box.innerHTML = `<div class="tab-wrap"><table class="tab tab-comp"><thead><tr><th>Descrição</th><th class="dir">kg</th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}<th></th></tr></thead><tbody>
      ${d.manuais.map((m, i) => `<tr>
        <td style="min-width:180px">${ent(`data-man="${i}" data-k="desc" placeholder="ex.: Forma perdida"`, m.desc)}</td>
        <td style="min-width:80px">${entNum(`data-man="${i}" data-k="kg"`, m.kg)}</td>
        ${ELEMENTOS.map(e => `<td>${entNum(`data-man="${i}" data-k="${e}"`, (m.analise || {})[e])}</td>`).join('')}
        <td><button class="botao-ic" data-del-man="${i}" title="Tirar">${icone('lixo')}</button></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function montarLab() {
    const box = C.querySelector('#boxLab');
    const lab = d.lab || {};
    box.innerHTML = `
      <div class="linha-campos" style="margin-bottom:12px">
        <label class="campo">Laboratório / empresa${ent('data-lab="empresa"', lab.empresa)}</label>
        <label class="campo">O.S.${ent('data-lab="os"', lab.os)}</label>
        <label class="campo">Nº relatório de ensaio${ent('data-lab="relatorio"', lab.relatorio)}</label>
        <label class="campo">Data do resultado<input class="ent" type="date" data-lab="data" value="${esc(lab.data || '')}"></label>
      </div>
      <div class="tab-wrap"><table class="tab tab-comp"><thead><tr><th></th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
        <tr><td><b>Real (%)</b></td>${ELEMENTOS.map(e => `<td>${entNum(`data-real="${e}" id="real_${e}"`, d.real[e])}</td>`).join('')}</tr>
      </tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn peq" id="btGerarRet">${icone('reciclar')} ${d.retornoGerado ? 'Atualizar retorno ' + esc(d.retornoGerado) : 'Gerar retorno desta corrida'}</button>
        <button class="btn peq" id="btCopiarEst" title="Preenche o real com o estimado, para depois só corrigir">Copiar estimado para o real</button>
      </div>`;
  }

  // Partes calculadas (refeitas a cada digitação e quando o banco muda)
  function atualizarContas() {
    if (!C.querySelector('#tabComp')) return;
    const n = normalizar(d);
    const calc = calcAtual();
    const liga = ligaDe(d.liga);
    const faixas = (liga && liga.faixas) || {};
    const gerado = d.retornoGerado ? S.retPorCod.get(d.retornoGerado) : null;
    const real = temAnalise(n.real) ? n.real : (gerado && temAnalise(gerado.analise) ? gerado.analise : null);
    const est = ed.importada && orig.estimadoPlanilha ? orig.estimadoPlanilha : calc.estimado;
    const celula = (v, e) => { const s = situacaoElemento(v, faixas[e]); return `<td class="cen num ${s ? 'st-' + s : ''}">${v ? fmtComp(v) : (s ? '0,00' : '')}</td>`; };
    C.querySelector('#tabComp').innerHTML = `<table class="tab tab-comp"><thead><tr><th></th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="mut">Mínimo</td>${ELEMENTOS.map(e => `<td class="cen num mut">${faixas[e] ? fmtComp(faixas[e][0]) : ''}</td>`).join('')}</tr>
      <tr><td class="mut">Máximo</td>${ELEMENTOS.map(e => `<td class="cen num mut">${faixas[e] ? fmtComp(faixas[e][1]) : ''}</td>`).join('')}</tr>
      <tr><td><b>Estimado</b>${ed.importada ? '<br><small class="mut">da planilha</small>' : ''}</td>${ELEMENTOS.map(e => celula(est[e], e)).join('')}</tr>
      ${real ? `<tr><td><b>Real (lab)</b>${!temAnalise(n.real) && gerado ? '<br><small class="mut">do retorno</small>' : ''}</td>${ELEMENTOS.map(e => celula(real[e], e)).join('')}</tr>` : ''}
    </tbody></table>`;

    const carga = ed.importada ? (+orig.carga || calc.carga) : calc.carga;
    const { min, max } = cfg().forno || {};
    let cls = 'ok', msg = 'Dentro da capacidade';
    if (max && carga > max) { cls = 'alto'; msg = `Acima do máximo (${fmtKg(max)} kg)`; }
    else if (min && carga < min) { cls = 'baixo'; msg = `Abaixo do mínimo (${fmtKg(min)} kg)`; }
    if (!carga) { cls = ''; msg = 'Informe retornos, sucatas e ligas'; }
    C.querySelector('#cargaBox').innerHTML = `<span>Carga do forno</span><b class="num">${fmtKg(carga) || '0'} <small>kg</small></b><em class="${cls ? 'st-' + cls : ''}">${msg}</em>`;

    // Avisos sobre os retornos
    const avisos = [];
    d.retornos.map(r => ({ codigo: r.codigo, kg: num(r.kg) || 0, recarga: num(r.recarga) || 0 })).forEach((u, i) => {
      const info = C.querySelector('#retInfo' + i);
      if (!info) return;
      const r = S.retPorCod.get(u.codigo);
      if (!u.codigo) { info.innerHTML = ''; return; }
      const disp = disponivel(u.codigo);
      const baixa = baixaDoRetorno(u);
      const partes = [];
      if (r && temAnalise(r.analise)) partes.push(['C', 'Si', 'Cr', 'Ni', 'Mo'].filter(e => r.analise[e] != null).map(e => `${e} ${fmtComp(r.analise[e])}`).join(' · '));
      else partes.push('<span class="txt-amar">sem análise do laboratório</span>');
      if (!ed.importada) {
        partes.push(`disponível ${fmtKg(disp)} kg`);
        if (u.recarga) partes.push(`recarga ${fmtKg(u.recarga)} kg fora do forno`);
        if (baixa > disp + 0.05) {
          const txt = u.recarga ? `solicitado + recarga (${fmtKg(baixa)} kg) passam do saldo em ${fmtKg(baixa - disp)} kg` : 'usando mais que o saldo';
          partes.push(`<span class="txt-verm">${txt}</span>`);
          avisos.push(`<span class="txt-verm">Retorno ${esc(u.codigo)}: ${txt}.</span>`);
        } else if (baixa && disp - baixa > 0.05) partes.push(`<span class="txt-az">sobram ${fmtKg(disp - baixa)} kg</span>`);
        else if (baixa) partes.push('saldo zera');
      }
      if (r && d.liga && !mesmaLiga(S.ligas, r.liga, d.liga)) partes.push(`<span class="txt-amar">retorno de outra liga (${esc(r.liga)})</span>`);
      info.innerHTML = partes.join(' · ');
    });
    if (!d.liga) avisos.push('Escolha a liga para ver a norma.');
    C.querySelector('#avisosCarga').innerHTML = avisos.length ? `<div class="corpo" style="padding-top:0"><span class="mut">${avisos.join(' ')}</span></div>` : '';
    C.querySelector('#retGeradoInfo').innerHTML = gerado ? `<a class="pilula lar" href="#/retornos" title="Retorno gerado por esta corrida">retorno ${esc(gerado.codigo)}</a>` : '';
    C.querySelector('#boletim').innerHTML = htmlBoletim(n, calc, liga, est, carga);
  }

  async function salvarCorrida() {
    const n = normalizar(d);
    if (!n.liga) return aviso('Escolha a liga.', 'erro');
    if (!n.anual) return aviso('Informe o nº anual da corrida.', 'erro');
    if (!n.data) return aviso('Informe a data.', 'erro');
    const calc = calcAtual();
    const novoId = ed.id || idCorrida(n);
    if (!ed.id && S.corridas.some(c => c.id === novoId)) return aviso(`Já existe a corrida anual ${n.anual} em ${n.data.slice(0, 4)}. Confira o número.`, 'erro');
    const liga = ligaDe(n.liga);
    const dados = {
      origem: ed.importada ? 'planilha' : 'sistema',
      data: n.data, ano: +n.data.slice(0, 4), anual: n.anual, refratario: n.refratario,
      liga: liga ? liga.nome : n.liga, ligaId: liga ? liga.id : normLiga(n.liga),
      fs: (n.fs || '').trim(), ops: n.ops, temperatura: n.temperatura,
      retornos: n.retornos, manuais: n.manuais, materiais: n.materiais,
      carga: ed.importada ? orig.carga : Math.round(calc.carga * 10) / 10,
      estimado: calc.estimado, real: n.real, lab: n.lab || {}, retornoGerado: n.retornoGerado || '', obs: n.obs || '',
    };
    if (ed.importada) { dados.estimadoPlanilha = orig.estimadoPlanilha || {}; dados.anualInferido = orig.anualInferido; dados.ligaPlanilha = orig.ligaPlanilha; dados.opsTexto = orig.opsTexto; }
    banco.salvar(COL.corridas, novoId, dados).catch(e => aviso('Erro ao salvar: ' + e.message, 'erro'));
    // Atualiza os contadores se esta é a corrida mais recente
    const ct = cfg().contadores || {};
    if (!ed.importada && n.anual >= (+ct.anual || 0)) {
      banco.salvar(COL.config, 'liga', { ...cfg(), contadores: { anual: n.anual, refratario: n.refratario || 0 } });
    }
    ed.sujo = false;
    const eraNova = !ed.id;
    ed.id = novoId;
    aviso('Corrida ' + numeroCorrida(n) + ' salva.');
    if (eraNova) { editor = null; history.replaceState(null, '', '#/corrida/' + encodeURIComponent(novoId)); setTimeout(() => paginaCorrida(novoId), 50); }
    else atualizarTitulo();
  }

  async function excluirCorrida() {
    if (!confirm(`Excluir a corrida ${numeroCorrida(orig)}? Os retornos que ela usava voltam para o saldo.`)) return;
    await banco.apagar(COL.corridas, orig.id);
    editor = null;
    aviso('Corrida excluída.');
    location.hash = '#/corridas';
  }

  function gerarRetorno() {
    if (!ed.id) return aviso('Salve a corrida antes de gerar o retorno.', 'erro');
    const n = normalizar(d);
    if (!temAnalise(n.real)) return aviso('Preencha o resultado real do laboratório primeiro.', 'erro');
    const liga = ligaDe(n.liga);
    const codigoPadrao = d.retornoGerado || codigoRetornoDaCorrida(n, liga ? liga.nome : n.liga);
    const existente = S.retPorCod.get(codigoPadrao);
    janela({
      titulo: existente ? 'Atualizar retorno ' + codigoPadrao : 'Gerar retorno desta corrida',
      html: `<p class="mut" style="margin-top:0">A sobra desta corrida vira um retorno com a análise do laboratório. O peso pode ser informado agora ou depois, na tela de Retornos.</p>
        <div class="linha-campos">
          <label class="campo">Código do retorno${ent('id="gCod"', codigoPadrao)}</label>
          <label class="campo">Kg verificado${entNum('id="gKg" placeholder="pesar depois"', existente ? existente.kgVerificado : '')}</label>
        </div>`,
      botoes: [{ texto: 'Cancelar' }, {
        texto: existente ? 'Atualizar retorno' : 'Gerar retorno', cls: 'pri', acao: el => {
          const codigo = el.querySelector('#gCod').value.trim();
          if (!codigo) { aviso('Informe o código.', 'erro'); return false; }
          const atual = S.retPorCod.get(codigo) || {};
          const kg = num(el.querySelector('#gKg').value);
          banco.salvar(COL.retornos, banco.idSeguro(codigo), {
            ...semMeta(atual), codigo, liga: liga ? liga.nome : n.liga,
            analise: n.real, relatorio: (n.lab && n.lab.relatorio) || atual.relatorio || '',
            kgVerificado: kg != null ? kg : (atual.kgVerificado || 0), baixaPlanilha: atual.baixaPlanilha || 0,
            origem: atual.origem || 'sistema', corridaId: ed.id, corridaRef: { refratario: n.refratario, anual: n.anual },
          });
          d.retornoGerado = codigo;
          salvarCorrida();
          montarLab();
          aviso('Retorno ' + codigo + (existente ? ' atualizado.' : ' criado.'));
        },
      }],
    });
  }

  pagina = {
    nome: 'corrida',
    atualizar() {
      // dados mudaram no banco: refaz só as listas e contas, sem perder o que está sendo digitado
      if (!C.querySelector('#ficha')) return;
      const foco = document.activeElement && ficha.contains(document.activeElement);
      if (!foco) montarRetornos(); else atualizarContas();
    },
  };
}

function semMeta(o) { const x = { ...o }; delete x.id; delete x._em; delete x._por; return x; }

// ---------- boletim de corrida (folha impressa, com a mesma cara da folha da planilha) ----------
// As 12 linhas de "Ligas" ficam sempre na mesma ordem da planilha, com "-" quando não usadas,
// para o forneiro achar cada elemento sempre no mesmo lugar. À direita, a legenda dos códigos MP do NW.
const BOL_LIGAS = [
  { id: 'fesi', nome: 'Fe Si', sim: 'Si' },
  { id: 'fecr_ac', nome: 'Cr A/C', sim: 'Cr A/C' },
  { id: 'femn_ac', nome: 'Fe Mn A/C', sim: 'Mn', extra: 'femn_bc' },
  { id: 'femo', nome: 'Fe Mo', sim: 'Mo' },
  { id: 'fenb', nome: 'Fe Nb', sim: 'Nb' },
  { id: 'fecr_bc', nome: 'Cr B/C', sim: 'Cr B/C' },
  { id: 'fev', nome: 'Fe V', sim: 'V' },
  { id: 'cu', nome: 'Cobre', sim: 'Cu' },
  { id: 'grafite', nome: 'Grafite', sim: 'Grafite' },
  { id: 'ni', nome: 'Níquel', sim: 'Ni' },
  { id: 'feti', nome: 'Titânio', sim: 'Ti' },
  { id: 'few', nome: 'Tungstênio', sim: 'W' },
];
const BOL_MNBC = 'femn_bc';   // Fe Mn B/C sai como "MN B/C" na área da sucata, como na planilha
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataBoletim = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}-${MESES[+m[2] - 1]}-${m[1].slice(2)}` : ''; };
const fmtQtd = v => (!+v ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

function htmlBoletim(n, calc, liga, est, carga) {
  const faixas = (liga && liga.faixas) || {};
  const nomeLiga = liga ? liga.nome : (n.liga || '');
  const mpDe = id => ((S.materiais.find(m => m.id === id) || {}).mp || '');
  const vazia = () => ({ elem: '', sol: '', rec: '' });
  const completar = (lista, minimo) => { while (lista.length < minimo) lista.push(vazia()); return lista; };

  // --- Retorno <liga>: retornos (Solicitado + Recarga) e entradas manuais ---
  const ret = completar([
    ...n.retornos.map(r => ({ elem: esc(r.codigo), sol: fmtQtd(r.kg), rec: fmtQtd(r.recarga) })),
    ...n.manuais.map(m => ({ elem: esc(m.desc), sol: fmtQtd(m.kg), rec: '' })),
  ], 3);

  // --- Sucata: as usadas, linhas em branco, e "MN B/C" sempre na última linha ---
  const legSuc = sucatas().filter(m => m.ativo !== false || n.materiais[m.id])
    .map(m => ({ a: esc(m.nome.replace(/^SAE\s*/i, '')), b: esc(m.mp || '') }));
  const suc = completar(sucatas().filter(m => n.materiais[m.id]).map(m => ({ elem: esc(m.nome), sol: fmtQtd(n.materiais[m.id]), rec: '' })),
    Math.max(4, legSuc.length - 1));
  suc.push({ elem: 'MN B/C', sol: fmtQtd(n.materiais[BOL_MNBC]), rec: '' });
  suc.forEach((r, i) => Object.assign(r, legSuc[i] || {}));

  // --- Ligas: 12 linhas fixas na ordem da planilha (+ alguma ferroliga nova do cadastro, se usada) ---
  const fixas = new Set([...BOL_LIGAS.map(x => x.id), BOL_MNBC]);
  const lig = BOL_LIGAS.map((x, i) => {
    const kg = n.materiais[x.id];
    return {
      num: i + 1, elem: kg ? x.nome : '-', sol: fmtQtd(kg), rec: '', usado: !!kg,
      a: x.sim, b: esc(mpDe(x.id)), c: x.extra && mpDe(x.extra) ? 'MN B/C ' + esc(mpDe(x.extra)) : '',
    };
  });
  ferroligas().filter(m => !fixas.has(m.id) && n.materiais[m.id]).forEach(m => lig.push({
    num: lig.length + 1, elem: esc(m.nome), sol: fmtQtd(n.materiais[m.id]), rec: '', usado: true, a: esc(m.nome), b: esc(m.mp || ''),
  }));

  const grupo = (rotulo, linhas) => linhas.map((r, i) => `<tr class="${i === 0 ? 'bol-ini' : ''}">
      ${i === 0 ? `<th class="bol-grupo" rowspan="${linhas.length}">${rotulo}</th>` : ''}
      ${r.num != null ? `<td class="bol-n">${r.num}</td><td>${r.elem}</td>` : `<td colspan="2" class="cen">${r.elem}</td>`}
      <td class="cen">${r.sol}</td><td class="cen">${r.rec}</td>
      <td class="bol-leg">${r.a || ''}</td><td class="bol-leg bol-mp">${r.b || ''}</td><td class="bol-leg bol-ult">${r.c || ''}</td>
    </tr>`).join('');

  const celComp = v => `<td>${v}</td>`;
  const cabComp = cls => `<tr class="${cls}">${ELEMENTOS.map(e => `<th>${e}</th>`).join('')}</tr>`;
  const real = temAnalise(n.real) ? n.real : null;

  return `<div class="bol">
    <table class="bol-tab bol-topo"><colgroup><col style="width:18%"><col></colgroup><tr>
      <td class="bol-logo"><img src="${banco.raiz('comum/logo.png')}" alt="Prometals"></td>
      <td class="bol-titulo">Boletim de Corrida</td>
    </tr></table>

    <div class="bol-faixa">Dados de Produção:</div>
    <table class="bol-tab bol-dados">
      <colgroup><col style="width:17%"><col style="width:13%"><col style="width:14%"><col style="width:17%"><col style="width:16%"><col style="width:10%"><col style="width:13%"></colgroup>
      <tr><th rowspan="2">Nº Corrida</th><th class="claro">Refratário</th><th class="claro">Anual</th><th class="claro">Ordem Produção</th>
        <td class="cen">${esc((n.ops || []).join(', '))}</td><th rowspan="2">DATA:</th><td rowspan="2" class="cen">${dataBoletim(n.data)}</td></tr>
      <tr><td colspan="2" class="cen"><b>${esc(numeroCorrida(n))}</b></td><th class="claro">Rastreio:</th><td class="cen">${esc(n.fs || '--')}</td></tr>
    </table>
    <table class="bol-tab bol-dados bol-sep">
      <colgroup><col style="width:17%"><col style="width:27%"><col style="width:17%"><col style="width:16%"><col style="width:10%"><col style="width:13%"></colgroup>
      <tr><th>Liga:</th><td class="cen">${esc(nomeLiga)}</td><th>Carga_Forno:</th><td class="cen">${fmtKg(carga) || '0'} Kg.</td>
        <th>Temp.</th><td class="cen">${n.temperatura ? esc(n.temperatura) : ''}</td></tr>
    </table>

    <div class="bol-faixa bol-sep">Carga Metálica:</div>
    <table class="bol-tab bol-carga">
      <colgroup><col style="width:10%"><col style="width:5%"><col style="width:17%"><col style="width:14%"><col style="width:14%"><col style="width:10%"><col style="width:13%"><col style="width:17%"></colgroup>
      <tr class="bol-cab"><th></th><th colspan="2">Elemento.</th><th class="grande">Solicitado.</th><th class="grande">Recarga</th>
        <th class="bol-leg"></th><th class="bol-leg bol-codcab">Cód MP NW</th><th class="bol-leg bol-ult"></th></tr>
      ${grupo('Retorno<br>' + esc(nomeLiga), ret)}
      ${grupo('Sucata', suc)}
      ${grupo('Ligas', lig)}
    </table>

    <table class="bol-tab bol-comp">
      <tr><th colspan="${ELEMENTOS.length}" class="bol-faixa-p">COMPOSIÇÃO QUÍMICA ${esc(nomeLiga)}</th></tr>
      ${cabComp('cinza')}
      <tr>${ELEMENTOS.map(e => celComp(faixas[e] ? fmtComp(faixas[e][0]) || '0,00' : '')).join('')}</tr>
      <tr>${ELEMENTOS.map(e => celComp(faixas[e] && faixas[e][1] != null && faixas[e][1] !== '' ? fmtComp(faixas[e][1]) : '')).join('')}</tr>
      <tr><th colspan="${ELEMENTOS.length}" class="bol-faixa-p">COMPOSIÇÃO QUÍMICA (ESTIMADA / REAL).</th></tr>
      ${cabComp('azul')}
      <tr>${ELEMENTOS.map(e => celComp(fmt((est || {})[e] || 0, 2))).join('')}</tr>
      <tr>${ELEMENTOS.map(e => celComp(real && real[e] != null ? fmtComp(real[e]) : '')).join('')}</tr>
    </table>
    ${n.obs ? `<table class="bol-tab bol-sep"><tr><th style="width:17%">Observações</th><td>${esc(n.obs)}</td></tr></table>` : ''}
  </div>`;
}

// =====================================================================
//  RETORNOS
// =====================================================================
function paginaRetornos() {
  marcarMenu('retornos');
  definirTrilha(['Cálculo de Liga', 'Retornos']);
  const f = filtros.retornos;
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Retornos</h1><p class="sub">Análise do laboratório e saldo de cada retorno. O saldo baixa sozinho quando uma corrida usa o retorno (inteiro ou só uma parte).</p></div>
      <button class="btn pri" id="btNovoRet">${icone('mais')} Novo retorno</button>
    </div>
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fLiga" style="width:auto;min-width:150px">${optLigas(f.liga, 'Todas as ligas')}</select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar código, liga ou relatório…" value="${esc(f.q)}"></div>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#btNovoRet').onclick = () => editarRetorno(null);
  C.querySelector('#fLiga').onchange = e => { f.liga = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  C.querySelector('#chips').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#kpis').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-cod]'); if (tr) editarRetorno(S.retPorCod.get(tr.dataset.cod)); };

  function atualizar() {
    const linhas = S.retornos.map(r => ({ r, s: S.saldos.get(r.codigo) || { verificado: 0, usado: 0, saldo: 0, baixaPlanilha: 0, usos: [] } }));
    const comSaldo = linhas.filter(x => x.s.saldo > 0.05);
    const semPeso = linhas.filter(x => !(+x.r.kgVerificado));
    const semAnalise = linhas.filter(x => !temAnalise(x.r.analise));
    const kpi = (chip, n, rot, cls) => `<button class="kpi ${cls} ${f.chip === chip ? 'sel' : ''}" data-chip="${chip}"><b>${n}</b><span>${rot}</span></button>`;
    C.querySelector('#kpis').innerHTML =
      kpi('saldo', comSaldo.length, 'Retornos com saldo', 'verde') +
      `<div class="kpi lar"><b>${fmtKg(comSaldo.reduce((s, x) => s + x.s.saldo, 0))}</b><span>Kg em saldo</span></div>` +
      kpi('sempeso', semPeso.length, 'Sem peso verificado', 'amar') +
      kpi('semanalise', semAnalise.length, 'Sem análise', 'verm');
    const chips = [['saldo', 'Com saldo'], ['todos', 'Todos'], ['sempeso', 'Sem peso'], ['semanalise', 'Sem análise'], ['zerados', 'Zerados']];
    C.querySelector('#chips').innerHTML = chips.map(([k, t]) => `<button class="ficha ${f.chip === k ? 'sel' : ''}" data-chip="${k}">${t}</button>`).join('');
    const q = f.q.trim().toLowerCase();
    let lista = linhas.filter(x => {
      if (f.chip === 'saldo' && !(x.s.saldo > 0.05)) return false;
      if (f.chip === 'sempeso' && +x.r.kgVerificado) return false;
      if (f.chip === 'semanalise' && temAnalise(x.r.analise)) return false;
      if (f.chip === 'zerados' && !(+x.r.kgVerificado && x.s.saldo <= 0.05)) return false;
      if (f.liga && !mesmaLiga(S.ligas, x.r.liga, f.liga)) return false;
      if (q && ![x.r.codigo, x.r.liga, x.r.relatorio].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    // mais novos primeiro (pelo nº anual que está no código, quando houver)
    const chave = r => { const m = String(r.codigo).match(/^\s*\d+\s*-\s*(\d+)/); return r.corridaRef && r.corridaRef.anual ? +r.corridaRef.anual : (m ? +m[1] : 0); };
    lista.sort((a, b) => String(b.r._em || '').slice(0, 10).localeCompare(String(a.r._em || '').slice(0, 10)) || chave(b.r) - chave(a.r));
    const els = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'V', 'Mo'];
    C.querySelector('#tabela').innerHTML = !lista.length ? `<div class="vazio">${S.retornos.length ? 'Nenhum retorno com esses filtros.' : 'Nenhum retorno cadastrado. Importe a planilha em Configurações ou clique em Novo retorno.'}</div>` : `
      <table class="tab"><thead><tr><th>Retorno</th><th>Liga</th><th class="dir">Verificado (kg)</th><th class="dir">Usado (kg)</th><th class="dir">Saldo (kg)</th>${els.map(e => `<th class="cen">${e}</th>`).join('')}<th>Relatório</th></tr></thead><tbody>
      ${lista.map(({ r, s }) => `<tr class="clic" data-cod="${esc(r.codigo)}">
        <td><b>${esc(r.codigo)}</b></td><td><span class="pilula lar">${esc(r.liga || '')}</span></td>
        <td class="dir num">${+r.kgVerificado ? fmtKg(r.kgVerificado) : '<span class="txt-amar">pesar</span>'}</td>
        <td class="dir num mut">${fmtKg(s.usado + s.baixaPlanilha) || '0'}</td>
        <td class="dir num"><b class="${s.saldo > 0.05 ? 'txt-verde' : s.saldo < -0.05 ? 'txt-verm' : 'mut'}">${fmtKg(s.saldo)}</b></td>
        ${els.map(e => `<td class="cen num">${r.analise && r.analise[e] != null ? fmtComp(r.analise[e]) : ''}</td>`).join('')}
        <td class="mut">${esc(r.relatorio || '')}</td></tr>`).join('')}
      </tbody></table>`;
  }
  pagina = { nome: 'retornos', atualizar };
  atualizar();
}

function editarRetorno(r) {
  const novo = !r;
  r = r || { codigo: '', liga: '', analise: {}, kgVerificado: '', relatorio: '', obs: '' };
  const s = S.saldos.get(r.codigo) || { usos: [], usado: 0, saldo: 0, baixaPlanilha: 0 };
  const usado = !novo && s.usos.length > 0;
  janela({
    titulo: novo ? 'Novo retorno' : 'Retorno ' + r.codigo,
    larga: true,
    html: `<div class="linha-campos">
        <label class="campo">Código${ent(`id="rCod" placeholder="ex.: 33-226-CRK" ${usado ? 'readonly title="Já usado em corridas: o código não pode mudar"' : ''}`, r.codigo)}</label>
        <label class="campo">Liga<select class="ent" id="rLiga">${optLigas(r.liga)}${r.liga && !ligaDe(r.liga) ? `<option selected>${esc(r.liga)}</option>` : ''}</select></label>
        <label class="campo">Nº relatório de ensaio${ent('id="rRel"', r.relatorio)}</label>
        <label class="campo">Kg verificado${entNum('id="rKg"', r.kgVerificado || '')}</label>
      </div>
      ${+r.baixaPlanilha ? `<p class="mut">Baixa que já vinha da planilha (coluna "Utilizado"): <b>${fmtKg(r.baixaPlanilha)} kg</b>.</p>` : ''}
      <h4 style="margin:16px 0 6px">Análise do laboratório (%)</h4>
      <div class="tab-wrap"><table class="tab tab-comp"><thead><tr>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead>
        <tbody><tr>${ELEMENTOS.map(e => `<td>${entNum(`data-el="${e}"`, (r.analise || {})[e])}</td>`).join('')}</tr></tbody></table></div>
      <label class="campo" style="margin-top:12px">Observações<textarea class="ent" id="rObs">${esc(r.obs || '')}</textarea></label>
      ${!novo ? `<h4 style="margin:16px 0 6px">Uso nas corridas</h4>${s.usos.length ? `<table class="tab"><thead><tr><th>Corrida</th><th>Data</th><th class="dir">Solicitado (kg)</th><th class="dir">Recarga (kg)</th></tr></thead><tbody>
        ${s.usos.map(u => `<tr><td><a href="#/corrida/${encodeURIComponent(u.corridaId)}">${esc(u.numero)}</a></td><td>${fmtData(u.data)}</td><td class="dir num">${fmtKg(u.kg)}</td><td class="dir num">${u.recarga ? fmtKg(u.recarga) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">Ainda não usado em corridas do sistema.</p>'}
        <p><b>Saldo: ${fmtKg(s.saldo)} kg</b></p>` : ''}`,
    botoes: [
      ...(!novo ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (usado) { aviso('Este retorno já foi usado em corridas; não dá para excluir.', 'erro'); return false; }
        if (!confirm('Excluir o retorno ' + r.codigo + '?')) return false;
        banco.apagar(COL.retornos, r.id);
        aviso('Retorno excluído.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const codigo = el.querySelector('#rCod').value.trim();
        if (!codigo) { aviso('Informe o código do retorno.', 'erro'); return false; }
        const id = banco.idSeguro(codigo);
        if ((novo || id !== r.id) && S.retornos.some(x => x.id === id)) { aviso('Já existe um retorno com esse código.', 'erro'); return false; }
        const analise = {};
        el.querySelectorAll('[data-el]').forEach(i => { const v = num(i.value); if (v != null) analise[i.dataset.el] = v; });
        const dados = { ...semMeta(r), codigo, liga: el.querySelector('#rLiga').value, relatorio: el.querySelector('#rRel').value.trim(),
          kgVerificado: num(el.querySelector('#rKg').value) || 0, analise, obs: el.querySelector('#rObs').value, origem: r.origem || 'sistema' };
        if (!novo && id !== r.id) banco.apagar(COL.retornos, r.id);
        banco.salvar(COL.retornos, id, dados);
        aviso('Retorno ' + codigo + ' salvo.');
      } },
    ],
  });
}

// =====================================================================
//  LIGAS E NORMAS
// =====================================================================
function paginaLigas() {
  marcarMenu('ligas');
  definirTrilha(['Cálculo de Liga', 'Ligas e normas']);
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Ligas e normas</h1><p class="sub">Faixa mínima e máxima de cada elemento (%). É a referência usada na corrida, no boletim e na conferência do laboratório.</p></div>
      <button class="btn pri" id="btNovaLiga">${icone('mais')} Nova liga</button>
    </div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#btNovaLiga').onclick = () => editarLiga(null);
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) editarLiga(S.ligas.find(l => l.id === tr.dataset.id)); };
  function atualizar() {
    C.querySelector('#tabela').innerHTML = !S.ligas.length ? '<div class="vazio">Nenhuma liga cadastrada.</div>' : `
      <table class="tab"><thead><tr><th>Liga</th><th>Também escrita como</th><th class="dir">Temp.</th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
      ${S.ligas.map(l => `<tr class="clic" data-id="${esc(l.id)}"><td><span class="pilula lar">${esc(l.nome)}</span></td><td class="mut">${esc((l.apelidos || []).join(', '))}</td>
        <td class="dir num">${l.temperatura ? esc(l.temperatura) + '°' : ''}</td>
        ${ELEMENTOS.map(e => `<td class="cen num" style="white-space:nowrap">${fmtFaixa((l.faixas || {})[e])}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;
  }
  pagina = { nome: 'ligas', atualizar };
  atualizar();
}

function editarLiga(l) {
  const nova = !l;
  l = l || { nome: '', apelidos: [], faixas: {}, temperatura: '' };
  const usada = !nova && S.corridas.some(c => mesmaLiga(S.ligas, c.liga, l.nome));
  janela({
    titulo: nova ? 'Nova liga' : 'Liga ' + l.nome, larga: true,
    html: `<div class="linha-campos">
        <label class="campo">Nome da liga${ent(`id="lNome" ${usada ? 'readonly title="Liga já usada em corridas"' : ''}`, l.nome)}</label>
        <label class="campo">Também escrita como (separe por vírgula)${ent('id="lApel" placeholder="ex.: A-532, A532"', (l.apelidos || []).join(', '))}</label>
        <label class="campo">Temperatura padrão (°C)${entNum('id="lTemp"', l.temperatura)}</label>
      </div>
      <div class="tab-wrap" style="margin-top:14px"><table class="tab tab-comp"><thead><tr><th></th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
        <tr><td><b>Mín.</b></td>${ELEMENTOS.map(e => `<td>${entNum(`data-min="${e}"`, (l.faixas[e] || [])[0])}</td>`).join('')}</tr>
        <tr><td><b>Máx.</b></td>${ELEMENTOS.map(e => `<td>${entNum(`data-max="${e}"`, (l.faixas[e] || [])[1])}</td>`).join('')}</tr>
      </tbody></table></div>
      <p class="mut">Deixe em branco os elementos que a norma não controla.</p>`,
    botoes: [
      ...(!nova ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (usada) { aviso('Esta liga tem corridas registradas; não dá para excluir.', 'erro'); return false; }
        if (!confirm('Excluir a liga ' + l.nome + '?')) return false;
        banco.apagar(COL.ligas, l.id); aviso('Liga excluída.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const nome = el.querySelector('#lNome').value.trim();
        if (!nome) { aviso('Informe o nome da liga.', 'erro'); return false; }
        const id = nova ? normLiga(nome) : l.id;
        if (nova && S.ligas.some(x => x.id === id)) { aviso('Essa liga já existe.', 'erro'); return false; }
        const faixas = {};
        for (const e of ELEMENTOS) {
          const mn = num(el.querySelector(`[data-min="${e}"]`).value), mx = num(el.querySelector(`[data-max="${e}"]`).value);
          if (mn == null && mx == null) continue;
          faixas[e] = [mn || 0, mx];
        }
        banco.salvar(COL.ligas, id, { ...semMeta(l), nome, apelidos: el.querySelector('#lApel').value.split(',').map(s => s.trim()).filter(Boolean),
          temperatura: num(el.querySelector('#lTemp').value), faixas, ordem: l.ordem ?? S.ligas.length });
        aviso('Liga ' + nome + ' salva.');
      } },
    ],
  });
}

// =====================================================================
//  SUCATAS E FERROLIGAS
// =====================================================================
function paginaMateriais() {
  marcarMenu('materiais');
  definirTrilha(['Cálculo de Liga', 'Sucatas e ferroligas']);
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Sucatas e ferroligas</h1><p class="sub">Teor de cada elemento (%) usado no cálculo da carga, e o código da matéria-prima no NW (sai no boletim).</p></div>
      <button class="btn pri" id="btNovoMat">${icone('mais')} Novo material</button>
    </div>
    <div class="cartao"><h2>Sucatas</h2><div class="tab-wrap" id="tabSuc"></div></div>
    <div class="cartao"><h2>Elementos de liga / ferroligas</h2><div class="tab-wrap" id="tabLig"></div></div>`;
  C.querySelector('#btNovoMat').onclick = () => editarMaterial(null);
  const abrir = e => { const tr = e.target.closest('tr[data-id]'); if (tr) editarMaterial(S.materiais.find(m => m.id === tr.dataset.id)); };
  C.querySelector('#tabSuc').onclick = abrir;
  C.querySelector('#tabLig').onclick = abrir;
  const tabela = lista => !lista.length ? '<div class="vazio">Nada cadastrado.</div>' : `<table class="tab"><thead><tr><th>Material</th><th>Cód. MP NW</th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
    ${lista.map(m => `<tr class="clic" data-id="${esc(m.id)}" style="${m.ativo === false ? 'opacity:.5' : ''}"><td><b>${esc(m.nome)}</b>${m.ativo === false ? ' <span class="pilula">inativo</span>' : ''}</td><td class="mut">${esc(m.mp || '')}</td>
      ${ELEMENTOS.map(e => `<td class="cen num">${(m.teores || {})[e] != null ? fmt(m.teores[e], m.teores[e] < 0.1 ? 3 : 2) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  function atualizar() {
    C.querySelector('#tabSuc').innerHTML = tabela(sucatas());
    C.querySelector('#tabLig').innerHTML = tabela(ferroligas());
  }
  pagina = { nome: 'materiais', atualizar };
  atualizar();
}

function editarMaterial(m) {
  const novo = !m;
  m = m || { nome: '', tipo: 'sucata', mp: '', teores: {}, ativo: true };
  janela({
    titulo: novo ? 'Novo material' : m.nome, larga: true,
    html: `<div class="linha-campos">
        <label class="campo">Nome${ent('id="mNome"', m.nome)}</label>
        <label class="campo">Tipo<select class="ent" id="mTipo"><option value="sucata" ${m.tipo === 'sucata' ? 'selected' : ''}>Sucata</option><option value="liga" ${m.tipo !== 'sucata' ? 'selected' : ''}>Elemento de liga / ferroliga</option></select></label>
        <label class="campo">Cód. MP NW${ent('id="mMp"', m.mp)}</label>
        <label class="campo">Situação<select class="ent" id="mAtivo"><option value="1">Ativo</option><option value="0" ${m.ativo === false ? 'selected' : ''}>Inativo (some da corrida)</option></select></label>
      </div>
      <h4 style="margin:16px 0 6px">Teores (%)</h4>
      <div class="tab-wrap"><table class="tab tab-comp"><thead><tr>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead>
        <tbody><tr>${ELEMENTOS.map(e => `<td>${entNum(`data-el="${e}"`, (m.teores || {})[e])}</td>`).join('')}</tr></tbody></table></div>`,
    botoes: [
      ...(!novo ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (S.corridas.some(c => c.materiais && c.materiais[m.id])) { aviso('Material usado em corridas. Marque como inativo em vez de excluir.', 'erro'); return false; }
        if (!confirm('Excluir ' + m.nome + '?')) return false;
        banco.apagar(COL.materiais, m.id); aviso('Material excluído.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const nome = el.querySelector('#mNome').value.trim();
        if (!nome) { aviso('Informe o nome.', 'erro'); return false; }
        const teores = {};
        el.querySelectorAll('[data-el]').forEach(i => { const v = num(i.value); if (v != null) teores[i.dataset.el] = v; });
        const id = novo ? banco.idSeguro(normLiga(nome).toLowerCase() || 'mat' + Date.now()) : m.id;
        if (novo && S.materiais.some(x => x.id === id)) { aviso('Já existe um material com esse nome.', 'erro'); return false; }
        banco.salvar(COL.materiais, id, { ...semMeta(m), nome, tipo: el.querySelector('#mTipo').value, mp: el.querySelector('#mMp').value.trim(),
          ativo: el.querySelector('#mAtivo').value === '1', teores, ordem: m.ordem ?? S.materiais.length });
        aviso(nome + ' salvo.');
      } },
    ],
  });
}

// =====================================================================
//  CONFIGURAÇÕES
// =====================================================================
function paginaConfig() {
  marcarMenu('config');
  definirTrilha(['Sistema', 'Configurações']);
  C.innerHTML = `
    <div class="cab"><div class="cresce"><h1 class="titulo">Configurações</h1><p class="sub">Forno, numeração das corridas, importação da planilha e cópia de segurança.</p></div></div>
    <div class="grade2">
      <div class="cartao"><h2>Forno</h2><div class="corpo" id="boxForno"></div></div>
      <div class="cartao"><h2>Numeração das corridas</h2><div class="corpo" id="boxCont"></div></div>
    </div>
    <div class="cartao"><h2>Importar a planilha Calculo de Ligas</h2><div class="corpo">
      <p style="margin-top:0">Traz da planilha <b>.xlsm</b>: as normas das ligas, os retornos (com análise e saldo), o histórico de corridas (aba Banco de dados) e os contadores. Pode importar de novo quantas vezes precisar; o que veio da planilha é atualizado, o que foi criado no sistema não é apagado.</p>
      <p class="mut">Faça a importação final no dia em que pararem de usar a planilha, para os saldos baterem.</p>
      <label class="btn">${icone('subir')} Escolher planilha…<input type="file" id="arqPlan" accept=".xlsm,.xlsx,.xls" class="oculto"></label>
      <span class="mut" id="statusImp" style="margin-left:10px"></span>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa um arquivo com tudo do Cálculo de Liga (corridas, retornos, ligas, materiais e configurações). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
      <label class="btn">${icone('subir')} Restaurar cópia…<input type="file" id="arqBkp" accept=".json" class="oculto"></label>
    </div></div>
    <div class="cartao"><h2>Banco de dados</h2><div class="corpo" id="boxBanco"></div></div>`;

  C.querySelector('#arqPlan').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilha(f); };
  C.querySelector('#btExp').onclick = exportarBackup;
  C.querySelector('#arqBkp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) restaurarBackup(f); };

  function atualizar() {
    const c = cfg();
    const forno = c.forno || {};
    const ct = c.contadores || {};
    C.querySelector('#boxForno').innerHTML = `<div class="linha-campos">
        <label class="campo">Carga mínima (alerta) kg${entNum('id="fMin"', forno.min)}</label>
        <label class="campo">Carga máxima kg${entNum('id="fMax"', forno.max)}</label></div>
      <button class="btn" style="margin-top:12px" id="btForno">${icone('salvar')} Salvar forno</button>`;
    C.querySelector('#boxCont').innerHTML = `<div class="linha-campos">
        <label class="campo">Última corrida anual${entNum('id="cAn"', ct.anual)}</label>
        <label class="campo">Última corrida do refratário${entNum('id="cRef"', ct.refratario)}</label></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="btCont">${icone('salvar')} Salvar numeração</button>
        <button class="btn" id="btRefr" title="Zera o contador do refratário">${icone('chama')} Começar novo refratário</button></div>
      ${(c.campanhas || []).length ? `<p class="mut" style="margin-bottom:0">Refratários anteriores: ${c.campanhas.slice(-6).map(x => `${fmtData(x.fim)} (${x.corridas} corridas)`).join(' · ')}</p>` : ''}`;
    const s = banco.situacao();
    C.querySelector('#boxBanco').innerHTML = s.modo === 'local'
      ? `<div class="faixa lar" style="margin:0"><b>Modo local.</b> Os dados estão só neste navegador. Para todos usarem os mesmos dados, preencha o <code>config.js</code> com o bloco do Firebase (veja o LEIA-ME).</div>`
      : `Firebase: projeto <b>${esc(est.cfg.projectId)}</b> · usuário <b>${esc(s.usuario && s.usuario.email)}</b>`;
    C.querySelector('#btForno').onclick = () => {
      banco.salvar(COL.config, 'liga', { ...cfg(), forno: { min: num(C.querySelector('#fMin').value), max: num(C.querySelector('#fMax').value) } });
      aviso('Forno salvo.');
    };
    C.querySelector('#btCont').onclick = () => {
      banco.salvar(COL.config, 'liga', { ...cfg(), contadores: { anual: num(C.querySelector('#cAn').value) || 0, refratario: num(C.querySelector('#cRef').value) || 0 } });
      aviso('Numeração salva.');
    };
    C.querySelector('#btRefr').onclick = () => {
      const ct2 = cfg().contadores || {};
      if (!confirm(`Começar um novo refratário? A próxima corrida será a nº 1 do refratário (a anual continua em ${(+ct2.anual || 0) + 1}).`)) return;
      const campanhas = [...(cfg().campanhas || []), { fim: hoje(), corridas: +ct2.refratario || 0, ultimaAnual: +ct2.anual || 0 }];
      banco.salvar(COL.config, 'liga', { ...cfg(), contadores: { ...ct2, refratario: 0 }, campanhas });
      aviso('Novo refratário: próxima corrida é a nº 1.');
    };
  }
  pagina = { nome: 'config', atualizar };
  atualizar();
}

async function importarPlanilha(arquivo) {
  const st = C.querySelector('#statusImp');
  st.textContent = 'Lendo a planilha…';
  let dados;
  try { dados = await lerPlanilha(arquivo, S.ligas); }
  catch (e) { console.error(e); st.textContent = ''; return aviso('Não consegui ler a planilha: ' + e.message, 'erro'); }
  st.textContent = '';
  const r = dados.resumo;
  const jaSistema = dados.retornos.filter(x => { const a = S.retornos.find(y => y.id === x.id); return a && a.origem === 'sistema'; });
  janela({
    titulo: 'Importar ' + arquivo.name, larga: true,
    html: `<p style="margin-top:0">Escolha o que trazer:</p>
      <label class="opcao"><input type="checkbox" id="iLig" checked> <b>Normas das ligas</b>: ${r.ligas} ligas${r.ligasNovas ? `, ${r.ligasNovas} novas` : ''}.
        ${r.ligasMudaram.length ? `<br><span class="txt-amar">Faixas diferentes das do sistema: ${esc(r.ligasMudaram.join(', '))}. Se importar, valem as da planilha.</span>` : ''}</label>
      <label class="opcao"><input type="checkbox" id="iRet" checked> <b>Retornos</b>: ${r.retornos} (${r.retornosComSaldo} com saldo, ${r.retornosSemAnalise} sem análise).
        ${jaSistema.length ? `<br><span class="txt-amar">${jaSistema.length} já foram criados no sistema e não serão mexidos.</span>` : ''}</label>
      <label class="opcao"><input type="checkbox" id="iCor" checked> <b>Histórico de corridas</b>: ${r.corridas} corridas${r.periodo ? ` (${fmtData(r.periodo[0])} a ${fmtData(r.periodo[1])})` : ''}; ${r.corridasComRetornoGerado} ligadas ao retorno que geraram.
        <br><span class="mut">Entram como "histórico da planilha": não mexem no saldo dos retornos (a baixa já vem da coluna Utilizado).</span></label>
      <label class="opcao"><input type="checkbox" id="iCfg" ${dados.config ? 'checked' : 'disabled'}> <b>Contadores e forno</b>${dados.config ? `: última anual ${dados.config.contadores.anual}, refratário ${dados.config.contadores.refratario}, forno ${dados.config.forno.min}–${dados.config.forno.max} kg` : ' (aba SET. não encontrada)'}.</label>
      ${dados.avisos.length ? `<div class="faixa lar" style="margin-top:12px">${dados.avisos.slice(0, 8).map(esc).join('<br>')}${dados.avisos.length > 8 ? `<br>… e mais ${dados.avisos.length - 8}` : ''}</div>` : ''}
      <div id="progImp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      if (el.querySelector('#iLig').checked) dados.ligas.forEach((l, i) => {
        const atual = S.ligas.find(x => x.id === l.id);
        ops.push({ col: COL.ligas, id: l.id, dados: { ...(atual ? semMeta(atual) : {}), nome: l.nome, apelidos: l.apelidos, faixas: l.faixas,
          temperatura: (atual && atual.temperatura) || l.temperatura, ordem: atual ? atual.ordem : S.ligas.length + i } });
      });
      if (el.querySelector('#iRet').checked) dados.retornos.forEach(x => {
        const atual = S.retornos.find(y => y.id === x.id);
        if (atual && atual.origem === 'sistema') return;
        const { id, ...resto } = x;
        ops.push({ col: COL.retornos, id, dados: { ...(atual ? semMeta(atual) : {}), ...resto } });
      });
      if (el.querySelector('#iCor').checked) dados.corridas.forEach(c => { const { id, ...resto } = c; ops.push({ col: COL.corridas, id, dados: resto }); });
      if (el.querySelector('#iCfg').checked && dados.config) ops.push({ col: COL.config, id: 'liga', dados: { ...cfg(), ...dados.config } });
      if (!ops.length) { aviso('Nada marcado para importar.', 'erro'); return false; }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const prog = el.querySelector('#progImp');
      try {
        await banco.emLote(ops, (feito, total) => { prog.textContent = `Gravando ${feito} de ${total}…`; });
        aviso(`Importação concluída: ${ops.length} registros.`);
      } catch (e) {
        console.error(e);
        aviso('Erro na importação: ' + e.message, 'erro');
        el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        return false;
      }
    } }],
  });
}

async function exportarBackup() {
  const colecoes = {};
  for (const [k, col] of Object.entries(COL)) colecoes[col] = (await banco.lerColecao(col)).map(semMetaId);
  const nome = 'engenharia-liga-backup-' + hoje() + '.json';
  baixarArquivo(nome, JSON.stringify({ sistema: 'Sistema Engenharia · Cálculo de Liga', exportadoEm: new Date().toISOString(), colecoes }, null, 1));
  aviso('Cópia baixada: ' + nome);
}
function semMetaId(d) { const x = { ...d }; delete x._em; delete x._por; return x; }

async function restaurarBackup(arquivo) {
  let j;
  try { j = JSON.parse(await arquivo.text()); } catch { return aviso('Arquivo inválido.', 'erro'); }
  if (!j || !j.colecoes) return aviso('Este arquivo não é uma cópia do Cálculo de Liga.', 'erro');
  const total = Object.values(j.colecoes).reduce((s, l) => s + l.length, 0);
  if (!confirm(`Restaurar ${total} registros da cópia de ${fmtData((j.exportadoEm || '').slice(0, 10))}? Registros com o mesmo código serão substituídos.`)) return;
  const ops = [];
  for (const [col, lista] of Object.entries(j.colecoes)) {
    if (!Object.values(COL).includes(col)) continue;
    for (const d of lista) { const { id, ...resto } = d; if (id) ops.push({ col, id, dados: resto }); }
  }
  await banco.emLote(ops);
  aviso('Cópia restaurada.');
}
