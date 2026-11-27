// =====================================================================
//  modelos_clientes/clientes/clientes.js — clientes (dados do "ID Cliente" do documento)
// =====================================================================
import { esc, icone } from '../../comum/casca.js?v=2.0.1';
import { norm, digitos } from '../planilha.js?v=2.0.1';
import { S, filtros, iniciarTela, mostrar, bt } from '../base_mcli.js?v=2.0.1';

iniciarTela({ menu: 'mcli-clientes', desenhar: paginaClientes });

// ---------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------
function paginaClientes() {
  mostrar('mcli-clientes', ['Clientes'], () => {
    const f = filtros.cli;
    let l = [...S.clientes.values()];
    if (f.q) { const q = norm(f.q); l = l.filter(c => norm([c.nome, c.codigo, c.cnpj, c.cidade].join(' ')).includes(q) || (digitos(f.q).length > 3 && digitos(c.cnpj).includes(digitos(f.q)))); }
    l.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    const ms = [...S.modelos.values()];
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Clientes</h1><p class="sub">Dados que saem no campo “ID Cliente” do documento de devolução.</p></div>
        ${bt(icone('mais') + ' Novo cliente', 'novo-cliente', 'pri')}</div>
      <div class="cartao livre"><div class="corpo mc-filtros"><label class="busca">${icone('busca')}<input class="ent" type="search" placeholder="Buscar nome, código, CNPJ, cidade…" value="${esc(f.q)}" data-filtro="cli.q" data-manter="cq"></label></div></div>
      ${!l.length ? `<div class="cartao"><p class="vazio">${S.clientes.size ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado. Cadastre aqui ou importe a lista em Importar / Exportar.'}</p></div>` : `
      <div class="cartao"><div class="tab-wrap"><table class="tab"><thead><tr><th>Código</th><th>Nome</th><th>Cidade</th><th>CNPJ</th><th class="cen">Na empresa</th><th class="cen">Total de modelos</th></tr></thead><tbody>
        ${l.map(c => { const mc = ms.filter(m => m.clienteId === c.id); return `<tr class="clic" data-acao="abrir-cliente" data-id="${esc(c.id)}"><td class="num">${esc(c.codigo || '')}</td><td><b>${esc(c.nome)}</b></td><td>${esc([c.cidade, c.uf].filter(Boolean).join('/'))}</td><td class="num">${esc(c.cnpj || '')}</td><td class="cen">${mc.filter(m => m.status !== 'devolvido').length}</td><td class="cen">${mc.length}</td></tr>`; }).join('')}
      </tbody></table></div></div><p class="mut peq">${l.length} cliente(s)</p>`}`;
  });
}
