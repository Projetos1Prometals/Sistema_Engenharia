// =====================================================================
//  certificados/lista/lista.js — tela Certificados (busca e lista)
//  Busca pela OP (em qual corrida ela está), corrida, material, cliente…
//  ?novo=<id da corrida> abre a janela "Novo certificado" já com a corrida.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.2';
import { aviso, janela, esc, icone, parametro, filtroDaTela, ir } from '../../comum/casca.js?v=2.0.2';
import { numeroCorrida } from '../../calculo_liga/calculo.js?v=2.0.2';
import { criarCertificadosDe, retornosSemCertificado } from '../auto.js?v=2.0.2';
import { FIXED, DEF, clone, hojeBR, abaFrom, setQuimica, SEC_AFTER_Q, shiftNum } from '../folha_certificado.js?v=2.0.2';
import {
  S, C, ED, url, iniciarTela, aoMudarDados, norm, opTokens, primeiraLinha, uid, nextOrdem, maisRecente, corridaDe, nomeCorrida, descCorrida,
  analiseDaCorrida, quimicaDe, gravar, abrir, imprimir,
} from '../base_certificados.js?v=2.0.2';

const busca = filtroDaTela('certificados', { q: '' });
busca.sel = new Set();
iniciarTela({
  trilha: ['Qualidade', 'Certificados'],
  desenhar() {
    paginaLista();
    const novo = parametro('novo');
    if (novo && ED) { history.replaceState(null, '', url('lista')); novoCertificado(novo); }
  },
});

// Botão "Retornos sem certificado": escolher quais retornos com análise ganham certificado (inclusive os da planilha)
function escolherRetornosSemCert() {
  const lista = retornosSemCertificado(S).sort((a, b) => String(b.codigo).localeCompare(String(a.codigo), 'pt', { numeric: true }));
  if (!lista.length) { aviso('Todos os retornos com análise já têm certificado.'); return; }
  janela({
    titulo: 'Retornos sem certificado', larga: true,
    html: `<p class="mut" style="margin-top:0">Retornos com análise do laboratório que nenhum certificado segue. Cada um marcado vira um certificado com corrida, material e análise (cliente e produtos em branco).</p>
      <div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn peq" id="mTodos">Marcar todos</button><button class="btn peq" id="mNenhum">Desmarcar todos</button><span class="cresce"></span><span class="mut" id="mN"></span></div>
      <div class="tab-wrap" style="max-height:50vh;overflow:auto"><table class="tab"><thead><tr><th></th><th>Retorno</th><th>Liga</th><th>Relatório</th><th></th></tr></thead><tbody>
        ${lista.map((r, i) => `<tr><td><input type="checkbox" data-i="${i}" ${r.origem === 'planilha' || r.certificadoAuto ? '' : 'checked'}></td><td><b>${esc(r.codigo)}</b></td><td>${esc(r.liga || '')}</td><td class="mut">${esc(r.relatorio || '')}</td>
          <td class="mut" style="font-size:12px">${r.origem === 'planilha' ? 'veio da planilha' : ''}${r.certificadoAuto ? 'já teve certificado (excluído)' : ''}</td></tr>`).join('')}
      </tbody></table></div>`,
    aoAbrir: el => {
      const caixas = () => [...el.querySelectorAll('[data-i]')];
      const conta = () => { el.querySelector('#mN').textContent = caixas().filter(c => c.checked).length + ' marcado(s)'; };
      el.querySelector('#mTodos').onclick = () => { caixas().forEach(c => { c.checked = true; }); conta(); };
      el.querySelector('#mNenhum').onclick = () => { caixas().forEach(c => { c.checked = false; }); conta(); };
      el.addEventListener('change', conta); conta();
    },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Criar certificados', cls: 'pri', acao: async el => {
      const escolhidos = [...el.querySelectorAll('[data-i]')].filter(c => c.checked).map(c => lista[+c.dataset.i]);
      if (!escolhidos.length) { aviso('Marque pelo menos um retorno.', 'erro'); return false; }
      try {
        const novos = await criarCertificadosDe(escolhidos, S, banco);
        aviso(novos.length === 1 ? 'Certificado criado: ' + novos[0].aba + '.' : novos.length + ' certificados criados.');
      } catch (e) { console.error(e); aviso('Não consegui criar (' + e.message + ').', 'erro'); return false; }
    } }],
  });
}

// =====================================================================
//  BUSCA (lista)
// =====================================================================
function paginaLista() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Certificados de Qualidade</h1><p class="sub">Busque pela OP para ver em qual corrida ela está, ou por corrida, material, cliente, pedido, nº do certificado.</p></div>
      ${ED ? `<button class="btn" id="btSemCert" title="Retornos com análise que ainda não têm certificado">${icone('reciclar')} Retornos sem certificado <b id="nSemCert"></b></button><button class="btn pri" id="btNovo">${icone('mais')} Novo certificado</button>` : ''}
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
  const bs = C.querySelector('#btSemCert'); if (bs) bs.onclick = escolherRetornosSemCert;
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
    const nsc = C.querySelector('#nSemCert'); if (nsc) { const n = retornosSemCertificado(S).length; nsc.textContent = n ? '(' + n + ')' : ''; }
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
    C.querySelector('#tabela').innerHTML = !linhas.length ? `<div class="vazio">${S.certs.length ? 'Nenhum certificado corresponde à busca.' : 'Nenhum certificado ainda.' + (ED ? ' Clique em <b>Novo certificado</b> — ou, na ficha da corrida, em <b>Novo certificado</b> — ou traga os antigos em <a href="' + url('assinatura_backup') + '">Assinatura e backup</a>.' : '')}</div>` : `
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
  aoMudarDados(atualizar);
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
      ir(url('certificado', { id: c.id, focar: 'certNo' }));   // espera a gravação antes de abrir
    } }],
  });
}
