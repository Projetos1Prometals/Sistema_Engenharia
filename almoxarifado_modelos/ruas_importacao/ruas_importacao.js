// =====================================================================
//  almoxarifado_modelos/ruas_importacao/ruas_importacao.js — tela Ruas e importação
//  Ruas do almoxarifado, importação da planilha Almoxarifado_Modelos e cópia de segurança.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { aviso, janela, esc, num, icone, hoje, baixarArquivo } from '../../comum/casca.js?v=2.0.1';
import { COL, situacao, lerPosicao, posicoesDaRua } from '../regras.js?v=2.0.1';
import { lerAlmoxarifado } from '../importar_planilha.js?v=2.0.1';
import { S, C, ED, iniciarTela, aoMudarDados, somenteLeitura, semMeta } from '../base_modelos.js?v=2.0.1';

iniciarTela({ ver: ['ruas'], edita: 'ruas', menu: 'ruas', trilha: ['Almoxarifado modelos', 'Ruas e importação'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab"><div class="cresce"><h1 class="titulo">Ruas e importação</h1><p class="sub">As ruas do almoxarifado, quantas posições cada uma tem, e a importação da planilha.</p></div>
      ${ED ? `<button class="btn pri" id="btNovaRua">${icone('mais')} Nova rua</button>` : ''}</div>
    ${somenteLeitura()}
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>
    ${ED ? `<div class="cartao"><h2>Importar a planilha Almoxarifado de Modelos</h2><div class="corpo">
      <p style="margin-top:0">Traz da planilha <b>.xlsx</b>: as ruas (abas Mapa e Modelos), cada modelo com posição, volumes e situação (aba Modelos) e a ficha técnica dos refinadores (aba Comercial).
        <b>Código repetido não entra</b>: fica o primeiro e os outros aparecem no aviso.</p>
      <p class="mut">Pode importar de novo: o que veio da planilha é atualizado; desenhos (PDF) e histórico do sistema são mantidos.</p>
      <label class="btn">${icone('subir')} Escolher planilha…<input type="file" id="arqPlan" accept=".xlsx,.xlsm,.xls" class="oculto"></label>
      <span class="mut" id="statusImp" style="margin-left:10px"></span>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa os modelos e as ruas (sem os PDFs). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
    </div></div>` : ''}`;
  if (ED) {
    C.querySelector('#btNovaRua').onclick = () => editarRua(null);
    C.querySelector('#arqPlan').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarPlanilha(f); };
    C.querySelector('#btExp').onclick = () => baixarArquivo(`modelos-${hoje()}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), modelos: S.modelos, ruas: S.ruas }, null, 1));
    C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-rua]'); if (tr) editarRua(S.ruas.find(r => r.letra === tr.dataset.rua)); };
  }
  function atualizar() {
    C.querySelector('#tabela').innerHTML = !S.ruas.length ? '<div class="vazio">Nenhuma rua cadastrada.</div>' : `
      <table class="tab"><thead><tr><th>Rua</th><th>Nível</th><th class="dir">Posições</th><th class="dir">Ocupadas</th><th class="dir">Em manutenção</th><th class="dir">Livres</th></tr></thead><tbody>
      ${S.ruas.map(r => { const p = posicoesDaRua(r); const oc = p.filter(x => S.ocup.has(x)); return `<tr class="${ED ? 'clic' : ''}" data-rua="${esc(r.letra)}">
        <td><b>${esc(r.letra)}</b></td><td>${esc(r.nivel || '')}</td><td class="dir num">${p.length}</td><td class="dir num">${oc.length}</td>
        <td class="dir num">${oc.filter(x => situacao(S.ocup.get(x)) === 'manutencao').length || ''}</td><td class="dir num">${p.length - oc.length}</td></tr>`; }).join('')}
      </tbody></table>`;
  }
  aoMudarDados(atualizar);
  atualizar();
}

function editarRua(r) {
  const nova = !r;
  const ocupadas = r ? posicoesDaRua(r).filter(p => S.ocup.has(p)) : [];
  const maiorOcupada = Math.max(0, ...S.modelos.map(m => lerPosicao(m.posicao)).filter(p => p && r && p.rua === r.letra).map(p => p.n));
  janela({
    titulo: nova ? 'Nova rua' : 'Rua ' + r.letra,
    html: `<div class="linha-campos">
      <label class="campo">Letra da rua${nova ? `<input class="ent" id="rLetra" maxlength="3" placeholder="ex.: F">` : `<input class="ent" value="${esc(r.letra)}" disabled>`}</label>
      <label class="campo">Nível<input class="ent" id="rNivel" placeholder="ex.: Nível 2" value="${esc(r ? r.nivel || '' : '')}"></label>
      <label class="campo">Nº de posições<input class="ent" id="rPos" inputmode="numeric" value="${r ? r.posicoes : 12}"></label>
      <label class="campo">Ordem no mapa<input class="ent" id="rOrdem" inputmode="numeric" value="${r ? (r.ordem ?? '') : S.ruas.length}"></label></div>
      ${maiorOcupada ? `<p class="mut">A posição mais alta ocupada é ${esc(r.letra)}${maiorOcupada}: a rua não pode ter menos posições que isso.</p>` : ''}`,
    botoes: [
      ...(!nova ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (ocupadas.length) { aviso(`A rua ${r.letra} tem ${ocupadas.length} modelos. Tire os modelos antes de excluir.`, 'erro'); return false; }
        if (!confirm('Excluir a rua ' + r.letra + '?')) return false;
        banco.apagar(COL.ruas, r.letra);
        aviso('Rua excluída.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const letra = nova ? el.querySelector('#rLetra').value.trim().toUpperCase() : r.letra;
        if (!/^[A-Z]{1,3}$/.test(letra)) { aviso('A rua é uma letra (ex.: F).', 'erro'); return false; }
        if (nova && S.ruas.some(x => x.letra === letra)) { aviso('A rua ' + letra + ' já existe.', 'erro'); return false; }
        const posicoes = Math.round(num(el.querySelector('#rPos').value) || 0);
        if (posicoes < 1) { aviso('Informe o nº de posições.', 'erro'); return false; }
        if (posicoes < maiorOcupada) { aviso(`A posição ${letra}${maiorOcupada} está ocupada; a rua precisa ter pelo menos ${maiorOcupada} posições.`, 'erro'); return false; }
        banco.salvar(COL.ruas, letra, { letra, nivel: el.querySelector('#rNivel').value.trim(), posicoes, ordem: num(el.querySelector('#rOrdem').value) ?? S.ruas.length });
        aviso('Rua ' + letra + ' salva.');
      } },
    ],
  });
}

