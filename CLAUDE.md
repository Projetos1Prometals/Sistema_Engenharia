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
fundo branco, bordas pretas finas, cabeçalhos cinza.
- Sequência da Carga Metálica: Retorno, Sucata, Ligas; na frente de cada linha, o código MP do NW
  daquele material (na mesma linha, não como legenda solta).
- Sucata: uma linha fixa por sucata do cadastro. Ligas: linhas fixas na ordem da planilha
  (`BOL_LIGAS` em `liga.js`: 1 Fe Si … 12 Tungstênio, 13 Fe Mn B/C). "-" quando não usadas.
  O Fe Mn B/C **não** vai na área da sucata (na planilha só ficava lá por falta de espaço).
- Rastreio = FS, sempre com o prefixo "FS-". Ordem Produção = OPs.
- Não mudar a ordem nem o layout sem pedido.

### Importação das planilhas (Configurações) — `importar.js`
- **Calculo de Ligas (.xlsm)** → `lerPlanilha`: ligas, retornos (Dados Retorno), corridas da aba
  Banco de dados (ids `planilha-NNNN`, nº anual deduzido) e contadores.
- **CONTROLE_CORRIDA_ENGENHARIA (.xlsx)** → `lerControle`: abas "Controle Corrida AAAA".
  - "Total Corrida Kg" = carga do forno + recarga; carga importada = total − recarga.
  - Corrida que já veio da Banco de dados é **completada** (não duplicada): mesmo nº da corrida,
    até 7 dias de diferença (as datas das planilhas divergem), confirmando por OP, nº anual, liga ou carga.
    Os dados da Controle ficam em `corrida.controle` e são aplicados por `aplicarControle()` — também
    ao reimportar a Calculo, para não se perderem.
  - As outras viram histórico `hist-AAAA-NNN` (sem estimado). Retorno gerado: pelo código
    "ref-anual-LIGA" do retorno (Dados Retorno não tem nº de relatório).
  - Cabeçalhos com acento ("N° Relatório"): normalizar com NFD antes do `cab()`.
- As planilhas ficam em `planilhas_dados/`, que está no `.gitignore`: o repositório é público,
  **nunca** enviar planilhas para o GitHub.

## Controle de Modelos (`modelos/`)
- `regras.js` (sem tela), `modelos.js` (telas), `importar.js` (planilha Almoxarifado_Modelos), `modelos.css`.
- Coleções: `eng_modelos` (id = código normalizado por `idModelo()`), `eng_ruas` (id = letra).
- **Código não pode repetir** (o id sai do código; maiúsculas/espaços não contam). Na importação, o
  repetido não entra e vai para os avisos. **Uma posição = um modelo.**
- Situação: `manutencao` (a posição fica reservada) ou, sem isso, disponível com posição /
  fora do estoque sem posição. Botões Manutenção / Voltou gravam no `historico` (só a data, sem destino).
- **PDF do desenho** por código: `banco.salvarArquivo('modelo_<id>')`. No Firebase vai em pedaços na
  coleção `eng_arquivos` (o Storage exige plano pago); no modo local, IndexedDB. Máx. 20 MB.
- **Só a Engenharia edita**: `podeEditar()` / `EDITORES` em `comum/casca.js` + `editor()` no
  `firestore.rules` (as duas listas têm que bater). Os outros setores entram em `leitor()` e só consultam.

## Testes
Não há Node nem Python na máquina. Para testar, serve-se a pasta com um servidor HTTP simples
(ex.: `HttpListener` em PowerShell) e usa-se o Chrome headless (`--dump-dom`, `--print-to-pdf`).

## GitHub
Perguntar ao usuário antes de enviar qualquer coisa para o GitHub.
