// =====================================================================
//  calculo_liga/corridas/corridas.js — tela Corridas (lista)
// =====================================================================
import { esc, fmtKg, fmtData, icone, podeVer, filtroDaTela } from '../../comum/casca.js?v=2.0.2';
import { mesmaLiga, conferir, numeroCorrida, statusCorrida, temAnalise } from '../calculo.js?v=2.0.2';
import { S, C, cfg, ligaDe, optLigas, url, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.2';

const f = filtroDaTela('corridas', { chip: 'todas', liga: '', q: '' });
iniciarTela({ tela: 'corridas', trilha: ['Cálculo de Liga', 'Corridas'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Corridas</h1><p class="sub">Carga do forno, boletim para o forneiro e resultado do laboratório de cada corrida.</p></div>
      ${podeVer('amostras') ? `<a class="btn" href="${url('amostras_dia')}" title="Etiquetas do saquinho e dos retornos e o formulário do laboratório">${icone('tubo')} Amostras do dia</a>` : ''}
      <a class="btn pri so-ed" href="${url('ficha_corrida')}">${icone('mais')} Nova corrida</a>
    </div>
    <div class="kpis" id="kpis"></div>
    <div class="cartao livre"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fLiga" style="width:auto;min-width:150px">${optLigas(f.liga, 'Todas as ligas')}</select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar nº da corrida, OP, FS, liga ou retorno…" value="${esc(f.q)}"></div>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#fLiga').onchange = e => { f.liga = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  C.querySelector('#chips').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#kpis').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.href = url('ficha_corrida', { id: tr.dataset.id }); };

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
        const alvo = [numeroCorrida(x.c), x.c.liga, x.c.fs, (x.c.ops || []).join(' '), x.c.opsTexto, (x.c.retornos || []).map(r => r.codigo).join(' '), x.c.retornoGerado, x.c.lab && x.c.lab.relatorio].join(' ').toLowerCase();
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
        <td>${c.origem === 'planilha' && !temAnalise(c.estimadoPlanilha) ? '<span class="mut" title="A planilha Controle de Corrida não tem a composição estimada">–</span>'
          : foraEst.length ? `<span class="tag alerta" title="${esc(foraEst.join(', '))}">${foraEst.length} fora</span>` : '<span class="tag ok">ok</span>'}</td>
        <td><span class="tag ${st.cls}" title="${esc(st.fora.join(', '))}">${st.texto}</span></td>
      </tr>`).join('')}</tbody></table>
      ${total > 300 ? `<div class="vazio">Mostrando as 300 mais recentes de ${total}. Use a busca para achar as outras.</div>` : ''}`;
  }
  aoMudarDados(atualizar);
  atualizar();
}

function cargaClasse(kg) {
  const { min, max } = cfg().forno || {};
  if (!kg) return '';
  if (max && kg > max) return 'txt-verm';
  if (min && kg < min) return 'txt-amar';
  return '';
}
