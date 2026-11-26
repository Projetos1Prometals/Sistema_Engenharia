// =====================================================================
//  modelos-clientes/instrucao.js — leitura da Instrução de Processo (Supabase)
//  Pedido do usuário: as IPs com "Destino do molde" = "Retorno para o cliente"
//  sobem para os Modelos de clientes. O app da Instrução guarda tudo na tabela
//  "kv" (só lê quem faz login): "ip:<n>:data" = JSON da IP (peca.cliente,
//  peca.codigo, peca.descricao, peca.liga, peca.data, peca.destino),
//  "cfg:ips" = lista com cli/cod/desc/liga mais recentes,
//  "p:<n>:<foto>" = foto em dataURL (caixa_frente, caixa_traseira, macho).
//  Só lê: nada é gravado na Instrução de Processo.
// =====================================================================
const SUPA_URL = 'https://etvoolebvbycbqoclyyz.supabase.co';
const SUPA_KEY = 'sb_publishable_7rMCjL5sultiZ7lFqZm_Gw_Qc9k7SAJ';   // chave pública (a mesma do app da Instrução)
const SUPA_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

export const DESTINO_CLIENTE = 'Retorno para o cliente';
// foto da Instrução → tipo da foto aqui
export const FOTOS_IP = { caixa_frente: 'frente', caixa_traseira: 'traseira', macho: 'macho' };

let carregando = null;
function carregarSupabase() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  if (!carregando) carregando = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SUPA_JS;
    s.onload = () => res();
    s.onerror = () => { carregando = null; rej(new Error('não foi possível carregar o Supabase (sem internet?)')); };
    document.head.appendChild(s);
  });
  return carregando;
}

// Login na Instrução de Processo; devolve o cliente do Supabase (sessão só na memória desta página)
export async function entrarInstrucao(email, senha) {
  await carregarSupabase();
  const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'pmt-instrucao-leitura' },
  });
  const { error } = await supa.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'e-mail ou senha da Instrução de Processo errados' : error.message);
  return supa;
}

async function listar(supa, prefixo) {
  const out = [], pag = 500;
  for (let de = 0; ; de += pag) {
    const { data, error } = await supa.from('kv').select('key,value').like('key', prefixo + '%').range(de, de + pag - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pag) break;
  }
  return out;
}
async function ler(supa, chave) {
  const { data, error } = await supa.from('kv').select('value').eq('key', chave).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
const json = v => { try { return typeof v === 'string' ? JSON.parse(v) : v || null; } catch { return null; } };
const txt = v => String(v ?? '').trim();

// IPs de cliente: [{ n, codigo, cliente, descricao, liga, data }]
export async function ipsDeCliente(supa) {
  const lista = json(await ler(supa, 'cfg:ips')) || [];
  const meta = new Map(lista.map(x => [Number(x.n), x]));
  const out = [];
  for (const { key, value } of await listar(supa, 'ip:')) {
    const m = /^ip:(\d+):data$/.exec(key);
    if (!m) continue;
    const d = json(value);
    if (!d) continue;
    const p = d.peca || {};
    const campo = f => txt(d['peca.' + f] ?? p[f]);
    let destino = campo('destino');
    if (destino === 'Volta para o dono') destino = DESTINO_CLIENTE;
    if (destino !== DESTINO_CLIENTE) continue;
    const n = Number(m[1]), x = meta.get(n) || {};
    out.push({
      n,
      codigo: txt(x.cod) || campo('codigo'),
      cliente: txt(x.cli) || campo('cliente'),
      descricao: txt(x.desc) || campo('descricao'),
      liga: txt(x.liga) || campo('liga'),
      data: campo('data') || txt(x.ini),
    });
  }
  return out.sort((a, b) => a.n - b.n);
}

// Foto da IP como Blob (ou null se não tiver)
export async function fotoDaIP(supa, n, slot) {
  const v = await ler(supa, `p:${n}:${slot}`);
  if (!v || !String(v).startsWith('data:')) return null;
  return (await fetch(v)).blob();
}
