// =====================================================================
//  sistema/configuracoes/configuracoes.js — tela Configurações
//  Forno, numeração das corridas, importação das planilhas do Cálculo de
//  Liga e cópia de segurança. Usa a base do Cálculo de Liga.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { aviso, janela, esc, num, hoje, fmtData, icone, baixarArquivo } from '../../comum/casca.js?v=2.0.1';
import { COL, numeroCorrida } from '../../calculo_liga/calculo.js?v=2.0.1';
import { lerPlanilha, lerControle, aplicarControle } from '../../calculo_liga/importar_planilhas.js?v=2.0.1';
import { S, C, est, cfg, semMeta, entNum, iniciarTela, aoMudarDados } from '../../calculo_liga/base_liga.js?v=2.0.1';

iniciarTela({ tela: 'config', trilha: ['Sistema', 'Configurações'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab"><div class="cresce"><h1 class="titulo">Configurações</h1><p class="sub">Forno, numeração das corridas, importação da planilha e cópia de segurança.</p></div></div>
    <div class="grade2">
      <div class="cartao"><h2>Forno</h2><div class="corpo" id="boxForno"></div></div>
      <div class="cartao"><h2>Numeração das corridas</h2><div class="corpo" id="boxCont"></div></div>
    </div>
    <div class="cartao"><h2>Importar a planilha Calculo de Ligas</h2><div class="corpo">
      <p style="margin-top:0">Traz da planilha <b>.xlsm</b>: as normas das ligas, os retornos (com análise e saldo), o histórico de corridas (aba Banco de dados) e os contadores. Pode importar de novo quantas vezes precisar; o que veio da planilha é atualizado, o que foi criado no sistema não é apagado.</p>
      <p class="mut">Faça a importação final no dia em que pararem de usar a planilha, para os saldos baterem.</p>
      <label class="btn so-ed">${icone('subir')} Escolher planilha…<input type="file" id="arqPlan" accept=".xlsm,.xlsx,.xls" class="oculto"></label>
      <span class="mut" id="statusImp" style="margin-left:10px"></span>
    </div></div>
    <div class="cartao"><h2>Importar a planilha Controle de Corrida</h2><div class="corpo">
      <p style="margin-top:0">Traz das abas <b>Controle Corrida AAAA</b> (2023, 2024…) o histórico de corridas: nº anual, liga, retorno, OP, kg dos materiais, <b>recarga</b>, nº do relatório e datas do laboratório.
        As corridas que já vieram da Calculo de Ligas (mesma data, nº e liga) só são completadas; as outras entram como histórico.</p>
      <p class="mut">Importe a Calculo de Ligas primeiro. Pode importar de novo quantas vezes precisar.</p>
      <label class="btn so-ed">${icone('subir')} Escolher planilha…<input type="file" id="arqCtrl" accept=".xlsx,.xlsm,.xls" class="oculto"></label>
      <span class="mut" id="statusCtrl" style="margin-left:10px"></span>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa um arquivo com tudo do Cálculo de Liga (corridas, retornos, ligas, materiais e configurações). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
      <label class="btn so-ed">${icone('subir')} Restaurar cópia…<input type="file" id="arqBkp" accept=".json" class="oculto"></label>
    </div></div>
    <div class="cartao"><h2>Banco de dados</h2><div class="corpo" id="boxBanco"></div></div>`;

  C.querySelector('#arqPlan').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilha(f); };
  C.querySelector('#arqCtrl').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarControle(f); };
  C.querySelector('#btExp').onclick = exportarBackup;
  C.querySelector('#arqBkp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) restaurarBackup(f); };

  function atualizar() {
    const c = cfg();
    const forno = c.forno || {};
    const ct = c.contadores || {};
    C.querySelector('#boxForno').innerHTML = `<div class="linha-campos">
        <label class="campo">Carga mínima (alerta) kg${entNum('id="fMin"', forno.min)}</label>
        <label class="campo">Carga máxima kg${entNum('id="fMax"', forno.max)}</label></div>
      <button class="btn so-ed" style="margin-top:12px" id="btForno">${icone('salvar')} Salvar forno</button>`;
    C.querySelector('#boxCont').innerHTML = `<div class="linha-campos">
        <label class="campo">Última corrida anual${entNum('id="cAn"', ct.anual)}</label>
        <label class="campo">Última corrida do refratário${entNum('id="cRef"', ct.refratario)}</label></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn so-ed" id="btCont">${icone('salvar')} Salvar numeração</button>
        <button class="btn so-ed" id="btRefr" title="Zera o contador do refratário">${icone('chama')} Começar novo refratário</button></div>
      ${(c.campanhas || []).length ? `<p class="mut" style="margin-bottom:0">Refratários anteriores: ${c.campanhas.slice(-6).map(x => `${fmtData(x.fim)} (${x.corridas} corridas)`).join(' · ')}</p>` : ''}`;
    const s = banco.situacao();
    C.querySelector('#boxBanco').innerHTML = s.modo === 'local'
      ? `<div class="faixa lar" style="margin:0"><b>Modo local.</b> Os dados estão só neste navegador. Para todos usarem os mesmos dados, preencha o <code>config.js</code> com o bloco do Firebase (veja o LEIA-ME).</div>`
      : `Firebase: projeto <b>${esc(est.cfg.projectId)}</b> · usuário <b>${esc(s.usuario && s.usuario.email)}</b>`;
    C.querySelector('#btForno').onclick = () => {
      banco.salvar(COL.config, 'liga', { ...cfg(), forno: { min: num(C.querySelector('#fMin').value), max: num(C.querySelector('#fMax').value) } });
      aviso('Forno salvo.');
    };
    C.querySelector('#btCont').onclick = () => {
      banco.salvar(COL.config, 'liga', { ...cfg(), contadores: { anual: num(C.querySelector('#cAn').value) || 0, refratario: num(C.querySelector('#cRef').value) || 0 } });
      aviso('Numeração salva.');
    };
    C.querySelector('#btRefr').onclick = () => {
      const ct2 = cfg().contadores || {};
      if (!confirm(`Começar um novo refratário? A próxima corrida será a nº 1 do refratário (a anual continua em ${(+ct2.anual || 0) + 1}).`)) return;
      const campanhas = [...(cfg().campanhas || []), { fim: hoje(), corridas: +ct2.refratario || 0, ultimaAnual: +ct2.anual || 0 }];
      banco.salvar(COL.config, 'liga', { ...cfg(), contadores: { ...ct2, refratario: 0 }, campanhas });
      aviso('Novo refratário: próxima corrida é a nº 1.');
    };
  }
  aoMudarDados(atualizar);
  atualizar();
}

async function importarPlanilha(arquivo) {
  const st = C.querySelector('#statusImp');
  st.textContent = 'Lendo a planilha…';
  let dados;
  try { dados = await lerPlanilha(arquivo, S.ligas); }
  catch (e) { console.error(e); st.textContent = ''; return aviso('Não consegui ler a planilha: ' + e.message, 'erro'); }
  st.textContent = '';
  const r = dados.resumo;
  const jaSistema = dados.retornos.filter(x => { const a = S.retornos.find(y => y.id === x.id); return a && a.origem === 'sistema'; });
  janela({
    titulo: 'Importar ' + arquivo.name, larga: true,
    html: `<p style="margin-top:0">Escolha o que trazer:</p>
      <label class="opcao"><input type="checkbox" id="iLig" checked> <b>Normas das ligas</b>: ${r.ligas} ligas${r.ligasNovas ? `, ${r.ligasNovas} novas` : ''}.
        ${r.ligasMudaram.length ? `<br><span class="txt-amar">Faixas diferentes das do sistema: ${esc(r.ligasMudaram.join(', '))}. Se importar, valem as da planilha.</span>` : ''}</label>
      <label class="opcao"><input type="checkbox" id="iRet" checked> <b>Retornos</b>: ${r.retornos} (${r.retornosComSaldo} com saldo, ${r.retornosSemAnalise} sem análise).
        ${jaSistema.length ? `<br><span class="txt-amar">${jaSistema.length} já foram criados no sistema e não serão mexidos.</span>` : ''}</label>
      <label class="opcao"><input type="checkbox" id="iCor" checked> <b>Histórico de corridas</b>: ${r.corridas} corridas${r.periodo ? ` (${fmtData(r.periodo[0])} a ${fmtData(r.periodo[1])})` : ''}; ${r.corridasComRetornoGerado} ligadas ao retorno que geraram.
        <br><span class="mut">Entram como "histórico da planilha": não mexem no saldo dos retornos (a baixa já vem da coluna Utilizado).</span></label>
      <label class="opcao"><input type="checkbox" id="iCfg" ${dados.config ? 'checked' : 'disabled'}> <b>Contadores e forno</b>${dados.config ? `: última anual ${dados.config.contadores.anual}, refratário ${dados.config.contadores.refratario}, forno ${dados.config.forno.min}–${dados.config.forno.max} kg` : ' (aba SET. não encontrada)'}.</label>
      ${dados.avisos.length ? `<div class="faixa lar" style="margin-top:12px">${dados.avisos.slice(0, 8).map(esc).join('<br>')}${dados.avisos.length > 8 ? `<br>… e mais ${dados.avisos.length - 8}` : ''}</div>` : ''}
      <div id="progImp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      if (el.querySelector('#iLig').checked) dados.ligas.forEach((l, i) => {
        const atual = S.ligas.find(x => x.id === l.id);
        ops.push({ col: COL.ligas, id: l.id, dados: { ...(atual ? semMeta(atual) : {}), nome: l.nome, apelidos: l.apelidos, faixas: l.faixas,
          temperatura: (atual && atual.temperatura) || l.temperatura, ordem: atual ? atual.ordem : S.ligas.length + i } });
      });
      if (el.querySelector('#iRet').checked) dados.retornos.forEach(x => {
        const atual = S.retornos.find(y => y.id === x.id);
        if (atual && atual.origem === 'sistema') return;
        const { id, ...resto } = x;
        ops.push({ col: COL.retornos, id, dados: { ...(atual ? semMeta(atual) : {}), ...resto } });
      });
      if (el.querySelector('#iCor').checked) dados.corridas.forEach(c => {
        const { id, ...resto } = c;
        // mantém o que já tinha vindo da planilha Controle de Corrida (anual, recarga, relatório…)
        const atual = S.corridas.find(x => x.id === id);
        ops.push({ col: COL.corridas, id, dados: aplicarControle(resto, atual && atual.controle) });
      });
      if (el.querySelector('#iCfg').checked && dados.config) ops.push({ col: COL.config, id: 'liga', dados: { ...cfg(), ...dados.config } });
      if (!ops.length) { aviso('Nada marcado para importar.', 'erro'); return false; }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const prog = el.querySelector('#progImp');
      try {
        await banco.emLote(ops, (feito, total) => { prog.textContent = `Gravando ${feito} de ${total}…`; });
        aviso(`Importação concluída: ${ops.length} registros.`);
      } catch (e) {
        console.error(e);
        aviso('Erro na importação: ' + e.message, 'erro');
        el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        return false;
      }
    } }],
  });
}

