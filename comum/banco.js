// =====================================================================
//  comum/banco.js — conexão com o banco de dados do Sistema Engenharia
//
//  - Se o config.js estiver preenchido com o bloco do Firebase, usa o
//    Firebase (Firestore + login por e-mail/senha), com cache offline.
//  - Se o config.js ainda estiver vazio, entra em "modo local": os dados
//    ficam só neste navegador (bom para testar antes de configurar).
//
//  Todas as coleções da Engenharia começam com "eng_" para poderem
//  conviver no mesmo projeto Firebase de outros sistemas (PCP etc.).
// =====================================================================

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
const RAIZ = new URL('../', import.meta.url);

let estado = null;
const ouvintesEstado = new Set();
let pendentes = 0;

export function raiz(caminho = '') { return new URL(caminho, RAIZ).href; }
export function modo() { return estado ? estado.modo : null; }
export function usuario() { return estado ? estado.usuario : null; }
export function aoMudarEstado(fn) { ouvintesEstado.add(fn); return () => ouvintesEstado.delete(fn); }
function avisar() { const s = situacao(); ouvintesEstado.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } }); }
export function situacao() {
  return { modo: modo(), usuario: usuario(), online: navigator.onLine, pendentes };
}
window.addEventListener('online', avisar);
window.addEventListener('offline', avisar);

// ---------- leitura do config.js (aceita o bloco colado do console) ----------
async function lerConfig() {
  try {
    const r = await fetch(raiz('config.js') + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    let txt = await r.text();
    txt = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const cfg = {};
    const re = /(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)\s*:\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(txt))) cfg[m[1]] = m[2].trim();
    if (!cfg.apiKey || !cfg.projectId || /COLE|SEU[-_ ]/i.test(cfg.apiKey + ' ' + cfg.projectId)) return null;
    return cfg;
  } catch (e) {
    return null;
  }
}

function resumoUsuario(u) {
  if (!u) return null;
  const email = u.email || '';
  return { uid: u.uid, email, nome: (u.displayName || email.split('@')[0] || '').replace(/[._]/g, ' ') };
}

// ---------- inicialização ----------
export async function iniciar() {
  if (estado) return estado;
  const forcarLocal = localStorage.getItem('pmt_modo') === 'local';
  const cfg = forcarLocal ? null : await lerConfig();
  if (!cfg) {
    estado = { modo: 'local', usuario: { uid: 'local', email: 'modo local', nome: 'Modo local' } };
    avisar();
    return estado;
  }
  const [appM, authM, fsM] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = appM.initializeApp(cfg);
  const auth = authM.getAuth(app);
  let db;
  try {
    db = fsM.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn('Cache offline indisponível, seguindo sem ele:', e);
    db = fsM.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  // Só para testes no computador do desenvolvedor (emulador do Firebase).
  const emu = localStorage.getItem('pmt_emulador');
  if (emu) {
    authM.connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
    fsM.connectFirestoreEmulator(db, emu, 8085);
  }
  const primeiro = await new Promise(res => {
    const off = authM.onAuthStateChanged(auth, u => { off(); res(u); });
  });
  estado = { modo: 'firebase', cfg, app, auth, db, authM, fsM, usuario: resumoUsuario(primeiro) };
  authM.onAuthStateChanged(auth, u => { estado.usuario = resumoUsuario(u); avisar(); });
  avisar();
  return estado;
}

// ---------- login ----------
export async function entrar(email, senha) {
  await iniciar();
  if (estado.modo !== 'firebase') return estado.usuario;
  const r = await estado.authM.signInWithEmailAndPassword(estado.auth, email.trim(), senha);
  estado.usuario = resumoUsuario(r.user);
  avisar();
  return estado.usuario;
}
export async function sair() {
  if (estado && estado.modo === 'firebase') await estado.authM.signOut(estado.auth);
}
export async function redefinirSenha(email) {
  await iniciar();
  if (estado.modo !== 'firebase') return;
  await estado.authM.sendPasswordResetEmail(estado.auth, email.trim());
}
export function mensagemErroLogin(e) {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'E-mail ou senha incorretos.';
  if (/too-many-requests/.test(c)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (/network/.test(c)) return 'Sem conexão com a internet.';
  return 'Não foi possível entrar (' + (c || (e && e.message) || 'erro') + ').';
}

// ---------- modo local (localStorage) ----------
const LKEY = col => 'pmt_local:' + col;
const ouvintesLocais = {};
function lerLocal(col) {
  try { return JSON.parse(localStorage.getItem(LKEY(col)) || '{}'); } catch { return {}; }
}
function gravarLocal(col, obj) {
  localStorage.setItem(LKEY(col), JSON.stringify(obj));
  dispararLocal(col);
}
function dispararLocal(col) {
  const obj = lerLocal(col);
  const lista = Object.keys(obj).map(id => ({ id, ...obj[id] }));
  (ouvintesLocais[col] || []).forEach(fn => fn(lista, obj));
}
window.addEventListener('storage', e => {
  if (e.key && e.key.startsWith('pmt_local:')) dispararLocal(e.key.slice(10));
});

function carimbo(dados) {
  const u = usuario();
  return { ...limpar(dados), _em: new Date().toISOString(), _por: u ? u.email : '' };
}
// Remove undefined e NaN (o Firestore não aceita), recursivamente.
function limpar(v) {
  if (Array.isArray(v)) return v.map(limpar);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = {};
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (x === undefined || (typeof x === 'number' && !isFinite(x))) continue;
      o[k] = limpar(x);
    }
    return o;
  }
  return v;
}

