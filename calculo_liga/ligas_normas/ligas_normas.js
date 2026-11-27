// =====================================================================
//  calculo_liga/ligas_normas/ligas_normas.js — tela Ligas e normas
//  Faixa mínima e máxima de cada elemento; usada na corrida, no boletim e nos certificados.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { aviso, janela, esc, num, icone } from '../../comum/casca.js?v=2.0.1';
import { ELEMENTOS, COL, mesmaLiga, normLiga } from '../calculo.js?v=2.0.1';
import { S, C, ED, corPadraoLiga, semMeta, ent, entNum, fmtFaixa, iniciarTela, aoMudarDados } from '../base_liga.js?v=2.0.1';

iniciarTela({ tela: 'ligas', trilha: ['Cálculo de Liga', 'Ligas e normas'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Ligas e normas</h1><p class="sub">Faixa mínima e máxima de cada elemento (%). É a referência usada na corrida, no boletim e na conferência do laboratório.</p></div>
      <button class="btn pri so-ed" id="btNovaLiga">${icone('mais')} Nova liga</button>
    </div>
    <div class="cartao"><div class="tab-wrap" id="tabela"></div></div>`;
  C.querySelector('#btNovaLiga').onclick = () => editarLiga(null);
  C.querySelector('#tabela').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) editarLiga(S.ligas.find(l => l.id === tr.dataset.id)); };
  function atualizar() {
    C.querySelector('#tabela').innerHTML = !S.ligas.length ? '<div class="vazio">Nenhuma liga cadastrada.</div>' : `
      <table class="tab"><thead><tr><th>Liga</th><th>Também escrita como</th><th class="dir">Temp.</th><th>Cor do retorno</th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
      ${S.ligas.map(l => `<tr class="clic" data-id="${esc(l.id)}"><td><span class="pilula lar">${esc(l.nome)}</span></td><td class="mut">${esc((l.apelidos || []).join(', '))}</td>
        <td class="dir num">${l.temperatura ? esc(l.temperatura) + '°' : ''}</td><td style="white-space:nowrap">${l.cor ? esc(l.cor) : corPadraoLiga(l) ? `<span class="mut">${esc(corPadraoLiga(l))} (tabela)</span>` : ''}</td>
        ${ELEMENTOS.map(e => `<td class="cen num" style="white-space:nowrap">${fmtFaixa((l.faixas || {})[e])}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;
  }
  aoMudarDados(atualizar);
  atualizar();
}

function editarLiga(l) {
  const nova = !l;
  l = l || { nome: '', apelidos: [], faixas: {}, temperatura: '' };
  const usada = !nova && S.corridas.some(c => mesmaLiga(S.ligas, c.liga, l.nome));
  janela({
    titulo: nova ? 'Nova liga' : 'Liga ' + l.nome, larga: true,
    html: `<div class="linha-campos">
        <label class="campo">Nome da liga${ent(`id="lNome" ${usada ? 'readonly title="Liga já usada em corridas"' : ''}`, l.nome)}</label>
        <label class="campo">Também escrita como (separe por vírgula)${ent('id="lApel" placeholder="ex.: A-532, A532"', (l.apelidos || []).join(', '))}</label>
        <label class="campo">Temperatura padrão (°C)${entNum('id="lTemp"', l.temperatura)}</label>
        <label class="campo">Cor de marcação do retorno${ent(`id="lCor" placeholder="${esc(corPadraoLiga(l) ? corPadraoLiga(l) + " (tabela)" : "ex.: AMARELO")}"`, l.cor)}</label>
      </div>
      <div class="tab-wrap" style="margin-top:14px"><table class="tab tab-comp"><thead><tr><th></th>${ELEMENTOS.map(e => `<th class="cen">${e}</th>`).join('')}</tr></thead><tbody>
        <tr><td><b>Mín.</b></td>${ELEMENTOS.map(e => `<td>${entNum(`data-min="${e}"`, (l.faixas[e] || [])[0])}</td>`).join('')}</tr>
        <tr><td><b>Máx.</b></td>${ELEMENTOS.map(e => `<td>${entNum(`data-max="${e}"`, (l.faixas[e] || [])[1])}</td>`).join('')}</tr>
      </tbody></table></div>
      <p class="mut">Deixe em branco os elementos que a norma não controla.</p>`,
    soLeitura: !ED,
    botoes: [
      ...(!nova ? [{ texto: icone('lixo') + ' Excluir', cls: 'perigo', esquerda: true, acao: () => {
        if (usada) { aviso('Esta liga tem corridas registradas; não dá para excluir.', 'erro'); return false; }
        if (!confirm('Excluir a liga ' + l.nome + '?')) return false;
        banco.apagar(COL.ligas, l.id); aviso('Liga excluída.');
      } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Salvar', cls: 'pri', acao: el => {
        const nome = el.querySelector('#lNome').value.trim();
        if (!nome) { aviso('Informe o nome da liga.', 'erro'); return false; }
        const id = nova ? normLiga(nome) : l.id;
        if (nova && S.ligas.some(x => x.id === id)) { aviso('Essa liga já existe.', 'erro'); return false; }
        const faixas = {};
        for (const e of ELEMENTOS) {
          const mn = num(el.querySelector(`[data-min="${e}"]`).value), mx = num(el.querySelector(`[data-max="${e}"]`).value);
          if (mn == null && mx == null) continue;
          faixas[e] = [mn || 0, mx];
        }
        banco.salvar(COL.ligas, id, { ...semMeta(l), nome, apelidos: el.querySelector('#lApel').value.split(',').map(s => s.trim()).filter(Boolean),
          temperatura: num(el.querySelector('#lTemp').value), cor: el.querySelector('#lCor').value.trim().toUpperCase(), faixas, ordem: l.ordem ?? S.ligas.length });
        aviso('Liga ' + nome + ' salva.');
      } },
    ],
  });
}
