// =====================================================================
//  modelos_clientes/importar_exportar/importar_exportar.js — Importar / Exportar
//  Clientes e modelos por planilha (Excel/CSV/colado), IPs de cliente da
//  Instrução de Processo e a saída em planilha (.xlsx) ou cópia (.json).
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { aviso, janela, esc, fmtData, icone, hoje, baixarArquivo } from '../../comum/casca.js?v=2.0.1';
import { fmtDataHora } from '../folha_devolucao.js?v=2.0.1';
import { enviarFotos } from '../fotos.js?v=2.0.1';
import { entrarInstrucao, ipsDeCliente, fotoDaIP, FOTOS_IP } from '../instrucao.js?v=2.0.1';
import {
  CAMPOS_IMPORTACAO, autoMapear, paraData, textoCelula, arrumarCep, arrumarCnpj, separarTitulos,
  lerArquivoPlanilha, lerTextoColado, montarXlsx, norm, digitos,
} from '../planilha.js?v=2.0.1';
import {
  S, C, ED, COL, STATUS, DEV_STATUS, EV, iniciarTela, mostrar, registrarAcoes, redesenhar,
  cli, prefixo, autorDe, novoId, agoraISO, proximoCodigo, semMeta, eventosOrdenados,
} from '../base_mcli.js?v=2.0.1';

const imp = { tipo: 'modelos', titulos: [], linhas: [], mapa: {}, nome: '', rodando: false, progresso: 0, resultado: null };
registrarAcoes({
  'imp-tipo': t => { imp.tipo = t.dataset.v; imp.mapa = autoMapear(imp.tipo, imp.titulos); imp.resultado = null; redesenhar(); },
  'imp-colado': () => { const aoa = lerTextoColado((C.querySelector('#impColado') || {}).value); if (!aoa.length) return aviso('Cole as linhas da planilha (com a linha de títulos).', 'erro'); carregarImportacao(aoa, 'dados colados'); },
  'imp-rodar': () => rodarImportacao(),
  'imp-limpar': () => { Object.assign(imp, { titulos: [], linhas: [], mapa: {}, nome: '', resultado: null, progresso: 0 }); redesenhar(); },
  'exp-xlsx': t => exportarXlsx(t),
  'exp-json': () => exportarJson(),
  'exp-modelo': t => exportarPlanilhaModelo(t),
  'ip-importar': () => janelaInstrucao(),
});
iniciarTela({ menu: 'mcli-planilha', desenhar: paginaPlanilha });

