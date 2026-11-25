// =====================================================================
//  certificados/certificados.js — módulo Certificados de Qualidade
//  Telas: Busca (por OP, corrida, cliente…), Certificado (editado direto
//  na folha, salva sozinho), Assinatura e backup.
//  Ligação com o Cálculo de Liga: o certificado pode nascer de uma corrida
//  (corrida, material, OP da liga e análise do laboratório já preenchidos)
//  e a conferência usa as normas de "Ligas e normas".
// =====================================================================
import * as banco from '../comum/banco.js';
import { montar, definirTrilha, marcarMenu, aviso, janela, esc, fmtData, icone, podeEditar, baixarArquivo } from '../comum/casca.js';
import { COL as COL_LIGA, acharLiga, numeroCorrida, temAnalise, ELEMENTOS, ELEMENTOS_LAB_EXTRA } from '../liga/calculo.js?v=1.5.1';
import { lerLaudoOuAvisar } from '../liga/laudo.js?v=1.5.6';
import { criarCertificadosAuto, codigoRetornoDoCert as codigoRetornoDoCertAuto } from './auto.js?v=1.5.5';
import {
  QALL, FIXED, DEF, clone, hojeBR, dateKey, abaFrom, setPath, fmtNum, parseNum, upgradeCert, setQuimica, SEC_AFTER_Q, shiftNum, certHTML,
  unidadesProdutos, produtosParte, rotuloPagina, certContinuacao,
} from './folha.js?v=1.4.3';

const COL = { certs: 'eng_certificados' };
const CFG_ID = 'certificado';                       // eng_config/certificado → { assinatura }
const LOGO = banco.raiz('comum/logo.png');

const S = { certs: [], corridas: [], ligas: [], retornos: [], cfg: null, chegou: {} };
let pagina = null;
let ED = true;

await montar({ ativo: 'certificados', trilha: ['Certificados'] });
ED = podeEditar('certificados');
const C = document.getElementById('conteudo');
C.innerHTML = '<div class="vazio">Carregando dados…</div>';

function chegou(nome) {
  S.chegou[nome] = true;
  if (['certs', 'corridas', 'ligas', 'retornos', 'cfg'].every(k => S.chegou[k])) { if (!pagina) rotear(); else pagina.atualizar(); verCertificadosAuto(); }
}
// Retornos com análise que ainda não têm certificado ganham um (só quem edita; uma rodada por vez)
let criandoAuto = false;
async function verCertificadosAuto() {
  if (!ED || criandoAuto) return;
  criandoAuto = true;
  try {
    const novos = await criarCertificadosAuto(S, banco);
    if (novos.length) aviso(novos.length === 1 ? `Certificado criado para o retorno ${novos[0].criadoDoRetorno}.` : `${novos.length} certificados criados para os retornos com análise.`);
  } catch (e) { console.warn('certificados automáticos', e); }
  finally { criandoAuto = false; }
}
const erro = e => { C.innerHTML = `<div class="faixa verm">${e && /permission/i.test(e.code || e.message || '') ? 'Seu usuário não tem permissão para ver os certificados.' : 'Erro ao ler o banco: ' + esc(e && (e.message || e.code))}</div>`; };
banco.ouvirColecao(COL.certs, l => { S.certs = l.map(upgradeCert); chegou('certs'); }, erro);
banco.ouvirColecao(COL_LIGA.corridas, l => { S.corridas = l; chegou('corridas'); }, erro);
banco.ouvirColecao(COL_LIGA.ligas, l => { S.ligas = l; chegou('ligas'); }, erro);
banco.ouvirColecao(COL_LIGA.retornos, l => { S.retornos = l; chegou('retornos'); }, erro);
banco.ouvirDoc(COL_LIGA.config, CFG_ID, d => { S.cfg = d || {}; chegou('cfg'); }, erro);
const assinatura = () => (S.cfg && S.cfg.assinatura) || '';

// ---------------------------------------------------------------------
// Rotas: #/lista  #/c/<id>  #/novo?corrida=<id>  #/config
// ---------------------------------------------------------------------
window.addEventListener('hashchange', () => { salvarPendente(); rotear(); });
window.addEventListener('beforeunload', salvarPendente);
function rotear() {
  const [caminho, busca] = (location.hash || '#/lista').slice(2).split('?');
  const h = caminho.split('/');
  window.scrollTo(0, 0);
  if (h[0] === 'c' && h[1]) return paginaEditor(decodeURIComponent(h[1]));
  if (h[0] === 'config') return paginaConfig();
  paginaLista();
  if (h[0] === 'novo' && ED) { history.replaceState(null, '', '#/lista'); novoCertificado(new URLSearchParams(busca || '').get('corrida') || ''); }
}

// ---------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const opTokens = s => String(s || '').split(/[^0-9A-Za-z]+/).filter(Boolean);
const primeiraLinha = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const fmtQ = v => (v == null || v === '' ? '' : String(v).replace('.', ','));
const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nextOrdem = () => Math.max(Date.now(), S.certs.reduce((m, c) => Math.max(m, +c.ordem || 0), 0) + 1);
const maisRecente = () => S.certs.slice().sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0];
const corridaDe = id => S.corridas.find(c => c.id === id);
const nomeCorrida = c => `${c.refratario ?? '?'}-${c.anual ?? '?'}`;     // formato do certificado: "33-229"
const descCorrida = c => `${numeroCorrida(c)} · ${c.liga || '?'} · ${fmtData(c.data)}${(c.ops || []).length ? ' · OP ' + c.ops.join(', ') : ''}${c.fs ? ' · ' + c.fs : ''}`;

