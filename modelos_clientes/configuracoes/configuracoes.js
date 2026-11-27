// =====================================================================
//  modelos_clientes/configuracoes/configuracoes.js — dados da empresa e texto
//  da declaração do documento de devolução (eng_config/modelosClientes)
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { aviso, esc, icone } from '../../comum/casca.js?v=2.0.1';
import { DECL_PADRAO, CHAVES_EMPRESA } from '../folha_devolucao.js?v=2.0.1';
import { C, ED, COL, CFG_ID, E, iniciarTela, mostrar, agoraISO } from '../base_mcli.js?v=2.0.1';

iniciarTela({ menu: 'mcli-config', desenhar: paginaConfig });

// ---------------------------------------------------------------------
// CONFIGURAÇÕES (eng_config/modelosClientes)
// ---------------------------------------------------------------------
function paginaConfig() {
  mostrar('mcli-config', ['Configurações'], () => {
    const Em = E();
    const fld = (k, l, cls = '') => `<label class="campo ${cls}">${l}<input class="ent" data-cfg="${k}" value="${esc(Em[k])}"></label>`;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Configurações</h1><p class="sub">Dados da empresa que saem no cabeçalho e na declaração do documento de devolução.</p></div></div>
      <div class="cartao"><div class="corpo"><div class="mc-form">
        ${fld('nome', 'Razão social', 'l2')}${fld('emissorPadrao', 'Emissor padrão')}
        ${fld('endereco', 'Endereço', 'l2')}${fld('numero', 'Número')}
        ${fld('bairro', 'Bairro')}${fld('cidade', 'Cidade/UF')}${fld('cep', 'CEP')}
        ${fld('telefone', 'Telefone')}${fld('fax', 'Fax/800')}<span></span>
        ${fld('cnpj', 'CNPJ')}${fld('ie', 'Inscrição estadual')}<span></span>
        ${fld('prefixoModelo', 'Prefixo do código de modelo')}${fld('prefixoDev', 'Prefixo do nº de devolução')}<span></span>
        <label class="campo l3">Texto da declaração de retirada<textarea class="ent" data-cfg="declaracao" rows="4">${esc(Em.declaracao)}</textarea>
          <span class="mut peq" style="text-transform:none;letter-spacing:0;font-weight:400">Campos automáticos: {nome} {cpf} {rg} {data} {veiculo} {placa} {empresa} {endereco}. Em branco, saem como linha para preencher à mão.</span></label>
      </div>
      <div class="mc-acoes" style="margin-top:14px"><span class="cresce"></span>
        ${ED ? `<button class="btn so-ed" id="cfgPadrao">Restaurar texto padrão</button><button class="btn pri so-ed" id="cfgSalvar">${icone('salvar')} Salvar configurações</button>` : ''}</div>
      </div></div>`;
  }, true);
  const b = C.querySelector('#cfgSalvar');
  if (b) b.onclick = () => {
    const corpo = {};
    for (const k of CHAVES_EMPRESA) { const el = C.querySelector(`[data-cfg="${k}"]`); corpo[k] = el ? el.value.trim() : ''; }
    banco.salvar(COL.config, CFG_ID, { ...corpo, atualizadoEm: agoraISO() }).catch(e => aviso('Erro ao salvar: ' + (e.code || e.message), 'erro'));
    aviso('Configurações salvas.');
  };
  const p = C.querySelector('#cfgPadrao');
  if (p) p.onclick = () => { C.querySelector('[data-cfg="declaracao"]').value = DECL_PADRAO; };
}
