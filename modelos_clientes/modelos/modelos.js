// =====================================================================
//  modelos_clientes/modelos/modelos.js — lista dos Modelos de clientes
// =====================================================================
import { esc, fmtData, icone } from '../../comum/casca.js?v=2.0.2';
import { norm } from '../planilha.js?v=2.0.2';
import { S, filtros, url, iniciarTela, mostrar, bt, parados, cli, nomeCli, tagSit, opcoesClientes } from '../base_mcli.js?v=2.0.2';

iniciarTela({ menu: 'mcli-modelos', desenhar: paginaModelos });

// ---------------------------------------------------------------------
// MODELOS (lista)
// ---------------------------------------------------------------------
function filtrarModelos() {
  const f = filtros.modelos;
  let l = [...S.modelos.values()];
  if (f.status === 'ativos') l = l.filter(m => m.status !== 'devolvido');
  else if (f.status === 'parados') { const p = new Set(parados().map(m => m.id)); l = l.filter(m => p.has(m.id)); }
  else if (f.status !== 'todos') l = l.filter(m => m.status === f.status);
  if (f.cliente) l = l.filter(m => m.clienteId === f.cliente);
  if (f.q) {
    const q = norm(f.q);
    l = l.filter(m => { const c = cli(m.clienteId) || {}; return norm([m.codigo, m.codProduto, m.descricao, m.referencia, m.nfEntrada, m.localizacao, m.liga, c.nome, c.codigo].join(' ')).includes(q); });
  }
  return l.sort((a, b) => (b.ultimaMov || '').localeCompare(a.ultimaMov || '') || (a.codigo || '').localeCompare(b.codigo || ''));
}
function paginaModelos() {
  mostrar('mcli-modelos', ['Modelos'], () => {
    const f = filtros.modelos;
    const chips = [['ativos', 'Ativos'], ['na_empresa', 'Na empresa'], ['em_conserto', 'Em conserto'], ['separado', 'Aguard. retirada'], ['devolvido', 'Devolvidos'], ['parados', 'Parados +1 ano'], ['todos', 'Todos']];
    const l = filtrarModelos();
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Modelos</h1><p class="sub">Cada modelo com cliente, NF de entrada, localização, fotos e histórico.</p></div>
        <a class="btn" href="${url('produto')}">${icone('busca')} Consulta por código do produto</a>${bt(icone('mais') + ' Registrar chegada', 'novo-modelo', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar código, código do produto, descrição, cliente, NF, local…" value="${esc(f.q)}" data-filtro="modelos.q" data-manter="mq"></label>
        <select class="ent" data-filtro="modelos.cliente" style="max-width:260px"><option value="">Todos os clientes</option>${opcoesClientes(f.cliente)}</select>
        <div class="fichas">${chips.map(([v, t]) => `<button class="ficha ${f.status === v ? 'sel' : ''}" data-acao="f-status" data-v="${v}">${t}</button>`).join('')}</div>
      </div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.modelos.size ? 'Nenhum modelo encontrado com esses filtros.' : 'Nenhum modelo cadastrado ainda. Use “Registrar chegada” ou importe uma planilha.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Código</th><th>Cód. produto</th><th>Descrição</th><th>Cliente</th><th class="cen">Partes</th><th>Local</th><th>NF entrada</th><th class="cen">Fotos</th><th>Situação</th><th>Última mov.</th></tr></thead><tbody>
        ${l.map(m => `<tr class="clic" data-acao="ir" data-href="${url('ficha_modelo', { id: m.id })}">
          <td class="num"><b>${esc(m.codigo)}</b></td><td class="num">${esc(m.codProduto || '')}</td>
          <td>${esc(m.descricao)}${m.referencia ? `<div class="mut peq">${esc(m.referencia)}</div>` : ''}</td>
          <td>${esc(nomeCli(m.clienteId))}</td><td class="cen">${esc(m.partes ?? '')}</td><td>${esc(m.localizacao || '')}</td><td>${esc(m.nfEntrada || '')}</td>
          <td class="cen mut">${(m.fotos || []).length || ''}</td><td>${tagSit(m.status)}</td><td class="mut">${fmtData(m.ultimaMov)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <p class="mut peq">${l.length} de ${S.modelos.size} modelo(s)</p>`}`;
  });
}