function contar(p) {
  pendentes++; avisar();
  return p.finally(() => { pendentes = Math.max(0, pendentes - 1); avisar(); });
}

// ---------- API usada pelos módulos ----------

// Ouve uma coleção inteira. cb(lista, info) é chamado na hora e a cada mudança.
// info.doCache = true quando os dados vieram só do cache do computador
// (ainda não confirmados pelo servidor).
export function ouvirColecao(col, cb, aoErro) {
  if (estado.modo === 'local') {
    const f = lista => cb(lista, { doCache: false });
    (ouvintesLocais[col] = ouvintesLocais[col] || []).push(f);
    setTimeout(() => dispararLocal(col), 0);
    return () => { ouvintesLocais[col] = (ouvintesLocais[col] || []).filter(x => x !== f); };
  }
  const { fsM, db } = estado;
  return fsM.onSnapshot(fsM.collection(db, col), { includeMetadataChanges: true },
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })), { doCache: snap.metadata.fromCache }),
    err => { console.error('Erro ao ouvir', col, err); aoErro && aoErro(err); });
}

export function ouvirDoc(col, id, cb, aoErro) {
  if (estado.modo === 'local') {
    const f = (lista, obj) => cb(obj[id] ? { id, ...obj[id] } : null, { doCache: false });
    (ouvintesLocais[col] = ouvintesLocais[col] || []).push(f);
    setTimeout(() => dispararLocal(col), 0);
    return () => { ouvintesLocais[col] = (ouvintesLocais[col] || []).filter(x => x !== f); };
  }
  const { fsM, db } = estado;
  return fsM.onSnapshot(fsM.doc(db, col, id), { includeMetadataChanges: true },
    d => cb(d.exists() ? { id: d.id, ...d.data() } : null, { doCache: d.metadata.fromCache }),
    err => { console.error('Erro ao ouvir', col, id, err); aoErro && aoErro(err); });
}

export async function lerColecao(col) {
  if (estado.modo === 'local') {
    const obj = lerLocal(col);
    return Object.keys(obj).map(id => ({ id, ...obj[id] }));
  }
  const { fsM, db } = estado;
  const snap = await fsM.getDocs(fsM.collection(db, col));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Grava o documento inteiro (substitui o que havia).
// Não espere o retorno para seguir: sem internet, a gravação fica na fila
// e o Firebase envia sozinho quando a conexão voltar.
export function salvar(col, id, dados) {
  const d = carimbo(dados);
  delete d.id;
  if (estado.modo === 'local') {
    const obj = lerLocal(col); obj[id] = d; gravarLocal(col, obj);
    return Promise.resolve();
  }
  const { fsM, db } = estado;
  return contar(fsM.setDoc(fsM.doc(db, col, id), d));
}

export function apagar(col, id) {
  if (estado.modo === 'local') {
    const obj = lerLocal(col); delete obj[id]; gravarLocal(col, obj);
    return Promise.resolve();
  }
  const { fsM, db } = estado;
  return contar(fsM.deleteDoc(fsM.doc(db, col, id)));
}

// Várias gravações de uma vez: ops = [{col, id, dados}] ou [{col, id, apagar:true}]
export async function emLote(ops, aoProgresso) {
  if (estado.modo === 'local') {
    const porCol = {};
    for (const op of ops) {
      const obj = porCol[op.col] || (porCol[op.col] = lerLocal(op.col));
      if (op.apagar) delete obj[op.id];
      else { const d = carimbo(op.dados); delete d.id; obj[op.id] = d; }
    }
    Object.keys(porCol).forEach(c => gravarLocal(c, porCol[c]));
    aoProgresso && aoProgresso(ops.length, ops.length);
    return;
  }
  const { fsM, db } = estado;
  let feitos = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const lote = fsM.writeBatch(db);
    for (const op of ops.slice(i, i + 400)) {
      const ref = fsM.doc(db, op.col, op.id);
      if (op.apagar) lote.delete(ref);
      else { const d = carimbo(op.dados); delete d.id; lote.set(ref, d); }
    }
    // Sem internet o commit só termina quando a conexão volta. A gravação já fica
    // guardada no computador e é enviada sozinha depois, então não travamos a tela.
    const p = contar(lote.commit());
    if (navigator.onLine) await Promise.race([p, new Promise(r => setTimeout(r, 15000))]);
    feitos += Math.min(400, ops.length - i);
    aoProgresso && aoProgresso(feitos, ops.length);
  }
}

