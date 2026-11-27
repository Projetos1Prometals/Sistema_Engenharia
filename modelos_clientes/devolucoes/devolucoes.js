// =====================================================================
//  modelos_clientes/devolucoes/devolucoes.js — lista das devoluções
// =====================================================================
import { esc, fmtData, icone } from '../../comum/casca.js?v=2.0.0';
import { norm } from '../planilha.js?v=2.0.0';
import { fmtDataHora } from '../folha_devolucao.js?v=2.0.0';
import { S, filtros, url, iniciarTela, mostrar, bt, nomeCli, tagSit, DEV_STATUS } from '../base_mcli.js?v=2.0.0';

iniciarTela({ menu: 'mcli-devolucoes', desenhar: paginaDevolucoes });

// ---------------------------------------------------------------------
// DEVOLUÇÕES
// ---------------------------------------------------------------------
function paginaDevolucoes() {
  mostrar('mcli-devolucoes', ['Devoluções'], () => {
    const f = filtros.dev;
    const chips = [['', 'Todas'], ['emitida', 'Aguardando retirada'], ['entregue', 'Entregues'], ['cancelada', 'Canceladas']];
    let l = [...S.devolucoes.values()];
    if (f.status) l = l.filter(d => d.status === f.status);
    if (f.q) { const q = norm(f.q); l = l.filter(d => norm([d.numero, d.nf, d.oc, nomeCli(d.clienteId), ...(d.itens || []).map(i => i.descricao + ' ' + i.codigo)].join(' ')).includes(q)); }
    l.sort((a, b) => (b.dataEmissao || '').localeCompare(a.dataEmissao || ''));
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Devoluções</h1><p class="sub">Documentos de devolução de modelo ao cliente, com registro fotográfico e declaração de retirada.</p></div>
        ${bt(icone('mais') + ' Nova devolução', 'nova-devolucao', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar nº, cliente, NF, OC…" value="${esc(f.q)}" data-filtro="dev.q" data-manter="dq"></label>
        <div class="fichas">${chips.map(([v, t]) => `<button class="ficha ${f.status === v ? 'sel' : ''}" data-acao="fd-status" data-v="${v}">${t}</button>`).join('')}</div>
      </div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.devolucoes.size ? 'Nenhum documento com esses filtros.' : 'Nenhuma devolução emitida ainda. Abra um modelo e clique em “Devolver ao cliente”, ou use “Nova devolução”.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Nº</th><th>Cliente</th><th>Itens</th><th>NF</th><th>OC</th><th>Emissão</th><th>Entrega</th><th>Situação</th></tr></thead><tbody>
        ${l.map(d => `<tr class="clic" data-acao="ir" data-href="${url('devolucao', { id: d.id })}"><td class="num"><b>${esc(d.numero)}</b></td><td>${esc(nomeCli(d.clienteId))}</td>
          <td>${(d.itens || []).map(i => esc(i.codigo || i.descricao)).join(', ')}</td><td>${esc(d.nf || '')}</td><td>${esc(d.oc || '')}</td>
          <td class="mut">${fmtDataHora(d.dataEmissao)}</td><td>${fmtData(d.dataEntrega)}</td><td>${tagSit(d.status, DEV_STATUS)}</td></tr>`).join('')}
      </tbody></table></div></div><p class="mut peq">${l.length} documento(s)</p>`}`;
  });
}
