// =====================================================================
//  modelos_clientes/ficha_modelo/ficha_modelo.js — ficha do modelo de cliente
//  (dados, fotos e histórico). ?id=<id do modelo>
// =====================================================================
import { definirTrilha, esc, fmtData, icone, parametro } from '../../comum/casca.js?v=2.0.0';
import { S, ED, url, iniciarTela, mostrar, bt, rotuloCli, tagSit, eventosDoModelo, fato, htmlFotosPorTipo, linhaDoTempo } from '../base_mcli.js?v=2.0.0';

iniciarTela({ menu: 'mcli-modelos', desenhar: () => paginaModelo(parametro('id')) });

function paginaModelo(id) {
  const desenhar = () => {
    const m = S.modelos.get(id);
    if (!m) return `<div class="faixa verm">Este modelo não existe (pode ter sido excluído).</div><a class="btn" href="${url('modelos')}">${icone('voltar')} Modelos</a>`;
    definirTrilha(['Modelos de clientes', 'Modelos', m.codigo || '']);
    const podeDevolver = m.status === 'na_empresa' || m.status === 'em_conserto';
    const dev = m.status === 'separado' && m.devolucaoId ? S.devolucoes.get(m.devolucaoId) : null;
    const evs = eventosDoModelo(id);
    return `
      <div class="cab"><div class="cresce"><div class="mc-cod">${esc(m.codigo)}${m.codProduto ? ` · produto <b>${esc(m.codProduto)}</b>` : ''}</div>
        <h1 class="titulo">${esc(m.descricao)}</h1><p class="sub">${esc(rotuloCli(m.clienteId))} · ${tagSit(m.status)}</p></div>
        <a class="btn" href="${url('modelos')}">${icone('voltar')} Modelos</a>
        ${m.codProduto ? `<a class="btn" href="${url('produto', { codigo: m.codProduto })}">${icone('olho')} Página do produto</a>` : ''}</div>
      ${ED || dev ? `<div class="mc-acoes">
        ${bt('+ Conserto', 'ev-novo', '', `data-tipo="conserto" data-id="${esc(id)}"`)}
        ${bt('+ Ocorrência', 'ev-novo', '', `data-tipo="ocorrencia" data-id="${esc(id)}"`)}
        ${bt('+ Nova chegada', 'ev-novo', '', `data-tipo="entrada" data-id="${esc(id)}"`)}
        ${bt('Local / situação', 'mover', '', `data-id="${esc(id)}"`)}
        ${podeDevolver ? bt(icone('caminhao') + ' Devolver ao cliente', 'devolver', 'pri', `data-id="${esc(id)}"`) : ''}
        ${dev ? `<a class="btn pri" href="${url('devolucao', { id: dev.id })}">Ver documento ${esc(dev.numero)}</a>` : ''}
        <span class="cresce"></span>
        ${bt('Editar', 'editar-modelo', '', `data-id="${esc(id)}"`)}
        ${bt(icone('lixo') + ' Excluir', 'excluir-modelo', 'perigo', `data-id="${esc(id)}"`)}</div>` : ''}
      <div class="cartao"><div class="corpo"><dl class="mc-fatos">
        ${fato('Código do produto', esc(m.codProduto))}${m.ip ? fato('Instrução de Processo', 'IP ' + esc(m.ip)) : ''}${fato('Modelo / referência', esc(m.referencia))}
        ${fato('Total de partes', esc(m.partes ?? ''))}${fato('Material do modelo', esc(m.material))}
        ${fato('Liga da peça', esc(m.liga))}${fato('Localização', esc(m.localizacao))}
        ${fato('NF de entrada', esc(m.nfEntrada))}${fato('Chegada', fmtData(m.dataEntrada))}
        ${fato('Última movimentação', fmtData(m.ultimaMov))}
        ${m.obs ? `<div style="grid-column:1/-1"><dt>Observações</dt><dd style="white-space:pre-wrap">${esc(m.obs)}</dd></div>` : ''}
      </dl></div></div>
      <div class="cartao"><h2>${icone('camera')} Fotos (${(m.fotos || []).length})</h2><div class="corpo">${htmlFotosPorTipo(m, ED)}</div></div>
      <div class="cartao"><h2>Histórico</h2><div class="corpo">${evs.length ? linhaDoTempo(evs, false) : '<p class="vazio">Sem registros ainda.</p>'}</div></div>`;
  };
  mostrar('mcli-modelos', ['Modelos'], desenhar);
}