// Identificador seguro para usar como id de documento.
export function idSeguro(texto) {
  return String(texto == null ? '' : texto).trim().replace(/[\/\\#?\[\]]+/g, '_').replace(/\s+/g, ' ').slice(0, 140) || ('x' + Date.now());
}

// ---------- arquivos (PDF dos desenhos etc.) ----------
// Firebase: o arquivo é picado em pedaços dentro do próprio Firestore (coleção eng_arquivos),
// porque o Storage do Firebase exige o plano pago. Cada pedaço fica bem abaixo do limite de 1 MB por documento.
// Modo local: fica no IndexedDB do navegador.
const COL_ARQ = 'eng_arquivos';
const PEDACO = 700 * 1024;          // caracteres de base64 por documento
export const ARQUIVO_MAX = 20 * 1024 * 1024;

function abrirIDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('pmt_arquivos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(modo, fn) {
  const db = await abrirIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('arquivos', modo);
    const r = fn(tx.objectStore('arquivos'));
    tx.oncomplete = () => res(r && r.result);
    tx.onerror = () => rej(tx.error);
  });
}
const paraBase64 = blob => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1] || '');
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(blob);
});
function deBase64(b64, tipo) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: tipo || 'application/octet-stream' });
}

// Guarda o arquivo com a chave "id" (ex.: "modelo_1171"). Devolve {nome, tipo, tamanho, em}.
export async function salvarArquivo(id, arquivo) {
  if (arquivo.size > ARQUIVO_MAX) throw new Error(`arquivo maior que ${Math.round(ARQUIVO_MAX / 1048576)} MB`);
  const meta = { nome: arquivo.name || 'arquivo', tipo: arquivo.type || 'application/octet-stream', tamanho: arquivo.size, em: new Date().toISOString() };
  if (estado.modo === 'local') {
    await idb('readwrite', s => s.put({ meta, blob: arquivo }, id));
    return meta;
  }
  const b64 = await paraBase64(arquivo);
  const partes = Math.max(1, Math.ceil(b64.length / PEDACO));
  const antigo = await lerMetaArquivo(id);
  const ops = [{ col: COL_ARQ, id, dados: { ...meta, partes } }];
  for (let i = 0; i < partes; i++) ops.push({ col: COL_ARQ, id: `${id}__${i}`, dados: { dados: b64.slice(i * PEDACO, (i + 1) * PEDACO) } });
  for (let i = partes; antigo && i < (antigo.partes || 0); i++) ops.push({ col: COL_ARQ, id: `${id}__${i}`, apagar: true });
  // um lote por pedaço, para não passar do limite de tamanho do lote do Firestore
  for (const op of ops) await emLote([op]);
  return meta;
}
async function lerMetaArquivo(id) {
  const { fsM, db } = estado;
  const d = await fsM.getDoc(fsM.doc(db, COL_ARQ, id));
  return d.exists() ? d.data() : null;
}
// Devolve um Blob (ou null se não existir).
export async function lerArquivo(id) {
  if (estado.modo === 'local') {
    const r = await idb('readonly', s => s.get(id));
    return r ? r.blob : null;
  }
  const { fsM, db } = estado;
  const meta = await lerMetaArquivo(id);
  if (!meta) return null;
  const partes = await Promise.all(Array.from({ length: meta.partes || 1 }, (_, i) => fsM.getDoc(fsM.doc(db, COL_ARQ, `${id}__${i}`))));
  return deBase64(partes.map(p => (p.exists() ? p.data().dados : '')).join(''), meta.tipo);
}
export async function apagarArquivo(id) {
  if (estado.modo === 'local') { await idb('readwrite', s => s.delete(id)); return; }
  const meta = await lerMetaArquivo(id);
  const ops = [{ col: COL_ARQ, id, apagar: true }];
  for (let i = 0; meta && i < (meta.partes || 0); i++) ops.push({ col: COL_ARQ, id: `${id}__${i}`, apagar: true });
  await emLote(ops);
}
