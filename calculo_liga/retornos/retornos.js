// =====================================================================
//  calculo_liga/retornos/retornos.js — tela Retornos
//  Análise do laboratório (PDF) e saldo de cada retorno.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.0';
import { aviso, janela, esc, num, fmtKg, fmtData, icone, podeEditar, endereco, filtroDaTela } from '../../comum/casca.js?v=2.0.0';
import { ELEMENTOS, ELEMENTOS_LAB_EXTRA, COL, mesmaLiga, codigoRetornoDaCorrida, temAnalise } from '../calculo.js?v=2.0.0';
import { lerLaudoOuAvisar } from '../laudo.js?v=2.0.0';
import { criarCertificadosAuto, codigoRetornoDoCert, COL_CERTS } from '../../certificados/auto.js?v=2.0.0';
import { S, C, ED, ligaDe, semMeta, ent, entNum, optLigas, fmtComp, url, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.0';

const f = filtroDaTela('retornos', { chip: 'saldo', liga: '', q: '' });
iniciarTela({ tela: 'retornos', trilha: ['Cálculo de Liga', 'Retornos'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Retornos</h1><p class="sub">Análise do laboratório e saldo de cada retorno. O saldo baixa sozinho quando uma corrida usa o retorno (inteiro ou só uma parte).</p></div>
      <button class="btn pri so-ed" id="btNovoRet">${icone('mais')} Novo retorno</button>
    </div>
    <div class="kpis" id="kpis"></div>
    <div class="cartao livre"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="fichas" id="chips"></div>
      <select class="ent" id="fLiga" style="width:auto;min-width:150px">${optLigas(f.liga, 'Todas as ligas')}</select>
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Buscar código, liga ou relatório…" value="${esc(f.q)}"></div>
    </div></div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#btNovoRet').onclick = () => editarRetorno(null);
  C.querySelector('#fLiga').onchange = e => { f.liga = e.target.value; atualizar(); };
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(); };
  C.querySelector('#chips').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#kpis').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { f.chip = b.dataset.chip; atualizar(); } };
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-cod]'); if (tr) editarRetorno(S.retPorCod.get(tr.dataset.cod)); };

  function atualizar() {
    const linhas = S.retornos.map(r => ({ r, s: S.saldos.get(r.codigo) || { verificado: 0, usado: 0, saldo: 0, baixaPlanilha: 0, usos: [] } }));
    const comSaldo = linhas.filter(x => x.s.saldo > 0.05);
    const semPeso = linhas.filter(x => !(+x.r.kgVerificado));
    const semAnalise = linhas.filter(x => !temAnalise(x.r.analise));
    const kpi = (chip, n, rot, cls) => `<button class="kpi ${cls} ${f.chip === chip ? 'sel' : ''}" data-chip="${chip}"><b>${n}</b><span>${rot}</span></button>`;
    C.querySelector('#kpis').innerHTML =
      kpi('saldo', comSaldo.length, 'Retornos com saldo', 'verde') +
      `<div class="kpi lar"><b>${fmtKg(comSaldo.reduce((s, x) => s + x.s.saldo, 0))}</b><span>Kg em saldo</span></div>` +
      kpi('sempeso', semPeso.length, 'Sem peso verificado', 'amar') +
      kpi('semanalise', semAnalise.length, 'Sem análise', 'verm');
    const chips = [['saldo', 'Com saldo'], ['todos', 'Todos'], ['sempeso', 'Sem peso'], ['semanalise', 'Sem análise'], ['zerados', 'Zerados']];
    C.querySelector('#chips').innerHTML = chips.map(([k, t]) => `<button class="ficha ${f.chip === k ? 'sel' : ''}" data-chip="${k}">${t}</button>`).join('');
    const q = f.q.trim().toLowerCase();
    let lista = linhas.filter(x => {
      if (f.chip === 'saldo' && !(x.s.saldo > 0.05)) return false;
      if (f.chip === 'sempeso' && +x.r.kgVerificado) return false;
      if (f.chip === 'semanalise' && temAnalise(x.r.analise)) return false;
      if (f.chip === 'zerados' && !(+x.r.kgVerificado && x.s.saldo <= 0.05)) return false;
      if (f.liga && !mesmaLiga(S.ligas, x.r.liga, f.liga)) return false;
      if (q && ![x.r.codigo, x.r.liga, x.r.relatorio].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    // mais novos primeiro (pelo nº anual que está no código, quando houver)
    const chave = r => { const m = String(r.codigo).match(/^\s*\d+\s*-\s*(\d+)/); return r.corridaRef && r.corridaRef.anual ? +r.corridaRef.anual : (m ? +m[1] : 0); };
    lista.sort((a, b) => String(b.r._em || '').slice(0, 10).localeCompare(String(a.r._em || '').slice(0, 10)) || chave(b.r) - chave(a.r));
    const els = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'V', 'Mo'];
    C.querySelector('#tabela').innerHTML = !lista.length ? `<div class="vazio">${S.retornos.length ? 'Nenhum retorno com esses filtros.' : 'Nenhum retorno cadastrado. Importe a planilha em Configurações ou clique em Novo retorno.'}</div>` : `
      <table class="tab"><thead><tr><th>Retorno</th><th>Liga</th><th class="dir">Verificado (kg)</th><th class="dir">Usado (kg)</th><th class="dir">Saldo (kg)</th>${els.map(e => `<th class="cen">${e}</th>`).join('')}<th>Relatório</th></tr></thead><tbody>
      ${lista.map(({ r, s }) => `<tr class="clic" data-cod="${esc(r.codigo)}">
        <td><b>${esc(r.codigo)}</b></td><td><span class="pilula lar">${esc(r.liga || '')}</span></td>
        <td class="dir num">${+r.kgVerificado ? fmtKg(r.kgVerificado) : '<span class="txt-amar">pesar</span>'}</td>
        <td class="dir num mut">${fmtKg(s.usado + s.baixaPlanilha) || '0'}</td>
        <td class="dir num"><b class="${s.saldo > 0.05 ? 'txt-verde' : s.saldo < -0.05 ? 'txt-verm' : 'mut'}">${fmtKg(s.saldo)}</b></td>
        ${els.map(e => `<td class="cen num">${r.analise && r.analise[e] != null ? fmtComp(r.analise[e]) : ''}</td>`).join('')}
        <td class="mut">${esc(r.relatorio || '')}</td></tr>`).join('')}
      </tbody></table>`;
  }
  aoMudarDados(atualizar);
  atualizar();
}

function editarRetorno(r) {
  const novo = !r;
  r = r || { codigo: '', liga: '', analise: {}, kgVerificado: '', relatorio: '', obs: '' };
  const s = S.saldos.get(r.codigo) || { usos: [], usado: 0, saldo: 0, baixaPlanilha: 0 };
  const usado = !novo && s.usos.length > 0;
  janela({
    titulo: novo ? 'Novo retorno' : 'Retorno ' + r.codigo,
    larga: true,
    html: `<div class="linha-campos">
        <label class="campo">Código${ent(`id="rCod" placeholder="ex.: 33-226-CRK" ${usado ? 'readonly title="Já usado em corridas: o código não pode mudar"' : ''}`, r.codigo)}</label>
        <label class="campo">Liga<select class="ent" id="rLiga">${optLigas(r.liga)}${r.liga && !ligaDe(r.liga) ? `<option selected>${esc(r.liga)}</option>` : ''}</select></label>
        <label class="campo">Nº relatório de ensaio${ent('id="rRel"', r.relatorio)}</label>
        <label class="campo">Kg verificado${entNum('id="rKg"', r.kgVerificado || '')}</label>
      </div>
      ${+r.baixaPlanilha ? `<p class="mut">Baixa que já vinha da planilha (coluna "Utilizado"): <b>${fmtKg(r.baixaPlanilha)} kg</b>.</p>` : ''}
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0 6px">
        <h4 style="margin:0">Análise do laboratório (%)</h4>
        <label class="btn peq pri so-ed" title="Lê o PDF do certificado de análise (Priner) e preenche a análise e o nº do relatório">${icone('subir')} Ler PDF do laboratório…<input type="file" id="arqLaudo" accept="application/pdf,.pdf" class="oculto"></label>
        <span class="mut" id="stLaudo" style="font-size:12.5px"></span>
        <span id="certsDoRet"></span>
      </div>
      <div class="tab-wrap"><table class="tab tab-comp"><thead><tr>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead>
        <tbody><tr>${ELEMENTOS.map(e => `<td>${entNum(`data-el="${e}"`, (r.analise || {})[e])}</td>`).join('')}</tr></tbody></table></div>
      <div class="tab-wrap" style="margin-top:6px"><table class="tab tab-comp" style="width:auto"><thead><tr><th><span class="mut" style="font-weight:500">Só no certificado</span></th>${ELEMENTOS_LAB_EXTRA.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead>
        <tbody><tr><td></td>${ELEMENTOS_LAB_EXTRA.map(e => `<td>${entNum(`data-el="${e}"`, (r.analise || {})[e])}</td>`).join('')}</tr></tbody></table></div>
      <label class="campo" style="margin-top:12px">Observações<textarea class="ent" id="rObs">${esc(r.obs || '')}</textarea></label>
      ${!novo ? `<h4 style="margin:16px 0 6px">Uso nas corridas</h4>${s.usos.length ? `<table class="tab"><thead><tr><th>Corrida</th><th>Data</th><th class="dir">Solicitado (kg)</th><th class="dir">Recarga (kg)</th></tr></thead><tbody>
        ${s.usos.map(u => `<tr><td><a href="${url('ficha_corrida', { id: u.corridaId })}">${esc(u.numero)}</a></td><td>${fmtData(u.data)}</td><td class="dir num">${fmtKg(u.kg)}</td><td class="dir num">${u.recarga ? fmtKg(u.recarga) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">Ainda não usado em corridas do sistema.</p>'}
        <p><b>Saldo: ${fmtKg(s.saldo)} kg</b></p>` : ''}`,
    soLeitura: !ED,
    botoes: [
      ...(!novo ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (usado) { aviso('Este retorno já foi usado em corridas; não dá para excluir.', 'erro'); return false; }
        if (!confirm('Excluir o retorno ' + r.codigo + '?')) return false;
        banco.apagar(COL.retornos, r.id);
        aviso('Retorno excluído.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const codigo = el.querySelector('#rCod').value.trim();
        if (!codigo) { aviso('Informe o código do retorno.', 'erro'); return false; }
        const id = banco.idSeguro(codigo);
        if ((novo || id !== r.id) && S.retornos.some(x => x.id === id)) { aviso('Já existe um retorno com esse código.', 'erro'); return false; }
        const analise = {};
        el.querySelectorAll('[data-el]').forEach(i => { const v = num(i.value); if (v != null) analise[i.dataset.el] = v; });
        const dados = { ...semMeta(r), codigo, liga: el.querySelector('#rLiga').value, relatorio: el.querySelector('#rRel').value.trim(),
          kgVerificado: num(el.querySelector('#rKg').value) || 0, analise, obs: el.querySelector('#rObs').value, origem: r.origem || 'sistema' };
        if (!novo && id !== r.id) banco.apagar(COL.retornos, r.id);
        banco.salvar(COL.retornos, id, dados);
        aviso('Retorno ' + codigo + ' salvo.');
        // retorno com análise ganha o seu certificado (certificados/auto.js)
        if (temAnalise(analise) && podeEditar('certificados')) banco.lerColecao(COL_CERTS)
          .then(certs => criarCertificadosAuto({ retornos: [{ ...dados, id }], certs, corridas: S.corridas, ligas: S.ligas }, banco))
          .then(novos => { if (novos.length) aviso('Retorno ' + codigo + ' salvo e certificado criado (Certificados → ' + novos[0].aba + ').'); })
          .catch(e => console.warn('certificado automático', e));
      } },
    ],
    aoAbrir: el => {
      // Certificados que seguem a análise deste retorno (o escolhido no certificado ou o da corrida ligada)
      if (!novo) banco.lerColecao(COL_CERTS).then(certs => {
        const ligados = certs.filter(c => codigoRetornoDoCert(c, { corridas: S.corridas, retornos: S.retornos }) === r.codigo);
        const box = el.querySelector('#certsDoRet');
        if (box && ligados.length) box.innerHTML = `<span class="mut" style="font-size:12.5px">A análise também vai para:</span> ` + ligados.map(c => `<a class="pilula lar" href="${endereco('certificados/certificado', { id: c.id })}">${icone('certificado')} ${esc(c.aba || c.corrida || 'certificado')}</a>`).join(' ');
      }).catch(e => console.warn('certificados', e));
      el.querySelector('#arqLaudo').onchange = async e => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        const st = el.querySelector('#stLaudo');
        st.textContent = 'Lendo o PDF…';
        const r2 = await lerLaudoOuAvisar(f, aviso);
        if (!r2) { st.textContent = ''; return; }
        // "CORRIDA 34 - 227" × código do retorno "34-227-…"
        const cod = el.querySelector('#rCod');
        const pref = r2.corrida ? `${r2.corrida.refratario}-${r2.corrida.anual}` : '';
        if (pref && cod.value.trim() && !cod.value.trim().startsWith(pref + '-') && cod.value.trim() !== pref
          && !confirm(`O PDF é da corrida ${pref}, mas este retorno é o ${cod.value.trim()}.\n\nUsar a análise deste PDF mesmo assim?`)) { st.textContent = ''; return; }
        if (pref && !cod.value.trim() && !cod.readOnly) {
          const l = ligaDe(el.querySelector('#rLiga').value);
          cod.value = l ? codigoRetornoDaCorrida(r2.corrida, l.nome) : pref + '-';
        }
        el.querySelectorAll('[data-el]').forEach(i => { const v = r2.analise[i.dataset.el]; if (v != null) i.value = String(v).replace('.', ','); });
        el.querySelector('#rRel').value = r2.relatorio || '';   // nunca fica o nº de outro laudo
        st.innerHTML = `<span class="txt-az">Lido: ${esc(f.name)}${r2.relatorio ? ' — relatório ' + esc(r2.relatorio) : ''}.</span>${r2.relatorio ? '' : ' <span class="txt-amar">Não achei o nº do relatório no PDF: digite no campo.</span>'} Confira e clique em <b>Salvar</b>.`;
      };
    },
  });
}
