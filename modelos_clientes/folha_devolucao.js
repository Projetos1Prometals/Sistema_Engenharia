// =====================================================================
//  modelos_clientes/folha_devolucao.js — documento de devolução de modelo (A4)
//  Mesmo layout do app antigo (T.M Gastão / PROMETALS). Impresso pelo
//  navegador (Ctrl+P), como o boletim da corrida. Não mudar sem pedido.
// =====================================================================
import { raiz } from '../comum/banco.js?v=2.0.0';
import { esc, fmtData } from '../comum/casca.js?v=2.0.0';

export const DECL_PADRAO = 'Eu, {nome}, portador do CPF nº {cpf} e RG nº {rg}, declaro que, na data de {data}, retirei com o veículo {veiculo} placa {placa}, da empresa {empresa}, localizada na {endereco}, os modelos descritos acima, nas condições apresentadas no registro fotográfico deste documento.';
export const EMPRESA_PADRAO = {
  nome: 'T.M GASTÃO MAQUINAS E EQUIPAMENTOS', endereco: 'Avenida Jaime Rodrigues Azenha', numero: '1100',
  bairro: 'JARDIM INDUSTRIAL DANTE', cidade: 'NOVA ODESSA/SP', cep: '13388102', telefone: '+ (19) 32542906',
  fax: '+ (19) 99100-6477', cnpj: '33.483.863/0001-16', ie: '482149293116', emissorPadrao: 'Leonardo',
  declaracao: DECL_PADRAO, prefixoModelo: 'MOD-', prefixoDev: 'DEV-',
};
export const CHAVES_EMPRESA = Object.keys(EMPRESA_PADRAO);

// Dados da empresa: o que está em eng_config/modelosClientes, e o padrão no que estiver vazio
export function empresa(cfg) {
  const o = { ...EMPRESA_PADRAO };
  for (const k of CHAVES_EMPRESA) if (cfg && cfg[k]) o[k] = cfg[k];
  return o;
}
export const enderecoEmpresa = E => E.endereco + (E.numero ? ', ' + E.numero : '');

const p2 = n => String(n).padStart(2, '0');
export function fmtDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

// Campos da retirada em branco saem como linha, para preencher à mão
export function declaracaoTexto(d, E) {
  const r = d.retirada || {};
  const b = (v, n) => (v && String(v).trim() ? String(v).trim() : '_'.repeat(n));
  const mapa = {
    nome: b(r.nome, 34), cpf: b(r.cpf, 24), rg: b(r.rg, 20), data: r.data ? fmtData(r.data) : '_____/_____/_______',
    veiculo: b(r.veiculo, 16), placa: b(r.placa, 12), empresa: E.nome, endereco: enderecoEmpresa(E).toUpperCase(),
  };
  return String(E.declaracao || DECL_PADRAO).replace(/\{(\w+)\}/g, (m, k) => (k in mapa ? mapa[k] : m));
}

// d = devolução, E = empresa(), C = cliente. As fotos saem como <img data-foto> (carregadas depois).
export function htmlFolha(d, E, C = {}) {
  const itens = d.itens || [];
  const n = Math.max(6, itens.length);
  let trs = '';
  for (let i = 0; i < n; i++) {
    const it = itens[i];
    trs += `<tr><td>${i + 1}</td><td>${esc(it ? it.descricao : '')}</td><td>${esc(it ? it.referencia : '')}</td><td class="c">${esc(it ? it.partes : '')}</td></tr>`;
  }
  const fotos = d.fotos || [];
  const figs = fotos.map(f => `<figure><img data-foto="${esc(f.id)}" alt="">${itens.length > 1 && f.item ? `<figcaption>Item ${f.item}</figcaption>` : ''}</figure>`).join('');
  const cidadeC = [C.cidade, C.uf].filter(Boolean).join('/');
  return `<div class="paper">
   <div class="p-top"><div class="p-title">${esc(E.nome)}</div><div class="p-meta">Emissor: ${esc(d.emissor)}<br>Data: ${fmtDataHora(d.dataEmissao)}<br><b>Nº ${esc(d.numero)}</b></div></div>
   <table class="p-box">
     <tr><td class="p-lbl" rowspan="4">Controle de Modelos</td><td class="thin">Endereço: ${esc(enderecoEmpresa(E))}</td><td class="p-logo" rowspan="4"><img src="${raiz('modelos_clientes/logo_doc.jpg')}" alt="PROMETALS"></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>Bairro: ${esc(E.bairro)}</span><span>Cidade: ${esc(E.cidade)}</span></div></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>CEP: ${esc(E.cep)}</span><span>Telefone: ${esc(E.telefone)}</span><span>Fax/800: ${esc(E.fax)}</span></div></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>CNPJ: ${esc(E.cnpj)}</span><span>Ins. Est.: ${esc(E.ie)}</span></div></td></tr>
   </table>
   <div class="p-sec">ID CLIENTE</div>
   <table class="p-box">
     <tr><td class="thin"><div class="p-flex"><span>Código: ${esc(C.codigo)} ${esc(C.nome)}</span><span>Entregue: ${fmtData(d.dataEntrega)}</span></div></td><td class="p-oc" rowspan="4"><div><b>OC</b><br>${esc(d.oc)}</div><div><b>NF</b><br>${esc(d.nf)}</div></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>Endereço: ${esc([C.endereco, C.bairro].filter(Boolean).join(' - '))}</span><span>Cidade: ${esc(cidadeC)}</span></div></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>CEP: ${esc(C.cep)}</span><span>Telefone: ${esc(C.telefone)}</span><span>Fax/800: ${esc(C.fax)}</span></div></td></tr>
     <tr><td class="thin"><div class="p-flex"><span>CNPJ ${esc(C.cnpj)}</span><span>Ins. Est.: ${esc(C.ie)}</span></div></td></tr>
   </table>
   <div class="p-sec line">DESCRIÇÃO MODELO</div>
   <table class="p-items"><thead><tr><th style="width:8%">Item</th><th>Descrição</th><th style="width:24%">Modelo</th><th class="c" style="width:16%">Total de Partes</th></tr></thead><tbody>${trs}</tbody></table>
   <div class="p-sec line">REGISTRO FOTOGRÁFICO DO MODELO</div>
   <div class="p-anexo"><span><b>Anexo 1:</b></span><span><b>Obs:</b> ${esc(d.obs)}</span></div>
   <div class="p-fotos n${Math.min(4, fotos.length)}">${figs || '<div class="p-nofoto">Sem registro fotográfico</div>'}</div>
   <div class="p-decl">${esc(declaracaoTexto(d, E))}</div>
   <div class="p-sign"><div>Assinatura do responsável pela retirada</div><div>Conferido por (expedição)</div></div>
  </div>`;
}