async function importarPlanilha(arquivo) {
  const st = C.querySelector('#statusImp');
  st.textContent = 'Lendo a planilha…';
  let dados;
  try { dados = await lerAlmoxarifado(arquivo); }
  catch (e) { console.error(e); st.textContent = ''; return aviso('Não consegui ler a planilha: ' + e.message, 'erro'); }
  st.textContent = '';
  const r = dados.resumo;
  if (!r.modelos) return aviso('Não achei modelos nesta planilha.', 'erro');
  const vemDaPlanilha = new Set(dados.modelos.map(m => m.id));
  const soNoSistema = S.modelos.filter(m => !vemDaPlanilha.has(m.id));
  // posição que a planilha dá para um modelo e que, no sistema, está com outro modelo que não veio da planilha
  const conflitos = dados.modelos.filter(m => m.posicao && S.ocup.get(m.posicao) && !vemDaPlanilha.has(S.ocup.get(m.posicao).id));
  janela({
    titulo: 'Importar ' + arquivo.name, larga: true,
    html: `<ul style="margin-top:0;padding-left:18px;line-height:1.7">
        <li><b>${dados.ruas.length} ruas</b> (${dados.ruas.map(x => x.letra + ' ' + x.posicoes).join(' · ')} posições)</li>
        <li><b>${r.modelos} modelos</b>: ${r.naPrateleira} na prateleira (${r.manutencao} em manutenção) e ${r.soComercial} só na lista comercial (fora do estoque)</li>
        <li><b>${r.comFicha}</b> com ficha comercial · ${r.livres} posições livres na aba Modelos</li>
        ${r.duplicados ? `<li class="txt-verm"><b>${r.duplicados} código(s) repetido(s) não entram</b> (veja abaixo)</li>` : ''}
        ${soNoSistema.length ? `<li class="mut">${soNoSistema.length} modelos que só existem no sistema não são mexidos.</li>` : ''}
        ${conflitos.length ? `<li class="txt-verm">${conflitos.length} posições da planilha estão ocupadas no sistema por outro modelo: ${conflitos.map(m => `${esc(m.posicao)} (${esc(m.codigo)})`).join(', ')}. Esses modelos entram sem posição.</li>` : ''}
      </ul>
      ${dados.avisos.length ? `<div class="faixa lar" style="margin-top:8px">${dados.avisos.map(esc).join('<br>')}</div>` : ''}
      <div id="progImp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      for (const ru of dados.ruas) {
        const atual = S.ruas.find(x => x.letra === ru.letra);
        ops.push({ col: COL.ruas, id: ru.letra, dados: { letra: ru.letra, nivel: ru.nivel || (atual && atual.nivel) || '', posicoes: Math.max(ru.posicoes, (atual && atual.posicoes) || 0), ordem: ru.ordem } });
      }
      for (const m of dados.modelos) {
        const atual = S.porId.get(m.id);
        const { id, ...resto } = m;
        if (conflitos.includes(m)) resto.posicao = '';
        // mantém o que é do sistema: desenho, histórico (sem repetir o que veio da planilha) e observação
        const hist = [...((atual && atual.historico) || [])];
        for (const h of resto.historico) if (!hist.some(x => x.data === h.data && x.tipo === h.tipo && x.origem === 'planilha')) hist.push(h);
        if (!atual) hist.push({ data: hoje(), tipo: 'importado', obs: resto.posicao ? 'Posição ' + resto.posicao : 'Sem posição' });
        else if ((atual.posicao || '') !== (resto.posicao || '')) hist.push({ data: hoje(), tipo: 'posicao', de: atual.posicao || '', para: resto.posicao || '', origem: 'planilha' });
        ops.push({ col: COL.modelos, id, dados: {
          ...(atual ? semMeta(atual) : {}), ...resto,
          obs: resto.obs || (atual && atual.obs) || '',
          comercial: resto.comercial || (atual && atual.comercial) || null,
          historico: hist.sort((a, b) => String(a.data).localeCompare(String(b.data))),
        } });
      }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await banco.emLote(ops, (feito, total) => { el.querySelector('#progImp').textContent = `Gravando ${feito} de ${total}…`; });
        aviso(`Importação concluída: ${dados.modelos.length} modelos e ${dados.ruas.length} ruas.`);
      } catch (e) {
        console.error(e);
        aviso('Erro na importação: ' + e.message, 'erro');
        el.querySelectorAll('button').forEach(b => { b.disabled = false; });
        return false;
      }
    } }],
  });
}
