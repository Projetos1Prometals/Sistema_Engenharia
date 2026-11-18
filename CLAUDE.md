# Sistema Engenharia — Prometals

Site estático (HTML + JS em módulos, sem build) publicado no GitHub Pages; dados no Firebase
(Firestore) ou, sem `config.js` preenchido, em modo local (localStorage). Textos da tela e do código
em português. Visão geral e passo a passo de instalação: `LEIA-ME.md`.

## Cálculo de Liga (`liga/`)
- `calculo.js`: contas sem tela (carga, composição estimada, saldos dos retornos).
- `liga.js`: telas e o boletim impresso (`htmlBoletim`); `liga.css`: telas e impressão.
- Ao mudar `calculo.js`, `liga.js` ou `liga.css`, suba o `?v=` em `liga/index.html` e nos `import`
  de `calculo.js` (em `liga.js` e `importar.js`) e a `VERSAO` em `comum/casca.js`, para o navegador
  não misturar arquivos novos com antigos do cache.

### Regra da recarga do retorno
Cada item de `corrida.retornos` é `{ codigo, kg, recarga }`:
- `kg` = **Solicitado**: entra na carga do forno e na composição estimada.
- `recarga` = parte que o forneiro separa: **não** entra na carga nem na composição,
  mas **sai do saldo** do retorno.
- Saldo do retorno = kg verificado − baixa da planilha − Σ(**kg + recarga**) das corridas do sistema
  (`saldos()` / `baixaDoRetorno()` em `calculo.js`). Corridas importadas da planilha não contam.
- Tela: ao escolher o retorno, Solicitado = disponível − recarga. Ao digitar a recarga, o Solicitado
  é recalculado, a não ser que tenha sido digitado à mão (`solManual`, só no rascunho, não é salvo;
  apagar o Solicitado volta ao automático). Aviso em vermelho se Solicitado + Recarga passar do disponível.
- Ex.: retorno com 370 kg, recarga 80 → Solicitado 290; a carga soma 290; o saldo final é 0.

### Boletim impresso (Ctrl+P / "Imprimir boletim")
Imita a folha "Boletim de Corrida" da planilha, que o forneiro já conhece: uma página A4, Arial,
fundo branco, bordas pretas finas, cabeçalhos cinza. As 12 linhas de "Ligas" ficam sempre na
mesma ordem (`BOL_LIGAS` em `liga.js`), com "-" quando não usadas; Fe Mn B/C sai como "MN B/C" na
área da sucata. Não mudar a ordem nem o layout sem pedido.

## Testes
Não há Node nem Python na máquina. Para testar, serve-se a pasta com um servidor HTTP simples
(ex.: `HttpListener` em PowerShell) e usa-se o Chrome headless (`--dump-dom`, `--print-to-pdf`).

## GitHub
Perguntar ao usuário antes de enviar qualquer coisa para o GitHub.
