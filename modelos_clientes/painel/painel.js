// =====================================================================
//  modelos_clientes/painel/painel.js — Painel dos Modelos de clientes
// =====================================================================
import { esc, fmtData, icone } from '../../comum/casca.js?v=2.0.1';
import { S, url, iniciarTela, mostrar, bt, parados, consertosAbertos, eventosOrdenados, linhaDoTempo, nomeCli, rotuloCli } from '../base_mcli.js?v=2.0.1';

iniciarTela({ menu: 'mcli-painel', desenhar: paginaPainel });

// ---------------------------------------------------------------------
// PAINEL
// ---------------------------------------------------------------------
function paginaPainel() {
  mostrar('mcli-painel', ['Painel'], () => {
    const ms = [...S.modelos.values()];
    const cnt = k => ms.filter(m => m.status === k).length;
    const par = parados().sort((a, b) => (a.ultimaMov || '').localeCompare(b.ultimaMov || ''));
    const aguard = [...S.devolucoes.values()].filter(d => d.status === 'emitida').sort((a, b) => (a.numero || '').localeCompare(b.numero || ''));
    const abertos = consertosAbertos().sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const ultimos = eventosOrdenados([...S.eventos.values()]).slice(0, 12);
    const tile = (l, n, cls, v) => `<button class="kpi ${cls}" data-acao="tile" data-v="${v}"><b>${n}</b><span>${l}</span></button>`;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Painel</h1><p class="sub">Onde está cada modelo de cliente, o que está em conserto e o que falta devolver.</p></div>
        ${bt(icone('mais') + ' Registrar chegada', 'novo-modelo', 'pri')}${bt(icone('caminhao') + ' Nova devolução', 'nova-devolucao')}</div>
      ${!ms.length ? `<div class="faixa lar"><b>Nenhum modelo cadastrado ainda.</b> Registre a chegada de um modelo com a NF de entrada, ou traga a lista em <a href="${url('importar_exportar')}">Importar / Exportar</a>.</div>` : ''}
      <div class="kpis">
        ${tile('Na empresa', cnt('na_empresa'), 'verde', 'na_empresa')}
        ${tile('Em conserto', cnt('em_conserto'), 'amar', 'em_conserto')}
        ${tile('Aguardando retirada', cnt('separado'), '', 'separado')}
        ${tile('Devolvidos', cnt('devolvido'), 'roxo', 'devolvido')}
        ${tile('Parados há +1 ano', par.length, 'verm', 'parados')}
      </div>
      <div class="grade2">
        <div class="cartao"><h2>Consertos em aberto <span class="pilula">${abertos.length}</span></h2>
          ${abertos.length ? `<ul class="mc-lista">${abertos.slice(0, 8).map(e => { const m = S.modelos.get(e.modeloId) || {};
            return `<li data-acao="ir" data-href="${url('ficha_modelo', { id: e.modeloId })}"><div class="t"><div><b>${esc(m.codigo || '')}</b> · ${esc(m.descricao || 'Modelo removido')}</div><div class="mut peq">${esc(e.descricao || '')}</div></div><span class="mut peq">desde ${fmtData(e.data)}</span></li>`; }).join('')}</ul>`
            : '<p class="vazio">Nenhum conserto em aberto.</p>'}</div>
        <div class="cartao"><h2>Aguardando retirada <span class="pilula">${aguard.length}</span></h2>
          ${aguard.length ? `<ul class="mc-lista">${aguard.slice(0, 8).map(d => `<li data-acao="ir" data-href="${url('devolucao', { id: d.id })}"><div class="t"><div><b>${esc(d.numero)}</b> · ${esc(nomeCli(d.clienteId))}</div><div class="mut peq">${(d.itens || []).length} item(ns)${d.nf ? ' · NF ' + esc(d.nf) : ''}</div></div><span class="mut peq">entrega ${fmtData(d.dataEntrega)}</span></li>`).join('')}</ul>`
            : '<p class="vazio">Nenhum documento aguardando retirada.</p>'}</div>
      </div>
      <div class="cartao"><h2>Últimas movimentações</h2><div class="corpo">${ultimos.length ? linhaDoTempo(ultimos, true) : '<p class="vazio">Ainda não há movimentações.</p>'}</div></div>
      ${par.length ? `<div class="cartao"><h2>Parados há mais de 1 ano <span class="pilula">${par.length}</span></h2><ul class="mc-lista">${par.slice(0, 8).map(m => `<li data-acao="ir" data-href="${url('ficha_modelo', { id: m.id })}"><div class="t"><div><b>${esc(m.codigo)}</b> · ${esc(m.descricao)}</div><div class="mut peq">${esc(rotuloCli(m.clienteId))}${m.localizacao ? ' · ' + esc(m.localizacao) : ''}</div></div><span class="mut peq">última mov. ${fmtData(m.ultimaMov || m.dataEntrada)}</span></li>`).join('')}</ul></div>` : ''}`;
  });
}
