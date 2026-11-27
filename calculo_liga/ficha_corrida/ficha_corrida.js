// =====================================================================
//  calculo_liga/ficha_corrida/ficha_corrida.js — ficha da corrida
//  (equivalente à aba PREENCHIMENTO + boletim + laboratório)
//  ?id=<id da corrida>; sem id = nova corrida.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { definirTrilha, aviso, janela, esc, num, fmt, fmtKg, hoje, icone, podeEditar, endereco, parametro, ir } from '../../comum/casca.js?v=2.0.1';
import {
  ELEMENTOS, ELEMENTOS_LAB_EXTRA, COL, mesmaLiga, calcular, situacaoElemento, numeroCorrida, codigoRetornoDaCorrida, idCorrida,
  lerOps, temAnalise, normLiga, baixaDoRetorno,
} from '../calculo.js?v=2.0.1';
import { S, C, ED, cfg, ligaDe, sucatas, ferroligas, semMeta, ent, entNum, optLigas, fmtComp, url, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.1';

let editor = null;     // corrida aberta: { id, d (rascunho), sujo }
iniciarTela({
  tela: 'corridas', trilha: ['Cálculo de Liga', 'Corridas'],
  desenhar() {
    const id = parametro('id') || 'nova';
    if (id === 'nova' && !ED) { location.replace(url('corridas')); return; }
    paginaCorrida(id);
  },
});
window.addEventListener('beforeunload', e => { if (editor && editor.sujo) { e.preventDefault(); e.returnValue = ''; } });

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
  const analise = (a, lista = ELEMENTOS) => { const o = {}; for (const e of lista) { const v = num(a && a[e]); if (v != null) o[e] = v; } return o; };
  return {
    ...d,
    anual: num(d.anual), refratario: num(d.refratario), temperatura: num(d.temperatura),
    ops: lerOps(d.opsTexto),
    retornos: (d.retornos || []).filter(r => r.codigo || num(r.kg) || num(r.recarga))
      .map(r => ({ codigo: r.codigo, kg: num(r.kg) || 0, recarga: num(r.recarga) || 0 })),
    manuais: (d.manuais || []).filter(m => m.desc || num(m.kg)).map(m => ({ desc: m.desc || '', kg: num(m.kg) || 0, analise: analise(m.analise) })),
    materiais: mats,
    real: analise(d.real, [...ELEMENTOS, ...ELEMENTOS_LAB_EXTRA]),   // resultado do laboratório: os 20 elementos do certificado
  };
}

