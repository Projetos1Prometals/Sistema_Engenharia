// =====================================================================
//  almoxarifado_modelos/importar_planilha.js — lê a planilha Almoxarifado_Modelos (.xlsx)
//  Abas: "Modelos" (uma linha por posição de prateleira), "Mapa" (ordem das
//  ruas e vagas livres) e "Comercial" (ficha técnica dos refinadores).
//  Código repetido NÃO entra: fica a primeira ocorrência e as outras vão para os avisos.
// =====================================================================
import { idModelo, lerPosicao, lerVolumes, CAMPOS_COMERCIAIS } from './regras.js?v=2.0.1';

const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => res(window.XLSX);
    s.onerror = () => rej(new Error('Não foi possível carregar o leitor de planilhas (sem internet?).'));
    document.head.appendChild(s);
  });
}

const txt = v => (v == null ? '' : String(v).trim());
// cabeçalho normalizado: sem acento, só letras e números ("Código do Modelo" → CODIGODOMODELO)
const cab = v => txt(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function dataISO(v) {
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number' && v > 30000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000));
  if (!d || isNaN(d)) return '';
  return new Date(d.getTime() + 12 * 3600000).toISOString().slice(0, 10);
}
function aba(wb, XLSX, nome) {
  const n = wb.SheetNames.find(s => cab(s) === cab(nome));
  return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }) : null;
}
function acharCabecalho(L, ...obrig) {
  for (let i = 0; i < Math.min(L.length, 10); i++) {
    const h = (L[i] || []).map(cab);
    if (obrig.every(o => h.includes(o))) return { i, h, col: (...nomes) => h.findIndex(x => nomes.includes(x)) };
  }
  return null;
}
// valor da ficha comercial: número fica número, texto ("esp", "dev", "42X42X24 cm") fica texto
const valorFicha = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : txt(v));

