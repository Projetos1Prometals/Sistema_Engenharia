// =====================================================================
//  liga/amostras.js — impressos das amostras do dia (sem banco)
//   - Etiqueta do saquinho das amostras do dia (10 x 5 cm): corridas, material, data
//   - Etiqueta do retorno (10 x 5 cm), uma por corrida: corrida, material, data, peso, cor
//   - Formulário A4 do laboratório (Priner, LT-FO-023): uma linha por corrida
// =====================================================================

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
// "2026-09-11" → "11/SET/2026"
export const dataEtiqueta = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${MESES[+m[2] - 1]}/${m[1]}` : ''; };
// "2026-09-11" → "11/09/2026"
const dataBR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
// corrida do refratário 70, anual 192 → "70 - 192"
export const corridaEtiqueta = c => `${c.refratario ?? '?'} - ${c.anual ?? '?'}`;
const material = c => String(c.liga || '').toUpperCase();

export const PRINER_PADRAO = {
  empresa: 'PROMETALS (TM GASTÃO)', contato: 'Anderson', telefone: '19-98888-8275', vendedor: '',
  emailNF: 'fiscal@prometals.co', emailRelatorio: 'anderson@prometals.co projetos1@prometals.co qualidade1@prometals.co',
  ensaio: 'ANÁLISE QUÍMICA', norma: '',
  destruir: '', acompanhar: '', destino: '', infoAdicional: '',
  formCodigo: 'LT-FO-023', formRevisao: '26', formData: '28/01/2026',
  rodape: "Filial Santa Bárbara D’Oeste · Rua Bárbara Rosa Vital, nº 89, Centro Industrial e Tecnológico (CINTEC) - Santa Bárbara d'Oeste – SP · CEP 13.459-626 · 19 3463-5436 · contato@priner.com.br · www.priner.com.br",
};

// ---------- etiqueta do saquinho (até 4 corridas por etiqueta) ----------
export const POR_ETIQUETA = 4;
export function etiquetasSaquinho(corridas, data) {
  const grupos = [];
  for (let i = 0; i < corridas.length; i += POR_ETIQUETA) grupos.push(corridas.slice(i, i + POR_ETIQUETA));
  return grupos.map(g => `<div class="etq etq-saq">
    <div class="etq-cab"><span>Corrida</span><span>Material</span><span>Data</span></div>
    ${g.map((c, i) => {
      const mat = material(c), antes = i > 0 ? material(g[i - 1]) : null;
      return `<div class="etq-lin"><b>${esc(corridaEtiqueta(c))}</b><b class="etq-mat">${mat !== antes ? esc(mat) : ''}</b><b class="etq-data">${i === 0 ? esc(dataEtiqueta(data)) : ''}</b></div>`;
    }).join('')}
  </div>`);
}

// ---------- etiqueta do retorno (uma por corrida) ----------
export function etiquetaRetorno(c, cor) {
  return `<div class="etq etq-ret">
    <div class="etq-cab"><span>Corrida</span><span>Material</span><span>Data</span></div>
    <div class="etq-lin grande"><b>${esc(corridaEtiqueta(c))}</b><b class="etq-mat">${esc(material(c))}</b><b class="etq-data">${esc(dataEtiqueta(c.data))}</b></div>
    <div class="etq-peso">Peso:</div>
    <div class="etq-cor">COR: ${cor ? esc(cor) : '<span class="etq-branco"></span>'}</div>
  </div>`;
}

// ---------- formulário A4 do laboratório ----------
export function formularioPriner(corridas, data, p) {
  p = { ...PRINER_PADRAO, ...(p || {}) };
  const marca = (v, op) => `(${v === op ? '&nbsp;X&nbsp;' : '&nbsp;&nbsp;&nbsp;&nbsp;'})`;
  const linhas = corridas.map((c, i) => ({ n: i + 1, id: 'CORRIDA ' + corridaEtiqueta(c).replace(/\s/g, ''), mat: material(c), ens: p.ensaio, norma: p.norma }));
  while (linhas.length < 9) linhas.push({ n: linhas.length + 1, id: '', mat: '', ens: '', norma: '' });
  return `<div class="fpr">
    <table class="fpr-cab"><tr>
      <td class="fpr-tit" rowspan="2">Solicitação e Autorização de Serviços de Análises e Ensaios de Materiais</td>
      <td><b>Código:</b> ${esc(p.formCodigo)}</td><td><b>Revisão:</b> ${esc(p.formRevisao)}</td></tr>
      <tr><td><b>Data:</b> ${esc(p.formData)}</td><td><b>Pág.</b> 1/1</td></tr></table>

    <table class="fpr-t">
      <colgroup><col style="width:13%"><col style="width:12%"><col style="width:12%"><col style="width:26%"><col style="width:17%"><col style="width:20%"></colgroup>
      <tr><th>DATA:</th><td>${esc(dataBR(data))}</td><th>EMPRESA:</th><td>${esc(p.empresa)}</td><th>CÓDIGO:<small>(Preenchimento pelo Labteste)</small></th><td></td></tr>
      <tr><th>CONTATO:</th><td>${esc(p.contato)}</td><th>TELEFONE:</th><td>${esc(p.telefone)}</td><th>VENDEDOR:</th><td>${esc(p.vendedor)}</td></tr>
      <tr><th colspan="2">E-MAIL PARA ENVIO DE NF:</th><td colspan="2">${esc(p.emailNF)}</td><th>NF DE ENTRADA:<small>(Preenchimento pelo Labteste)</small></th><td></td></tr>
      <tr><th colspan="2">E-MAIL PARA ENVIO DE RELATÓRIO:</th><td colspan="2">${esc(p.emailRelatorio)}</td><th>ORÇAMENTO N°:</th><td></td></tr>
    </table>

    <div class="fpr-sec">IDENTIFICAÇÃO DAS AMOSTRAS PARA ANÁLISES / ENSAIOS</div>
    <table class="fpr-t fpr-itens">
      <colgroup><col style="width:7%"><col style="width:23%"><col style="width:17%"><col style="width:23%"><col style="width:15%"><col style="width:15%"></colgroup>
      <tr><th>ITEM*</th><th>IDENTIFICAÇÃO DA AMOSTRA<small>(Identificação que deverá constar no relatório. Ex: nome da amostra, corrida, lote, etc)</small></th>
        <th>MATERIAL<small>(Material da amostra. Ex: SAE 1045, SAE 4140, Inox 304, ASTM A36)</small></th>
        <th>ENSAIO(S) / ANÁLISE(S) A REALIZAR<small>(Ex: Análise química, ensaio de tração, ensaio de dureza, ensaio de dobramento, análise micrográfica, etc)</small></th>
        <th>NORMA DE ENSAIO<small>(Ex: ASTM A370, ASTM A751, ISO 6892, etc)</small></th><th>O.S.<small>(Preenchimento pelo Labteste)</small></th></tr>
      ${linhas.map(l => `<tr><td class="c">${l.n}</td><td class="c"><b>${esc(l.id)}</b></td><td class="c"><b>${esc(l.mat)}</b></td><td class="c">${esc(l.ens)}</td><td class="c">${esc(l.norma)}</td><td></td></tr>`).join('')}
    </table>
    <p class="fpr-nota">* Considerar 1 item por amostra (Inserir mais itens se necessário).</p>

    <div class="fpr-sec">INFORMAÇÕES IMPORTANTES</div>
    <table class="fpr-t">
      <colgroup><col style="width:62%"><col></colgroup>
      <tr><th class="e">As amostras podem ser destruídas (cortadas, lixadas, etc)?</th><td>${marca(p.destruir, 'SIM')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${marca(p.destruir, 'NAO')} NÃO</td></tr>
      <tr><th class="e">Haverá acompanhamento das análises/ensaios? (Deverá ser agendado previamente)</th><td>${marca(p.acompanhar, 'SIM')} SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${marca(p.acompanhar, 'NAO')} NÃO</td></tr>
      <tr><th class="e">Após o ensaio, as amostras serão descartadas ou retiradas? (As amostras ficarão disponíveis para retirada por 30 dias, após esse período, serão descartadas sem aviso prévio)</th><td>${marca(p.destino, 'DESCARTADAS')} DESCARTADAS &nbsp;&nbsp; ${marca(p.destino, 'RETIRADAS')} RETIRADAS</td></tr>
      <tr><th class="e">Informações adicionais:<small>Ex: Temp. (°C) do ensaio de charpy, interesse na micrografia, etc.</small></th><td>${esc(p.infoAdicional)}</td></tr>
    </table>

    <div class="fpr-sec">ANÁLISE CRÍTICA</div>
    <table class="fpr-t">
      <colgroup><col style="width:40%"><col style="width:35%"><col style="width:8%"><col></colgroup>
      <tr><th class="e">RESPONSÁVEL PELA ANÁLISE CRÍTICA:<small>(Preenchimento pelo Labteste)</small></th><td></td><th>DATA:</th><td></td></tr>
      <tr><th class="e">RESPONSÁVEL PELA ABERTURA DA O.S:<small>(Preenchimento pelo Labteste)</small></th><td></td><th>DATA:</th><td></td></tr>
    </table>
    <div class="fpr-rod">${esc(p.rodape)}</div>
  </div>`;
}
