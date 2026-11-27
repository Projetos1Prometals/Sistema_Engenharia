// =====================================================================
//  almoxarifado_modelos/ficha_modelo/ficha_modelo.js — ficha do modelo
//  ?id=<id do modelo>; sem id = novo modelo (?pos=K25 já escolhe a posição).
//  Abre para quem vê qualquer tela de Modelos; editar segue "Modelos".
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.1';
import { definirTrilha, aviso, esc, num, fmtData, icone, TELAS_MODELOS, ir } from '../../comum/casca.js?v=2.0.1';
import { COL, EXTENSOES, CAMPOS_COMERCIAIS, idModelo, chaveDesenho, situacao, lerPosicao, posicoesDaRua, lerVolumes } from '../regras.js?v=2.0.1';
import {
  S, C, ED, MAN, url, iniciarTela, aoMudarDados, ent, tagSit, fmtTamanho, somenteLeitura, evento, semMeta, gravarModelo, abrirDesenho,
} from '../base_modelos.js?v=2.0.1';

let sujo = false;   // alterações não salvas
iniciarTela({
  ver: TELAS_MODELOS, edita: 'modelos', menu: 'modelos', trilha: ['Almoxarifado modelos', 'Modelos'],
  desenhar: () => { const p = new URLSearchParams(location.search); paginaModelo(p.get('id') || 'novo', p); },
});
window.addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

