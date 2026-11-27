// =====================================================================
//  modelos_prometals/lista_comercial/lista_comercial.js — Lista comercial
//  (aba Comercial da planilha): refinadores com dados técnicos e situação
//  no estoque. Só consulta; usa a base do Almoxarifado modelos.
// =====================================================================
import { esc, icone, filtroDaTela } from '../../comum/casca.js?v=2.0.2';
import { normCodigo, situacao, chaveDiametro } from '../../almoxarifado_modelos/regras.js?v=2.0.2';
import { S, C, url, iniciarTela, aoMudarDados, tagSit, fmtValor, kpi, abrirDesenho } from '../../almoxarifado_modelos/base_modelos.js?v=2.0.2';

const f = filtroDaTela('comercial', { chip: 'todos', diam: '', q: '' });
iniciarTela({ ver: ['comercial'], edita: null, menu: 'comercial', trilha: ['Modelos Prometals', 'Lista comercial'], desenhar });

function desenhar() {
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
    const tr = e.target.closest('tr[data-id]'); if (tr) location.href = url('ficha_modelo', { id: tr.dataset.id });
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
  aoMudarDados(atualizar);
  atualizar();
}
