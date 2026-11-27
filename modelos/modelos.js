// =====================================================================
//  modelos/modelos.js — módulo Controle de Modelos
//  Telas: Prateleiras (mapa), Modelos (lista e ficha), Lista comercial,
//  Ruas e importação. Só a Engenharia edita (podeEditar); os outros só consultam.
// =====================================================================
import * as banco from '../comum/banco.js?v=1.7.4';
import { montar, definirTrilha, marcarMenu, aviso, janela, esc, num, fmtData, icone, hoje, podeEditar, podeVer, semAcesso, TELAS_MODELOS, baixarArquivo } from '../comum/casca.js?v=1.7.4';
import {
  COL, SITUACOES, EXTENSOES, CAMPOS_COMERCIAIS, normCodigo, idModelo, chaveDesenho, situacao, lerPosicao,
  posicoesDaRua, ocupacao, chaveDiametro, lerVolumes,
} from './regras.js?v=1.3.0';
import { lerAlmoxarifado } from './importar.js?v=1.3.0';

const S = { modelos: [], ruas: [], porId: new Map(), ocup: new Map(), chegou: {} };
const filtros = { lista: { chip: 'todos', rua: '', q: '' }, comercial: { chip: 'todos', diam: '', q: '' }, mapa: { q: '' } };
let pagina = null;
let ED = true;   // pode editar os dados dos modelos?
let MAN = true;  // pode registrar manutenção (ida e volta)?

function recalcular() {
  S.porId = new Map(S.modelos.map(m => [m.id, m]));
  S.ocup = ocupacao(S.modelos);
}

const est = await montar({ ativo: location.hash.startsWith('#/comercial') ? 'comercial' : 'mapa', trilha: [location.hash.startsWith('#/comercial') ? 'Modelos Prometals' : 'Almoxarifado modelos'] });
MAN = podeEditar('manutencao');
const C = document.getElementById('conteudo');
C.innerHTML = '<div class="vazio">Carregando dados…</div>';

function chegou(nome) {
  S.chegou[nome] = true;
  recalcular();
  if (S.chegou.modelos && S.chegou.ruas) { if (!pagina) rotear(); else pagina.atualizar(); }
}
if (!TELAS_MODELOS.some(podeVer)) semAcesso(C);   // nenhuma tela de Modelos liberada: nem lê os dados
else {
  banco.ouvirColecao(COL.modelos, l => { S.modelos = l; chegou('modelos'); }, erroBanco);
  banco.ouvirColecao(COL.ruas, l => { S.ruas = l.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.letra).localeCompare(b.letra)); chegou('ruas'); }, erroBanco);
}

function erroBanco(e) {
  const permissao = e && /permission/i.test(e.code || e.message || '');
  C.innerHTML = `<div class="faixa verm">${permissao
    ? 'Seu usuário não tem permissão para ver os modelos. Peça para a Engenharia liberar em Usuários e acessos.'
    : 'Erro ao ler o banco de dados: ' + esc(e && (e.message || e.code))}</div>`;
}

// ---------------------------------------------------------------------
// Rotas: #/mapa  #/lista  #/modelo/<id>  #/modelo/novo?pos=K25  #/comercial  #/ruas
// ---------------------------------------------------------------------
let sujo = false, hashAtual = '';
window.addEventListener('hashchange', () => {
  if (sujo && !confirm('Há alterações não salvas neste modelo. Sair mesmo assim?')) { history.replaceState(null, '', hashAtual); return; }
  sujo = false;
  rotear();
});
window.addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

function rotear() {
  const [caminho, busca] = (location.hash || '#/mapa').slice(2).split('?');
  const h = caminho.split('/');
  hashAtual = location.hash || '#/mapa';
  window.scrollTo(0, 0);
  // tela de cada rota (Usuários e acessos). A ficha do modelo abre para quem vê qualquer tela de Modelos;
  // editar segue "Modelos" (também pôr modelo numa vaga nas Prateleiras); Ruas e importação tem o seu.
  const tela = { lista: 'modelos', comercial: 'comercial', ruas: 'ruas', modelo: 'modelos' }[h[0]] || 'mapa';
  ED = podeEditar(tela === 'ruas' ? 'ruas' : 'modelos') && tela !== 'comercial';
  if (h[0] === 'modelo' ? !TELAS_MODELOS.some(podeVer) : !podeVer(tela)) { pagina = { atualizar() {} }; marcarMenu(tela); return semAcesso(C); }
  if (h[0] === 'modelo') return paginaModelo(decodeURIComponent(h[1] || 'novo'), new URLSearchParams(busca || ''));
  if (h[0] === 'lista') return paginaLista();
  if (h[0] === 'comercial') return paginaComercial();
  if (h[0] === 'ruas') return paginaRuas();
  return paginaMapa();
}

