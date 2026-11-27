// =====================================================================
//  modelos_clientes/devolucao/devolucao.js — uma devolução e o documento A4
//  (impresso pelo navegador: Ctrl+P ou "Imprimir / PDF"). ?id=<id da devolução>
// =====================================================================
import { definirTrilha, esc, fmtData, icone, parametro } from '../../comum/casca.js?v=2.0.2';
import { htmlFolha, fmtDataHora } from '../folha_devolucao.js?v=2.0.2';
import { S, url, iniciarTela, mostrar, bt, cli, tagSit, DEV_STATUS, E } from '../base_mcli.js?v=2.0.2';

iniciarTela({ menu: 'mcli-devolucoes', desenhar: () => paginaDevolucao(parametro('id')) });

function paginaDevolucao(id) {
  mostrar('mcli-devolucoes', ['Devoluções'], () => {
    const d = S.devolucoes.get(id);
    if (!d) return `<div class="faixa verm">Este documento não existe mais.</div><a class="btn" href="${url('devolucoes')}">${icone('voltar')} Devoluções</a>`;
    definirTrilha(['Modelos de clientes', 'Devoluções', d.numero]);
    const r = d.retirada || {}, c = cli(d.clienteId) || {};
    return `<div class="dev-info">
      <div class="cab"><div class="cresce"><div class="mc-cod">${esc(d.numero)}</div><h1 class="titulo">${esc(c.nome || 'Cliente')}</h1>
        <p class="sub">${(d.itens || []).length} item(ns)${d.nf ? ' · NF ' + esc(d.nf) : ''} · emitido em ${fmtDataHora(d.dataEmissao)}${d.emissor ? ' por ' + esc(d.emissor) : ''} · ${tagSit(d.status, DEV_STATUS)}</p></div>
        <a class="btn" href="${url('devolucoes')}">${icone('voltar')} Devoluções</a></div>
      <div class="mc-acoes">
        <button class="btn pri" data-acao="dev-imprimir">${icone('impressora')} Imprimir / PDF</button>
        ${d.status === 'emitida' ? bt('Registrar retirada', 'dev-retirada', '', `data-id="${esc(id)}"`) : ''}
        ${d.status !== 'cancelada' ? bt('Editar dados', 'dev-editar', '', `data-id="${esc(id)}"`) : ''}
        <span class="cresce"></span>
        ${d.status === 'emitida' ? bt('Cancelar devolução', 'dev-cancelar', 'perigo', `data-id="${esc(id)}"`) : ''}
        ${d.status === 'cancelada' ? bt(icone('lixo') + ' Excluir', 'dev-excluir', 'perigo', `data-id="${esc(id)}"`) : ''}</div>
      ${d.status === 'emitida' ? '<div class="faixa">Imprima (Ctrl+P) para o cliente assinar na retirada. Os campos em branco da declaração saem para preencher à mão; se preferir, registre a retirada antes de imprimir e eles saem preenchidos.</div>' : ''}
      ${d.status === 'entregue' && r.nome ? `<div class="faixa">Retirado por <b>${esc(r.nome)}</b>${r.cpf ? ' · CPF ' + esc(r.cpf) : ''}${r.veiculo ? ' · ' + esc(r.veiculo) : ''}${r.placa ? ' · placa ' + esc(r.placa) : ''} em ${fmtData(r.data)}.</div>` : ''}
      <div class="cartao"><h2>Itens</h2><ul class="mc-lista">${(d.itens || []).map((it, i) => `<li data-acao="ir" data-href="${url('ficha_modelo', { id: it.modeloId })}"><span class="pilula">${i + 1}</span><div class="t"><b>${esc(it.codigo)}</b> · ${esc(it.descricao)}</div><span class="mut peq">${esc(it.partes)} parte(s)</span></li>`).join('')}</ul></div>
      <h2 class="mc-sec">Documento</h2></div>
      <div class="folha-wrap">${htmlFolha(d, E(), c)}</div>`;
  });
}
