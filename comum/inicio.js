// =====================================================================
//  comum/inicio.js — tela de entrada (login) e visão geral dos módulos
// =====================================================================
import * as banco from './banco.js?v=1.7.1';
import { montar, icone, esc, aviso, aplicarTema, podeVer, TELAS_LIGA, TELAS_MODELOS, ADMINS } from './casca.js?v=1.7.1';
import { COL, saldos, statusCorrida, acharLiga } from '../liga/calculo.js?v=1.4.0';

aplicarTema();
const est = await banco.iniciar();
const params = new URLSearchParams(location.search);

if (est.modo === 'firebase' && !est.usuario) telaLogin();
else if (params.get('voltar') && est.usuario) location.replace(params.get('voltar'));
else visaoGeral();

function telaLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="login"><div class="caixa">
    <div class="marca"><b>PROMETALS</b><small>Sistema Engenharia</small></div>
    <form id="fLogin">
      <label class="campo">E-mail<input class="ent" type="email" id="lEmail" autocomplete="username" required></label>
      <label class="campo">Senha<input class="ent" type="password" id="lSenha" autocomplete="current-password" required></label>
      <div class="erro" id="lErro"></div>
      <button class="btn pri" type="submit" style="justify-content:center">Entrar</button>
      <button class="btn link" type="button" id="lEsqueci">Esqueci minha senha</button>
    </form></div></div>`;
  const lembrado = localStorage.getItem('pmt_email');
  if (lembrado) app.querySelector('#lEmail').value = lembrado;
  app.querySelector(lembrado ? '#lSenha' : '#lEmail').focus();
  app.querySelector('#fLogin').onsubmit = async e => {
    e.preventDefault();
    const email = app.querySelector('#lEmail').value, senha = app.querySelector('#lSenha').value;
    const bt = app.querySelector('button[type=submit]');
    bt.disabled = true; app.querySelector('#lErro').textContent = '';
    try {
      await banco.entrar(email, senha);
      localStorage.setItem('pmt_email', email.trim());
      const voltar = params.get('voltar');
      if (voltar && voltar.startsWith(location.origin)) location.replace(voltar);
      else location.replace(location.pathname);
    } catch (err) {
      app.querySelector('#lErro').textContent = banco.mensagemErroLogin(err);
      bt.disabled = false;
    }
  };
  app.querySelector('#lEsqueci').onclick = async () => {
    const email = app.querySelector('#lEmail').value.trim();
    if (!email) { app.querySelector('#lErro').textContent = 'Digite seu e-mail primeiro.'; return; }
    try { await banco.redefinirSenha(email); aviso('Enviamos um e-mail para ' + email + ' com o link para criar uma nova senha.'); }
    catch (err) { app.querySelector('#lErro').textContent = banco.mensagemErroLogin(err); }
  };
}

async function visaoGeral() {
  await montar({ ativo: 'inicio', trilha: ['Visão geral'] });
  const C = document.getElementById('conteudo');
  const nome = (banco.usuario() && banco.usuario().nome) || '';
  // primeira tela liberada de cada módulo (Usuários e acessos)
  const liga = TELAS_LIGA.find(podeVer), modelos = TELAS_MODELOS.find(podeVer);
  const algum = liga || modelos || podeVer('certificados') || podeVer('modelosClientes');
  C.innerHTML = `
    <h1 class="titulo">Olá${nome && banco.modo() === 'firebase' ? ', ' + esc(nome.split(' ')[0].replace(/^\w/, c => c.toUpperCase())) : ''}</h1>
    <p class="sub">Sistema Engenharia: tudo da Engenharia num lugar só.</p>
    ${banco.modo() === 'local' ? `<div class="faixa lar"><b>Modo local.</b> O <code>config.js</code> ainda não tem o bloco do Firebase, então os dados ficam só neste navegador. Bom para testar; para valer, siga o LEIA-ME.</div>` : ''}
    ${algum ? '' : `<div class="faixa lar">Seu usuário ainda não tem acesso a nenhuma tela. Peça para a Engenharia (${esc(ADMINS[0])}) liberar em <b>Usuários e acessos</b>.</div>`}
    <div class="kpis" id="kpis"></div>
    <div class="modulos">
      ${!liga ? '' : `<a class="modulo" href="liga/index.html#/${liga}">${icone('chama')}<h3>Cálculo de Liga</h3><p>Corridas, carga do forno, retornos com saldo, boletim para o forneiro e resultado do laboratório.</p><div class="rod"><span class="tag ok">Pronto</span></div></a>`}
      ${!modelos ? '' : `<a class="modulo" href="modelos/index.html#/${modelos === 'modelos' ? 'lista' : modelos}">${icone('grade')}<h3>Almoxarifado Prometals</h3><p>Modelos da Prometals: prateleiras, manutenção, histórico, desenho (PDF) e lista comercial.</p><div class="rod"><span class="tag ok">Pronto</span></div></a>`}
      ${!podeVer('modelosClientes') ? '' : `<a class="modulo" href="modelos-clientes/index.html#/painel">${icone('cubo')}<h3>Modelos de clientes</h3><p>Modelos que os clientes deixam na empresa: chegada com NF, fotos, consertos e o documento de devolução.</p><div class="rod"><span class="tag ok">Pronto</span></div></a>`}
      ${!podeVer('certificados') ? '' : `<a class="modulo" href="certificados/index.html#/lista">${icone('certificado')}<h3>Certificados</h3><p>Certificado de qualidade com a análise química da corrida: busca por OP, edição na folha, impressão A4.</p><div class="rod"><span class="tag ok">Pronto</span></div></a>`}
      ${!podeVer('instrucao') ? '' : `<a class="modulo" href="https://projetos1prometals.github.io/instrucao-processo-prometals/" target="_blank" rel="noopener">${icone('prancheta')}<h3>Instrução de Processo</h3><p>Instruções por produto, com fotos, para a produção. Abre o app atual numa aba nova.</p><div class="rod"><span class="tag info">App separado</span></div></a>`}
    </div>`;
  if (!podeVer('corridas') && !podeVer('retornos')) return;   // números do Cálculo de Liga só para quem vê essas telas
  const dados = { corridas: null, retornos: null, ligas: null };
  const pintar = () => {
    if (!dados.corridas || !dados.retornos || !dados.ligas) return;
    const sal = saldos(dados.retornos, dados.corridas);
    const comSaldo = [...sal.values()].filter(s => s.saldo > 0.05);
    const aguardando = dados.corridas.filter(c => c.origem !== 'planilha' && statusCorrida(c, acharLiga(dados.ligas, c.liga), null).cod === 'aguardando' && !c.retornoGerado);
    const ano = String(new Date().getFullYear());
    C.querySelector('#kpis').innerHTML = (podeVer('corridas') ? `
      <a class="kpi" href="liga/index.html#/corridas" style="text-decoration:none;color:inherit"><b>${dados.corridas.filter(c => String(c.data || '').startsWith(ano)).length}</b><span>Corridas em ${ano}</span></a>
      <a class="kpi amar" href="liga/index.html#/corridas" style="text-decoration:none;color:inherit"><b>${aguardando.length}</b><span>Aguardando análise</span></a>
` : '') + (podeVer('retornos') ? `
      <a class="kpi verde" href="liga/index.html#/retornos" style="text-decoration:none;color:inherit"><b>${comSaldo.length}</b><span>Retornos com saldo</span></a>
      <a class="kpi lar" href="liga/index.html#/retornos" style="text-decoration:none;color:inherit"><b>${Math.round(comSaldo.reduce((s, x) => s + x.saldo, 0)).toLocaleString('pt-BR')}</b><span>Kg de retorno em saldo</span></a>` : '');
  };
  banco.ouvirColecao(COL.corridas, l => { dados.corridas = l; pintar(); });
  banco.ouvirColecao(COL.retornos, l => { dados.retornos = l; pintar(); });
  banco.ouvirColecao(COL.ligas, l => { dados.ligas = l; pintar(); });
}