// ---------------------------------------------------------------------
// IMPORTAR / EXPORTAR
// ---------------------------------------------------------------------
function carregarImportacao(aoa, nome) {
  const r = separarTitulos(aoa);
  if (!r) { aviso('Não encontrei uma linha de títulos com pelo menos duas colunas.', 'erro'); return; }
  Object.assign(imp, { titulos: r.titulos, linhas: r.linhas, nome, mapa: autoMapear(imp.tipo, r.titulos), resultado: null, progresso: 0 });
  redesenhar();
}
function paginaPlanilha() {
  mostrar('mcli-planilha', ['Importar / Exportar'], () => {
    const campos = CAMPOS_IMPORTACAO[imp.tipo], tem = imp.linhas.length > 0;
    const opc = k => '<option value="">— não importar —</option>' + imp.titulos.map((h, i) => `<option value="${i}" ${imp.mapa[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const fs = campos.filter(f => imp.mapa[f.k] != null);
    const res = imp.resultado;
    return `
      <div class="cab"><div class="cresce"><h1 class="titulo">Importar / Exportar</h1><p class="sub">Traga clientes e modelos por planilha (Excel ou CSV) e leve os dados daqui para fora.</p></div></div>
      ${ED ? `<div class="cartao so-ed"><h2>1 · O que você vai importar</h2><div class="corpo">
        <div class="fichas"><button class="ficha ${imp.tipo === 'modelos' ? 'sel' : ''}" data-acao="imp-tipo" data-v="modelos">Modelos + NF de entrada</button><button class="ficha ${imp.tipo === 'clientes' ? 'sel' : ''}" data-acao="imp-tipo" data-v="clientes">Clientes</button></div>
        <p class="mut peq">${imp.tipo === 'modelos' ? 'Cada linha vira um modelo “Na empresa”, com a chegada registrada no histórico. Clientes que ainda não existem são criados pelo nome/código. Modelo com código que já existe é atualizado.' : 'Clientes já cadastrados são atualizados pelo código, CNPJ ou nome; os outros são criados.'}</p>
        <div class="mc-form" style="margin-top:12px">
          <label class="campo">Arquivo Excel ou CSV<input class="ent" type="file" id="impArq" accept=".xlsx,.xls,.xlsm,.csv,.ods,.txt"></label>
          <label class="campo l2">ou cole aqui as linhas copiadas do Excel (com a linha de títulos)<textarea class="ent" id="impColado" rows="3" placeholder="Código do cliente&#9;Cliente&#9;Descrição&#9;Total de partes&#9;NF de entrada …"></textarea></label></div>
        <div class="mc-acoes" style="margin-top:10px"><button class="btn" data-acao="imp-colado">Ler dados colados</button><button class="btn" data-acao="exp-modelo">${icone('baixar')} Baixar planilha modelo para importação</button></div>
      </div></div>
      ${tem ? `<div class="cartao so-ed"><h2>2 · Confira as colunas</h2><div class="corpo">
        <p class="mut peq" style="margin-top:0">${esc(imp.nome)} · ${imp.linhas.length} linha(s). As colunas foram associadas pelos títulos; ajuste o que estiver errado.</p>
        <div class="mc-form">${campos.map(f => `<label class="campo">${esc(f.label)}${f.req ? ' *' : ''}<select class="ent" data-imp-mapa="${f.k}">${opc(f.k)}</select></label>`).join('')}</div>
        ${fs.length ? `<div class="tab-wrap" style="margin-top:12px"><table class="tab"><thead><tr>${fs.map(f => `<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${imp.linhas.slice(0, 5).map(r => `<tr>${fs.map(f => `<td>${esc(f.k === 'dataEntrada' ? fmtData(paraData(r[imp.mapa[f.k]])) : textoCelula(r[imp.mapa[f.k]]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
      </div></div>
      <div class="cartao so-ed"><h2>3 · Importar</h2><div class="corpo">
        ${res ? `<p style="margin-top:0"><b>Pronto.</b> ${res.criados} criado(s), ${res.atualizados} atualizado(s)${res.clientesCriados ? `, ${res.clientesCriados} cliente(s) novo(s)` : ''}${res.ignorados ? `, ${res.ignorados} linha(s) sem ${imp.tipo === 'modelos' ? 'descrição' : 'nome'} ignorada(s)` : ''}.</p>` : ''}
        <div class="mc-acoes"><button class="btn pri" data-acao="imp-rodar" ${imp.rodando ? 'disabled' : ''}>${imp.rodando ? 'Importando…' : `Importar ${imp.linhas.length} linha(s)`}</button><button class="btn" data-acao="imp-limpar" ${imp.rodando ? 'disabled' : ''}>Limpar</button></div>
      </div></div>` : ''}` : ''}
      ${ED ? `<div class="cartao so-ed"><h2>Da Instrução de Processo</h2><div class="corpo">
        <p class="mut" style="margin-top:0">Traz as IPs com <b>Destino do molde = Retorno para o cliente</b>: cliente, código do produto, descrição, liga e as fotos
          (caixa frente, caixa traseira e macho). Pode rodar de novo: IP já trazida não é duplicada, só completa o que estiver em branco aqui. Nada é mudado na Instrução de Processo.</p>
        <div class="mc-acoes"><button class="btn" data-acao="ip-importar">${icone('baixar')} Importar da Instrução de Processo…</button></div>
      </div></div>` : ''}
      <div class="cartao"><h2>Exportar</h2><div class="corpo">
        <p class="mut" style="margin-top:0">Planilha com modelos, clientes, devoluções e histórico, ou uma cópia completa em JSON.</p>
        <div class="mc-acoes"><button class="btn" data-acao="exp-xlsx">${icone('baixar')} Planilha completa (.xlsx)</button><button class="btn" data-acao="exp-json">${icone('baixar')} Cópia de segurança (.json)</button></div>
      </div></div>`;
  }, true);
}
document.addEventListener('change', e => {
  if (!C || !C.contains(e.target)) return;
  const t = e.target;
  if (t.id === 'impArq' && t.files[0]) {
    const f = t.files[0];
    lerArquivoPlanilha(f).then(aoa => carregarImportacao(aoa, f.name)).catch(er => aviso('Não consegui ler o arquivo: ' + (er.message || er), 'erro'));
  } else if (t.dataset.impMapa) {
    imp.mapa[t.dataset.impMapa] = t.value === '' ? null : Number(t.value);
    imp.resultado = null;
    redesenhar();
  }
});
async function rodarImportacao() {
  if (!imp.linhas.length || imp.rodando) return;
  for (const f of CAMPOS_IMPORTACAO[imp.tipo].filter(x => x.req)) if (imp.mapa[f.k] == null) { aviso(`Escolha a coluna de “${f.label}”.`, 'erro'); return; }
  imp.rodando = true; imp.resultado = null; redesenhar();
  const res = { criados: 0, atualizados: 0, ignorados: 0, clientesCriados: 0 };
  const ops = [];
  const clientes = new Map([...S.clientes].map(([k, v]) => [k, { ...v }]));
  const porCod = new Map(), porNome = new Map(), porCnpj = new Map();
  const indexar = (id, c) => { if (c.codigo) porCod.set(norm(c.codigo), id); if (c.nome) porNome.set(norm(c.nome), id); if (digitos(c.cnpj)) porCnpj.set(digitos(c.cnpj), id); };
  clientes.forEach((c, id) => indexar(id, c));
  const modPorCod = new Map([...S.modelos.values()].filter(m => m.codigo).map(m => [norm(m.codigo), m.id]));
  const codigos = [...S.modelos.values()].map(m => m.codigo);
  const naoVazio = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));
  const agora = agoraISO();
  for (const row of imp.linhas) {
    const v = k => (imp.mapa[k] == null ? '' : textoCelula(row[imp.mapa[k]]));
    if (imp.tipo === 'clientes') {
      const corpo = { codigo: v('codigo'), nome: v('nome'), cnpj: arrumarCnpj(v('cnpj')), ie: v('ie'), endereco: v('endereco'), bairro: v('bairro'), cidade: v('cidade'),
        uf: v('uf').toUpperCase().slice(0, 2), cep: arrumarCep(v('cep')), telefone: v('telefone'), fax: v('fax'), email: v('email') };
      if (!corpo.nome) { res.ignorados++; continue; }
      const ex = (corpo.codigo && porCod.get(norm(corpo.codigo))) || (digitos(corpo.cnpj) && porCnpj.get(digitos(corpo.cnpj))) || porNome.get(norm(corpo.nome));
      if (ex) { const d = { ...semMeta(clientes.get(ex)), ...naoVazio(corpo), atualizadoEm: agora }; clientes.set(ex, d); ops.push({ col: COL.clientes, id: ex, dados: d }); res.atualizados++; }
      else { const id = novoId(); const d = { ...corpo, criadoEm: agora, origem: 'importacao' }; clientes.set(id, d); indexar(id, d); ops.push({ col: COL.clientes, id, dados: d }); res.criados++; }
    } else {
      const desc = v('descricao');
      if (!desc) { res.ignorados++; continue; }
      const cc = v('clienteCodigo'), cn = v('clienteNome');
      let cid = (cc && porCod.get(norm(cc))) || (cn && porNome.get(norm(cn))) || '';
      if (!cid && (cc || cn)) { cid = novoId(); const c = { codigo: cc, nome: cn || 'Cliente ' + cc, criadoEm: agora, origem: 'importacao' }; clientes.set(cid, c); indexar(cid, c); ops.push({ col: COL.clientes, id: cid, dados: c }); res.clientesCriados++; }
      const pn = parseInt(digitos(v('partes')), 10);
      const corpo = { descricao: desc, codProduto: v('codProduto'), referencia: v('referencia'), partes: isNaN(pn) ? null : pn, material: v('material'), liga: v('liga'), localizacao: v('localizacao'),
        nfEntrada: v('nfEntrada'), dataEntrada: imp.mapa.dataEntrada == null ? '' : paraData(row[imp.mapa.dataEntrada]), obs: v('obs') };
      if (cid) corpo.clienteId = cid;
      const cod = v('codigo'), ex = cod && modPorCod.get(norm(cod));
      if (ex) { ops.push({ col: COL.modelos, id: ex, dados: { ...semMeta(S.modelos.get(ex)), ...naoVazio(corpo), atualizadoEm: agora } }); res.atualizados++; }
      else {
        const id = novoId(), codigo = cod || proximoCodigo(prefixo('modelo'), codigos);
        codigos.push(codigo); modPorCod.set(norm(codigo), id);
        const data = corpo.dataEntrada || hoje();
        ops.push({ col: COL.modelos, id, dados: { ...corpo, clienteId: cid, codigo, status: 'na_empresa', fotos: [], ultimaMov: data, criadoEm: agora, origem: 'importacao' } });
        ops.push({ col: COL.eventos, id: novoId(), dados: { tipo: 'entrada', modeloId: id, clienteId: cid, data, nf: corpo.nfEntrada, partes: corpo.partes, descricao: 'Importado de planilha (' + imp.nome + ')', fotos: [], criadoEm: agora } });
        res.criados++;
      }
    }
  }
  try { await banco.emLote(ops); }
  catch (e) { console.error(e); aviso('Erro ao gravar a importação: ' + (e.code || e.message), 'erro'); }
  imp.rodando = false; imp.resultado = res; redesenhar();
  aviso(`Importação concluída: ${res.criados} criado(s), ${res.atualizados} atualizado(s).`);
}

// ---------- Da Instrução de Processo (instrucao.js) ----------
// IP já trazida = modelo com o mesmo nº de IP (campo ip) ou, sem ele, o mesmo código do produto
function modeloDaIP(ip) {
  const todos = [...S.modelos.values()];
  return todos.find(m => Number(m.ip) === ip.n)
    || (ip.codigo && todos.find(m => !m.ip && m.codProduto && norm(m.codProduto) === norm(ip.codigo))) || null;
}
function janelaInstrucao() {
  janela({
    titulo: 'Importar da Instrução de Processo',
    html: `<p class="mut" style="margin-top:0">Use o login da Instrução de Processo. Ele só serve para ler as IPs agora: não fica guardado.</p>
      <div class="mc-form">
        <label class="campo l2">E-mail<input class="ent" id="ipEmail" type="email" autocomplete="off"></label>
        <label class="campo l2">Senha<input class="ent" id="ipSenha" type="password" autocomplete="off"></label>
        <label class="l3"><input type="checkbox" id="ipFotos" checked> Trazer as fotos (caixa frente, caixa traseira e macho)</label>
      </div>`,
    botoes: [
      { texto: 'Cancelar' },
      { texto: 'Buscar IPs de cliente', cls: 'pri', acao: async el => {
        const email = el.querySelector('#ipEmail').value.trim(), senha = el.querySelector('#ipSenha').value, fotos = el.querySelector('#ipFotos').checked;
        if (!email || !senha) { aviso('Preencha o e-mail e a senha da Instrução de Processo.', 'erro'); return false; }
        el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
        try {
          aviso('Lendo a Instrução de Processo…');
          const supa = await entrarInstrucao(email, senha);
          const ips = await ipsDeCliente(supa);
          setTimeout(() => janelaIPsEncontradas(supa, ips, fotos), 30);
        } catch (e) {
          console.error(e);
          aviso('Não foi possível ler a Instrução de Processo: ' + (e.message || e), 'erro');
          el.querySelectorAll('footer button').forEach(b => { b.disabled = false; });
          return false;
        }
      } },
    ],
  });
}
function janelaIPsEncontradas(supa, ips, fotos) {
  if (!ips.length) { aviso('Nenhuma IP com destino "Retorno para o cliente" na Instrução de Processo.', 'erro'); return; }
  const linhas = ips.map(ip => ({ ip, m: modeloDaIP(ip) }));
  const novos = linhas.filter(l => !l.m).length;
  janela({
    titulo: `Instrução de Processo: ${ips.length} IP(s) de cliente`, larga: true,
    html: `<p class="mut" style="margin-top:0">${novos} nova(s) viram modelo “Na empresa” com a chegada no histórico; ${ips.length - novos} já trazida(s) só completam o que estiver em branco${fotos ? ' (e as fotos que faltarem)' : ''}. Cliente que ainda não existe é criado pelo nome.</p>
      <div class="tab-wrap"><table class="tab"><thead><tr><th>IP</th><th>Código do produto</th><th>Cliente</th><th>Descrição</th><th>Liga</th><th>Aqui</th></tr></thead><tbody>
        ${linhas.map(({ ip, m }) => `<tr><td>${ip.n}</td><td>${esc(ip.codigo)}</td><td>${esc(ip.cliente || '—')}</td><td>${esc(ip.descricao)}</td><td>${esc(ip.liga)}</td>
          <td>${m ? `já existe: <b>${esc(m.codigo)}</b>` : '<span class="ok">novo</span>'}</td></tr>`).join('')}
      </tbody></table></div>`,
    botoes: [
      { texto: 'Cancelar' },
      { texto: `Importar ${ips.length} IP(s)`, cls: 'pri', acao: el => {
        el.querySelectorAll('footer button').forEach(b => { b.disabled = true; });
        importarIPs(supa, ips, fotos);
      } },
    ],
  });
}
async function importarIPs(supa, ips, comFotos) {
  const res = { criados: 0, completados: 0, clientes: 0, fotos: 0, falhas: 0 };
  const agora = agoraISO();
  const porNome = new Map([...S.clientes.values()].filter(c => c.nome).map(c => [norm(c.nome), c.id]));
  const codigos = [...S.modelos.values()].map(m => m.codigo);
  const fotosFaltando = async (n, jaTem) => {
    const out = [];
    if (!comFotos) return out;
    for (const [slot, tipo] of Object.entries(FOTOS_IP)) {
      if (jaTem.has(tipo)) continue;
      try {
        const blob = await fotoDaIP(supa, n, slot);
        if (!blob) continue;
        const [id] = await enviarFotos([blob]);
        out.push({ id, tipo }); res.fotos++;
      } catch (e) { console.warn('foto da IP', n, slot, e); res.falhas++; }
    }
    return out;
  };
  for (let i = 0; i < ips.length; i++) {
    const ip = ips[i];
    aviso(`Importando IP ${ip.n} (${i + 1} de ${ips.length})…`);
    try {
      const ops = [];
      let cid = '';
      if (ip.cliente) {
        cid = porNome.get(norm(ip.cliente)) || '';
        if (!cid) {
          cid = novoId(); porNome.set(norm(ip.cliente), cid);
          const c = { nome: ip.cliente, criadoEm: agora, origem: 'instrucao' };
          S.clientes.set(cid, { ...c, id: cid });
          ops.push({ col: COL.clientes, id: cid, dados: c }); res.clientes++;
        }
      }
      const corpo = { clienteId: cid, codProduto: ip.codigo, descricao: ip.descricao || ip.codigo || 'IP ' + ip.n, liga: ip.liga, ip: ip.n };
      const m = modeloDaIP(ip);
      if (m) {
        const mud = Object.fromEntries(Object.entries(corpo).filter(([k, v]) => v !== '' && v != null && (m[k] === '' || m[k] == null)));
        const novas = await fotosFaltando(ip.n, new Set((m.fotos || []).map(f => f.tipo)));
        if (novas.length) mud.fotos = [...(m.fotos || []), ...novas];
        if (Object.keys(mud).length) {
          const d = { ...semMeta(S.modelos.get(m.id)), ...mud, atualizadoEm: agora };
          S.modelos.set(m.id, { ...d, id: m.id });
          ops.push({ col: COL.modelos, id: m.id, dados: d }); res.completados++;
        }
      } else {
        const id = novoId(), codigo = proximoCodigo(prefixo('modelo'), codigos);
        codigos.push(codigo);
        const data = paraData(ip.data) || hoje();
        const fotos = await fotosFaltando(ip.n, new Set());
        const d = { ...corpo, codigo, referencia: '', partes: null, material: '', localizacao: '', nfEntrada: '', dataEntrada: data, obs: '',
          status: 'na_empresa', fotos, ultimaMov: data, criadoEm: agora, origem: 'instrucao' };
        S.modelos.set(id, { ...d, id });
        ops.push({ col: COL.modelos, id, dados: d });
        ops.push({ col: COL.eventos, id: novoId(), dados: { tipo: 'entrada', modeloId: id, clienteId: cid, data, nf: '', partes: null,
          descricao: `Importado da Instrução de Processo (IP ${ip.n})`, fotos: [], criadoEm: agora } });
        res.criados++;
      }
      if (ops.length) await banco.emLote(ops);   // grava IP por IP: se parar no meio, o que foi feito fica
    } catch (e) { console.error('IP', ip.n, e); res.falhas++; }
  }
  supa.auth.signOut().catch(() => {});
  aviso(`Instrução de Processo: ${res.criados} modelo(s) novo(s), ${res.completados} completado(s)` +
    (res.clientes ? `, ${res.clientes} cliente(s) novo(s)` : '') + (comFotos ? `, ${res.fotos} foto(s)` : '') +
    (res.falhas ? `. ${res.falhas} falha(s): veja o console (F12).` : '.'), res.falhas ? 'erro' : undefined);
}

async function exportarXlsx(btn) {
  btn.disabled = true;
  try {
    const c = id => cli(id) || {};
    const modelos = [...S.modelos.values()].sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '')).map(m => ({
      'Código': m.codigo, 'Código do produto': m.codProduto || '', 'Descrição': m.descricao, 'Modelo/Referência': m.referencia || '', 'Total de partes': m.partes ?? '',
      'Cliente (código)': c(m.clienteId).codigo || '', 'Cliente': c(m.clienteId).nome || '', 'Situação': (STATUS[m.status] || {}).texto || m.status || '',
      'Localização': m.localizacao || '', 'Material': m.material || '', 'Liga': m.liga || '', 'NF de entrada': m.nfEntrada || '', 'Data de entrada': fmtData(m.dataEntrada),
      'Última movimentação': fmtData(m.ultimaMov), 'Fotos': (m.fotos || []).length, 'Observações': m.obs || '' }));
    const clientes = [...S.clientes.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(x => ({
      'Código': x.codigo || '', 'Nome': x.nome || '', 'CNPJ': x.cnpj || '', 'Inscrição estadual': x.ie || '', 'Endereço': x.endereco || '', 'Bairro': x.bairro || '',
      'Cidade': x.cidade || '', 'UF': x.uf || '', 'CEP': x.cep || '', 'Telefone': x.telefone || '', 'Fax/800': x.fax || '', 'E-mail': x.email || '' }));
    const devs = [...S.devolucoes.values()].sort((a, b) => (a.numero || '').localeCompare(b.numero || '')).map(d => ({
      'Nº': d.numero, 'Cliente': c(d.clienteId).nome || '', 'Modelos': (d.itens || []).map(i => i.codigo).join(', '), 'NF': d.nf || '', 'OC': d.oc || '',
      'Emissão': fmtDataHora(d.dataEmissao), 'Entrega': fmtData(d.dataEntrega), 'Situação': (DEV_STATUS[d.status] || {}).texto || d.status,
      'Retirado por': (d.retirada || {}).nome || '', 'Emissor': d.emissor || '' }));
    const evs = eventosOrdenados([...S.eventos.values()]).map(e => { const m = S.modelos.get(e.modeloId) || {}; return {
      'Data': fmtData(e.data), 'Tipo': (EV[e.tipo] || {}).texto || e.tipo, 'Modelo': m.codigo || '', 'Descrição do modelo': m.descricao || '',
      'Cliente': c(e.clienteId || m.clienteId).nome || '', 'NF': e.nf || '', 'Assunto': e.titulo || '', 'Detalhe': e.descricao || '',
      'Conserto realizado': e.solucao || '', 'Responsável': e.responsavel || '', 'Situação do conserto': e.tipo === 'conserto' ? (e.situacao === 'aberto' ? 'Em aberto' : 'Concluído') : '',
      'Registrado por': autorDe(e), 'Registrado em': fmtDataHora(e.criadoEm) }; });
    const blob = await montarXlsx({ 'Modelos': modelos, 'Clientes': clientes, 'Devoluções': devs, 'Histórico': evs });
    baixarArquivo(`Modelos de clientes ${hoje()}.xlsx`, blob, blob.type);
  } catch (e) { aviso('Não foi possível montar a planilha: ' + (e.message || e), 'erro'); }
  finally { btn.disabled = false; }
}
function exportarJson() {
  const dados = { sistema: 'modelos-clientes-prometals', versao: 1, exportadoEm: agoraISO(), config: S.config,
    clientes: [...S.clientes.values()], modelos: [...S.modelos.values()], devolucoes: [...S.devolucoes.values()], eventos: [...S.eventos.values()] };
  baixarArquivo(`Cópia Modelos de clientes ${hoje()}.json`, JSON.stringify(dados, null, 2));
}
async function exportarPlanilhaModelo(btn) {
  btn.disabled = true;
  try {
    const blob = await montarXlsx({
      'Modelos': [['Código do cliente', 'Cliente', 'Código do modelo', 'Código do produto', 'Descrição', 'Modelo', 'Total de partes', 'NF de entrada', 'Data de entrada', 'Localização', 'Material', 'Liga', 'Observações'],
        ['1000635', 'MARCENTRIC', '', '', 'CORPO FUNDIDO VR-100 INOX CF-8', 'VR-100', 3, '1588', '22/01/2026', '', '', 'INOX CF-8', '']],
      'Clientes': [['Código', 'Nome', 'CNPJ', 'Inscrição estadual', 'Endereço', 'Bairro', 'Cidade', 'UF', 'CEP', 'Telefone', 'Fax/800', 'E-mail'],
        ['1000635', 'MARCENTRIC', '03.042.907/0001-01', '535232598118', 'RUA SALVADOR GOBETH', '', 'PIRACICABA', 'SP', '13414115', '', '', '']],
    });
    baixarArquivo('Planilha modelo - importação Modelos de clientes.xlsx', blob, blob.type);
  } catch (e) { aviso('Não foi possível montar a planilha: ' + (e.message || e), 'erro'); }
  finally { btn.disabled = false; }
}
