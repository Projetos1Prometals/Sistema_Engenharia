// =====================================================================
//  sistema/usuarios_acessos/usuarios_acessos.js — Usuários e acessos (só o administrador).
//  Para cada pessoa, cada tela do menu: Sem acesso / Só ver / Editar.
//  Grava em eng_acessos (id = e-mail em minúsculas); o firestore.rules lê
//  a mesma coleção, então o bloqueio vale de verdade no banco.
// =====================================================================
import * as banco from '../../comum/banco.js?v=2.0.2';
import { montar, aviso, janela, esc, icone, ehAdmin, semAcesso, TELAS, ADMINS, COL_ACESSOS, RESTRINGIR } from '../../comum/casca.js?v=2.0.2';

await montar({ ativo: 'usuarios', trilha: ['Sistema', 'Usuários e acessos'] });
const C = document.getElementById('conteudo');
let usuarios = [];

const ROTULO = { '': 'Sem acesso', ver: 'Só ver', editar: 'Editar' };
const normEmail = s => String(s || '').trim().toLowerCase();
const nomeDe = u => u.nome || u.email.split('@')[0];

if (!ehAdmin()) semAcesso(C);
else {
  C.innerHTML = '<div class="vazio">Carregando…</div>';
  banco.ouvirColecao(COL_ACESSOS, l => {
    usuarios = l.filter(u => u.email && !ADMINS.includes(normEmail(u.email)))
      .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt'));
    pintar();
  }, e => { C.innerHTML = `<div class="faixa verm">Erro ao ler os usuários: ${esc(e.message || e.code)}</div>`; });
}