export async function lerAlmoxarifado(arquivo) {
  const XLSX = await carregarSheetJS();
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true });
  const avisos = [];
  const modelos = new Map();          // id → modelo
  const ruas = new Map();             // letra → { letra, nivel, posicoes, ordem }
  const duplicados = [];

  const garantirRua = (letra, nivel) => {
    let r = ruas.get(letra);
    if (!r) { r = { letra, nivel: '', posicoes: 0, ordem: 100 + ruas.size }; ruas.set(letra, r); }
    if (nivel && !r.nivel) r.nivel = nivel;
    return r;
  };

  // ---------- Mapa: ordem das ruas, nível e vagas (inclusive as livres) ----------
  const M = aba(wb, XLSX, 'Mapa');
  if (M) {
    let ruaAtual = null, ordem = 0;
    for (const row of M) {
      const a = txt((row || [])[0]);
      const t = a.match(/^RUA\s+([A-Z]+)\b.*?(N[ií]vel\s*\d+)?$/i);
      if (t && !/NOVA/i.test(a)) { ruaAtual = garantirRua(t[1].toUpperCase(), t[2] ? t[2].replace(/^n[ií]vel/i, 'Nível') : ''); ruaAtual.ordem = ordem++; continue; }
      if (ruaAtual && cab(a) === 'POSICAO') {
        for (const v of (row || []).slice(1)) {
          const p = lerPosicao(v);
          if (p && p.rua === ruaAtual.letra) ruaAtual.posicoes = Math.max(ruaAtual.posicoes, p.n);
        }
      }
    }
  } else avisos.push('Aba "Mapa" não encontrada: as ruas ficam só com as posições da aba Modelos.');

  // ---------- Modelos: uma linha por posição ----------
  const L = aba(wb, XLSX, 'Modelos');
  let posicoes = 0, livres = 0;
  if (!L) avisos.push('Aba "Modelos" não encontrada.');
  else {
    const c = acharCabecalho(L, 'RUA', 'POSICAO');
    if (!c) avisos.push('Aba "Modelos": não achei o cabeçalho (Rua, Posição).');
    else {
      const cRua = c.col('RUA'), cPos = c.col('POSICAO'), cNiv = c.col('NIVEL'), cCod = c.col('CODIGODOMODELO', 'CODIGO');
      const cDesc = c.col('MEDIDADESCRICAO', 'DESCRICAO', 'MEDIDA'), cQtd = c.col('QTDVOL', 'QTD', 'VOLUMES');
      const cSt = c.col('STATUS', 'SITUACAO'), cData = c.col('DATADEENTRADA', 'DATA'), cObs = c.col('OBSERVACOES', 'OBS');
      for (let r = c.i + 1; r < L.length; r++) {
        const row = L[r] || [];
        const p = lerPosicao(row[cPos]);
        if (!p) continue;
        posicoes++;
        const rua = garantirRua(p.rua, txt(row[cNiv]));
        rua.posicoes = Math.max(rua.posicoes, p.n);
        let codigo = txt(row[cCod]);
        const descricao = txt(row[cDesc]);
        const status = txt(row[cSt]);
        if (codigo === '0') codigo = '';
        if (!codigo && !descricao) { livres++; continue; }                 // posição livre
        let semCodigo = false;
        if (!codigo) { codigo = descricao; semCodigo = true; }              // ex.: "CX CANAL 03", "CASTANHA"
        let id = idModelo(codigo);
        if (modelos.has(id)) {
          if (semCodigo) {                                                   // item sem código repetido: diferencia pela posição
            codigo = `${descricao} (${p.pos})`; id = idModelo(codigo);
          } else {
            duplicados.push({ codigo, pos: p.pos, ja: modelos.get(id).posicao, desc: descricao });
            continue;
          }
        }
        const historico = [];
        const data = dataISO(row[cData]), obs = txt(row[cObs]);
        if (data) historico.push({ data, tipo: /conclu/i.test(obs) ? 'voltou' : 'nota', obs: obs || 'Data de entrada na planilha', origem: 'planilha' });
        modelos.set(id, {
          id, codigo, semCodigo,
          descricao: semCodigo ? '' : descricao, volumes: lerVolumes(row[cQtd]),
          posicao: p.pos, situacao: /manuten/i.test(status) ? 'manutencao' : 'disponivel',
          obs: /conclu/i.test(obs) ? '' : obs, historico, comercial: null,
        });
      }
    }
  }
  if (duplicados.length) {
    duplicados.forEach(d => avisos.push(`Código ${d.codigo} (posição ${d.pos}${d.desc ? ', "' + d.desc + '"' : ''}) NÃO entrou: o código já está na posição ${d.ja}. Código não pode repetir.`));
  }
  const semCod = [...modelos.values()].filter(m => m.semCodigo);
  if (semCod.length) avisos.push(`${semCod.length} itens sem código entraram com a descrição no lugar do código: ${semCod.map(m => m.codigo.includes(m.posicao) ? m.codigo : `${m.codigo} (${m.posicao})`).join(", ")}.`);

  // ---------- Comercial: ficha técnica ----------
  const K = aba(wb, XLSX, 'Comercial');
  let comFicha = 0, soComercial = 0;
  if (K) {
    const c = acharCabecalho(K, 'CODIGO', 'DIAMETROPOL');
    if (!c) avisos.push('Aba "Comercial": não achei o cabeçalho (Diâmetro, Código).');
    else {
      const col = {
        diametro: c.col('DIAMETROPOL'), variacao: c.col('VARIACAO'), extensao: c.col('EXTENSAODISCO'),
        refinador: c.col('REFINADOR'), descRefinador: c.col('DESCRICAOREFINADOR'), area: c.col('AREAREFINADORA'),
        setores: c.col('QTDSETORES'), kmRev: c.col('KMREV'), segmentos: c.col('QTDSEGMENTOSDISCO'),
        discos: c.col('QTDDISCO'), embalagem: c.col('DIMENSAOEMBALAGEM'), peso: c.col('PESOEMBALAGEM'),
      };
      const cCod = c.col('CODIGO');
      const vistos = new Set();
      let ordem = 0;
      for (let r = c.i + 1; r < K.length; r++) {
        const row = K[r] || [];
        const codigo = txt(row[cCod]);
        if (!codigo) continue;
        const id = idModelo(codigo);
        if (vistos.has(id)) { avisos.push(`Comercial: código ${codigo} aparece mais de uma vez (linha ${r + 1}); ficou a primeira.`); continue; }
        vistos.add(id);
        const ficha = { ordem: ordem++ };
        for (const [k] of CAMPOS_COMERCIAIS) { const i = col[k]; if (i >= 0) { const v = valorFicha(row[i]); if (v !== '' && v != null) ficha[k] = v; } }
        let m = modelos.get(id);
        if (!m) {
          m = { id, codigo, descricao: txt(ficha.area), volumes: null, posicao: '', situacao: 'disponivel', obs: '', historico: [], comercial: null };
          modelos.set(id, m);
          soComercial++;
        }
        m.comercial = ficha;
        comFicha++;
      }
    }
  } else avisos.push('Aba "Comercial" não encontrada.');

  const lista = [...modelos.values()];
  return {
    modelos: lista,
    ruas: [...ruas.values()].sort((a, b) => a.ordem - b.ordem).map((r, i) => ({ ...r, ordem: i })),
    avisos,
    resumo: {
      posicoes, livres, modelos: lista.length,
      naPrateleira: lista.filter(m => m.posicao).length,
      manutencao: lista.filter(m => m.situacao === 'manutencao').length,
      comFicha, soComercial, duplicados: duplicados.length, semCodigo: semCod.length,
    },
  };
}
