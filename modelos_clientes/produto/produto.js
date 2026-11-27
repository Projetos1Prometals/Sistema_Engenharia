// =====================================================================
//  modelos_clientes/produto/produto.js — consulta pelo código do produto
//  ?codigo=<código do produto> (o mesmo do NW e da Instrução de Processo)
// =====================================================================
import { definirTrilha, esc, icone, parametro } from '../../comum/casca.js?v=2.0.0';
import { norm } from '../planilha.js?v=2.0.0';
import { TIPOS_FOTO } from '../fotos.js?v=2.0.0';
import { S, C, url, iniciarTela, mostrar, rotuloCli, tagSit, fato } from '../base_mcli.js?v=2.0.0';

iniciarTela({ menu: 'mcli-modelos', desenhar: () => paginaProduto(parametro('codigo')) });

// ---------------------------------------------------------------------
// CONSULTA POR CÓDIGO DO PRODUTO
// (a Instrução de Processo abre esta página)
// ---------------------------------------------------------------------
function paginaProduto(codigo) {
  mostrar('mcli-modelos', ['Consulta por código do produto'], () => {
    const ms = codigo ? [...S.modelos.values()].filter(m => m.codProduto && norm(m.codProduto) === norm(codigo)) : [];
    if (codigo) definirTrilha(['Modelos de clientes', 'Produto', codigo]);
    const fotosDe = (m, tipo) => (m.fotos || []).filter(f => (f.tipo || 'outra') === tipo);
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">${codigo ? 'Produto ' + esc(codigo) : 'Consulta por código do produto'}</h1>
        <p class="sub">Dados da peça e fotos do modelo do cliente, pelo código do produto (o mesmo do NW e da Instrução de Processo).</p></div></div>
      <div class="cartao livre"><div class="corpo"><form id="fProd" class="mc-filtros">
        <label class="busca">${icone('busca')}<input class="ent" id="pCod" placeholder="Código do produto" value="${esc(codigo)}"></label>
        <button class="btn pri" type="submit">Consultar</button></form></div></div>
      ${!codigo ? '' : !ms.length ? `<div class="faixa lar">Nenhum modelo de cliente com o código do produto <b>${esc(codigo)}</b>.</div>` : ms.map(m => `
        <div class="cartao mc-produto">
          <h2><span class="cresce">${esc(m.descricao)}</span>${tagSit(m.status)}</h2>
          <div class="corpo">
            <dl class="mc-fatos">
              ${fato('Código do produto', '<b>' + esc(m.codProduto) + '</b>')}${fato('Referência / desenho', esc(m.referencia))}
              ${fato('Cliente', esc(rotuloCli(m.clienteId)))}${fato('Liga', esc(m.liga))}
              ${fato('Total de partes', esc(m.partes ?? ''))}${fato('Material do modelo', esc(m.material))}
              ${fato('Localização', esc(m.localizacao))}${fato('Situação', tagSit(m.status))}
              ${fato('Código do modelo', `<a href="${url('ficha_modelo', { id: m.id })}">${esc(m.codigo)}</a>`)}
            </dl>
            <div class="mc-prod-fotos">${['frente', 'traseira', 'macho'].map(t => {
              const fs = fotosDe(m, t);
              if (t === 'macho' && !fs.length) return '';
              return `<figure><figcaption>${TIPOS_FOTO[t]}</figcaption>${fs.length ? fs.map(f => `<button class="ph" data-acao="foto" data-id="${esc(f.id)}"><img data-foto="${esc(f.id)}" alt="${TIPOS_FOTO[t]}"></button>`).join('') : '<div class="mc-sem-foto">Sem foto</div>'}</figure>`;
            }).join('')}</div>
          </div></div>`).join('')}`;
  }, false, () => {
    C.querySelector('#fProd').onsubmit = e => { e.preventDefault(); const v = C.querySelector('#pCod').value.trim(); location.href = url('produto', { codigo: v }); };
  });
  if (!codigo) C.querySelector('#pCod').focus();
}
