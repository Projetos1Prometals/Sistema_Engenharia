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

### Retorno automático (`retornoAutomatico()` em `liga.js`)
- Toda corrida **do sistema** (não as importadas) gera/atualiza o seu retorno ao ser salva: código
  `ref-anual-LIGA` (liga com sigla entre parênteses usa só a sigla: "A-532 (FB)" → `34-227-FB`, `siglaLiga()`), `kgVerificado` 0 até pesar (tela Retornos, filtro "Sem peso"), análise = lida do PDF
  do laboratório **no retorno** (vale mais que `corrida.real`, que só existe nas corridas antigas importadas), `auto: true`, `corridaId`. O código fica em `corrida.retornoGerado`.
- A ficha da corrida **não** tem mais o quadro do laboratório (a corrida sai antes do resultado): ficou só "Retorno e certificado". Status, tabela Norma × composição, boletim e certificado usam a análise do retorno gerado e, sem ela, `corrida.real`.
- Se a liga/número mudar, ou a corrida for excluída, o retorno automático é renomeado/apagado **só** se ainda
  não tiver peso, baixa nem uso em outra corrida. O botão "Atualizar retorno" da ficha serve para peso e código à mão.

### PDF do laboratório (`laudo.js`)
- Botão "Ler PDF do laboratório…" na janela do **retorno** (análise com os 20 elementos + nº do relatório; código
  vazio vira `ref-anual-SIGLA` da liga escolhida) e no **certificado** (lado direito: preenche `quimica`; corrida vazia
  vira "34-227"). **Não** fica na ficha da corrida (pedido do usuário).
- `lerLaudo()` lê o certificado de análise da Priner (FOR-LAB-0035) com pdf.js (cdnjs, carregado só quando precisa):
  tabela "Composição / Resultado" (valor → símbolo de x mais próximo), nº do certificado (pela posição: logo abaixo de
  "Certificate Nr.", qualquer formato; no retorno, PDF sem nº **limpa** o campo), emissão, "CORRIDA 34 - 227".
- Confere a corrida do PDF com o código do retorno / a corrida do certificado (pergunta se não bater). Não salva
  sozinho nem guarda o PDF.
- PDF escaneado (sem texto) não funciona: avisa para digitar à mão.

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

### Amostras do dia (`#/amostras`, `amostras.js`)
- Com as corridas de uma data: **etiqueta do saquinho** das amostras (10 × 5 cm; corrida, material, data;
  até 4 corridas por etiqueta), **etiqueta de cada retorno** (meia folha A4, duas por folha, linha tracejada para cortar — ou, marcando "Retornos também em etiqueta 10 × 5", junto com as do saquinho; corrida, material, data, "Peso:" em
  branco, COR = `liga.cor` cadastrada em Ligas e normas ou, sem ela, a tabela `CORES_RETORNO` de
  `amostras.js`, copiada da folha "Cores (retorno)" da fundição; 310 e VC-131 = tambor de retorno de terceiro) e o **formulário A4 do laboratório Priner**
  (LT-FO-023; dados fixos em `config.liga.priner`, botão "Dados do formulário").
- Imprime com páginas nomeadas (`@page etiqueta` 100×50 mm, `@page folhaA4`, `@page folhaRetorno` = A4 sem margem);
  saquinho, retornos e formulário em botões separados (impressoras diferentes). Formato das fotos/docx que o usuário mandou — não mudar sem pedido.

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
- **Quem edita** (`podeEditar(area)` / `EDITORES` em `comum/casca.js` + funções do `firestore.rules`;
  as listas têm que bater):
  - `modelos` / `dadosModelos()`: só **projetos1@** — cadastro, posições, PDFs, ruas, importação.
  - `manutencao` / `manutencaoModelos()`: **projetos1@ e qualidade1@** — só ida/volta da manutenção.
    No Firestore, a qualidade só grava se a mudança tocar apenas `situacao`, `historico`, `_em`, `_por`.
  - `geral` / `editor()`: Cálculo de Liga (projetos1@ e qualidade1@).
  - `leitor()`: os outros setores, só consulta.
  - Para testar no modo local como outra pessoa: `localStorage.setItem('pmt_simular', '<email>')`.