async function importarControle(arquivo) {
  const st = C.querySelector('#statusCtrl');
  st.textContent = 'Lendo a planilha…';
  let dados;
  try { dados = await lerControle(arquivo, { ligas: S.ligas, retornos: S.retornos, corridas: S.corridas }); }
  catch (e) { console.error(e); st.textContent = ''; return aviso('Não consegui ler a planilha: ' + e.message, 'erro'); }
  st.textContent = '';
  const r = dados.resumo;
  if (!r.completadas && !r.novas) return aviso('Nenhuma corrida encontrada nas abas "Controle Corrida AAAA".', 'erro');
  const semBanco = !S.corridas.some(c => String(c.id).startsWith('planilha-'));
  const ct = cfg().contadores || {};
  const u = dados.ultima;
  const anoAtual = String(new Date().getFullYear());
  const contadorNovo = u && String(u.data).startsWith(anoAtual) && (u.anual || 0) > (+ct.anual || 0);
  janela({
    titulo: 'Importar ' + arquivo.name, larga: true,
    html: `<table class="tab" style="margin-bottom:12px"><thead><tr><th>Aba</th><th class="dir">Corridas</th><th class="dir">Completam corridas já importadas</th><th class="dir">Novas no histórico</th></tr></thead><tbody>
        ${dados.abas.map(a => `<tr><td>${esc(a.aba)}</td><td class="dir num">${a.lidas}</td><td class="dir num">${a.completadas}</td><td class="dir num">${a.novas}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin:0 0 8px">${r.comRecarga} corridas com recarga · ${r.comRelatorio} com nº de relatório · ${r.ligadasAnalise} ligadas ao retorno que geraram (com a análise do laboratório).</p>
      <p class="mut" style="margin:0 0 8px">Entram como "histórico da planilha": não mexem no saldo dos retornos. A carga de cada corrida é o total da planilha menos a recarga.</p>
      ${semBanco ? `<div class="faixa verm" style="margin:0 0 8px">Ainda não há corridas da planilha <b>Calculo de Ligas</b>. Se importar a Controle primeiro, as corridas de nov/2025 em diante podem aparecer duas vezes depois. Recomendo importar a Calculo de Ligas antes.</div>` : ''}
      <label class="opcao"><input type="checkbox" id="iCt" ${contadorNovo ? 'checked' : ''} ${u ? '' : 'disabled'}> <b>Atualizar a numeração</b>${u ? `: última corrida da planilha é a ${esc(numeroCorrida(u))} de ${fmtData(u.data)} (no sistema: anual ${+ct.anual || 0}, refratário ${+ct.refratario || 0})` : ''}.</label>
      ${dados.avisos.length ? `<div class="faixa lar" style="margin-top:12px">${dados.avisos.slice(0, 8).map(esc).join('<br>')}${dados.avisos.length > 8 ? `<br>… e mais ${dados.avisos.length - 8}` : ''}</div>` : ''}
      <div id="progCtrl" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      for (const { id, ct: c } of dados.completar) {
        const atual = S.corridas.find(x => x.id === id);
        if (atual) ops.push({ col: COL.corridas, id, dados: aplicarControle(semMeta(atual), c) });
      }
      for (const c of dados.novas) {
        const { id, ...resto } = c;
        const atual = S.corridas.find(x => x.id === id);
        // corrida já importada e depois editada no sistema: mantém o laboratório e as observações dela
        ops.push({ col: COL.corridas, id, dados: atual ? { ...resto, real: atual.real || {}, lab: { ...resto.lab, ...(atual.lab || {}) }, obs: atual.obs || resto.obs } : resto });
      }
      if (el.querySelector('#iCt').checked && u) ops.push({ col: COL.config, id: 'liga', dados: { ...cfg(), contadores: { anual: u.anual || 0, refratario: u.refratario || 0 } } });
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const prog = el.querySelector('#progCtrl');
      try {
        await banco.emLote(ops, (feito, total) => { prog.textContent = `Gravando ${feito} de ${total}…`; });
        aviso(`Importação concluída: ${r.completadas} corridas completadas e ${r.novas} no histórico.`);
      } catch (e) {
        console.error(e);
        aviso('Erro na importação: ' + e.message, 'erro');
        el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        return false;
      }
    } }],
  });
}

