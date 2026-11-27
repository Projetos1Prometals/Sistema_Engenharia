// =====================================================================
//  certificados/assinatura_backup/assinatura_backup.js — Assinatura e backup
//  Imagem da assinatura dos certificados, importação do backup do app antigo
//  e cópia de segurança.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.0';
import { aviso, janela, icone, baixarArquivo, endereco } from '../../comum/casca.js?v=2.0.0';
import { COL as COL_LIGA } from '../../calculo_liga/calculo.js?v=2.0.0';
import { clone, dateKey, upgradeCert } from '../folha_certificado.js?v=2.0.0';
import { S, C, ED, COL, CFG_ID, assinatura, url, iniciarTela, aoMudarDados, uid, salvarPendente } from '../base_certificados.js?v=2.0.0';

iniciarTela({ trilha: ['Qualidade', 'Certificados', 'Assinatura e backup'], desenhar });

function desenhar() {
  C.innerHTML = `
    <div class="cab"><a class="btn" href="${url('lista')}">${icone('voltar')}</a><div class="cresce"><h1 class="titulo">Assinatura e backup</h1><p class="sub">A imagem da assinatura dos certificados e a cópia de segurança. As faixas das ligas usadas na conferência ficam em <a href="${endereco('calculo_liga/ligas_normas')}">Ligas e normas</a> (as mesmas do Cálculo de Liga).</p></div></div>
    <div class="cartao"><h2>Assinatura nos certificados</h2><div class="corpo">
      <div class="assin" id="assPrev"></div>
      ${ED ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><label class="btn">${icone('subir')} Trocar imagem…<input type="file" id="arqAss" accept="image/*" class="oculto"></label><button class="btn perigo" id="btTirarAss">${icone('lixo')} Remover</button></div>
        <p class="mut" style="margin-bottom:0">Fica guardada no banco, não no site (o GitHub é público).</p>` : ''}
    </div></div>
    ${ED ? `<div class="cartao"><h2>Trazer os certificados do app antigo</h2><div class="corpo">
      <p style="margin-top:0">No app antigo de certificados: <b>Backup → Exportar backup (.json)</b>. Depois escolha o arquivo aqui.
        Os certificados entram como estão; os que tiverem a corrida no formato <b>33-229</b> são <b>ligados sozinhos</b> à corrida do Cálculo de Liga (nº do refratário e anual, data mais próxima). A assinatura do arquivo também pode vir.</p>
      <label class="btn">${icone('subir')} Escolher o backup (.json)…<input type="file" id="arqBkp" accept=".json,application/json" class="oculto"></label>
    </div></div>
    <div class="cartao"><h2>Cópia de segurança</h2><div class="corpo">
      <p style="margin-top:0">Baixa todos os certificados e a assinatura (no mesmo formato do app antigo). Guarde na rede de vez em quando.</p>
      <button class="btn" id="btExp">${icone('baixar')} Baixar cópia (.json)</button>
    </div></div>` : ''}`;
  function atualizar() {
    const a = assinatura();
    C.querySelector('#assPrev').innerHTML = a ? `<img src="${a}" alt="Assinatura">` : '<span class="mut">Nenhuma assinatura cadastrada</span>';
    const bt = C.querySelector('#btTirarAss'); if (bt) bt.disabled = !a;
  }
  if (ED) {
    C.querySelector('#arqAss').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { const url = await reduzirImagem(await lerComoDataURL(f)); salvarCfg({ assinatura: url }); aviso('Assinatura atualizada para todos os certificados.'); }
      catch (err) { aviso('Não consegui ler essa imagem. Use PNG ou JPG.', 'erro'); }
    };
    C.querySelector('#btTirarAss').onclick = () => { if (confirm('Os certificados passam a sair sem a imagem da assinatura. Continuar?')) salvarCfg({ assinatura: '' }); };
    C.querySelector('#btExp').onclick = () => {
      salvarPendente();
      baixarArquivo(`certificados-backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ sistema: 'certificados-prometals', exportadoEm: new Date().toISOString(), certs: S.certs.map(c => { const x = clone(c); delete x._em; delete x._por; return x; }), assinatura: assinatura() }, null, 1));
    };
    C.querySelector('#arqBkp').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importarBackup(f); };
  }
  aoMudarDados(atualizar);
  atualizar();
}
function salvarCfg(campos) { banco.salvar(COL_LIGA.config, CFG_ID, { ...(S.cfg ? (({ id, _em, _por, ...r }) => r)(S.cfg) : {}), ...campos }); }
const lerComoDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
function reduzirImagem(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const w = Math.min(700, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
      res(cv.toDataURL('image/png'));
    };
    im.onerror = rej; im.src = url;
  });
}

