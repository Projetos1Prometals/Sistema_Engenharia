// =====================================================================
//  calculo_liga/sucatas_ferroligas/sucatas_ferroligas.js — tela Sucatas e ferroligas
//  Teor de cada elemento (%) usado no cálculo da carga e o código MP do NW.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.2';
import { aviso, janela, esc, num, fmt, icone } from '../../comum/casca.js?v=2.0.2';
import { ELEMENTOS, COL, normLiga } from '../calculo.js?v=2.0.2';
import { S, C, ED, sucatas, ferroligas, semMeta, ent, entNum, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.2';

iniciarTela({ tela: 'materiais', trilha: ['Cálculo de Liga', 'Sucatas e ferroligas'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Sucatas e ferroligas</h1><p class="sub">Teor de cada elemento (%) usado no cálculo da carga, e o código da matéria-prima no NW (sai no boletim).</p></div>
      <button class="btn pri so-ed" id="btNovoMat">${icone('mais')} Novo material</button>
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
  aoMudarDados(atualizar);
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
    soLeitura: !ED,
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
