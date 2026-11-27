// =====================================================================
//  calculo_liga/amostras_dia/amostras_dia.js — tela Amostras do dia
//  Etiqueta do saquinho, etiquetas dos retornos e formulário A4 do
//  laboratório (Priner), montados com as corridas do dia.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.2';
import { aviso, janela, esc, num, hoje, fmtData, icone, filtroDaTela } from '../../comum/casca.js?v=2.0.2';
import { COL } from '../calculo.js?v=2.0.2';
import { etiquetasSaquinho, etiquetaRetorno, folhasRetorno, formularioPriner, PRINER_PADRAO, corridaEtiqueta } from '../etiquetas_amostras.js?v=2.0.2';
import { S, C, ED, cfg, ligaDe, corDaLiga, ent, url, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.2';

const amostras = filtroDaTela('amostras', { data: null, fora: new Set(), copias: 1, retornos: false });
amostras.fora = new Set();
iniciarTela({ tela: 'amostras', trilha: ['Cálculo de Liga', 'Amostras do dia'], desenhar: paginaAmostras });

function paginaAmostras() {
  const f = amostras;
  if (!f.data) f.data = hoje();
  C.innerHTML = `
    <div class="cab">
      <a class="btn" href="${url('corridas')}">${icone('voltar')}</a>
      <div class="cresce"><h1 class="titulo">Amostras do dia</h1><p class="sub">Etiqueta do saquinho das amostras (10 × 5 cm), etiqueta de cada retorno (meia folha A4, duas por folha, ou 10 × 5 cm) e o formulário do laboratório (A4), com as corridas do dia.</p></div>
      <button class="btn so-ed" id="btDadosLab">${icone('engrenagem')} Dados do formulário</button>
    </div>
    <div class="cartao livre"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <button class="btn" id="btDiaAnt" title="Dia anterior">${icone('voltar')}</button>
      <label class="campo" style="width:auto">Data das corridas<input class="ent" type="date" id="aData" value="${esc(f.data)}"></label>
      <button class="btn" id="btDiaProx" title="Próximo dia" style="transform:scaleX(-1)">${icone('voltar')}</button>
      <button class="btn" id="btHoje">Hoje</button>
      <span class="cresce"></span>
      <label class="campo" style="width:auto">Cópias da etiqueta do saquinho<input class="ent num" id="aCopias" inputmode="numeric" value="${f.copias}" style="width:90px"></label>
      <label class="opcao" style="margin:0"><input type="checkbox" id="aRet" ${f.retornos ? 'checked' : ''}> Retornos também em etiqueta 10 × 5</label>
      <button class="btn pri" id="btImprEtq">${icone('impressora')} Imprimir etiquetas</button>
      <button class="btn pri" id="btImprRet">${icone('impressora')} Imprimir retornos (A4)</button>
      <button class="btn pri" id="btImprA4">${icone('impressora')} Imprimir formulário A4</button>
    </div></div>
    <div class="cartao livre"><h2>Corridas do dia<span class="cresce"></span><span class="mut" id="aResumo" style="text-transform:none;letter-spacing:0;font-weight:500"></span></h2><div class="tab-wrap" id="aTab"></div></div>
    <div id="aAvisos"></div>
    <div class="cartao"><h2>Etiquetas 10 × 5 cm (tamanho real)</h2><div class="corpo"><div class="prev-etq" id="aEtq"></div></div></div>
    <div class="cartao"><h2>Etiquetas dos retornos (meia folha A4, duas por folha)</h2><div class="corpo"><div class="prev-ret" id="aRetPrev"></div></div></div>
    <div class="cartao"><h2>Formulário do laboratório (A4)</h2><div class="corpo"><div class="prev-a4"><div class="prev-a4-in" id="aA4"></div></div></div></div>`;

  const mudarDia = d => { const x = new Date(f.data + 'T12:00:00'); x.setDate(x.getDate() + d); f.data = x.toISOString().slice(0, 10); f.fora.clear(); C.querySelector('#aData').value = f.data; atualizar(); };
  C.querySelector('#aData').onchange = e => { f.data = e.target.value || hoje(); f.fora.clear(); atualizar(); };
  C.querySelector('#btDiaAnt').onclick = () => mudarDia(-1);
  C.querySelector('#btDiaProx').onclick = () => mudarDia(+1);
  C.querySelector('#btHoje').onclick = () => { f.data = hoje(); f.fora.clear(); C.querySelector('#aData').value = f.data; atualizar(); };
  C.querySelector('#aCopias').oninput = e => { f.copias = Math.max(0, Math.min(10, Math.round(num(e.target.value) || 0))); atualizar(); };
  C.querySelector('#aRet').onchange = e => { f.retornos = e.target.checked; atualizar(); };
  C.querySelector('#aTab').onchange = e => { const ck = e.target.closest('[data-ck]'); if (ck) { ck.checked ? f.fora.delete(ck.dataset.ck) : f.fora.add(ck.dataset.ck); atualizar(); } };
  C.querySelector('#btDadosLab').onclick = editarDadosLab;
  C.querySelector('#btImprEtq').onclick = () => { const x = montar(); if (!x.sel.length) return aviso('Nenhuma corrida marcada.', 'erro'); if (!x.etiquetas.length) return aviso('Nenhuma etiqueta: cópias do saquinho = 0 e retornos em 10 × 5 desmarcado.', 'erro'); imprimirAmostras(x.etiquetas.map(h => `<div class="pg-etq">${h}</div>`).join('')); };
  C.querySelector('#btImprRet').onclick = () => { const x = montar(); if (!x.sel.length) return aviso('Nenhuma corrida marcada.', 'erro'); imprimirAmostras(x.retornos.join('')); };
  C.querySelector('#btImprA4').onclick = () => { const x = montar(); if (!x.sel.length) return aviso('Nenhuma corrida marcada.', 'erro'); imprimirAmostras(`<div class="pg-a4">${x.form}</div>`); };

  function doDia() {
    return S.corridas.filter(c => c.data === f.data)
      .sort((a, b) => (+a.anual || 0) - (+b.anual || 0) || (+a.refratario || 0) - (+b.refratario || 0));
  }
  function montar() {
    const sel = doDia().filter(c => !f.fora.has(c.id));
    const saq = sel.length ? etiquetasSaquinho(sel, f.data) : [];
    const etiquetas = [];
    for (let i = 0; i < f.copias; i++) etiquetas.push(...saq);
    if (f.retornos) sel.forEach(c => etiquetas.push(etiquetaRetorno(c, corDaLiga(c.liga))));
    const retornos = folhasRetorno(sel.map(c => etiquetaRetorno(c, corDaLiga(c.liga), true)));
    return { sel, etiquetas, retornos, form: formularioPriner(sel, f.data, cfg().priner) };
  }
  function atualizar() {
    const lista = doDia();
    const x = montar();
    C.querySelector('#aResumo').textContent = lista.length ? `${x.sel.length} de ${lista.length} marcadas · ${x.etiquetas.length} etiqueta(s) 10 × 5 ·${x.retornos.length} folha(s) A4 de retorno` : '';
    C.querySelector('#aTab').innerHTML = !lista.length ? `<div class="vazio">Nenhuma corrida em ${fmtData(f.data)}. Escolha outra data.</div>` : `
      <table class="tab"><thead><tr><th style="width:34px"></th><th>Corrida</th><th>Liga</th><th>Cor do retorno</th><th>FS / OPs</th><th>Retorno gerado</th></tr></thead><tbody>
      ${lista.map(c => { const l = ligaDe(c.liga); return `<tr>
        <td><input type="checkbox" data-ck="${esc(c.id)}" ${f.fora.has(c.id) ? '' : 'checked'}></td>
        <td class="num"><a href="${url('ficha_corrida', { id: c.id })}"><b>${esc(corridaEtiqueta(c))}</b></a></td>
        <td><span class="pilula lar">${esc(c.liga || '?')}</span></td>
        <td>${corDaLiga(c.liga) ? esc(corDaLiga(c.liga)) + (l && l.cor ? "" : ` <span class="mut">(tabela)</span>`) : `<span class="txt-amar">sem cor</span>`}</td>
        <td>${c.fs ? `<b>${esc(c.fs)}</b> ` : ''}<span class="mut">${esc((c.ops || []).join(', '))}</span></td>
        <td class="mut">${esc(c.retornoGerado || '')}</td></tr>`; }).join('')}
      </tbody></table>`;
    const semCor = [...new Set(x.sel.filter(c => !corDaLiga(c.liga)).map(c => c.liga || '?'))];
    C.querySelector('#aAvisos').innerHTML = semCor.length ? `<div class="faixa lar">Sem cor de marcação cadastrada: <b>${esc(semCor.join(', '))}</b>. A etiqueta do retorno sai com “COR:” em branco para escrever à mão. Cadastre a cor em <a href="${url('ligas_normas')}">Ligas e normas</a>.</div>` : '';
    C.querySelector('#aEtq').innerHTML = x.etiquetas.length ? x.etiquetas.join('') : '<span class="mut">Nenhuma etiqueta.</span>';
    C.querySelector('#aRetPrev').innerHTML = x.retornos.length ? x.retornos.join('') : '<span class="mut" style="color:#fff">Nenhuma corrida marcada.</span>';
    C.querySelector('#aA4').innerHTML = x.form;
  }
  aoMudarDados(atualizar);
  atualizar();
}

function editarDadosLab() {
  const p = { ...PRINER_PADRAO, ...(cfg().priner || {}) };
  const campo = (k, rot, extra = '') => `<label class="campo">${rot}${ent(`id="p_${k}" ${extra}`, p[k])}</label>`;
  const escolha = (k, rot, ops) => `<label class="campo">${rot}<select class="ent" id="p_${k}"><option value="">(em branco — marcar à mão)</option>${ops.map(([v, t]) => `<option value="${v}" ${p[k] === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  janela({
    titulo: 'Dados do formulário do laboratório', larga: true,
    html: `<p class="mut" style="margin-top:0">Saem em todo formulário. Os campos “Preenchimento pelo Labteste” ficam em branco.</p>
      <div class="linha-campos">
        ${campo('empresa', 'Empresa')}${campo('contato', 'Contato')}${campo('telefone', 'Telefone')}${campo('vendedor', 'Vendedor')}
      </div>
      <div class="linha-campos" style="margin-top:10px">${campo('emailNF', 'E-mail para envio de NF')}<label class="campo" style="grid-column:span 2">E-mail para envio de relatório${ent('id="p_emailRelatorio"', p.emailRelatorio)}</label></div>
      <div class="linha-campos" style="margin-top:10px">${campo('ensaio', 'Ensaio / análise de cada amostra')}${campo('norma', 'Norma de ensaio')}</div>
      <div class="linha-campos" style="margin-top:10px">
        ${escolha('destruir', 'Amostras podem ser destruídas?', [['SIM', 'SIM'], ['NAO', 'NÃO']])}
        ${escolha('acompanhar', 'Haverá acompanhamento?', [['SIM', 'SIM'], ['NAO', 'NÃO']])}
        ${escolha('destino', 'Após o ensaio, as amostras serão…', [['DESCARTADAS', 'DESCARTADAS'], ['RETIRADAS', 'RETIRADAS']])}
      </div>
      <label class="campo" style="margin-top:10px">Informações adicionais${ent('id="p_infoAdicional"', p.infoAdicional)}</label>
      <h4 style="margin:16px 0 6px">Cabeçalho do formulário do laboratório</h4>
      <div class="linha-campos">${campo('formCodigo', 'Código')}${campo('formRevisao', 'Revisão')}${campo('formData', 'Data da revisão')}</div>
      <label class="campo" style="margin-top:10px">Rodapé${ent('id="p_rodape"', p.rodape)}</label>`,
    soLeitura: !ED,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', cls: 'pri', acao: el => {
      const novo = {};
      for (const k of Object.keys(PRINER_PADRAO)) { const i = el.querySelector('#p_' + k); if (i) novo[k] = i.value.trim(); }
      banco.salvar(COL.config, 'liga', { ...cfg(), priner: novo });
      aviso('Dados do formulário salvos.');
    } }],
  });
}

let tituloAmostras = null;
function imprimirAmostras(html) {
  let area = document.getElementById('areaImpressao');
  if (!area) { area = document.createElement('div'); area.id = 'areaImpressao'; document.body.appendChild(area); }
  area.innerHTML = html;
  document.body.classList.add('imprimindo-amostras');
  tituloAmostras = document.title;
  document.title = 'Amostras ' + fmtData(amostras.data);
  window.print();
}
window.addEventListener('afterprint', () => {
  if (!document.body.classList.contains('imprimindo-amostras')) return;
  document.body.classList.remove('imprimindo-amostras');
  const area = document.getElementById('areaImpressao'); if (area) area.innerHTML = '';
  if (tituloAmostras !== null) { document.title = tituloAmostras; tituloAmostras = null; }
});