// Corrida do certificado ("33-229") → corrida do Cálculo de Liga (refratário 33, anual 229, data mais próxima da emissão)
function acharCorridaPeloTexto(texto, dataEmissao) {
  const m = String(texto || '').match(/^\s*(\d+)\s*[-/]\s*(\d+)\s*$/);
  if (!m) return null;
  const ref = +m[1], anual = +m[2];
  const cands = S.corridas.filter(c => +c.refratario === ref && +c.anual === anual && c.data);
  if (!cands.length) return null;
  const k = dateKey(dataEmissao);
  if (!k) return cands.length === 1 ? cands[0] : null;
  const alvo = new Date(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`);
  const dist = c => Math.abs(new Date(c.data) - alvo) / 86400000;
  const melhor = cands.slice().sort((a, b) => dist(a) - dist(b))[0];
  return dist(melhor) <= 120 ? melhor : null;      // emissão até ~4 meses depois da corrida
}

async function importarBackup(arquivo) {
  let o;
  try { o = JSON.parse(await arquivo.text()); } catch (e) { aviso('Arquivo inválido: não é um .json de backup.', 'erro'); return; }
  const certs = Array.isArray(o && o.certs) ? o.certs.filter(c => c && typeof c === 'object') : [];
  const sig = o && typeof o.assinatura === 'string' && o.assinatura.startsWith('data:image') ? o.assinatura : '';
  if (!certs.length && !sig) { aviso('Este arquivo não tem certificados nem assinatura.', 'erro'); return; }
  const atuais = new Map(S.certs.map(c => [c.id, c]));
  const lista = certs.map(c => upgradeCert({ ...clone(c), id: String(c.id || uid()).replace(/[\/\\#?\[\]]+/g, '_') }));
  const novos = lista.filter(c => !atuais.has(c.id)).length;
  const maisNovos = lista.filter(c => atuais.has(c.id) && (c.alteradoEm || 0) > (atuais.get(c.id).alteradoEm || 0)).length;
  let ligados = 0;
  for (const c of lista) { if (!c.corridaId) { const cor = acharCorridaPeloTexto(c.corrida, c.dataEmissao); if (cor) { c.corridaId = cor.id; ligados++; } } }
  janela({
    titulo: 'Importar ' + arquivo.name,
    html: `<ul style="margin-top:0;padding-left:18px;line-height:1.7">
      ${certs.length ? `<li><label><input type="checkbox" id="imC" checked> <b>${certs.length} certificados</b>: ${novos} novos${maisNovos ? `, ${maisNovos} mais recentes que os do sistema` : ''}. ${ligados} serão ligados à corrida do Cálculo de Liga.</label></li>` : ''}
      ${sig ? `<li><label><input type="checkbox" id="imS" ${assinatura() ? '' : 'checked'}> Assinatura do arquivo${assinatura() ? ' (substitui a atual)' : ''}</label></li>` : ''}
      ${Array.isArray(o.ligas) && o.ligas.length ? `<li class="mut">As ${o.ligas.length} ligas do arquivo não são importadas: a conferência usa "Ligas e normas" do Cálculo de Liga.</li>` : ''}
    </ul><div id="progBkp" class="mut"></div>`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Importar', cls: 'pri', acao: async el => {
      const ops = [];
      if (el.querySelector('#imC') && el.querySelector('#imC').checked) {
        for (const c of lista) {
          const at = atuais.get(c.id);
          if (at && (c.alteradoEm || 0) <= (at.alteradoEm || 0)) continue;     // o do sistema é mais novo
          if (!c.ordem) c.ordem = Date.now();
          const { id, ...d } = c;
          ops.push({ col: COL.certs, id, dados: d });
        }
      }
      if (el.querySelector('#imS') && el.querySelector('#imS').checked) ops.push({ col: COL_LIGA.config, id: CFG_ID, dados: { ...(S.cfg ? (({ id, _em, _por, ...r }) => r)(S.cfg) : {}), assinatura: sig } });
      if (!ops.length) { aviso('Nada para importar.', 'erro'); return false; }
      el.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await banco.emLote(ops, (f, t) => { el.querySelector('#progBkp').textContent = `Gravando ${f} de ${t}…`; });
        aviso(`Importação concluída: ${ops.length} registros.`);
      } catch (e) { aviso('Erro na importação: ' + e.message, 'erro'); el.querySelectorAll('button').forEach(b => { b.disabled = false; }); return false; }
    } }],
  });
}