async function exportarBackup() {
  const colecoes = {};
  for (const [k, col] of Object.entries(COL)) colecoes[col] = (await banco.lerColecao(col)).map(semMetaId);
  const nome = 'engenharia-liga-backup-' + hoje() + '.json';
  baixarArquivo(nome, JSON.stringify({ sistema: 'Sistema Engenharia · Cálculo de Liga', exportadoEm: new Date().toISOString(), colecoes }, null, 1));
  aviso('Cópia baixada: ' + nome);
}
function semMetaId(d) { const x = { ...d }; delete x._em; delete x._por; return x; }

async function restaurarBackup(arquivo) {
  let j;
  try { j = JSON.parse(await arquivo.text()); } catch { return aviso('Arquivo inválido.', 'erro'); }
  if (!j || !j.colecoes) return aviso('Este arquivo não é uma cópia do Cálculo de Liga.', 'erro');
  const total = Object.values(j.colecoes).reduce((s, l) => s + l.length, 0);
  if (!confirm(`Restaurar ${total} registros da cópia de ${fmtData((j.exportadoEm || '').slice(0, 10))}? Registros com o mesmo código serão substituídos.`)) return;
  const ops = [];
  for (const [col, lista] of Object.entries(j.colecoes)) {
    if (!Object.values(COL).includes(col)) continue;
    for (const d of lista) { const { id, ...resto } = d; if (id) ops.push({ col, id, dados: resto }); }
  }
  await banco.emLote(ops);
  aviso('Cópia restaurada.');
}
