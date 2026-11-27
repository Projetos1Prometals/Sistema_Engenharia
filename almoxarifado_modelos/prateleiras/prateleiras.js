// =====================================================================
//  almoxarifado_modelos/prateleiras/prateleiras.js — tela Prateleiras (mapa)
//  Onde está cada modelo; vaga livre clicada: pôr um modelo ou cadastrar um novo.
// =====================================================================
import { aviso, janela, esc, icone, filtroDaTela } from '../../comum/casca.js?v=2.0.0';
import { normCodigo, situacao, posicoesDaRua } from '../regras.js?v=2.0.0';
import { S, C, ED, url, iniciarTela, aoMudarDados, kpi, somenteLeitura, evento, gravarModelo } from '../base_modelos.js?v=2.0.0';

const f = filtroDaTela('prateleiras', { q: '' });
// pôr modelo numa vaga segue o "Editar" de Modelos
iniciarTela({ ver: ['mapa'], edita: 'modelos', menu: 'mapa', trilha: ['Almoxarifado modelos', 'Prateleiras'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Prateleiras</h1><p class="sub">Onde está cada modelo. Clique numa posição para abrir o modelo${ED ? ' ou colocar um modelo numa vaga livre' : ''}.</p></div>
      ${ED ? `<a class="btn pri" href="${url('ficha_modelo')}">${icone('mais')} Novo modelo</a>` : ''}
    </div>
    ${somenteLeitura()}
    <div class="kpis" id="kpis"></div>
    <div class="cartao"><div class="corpo" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <div class="busca">${icone('busca')}<input class="ent" id="fq" placeholder="Achar código ou medida no mapa…" value="${esc(f.q)}"></div>
      <span class="legenda-mapa"><i class="pos disp">Disponível</i><i class="pos man">Em manutenção</i><i class="pos livre">Vaga livre</i></span>
      <span class="mut" id="achados"></span>
    </div></div>
    <div id="ruas"></div>`;
  C.querySelector('#fq').oninput = e => { f.q = e.target.value; atualizar(true); };
  C.querySelector('#ruas').onclick = e => {
    const t = e.target.closest('[data-pos]');
    if (!t) return;
    const m = S.ocup.get(t.dataset.pos);
    if (m) location.href = url('ficha_modelo', { id: m.id });
    else if (ED) escolherParaVaga(t.dataset.pos);
  };

  function atualizar(rolar) {
    const todas = S.ruas.flatMap(posicoesDaRua);
    const dispon = S.modelos.filter(m => situacao(m) === 'disponivel').length;
    const manut = S.modelos.filter(m => situacao(m) === 'manutencao').length;
    const livres = todas.filter(p => !S.ocup.has(p)).length;
    C.querySelector('#kpis').innerHTML = kpi(dispon, 'Disponíveis', 'verde') + kpi(manut, 'Em manutenção', 'amar') + kpi(livres, 'Vagas livres', '') + kpi(todas.length, 'Posições', 'roxo');
    const q = normCodigo(f.q);
    const bate = m => q && m && (normCodigo(m.codigo).includes(q) || normCodigo(m.descricao).includes(q));
    let achados = 0;
    const foraDoMapa = S.modelos.filter(m => m.posicao && !todas.includes(m.posicao));
    C.querySelector('#ruas').innerHTML = (!S.ruas.length
      ? `<div class="cartao"><div class="vazio">Nenhuma rua cadastrada. ${ED ? 'Importe a planilha ou cadastre as ruas em <a href="' + url('ruas_importacao') + '">Ruas e importação</a>.' : ''}</div></div>`
      : S.ruas.map(r => {
        const pos = posicoesDaRua(r);
        const ocupadas = pos.filter(p => S.ocup.has(p)).length;
        return `<div class="cartao"><h2>Rua ${esc(r.letra)}${r.nivel ? ' — ' + esc(r.nivel) : ''}<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:500">${ocupadas} de ${pos.length} ocupadas</span></h2>
          <div class="corpo"><div class="prateleira">${pos.map(p => {
            const m = S.ocup.get(p);
            const cls = !m ? 'livre' : situacao(m) === 'manutencao' ? 'man' : 'disp';
            const achou = bate(m); if (achou) achados++;
            return `<button class="pos ${cls} ${achou ? 'achado' : ''} ${q && !achou ? 'apagado' : ''}" data-pos="${p}" title="${m ? esc(m.codigo + (m.descricao ? ' — ' + m.descricao : '')) : 'Vaga livre'}">
              <small>${p}</small><b>${m ? esc(m.codigo) : '—'}</b>${m && m.descricao ? `<span>${esc(m.descricao)}</span>` : ''}${m && m.desenho ? `<em>${icone('documento')}</em>` : ''}</button>`;
          }).join('')}</div></div></div>`;
      }).join('')) +
      (foraDoMapa.length ? `<div class="faixa verm">Modelos com posição que não existe no mapa: ${foraDoMapa.map(m => `<a href="${url('ficha_modelo', { id: m.id })}">${esc(m.codigo)} (${esc(m.posicao)})</a>`).join(', ')}. Aumente a rua em Ruas e importação ou mude a posição do modelo.</div>` : '');
    C.querySelector('#achados').textContent = q ? (achados ? `${achados} encontrado(s)` : 'Nada encontrado no mapa (veja em Modelos: pode estar fora do estoque)') : '';
    if (rolar && achados) { const el = C.querySelector('.pos.achado'); el && el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  aoMudarDados(atualizar);
  atualizar();
}

// Vaga livre clicada: escolher um modelo sem posição ou criar um novo
function escolherParaVaga(pos) {
  const semPos = S.modelos.filter(m => !m.posicao).sort((a, b) => String(a.codigo).localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  janela({
    titulo: 'Vaga ' + pos,
    html: `<p style="margin-top:0">Esta posição está livre. Coloque aqui um modelo que está sem posição, ou cadastre um novo.</p>
      <label class="campo">Modelo sem posição<select class="ent" id="vMod"><option value="">Escolha…</option>${semPos.map(m => `<option value="${esc(m.id)}">${esc(m.codigo)}${m.descricao ? ' — ' + esc(m.descricao) : ''}</option>`).join('')}</select></label>`,
    botoes: [
      { texto: icone('mais') + ' Novo modelo aqui', esquerda: true, acao: () => { location.href = url('ficha_modelo', { pos }); } },
      { texto: 'Cancelar' },
      { texto: 'Colocar aqui', cls: 'pri', acao: el => {
        const m = S.porId.get(el.querySelector('#vMod').value);
        if (!m) { aviso('Escolha o modelo.', 'erro'); return false; }
        if (S.ocup.get(pos)) { aviso('Esta posição acabou de ser ocupada.', 'erro'); return false; }
        gravarModelo({ ...m, posicao: pos, historico: [...(m.historico || []), evento('posicao', { de: '', para: pos })] });
        aviso(`${m.codigo} colocado em ${pos}.`);
      } },
    ],
  });
}