## Certificados (`certificados/`)
- `folha.js` (a folha A4 — layout copiado do app antigo / planilha, 12 colunas; não mudar sem pedido),
  `certificados.js` (telas), `certificados.css`.
- Coleção `eng_certificados` (id do app antigo mantido na importação); assinatura em `eng_config/certificado`.
- **Mais de uma folha** (`folhasDoCert()` em `certificados.js`, `certContinuacao()` em `folha.js`): se não couber
  numa A4 com escala ≥ 0,9, a folha 1 sai completa com os itens que cabem + "Continua na folha seguinte" e o resto
  vai para folhas de continuação (cabeçalho, identificação, itens, assinatura, rodapé). "Página" vira "1 de N"
  quando o campo está no formato "N de N". A assinatura é a imagem de `eng_config/certificado` e sai em todas as folhas.
- Editado direto na folha (contenteditable) e **salva sozinho** ~0,7 s depois de parar de digitar.
- Ligação com o Cálculo de Liga: `corridaId`. Novo certificado a partir da corrida traz corrida ("ref-anual"),
  material (liga), OP da liga e a **análise do laboratório** (ou do retorno gerado). A conferência usa as
  faixas de "Ligas e normas" (`eng_ligas`) — o app antigo tinha uma lista própria, que não é importada.
- **Vínculo com o retorno (só retorno → certificado)**: `cert.retorno` = código escolhido; vazio = segue o
  `retornoGerado` da corrida ligada; senão o retorno com o mesmo nº de corrida ("48-242" → `48-242` ou `48-242-CF8`);
  `'-'` = sem vínculo (`codigoRetornoDoCert()` em `certificados/auto.js`). `sincronizarQuimica()` leva a
  análise do retorno para `quimica` ao abrir e quando o retorno muda, **menos** os elementos em `cert.quimicaManual`
  (marcados ao digitar/colar na folha ou ao ler o PDF direto no certificado). O certificado **nunca** grava no retorno.
  "Voltar a seguir o retorno" limpa `quimicaManual`. A janela do retorno lista os certificados vinculados.
  Valor diferente do retorno: célula em **vermelho só na tela** (`td.dif`, em `marcarConferencia()`); na impressão sai normal.
- **Certificado automático** (`criarCertificadosAuto()` em `certificados/auto.js`, pedido do usuário): todo retorno com
  análise, que não seja da planilha e que nenhum certificado siga, ganha um certificado (corrida, material, OP da liga se
  houver corrida, análise; cliente/produtos em branco). Roda ao salvar o retorno (Cálculo de Liga) e ao abrir Certificados.
  O retorno guarda `certificadoAuto` = id do certificado: excluído o certificado, **não** é criado de novo.
- Análise do certificado: 20 elementos = `ELEMENTOS` + `ELEMENTOS_LAB_EXTRA` (P, Co, Pb, Sn, B, Mg, Fe),
  que também aparecem no resultado do laboratório da corrida.
- Importa o backup .json do app antigo (`{sistema:'certificados-prometals', certs, assinatura}`) e liga
  sozinho à corrida pelo texto "33-229" (refratário-anual, data mais próxima, até 120 dias).
- Quem edita: `EDITORES.certificados` (= `editor()` no firestore.rules).

## Instrução de Processo
- Fica no **Supabase** (app separado); no menu é só um atalho externo. Decisão do usuário, para sobrar
  espaço no Firebase. As pastas `INSTRUÇÃO DE PROCESSO/` e `certificado-analise-main/` são cópias dos
  apps antigos só para estudo (estão no `.gitignore`).

## Testes
Não há Node nem Python na máquina. Para testar, serve-se a pasta com um servidor HTTP simples
(ex.: `HttpListener` em PowerShell) e usa-se o Chrome headless (`--dump-dom`, `--print-to-pdf`).

## GitHub
Perguntar ao usuário antes de enviar qualquer coisa para o GitHub.