function pintar() {
  const foco = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.cel;
  let grupo = '';
  const linhas = TELAS.map(t => {
    const cab = t.grupo !== grupo ? `<tr class="grupo"><td colspan="${usuarios.length + 2}">${esc(grupo = t.grupo)}</td></tr>` : '';
    return cab + `<tr>
      <td class="tela"><b>${esc(t.nome)}</b>${t.dica ? `<small>${esc(t.dica)}</small>` : ''}</td>
      <td class="cel"><span class="fixo">Editar</span></td>
      ${usuarios.map((u, i) => {
        const v = (u.telas || {})[t.id] || '';
        return `<td class="cel"><select class="ent niv-${v}" data-cel="${i}:${t.id}">
          ${['', ...t.niveis].map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${n === 'editar' && t.id === 'manutencao' ? 'Pode registrar' : ROTULO[n]}</option>`).join('')}
        </select></td>`;
      }).join('')}
    </tr>`;
  }).join('');

  C.innerHTML = `
    <div class="cab">
      <div class="cresce"><h1 class="titulo">Usuários e acessos</h1>
        <p class="sub">O que cada pessoa vê e edita. Muda na hora: a pessoa só precisa recarregar a página (F5). Quem não está aqui não acessa nada.</p></div>
      <button class="btn pri" id="btNovo">${icone('mais')} Novo usuário</button>
    </div>
    ${RESTRINGIR ? '' : `<div class="faixa">Por enquanto <b>todos que entram veem e editam tudo</b> (menos esta tela): o que estiver marcado aqui
      só passa a valer quando a restrição for ligada (RESTRINGIR em comum/casca.js + firestore.rules publicado).</div>`}
    <div class="legenda-ac">
      <span><b class="e">Editar</b>: vê e altera</span>
      <span><b class="v">Só ver</b>: consulta e imprime, sem alterar</span>
      <span><b>Sem acesso</b>: a tela some do menu</span>
      <span>Clique no nome da pessoa para mudar tudo de uma vez, mandar o e-mail da senha ou remover.</span>
    </div>
    <div class="cartao"><div class="tab-wrap">
      <table class="tab tab-acessos"><thead><tr>
        <th>Tela</th>
        <th class="usr adm" title="Administrador: vê e edita tudo, e é o único que mexe nesta tela"><b>Administrador</b><small>${esc(ADMINS.join(', '))}</small></th>
        ${usuarios.map((u, i) => `<th class="usr" data-usr="${i}" title="Clique para mais opções"><b>${esc(nomeDe(u))}</b><small>${esc(u.email)}</small></th>`).join('')}
      </tr></thead><tbody>${linhas}</tbody></table>
    </div></div>
    ${usuarios.length ? '' : '<div class="vazio">Nenhum usuário além do administrador. Clique em <b>Novo usuário</b>.</div>'}`;

  C.querySelector('#btNovo').onclick = novoUsuario;
  C.querySelectorAll('[data-usr]').forEach(th => { th.onclick = () => opcoesUsuario(usuarios[+th.dataset.usr]); });
  C.querySelectorAll('[data-cel]').forEach(sel => {
    sel.onchange = () => {
      const [i, tela] = sel.dataset.cel.split(':');
      const u = usuarios[+i];
      const telas = { ...(u.telas || {}) };
      if (sel.value) telas[tela] = sel.value; else delete telas[tela];
      sel.className = 'ent niv-' + sel.value;
      gravar(u, telas).then(() => aviso(`${nomeDe(u)}: ${TELAS.find(t => t.id === tela).nome} → ${sel.options[sel.selectedIndex].text}.`));
    };
  });
  if (foco) { const s = C.querySelector(`[data-cel="${foco}"]`); if (s) s.focus(); }
}

function gravar(u, telas, nome = u.nome) {
  const email = normEmail(u.email);
  return banco.salvar(COL_ACESSOS, email, { email, nome: nome || '', telas })
    .catch(e => { aviso('Erro ao salvar: ' + e.message, 'erro'); throw e; });
}

// Todas as telas no nível pedido ('' / 'ver' / 'editar'), respeitando o que cada tela permite
function tudo(nivel) {
  const t = {};
  for (const x of TELAS) {
    const n = nivel === 'editar' ? x.niveis[x.niveis.length - 1] : nivel === 'ver' && x.niveis.includes('ver') ? 'ver' : '';
    if (n) t[x.id] = n;
  }
  return t;
}

function novoUsuario() {
  const fb = banco.modo() === 'firebase';
  janela({
    titulo: 'Novo usuário',
    html: `<div class="linha-campos">
        <label class="campo">E-mail<input class="ent" id="nEmail" type="email" placeholder="ex.: almoxarifado@prometals.co"></label>
        <label class="campo">Nome (opcional)<input class="ent" id="nNome" placeholder="ex.: Almoxarifado"></label>
      </div>
      <label class="campo" style="margin-top:12px">Começar com os acessos de
        <select class="ent" id="nBase">
          <option value="ver">Só ver todas as telas</option>
          <option value="">Nenhum acesso (marco depois)</option>
          ${usuarios.map((u, i) => `<option value="u${i}">Igual a ${esc(nomeDe(u))} (${esc(u.email)})</option>`).join('')}
        </select></label>
      ${fb ? `<h4 style="margin:18px 0 6px">Login</h4>
        <label style="display:flex;gap:8px;align-items:center;font-size:13.5px"><input type="checkbox" id="nCriar" checked> Criar o login desta pessoa agora</label>
        <label class="campo" style="margin-top:10px">Senha provisória (mín. 6 caracteres)<input class="ent" id="nSenha" type="text" autocomplete="off" placeholder="em branco: a pessoa recebe um e-mail para criar a senha"></label>
        <p class="mut" style="margin-bottom:0;font-size:12.5px">Se o login já existir (por exemplo, criado no Firebase), só os acessos são gravados.</p>` : ''}`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Criar usuário', cls: 'pri', acao: async el => {
      const email = normEmail(el.querySelector('#nEmail').value);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { aviso('Digite um e-mail válido.', 'erro'); return false; }
      if (ADMINS.includes(email)) { aviso('Este é o administrador: já tem acesso a tudo.', 'erro'); return false; }
      if (usuarios.some(u => normEmail(u.email) === email)) { aviso('Esse e-mail já está na lista.', 'erro'); return false; }
      const base = el.querySelector('#nBase').value;
      const telas = base.startsWith('u') ? { ...(usuarios[+base.slice(1)].telas || {}) } : tudo(base);
      const nome = el.querySelector('#nNome').value.trim();
      let msgLogin = '';
      if (fb && el.querySelector('#nCriar').checked) {
        const senha = el.querySelector('#nSenha').value;
        if (senha && senha.length < 6) { aviso('A senha precisa de pelo menos 6 caracteres.', 'erro'); return false; }
        el.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
          const r = await banco.criarLogin(email, senha || senhaAleatoria());
          if (r === 'existia') msgLogin = ' O login já existia.';
          else if (senha) msgLogin = ' Login criado com a senha provisória.';
          else { await banco.redefinirSenha(email); msgLogin = ' Login criado e e-mail enviado para a pessoa criar a senha.'; }
        } catch (e) {
          console.error(e);
          el.querySelectorAll('button').forEach(b => { b.disabled = false; });
          aviso('Não consegui criar o login: ' + (e.code || e.message), 'erro');
          return false;
        }
      }
      await gravar({ email }, telas, nome).catch(() => {});
      aviso(`Usuário ${email} criado.${msgLogin}`);
    } }],
  });
}
const senhaAleatoria = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');

function opcoesUsuario(u) {
  const fb = banco.modo() === 'firebase';
  janela({
    titulo: nomeDe(u),
    html: `<p class="mut" style="margin-top:0">${esc(u.email)}</p>
      <label class="campo">Nome<input class="ent" id="oNome" value="${esc(u.nome || '')}" placeholder="${esc(u.email.split('@')[0])}"></label>
      <div class="atalhos-ac">
        <button class="btn peq" data-tudo="ver">${icone('olho')} Só ver em tudo</button>
        <button class="btn peq" data-tudo="editar">${icone('salvar')} Editar em tudo</button>
        <button class="btn peq" data-tudo="">${icone('cadeado')} Tirar todos os acessos</button>
      </div>
      ${fb ? `<h4 style="margin:16px 0 6px">Login</h4>
        <div class="atalhos-ac" style="align-items:flex-end">
          <label class="campo" style="flex:1;min-width:200px">Senha provisória (mín. 6)<input class="ent" id="oNovaSenha" type="text" autocomplete="off" placeholder="em branco: a pessoa recebe um e-mail"></label>
          <button class="btn peq" id="oCriar">${icone('mais')} Criar o login</button>
        </div>
        <div class="atalhos-ac"><button class="btn peq" id="oSenha">${icone('documento')} Enviar e-mail para criar / trocar a senha</button></div>
        <p class="mut" style="font-size:12.5px">Use "Criar o login" se a pessoa ainda não tem login (ex.: quem entrou na lista sozinho, como o comercial2@). Se já tiver, nada muda.</p>` : ''}
      <p class="mut" style="font-size:12.5px;margin-bottom:0">Remover tira todos os acessos desta pessoa. O login continua existindo no Firebase (Authentication), mas sem acesso a nada.</p>`,
    aoAbrir: el => {
      el.querySelectorAll('[data-tudo]').forEach(b => {
        b.onclick = () => { gravar(u, tudo(b.dataset.tudo), el.querySelector('#oNome').value.trim()).then(() => aviso(`${nomeDe(u)}: ${b.textContent.trim()}.`)); };
      });
      const bc = el.querySelector('#oCriar');
      if (bc) bc.onclick = async () => {
        const senha = el.querySelector('#oNovaSenha').value;
        if (senha && senha.length < 6) { aviso('A senha precisa de pelo menos 6 caracteres.', 'erro'); return; }
        bc.disabled = true;
        try {
          const r = await banco.criarLogin(u.email, senha || senhaAleatoria());
          if (r === 'existia') aviso('Esta pessoa já tinha login. Para trocar a senha, use o e-mail abaixo.');
          else if (senha) aviso('Login criado com a senha provisória.');
          else { await banco.redefinirSenha(u.email); aviso('Login criado e e-mail enviado para a pessoa criar a senha.'); }
        } catch (e) { console.error(e); aviso('Não consegui criar o login: ' + (e.code || e.message), 'erro'); }
        bc.disabled = false;
      };
      const bs = el.querySelector('#oSenha');
      if (bs) bs.onclick = async () => {
        try { await banco.redefinirSenha(u.email); aviso('E-mail enviado para ' + u.email + '.'); }
        catch (e) { aviso('Não consegui enviar: ' + banco.mensagemErroLogin(e), 'erro'); }
      };
    },
    botoes: [
      { texto: icone('lixo') + ' Remover usuário', cls: 'perigo', esquerda: true, acao: () => {
        if (!confirm(`Remover ${u.email}? A pessoa perde o acesso a todas as telas.`)) return false;
        banco.apagar(COL_ACESSOS, u.id).then(() => aviso(u.email + ' removido.')).catch(e => aviso('Erro: ' + e.message, 'erro'));
      } },
      { texto: 'Fechar' },
      { texto: 'Salvar nome', cls: 'pri', acao: el => { gravar(u, u.telas || {}, el.querySelector('#oNome').value.trim()); } },
    ],
  });
}