function paginaCorrida(id) {
  const orig = id === 'nova' ? null : S.corridas.find(c => c.id === id);
  if (id !== 'nova' && !orig) { C.innerHTML = `<div class="faixa verm">Corrida não encontrada.</div><a class="btn" href="${url('corridas')}">${icone('voltar')} Voltar</a>`; aoMudarDados(() => { if (S.corridas.find(c => c.id === id)) paginaCorrida(id); }); return; }
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
      <a class="btn" href="${url('corridas')}">${icone('voltar')}</a>
      <div class="cresce"><h1 class="titulo" id="tituloCorrida"></h1><p class="sub" id="subCorrida"></p></div>
      ${orig ? `<button class="btn perigo so-ed" id="btExcluir">${icone('lixo')} Excluir</button>` : ''}
      <button class="btn" id="btBoletim">${icone('impressora')} Imprimir boletim</button>
      <button class="btn pri so-ed" id="btSalvar">${icone('salvar')} Salvar corrida</button>
    </div>
    ${!ed.importada ? '' : orig.controle && !temAnalise(orig.estimadoPlanilha)
      ? `<div class="faixa lar nao-imprimir">Corrida importada da planilha Controle de Corrida (aba ${esc(orig.controle.aba)}, linha ${esc(orig.controle.linha)}). Essa planilha não tem a composição estimada${orig.controle.total ? `; total na planilha ${fmtKg(orig.controle.total)} kg${orig.controle.recarga ? ` (com ${fmtKg(orig.controle.recarga)} kg de recarga)` : ''}` : ''}.</div>`
      : `<div class="faixa lar nao-imprimir">Corrida importada da planilha. A composição das entradas manuais não ficou salva na planilha, por isso o estimado mostrado é o que a planilha calculou na época.${orig.controle ? ` Completada com a planilha Controle de Corrida (aba ${esc(orig.controle.aba)}, linha ${esc(orig.controle.linha)}).` : ''}</div>`}
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
        <div class="cartao"><h2>Retornos<span class="cresce"></span><button class="btn peq so-ed" id="btAddRet">${icone('mais')} Retorno</button></h2><div class="corpo" id="boxRetornos"></div></div>
        <div class="cartao"><h2>Sucatas (kg)</h2><div class="corpo"><div class="grade-kg" id="boxSucatas"></div></div></div>
      </div>
      <div class="cartao"><h2>Correção — elementos de liga (kg)</h2><div class="corpo"><div class="grade-kg" id="boxLigas"></div></div></div>
      <div class="cartao"><h2>Entrada manual<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">material fora do cadastro (forma perdida, retorno sem análise…)</span><button class="btn peq so-ed" id="btAddMan">${icone('mais')} Entrada</button></h2><div class="corpo" id="boxManuais"></div></div>
      <div class="cartao"><h2>Retorno e certificado<span class="cresce"></span><span id="retGeradoInfo"></span></h2><div class="corpo" id="boxLab"></div></div>
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
    } else mexeu = false;
    if (mexeu) { marcarSujo(); atualizarContas(); }
  }
  ficha.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.delRet != null) { d.retornos.splice(+b.dataset.delRet, 1); if (!d.retornos.length) d.retornos.push(linhaRetVazia()); montarRetornos(); marcarSujo(); atualizarContas(); }
    if (b.dataset.delMan != null) { d.manuais.splice(+b.dataset.delMan, 1); montarManuais(); marcarSujo(); atualizarContas(); }
    if (b.id === 'btGerarRet') gerarRetorno();
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
        <button class="botao-ic so-ed" data-del-ret="${i}" title="Tirar este retorno">${icone('lixo')}</button>
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
        <td><button class="botao-ic so-ed" data-del-man="${i}" title="Tirar">${icone('lixo')}</button></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  function montarLab() {
    // A análise do laboratório não é lançada na corrida: chega depois, pelo PDF, no retorno que a corrida gerou.
    const box = C.querySelector('#boxLab');
    box.innerHTML = `
      <p class="mut" style="margin:0 0 10px">A análise do laboratório vai no retorno desta corrida: <a href="${url('retornos')}">Retornos</a> → abra o retorno → <b>Ler PDF do laboratório</b>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn peq so-ed" id="btGerarRet">${icone('reciclar')} ${d.retornoGerado ? 'Atualizar retorno ' + esc(d.retornoGerado) : 'Gerar retorno desta corrida'}</button>
        ${ed.id && podeEditar('certificados') ? `<a class="btn peq" href="${endereco('certificados/lista', { novo: ed.id })}" title="Cria o certificado de qualidade já com a análise desta corrida">${icone('certificado')} Novo certificado</a>` : ''}
        <span id="certsDaCorrida"></span>
      </div>`;
    if (ed.id) mostrarCertificados();
  }
  // Certificados já emitidos para esta corrida (lidos uma vez, só para mostrar o atalho)
  async function mostrarCertificados() {
    try {
      const certs = (await banco.lerColecao('eng_certificados')).filter(c => c.corridaId === ed.id);
      const el = C.querySelector('#certsDaCorrida');
      if (el && certs.length) el.innerHTML = certs.map(c => `<a class="pilula lar" href="${endereco('certificados/certificado', { id: c.id })}" title="${esc(c.cliente || '')}">${icone('certificado')} ${esc(c.certNo ? 'Cert. ' + String(c.certNo).split('\n')[0] : 'Certificado')}${c.cliente ? ' · ' + esc(String(c.cliente).slice(0, 25)) : ''}</a>`).join(' ');
    } catch (e) { console.warn('certificados', e); }
  }

  // Partes calculadas (refeitas a cada digitação e quando o banco muda)
  function atualizarContas() {
    if (!C.querySelector('#tabComp')) return;
    const n = normalizar(d);
    const calc = calcAtual();
    const liga = ligaDe(d.liga);
    const faixas = (liga && liga.faixas) || {};
    const gerado = d.retornoGerado ? S.retPorCod.get(d.retornoGerado) : null;
    const real = gerado && temAnalise(gerado.analise) ? gerado.analise : (temAnalise(n.real) ? n.real : null);   // análise do laboratório = a do retorno gerado
    const est = ed.importada && orig.estimadoPlanilha ? orig.estimadoPlanilha : calc.estimado;
    const celula = (v, e) => { const s = situacaoElemento(v, faixas[e]); return `<td class="cen num ${s ? 'st-' + s : ''}">${v ? fmtComp(v) : (s ? '0,00' : '')}</td>`; };
    C.querySelector('#tabComp').innerHTML = `<table class="tab tab-comp"><thead><tr><th></th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="mut">Mínimo</td>${ELEMENTOS.map(e => `<td class="cen num mut">${faixas[e] ? fmtComp(faixas[e][0]) : ''}</td>`).join('')}</tr>
      <tr><td class="mut">Máximo</td>${ELEMENTOS.map(e => `<td class="cen num mut">${faixas[e] ? fmtComp(faixas[e][1]) : ''}</td>`).join('')}</tr>
      <tr><td><b>Estimado</b>${ed.importada ? '<br><small class="mut">da planilha</small>' : ''}</td>${ELEMENTOS.map(e => celula(est[e], e)).join('')}</tr>
      ${real ? `<tr><td><b>Real (lab)</b>${real === (gerado && gerado.analise) ? '<br><small class="mut">do retorno</small>' : ''}</td>${ELEMENTOS.map(e => celula(real[e], e)).join('')}</tr>` : ''}
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
    C.querySelector('#retGeradoInfo').innerHTML = gerado ? `<a class="pilula lar" href="${url('retornos')}" title="Retorno gerado por esta corrida">retorno ${esc(gerado.codigo)}</a>` : '';
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
    if (ed.importada) {
      dados.estimadoPlanilha = orig.estimadoPlanilha || {}; dados.anualInferido = orig.anualInferido; dados.ligaPlanilha = orig.ligaPlanilha; dados.opsTexto = orig.opsTexto;
      if (orig.controle) dados.controle = orig.controle;   // o que veio da planilha Controle de Corrida
    }
    if (!ed.importada) { dados.retornoGerado = d.retornoGerado = retornoAutomatico(n, liga, novoId, ed.retornoOpc); ed.retornoOpc = null; }
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
    if (eraNova) { editor = null; history.replaceState(null, '', url('ficha_corrida', { id: novoId })); setTimeout(() => paginaCorrida(novoId), 50); }
    else atualizarTitulo();
  }

  async function excluirCorrida() {
    if (!confirm(`Excluir a corrida ${numeroCorrida(orig)}? Os retornos que ela usava voltam para o saldo.`)) return;
    banco.apagar(COL.corridas, orig.id).catch(e => aviso('Erro ao excluir: ' + e.message, 'erro'));
    const codRg = d.retornoGerado || orig.retornoGerado, rg = codRg && S.retPorCod.get(codRg);
    if (rg && retornoDescartavel(rg, orig.id)) banco.apagar(COL.retornos, banco.idSeguro(rg.codigo));
    editor = null;
    aviso('Corrida excluída.');
    ir(url('corridas'));   // espera a exclusão ser gravada antes de sair da página
  }

  function gerarRetorno() {
    if (!ed.id) return aviso('Salve a corrida antes de gerar o retorno.', 'erro');
    const n = normalizar(d);
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
          const outro = S.retPorCod.get(codigo);
          if (outro && outro.corridaId && outro.corridaId !== ed.id) { aviso(`O retorno ${codigo} já é de outra corrida.`, 'erro'); return false; }
          const anterior = d.retornoGerado && d.retornoGerado !== codigo ? S.retPorCod.get(d.retornoGerado) : null;
          if (anterior && retornoDescartavel(anterior, ed.id)) banco.apagar(COL.retornos, banco.idSeguro(anterior.codigo));
          d.retornoGerado = codigo;
          ed.retornoOpc = { kg: num(el.querySelector('#gKg').value), manterCodigo: true };
          salvarCorrida();
          montarLab();
          aviso('Retorno ' + codigo + (existente ? ' atualizado.' : ' criado.'));
        },
      }],
    });
  }

  aoMudarDados(() => {
    // dados mudaram no banco: refaz só as listas e contas, sem perder o que está sendo digitado
    if (!C.querySelector('#ficha')) return;
    const foco = document.activeElement && ficha.contains(document.activeElement);
    if (!foco) montarRetornos(); else atualizarContas();
  });
}

// ---------- boletim de corrida (folha impressa, com a mesma cara da folha da planilha) ----------
// Sequência: Retorno, Sucata, Ligas, e na frente de cada linha o código MP do NW daquele material.
// Sucatas e ligas têm linhas fixas (sempre no mesmo lugar), com "-" quando não usadas.
// As ligas seguem a ordem da planilha (1 a 12); o Fe Mn B/C, que na planilha ficava na área
// da sucata por falta de espaço, vem como 13.
const BOL_LIGAS = [
  { id: 'fesi', nome: 'Fe Si', sim: 'Si' },
  { id: 'fecr_ac', nome: 'Cr A/C', sim: 'Cr A/C' },
  { id: 'femn_ac', nome: 'Fe Mn A/C', sim: 'Mn A/C' },
  { id: 'femo', nome: 'Fe Mo', sim: 'Mo' },
  { id: 'fenb', nome: 'Fe Nb', sim: 'Nb' },
  { id: 'fecr_bc', nome: 'Cr B/C', sim: 'Cr B/C' },
  { id: 'fev', nome: 'Fe V', sim: 'V' },
  { id: 'cu', nome: 'Cobre', sim: 'Cu' },
  { id: 'grafite', nome: 'Grafite', sim: 'Grafite' },
  { id: 'ni', nome: 'Níquel', sim: 'Ni' },
  { id: 'feti', nome: 'Titânio', sim: 'Ti' },
  { id: 'few', nome: 'Tungstênio', sim: 'W' },
  { id: 'femn_bc', nome: 'Fe Mn B/C', sim: 'Mn B/C' },
];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataBoletim = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]}-${MESES[+m[2] - 1]}-${m[1].slice(2)}` : ''; };
const fmtQtd = v => (!+v ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
// Rastreio: sempre com "FS-" na frente (vazio fica "FS-" para escrever à mão)
const rastreioFS = fs => { const s = String(fs || '').trim(); return !s ? 'FS-' : /^FS/i.test(s) ? s : 'FS-' + s.replace(/^-+/, ''); };

function htmlBoletim(n, calc, liga, est, carga) {
  const faixas = (liga && liga.faixas) || {};
  const nomeLiga = liga ? liga.nome : (n.liga || '');
  const mpDe = id => ((S.materiais.find(m => m.id === id) || {}).mp || '');
  const completar = (lista, minimo) => { while (lista.length < minimo) lista.push({ elem: '', sol: '', rec: '' }); return lista; };

  // --- Retorno <liga>: retornos (Solicitado + Recarga) e entradas manuais; não têm código NW ---
  const ret = completar([
    ...n.retornos.map(r => ({ elem: esc(r.codigo), sol: fmtQtd(r.kg), rec: fmtQtd(r.recarga) })),
    ...n.manuais.map(m => ({ elem: esc(m.desc), sol: fmtQtd(m.kg), rec: '' })),
  ], 3);

  // --- Sucata: uma linha fixa para cada sucata do cadastro, com o código NW na frente ---
  const suc = completar(sucatas().filter(m => m.ativo !== false || n.materiais[m.id]).map(m => {
    const kg = n.materiais[m.id];
    return { elem: kg ? esc(m.nome) : '-', sol: fmtQtd(kg), rec: '', a: esc(m.nome.replace(/^SAE\s*/i, '')), b: esc(m.mp || '') };
  }), 3);

  // --- Ligas: linhas fixas na ordem da planilha (+ alguma ferroliga nova do cadastro, se usada) ---
  const fixas = new Set(BOL_LIGAS.map(x => x.id));
  const lig = BOL_LIGAS.map((x, i) => {
    const kg = n.materiais[x.id];
    return { num: i + 1, elem: kg ? x.nome : '-', sol: fmtQtd(kg), rec: '', a: x.sim, b: esc(mpDe(x.id)) };
  });
  ferroligas().filter(m => !fixas.has(m.id) && n.materiais[m.id]).forEach(m => lig.push({
    num: lig.length + 1, elem: esc(m.nome), sol: fmtQtd(n.materiais[m.id]), rec: '', a: esc(m.nome), b: esc(m.mp || ''),
  }));

  const grupo = (rotulo, linhas) => linhas.map((r, i) => `<tr class="${i === 0 ? 'bol-ini' : ''}">
      ${i === 0 ? `<th class="bol-grupo" rowspan="${linhas.length}">${rotulo}</th>` : ''}
      ${r.num != null ? `<td class="bol-n">${r.num}</td><td>${r.elem}</td>` : `<td colspan="2" class="cen">${r.elem}</td>`}
      <td class="cen">${r.sol}</td><td class="cen">${r.rec}</td>
      <td class="bol-leg">${r.a || ''}</td><td class="bol-leg bol-mp bol-ult">${r.b || ''}</td>
    </tr>`).join('');

  const celComp = v => `<td>${v}</td>`;
  const cabComp = cls => `<tr class="${cls}">${ELEMENTOS.map(e => `<th>${e}</th>`).join('')}</tr>`;
  const gerado = n.retornoGerado ? S.retPorCod.get(n.retornoGerado) : null;
  const real = gerado && temAnalise(gerado.analise) ? gerado.analise : (temAnalise(n.real) ? n.real : null);

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
      <tr><td colspan="2" class="cen"><b>${esc(numeroCorrida(n))}</b></td><th class="claro">Rastreio:</th><td class="cen">${esc(rastreioFS(n.fs))}</td></tr>
    </table>
    <table class="bol-tab bol-dados bol-sep">
      <colgroup><col style="width:17%"><col style="width:27%"><col style="width:17%"><col style="width:16%"><col style="width:10%"><col style="width:13%"></colgroup>
      <tr><th>Liga:</th><td class="cen">${esc(nomeLiga)}</td><th>Carga_Forno:</th><td class="cen">${fmtKg(carga) || '0'} Kg.</td>
        <th>Temp.</th><td class="cen">${n.temperatura ? esc(n.temperatura) : ''}</td></tr>
    </table>

    <div class="bol-faixa bol-sep">Carga Metálica:</div>
    <table class="bol-tab bol-carga">
      <colgroup><col style="width:10%"><col style="width:5%"><col style="width:22%"><col style="width:15%"><col style="width:15%"><col style="width:13%"><col style="width:20%"></colgroup>
      <tr class="bol-cab"><th></th><th colspan="2">Elemento.</th><th class="grande">Solicitado.</th><th class="grande">Recarga</th>
        <th class="bol-leg"></th><th class="bol-leg bol-codcab bol-ult">Cód MP NW</th></tr>
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
//  RETORNO AUTOMÁTICO: toda corrida do sistema gera o seu retorno ("ref-anual-LIGA")
//  ao ser salva. Peso (kg verificado) fica 0 até pesar; a análise vem do laboratório.
// =====================================================================
const retornoUsado = (codigo, menosCorrida) => S.corridas.some(c => c.id !== menosCorrida && (c.retornos || []).some(r => r.codigo === codigo));
// pode apagar/renomear: criado sozinho, ainda sem peso e sem uso em corrida
const retornoDescartavel = (r, corridaId) => r && r.auto && !(+r.kgVerificado) && !(+r.baixaPlanilha) && !retornoUsado(r.codigo, corridaId);
function retornoAutomatico(n, liga, corridaId, opc) {
  opc = opc || {};
  const nomeLiga = liga ? liga.nome : n.liga;
  const padrao = codigoRetornoDaCorrida(n, nomeLiga);
  let codigo = n.retornoGerado || padrao;
  // liga ou número mudou depois de gerar: troca o código, se o retorno ainda não foi pesado nem usado
  if (codigo !== padrao && !opc.manterCodigo) {
    const velho = S.retPorCod.get(codigo);
    if (!velho || retornoDescartavel(velho, corridaId)) {
      if (velho) banco.apagar(COL.retornos, banco.idSeguro(codigo));
      codigo = padrao;
    }
  }
  const atual = S.retPorCod.get(codigo) || null;
  if (atual && atual.corridaId && atual.corridaId !== corridaId && !n.retornoGerado) return '';   // código já é de outra corrida
  const a = atual || {};
  banco.salvar(COL.retornos, banco.idSeguro(codigo), {
    ...semMeta(a), codigo, liga: nomeLiga,
    // a análise do retorno (lida do PDF) vale mais que a antiga da corrida (corridas importadas)
    analise: temAnalise(a.analise) ? a.analise : (temAnalise(n.real) ? n.real : {}),
    relatorio: a.relatorio || (n.lab && n.lab.relatorio) || '',
    kgVerificado: opc.kg != null ? opc.kg : (+a.kgVerificado || 0), baixaPlanilha: +a.baixaPlanilha || 0,
    origem: a.origem || 'sistema', auto: atual ? !!a.auto : !opc.manterCodigo,
    corridaId, corridaRef: { refratario: n.refratario, anual: n.anual },
  }).catch(e => aviso('Erro ao gravar o retorno: ' + e.message, 'erro'));
  return codigo;
}
