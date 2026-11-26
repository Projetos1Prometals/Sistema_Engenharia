// =====================================================================
//  modelos-clientes/fotos.js — fotos dos modelos de clientes
//  Reduzidas no navegador (~1280 px, ~150 KB, JPEG) e guardadas com
//  banco.salvarArquivo (no Firebase, em pedaços na coleção eng_arquivos;
//  no modo local, IndexedDB). Id do arquivo sempre começa com "mcli_"
//  (o firestore.rules libera esses arquivos para quem edita este módulo).
// =====================================================================
import * as banco from '../comum/banco.js?v=1.7.1';

export const TIPOS_FOTO = { frente: 'Frente', traseira: 'Traseira', macho: 'Macho', outra: 'Outras' };
export const LADO_MAX = 1280;
export const TAMANHO_ALVO = 150 * 1024;

export const novoIdFoto = () => 'mcli_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function blobParaImg(b) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(b);
    const i = new Image();
    i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 1000); };
    i.onerror = e => { URL.revokeObjectURL(u); rej(e); };
    i.src = u;
  });
}

// Reduz para no máximo LADO_MAX px e tenta ficar abaixo de TAMANHO_ALVO (baixa a qualidade e, se preciso, o tamanho)
export async function reduzir(arquivo) {
  const img = await blobParaImg(arquivo);
  let lado = LADO_MAX, ultimo = null;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const s = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.72, 0.62, 0.52]) {
      ultimo = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
      if (ultimo && ultimo.size <= TAMANHO_ALVO) return ultimo;
    }
    lado = Math.round(lado * 0.8);
  }
  return ultimo;
}

const cache = new Map();   // id → Promise<url|null>

// Envia as fotos; devolve os ids. aoProgresso(i, total)
export async function enviarFotos(arquivos, aoProgresso) {
  const ids = [];
  for (let i = 0; i < arquivos.length; i++) {
    aoProgresso && aoProgresso(i + 1, arquivos.length);
    let blob;
    try { blob = await reduzir(arquivos[i]); }
    catch (e) { throw new Error(`"${arquivos[i].name}" não pôde ser lida. Use fotos JPG ou PNG.`); }
    const id = novoIdFoto();
    await banco.salvarArquivo(id, new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    cache.set(id, Promise.resolve(URL.createObjectURL(blob)));
    ids.push(id);
  }
  return ids;
}

export function urlFoto(id) {
  if (!cache.has(id)) {
    cache.set(id, banco.lerArquivo(id).then(b => (b ? URL.createObjectURL(b) : null)).catch(e => { console.warn('foto', id, e); cache.delete(id); return null; }));
  }
  return cache.get(id);
}

// Carrega as <img data-foto="id"> que ainda não têm imagem. Devolve quando todas terminarem.
export function preencherFotos(raiz = document) {
  return Promise.all([...raiz.querySelectorAll('img[data-foto]:not([src])')].map(async img => {
    const u = await urlFoto(img.dataset.foto);
    if (u) img.src = u;
    else { img.classList.add('sem-foto'); img.alt = 'Foto indisponível'; }
  }));
}

export async function apagarFoto(id) {
  cache.delete(id);
  await banco.apagarArquivo(id);
}
