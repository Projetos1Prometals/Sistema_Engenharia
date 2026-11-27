// =====================================================================
//  certificados/certificado/certificado.js — o certificado, editado direto
//  na folha (salva sozinho ~0,7 s depois de parar de digitar).
//  ?id=<id do certificado>   (&focar=certNo põe o cursor no campo)
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.2';
import { definirTrilha, aviso, janela, esc, fmtData, icone, endereco, parametro, ir } from '../../comum/casca.js?v=2.0.2';
import { acharLiga, numeroCorrida, temAnalise } from '../../calculo_liga/calculo.js?v=2.0.2';
import { lerLaudoOuAvisar } from '../../calculo_liga/laudo.js?v=2.0.2';
import { QALL, clone, abaFrom, setPath, fmtNum, parseNum, setQuimica, certHTML } from '../folha_certificado.js?v=2.0.2';
import {
  S, C, ED, COL, LOGO, assinatura, url, iniciarTela, aoMudarDados, norm, fmtQ, uid, nextOrdem, corridaDe, nomeCorrida, descCorrida,
  codigoRetornoDoCert, retornoDoCert, sincronizarQuimica, marcarManual, quimicaDe, conferir,
  pendentes, agendarSalvar, salvarPendente, gravar, estadoSalvo, abrir, ESCALA_MIN, ALTURA_UTIL_PX, prepararImpressao, imprimir,
} from '../base_certificados.js?v=2.0.2';

const ID = parametro('id');
iniciarTela({
  trilha: ['Qualidade', 'Certificados'],
  desenhar() {
    const focar = parametro('focar');
    if (focar) history.replaceState(null, '', url('certificado', { id: ID }));
    paginaEditor(ID, focar);
  },
});

function paginaEditor(id, focar) {
  const orig = S.certs.find(c => c.id === id);
  if (!orig) { C.innerHTML = `<div class="faixa verm">Certificado não encontrado.</div><a class="btn" href="${url('lista')}">${icone('voltar')} Voltar</a>`; aoMudarDados(() => { if (S.certs.find(c => c.id === id)) paginaEditor(id); }); return; }
  let cur = clone(orig);
  definirTrilha(['Qualidade', 'Certificados', cur.aba || cur.corrida || 'Certificado']);
  C.innerHTML = `
    <div class="cab nao-imprimir">
      <a class="btn" href="${url('lista')}" title="Voltar para a busca">${icone('voltar')}</a>
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
        ${cor ? `<p style="margin-top:0"><a href="${endereco('calculo_liga/ficha_corrida', { id: cor.id })}"><b>${esc(numeroCorrida(cor))}</b></a> · ${esc(cor.liga || '')} · ${fmtData(cor.data)}${(cor.ops || []).length ? '<br>OP ' + esc(cor.ops.join(', ')) : ''}</p>
            ${ED ? `<button class="btn peq" id="btLigar">Trocar corrida</button>` : ''}`
          : `<p class="mut" style="margin-top:0">Este certificado não está ligado a uma corrida do sistema.</p>${ED ? `<button class="btn peq" id="btLigar">${icone('chama')} Ligar a uma corrida</button>` : ''}`}
      </div></div>
      <div class="cartao"><h2>Retorno vinculado</h2><div class="corpo">${(() => {
        const cod = codigoRetornoDoCert(cur), ret = retornoDoCert(cur);
        const man = QALL.filter(e => (cur.quimicaManual || {})[e]);
        if (!cod) return `<p class="mut" style="margin-top:0">${cur.retorno === '-' ? 'Sem vínculo: a análise química é só a da folha.' : 'Nenhum retorno vinculado.'}</p>${ED ? `<button class="btn peq" id="btTrocarRet">${icone('reciclar')} Vincular a um retorno</button>` : ''}`;
        return `<p style="margin-top:0"><a href="${endereco('calculo_liga/retornos')}"><b>${esc(cod)}</b></a>${ret && ret.liga ? ' · ' + esc(ret.liga) : ''}${cur.retorno ? '' : ' <span class="mut">(automático, pelo nº da corrida)</span>'}</p>
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
        <label class="opcao"><input type="checkbox" id="chkSig" ${cur.mostrarAssinatura !== false ? 'checked' : ''}> Mostrar assinatura</label>${assinatura() ? '' : '<div class="faixa lar" style="margin:4px 0 10px;font-size:12.5px">Nenhuma assinatura cadastrada: o certificado sai sem a imagem. Cadastre em <a href="' + url('assinatura_backup') + '">Assinatura e backup</a>.</div>'}
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
      ir(url('lista'));   // espera a exclusão ser gravada antes de sair da página
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

  aoMudarDados(() => {
    const novo = S.certs.find(c => c.id === id);
    if (!novo) { if (!pendentes.has(id)) { aviso('Este certificado foi excluído.'); ir(url('lista'), { trocar: true }); } return; }
    // mudou em outro computador: atualiza a folha, a não ser que esteja sendo editada aqui
    const editando = pendentes.has(id) || (document.activeElement && C.contains(document.activeElement) && document.activeElement.closest('#papel, #lado, #aba'));
    if (!editando && (novo.alteradoEm || 0) > (cur.alteradoEm || 0)) { cur = clone(novo); C.querySelector('#aba').value = cur.aba; pintarPapel(); }
    // o retorno vinculado recebeu (ou mudou) a análise: leva para a folha, a não ser que esteja digitando nela
    const naAnalise = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-f^="quimica."]');
    if (!naAnalise && sincronizarQuimica(cur)) { if (ED) mexeu(); pintarPapel(); }
    pintarLado();
  });
  if (sincronizarQuimica(cur) && ED) mexeu();   // análise do retorno vinculado (só grava quem edita)
  pintarPapel(focar);
  pintarLado();
}

// O certificado desta página, na versão que está na tela (a que ainda espera para ser gravada, se houver)
const certDaTela = () => (pendentes.get(ID) || {}).cert || S.certs.find(x => x.id === ID);
// Impressão pelo menu do navegador: sai só o certificado
window.addEventListener('beforeprint', () => {
  if (document.body.classList.contains('imprimindo-cert')) return;
  const c = certDaTela();
  if (c) prepararImpressao([c]);
});
// Ctrl+P imprime o certificado (e não a tela)
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    const c = certDaTela();
    if (c) { e.preventDefault(); salvarPendente(); imprimir([c]); }
  }
});