// Ajudantes
const ent = (attrs, valor = '') => `<input class="ent" ${attrs} ${ED ? '' : 'disabled'} value="${esc(valor == null ? '' : valor)}">`;
const tagSit = m => { const s = SITUACOES[situacao(m)]; return `<span class="tag ${s.cls}">${s.texto}</span>`; };
const fmtValor = v => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : esc(v == null ? '' : v));
const fmtTamanho = b => (b > 1048576 ? (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const kpi = (n, rot, cls, chip) => chip
  ? `<button class="kpi ${cls}" data-chip="${chip}"><b>${n}</b><span>${rot}</span></button>`
  : `<div class="kpi ${cls}"><b>${n}</b><span>${rot}</span></div>`;
const somenteLeitura = () => ED ? '' : `<div class="faixa">${icone('olho')} ${MAN
  ? 'Você pode registrar a ida e a volta da manutenção (na ficha do modelo). Os demais dados são alterados pela Engenharia.'
  : 'Você está só consultando. Alterações são feitas pela Engenharia.'}</div>`;

// =====================================================================
//  PRATELEIRAS (mapa)
// =====================================================================
function paginaMapa() {
  marcarMenu('mapa');
  definirTrilha(['Almoxarifado modelos', 'Prateleiras']);
  const f = filtros.mapa;
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Prateleiras</h1><p class="sub">Onde está cada modelo. Clique numa posição para abrir o modelo${ED ? ' ou colocar um modelo numa vaga livre' : ''}.</p></div>
      ${ED ? `<a class="btn pri" href="#/modelo/novo">${icone('mais')} Novo modelo</a>` : ''}
    </div>
    ${somenteLeitura()}
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Achar código ou medida no mapa…" value="${esc(f.q)}"></div>
      <span class="legenda-mapa"><i class="pos disp">Disponível</i><i class="pos man">Em manutenção</i><i class="pos livre">Vaga livre</i></span>
      <span class="mut" id="achados"></span>
    </div></div>
    <div id="ruas"></div>`;
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(true); };
  C.querySelector('#ruas').onclick = e => {
    const t = e.target.closest('[data-pos]');
    if (!t) return;
    const m = S.ocup.get(t.dataset.pos);
    if (m) location.hash = '#/modelo/' + encodeURIComponent(m.id);
    else if (ED) escolherParaVaga(t.dataset.pos);
  };

  function atualizar(rolar) {
    const todas = S.ruas.flatMap(posicoesDaRua);
    const dispon = S.modelos.filter(m => situacao(m) === 'disponivel').length;
    const manut = S.modelos.filter(m => situacao(m) === 'manutencao').length;
    const livres = todas.filter(p => !S.ocup.has(p)).length;
    C.querySelector('#kpis').innerHTML = kpi(dispon, 'Disponíveis', 'verde') + kpi(manut, 'Em manutenção', 'amar') + kpi(livres, 'Vagas livres', '') + kpi(todas.length, 'Posições', 'roxo');
    const q = normCodigo(f.q);
    const bate = m => q && m && (normCodigo(m.codigo).includes(q) || normCodigo(m.descricao).includes(q));
    let achados = 0;
    const foraDoMapa = S.modelos.filter(m => m.posicao && !todas.includes(m.posicao));
    C.querySelector('#ruas').innerHTML = (!S.ruas.length
      ? `<div class="cartao"><div class="vazio">Nenhuma rua cadastrada. ${ED ? 'Importe a planilha ou cadastre as ruas em <a href="#/ruas">Ruas e importação</a>.' : ''}</div></div>`
      : S.ruas.map(r => {
        const pos = posicoesDaRua(r);
        const ocupadas = pos.filter(p => S.ocup.has(p)).length;
        return `<div class="cartao"><h2>Rua ${esc(r.letra)}${r.nivel ? ' — ' + esc(r.nivel) : ''}<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:500">${ocupadas} de ${pos.length} ocupadas</span></h2>
          <div class="corpo"><div class="prateleira">${pos.map(p => {
            const m = S.ocup.get(p);
            const cls = !m ? 'livre' : situacao(m) === 'manutencao' ? 'man' : 'disp';
            const achou = bate(m); if (achou) achados++;
            return `<button class="pos ${cls} ${achou ? 'achado' : ''} ${q && !achou ? 'apagado' : ''}" data-pos="${p}" title="${m ? esc(m.codigo + (m.descricao ? ' — ' + m.descricao : '')) : 'Vaga livre'}">
              <small>${p}</small><b>${m ? esc(m.codigo) : '—'}</b>${m && m.descricao ? `<span>${esc(m.descricao)}</span>` : ''}${m && m.desenho ? `<em>${icone('documento')}</em>` : ''}</button>`;
          }).join('')}</div></div></div>`;
      }).join('')) +
      (foraDoMapa.length ? `<div class="faixa verm">Modelos com posição que não existe no mapa: ${foraDoMapa.map(m => `<a href="#/modelo/${encodeURIComponent(m.id)}">${esc(m.codigo)} (${esc(m.posicao)})</a>`).join(', ')}. Aumente a rua em Ruas e importação ou mude a posição do modelo.</div>` : '');
    C.querySelector('#achados').textContent = q ? (achados ? `${achados} encontrado(s)` : 'Nada encontrado no mapa (veja em Modelos: pode estar fora do estoque)') : '';
    if (rolar && achados) { const el = C.querySelector('.pos.achado'); el && el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  pagina = { atualizar };
  atualizar();
}

// Vaga livre clicada: escolher um modelo sem posição ou criar um novo
function escolherParaVaga(pos) {
  const semPos = S.modelos.filter(m => !m.posicao).sort((a, b) => String(a.codigo).localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  janela({
    titulo: 'Vaga ' + pos,
    html: `<p style="margin-top:0">Esta posição está livre. Coloque aqui um modelo que está sem posição, ou cadastre um novo.</p>
      <label class="campo">Modelo sem posição<select class="ent" id="vMod"><option value="">Escolha…</option>${semPos.map(m => `<option value="${esc(m.id)}">${esc(m.codigo)}${m.descricao ? ' — ' + esc(m.descricao) : ''}</option>`).join('')}</select></label>`,
    botoes: [
      { texto: icone('mais') + ' Novo modelo aqui', esquerda: true, acao: () => { location.hash = '#/modelo/novo?pos=' + encodeURIComponent(pos); } },
      { texto: 'Cancelar' },
      { texto: 'Colocar aqui', cls: 'pri', acao: el => {
        const m = S.porId.get(el.querySelector('#vMod').value);
        if (!m) { aviso('Escolha o modelo.', 'erro'); return false; }
        if (S.ocup.get(pos)) { aviso('Esta posição acabou de ser ocupada.', 'erro'); return false; }
        gravarModelo({ ...m, posicao: pos, historico: [...(m.historico || []), evento('posicao', { de: '', para: pos })] });
        aviso(`${m.codigo} colocado em ${pos}.`);
      } },
    ],
  });
}

function evento(tipo, extra = {}) {
  const u = banco.usuario();
  return { data: hoje(), tipo, por: u && banco.modo() === 'firebase' ? u.email : '', ...extra };
}
function semMeta(o) { const x = { ...o }; delete x.id; delete x._em; delete x._por; return x; }
function gravarModelo(m) {
  return banco.salvar(COL.modelos, m.id, semMeta(m)).catch(e => aviso('Erro ao salvar: ' + e.message, 'erro'));
}

// =====================================================================
//  MODELOS — lista
// =====================================================================
function paginaLista() {
  marcarMenu('modelos');
  definirTrilha(['Almoxarifado modelos', 'Modelos']);
  const f = filtros.lista;
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Modelos</h1><p class="sub">Todos os modelos, com posição, situação e desenho.</p></div>
      ${ED ? `<a class="btn pri" href="#/modelo/novo">${icone('mais')} Novo modelo</a>` : ''}
    </div>
    ${somenteLeitura()}
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fRua" style="width:auto;min-width:130px"></select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar código, medida, refinador…" value="${esc(f.q)}"></div>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#fRua').onchange = e => { f.rua = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  const chip = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#chips').onclick = chip;
  C.querySelector('#kpis').onclick = chip;
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/modelo/' + encodeURIComponent(tr.dataset.id); };

  function atualizar() {
    const n = k => S.modelos.filter(m => situacao(m) === k).length;
    C.querySelector('#kpis').innerHTML = kpi(S.modelos.length, 'Modelos', '', 'todos') + kpi(n('disponivel'), 'Disponíveis', 'verde', 'disponivel') +
      kpi(n('manutencao'), 'Em manutenção', 'amar', 'manutencao') + kpi(n('fora'), 'Fora do estoque', '', 'fora');
    C.querySelector('#chips').innerHTML = [['todos', 'Todos'], ['disponivel', 'Disponíveis'], ['manutencao', 'Em manutenção'], ['fora', 'Fora do estoque'], ['semdesenho', 'Sem desenho']]
      .map(([k, t]) => `<button class="ficha ${f.chip === k ? 'sel' : ''}" data-chip="${k}">${t}</button>`).join('');
    C.querySelector('#fRua').innerHTML = `<option value="">Todas as ruas</option>` + S.ruas.map(r => `<option ${f.rua === r.letra ? 'selected' : ''}>${esc(r.letra)}</option>`).join('');
    const q = normCodigo(f.q);
    const lista = S.modelos.filter(m => {
      if (f.chip === 'semdesenho' ? m.desenho : f.chip !== 'todos' && situacao(m) !== f.chip) return false;
      if (f.rua && (lerPosicao(m.posicao) || {}).rua !== f.rua) return false;
      if (q && !normCodigo([m.codigo, m.descricao, m.posicao, m.obs, m.comercial && m.comercial.refinador, m.comercial && m.comercial.area, m.comercial && m.comercial.diametro].join(' ')).includes(q)) return false;
      return true;
    }).sort((a, b) => String(a.codigo).localeCompare(b.codigo, 'pt-BR', { numeric: true }));
    C.querySelector('#tabela').innerHTML = !lista.length ? `<div class="vazio">${S.modelos.length ? 'Nenhum modelo com esses filtros.' : 'Nenhum modelo ainda. ' + (ED ? 'Importe a planilha em <a href="#/ruas">Ruas e importação</a> ou clique em Novo modelo.' : '')}</div>` : `
      <table class="tab"><thead><tr><th>Código</th><th>Medida / descrição</th><th>Posição</th><th>Situação</th><th class="dir">Volumes</th><th>Diâmetro</th><th>Desenho</th></tr></thead><tbody>
      ${lista.map(m => `<tr class="clic" data-id="${esc(m.id)}">
        <td><b>${esc(m.codigo)}</b></td><td>${esc(m.descricao || '')}</td>
        <td class="num">${esc(m.posicao || '')}</td><td>${tagSit(m)}</td>
        <td class="dir num">${m.volumes ?? ''}</td><td>${m.comercial ? fmtValor(m.comercial.diametro) : ''}</td>
        <td>${m.desenho ? `<span class="pilula lar" title="${esc(m.desenho.nome)}">${icone('documento')} PDF</span>` : ''}</td></tr>`).join('')}
      </tbody></table>`;
  }
  pagina = { atualizar };
  atualizar();
}

// =====================================================================
//  MODELO — ficha
// =====================================================================
function paginaModelo(id, params) {
  marcarMenu('modelos');
  const orig = id === 'novo' ? null : S.porId.get(id);
  if (id !== 'novo' && !orig) {
    C.innerHTML = `<div class="faixa verm">Modelo não encontrado.</div><a class="btn" href="#/lista">${icone('voltar')} Voltar</a>`;
    pagina = { atualizar() { if (S.porId.get(id)) paginaModelo(id, params); } };
    return;
  }
  if (!orig && !ED) { location.hash = '#/lista'; return; }
  const d = orig ? JSON.parse(JSON.stringify(semMeta(orig))) : { codigo: '', descricao: '', volumes: '', posicao: lerPosicao(params.get('pos')) ? lerPosicao(params.get('pos')).pos : '', situacao: 'disponivel', obs: '', comercial: null, historico: [] };
  d.comercial = d.comercial || {};
  definirTrilha(['Almoxarifado modelos', 'Modelos', orig ? orig.codigo : 'Novo modelo']);

  C.innerHTML = `<div id="pgModelo">
    <div class="cab">
      <a class="btn" href="#/lista">${icone('voltar')}</a>
      <div class="cresce"><h1 class="titulo">${orig ? 'Modelo ' + esc(orig.codigo) : 'Novo modelo'} <span id="tagSit"></span></h1><p class="sub" id="subModelo"></p></div>
      ${orig && ED ? `<button class="btn perigo" id="btExcluir">${icone('lixo')} Excluir</button>` : ''}
      ${ED ? `<button class="btn pri" id="btSalvar">${icone('salvar')} Salvar</button>` : ''}
    </div>
    ${somenteLeitura()}
    <div class="grade2">
      <div class="cartao"><h2>Modelo</h2><div class="corpo">
        <div class="linha-campos">
          <label class="campo">Código${orig ? `<input class="ent" value="${esc(orig.codigo)}" disabled title="O código não muda depois de criado (o desenho e o histórico ficam ligados a ele)">` : ent('data-f="codigo" placeholder="ex.: 1171" autocomplete="off"', d.codigo)}<small class="mut" id="avisoCod"></small></label>
          <label class="campo">Volumes${ent('data-f="volumes" inputmode="numeric" placeholder="ex.: 4"', d.volumes)}</label>
          <label class="campo" style="grid-column:span 2">Medida / descrição${ent('data-f="descricao" placeholder="ex.: 2,3 x 4 x 7°30\' - 20&quot;"', d.descricao)}</label>
          <label class="campo">Posição<select class="ent" data-f="posicao" id="selPos" ${ED ? '' : 'disabled'}></select></label>
        </div>
        <label class="campo" style="margin-top:12px">Observações<textarea class="ent" data-f="obs" ${ED ? '' : 'disabled'}>${esc(d.obs || '')}</textarea></label>
      </div></div>
      <div class="cartao"><h2>Situação</h2><div class="corpo" id="boxSit"></div></div>
    </div>
    <div class="cartao"><h2>Desenho (PDF)</h2><div class="corpo" id="boxDesenho"></div></div>
    <div class="cartao"><h2>Ficha comercial<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">dados técnicos do refinador (aparece na Lista comercial)</span></h2><div class="corpo">
      <div class="linha-campos">${CAMPOS_COMERCIAIS.map(([k, rot]) => k === 'extensao'
        ? `<label class="campo">${rot}<select class="ent" data-c="extensao" ${ED ? '' : 'disabled'}><option value=""></option>${Object.entries(EXTENSOES).map(([v, t]) => `<option value="${v}" ${String(d.comercial.extensao) === v ? 'selected' : ''}>${v} = ${t}</option>`).join('')}</select></label>`
        : `<label class="campo">${rot}${ent(`data-c="${k}"`, typeof d.comercial[k] === 'number' ? String(d.comercial[k]).replace('.', ',') : d.comercial[k])}</label>`).join('')}</div>
    </div></div>
    ${orig ? `<div class="cartao"><h2>Histórico</h2><div class="corpo" id="boxHist"></div></div>` : ''}</div>`;

  const sub = () => {
    const at = orig && (S.porId.get(orig.id) || orig);
    C.querySelector('#subModelo').textContent = sujo ? 'Alterações não salvas' : at && at._em ? 'Salvo em ' + new Date(at._em).toLocaleString('pt-BR') + (at._por && at._por !== 'modo local' ? ' por ' + at._por : '') : (orig ? '' : 'Preencha e clique em Salvar');
    C.querySelector('#tagSit').innerHTML = tagSit(orig ? { ...(S.porId.get(orig.id) || orig), posicao: d.posicao } : d);
  };
  const marcar = () => { if (!sujo) { sujo = true; sub(); } };
  const pg = C.querySelector('#pgModelo');
  pg.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) { d[t.dataset.f] = t.value; marcar(); if (t.dataset.f === 'codigo') conferirCodigo(); }
    else if (t.dataset.c) { d.comercial[t.dataset.c] = t.value; marcar(); }
  });
  pg.addEventListener('change', e => { const t = e.target; if (t.dataset.f === 'posicao') { d.posicao = t.value; marcar(); sub(); } });

  function conferirCodigo() {
    const ja = d.codigo.trim() && S.porId.get(idModelo(d.codigo));
    C.querySelector('#avisoCod').innerHTML = ja ? `<span class="txt-verm">Já existe o modelo <a href="#/modelo/${encodeURIComponent(ja.id)}">${esc(ja.codigo)}</a>${ja.posicao ? ' em ' + esc(ja.posicao) : ''}. Código não pode repetir.</span>` : '';
  }

  function montarPosicoes() {
    const sel = C.querySelector('#selPos');
    const livres = S.ruas.map(r => ({ r, pos: posicoesDaRua(r).filter(p => !S.ocup.has(p) || (orig && S.ocup.get(p).id === orig.id) || p === d.posicao) }));
    sel.innerHTML = `<option value="">Sem posição (fora do estoque)</option>` +
      (d.posicao && !S.ruas.some(r => posicoesDaRua(r).includes(d.posicao)) ? `<option value="${esc(d.posicao)}" selected>${esc(d.posicao)} (fora do mapa)</option>` : '') +
      livres.filter(x => x.pos.length).map(x => `<optgroup label="Rua ${esc(x.r.letra)}${x.r.nivel ? ' — ' + esc(x.r.nivel) : ''}">${x.pos.map(p => `<option value="${p}" ${p === d.posicao ? 'selected' : ''}>${p}${S.ocup.has(p) && (!orig || S.ocup.get(p).id !== orig.id) ? ' (ocupada)' : ''}</option>`).join('')}</optgroup>`).join('');
  }

  function montarSituacao() {
    const box = C.querySelector('#boxSit');
    const atual = orig ? S.porId.get(orig.id) || orig : null;
    const st = situacao(atual || d);
    if (!orig) { box.innerHTML = '<p class="mut" style="margin:0">Salve o modelo para poder mandar para manutenção.</p>'; return; }
    const ult = [...(atual.historico || [])].reverse().find(h => h.tipo === 'manutencao');
    box.innerHTML = `<p style="margin-top:0">${tagSit(atual)} ${st === 'manutencao' && ult ? `<span class="mut">desde ${fmtData(ult.data)}</span>` : ''}</p>
      ${st === 'manutencao' ? `<p class="mut">A posição <b>${esc(atual.posicao || '—')}</b> fica reservada até o modelo voltar.</p>` : ''}
      ${MAN ? (st === 'manutencao'
        ? `<button class="btn pri" id="btVoltou">${icone('voltar')} Voltou da manutenção</button>`
        : `<button class="btn" id="btManut">${icone('ferramenta')} Mandar para manutenção</button>`) : ''}`;
    const bm = box.querySelector('#btManut'), bv = box.querySelector('#btVoltou');
    if (bm) bm.onclick = () => mudarSituacao('manutencao');
    if (bv) bv.onclick = () => mudarSituacao('disponivel');
  }
  function mudarSituacao(nova) {
    if (sujo) { aviso('Salve as alterações antes.', 'erro'); return; }
    const atual = S.porId.get(orig.id);
    gravarModelo({ ...atual, situacao: nova, historico: [...(atual.historico || []), evento(nova === 'manutencao' ? 'manutencao' : 'voltou')] });
    aviso(nova === 'manutencao' ? `${atual.codigo} foi para manutenção.` : `${atual.codigo} voltou da manutenção.`);
  }

  function montarDesenho() {
    const box = C.querySelector('#boxDesenho');
    const atual = orig ? S.porId.get(orig.id) : null;
    const des = atual && atual.desenho;
    if (!orig) { box.innerHTML = '<p class="mut" style="margin:0">Salve o modelo para poder anexar o desenho.</p>'; return; }
    box.innerHTML = `${des
      ? `<div class="arquivo">${icone('documento')}<div class="cresce"><b>${esc(des.nome)}</b><small class="mut">${fmtTamanho(des.tamanho)} · enviado em ${fmtData(String(des.em).slice(0, 10))}</small></div>
          <button class="btn" id="btAbrir">${icone('olho')} Abrir</button><button class="btn" id="btBaixar">${icone('baixar')} Baixar</button>
          ${ED ? `<button class="botao-ic" id="btTirar" title="Remover o desenho">${icone('lixo')}</button>` : ''}</div>`
      : `<p class="mut" style="margin-top:0">Nenhum desenho anexado.</p>`}
      ${ED ? `<label class="btn ${des ? '' : 'pri'}" style="margin-top:10px">${icone('subir')} ${des ? 'Trocar o PDF…' : 'Enviar o PDF do desenho…'}<input type="file" id="arqPdf" accept="application/pdf,.pdf" class="oculto"></label>
        <span class="mut" id="stPdf" style="margin-left:10px">PDF de até ${Math.round(banco.ARQUIVO_MAX / 1048576)} MB.</span>` : ''}`;
    const ba = box.querySelector('#btAbrir'), bb = box.querySelector('#btBaixar'), bt = box.querySelector('#btTirar'), arq = box.querySelector('#arqPdf');
    if (ba) ba.onclick = () => abrirDesenho(atual, false);
    if (bb) bb.onclick = () => abrirDesenho(atual, true);
    if (bt) bt.onclick = async () => {
      if (!confirm('Remover o desenho de ' + atual.codigo + '?')) return;
      await banco.apagarArquivo(chaveDesenho(atual.id));
      const m = { ...S.porId.get(atual.id) }; delete m.desenho;
      m.historico = [...(m.historico || []), evento('desenho', { obs: 'Desenho removido' })];
      gravarModelo(m);
      aviso('Desenho removido.');
    };
    if (arq) arq.onchange = async e => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return aviso('Escolha um arquivo PDF.', 'erro');
      if (file.size > banco.ARQUIVO_MAX) return aviso(`O PDF tem ${fmtTamanho(file.size)}; o máximo é ${Math.round(banco.ARQUIVO_MAX / 1048576)} MB.`, 'erro');
      const st = box.querySelector('#stPdf'); st.textContent = 'Enviando…';
      try {
        const meta = await banco.salvarArquivo(chaveDesenho(atual.id), file);
        const m = S.porId.get(atual.id);
        gravarModelo({ ...m, desenho: meta, historico: [...(m.historico || []), evento('desenho', { obs: (m.desenho ? 'Desenho trocado: ' : 'Desenho anexado: ') + meta.nome })] });
        aviso('Desenho salvo.');
      } catch (err) { console.error(err); st.textContent = ''; aviso('Não consegui salvar o PDF: ' + err.message, 'erro'); }
    };
  }

  function montarHistorico() {
    const box = C.querySelector('#boxHist');
    if (!box) return;
    const h = [...((S.porId.get(orig.id) || orig).historico || [])].reverse();
    const nome = { manutencao: 'Foi para manutenção', voltou: 'Voltou da manutenção', posicao: 'Mudou de posição', criado: 'Cadastrado', importado: 'Importado da planilha', desenho: 'Desenho', nota: 'Anotação' };
    box.innerHTML = !h.length ? '<p class="mut" style="margin:0">Nada registrado ainda.</p>' : `<table class="tab"><thead><tr><th>Data</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>
      ${h.map(x => `<tr><td class="num">${fmtData(x.data)}</td><td>${nome[x.tipo] || esc(x.tipo)}</td><td class="mut">${x.tipo === 'posicao' ? `${esc(x.de || 'sem posição')} → ${esc(x.para || 'sem posição')}` : esc(x.obs || '')}${x.por ? ` · ${esc(x.por)}` : ''}${x.origem === 'planilha' ? ' · da planilha' : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function salvar() {
    const codigo = String(d.codigo || '').trim().replace(/\s+/g, ' ');
    if (!codigo) return aviso('Informe o código.', 'erro');
    const novoId = orig ? orig.id : idModelo(codigo);
    if (!orig && S.porId.has(novoId)) return aviso(`Já existe o modelo ${S.porId.get(novoId).codigo}. Código não pode repetir.`, 'erro');
    const pos = d.posicao || '';
    const dono = pos && S.ocup.get(pos);
    if (dono && dono.id !== novoId) return aviso(`A posição ${pos} já está com o modelo ${dono.codigo}.`, 'erro');
    const atual = orig ? S.porId.get(orig.id) : null;
    const comercial = {};
    for (const [k] of CAMPOS_COMERCIAIS) {
      const v = String(d.comercial[k] == null ? '' : d.comercial[k]).trim();
      if (!v) continue;
      const n = /^-?[\d.,]+$/.test(v) ? num(v) : null;
      comercial[k] = k === 'extensao' ? +v : n != null && !['diametro', 'embalagem', 'variacao'].includes(k) ? n : v;
    }
    if (atual && atual.comercial && atual.comercial.ordem != null && Object.keys(comercial).length) comercial.ordem = atual.comercial.ordem;
    const historico = [...((atual && atual.historico) || [])];
    if (!orig) historico.push(evento('criado', pos ? { obs: 'Posição ' + pos } : {}));
    else if ((atual.posicao || '') !== pos) historico.push(evento('posicao', { de: atual.posicao || '', para: pos }));
    const dados = {
      ...(atual ? semMeta(atual) : {}),
      codigo: orig ? orig.codigo : codigo, descricao: String(d.descricao || '').trim(), volumes: lerVolumes(d.volumes),
      posicao: pos, situacao: atual ? atual.situacao || 'disponivel' : 'disponivel', obs: d.obs || '',
      comercial: Object.keys(comercial).length ? comercial : null, historico,
    };
    if (dados.semCodigo && !orig) delete dados.semCodigo;
    banco.salvar(COL.modelos, novoId, dados).catch(e => aviso('Erro ao salvar: ' + e.message, 'erro'));
    sujo = false;
    aviso('Modelo ' + dados.codigo + ' salvo.');
    if (!orig) { history.replaceState(null, '', '#/modelo/' + encodeURIComponent(novoId)); setTimeout(() => paginaModelo(novoId, new URLSearchParams()), 50); }
  }

  const bs = C.querySelector('#btSalvar'); if (bs) bs.onclick = salvar;
  const bx = C.querySelector('#btExcluir');
  if (bx) bx.onclick = async () => {
    if (!confirm(`Excluir o modelo ${orig.codigo}?${orig.desenho ? ' O desenho (PDF) também será apagado.' : ''}`)) return;
    if (orig.desenho) await banco.apagarArquivo(chaveDesenho(orig.id)).catch(() => {});
    await banco.apagar(COL.modelos, orig.id);
    sujo = false;
    aviso('Modelo excluído.');
    location.hash = '#/lista';
  };

  function tudo() { montarPosicoes(); montarSituacao(); montarDesenho(); montarHistorico(); sub(); }
  pagina = { atualizar() { if (orig && !S.porId.get(orig.id)) { location.hash = '#/lista'; return; } montarPosicoes(); montarSituacao(); montarDesenho(); montarHistorico(); sub(); } };
  tudo();
}

async function abrirDesenho(m, baixar) {
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

// =====================================================================
//  LISTA COMERCIAL (aba Comercial da planilha)
// =====================================================================
function paginaComercial() {
  marcarMenu('comercial');
  definirTrilha(['Modelos Prometals', 'Lista comercial']);
  const f = filtros.comercial;
  C.innerHTML = `
    <div class="cab"><div class="cresce"><h1 class="titulo">Lista comercial — refinadores</h1><p class="sub">Dados técnicos e situação no estoque (atualiza sozinha pelas prateleiras). Clique no PDF para ver o desenho.</p></div></div>
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fDiam" style="width:auto;min-width:140px"></select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar código, refinador, área…" value="${esc(f.q)}"></div>
      <span class="mut">Extensão disco: 1 = Não · 2 = Over Hang · 3 = Inner Hang</span>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#fDiam').onchange = e => { f.diam = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  const chip = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#chips').onclick = chip;
  C.querySelector('#kpis').onclick = chip;
  C.querySelector('#tabela').onclick = e => {
    const pdf = e.target.closest('[data-pdf]');
    if (pdf) { e.stopPropagation(); abrirDesenho(S.porId.get(pdf.dataset.pdf), false); return; }
    const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/modelo/' + encodeURIComponent(tr.dataset.id);
  };
  function atualizar() {
    const todos = S.modelos.filter(m => m.comercial);
    const n = k => todos.filter(m => situacao(m) === k).length;
    C.querySelector('#kpis').innerHTML = kpi(todos.length, 'Refinadores', '', 'todos') + kpi(n('disponivel'), 'Disponíveis', 'verde', 'disponivel') + kpi(n('manutencao'), 'Em manutenção', 'amar', 'manutencao') + kpi(n('fora'), 'Fora do estoque', '', 'fora');
    C.querySelector('#chips').innerHTML = [['todos', 'Todos'], ['disponivel', 'Disponíveis'], ['manutencao', 'Em manutenção'], ['fora', 'Fora do estoque']].map(([k, t]) => `<button class="ficha ${f.chip === k ? 'sel' : ''}" data-chip="${k}">${t}</button>`).join('');
    const diams = [...new Set(todos.map(m => String(m.comercial.diametro || '')).filter(Boolean))].sort((a, b) => chaveDiametro(a) - chaveDiametro(b) || a.localeCompare(b));
    C.querySelector('#fDiam').innerHTML = `<option value="">Todos os diâmetros</option>` + diams.map(x => `<option ${f.diam === x ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const q = normCodigo(f.q);
    const lista = todos.filter(m => {
      if (f.chip !== 'todos' && situacao(m) !== f.chip) return false;
      if (f.diam && String(m.comercial.diametro || '') !== f.diam) return false;
      if (q && !normCodigo([m.codigo, m.descricao, ...Object.values(m.comercial)].join(' ')).includes(q)) return false;
      return true;
    }).sort((a, b) => (a.comercial.ordem ?? 1e6) - (b.comercial.ordem ?? 1e6) || chaveDiametro(a.comercial.diametro) - chaveDiametro(b.comercial.diametro));
    C.querySelector('#tabela').innerHTML = !lista.length ? `<div class="vazio">${todos.length ? 'Nenhum refinador com esses filtros.' : 'Nenhuma ficha comercial ainda.'}</div>` : `
      <table class="tab tab-com"><thead><tr><th>Diâmetro</th><th>Variação</th><th>Código</th><th class="cen">Ext.</th><th>Situação</th><th>Refinador</th><th>Descrição refinador</th><th>Área refinadora</th><th class="dir">Setores</th><th class="dir">Km/rev</th><th class="dir">Segm./disco</th><th class="dir">Discos</th><th>Embalagem</th><th>Peso</th><th>Desenho</th></tr></thead><tbody>
      ${lista.map(m => { const c = m.comercial; return `<tr class="clic" data-id="${esc(m.id)}">
        <td>${fmtValor(c.diametro)}</td><td>${fmtValor(c.variacao)}</td><td><b>${esc(m.codigo)}</b></td><td class="cen">${fmtValor(c.extensao)}</td><td>${tagSit(m)}${m.posicao ? ` <small class="mut">${esc(m.posicao)}</small>` : ''}</td>
        <td>${fmtValor(c.refinador)}</td><td>${fmtValor(c.descRefinador)}</td><td>${fmtValor(c.area)}</td><td class="dir num">${fmtValor(c.setores)}</td><td class="dir num">${fmtValor(c.kmRev)}</td>
        <td class="dir num">${fmtValor(c.segmentos)}</td><td class="dir num">${fmtValor(c.discos)}</td><td>${fmtValor(c.embalagem)}</td><td>${fmtValor(c.peso)}</td>
        <td>${m.desenho ? `<button class="btn peq" data-pdf="${esc(m.id)}" title="${esc(m.desenho.nome)}">${icone('documento')} PDF</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table>`;
  }
  pagina = { atualizar };
  atualizar();
}

// =====================================================================
//  RUAS E IMPORTAÇÃO
// =====================================================================
function paginaRuas() {
  marcarMenu('ruas');
  definirTrilha(['Almoxarifado modelos', 'Ruas e importação']);
  C.innerHTML = `
    <div class="cab"><div class="cresce"><h1 class="titulo">Ruas e importação</h1><p class="sub">As ruas do almoxarifado, quantas posições cada uma tem, e a importação da planilha.</p></div>
      ${ED ? `<button class="btn pri" id="btNovaRua">${icone('mais')} Nova rua</button>` : ''}</div>
    ${somenteLeitura()}
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>
    ${ED ? `<div class="cartao"><h2>Importar a planilha Almoxarifado de Modelos</h2><div class="corpo">
      <p style="margin-top:0">Traz da planilha <b>.xlsx</b>: as ruas (abas Mapa e Modelos), cada modelo com posição, volumes e situação (aba Modelos) e a ficha técnica dos refinadores (aba Comercial).
        <b>Código repetido não entra</b>: fica o primeiro e os outros aparecem no aviso.</p>
      <p class="mut">Pode importar de novo: o que veio da planilha é atualizado; desenhos (PDF) e histórico do sistema são mantidos.</p>
      <label class="btn">${icone('subir')} Escolher planilha…<input type="file" id="arqPlan" accept=".xlsx,.xlsm,.xls" class="oculto"></label>
      <span class="mut" id="statusImp" style="margin-left:10px"></span>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa os modelos e as ruas (sem os PDFs). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
    </div></div>` : ''}`;
  if (ED) {
    C.querySelector('#btNovaRua').onclick = () => editarRua(null);
    C.querySelector('#arqPlan').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilha(f); };
    C.querySelector('#btExp').onclick = () => baixarArquivo(`modelos-${hoje()}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), modelos: S.modelos, ruas: S.ruas }, null, 1));
    C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-rua]'); if (tr) editarRua(S.ruas.find(r => r.letra === tr.dataset.rua)); };
  }
  function atualizar() {
    C.querySelector('#tabela').innerHTML = !S.ruas.length ? '<div class="vazio">Nenhuma rua cadastrada.</div>' : `
      <table class="tab"><thead><tr><th>Rua</th><th>Nível</th><th class="dir">Posições</th><th class="dir">Ocupadas</th><th class="dir">Em manutenção</th><th class="dir">Livres</th></tr></thead><tbody>
      ${S.ruas.map(r => { const p = posicoesDaRua(r); const oc = p.filter(x => S.ocup.has(x)); return `<tr class="${ED ? 'clic' : ''}" data-rua="${esc(r.letra)}">
        <td><b>${esc(r.letra)}</b></td><td>${esc(r.nivel || '')}</td><td class="dir num">${p.length}</td><td class="dir num">${oc.length}</td>
        <td class="dir num">${oc.filter(x => situacao(S.ocup.get(x)) === 'manutencao').length || ''}</td><td class="dir num">${p.length - oc.length}</td></tr>`; }).join('')}
      </tbody></table>`;
  }
  pagina = { atualizar };
  atualizar();
}

function editarRua(r) {
  const nova = !r;
  const ocupadas = r ? posicoesDaRua(r).filter(p => S.ocup.has(p)) : [];
  const maiorOcupada = Math.max(0, ...S.modelos.map(m => lerPosicao(m.posicao)).filter(p => p && r && p.rua === r.letra).map(p => p.n));
  janela({
    titulo: nova ? 'Nova rua' : 'Rua ' + r.letra,
    html: `<div class="linha-campos">
      <label class="campo">Letra da rua${nova ? `<input class="ent" id="rLetra" maxlength="3" placeholder="ex.: F">` : `<input class="ent" value="${esc(r.letra)}" disabled>`}</label>
      <label class="campo">Nível<input class="ent" id="rNivel" placeholder="ex.: Nível 2" value="${esc(r ? r.nivel || '' : '')}"></label>
      <label class="campo">Nº de posições<input class="ent" id="rPos" inputmode="numeric" value="${r ? r.posicoes : 12}"></label>
      <label class="campo">Ordem no mapa<input class="ent" id="rOrdem" inputmode="numeric" value="${r ? (r.ordem ?? '') : S.ruas.length}"></label></div>
      ${maiorOcupada ? `<p class="mut">A posição mais alta ocupada é ${esc(r.letra)}${maiorOcupada}: a rua não pode ter menos posições que isso.</p>` : ''}`,
    botoes: [
      ...(!nova ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (ocupadas.length) { aviso(`A rua ${r.letra} tem ${ocupadas.length} modelos. Tire os modelos antes de excluir.`, 'erro'); return false; }
        if (!confirm('Excluir a rua ' + r.letra + '?')) return false;
        banco.apagar(COL.ruas, r.letra);
        aviso('Rua excluída.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const letra = nova ? el.querySelector('#rLetra').value.trim().toUpperCase() : r.letra;
        if (!/^[A-Z]{1,3}$/.test(letra)) { aviso('A rua é uma letra (ex.: F).', 'erro'); return false; }
        if (nova && S.ruas.some(x => x.letra === letra)) { aviso('A rua ' + letra + ' já existe.', 'erro'); return false; }
        const posicoes = Math.round(num(el.querySelector('#rPos').value) || 0);
        if (posicoes < 1) { aviso('Informe o nº de posições.', 'erro'); return false; }
        if (posicoes < maiorOcupada) { aviso(`A posição ${letra}${maiorOcupada} está ocupada; a rua precisa ter pelo menos ${maiorOcupada} posições.`, 'erro'); return false; }
        banco.salvar(COL.ruas, letra, { letra, nivel: el.querySelector('#rNivel').value.trim(), posicoes, ordem: num(el.querySelector('#rOrdem').value) ?? S.ruas.length });
        aviso('Rua ' + letra + ' salva.');
      } },
    ],
  });
}

async function importarPlanilha(arquivo) {
  const st = C.querySelector('#statusImp');
  st.textContent = 'Lendo a planilha…';
  let dados;
  try { dados = await lerAlmoxarifado(arquivo); }
  catch (e) { console.error(e); st.textContent = ''; return aviso('Não consegui ler a planilha: ' + e.message, 'erro'); }
  st.textContent = '';
  const r = dados.resumo;
  if (!r.modelos) return aviso('Não achei modelos nesta planilha.', 'erro');
  const vemDaPlanilha = new Set(dados.modelos.map(m => m.id));
  const soNoSistema = S.modelos.filter(m => !vemDaPlanilha.has(m.id));
  // posição que a planilha dá para um modelo e que, no sistema, está com outro modelo que não veio da planilha
  const conflitos = dados.modelos.filter(m => m.posicao && S.ocup.get(m.posicao) && !vemDaPlanilha.has(S.ocup.get(m.posicao).id));
  janela({
    titulo: 'Importar ' + arquivo.name, larga: true,
    html: `<ul style="margin-top:0;padding-left:18px;line-height:1.7">
        <li><b>${dados.ruas.length} ruas</b> (${dados.ruas.map(x => x.letra + ' ' + x.posicoes).join(' · ')} posições)</li>
        <li><b>${r.modelos} modelos</b>: ${r.naPrateleira} na prateleira (${r.manutencao} em manutenção) e ${r.soComercial} só na lista comercial (fora do estoque)</li>
        <li><b>${r.comFicha}</b> com ficha comercial · ${r.livres} posições livres na aba Modelos</li>
        ${r.duplicados ? `<li class="txt-verm"><b>${r.duplicados} código(s) repetido(s) não entram</b> (veja abaixo)</li>` : ''}
        ${soNoSistema.length ? `<li class="mut">${soNoSistema.length} modelos que só existem no sistema não são mexidos.</li>` : ''}
        ${conflitos.length ? `<li class="txt-verm">${conflitos.length} posições da planilha estão ocupadas no sistema por outro modelo: ${conflitos.map(m => `${esc(m.posicao)} (${esc(m.codigo)})`).join(', ')}. Esses modelos entram sem posição.</li>` : ''}
      </ul>
      ${dados.avisos.length ? `<div class="faixa lar" style="margin-top:8px">${dados.avisos.map(esc).join('<br>')}</div>` : ''}
      <div id="progImp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      for (const ru of dados.ruas) {
        const atual = S.ruas.find(x => x.letra === ru.letra);
        ops.push({ col: COL.ruas, id: ru.letra, dados: { letra: ru.letra, nivel: ru.nivel || (atual && atual.nivel) || '', posicoes: Math.max(ru.posicoes, (atual && atual.posicoes) || 0), ordem: ru.ordem } });
      }
      for (const m of dados.modelos) {
        const atual = S.porId.get(m.id);
        const { id, ...resto } = m;
        if (conflitos.includes(m)) resto.posicao = '';
        // mantém o que é do sistema: desenho, histórico (sem repetir o que veio da planilha) e observação
        const hist = [...((atual && atual.historico) || [])];
        for (const h of resto.historico) if (!hist.some(x => x.data === h.data && x.tipo === h.tipo && x.origem === 'planilha')) hist.push(h);
        if (!atual) hist.push({ data: hoje(), tipo: 'importado', obs: resto.posicao ? 'Posição ' + resto.posicao : 'Sem posição' });
        else if ((atual.posicao || '') !== (resto.posicao || '')) hist.push({ data: hoje(), tipo: 'posicao', de: atual.posicao || '', para: resto.posicao || '', origem: 'planilha' });
        ops.push({ col: COL.modelos, id, dados: {
          ...(atual ? semMeta(atual) : {}), ...resto,
          obs: resto.obs || (atual && atual.obs) || '',
          comercial: resto.comercial || (atual && atual.comercial) || null,
          historico: hist.sort((a, b) => String(a.data).localeCompare(String(b.data))),
        } });
      }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await banco.emLote(ops, (feito, total) => { el.querySelector('#progImp').textContent = `Gravando ${feito} de ${total}…`; });
        aviso(`Importação concluída: ${dados.modelos.length} modelos e ${dados.ruas.length} ruas.`);
      } catch (e) {
        console.error(e);
        aviso('Erro na importação: ' + e.message, 'erro');
        el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        return false;
      }
    } }],
  });
}