// ---- Vínculo certificado → retorno (só nesse sentido) ----
// Retorno vinculado: o escolhido; senão o da corrida ligada; senão o de mesmo nº de corrida (auto.js). '-' = sem vínculo.
const codigoRetornoDoCert = c => codigoRetornoDoCertAuto(c, S);
function retornoDoCert(c) { const cod = codigoRetornoDoCert(c); return cod ? S.retornos.find(r => r.codigo === cod) || null : null; }
// Leva a análise do retorno para a folha, menos os elementos mudados à mão no certificado (cert.quimicaManual).
// O que muda no certificado nunca volta para o retorno. Devolve true se a folha mudou.
function sincronizarQuimica(c) {
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
const marcarManual = (c, els) => { c.quimicaManual = c.quimicaManual || {}; els.forEach(e => { c.quimicaManual[e] = true; }); };

// Análise da corrida para o certificado: a do retorno que ela gerou (PDF do laboratório); se não houver, a antiga da corrida
function analiseDaCorrida(c) {
  if (!c) return null;
  const r = c.retornoGerado && S.retornos.find(x => x.codigo === c.retornoGerado);
  if (r && temAnalise(r.analise)) return { valores: r.analise, fonte: 'análise do retorno ' + r.codigo };
  if (temAnalise(c.real)) return { valores: c.real, fonte: 'resultado do laboratório da corrida' };
  return null;
}
function quimicaDe(valores) {
  const q = {};
  for (const e of [...ELEMENTOS, ...ELEMENTOS_LAB_EXTRA]) if (valores[e] != null && valores[e] !== '') q[e] = fmtQ(valores[e]);
  return q;
}

// Norma usada na conferência: a escolhida, ou a da liga da corrida, ou a do material
function ligaRef(r) {
  if (r.ligaRef === '-') return null;
  if (r.ligaRef) return S.ligas.find(l => l.nome === r.ligaRef) || null;
  const c = corridaDe(r.corridaId);
  return (c && acharLiga(S.ligas, c.liga)) || acharLiga(S.ligas, r.material) || null;
}
function conferir(r) {
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
const pendentes = new Map();   // id → { cert, timer }
function agendarSalvar(c) {
  const p = pendentes.get(c.id);
  if (p) clearTimeout(p.timer);
  pendentes.set(c.id, { cert: c, timer: setTimeout(() => salvarAgora(c.id), 700) });
  estadoSalvo('Salvando…');
}
function salvarAgora(id) {
  const p = pendentes.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pendentes.delete(id);
  gravar(p.cert);
}
function salvarPendente() { [...pendentes.keys()].forEach(salvarAgora); }
function gravar(c) {
  const u = banco.usuario();
  c.alteradoEm = Date.now();
  c.alteradoPor = u && banco.modo() === 'firebase' ? u.email : '';
  const d = clone(c); delete d.id; delete d._em; delete d._por;
  banco.salvar(COL.certs, c.id, d).then(() => estadoSalvo('Salvo')).catch(e => { estadoSalvo('Erro ao salvar', true); aviso('Erro ao salvar: ' + e.message, 'erro'); });
}
function estadoSalvo(t, erro) { const el = document.getElementById('estadoSalvo'); if (el) { el.textContent = t; el.classList.toggle('txt-verm', !!erro); } }

// =====================================================================
//  BUSCA (lista)
// =====================================================================
const busca = { q: '', sel: new Set() };
function paginaLista() {
  marcarMenu('certificados');
  definirTrilha(['Qualidade', 'Certificados']);
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Certificados de Qualidade</h1><p class="sub">Busque pela OP para ver em qual corrida ela está, ou por corrida, material, cliente, pedido, nº do certificado.</p></div>
      ${ED ? `<button class="btn pri" id="btNovo">${icone('mais')} Novo certificado</button>` : ''}
    </div>
    <div class="cartao"><div class="corpo">
      <div class="busca grande">${icone('busca')}<input class="ent" id="q" placeholder="Digite a OP (ex.: 3323), a corrida (ex.: 33-229), o cliente…" value="${esc(busca.q)}" autocomplete="off"></div>
      <div class="resbox" id="resbox"></div>
    </div></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:0">
      <span class="mut" id="cnt"></span><span class="cresce"></span>
      <span class="mut" id="selInfo"></span>
      <button class="btn peq" id="btLimparSel">Limpar seleção</button>
      <button class="btn peq" id="btImprSel">${icone('impressora')} Imprimir selecionados</button>
    </div><div class="tab-wrap" id="tabela"></div></div>`;
  const q = C.querySelector('#q');
  q.oninput = () => { busca.q = q.value; atualizar(); };
  q.onkeydown = e => {
    if (e.key === 'Enter') { const b = C.querySelectorAll('#resbox [data-abrir]'); const linhas = C.querySelectorAll('#tabela tr[data-id]'); if (b.length === 1) abrir(b[0].dataset.abrir); else if (linhas.length === 1) abrir(linhas[0].dataset.id); }
    if (e.key === 'Escape') { q.value = ''; busca.q = ''; atualizar(); }
  };
  setTimeout(() => q.focus(), 30);
  const bn = C.querySelector('#btNovo'); if (bn) bn.onclick = () => novoCertificado('');
  C.querySelector('#resbox').onclick = e => { const b = e.target.closest('[data-abrir]'); if (b) abrir(b.dataset.abrir); };
  C.querySelector('#btLimparSel').onclick = () => { busca.sel.clear(); atualizar(); };
  C.querySelector('#btImprSel').onclick = () => imprimir(S.certs.filter(c => busca.sel.has(c.id)).sort((a, b) => (b.ordem || 0) - (a.ordem || 0)));
  C.querySelector('#tabela').onclick = e => {
    const ck = e.target.closest('[data-ck]');
    if (ck) { ck.checked ? busca.sel.add(ck.dataset.ck) : busca.sel.delete(ck.dataset.ck); atualizarSel(); return; }
    if (e.target.closest('td.ck')) return;
    const ckAll = e.target.closest('#ckAll');
    if (ckAll) return;
    const p = e.target.closest('[data-imprimir]'); if (p) { imprimir([S.certs.find(c => c.id === p.dataset.imprimir)]); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) abrir(tr.dataset.id);
  };
  C.querySelector('#tabela').onchange = e => { if (e.target.id === 'ckAll') { [...C.querySelectorAll('[data-ck]')].forEach(ck => { ck.checked = e.target.checked; e.target.checked ? busca.sel.add(ck.dataset.ck) : busca.sel.delete(ck.dataset.ck); }); atualizarSel(); } };

  function atualizarSel() {
    const n = busca.sel.size;
    C.querySelector('#selInfo').textContent = n ? n + ' selecionado(s)' : '';
    C.querySelector('#btLimparSel').style.display = n ? '' : 'none';
    C.querySelector('#btImprSel').disabled = !n;
  }
  function atualizar() {
    const qv = busca.q.trim();
    const numerico = /^\d{2,}$/.test(qv);
    const linhas = [], exatas = [];
    const qn = norm(qv).replace(/\s*([-/])\s*/g, '$1');
    for (const r of S.certs) {
      const onde = numerico ? opsOnde(r, qv) : [];
      if (onde.length) { exatas.push({ r, onde }); linhas.push({ r, hit: true }); continue; }
      if (!qn) { linhas.push({ r, hit: false }); continue; }
      const h = norm(textoBusca(r)).replace(/\s*([-/])\s*/g, '$1');
      const bate = /\d[-/]\d/.test(qn) ? new RegExp('(^|[^0-9a-z])' + qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^0-9a-z])').test(h) : (h.includes(qn) || qn.split(/\s+/).every(t => h.includes(t)));
      if (bate) linhas.push({ r, hit: false });
    }
    linhas.sort((a, b) => (b.hit - a.hit) || (b.r.ordem || 0) - (a.r.ordem || 0));
    const rb = C.querySelector('#resbox');
    rb.className = 'resbox';
    if (!qv) { rb.classList.add('ocioso'); rb.innerHTML = 'Digite uma OP (ex.: 3323) para ver em qual corrida ela está — ou procure por corrida, material, cliente, pedido…'; }
    else if (numerico) {
      rb.innerHTML = exatas.length
        ? 'Encontrada na(s) corrida(s): ' + exatas.map(x => `<button class="chip" data-abrir="${esc(x.r.id)}">${esc(x.r.aba || x.r.corrida || 'certificado')}<small>${esc(x.onde.join(', '))}</small></button>`).join('') + `<span class="qtd">Qtd. encontrada: ${exatas.length}</span>`
        : `<span class="txt-verm">OP ${esc(qv)} NÃO encontrada em nenhum certificado</span>` + (linhas.length ? `<span class="qtd">${linhas.length} parecido(s) abaixo</span>` : '');
    } else rb.innerHTML = linhas.length === 1 ? `1 certificado encontrado: <button class="chip" data-abrir="${esc(linhas[0].r.id)}">${esc(linhas[0].r.aba)}</button><span class="qtd">Enter abre</span>` : linhas.length ? `${linhas.length} certificados encontrados` : `<span class="txt-verm">Nada encontrado para “${esc(qv)}”</span>`;
    C.querySelector('#cnt').textContent = qv ? `${linhas.length} de ${S.certs.length} certificados` : `${S.certs.length} certificados`;
    const mostrar = linhas.slice(0, 400);
    C.querySelector('#tabela').innerHTML = !linhas.length ? `<div class="vazio">${S.certs.length ? 'Nenhum certificado corresponde à busca.' : 'Nenhum certificado ainda.' + (ED ? ' Clique em <b>Novo certificado</b> — ou, na ficha da corrida, em <b>Novo certificado</b> — ou traga os antigos em <a href="#/config">Assinatura e backup</a>.' : '')}</div>` : `
      <table class="tab tab-cert"><thead><tr><th class="ck"><input type="checkbox" id="ckAll" title="Selecionar todos"></th><th>Corrida (aba)</th><th>OPs / Itens</th><th>Material</th><th>OP da liga</th><th>Cliente</th><th>Certificado nº</th><th>Emissão</th><th></th></tr></thead><tbody>
      ${mostrar.map(({ r, hit }) => { const certs = primeiraLinha(r.certNo); const cor = corridaDe(r.corridaId); return `<tr class="clic ${hit ? 'hit' : ''}" data-id="${esc(r.id)}">
        <td class="ck"><input type="checkbox" data-ck="${esc(r.id)}" ${busca.sel.has(r.id) ? 'checked' : ''}></td>
        <td><b>${esc(r.aba || r.corrida)}</b>${r.mostrarQuimica === false ? '<div class="mut" style="font-size:11px">sem análise química</div>' : ''}${cor ? `<div class="mut" style="font-size:11px">${icone('chama')} corrida ${esc(numeroCorrida(cor))}</div>` : ''}</td>
        <td class="ops">${esc(r.opsItens)}</td><td>${esc(r.material)}</td><td class="num"><b>${esc(r.opLiga)}</b></td>
        <td class="cli">${esc(r.cliente)}</td><td class="num">${esc(certs[0] || '')}${certs.length > 1 ? ` <small class="mut">+${certs.length - 1}</small>` : ''}</td>
        <td class="num">${esc(r.dataEmissao)}</td>
        <td><button class="botao-ic" data-imprimir="${esc(r.id)}" title="Imprimir / PDF">${icone('impressora')}</button></td></tr>`; }).join('')}
      </tbody></table>${linhas.length > 400 ? `<div class="vazio">Mostrando 400 de ${linhas.length}. Refine a busca.</div>` : ''}`;
    atualizarSel();
  }
  pagina = { atualizar };
  atualizar();
}
function textoBusca(r) {
  const c = corridaDe(r.corridaId);
  return [r.aba, r.corrida, r.material, r.cliente, r.certNo, r.pedido, r.referencia, r.nfe, r.opLiga, r.opsItens, r.opsBusca,
    (r.produtos || []).map(p => p.titulo + ' ' + (p.linhas || []).join(' ')).join(' '), c && c.fs, c && (c.ops || []).join(' ')].join(' | ');
}
function opsOnde(r, q) {
  const onde = [];
  if (opTokens(r.opsItens).includes(q)) onde.push('OPs/Itens');
  if (opTokens(r.opLiga).includes(q)) onde.push('OP da liga');
  if (opTokens(r.referencia).includes(q)) onde.push('Referência');
  if (opTokens(r.opsBusca).includes(q)) onde.push('OPs extras');
  return onde;
}
const abrir = id => { location.hash = '#/c/' + encodeURIComponent(id); };

// =====================================================================
//  NOVO CERTIFICADO (de uma corrida do sistema ou em branco)
// =====================================================================
function novoCertificado(corridaId) {
  const corridas = S.corridas.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (+b.anual || 0) - (+a.anual || 0));
  const bases = S.certs.slice().sort((a, b) => (b.ordem || 0) - (a.ordem || 0)).slice(0, 300);
  const pre = corridaDe(corridaId);
  janela({
    titulo: 'Novo certificado', larga: true,
    html: `<label class="campo">Corrida do sistema<div class="busca">${icone('busca')}<input class="ent" id="nBusca" placeholder="filtrar por nº da corrida, OP, FS, liga…" autocomplete="off"></div>
        <select class="ent" id="nCorr" size="6" style="margin-top:6px"></select>
        <small class="mut" id="nInfo">Escolha a corrida: corrida, material, OP da liga e análise química vêm preenchidos. Ou deixe sem corrida e preencha à mão.</small></label>
      <div class="linha-campos" style="margin-top:12px">
        <label class="campo">Corrida / lote *<input class="ent" id="nCor" placeholder="ex.: 33-229" autocomplete="off"></label>
        <label class="campo">Material<input class="ent" id="nMat" list="dlMat" autocomplete="off"><datalist id="dlMat">${S.ligas.map(l => `<option value="${esc(l.nome)}">`).join('')}</datalist></label>
        <label class="campo">OP da liga<input class="ent" id="nOpL" autocomplete="off"></label>
        <label class="campo">OPs / Itens<input class="ent" id="nOps" autocomplete="off" placeholder="3305 - 3306 - 3307"></label>
      </div>
      <label class="campo" style="margin-top:12px">Copiar cliente, pedido e produtos de
        <select class="ent" id="nBase"><option value="">— Em branco —</option>${bases.map(c => `<option value="${esc(c.id)}">${esc(c.aba || c.corrida)}${c.cliente ? ' · ' + esc(String(c.cliente).slice(0, 40)) : ''}</option>`).join('')}</select>
        <small class="mut">Nº do certificado e NF-e começam em branco. Datas = hoje. Os textos fixos (fabricante, declaração, aprovador…) vêm do último certificado.</small></label>
      <label class="opcao" style="margin-top:12px"><input type="checkbox" id="nQuim" checked> Incluir análise química no certificado</label>`,
    aoAbrir: el => {
      const sel = el.querySelector('#nCorr');
      const pintar = () => {
        const f = norm(el.querySelector('#nBusca').value).trim();
        const lista = corridas.filter(c => !f || norm(descCorrida(c) + ' ' + nomeCorrida(c) + ' ' + (c.opsTexto || '')).includes(f)).slice(0, 200);
        sel.innerHTML = `<option value="">— Sem corrida do sistema —</option>` + lista.map(c => `<option value="${esc(c.id)}" ${pre && pre.id === c.id ? 'selected' : ''}>${esc(descCorrida(c))}${analiseDaCorrida(c) ? '' : '  (sem análise)'}</option>`).join('');
      };
      const escolher = () => {
        const c = corridaDe(sel.value);
        const info = el.querySelector('#nInfo');
        if (!c) { info.textContent = 'Sem corrida do sistema: preencha à mão.'; return; }
        el.querySelector('#nCor').value = nomeCorrida(c);
        el.querySelector('#nMat').value = c.liga || '';
        el.querySelector('#nOpL').value = (c.ops || []).join(' - ');
        const a = analiseDaCorrida(c);
        info.innerHTML = a ? `Análise química: <b>${esc(a.fonte)}</b>.` : '<span class="txt-amar">Esta corrida ainda não tem análise do laboratório: a análise fica em branco (dá para trazer depois, na tela do certificado).</span>';
      };
      el.querySelector('#nBusca').oninput = pintar;
      sel.onchange = escolher;
      pintar();
      if (pre) escolher();
      setTimeout(() => (pre ? el.querySelector('#nOps') : el.querySelector('#nBusca')).focus(), 50);
    },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Criar e abrir', cls: 'pri', acao: el => {
      const v = s => el.querySelector(s).value.trim();
      const corTxt = v('#nCor');
      if (!corTxt) { aviso('Informe a corrida / lote.', 'erro'); el.querySelector('#nCor').focus(); return false; }
      const cor = corridaDe(el.querySelector('#nCorr').value);
      const c = clone(DEF);
      const L = maisRecente();
      if (L) { FIXED.forEach(k => { if (L[k] !== undefined) c[k] = clone(L[k]); }); if (L.mostrarQuimica === false && /^\s*\d+\s*[—–-]/.test(c.tituloQuimica || '')) SEC_AFTER_Q.forEach(k => { c[k] = shiftNum(c[k], +1); }); }
      const b = S.certs.find(x => x.id === el.querySelector('#nBase').value);
      if (b) ['cliente', 'pedido', 'referencia', 'produtos'].forEach(k => { c[k] = clone(b[k]); });
      if (!c.produtos.length) c.produtos = [{ titulo: '', linhas: ['Item: ', 'Quantidade(s): '] }];
      const a = analiseDaCorrida(cor);
      Object.assign(c, {
        id: uid(), ordem: nextOrdem(), corrida: corTxt, aba: abaFrom(corTxt), abaAuto: true, material: v('#nMat'), opLiga: v('#nOpL'), opsItens: v('#nOps'),
        dataEmissao: hojeBR(), dataAprovacao: hojeBR(), quimica: a ? quimicaDe(a.valores) : {}, corridaId: cor ? cor.id : '',
      });
      if (!el.querySelector('#nQuim').checked) setQuimica(c, false);
      gravar(c);
      if (!S.certs.some(x => x.id === c.id)) S.certs.push(c);
      history.replaceState(null, '', '#/c/' + encodeURIComponent(c.id));
      paginaEditor(c.id, 'certNo');
    } }],
  });
}

// =====================================================================
//  CERTIFICADO (editor na folha)
// =====================================================================
function paginaEditor(id, focar) {
  marcarMenu('certificados');
  const orig = S.certs.find(c => c.id === id);
  if (!orig) { C.innerHTML = `<div class="faixa verm">Certificado não encontrado.</div><a class="btn" href="#/lista">${icone('voltar')} Voltar</a>`; pagina = { atualizar() { if (S.certs.find(c => c.id === id)) paginaEditor(id); } }; return; }
  let cur = clone(orig);
  definirTrilha(['Qualidade', 'Certificados', cur.aba || cur.corrida || 'Certificado']);
  C.innerHTML = `
    <div class="cab nao-imprimir">
      <a class="btn" href="#/lista" title="Voltar para a busca">${icone('voltar')}</a>
      <div class="cresce" style="min-width:220px">
        <input class="ent aba" id="aba" value="${esc(cur.aba)}" ${ED ? '' : 'disabled'} title="Nome do certificado na lista (como a aba da planilha)">
        <p class="sub" style="margin:4px 0 0"><span id="estadoSalvo">${ED ? 'Clique em qualquer campo da folha e digite: salva sozinho.' : 'Só consulta.'}</span></p>
      </div>
      ${ED ? `<button class="btn" id="btDup">${icone('mais')} Duplicar</button><button class="btn perigo" id="btDel">${icone('lixo')} Excluir</button>` : ''}
      <button class="btn pri" id="btImpr">${icone('impressora')} Imprimir / PDF</button>
    </div>
    <div class="editor-cert">
      <div class="papel-wrap"><div id="avisoFolhas"></div><div class="papel ${ED ? 'editing' : ''}" id="papel"></div></div>
      <aside class="lado" id="lado"></aside>
    </div>`;
  const papel = C.querySelector('#papel'), lado = C.querySelector('#lado');

  const mexeu = () => { agendarSalvar(cur); };
  function pintarPapel(focoPath) { papel.innerHTML = certHTML(cur, ED, { assinatura: assinatura(), logo: LOGO }); marcarConferencia(); avisarFolhas(); if (focoPath) focarCampo(focoPath); }
  // muitos itens: avisa que a impressão sai em mais de uma folha
  function avisarFolhas() {
    const t = papel.querySelector(".cert"), el = C.querySelector("#avisoFolhas");
    if (!t || !el) return;
    const mais = t.getBoundingClientRect().height * ESCALA_MIN > ALTURA_UTIL_PX;
    el.innerHTML = mais ? `<div class="faixa lar" style="margin-bottom:10px">Muitos itens: na impressão, os produtos que não couberem na folha 1 continuam na <b>folha 2</b> (com cabeçalho, assinatura e rodapé). A página sai como “1 de 2”, “2 de 2”.</div>` : "";
  }
  function focarCampo(path) { const el = papel.querySelector(`[data-f="${CSS.escape(path)}"]`); if (el) { el.focus(); fimDoTexto(el); } }
  function fimDoTexto(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  const lerTexto = el => { const t = el.innerText.replace(/ /g, ' ').replace(/\r/g, '').replace(/\n+$/, ''); return t.trim() === '' ? '' : t; };
  const editaveis = () => [...papel.querySelectorAll('[data-f][contenteditable]')];

  function marcarConferencia() {
    if (cur.mostrarQuimica === false) return;
    const s = conferir(cur);
    papel.querySelectorAll('td[data-el]').forEach(td => { td.classList.remove('oos', 'inv'); td.removeAttribute('title'); });
    s.fora.forEach(o => { const td = papel.querySelector(`td[data-el="${o.e}"]`); if (td) { td.classList.add('oos'); td.title = `Fora da faixa ${s.liga.nome}: ${fmtQ(o.mn)} a ${o.mx != null ? fmtQ(o.mx) : '—'}`; } });
    s.invalidos.forEach(o => { const td = papel.querySelector(`td[data-el="${o.e}"]`); if (td) { td.classList.add('inv'); td.title = 'Valor com formato inválido'; } });
    // Diferente do retorno vinculado: vermelho na tela (não sai na impressão)
    papel.querySelectorAll('td.dif').forEach(td => td.classList.remove('dif'));
    const ret = retornoDoCert(cur);
    if (ret && temAnalise(ret.analise)) for (const e of QALL) {
      const vc = parseNum((cur.quimica || {})[e]), vr = ret.analise[e] != null && ret.analise[e] !== '' ? +ret.analise[e] : null;
      const igual = (vc == null || Number.isNaN(vc)) ? vr == null && !String((cur.quimica || {})[e] ?? '').trim() : vr != null && Math.abs(vc - vr) < 1e-9;
      if (igual) continue;
      const td = papel.querySelector(`td[data-el="${e}"]`);
      if (td) { td.classList.add('dif'); td.title = (td.title ? td.title + ' · ' : '') + `Diferente do retorno ${ret.codigo}: ${vr != null ? fmtQ(vr) : 'sem valor'}`; }
    }
  }

  function pintarLado() {
    const cor = corridaDe(cur.corridaId);
    const auto = (cor && acharLiga(S.ligas, cor.liga)) || acharLiga(S.ligas, cur.material);
    const s = conferir(cur);
    lado.innerHTML = `
      <div class="cartao"><h2>Corrida</h2><div class="corpo">
        ${cor ? `<p style="margin-top:0"><a href="${banco.raiz('liga/index.html')}#/corrida/${encodeURIComponent(cor.id)}"><b>${esc(numeroCorrida(cor))}</b></a> · ${esc(cor.liga || '')} · ${fmtData(cor.data)}${(cor.ops || []).length ? '<br>OP ' + esc(cor.ops.join(', ')) : ''}</p>
            ${ED ? `<button class="btn peq" id="btLigar">Trocar corrida</button>` : ''}`
          : `<p class="mut" style="margin-top:0">Este certificado não está ligado a uma corrida do sistema.</p>${ED ? `<button class="btn peq" id="btLigar">${icone('chama')} Ligar a uma corrida</button>` : ''}`}
      </div></div>
      <div class="cartao"><h2>Retorno vinculado</h2><div class="corpo">${(() => {
        const cod = codigoRetornoDoCert(cur), ret = retornoDoCert(cur);
        const man = QALL.filter(e => (cur.quimicaManual || {})[e]);
        if (!cod) return `<p class="mut" style="margin-top:0">${cur.retorno === '-' ? 'Sem vínculo: a análise química é só a da folha.' : 'Nenhum retorno vinculado.'}</p>${ED ? `<button class="btn peq" id="btTrocarRet">${icone('reciclar')} Vincular a um retorno</button>` : ''}`;
        return `<p style="margin-top:0"><a href="${banco.raiz('liga/index.html')}#/retornos"><b>${esc(cod)}</b></a>${ret && ret.liga ? ' · ' + esc(ret.liga) : ''}${cur.retorno ? '' : ' <span class="mut">(automático, pelo nº da corrida)</span>'}</p>
          <p class="mut" style="font-size:12px">${!ret ? '<span class="txt-amar">Retorno não encontrado.</span>'
            : temAnalise(ret.analise) ? `A análise química segue a do retorno${ret.relatorio ? ' (relatório ' + esc(ret.relatorio) + ')' : ''}.`
            : 'O retorno ainda não tem análise: quando o PDF do laboratório for lido no retorno, ela vem para cá sozinha.'}
            O que você mudar na folha fica <b>só no certificado</b>.</p>
          ${man.length ? `<p style="font-size:12px;margin:6px 0"><span class="txt-amar">Mudados só no certificado:</span> ${man.map(esc).join(', ')}</p>` : ''}
          ${ED ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${man.length && ret && temAnalise(ret.analise) ? `<button class="btn peq" id="btSeguir" title="Desfaz as mudanças da folha e volta a usar a análise do retorno">Voltar a seguir o retorno</button>` : ''}<button class="btn peq" id="btTrocarRet">Trocar retorno</button></div>` : ''}`;
      })()}</div></div>
      ${ED ? `<div class="cartao"><h2>PDF do laboratório</h2><div class="corpo">
        <label class="btn peq pri" title="Lê o certificado de análise (Priner) e preenche a análise química da folha">${icone('subir')} Ler PDF do laboratório…<input type="file" id="arqLaudo" accept="application/pdf,.pdf" class="oculto"></label>
        <p class="mut" id="stLaudo" style="font-size:12px;margin:6px 0 0">Preenche a análise química com o PDF que o laboratório manda.</p>
      </div></div>` : ''}
      <div class="cartao"><h2>Conferência <span class="pilula">não imprime</span></h2><div class="corpo">
        <label class="campo">Norma de referência<select class="ent" id="ligaSel" ${ED ? '' : 'disabled'}>
          <option value="">Automático ${auto ? '(' + esc(auto.nome) + ')' : '(nenhuma)'}</option><option value="-">Não conferir</option>
          ${S.ligas.map(l => `<option value="${esc(l.nome)}" ${cur.ligaRef === l.nome ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select></label>
        <div class="spec" style="margin-top:8px">${cur.mostrarQuimica === false ? '<p class="mut">A análise química foi removida deste certificado.</p>'
          : !s.liga ? `<p class="mut">${cur.ligaRef === '-' ? 'Conferência desligada.' : 'Nenhuma norma de "Ligas e normas" corresponde ao material <b>' + esc(cur.material || '—') + '</b>.'}</p>`
          : !s.fora.length ? `<div class="txt-verde"><b>✓ Dentro da norma ${esc(s.liga.nome)}</b> (${s.ok.length} elementos conferidos).</div>`
          : `<div class="txt-amar"><b>${s.fora.length} elemento(s) fora da norma ${esc(s.liga.nome)}:</b></div>`}
          ${s.fora.length || s.invalidos.length ? `<ul>${s.fora.map(o => `<li data-ir="${o.e}"><b>${o.e}</b> ${esc(o.raw)} <span>faixa ${fmtQ(o.mn)} a ${o.mx != null ? fmtQ(o.mx) : '—'}</span></li>`).join('')}${s.invalidos.map(o => `<li class="inv" data-ir="${o.e}"><b>${o.e}</b> “${esc(o.raw)}” <span>verifique</span></li>`).join('')}</ul>` : ''}</div>
      </div></div>
      ${ED ? `<div class="cartao"><h2>Opções</h2><div class="corpo">
        <label class="opcao"><input type="checkbox" id="chkQuim" ${cur.mostrarQuimica !== false ? 'checked' : ''}> Incluir análise química</label>
        <label class="opcao"><input type="checkbox" id="chkSig" ${cur.mostrarAssinatura !== false ? 'checked' : ''}> Mostrar assinatura</label>${assinatura() ? '' : '<div class="faixa lar" style="margin:4px 0 10px;font-size:12.5px">Nenhuma assinatura cadastrada: o certificado sai sem a imagem. Cadastre em <a href="#/config">Assinatura e backup</a>.</div>'}
        <button class="btn peq" id="btHoje">Data de emissão = hoje</button>
      </div></div>
      <div class="cartao"><h2>Uso interno <span class="pilula">não imprime</span></h2><div class="corpo">
        ${cur.alteradoEm ? `<p class="mut" style="margin-top:0;font-size:12px">Última alteração: ${new Date(cur.alteradoEm).toLocaleString('pt-BR')}${cur.alteradoPor ? ' · ' + esc(cur.alteradoPor) : ''}</p>` : ''}
        <label class="campo">OPs extras para a busca<input class="ent" id="opsBusca" value="${esc(cur.opsBusca)}" placeholder="ex.: 3218 - 3219"></label>
        <label class="campo" style="margin-top:8px">Observações<textarea class="ent" id="obs" rows="3">${esc(cur.obs)}</textarea></label>
      </div></div>
      <div class="cartao"><h2>Como editar</h2><div class="corpo"><ul class="dicas">
        <li>Clique em qualquer campo da folha e digite.</li>
        <li><kbd>Enter</kbd> vai para o próximo campo; <kbd>Alt</kbd>+<kbd>Enter</kbd> quebra a linha.</li>
        <li>Cole uma linha de valores do Excel/espectrômetro no campo <b>C</b> para preencher a análise inteira.</li>
        <li>Nos produtos, <kbd>Enter</kbd> cria linha nova e <kbd>Backspace</kbd> em linha vazia apaga.</li>
        <li><kbd>Ctrl</kbd>+<kbd>P</kbd> imprime / salva PDF.</li></ul></div></div>` : ''}`;
  }

  // ---- edição na folha ----
  if (ED) {
    papel.addEventListener('input', e => {
      const el = e.target.closest('[data-f]'); if (!el) return;
      const f = el.dataset.f, t = lerTexto(el);
      if (t === '' && el.innerHTML !== '') el.innerHTML = '';
      if (f === 'corrida' && cur.abaAuto) { cur.aba = abaFrom(t); C.querySelector('#aba').value = cur.aba; }
      setPath(cur, f, t);
      if (f.startsWith('quimica.')) marcarManual(cur, [f.slice(8)]);   // mudado no certificado: fica só aqui
      if (f === 'dataEmissao') { cur.dataAprovacao = t; const m = papel.querySelector('[data-mirror="dataEmissao"]'); if (m) m.textContent = t; }
      mexeu();
      if (f.startsWith('quimica.') || f === 'material') { clearTimeout(papel._t); papel._t = setTimeout(() => { marcarConferencia(); pintarLado(); }, 250); }
    });
    papel.addEventListener('focusout', e => {
      const el = e.target.closest('[data-f^="quimica."]'); if (!el) return;
      const t = lerTexto(el), n = fmtNum(t);
      if (n !== t) { el.textContent = n; setPath(cur, el.dataset.f, n); mexeu(); marcarConferencia(); pintarLado(); }
    });
    papel.addEventListener('keydown', e => {
      const el = e.target.closest('[data-f]'); if (!el) return;
      const f = el.dataset.f;
      const pm = f.match(/^produtos\.(\d+)\.(?:titulo|linhas\.(\d+))$/);
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.altKey || e.shiftKey || e.ctrlKey) { document.execCommand('insertLineBreak'); return; }
        if (pm) {
          const i = +pm[1], p = cur.produtos[i];
          if (pm[2] === undefined) { if (!p.linhas.length) { p.linhas.push(''); mexeu(); pintarPapel(`produtos.${i}.linhas.0`); } else focarCampo(`produtos.${i}.linhas.0`); return; }
          const j = +pm[2];
          if (j === p.linhas.length - 1) { p.linhas.push(''); mexeu(); pintarPapel(`produtos.${i}.linhas.${j + 1}`); } else focarCampo(`produtos.${i}.linhas.${j + 1}`);
          return;
        }
        const L = editaveis(); const n = L[L.indexOf(el) + 1]; if (n) { n.focus(); fimDoTexto(n); }
      } else if (e.key === 'Backspace' && pm && pm[2] !== undefined && lerTexto(el) === '') {
        e.preventDefault();
        const i = +pm[1], j = +pm[2];
        cur.produtos[i].linhas.splice(j, 1); mexeu();
        pintarPapel(j > 0 ? `produtos.${i}.linhas.${j - 1}` : `produtos.${i}.titulo`);
      } else if (e.key === 'Escape') { el.blur(); }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.dataset.el) {
        const k = QALL.indexOf(el.dataset.el), t = e.key === 'ArrowDown' ? k + 10 : k - 10;
        if (t >= 0 && t < QALL.length) { e.preventDefault(); focarCampo('quimica.' + QALL[t]); }
      }
    });
    papel.addEventListener('paste', e => {
      const el = e.target.closest('[data-f]'); if (!el) return;
      const text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      const f = el.dataset.f;
      if (f.startsWith('quimica.')) {
        const partes = text.replace(/\r/g, '').split(/\t|\n|;/).map(s => s.trim());
        while (partes.length && partes[partes.length - 1] === '') partes.pop();
        e.preventDefault();
        if (partes.length > 1) {
          let k = QALL.indexOf(f.slice(8)), n = 0;
          for (const v of partes) { if (k >= QALL.length) break; cur.quimica[QALL[k]] = fmtNum(v); marcarManual(cur, [QALL[k]]); k++; n++; }
          mexeu(); pintarPapel('quimica.' + QALL[Math.min(k, QALL.length) - 1]); pintarLado();
          aviso(`${n} valores colados na análise química.`);
        } else document.execCommand('insertText', false, fmtNum(partes[0] || ''));
        return;
      }
      e.preventDefault(); document.execCommand('insertText', false, text);
    });
    papel.addEventListener('mousedown', e => { if (e.target.closest('[data-act]')) e.preventDefault(); });
    papel.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      e.preventDefault();
      const P = cur.produtos, i = +b.dataset.i, j = +b.dataset.j;
      switch (b.dataset.act) {
        case 'addProd': P.push({ titulo: '', linhas: ['Item: ', 'Quantidade(s): '] }); mexeu(); pintarPapel(`produtos.${P.length - 1}.titulo`); break;
        case 'addLine': P[i].linhas.push(''); mexeu(); pintarPapel(`produtos.${i}.linhas.${P[i].linhas.length - 1}`); break;
        case 'delLine': P[i].linhas.splice(j, 1); mexeu(); pintarPapel(); break;
        case 'up': if (i > 0) { [P[i - 1], P[i]] = [P[i], P[i - 1]]; mexeu(); pintarPapel(); } break;
        case 'down': if (i < P.length - 1) { [P[i + 1], P[i]] = [P[i], P[i + 1]]; mexeu(); pintarPapel(); } break;
        case 'qOff': setQuimica(cur, false); mexeu(); pintarPapel(); pintarLado(); aviso('Análise química removida deste certificado (os valores ficam guardados).'); break;
        case 'qOn': setQuimica(cur, true); mexeu(); pintarPapel(); pintarLado(); break;
        case 'delProd': if (confirm(`Excluir o produto "${P[i].titulo || '(sem descrição)'}" deste certificado?`)) { P.splice(i, 1); mexeu(); pintarPapel(); } break;
      }
    });
    C.querySelector('#aba').addEventListener('input', e => { cur.aba = e.target.value; cur.abaAuto = false; mexeu(); });
    lado.addEventListener('change', e => {
      if (e.target.id === 'ligaSel') { cur.ligaRef = e.target.value; mexeu(); marcarConferencia(); pintarLado(); }
      if (e.target.id === 'chkSig') { cur.mostrarAssinatura = e.target.checked; mexeu(); pintarPapel(); }
      if (e.target.id === 'chkQuim') { setQuimica(cur, e.target.checked); mexeu(); pintarPapel(); pintarLado(); }
      if (e.target.id === 'arqLaudo') { const f = e.target.files[0]; e.target.value = ''; lerPdfLaboratorio(f); }
    });
    lado.addEventListener('input', e => {
      if (e.target.id === 'opsBusca') { cur.opsBusca = e.target.value; mexeu(); }
      if (e.target.id === 'obs') { cur.obs = e.target.value; mexeu(); }
    });
    lado.addEventListener('click', e => {
      if (e.target.closest('#btHoje')) { cur.dataEmissao = hojeBR(); cur.dataAprovacao = hojeBR(); mexeu(); pintarPapel(); aviso('Data de emissão = hoje (' + hojeBR() + ').'); }
      if (e.target.closest('#btSeguir')) seguirRetorno();
      if (e.target.closest('#btTrocarRet')) trocarRetorno();
      if (e.target.closest('#btLigar')) ligarCorrida();
      const li = e.target.closest('[data-ir]'); if (li) focarCampo('quimica.' + li.dataset.ir);
    });
    C.querySelector('#btDup').onclick = () => {
      salvarPendente();
      const c = clone(cur);
      Object.assign(c, { id: uid(), ordem: nextOrdem(), aba: (cur.aba || 'Certificado') + ' (cópia)', abaAuto: false, obs: '' });
      gravar(c); if (!S.certs.some(x => x.id === c.id)) S.certs.push(c);
      aviso('Cópia criada — altere o que for preciso.');
      abrir(c.id);
    };
    C.querySelector('#btDel').onclick = () => {
      if (!confirm(`Excluir ${cur.aba || 'este certificado'}?`)) return;
      const p = pendentes.get(cur.id); if (p) { clearTimeout(p.timer); pendentes.delete(cur.id); }
      banco.apagar(COL.certs, cur.id);
      aviso((cur.aba || 'Certificado') + ' excluído.');
      location.hash = '#/lista';
    };
  } else {
    lado.addEventListener('click', e => { const li = e.target.closest('[data-ir]'); if (li) { const el = papel.querySelector(`td[data-el="${li.dataset.ir}"]`); if (el) el.scrollIntoView({ block: 'center' }); } });
  }
  C.querySelector('#btImpr').onclick = () => imprimir([cur]);

  // PDF do certificado de análise do laboratório → análise química da folha
  async function lerPdfLaboratorio(f) {
    if (!f) return;
    const st = C.querySelector('#stLaudo'); if (st) st.textContent = 'Lendo o PDF…';
    const r = await lerLaudoOuAvisar(f, aviso);
    if (!r) { pintarLado(); return; }
    const pref = r.corrida ? `${r.corrida.refratario}-${r.corrida.anual}` : '';
    const atual = String(cur.corrida || '').replace(/\s/g, '').replace(/\//g, '-');
    if (pref && atual && atual !== pref && !confirm(`O PDF é da corrida ${pref}, mas este certificado é da corrida ${cur.corrida}.\n\nUsar a análise deste PDF mesmo assim?`)) { pintarLado(); return; }
    const temValores = Object.values(cur.quimica || {}).some(v => String(v).trim());
    cur.quimica = quimicaDe(r.analise);
    marcarManual(cur, Object.keys(cur.quimica));   // veio do PDF direto no certificado: o retorno não sobrescreve
    cur.quimica = quimicaDe(r.analise);
    if (cur.mostrarQuimica === false) setQuimica(cur, true);
    if (pref && !atual) { cur.corrida = pref; if (cur.abaAuto) { cur.aba = abaFrom(cur.corrida); C.querySelector('#aba').value = cur.aba; } }
    mexeu(); pintarPapel(); pintarLado();
    const st2 = C.querySelector('#stLaudo');
    if (st2) st2.innerHTML = `<span class="txt-az">Lido: ${esc(f.name)} — ${Object.keys(cur.quimica).length} elementos${r.relatorio ? ' (certificado ' + esc(r.relatorio) + ')' : ''}.</span> Confira na folha.`;
    aviso('Análise química preenchida pelo PDF do laboratório.');
  }
  // Desfaz as mudanças feitas na folha e volta a usar a análise do retorno
  function seguirRetorno() {
    const man = QALL.filter(e => (cur.quimicaManual || {})[e]);
    if (man.length && !confirm(`Os valores mudados no certificado (${man.join(', ')}) voltam a ser os do retorno. Continuar?`)) return;
    cur.quimicaManual = {};
    sincronizarQuimica(cur);
    mexeu(); pintarPapel(); pintarLado();
    aviso('A análise química voltou a seguir o retorno.');
  }
  function trocarRetorno() {
    const lista = S.retornos.slice().sort((a, b) => String(b.codigo).localeCompare(String(a.codigo), 'pt', { numeric: true }));
    const atual = codigoRetornoDoCert(cur);
    janela({
      titulo: 'Retorno vinculado ao certificado',
      html: `<div class="busca">${icone('busca')}<input class="ent" id="rBusca" placeholder="código do retorno ou liga…" value="${esc(cur.corrida || '')}" autocomplete="off"></div>
        <select class="ent" id="rSel" size="8" style="margin-top:6px"></select>
        <p class="mut" style="font-size:12px">A análise do retorno vem para o certificado (e as próximas mudanças dela também). O que for mudado no certificado não volta para o retorno.</p>`,
      aoAbrir: el => {
        const pintar = () => {
          const f = norm(el.querySelector('#rBusca').value).replace(/[\s/]+/g, '-').replace(/^-|-$/g, '');
          const l = lista.filter(r => !f || norm(r.codigo + ' ' + (r.liga || '')).replace(/\s+/g, '-').includes(f)).slice(0, 200);
          el.querySelector('#rSel').innerHTML = l.map(r => `<option value="${esc(r.codigo)}" ${r.codigo === atual ? 'selected' : ''}>${esc(r.codigo)}${r.liga ? ' · ' + esc(r.liga) : ''}${temAnalise(r.analise) ? '' : '  (sem análise)'}</option>`).join('') || '<option disabled>Nenhum retorno encontrado</option>';
        };
        el.querySelector('#rBusca').oninput = pintar; pintar();
      },
      botoes: [
        ...(atual ? [{ texto: 'Tirar o vínculo', esquerda: true, acao: () => { cur.retorno = '-'; mexeu(); pintarLado(); } }] : []),
        { texto: 'Cancelar' },
        { texto: 'Vincular', cls: 'pri', acao: el => {
          const cod = el.querySelector('#rSel').value;
          if (!cod) { aviso('Escolha o retorno.', 'erro'); return false; }
          cur.retorno = cod === (corridaDe(cur.corridaId) || {}).retornoGerado ? '' : cod;   // o da corrida fica "automático"
          const temValores = Object.values(cur.quimica || {}).some(v => String(v).trim());
          const ret = S.retornos.find(r => r.codigo === cod);
          if (ret && temAnalise(ret.analise) && temValores) {
            if (confirm('Trazer a análise do retorno ' + cod + ' para a folha (substitui a atual)?')) cur.quimicaManual = {};
            else marcarManual(cur, QALL.filter(e => String((cur.quimica || {})[e] ?? '').trim()));   // mantém o que já está na folha
          }
          sincronizarQuimica(cur);
          mexeu(); pintarPapel(); pintarLado();
          aviso('Certificado vinculado ao retorno ' + cod + '.');
        } },
      ],
    });
  }
  function ligarCorrida() {
    const corridas = S.corridas.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    janela({
      titulo: 'Ligar a uma corrida',
      html: `<div class="busca">${icone('busca')}<input class="ent" id="lBusca" placeholder="nº da corrida, OP, FS, liga…" value="${esc(cur.corrida.replace(/-/g, ' / '))}" autocomplete="off"></div>
        <select class="ent" id="lCorr" size="8" style="margin-top:6px"></select>
        <label class="opcao" style="margin-top:10px"><input type="checkbox" id="lPreencher" checked> Preencher corrida, material e OP da liga com os dados da corrida</label>`,
      aoAbrir: el => {
        const pintar = () => {
          const f = norm(el.querySelector('#lBusca').value).replace(/\s+/g, ' ').trim();
          const lista = corridas.filter(c => !f || norm(descCorrida(c) + ' ' + nomeCorrida(c)).includes(f)).slice(0, 200);
          el.querySelector('#lCorr').innerHTML = lista.map(c => `<option value="${esc(c.id)}" ${c.id === cur.corridaId ? 'selected' : ''}>${esc(descCorrida(c))}</option>`).join('') || '<option disabled>Nenhuma corrida encontrada</option>';
        };
        el.querySelector('#lBusca').oninput = pintar; pintar();
      },
      botoes: [
        ...(cur.corridaId ? [{ texto: 'Desligar', esquerda: true, acao: () => { cur.corridaId = ''; mexeu(); pintarLado(); } }] : []),
        { texto: 'Cancelar' },
        { texto: 'Ligar', cls: 'pri', acao: el => {
          const c = corridaDe(el.querySelector('#lCorr').value);
          if (!c) { aviso('Escolha a corrida.', 'erro'); return false; }
          cur.corridaId = c.id; if (cur.retorno === '-') cur.retorno = '';   // passa a seguir o retorno da corrida
          if (el.querySelector('#lPreencher').checked) {
            cur.corrida = nomeCorrida(c); if (cur.abaAuto) { cur.aba = abaFrom(cur.corrida); C.querySelector('#aba').value = cur.aba; }
            cur.material = c.liga || cur.material; cur.opLiga = (c.ops || []).join(' - ') || cur.opLiga;
          }
          mexeu(); pintarPapel(); pintarLado();
          aviso('Certificado ligado à corrida ' + numeroCorrida(c) + '.');
        } },
      ],
    });
  }

  pagina = {
    atualizar() {
      const novo = S.certs.find(c => c.id === id);
      if (!novo) { if (!pendentes.has(id)) { aviso('Este certificado foi excluído.'); location.hash = '#/lista'; } return; }
      // mudou em outro computador: atualiza a folha, a não ser que esteja sendo editada aqui
      const editando = pendentes.has(id) || (document.activeElement && C.contains(document.activeElement) && document.activeElement.closest('#papel, #lado, #aba'));
      if (!editando && (novo.alteradoEm || 0) > (cur.alteradoEm || 0)) { cur = clone(novo); C.querySelector('#aba').value = cur.aba; pintarPapel(); }
      // o retorno vinculado recebeu (ou mudou) a análise: leva para a folha, a não ser que esteja digitando nela
      const naAnalise = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-f^="quimica."]');
      if (!naAnalise && sincronizarQuimica(cur)) { if (ED) mexeu(); pintarPapel(); }
      pintarLado();
    },
  };
  if (sincronizarQuimica(cur) && ED) mexeu();   // análise do retorno vinculado (só grava quem edita)
  pintarPapel(focar);
  pintarLado();
}

// =====================================================================
//  IMPRESSÃO (A4, mesmo formato da planilha)
// =====================================================================
const ALTURA_UTIL_MM = 296 - 2 * 19.05, PX_MM = 96 / 25.4;
const ESCALA_MAX = 0.94, ESCALA_MIN = 0.9;            // abaixo disso, em vez de diminuir a letra, passa para outra folha
const ALTURA_UTIL_PX = ALTURA_UTIL_MM * PX_MM - 4;
// Divide o certificado em folhas: a 1ª é a folha completa; os itens que não cabem vão para as seguintes.
function folhasDoCert(r, medir) {
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
function medidor(area) {
  const tmp = document.createElement('div'); tmp.className = 'pagina-cert'; area.appendChild(tmp);
  return { medir: html => { tmp.innerHTML = html; return tmp.firstElementChild.getBoundingClientRect().height; }, fim: () => tmp.remove() };
}
let tituloAntes = null;
function prepararImpressao(lista) {
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
async function imprimir(lista) {
  lista = lista.filter(Boolean); if (!lista.length) return;
  salvarPendente();
  const area = prepararImpressao(lista);
  await Promise.all([...area.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : null)));
  window.print();
}
// Impressão pelo menu do navegador na tela do certificado: sai só o certificado
window.addEventListener('beforeprint', () => {
  if (document.body.classList.contains('imprimindo-cert')) return;
  const m = (location.hash || '').match(/^#\/c\/(.+)$/);
  const id = m && decodeURIComponent(m[1]);
  const c = id && ((pendentes.get(id) || {}).cert || S.certs.find(x => x.id === id));   // a versão que está na tela
  if (c) prepararImpressao([c]);
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('imprimindo-cert');
  const area = document.getElementById('areaImpressao'); if (area) area.innerHTML = '';
  if (tituloAntes !== null) { document.title = tituloAntes; tituloAntes = null; }
});
// Ctrl+P na tela do certificado imprime o certificado (e não a tela)
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    const m = (location.hash || '').match(/^#\/c\/(.+)$/);
    if (m) { e.preventDefault(); const c = S.certs.find(x => x.id === decodeURIComponent(m[1])); salvarPendente(); imprimir([c]); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarPendente(); aviso('Salvo.'); }
});

// =====================================================================
//  ASSINATURA E BACKUP
// =====================================================================
function paginaConfig() {
  marcarMenu('certificados');
  definirTrilha(['Qualidade', 'Certificados', 'Assinatura e backup']);
  C.innerHTML = `
    <div class="cab"><a class="btn" href="#/lista">${icone('voltar')}</a><div class="cresce"><h1 class="titulo">Assinatura e backup</h1><p class="sub">A imagem da assinatura dos certificados e a cópia de segurança. As faixas das ligas usadas na conferência ficam em <a href="${banco.raiz('liga/index.html')}#/ligas">Ligas e normas</a> (as mesmas do Cálculo de Liga).</p></div></div>
    <div class="cartao"><h2>Assinatura nos certificados</h2><div class="corpo">
      <div class="assin" id="assPrev"></div>
      ${ED ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><label class="btn">${icone('subir')} Trocar imagem…<input type="file" id="arqAss" accept="image/*" class="oculto"></label><button class="btn perigo" id="btTirarAss">${icone('lixo')} Remover</button></div>
        <p class="mut" style="margin-bottom:0">Fica guardada no banco, não no site (o GitHub é público).</p>` : ''}
    </div></div>
    ${ED ? `<div class="cartao"><h2>Trazer os certificados do app antigo</h2><div class="corpo">
      <p style="margin-top:0">No app antigo de certificados: <b>Backup → Exportar backup (.json)</b>. Depois escolha o arquivo aqui.
        Os certificados entram como estão; os que tiverem a corrida no formato <b>33-229</b> são <b>ligados sozinhos</b> à corrida do Cálculo de Liga (nº do refratário e anual, data mais próxima). A assinatura do arquivo também pode vir.</p>
      <label class="btn">${icone('subir')} Escolher o backup (.json)…<input type="file" id="arqBkp" accept=".json,application/json" class="oculto"></label>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa todos os certificados e a assinatura (no mesmo formato do app antigo). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
    </div></div>` : ''}`;
  function atualizar() {
    const a = assinatura();
    C.querySelector('#assPrev').innerHTML = a ? `<img src="${a}" alt="Assinatura">` : '<span class="mut">Nenhuma assinatura cadastrada</span>';
    const bt = C.querySelector('#btTirarAss'); if (bt) bt.disabled = !a;
  }
  if (ED) {
    C.querySelector('#arqAss').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const url = await reduzirImagem(await lerComoDataURL(f)); salvarCfg({ assinatura: url }); aviso('Assinatura atualizada para todos os certificados.'); }
      catch (err) { aviso('Não consegui ler essa imagem. Use PNG ou JPG.', 'erro'); }
    };
    C.querySelector('#btTirarAss').onclick = () => { if (confirm('Os certificados passam a sair sem a imagem da assinatura. Continuar?')) salvarCfg({ assinatura: '' }); };
    C.querySelector('#btExp').onclick = () => {
      salvarPendente();
      baixarArquivo(`certificados-backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ sistema: 'certificados-prometals', exportadoEm: new Date().toISOString(), certs: S.certs.map(c => { const x = clone(c); delete x._em; delete x._por; return x; }), assinatura: assinatura() }, null, 1));
    };
    C.querySelector('#arqBkp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarBackup(f); };
  }
  pagina = { atualizar };
  atualizar();
}
function salvarCfg(campos) { banco.salvar(COL_LIGA.config, CFG_ID, { ...(S.cfg ? (({ id, _em, _por, ...r }) => r)(S.cfg) : {}), ...campos }); }
const lerComoDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
function reduzirImagem(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const w = Math.min(700, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
      res(cv.toDataURL('image/png'));
    };
    im.onerror = rej; im.src = url;
  });
}

// Corrida do certificado ("33-229") → corrida do Cálculo de Liga (refratário 33, anual 229, data mais próxima da emissão)
function acharCorridaPeloTexto(texto, dataEmissao) {
  const m = String(texto || '').match(/^\s*(\d+)\s*[-/]\s*(\d+)\s*$/);
  if (!m) return null;
  const ref = +m[1], anual = +m[2];
  const cands = S.corridas.filter(c => +c.refratario === ref && +c.anual === anual && c.data);
  if (!cands.length) return null;
  const k = dateKey(dataEmissao);
  if (!k) return cands.length === 1 ? cands[0] : null;
  const alvo = new Date(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`);
  const dist = c => Math.abs(new Date(c.data) - alvo) / 86400000;
  const melhor = cands.slice().sort((a, b) => dist(a) - dist(b))[0];
  return dist(melhor) <= 120 ? melhor : null;      // emissão até ~4 meses depois da corrida
}

async function importarBackup(arquivo) {
  let o;
  try { o = JSON.parse(await arquivo.text()); } catch (e) { aviso('Arquivo inválido: não é um .json de backup.', 'erro'); return; }
  const certs = Array.isArray(o && o.certs) ? o.certs.filter(c => c && typeof c === 'object') : [];
  const sig = o && typeof o.assinatura === 'string' && o.assinatura.startsWith('data:image') ? o.assinatura : '';
  if (!certs.length && !sig) { aviso('Este arquivo não tem certificados nem assinatura.', 'erro'); return; }
  const atuais = new Map(S.certs.map(c => [c.id, c]));
  const lista = certs.map(c => upgradeCert({ ...clone(c), id: String(c.id || uid()).replace(/[\/\\#?\[\]]+/g, '_') }));
  const novos = lista.filter(c => !atuais.has(c.id)).length;
  const maisNovos = lista.filter(c => atuais.has(c.id) && (c.alteradoEm || 0) > (atuais.get(c.id).alteradoEm || 0)).length;
  let ligados = 0;
  for (const c of lista) { if (!c.corridaId) { const cor = acharCorridaPeloTexto(c.corrida, c.dataEmissao); if (cor) { c.corridaId = cor.id; ligados++; } } }
  janela({
    titulo: 'Importar ' + arquivo.name,
    html: `<ul style="margin-top:0;padding-left:18px;line-height:1.7">
      ${certs.length ? `<li><label><input type="checkbox" id="imC" checked> <b>${certs.length} certificados</b>: ${novos} novos${maisNovos ? `, ${maisNovos} mais recentes que os do sistema` : ''}. ${ligados} serão ligados à corrida do Cálculo de Liga.</label></li>` : ''}
      ${sig ? `<li><label><input type="checkbox" id="imS" ${assinatura() ? '' : 'checked'}> Assinatura do arquivo${assinatura() ? ' (substitui a atual)' : ''}</label></li>` : ''}
      ${Array.isArray(o.ligas) && o.ligas.length ? `<li class="mut">As ${o.ligas.length} ligas do arquivo não são importadas: a conferência usa "Ligas e normas" do Cálculo de Liga.</li>` : ''}
    </ul><div id="progBkp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      if (el.querySelector('#imC') && el.querySelector('#imC').checked) {
        for (const c of lista) {
          const at = atuais.get(c.id);
          if (at && (c.alteradoEm || 0) <= (at.alteradoEm || 0)) continue;     // o do sistema é mais novo
          if (!c.ordem) c.ordem = Date.now();
          const { id, ...d } = c;
          ops.push({ col: COL.certs, id, dados: d });
        }
      }
      if (el.querySelector('#imS') && el.querySelector('#imS').checked) ops.push({ col: COL_LIGA.config, id: CFG_ID, dados: { ...(S.cfg ? (({ id, _em, _por, ...r }) => r)(S.cfg) : {}), assinatura: sig } });
      if (!ops.length) { aviso('Nada para importar.', 'erro'); return false; }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await banco.emLote(ops, (f, t) => { el.querySelector('#progBkp').textContent = `Gravando ${f} de ${t}…`; });
        aviso(`Importação concluída: ${ops.length} registros.`);
      } catch (e) { aviso('Erro na importação: ' + e.message, 'erro'); el.querySelectorAll('button').forEach(b => { b.disabled = false; }); return false; }
    } }],
  });
}