function paginaModelo(id, params) {
  const orig = id === 'novo' ? null : S.porId.get(id);
  if (id !== 'novo' && !orig) {
    C.innerHTML = `<div class="faixa verm">Modelo não encontrado.</div><a class="btn" href="${url('modelos')}">${icone('voltar')} Voltar</a>`;
    aoMudarDados(() => { if (S.porId.get(id)) paginaModelo(id, params); });
    return;
  }
  if (!orig && !ED) { location.replace(url('modelos')); return; }
  const d = orig ? JSON.parse(JSON.stringify(semMeta(orig))) : { codigo: '', descricao: '', volumes: '', posicao: lerPosicao(params.get('pos')) ? lerPosicao(params.get('pos')).pos : '', situacao: 'disponivel', obs: '', comercial: null, historico: [] };
  d.comercial = d.comercial || {};
  definirTrilha(['Almoxarifado modelos', 'Modelos', orig ? orig.codigo : 'Novo modelo']);

  C.innerHTML = `<div id="pgModelo">
    <div class="cab">
      <a class="btn" href="${url('modelos')}">${icone('voltar')}</a>
      <div class="cresce"><h1 class="titulo">${orig ? 'Modelo ' + esc(orig.codigo) : 'Novo modelo'} <span id="tagSit"></span></h1><p class="sub" id="subModelo"></p></div>
      ${orig && ED ? `<button class="btn perigo" id="btExcluir">${icone('lixo')} Excluir</button>` : ''}
      ${ED ? `<button class="btn pri" id="btSalvar">${icone('salvar')} Salvar</button>` : ''}
    </div>
    ${somenteLeitura()}
    <div class="grade2">
      <div class="cartao"><h2>Modelo</h2><div class="corpo">
        <div class="linha-campos">
          <label class="campo">Código${orig ? `<input class="ent" value="${esc(orig.codigo)}" disabled title="O código não muda depois de criado (o desenho e o histórico ficam ligados a ele)">` : ent('data-f="codigo" placeholder="ex.: 1171" autocomplete="off"', d.codigo)}<small class="mut" id="avisoCod"></small></label>
          <label class="campo">Volumes${ent('data-f="volumes" inputmode="numeric" placeholder="ex.: 4"', d.volumes)}</label>
          <label class="campo" style="grid-column:span 2">Medida / descrição${ent('data-f="descricao" placeholder="ex.: 2,3 x 4 x 7°30\' - 20&quot;"', d.descricao)}</label>
          <label class="campo">Posição<select class="ent" data-f="posicao" id="selPos" ${ED ? '' : 'disabled'}></select></label>
        </div>
        <label class="campo" style="margin-top:12px">Observações<textarea class="ent" data-f="obs" ${ED ? '' : 'disabled'}>${esc(d.obs || '')}</textarea></label>
      </div></div>
      <div class="cartao"><h2>Situação</h2><div class="corpo" id="boxSit"></div></div>
    </div>
    <div class="cartao"><h2>Desenho (PDF)</h2><div class="corpo" id="boxDesenho"></div></div>
    <div class="cartao"><h2>Ficha comercial<span class="cresce"></span><span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">dados técnicos do refinador (aparece na Lista comercial)</span></h2><div class="corpo">
      <div class="linha-campos">${CAMPOS_COMERCIAIS.map(([k, rot]) => k === 'extensao'
        ? `<label class="campo">${rot}<select class="ent" data-c="extensao" ${ED ? '' : 'disabled'}><option value=""></option>${Object.entries(EXTENSOES).map(([v, t]) => `<option value="${v}" ${String(d.comercial.extensao) === v ? 'selected' : ''}>${v} = ${t}</option>`).join('')}</select></label>`
        : `<label class="campo">${rot}${ent(`data-c="${k}"`, typeof d.comercial[k] === 'number' ? String(d.comercial[k]).replace('.', ',') : d.comercial[k])}</label>`).join('')}</div>
    </div></div>
    ${orig ? `<div class="cartao"><h2>Histórico</h2><div class="corpo" id="boxHist"></div></div>` : ''}</div>`;

  const sub = () => {
    const at = orig && (S.porId.get(orig.id) || orig);
    C.querySelector('#subModelo').textContent = sujo ? 'Alterações não salvas' : at && at._em ? 'Salvo em ' + new Date(at._em).toLocaleString('pt-BR') + (at._por && at._por !== 'modo local' ? ' por ' + at._por : '') : (orig ? '' : 'Preencha e clique em Salvar');
    C.querySelector('#tagSit').innerHTML = tagSit(orig ? { ...(S.porId.get(orig.id) || orig), posicao: d.posicao } : d);
  };
  const marcar = () => { if (!sujo) { sujo = true; sub(); } };
  const pg = C.querySelector('#pgModelo');
  pg.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f) { d[t.dataset.f] = t.value; marcar(); if (t.dataset.f === 'codigo') conferirCodigo(); }
    else if (t.dataset.c) { d.comercial[t.dataset.c] = t.value; marcar(); }
  });
  pg.addEventListener('change', e => { const t = e.target; if (t.dataset.f === 'posicao') { d.posicao = t.value; marcar(); sub(); } });

  function conferirCodigo() {
    const ja = d.codigo.trim() && S.porId.get(idModelo(d.codigo));
    C.querySelector('#avisoCod').innerHTML = ja ? `<span class="txt-verm">Já existe o modelo <a href="${url('ficha_modelo', { id: ja.id })}">${esc(ja.codigo)}</a>${ja.posicao ? ' em ' + esc(ja.posicao) : ''}. Código não pode repetir.</span>` : '';
  }

  function montarPosicoes() {
    const sel = C.querySelector('#selPos');
    const livres = S.ruas.map(r => ({ r, pos: posicoesDaRua(r).filter(p => !S.ocup.has(p) || (orig && S.ocup.get(p).id === orig.id) || p === d.posicao) }));
    sel.innerHTML = `<option value="">Sem posição (fora do estoque)</option>` +
      (d.posicao && !S.ruas.some(r => posicoesDaRua(r).includes(d.posicao)) ? `<option value="${esc(d.posicao)}" selected>${esc(d.posicao)} (fora do mapa)</option>` : '') +
      livres.filter(x => x.pos.length).map(x => `<optgroup label="Rua ${esc(x.r.letra)}${x.r.nivel ? ' — ' + esc(x.r.nivel) : ''}">${x.pos.map(p => `<option value="${p}" ${p === d.posicao ? 'selected' : ''}>${p}${S.ocup.has(p) && (!orig || S.ocup.get(p).id !== orig.id) ? ' (ocupada)' : ''}</option>`).join('')}</optgroup>`).join('');
  }

  function montarSituacao() {
    const box = C.querySelector('#boxSit');
    const atual = orig ? S.porId.get(orig.id) || orig : null;
    const st = situacao(atual || d);
    if (!orig) { box.innerHTML = '<p class="mut" style="margin:0">Salve o modelo para poder mandar para manutenção.</p>'; return; }
    const ult = [...(atual.historico || [])].reverse().find(h => h.tipo === 'manutencao');
    box.innerHTML = `<p style="margin-top:0">${tagSit(atual)} ${st === 'manutencao' && ult ? `<span class="mut">desde ${fmtData(ult.data)}</span>` : ''}</p>
      ${st === 'manutencao' ? `<p class="mut">A posição <b>${esc(atual.posicao || '—')}</b> fica reservada até o modelo voltar.</p>` : ''}
      ${MAN ? (st === 'manutencao'
        ? `<button class="btn pri" id="btVoltou">${icone('voltar')} Voltou da manutenção</button>`
        : `<button class="btn" id="btManut">${icone('ferramenta')} Mandar para manutenção</button>`) : ''}`;
    const bm = box.querySelector('#btManut'), bv = box.querySelector('#btVoltou');
    if (bm) bm.onclick = () => mudarSituacao('manutencao');
    if (bv) bv.onclick = () => mudarSituacao('disponivel');
  }
  function mudarSituacao(nova) {
    if (sujo) { aviso('Salve as alterações antes.', 'erro'); return; }
    const atual = S.porId.get(orig.id);
    gravarModelo({ ...atual, situacao: nova, historico: [...(atual.historico || []), evento(nova === 'manutencao' ? 'manutencao' : 'voltou')] });
    aviso(nova === 'manutencao' ? `${atual.codigo} foi para manutenção.` : `${atual.codigo} voltou da manutenção.`);
  }

  function montarDesenho() {
    const box = C.querySelector('#boxDesenho');
    const atual = orig ? S.porId.get(orig.id) : null;
    const des = atual && atual.desenho;
    if (!orig) { box.innerHTML = '<p class="mut" style="margin:0">Salve o modelo para poder anexar o desenho.</p>'; return; }
    box.innerHTML = `${des
      ? `<div class="arquivo">${icone('documento')}<div class="cresce"><b>${esc(des.nome)}</b><small class="mut">${fmtTamanho(des.tamanho)} · enviado em ${fmtData(String(des.em).slice(0, 10))}</small></div>
          <button class="btn" id="btAbrir">${icone('olho')} Abrir</button><button class="btn" id="btBaixar">${icone('baixar')} Baixar</button>
          ${ED ? `<button class="botao-ic" id="btTirar" title="Remover o desenho">${icone('lixo')}</button>` : ''}</div>`
      : `<p class="mut" style="margin-top:0">Nenhum desenho anexado.</p>`}
      ${ED ? `<label class="btn ${des ? '' : 'pri'}" style="margin-top:10px">${icone('subir')} ${des ? 'Trocar o PDF…' : 'Enviar o PDF do desenho…'}<input type="file" id="arqPdf" accept="application/pdf,.pdf" class="oculto"></label>
        <span class="mut" id="stPdf" style="margin-left:10px">PDF de até ${Math.round(banco.ARQUIVO_MAX / 1048576)} MB.</span>` : ''}`;
    const ba = box.querySelector('#btAbrir'), bb = box.querySelector('#btBaixar'), bt = box.querySelector('#btTirar'), arq = box.querySelector('#arqPdf');
    if (ba) ba.onclick = () => abrirDesenho(atual, false);
    if (bb) bb.onclick = () => abrirDesenho(atual, true);
    if (bt) bt.onclick = async () => {
      if (!confirm('Remover o desenho de ' + atual.codigo + '?')) return;
      await banco.apagarArquivo(chaveDesenho(atual.id));
      const m = { ...S.porId.get(atual.id) }; delete m.desenho;
      m.historico = [...(m.historico || []), evento('desenho', { obs: 'Desenho removido' })];
      gravarModelo(m);
      aviso('Desenho removido.');
    };
    if (arq) arq.onchange = async e => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return aviso('Escolha um arquivo PDF.', 'erro');
      if (file.size > banco.ARQUIVO_MAX) return aviso(`O PDF tem ${fmtTamanho(file.size)}; o máximo é ${Math.round(banco.ARQUIVO_MAX / 1048576)} MB.`, 'erro');
      const st = box.querySelector('#stPdf'); st.textContent = 'Enviando…';
      try {
        const meta = await banco.salvarArquivo(chaveDesenho(atual.id), file);
        const m = S.porId.get(atual.id);
        gravarModelo({ ...m, desenho: meta, historico: [...(m.historico || []), evento('desenho', { obs: (m.desenho ? 'Desenho trocado: ' : 'Desenho anexado: ') + meta.nome })] });
        aviso('Desenho salvo.');
      } catch (err) { console.error(err); st.textContent = ''; aviso('Não consegui salvar o PDF: ' + err.message, 'erro'); }
    };
  }

  function montarHistorico() {
    const box = C.querySelector('#boxHist');
    if (!box) return;
    const h = [...((S.porId.get(orig.id) || orig).historico || [])].reverse();
    const nome = { manutencao: 'Foi para manutenção', voltou: 'Voltou da manutenção', posicao: 'Mudou de posição', criado: 'Cadastrado', importado: 'Importado da planilha', desenho: 'Desenho', nota: 'Anotação' };
    box.innerHTML = !h.length ? '<p class="mut" style="margin:0">Nada registrado ainda.</p>' : `<table class="tab"><thead><tr><th>Data</th><th>O quê</th><th>Detalhe</th></tr></thead><tbody>
      ${h.map(x => `<tr><td class="num">${fmtData(x.data)}</td><td>${nome[x.tipo] || esc(x.tipo)}</td><td class="mut">${x.tipo === 'posicao' ? `${esc(x.de || 'sem posição')} → ${esc(x.para || 'sem posição')}` : esc(x.obs || '')}${x.por ? ` · ${esc(x.por)}` : ''}${x.origem === 'planilha' ? ' · da planilha' : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function salvar() {
    const codigo = String(d.codigo || '').trim().replace(/\s+/g, ' ');
    if (!codigo) return aviso('Informe o código.', 'erro');
    const novoId = orig ? orig.id : idModelo(codigo);
    if (!orig && S.porId.has(novoId)) return aviso(`Já existe o modelo ${S.porId.get(novoId).codigo}. Código não pode repetir.`, 'erro');
    const pos = d.posicao || '';
    const dono = pos && S.ocup.get(pos);
    if (dono && dono.id !== novoId) return aviso(`A posição ${pos} já está com o modelo ${dono.codigo}.`, 'erro');
    const atual = orig ? S.porId.get(orig.id) : null;
    const comercial = {};
    for (const [k] of CAMPOS_COMERCIAIS) {
      const v = String(d.comercial[k] == null ? '' : d.comercial[k]).trim();
      if (!v) continue;
      const n = /^-?[\d.,]+$/.test(v) ? num(v) : null;
      comercial[k] = k === 'extensao' ? +v : n != null && !['diametro', 'embalagem', 'variacao'].includes(k) ? n : v;
    }
    if (atual && atual.comercial && atual.comercial.ordem != null && Object.keys(comercial).length) comercial.ordem = atual.comercial.ordem;
    const historico = [...((atual && atual.historico) || [])];
    if (!orig) historico.push(evento('criado', pos ? { obs: 'Posição ' + pos } : {}));
    else if ((atual.posicao || '') !== pos) historico.push(evento('posicao', { de: atual.posicao || '', para: pos }));
    const dados = {
      ...(atual ? semMeta(atual) : {}),
      codigo: orig ? orig.codigo : codigo, descricao: String(d.descricao || '').trim(), volumes: lerVolumes(d.volumes),
      posicao: pos, situacao: atual ? atual.situacao || 'disponivel' : 'disponivel', obs: d.obs || '',
      comercial: Object.keys(comercial).length ? comercial : null, historico,
    };
    if (dados.semCodigo && !orig) delete dados.semCodigo;
    banco.salvar(COL.modelos, novoId, dados).catch(e => aviso('Erro ao salvar: ' + e.message, 'erro'));
    sujo = false;
    aviso('Modelo ' + dados.codigo + ' salvo.');
    if (!orig) { history.replaceState(null, '', url('ficha_modelo', { id: novoId })); setTimeout(() => paginaModelo(novoId, new URLSearchParams()), 50); }
  }

  const bs = C.querySelector('#btSalvar'); if (bs) bs.onclick = salvar;
  const bx = C.querySelector('#btExcluir');
  if (bx) bx.onclick = async () => {
    if (!confirm(`Excluir o modelo ${orig.codigo}?${orig.desenho ? ' O desenho (PDF) também será apagado.' : ''}`)) return;
    if (orig.desenho) await banco.apagarArquivo(chaveDesenho(orig.id)).catch(() => {});
    banco.apagar(COL.modelos, orig.id).catch(e => aviso('Erro ao excluir: ' + e.message, 'erro'));
    sujo = false;
    aviso('Modelo excluído.');
    ir(url('modelos'));   // espera a exclusão ser gravada antes de sair da página
  };

  function tudo() { montarPosicoes(); montarSituacao(); montarDesenho(); montarHistorico(); sub(); }
  aoMudarDados(() => { if (orig && !S.porId.get(orig.id)) { ir(url('modelos'), { trocar: true }); return; } montarPosicoes(); montarSituacao(); montarDesenho(); montarHistorico(); sub(); });
  tudo();
}
