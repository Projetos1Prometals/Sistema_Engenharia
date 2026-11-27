// =====================================================================
//  almoxarifado_modelos/modelos/modelos.js — tela Modelos (lista)
// =====================================================================
import { esc, icone, filtroDaTela } from '../../comum/casca.js?v=2.0.2';
import { normCodigo, situacao, lerPosicao } from '../regras.js?v=2.0.2';
import { S, C, ED, url, iniciarTela, aoMudarDados, tagSit, fmtValor, kpi, somenteLeitura } from '../base_modelos.js?v=2.0.2';

const f = filtroDaTela('modelos', { chip: 'todos', rua: '', q: '' });
iniciarTela({ ver: ['modelos'], edita: 'modelos', menu: 'modelos', trilha: ['Almoxarifado modelos', 'Modelos'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Modelos</h1><p class="sub">Todos os modelos, com posição, situação e desenho.</p></div>
      ${ED ? `<a class="btn pri" href="${url('ficha_modelo')}">${icone('mais')} Novo modelo</a>` : ''}
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
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.href = url('ficha_modelo', { id: tr.dataset.id }); };

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
    C.querySelector('#tabela').innerHTML = !lista.length ? `<div class="vazio">${S.modelos.length ? 'Nenhum modelo com esses filtros.' : 'Nenhum modelo ainda. ' + (ED ? 'Importe a planilha em <a href="' + url('ruas_importacao') + '">Ruas e importação</a> ou clique em Novo modelo.' : '')}</div>` : `
      <table class="tab"><thead><tr><th>Código</th><th>Medida / descrição</th><th>Posição</th><th>Situação</th><th class="dir">Volumes</th><th>Diâmetro</th><th>Desenho</th></tr></thead><tbody>
      ${lista.map(m => `<tr class="clic" data-id="${esc(m.id)}">
        <td><b>${esc(m.codigo)}</b></td><td>${esc(m.descricao || '')}</td>
        <td class="num">${esc(m.posicao || '')}</td><td>${tagSit(m)}</td>
        <td class="dir num">${m.volumes ?? ''}</td><td>${m.comercial ? fmtValor(m.comercial.diametro) : ''}</td>
        <td>${m.desenho ? `<span class="pilula lar" title="${esc(m.desenho.nome)}">${icone('documento')} PDF</span>` : ''}</td></tr>`).join('')}
      </tbody></table>`;
  }
  aoMudarDados(atualizar);
  atualizar();
}
