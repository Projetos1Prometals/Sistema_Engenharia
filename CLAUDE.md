# Sistema Engenharia — Prometals

Site estático (HTML + JS em módulos, sem build) publicado no GitHub Pages; dados no Firebase
(Firestore) ou, sem `config.js` preenchido, em modo local (localStorage). Textos da tela e do código
em português. Visão geral e passo a passo de instalação: `LEIA-ME.md`.

## Estrutura (pedido do usuário, 2026-11-27): uma pasta por módulo, uma pasta por tela, nomes em snake_case
- Módulo = pasta (as seções do menu): `calculo_liga/`, `almoxarifado_modelos/`, `modelos_prometals/`, `modelos_clientes/`,
  `certificados/`, `sistema/`. Partes de todos: `comum/` (`casca.js`, `banco.js`, `tema.css`, `inicio.js`). Raiz: `index.html`
  (login + Visão geral), `404.html`, `config.js`.
- **Cada tela é uma página própria**: `<módulo>/<tela>/` com `index.html`, `<tela>.css` e `<tela>.js` (ex.:
  `calculo_liga/corridas/corridas.js`). Ficha/registro abre por parâmetro: `ficha_corrida/index.html?id=…`,
  `certificado/?id=…`, `ficha_modelo/?id=…` (novo: sem id; `?pos=K25`), `devolucao/?id=…`, `produto/?codigo=…`,
  `certificados/lista/?novo=<id da corrida>` (abre "Novo certificado").
- Na pasta do módulo: `base_<módulo>.js` (carrega os dados, confere o acesso — `iniciarTela({…, desenhar})` — e os ajudantes
  comuns; a tela registra em `aoMudarDados(fn)` o que refazer quando o banco muda), `<módulo>.css` (estilos comuns às telas)
  e os arquivos sem tela (`calculo.js`, `regras.js`, `folha_certificado.js`…). Endereço de outra tela: `url('tela', {id})`
  da base, ou `endereco('modulo/tela', params)` de `casca.js`. Nomes de pastas e arquivos em snake_case; dentro do JS,
  camelCase (padrão do JavaScript).
- Trocar de página logo depois de gravar: use `ir(url)` de `casca.js` (espera a gravação, até 1,5 s); links clicados com
  gravação em andamento esperam sozinhos. Filtros das listas: `filtroDaTela()` (lembrados na aba, sessionStorage).
- `404.html`: o GitHub Pages mostra para endereço inexistente; leva os endereços antigos (`liga/index.html#/corridas`,
  `modelos-clientes/index.html#/produto/<código>`…) e a pasta do módulo sozinha para a tela nova.
- Tela nova: criar a pasta com os 3 arquivos (copiar o `index.html` de outra tela do módulo), item em `MENU` (`casca.js`)
  e, se tiver permissão própria, em `TELAS`.

## Versão (cache do navegador)
- **Um número só** para tudo: `VERSAO` em `comum/casca.js` = o `?v=` de **todos** os `import`, `<script>` e `<link>`
  (hoje 2.0.0). Ao mudar qualquer .js/.css, suba a versão em todos de uma vez
  (`sed -i -E "s/\?v=[0-9]+\.[0-9]+\.[0-9]+/?v=X.Y.Z/g"` nos .js/.html), para o navegador não misturar arquivos novos com
  antigos do cache (e `casca.js`/`banco.js` não virarem duas cópias, o que quebra o acesso carregado).

## Cálculo de Liga (`calculo_liga/`)
- `calculo.js`: contas sem tela (carga, composição estimada, saldos dos retornos). `base_liga.js`: dados e ajudantes.
- Telas: `corridas/`, `ficha_corrida/` (ficha + boletim impresso `htmlBoletim` + `retornoAutomatico()`), `amostras_dia/`,
  `retornos/`, `ligas_normas/`, `sucatas_ferroligas/`. Configurações do módulo: `sistema/configuracoes/` (usa `base_liga.js`).

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

### Retorno automático (`retornoAutomatico()` em `ficha_corrida/ficha_corrida.js`)
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
  (`BOL_LIGAS` em `ficha_corrida.js`: 1 Fe Si … 12 Tungstênio, 13 Fe Mn B/C). "-" quando não usadas.
  O Fe Mn B/C **não** vai na área da sucata (na planilha só ficava lá por falta de espaço).
- Rastreio = FS, sempre com o prefixo "FS-". Ordem Produção = OPs.
- Não mudar a ordem nem o layout sem pedido.

### Amostras do dia (`calculo_liga/amostras_dia/`, `etiquetas_amostras.js`)
- Com as corridas de uma data: **etiqueta do saquinho** das amostras (10 × 5 cm; corrida, material, data;
  até 4 corridas por etiqueta), **etiqueta de cada retorno** (meia folha A4, duas por folha, linha tracejada para cortar — ou, marcando "Retornos também em etiqueta 10 × 5", junto com as do saquinho; corrida, material, data, "Peso:" em
  branco, COR = `liga.cor` cadastrada em Ligas e normas ou, sem ela, a tabela `CORES_RETORNO` de
  `etiquetas_amostras.js`, copiada da folha "Cores (retorno)" da fundição; 310 e VC-131 = tambor de retorno de terceiro) e o **formulário A4 do laboratório Priner**
  (LT-FO-023; dados fixos em `config.liga.priner`, botão "Dados do formulário").
- Imprime com páginas nomeadas (`@page etiqueta` 100×50 mm, `@page folhaA4`, `@page folhaRetorno` = A4 sem margem);
  saquinho, retornos e formulário em botões separados (impressoras diferentes). Formato das fotos/docx que o usuário mandou — não mudar sem pedido.

### Importação das planilhas (Sistema → Configurações) — `importar_planilhas.js`
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

## Almoxarifado Prometals (`almoxarifado_modelos/` + `modelos_prometals/lista_comercial/`) — modelos da própria Prometals
- No menu, seção Modelos (pedido do usuário): "Almoxarifado modelos" (Prateleiras, Modelos, Ruas abrem embaixo), "Modelos Prometals" (Lista comercial embaixo) e "Modelos de clientes".
- `regras.js` (sem tela), `base_modelos.js`, `importar_planilha.js` (planilha Almoxarifado_Modelos). Telas: `prateleiras/`,
  `modelos/`, `ficha_modelo/`, `ruas_importacao/`; a Lista comercial fica em `modelos_prometals/lista_comercial/` (usa a mesma base).
- Coleções: `eng_modelos` (id = código normalizado por `idModelo()`), `eng_ruas` (id = letra).
- **Código não pode repetir** (o id sai do código; maiúsculas/espaços não contam). Na importação, o
  repetido não entra e vai para os avisos. **Uma posição = um modelo.**
- Situação: `manutencao` (a posição fica reservada) ou, sem isso, disponível com posição /
  fora do estoque sem posição. Botões Manutenção / Voltou gravam no `historico` (só a data, sem destino).
- **PDF do desenho** por código: `banco.salvarArquivo('modelo_<id>')`. No Firebase vai em pedaços na
  coleção `eng_arquivos` (o Storage exige plano pago); no modo local, IndexedDB. Máx. 20 MB.
- **Quem edita**: tela Usuários e acessos (ver a seção no fim). Em `modelos.js`, `ED` muda por rota: Prateleiras,
  Modelos e a ficha seguem `modelos`; Ruas e importação segue `ruas`; Lista comercial é só ver. `MAN` = `manutencao`
  (no Firestore, só grava se a mudança tocar apenas `situacao`, `historico`, `_em`, `_por`).

## Modelos de clientes (`modelos_clientes/`) — modelos que os clientes deixam na empresa
- **Desligado por enquanto** (pedido do usuário, 2026-11-27): `TELAS_DESLIGADAS = ['modelosClientes']` em `casca.js`
  → some do menu e da Visão geral, e a página mostra "sem acesso" (até para o admin). Para voltar: esvaziar a lista.
- Porte do app antigo (artifact do Claude, `app-modelos-clientes/`, no `.gitignore`, só estudo). Mesmas telas e regras:
  `painel/`, `modelos/` (+ `ficha_modelo/?id=`), `devolucoes/` (+ `devolucao/?id=`), `clientes/`, `importar_exportar/`, `configuracoes/`.
  Os dados do app antigo eram de teste: **não** foram migrados.
- `base_mcli.js` (dados, janelas e ações `data-acao` comuns; a tela soma as suas com `registrarAcoes()`), `folha_devolucao.js` (documento de devolução A4 — layout do app antigo, não mudar sem pedido), `fotos.js`,
  `planilha.js` (ler Excel/CSV/colado, montar .xlsx), `modelos_clientes.css`, `logo_doc.jpg` (logo do documento; a impressão fica em `devolucao/devolucao.css`).
- Coleções: `eng_clientes`, `eng_mcli_modelos`, `eng_mcli_eventos`, `eng_mcli_devolucoes`; config (dados da T.M Gastão,
  texto da declaração, prefixos) em `eng_config/modelosClientes`. Ids aleatórios; códigos `MOD-0001` / `DEV-0001`
  (`proximoCodigo()`, prefixo da config). Código do modelo não repete.
- Situações: `na_empresa`, `em_conserto`, `separado` (Aguardando retirada), `devolvido`. Histórico (`tipo`): `entrada`
  (chegada), `conserto` (aberto/concluído; aberto → Em conserto), `ocorrencia`, `movimentacao` (Local / situação),
  `saida` (devolução). Devolução: `emitida` → `entregue` (Registrar retirada: modelos viram Devolvido + evento `saida`)
  ou `cancelada` (modelos voltam para Na empresa; só a cancelada pode ser excluída).
- **Documento de devolução**: impresso pelo navegador (Ctrl+P ou "Imprimir / PDF" na página da devolução), como o boletim.
  O CSS de impressão esconde tudo de `#conteudo` menos `.folha-wrap`. Campos da retirada em branco saem como linha.
- **Fotos** do modelo: `fotos: [{id, tipo}]`, tipo `frente` / `traseira` / `macho` (opcional) / `outra`. Reduzidas no
  navegador (~1280 px, ~150 KB JPEG, `reduzir()`) e gravadas com `banco.salvarArquivo('mcli_…')` (no Firebase em pedaços
  em `eng_arquivos`; local: IndexedDB). Eventos e devolução guardam só os ids. Ao remover, o arquivo só é apagado se
  nenhum documento de devolução usar a foto (`apagarFotos()`).
- **Código do produto** (`codProduto`, o mesmo do NW e da Instrução de Processo) e a página de consulta
  **`produto/index.html?codigo=<código>`** (descrição, referência/desenho, cliente, liga, partes, material, localização, situação, fotos
  frente/traseira/macho). A Instrução de Processo vai abrir
  `…/modelos_clientes/produto/index.html?codigo=<código>` (o endereço antigo `…/modelos-clientes/index.html#/produto/<código>` ainda funciona pelo `404.html`; quem abre precisa de login e de "Modelos de clientes" ao menos "Só ver").
- **Da Instrução de Processo** (`instrucao.js`, botão em Importar / Exportar): pede o login da Instrução (Supabase,
  sessão só na memória), lê `kv` (`ip:<n>:data` + `cfg:ips`) e traz as IPs com `peca.destino` = "Retorno para o cliente"
  (ou o antigo "Volta para o dono"): cliente (criado pelo nome), `codProduto`, descrição, liga, `ip` = nº, e as fotos
  `caixa_frente`/`caixa_traseira`/`macho` → frente/traseira/macho. IP já trazida (mesmo `ip`, ou mesmo código do produto)
  só completa campos vazios e fotos que faltam. Nunca grava na Instrução de Processo.
- Permissão: **uma tela só**, `modelosClientes` (ver/editar), para o módulo inteiro. Regras: `leMcli()` / `editaMcli()`.
  comercial2@ (e o admin) editam: `semearAcessos()` grava o comercial2@ com só `modelosClientes: 'editar'`.

## Certificados (`certificados/`)
- Telas: `lista/` (busca, novo certificado, retornos sem certificado), `certificado/?id=` (a folha), `assinatura_backup/`.
- `folha_certificado.js` (a folha A4 — layout copiado do app antigo / planilha, 12 colunas; não mudar sem pedido),
  `base_certificados.js` (dados, vínculo com o retorno, gravação automática, impressão), `certificados.css` (a folha e a impressão).
- Coleção `eng_certificados` (id do app antigo mantido na importação); assinatura em `eng_config/certificado`.
- **Mais de uma folha** (`folhasDoCert()` em `base_certificados.js`, `certContinuacao()` em `folha_certificado.js`): se não couber
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
  Botão "Retornos sem certificado" (lista de Certificados): mostra **todos** os retornos com análise sem certificado
  (`retornosSemCertificado()`), inclusive da planilha e os de certificado excluído, para criar à mão (`criarCertificadosDe()`).
- Análise do certificado: 20 elementos = `ELEMENTOS` + `ELEMENTOS_LAB_EXTRA` (P, Co, Pb, Sn, B, Mg, Fe),
  que também aparecem no resultado do laboratório da corrida.
- Importa o backup .json do app antigo (`{sistema:'certificados-prometals', certs, assinatura}`) e liga
  sozinho à corrida pelo texto "33-229" (refratário-anual, data mais próxima, até 120 dias).
- Quem edita: tela `certificados` em Usuários e acessos.

## Instrução de Processo
- Fica no **Supabase** (app separado); no menu é só um atalho externo (tela `instrucao`, só "ver", em Usuários e
  acessos: quem não tem não vê o atalho). Decisão do usuário, para sobrar espaço no Firebase. As pastas `INSTRUÇÃO DE PROCESSO/` e `certificado-analise-main/` são cópias dos
  apps antigos só para estudo (estão no `.gitignore`).

## Testes
Não há Node nem Python na máquina. Para testar, serve-se a pasta com um servidor HTTP simples
(ex.: `HttpListener` em PowerShell) e usa-se o Chrome headless (`--dump-dom`, `--print-to-pdf`).
Com `--virtual-time-budget` o IndexedDB (fotos, PDFs no modo local) **trava**: para isso, abrir o Chrome com
`--remote-debugging-port` e ler/printar pela DevTools (WebSocket em PowerShell), em tempo real.
Para o modo local no teste, o servidor devolve um `config.js` vazio (o de verdade tem o Firebase). O servidor também
deve devolver o `404.html` para endereço inexistente, como o GitHub Pages, para testar os endereços antigos.

## GitHub
Perguntar ao usuário antes de enviar qualquer coisa para o GitHub.

## Usuários e acessos (`sistema/usuarios_acessos/`, `comum/casca.js`, `firestore.rules`)
- **Por enquanto desligado** (pedido do usuário, 2026-11-26): `RESTRINGIR = false` em `casca.js` → todo não-admin
  vê e edita tudo (nível máximo de cada tela), menos Usuários e acessos; no Firebase vale o `firestore_todos.rules`
  (quem tem doc em `eng_acessos` lê/grava todas as `eng_*`). Para restringir: `RESTRINGIR = true` + publicar o `firestore.rules`.
- Pedido do usuário: controlar por **tela** quem vê e quem edita. Coleção `eng_acessos`, id = e-mail em minúsculas:
  `{ email, nome, telas: { corridas: 'editar', retornos: 'ver', … } }` (tela fora da lista = sem acesso).
- Telas = `TELAS` em `casca.js` (corridas, amostras, retornos, ligas, materiais, mapa, modelos, manutencao, comercial, ruas,
  modelosClientes, certificados, instrucao, config); `niveis` diz o que cada uma aceita (mapa, comercial e instrucao só
  "ver"; manutencao só "editar").
- Menu (`MENU` em `casca.js`): item com `filhos` = um módulo (Almoxarifado Prometals, Modelos de clientes); os filhos só
  aparecem embaixo quando se está no módulo (`ativo`/`marcarMenu`). Filho com `tela:` usa essa permissão em vez do `id`.
- Administrador = `ADMINS` em `casca.js` = `admin()` no `firestore.rules` (projetos1@): vê e edita tudo e é o único
  que abre Usuários e acessos. Quando ele entra, `semearAcessos()` grava cada pessoa de `ACESSOS_INICIAIS` (qualidade1@,
  comercial2@) **uma vez só**: a lista do que já foi gravado fica em `eng_acessos/_semeados` (se o admin depois remover
  ou mudar a pessoa, não volta). Pessoa nova que precise nascer pronta → acrescentar em `ACESSOS_INICIAIS`.
- `montar()` carrega o acesso antes de desenhar o menu. Use `podeVer(tela)` / `podeEditar(tela)` / `ehAdmin()`.
  Menu e Visão geral só mostram o que a pessoa vê; rota sem acesso → `semAcesso()`; módulo sem nenhuma tela liberada
  nem liga os `ouvirColecao`.
- **Só ver** no Cálculo de Liga: `modoLeitura(true)` põe `.leitura` no conteúdo + faixa azul; um MutationObserver trava
  todo input/select/textarea dentro de `.leitura` que não esteja dentro de `.livre` (busca, filtros, data das amostras),
  e o CSS esconde `.so-ed` (botões de gravar). Janelas: `janela({ soLeitura: !ED })` (some botão com `acao`, Cancelar vira Fechar).
  Botão novo que grava → classe `so-ed`; campo novo de filtro em tela de lista → dentro de `.livre`.
- `firestore.rules`: `ve([telas])` para ler, `edita(tela)` para gravar, lendo `eng_acessos/<e-mail>`. Quem grava em cada
  coleção: ver os comentários do arquivo (ex.: corrida grava o retorno e `eng_config/liga`; certificado só marca
  `certificadoAuto` no retorno). Mudou o arquivo → o usuário tem que colar no Firebase e publicar.
- `banco.criarLogin()` cria o login de outra pessoa numa 2ª instância do Firebase (não derruba a sessão do admin).
- Teste no modo local como outra pessoa: `localStorage.setItem('pmt_simular', '<email>')` + o doc em `pmt_local:eng_acessos`.
- `casca.js` e `banco.js` são importados com `?v=` (todos com a **mesma** versão — ver "Versão" no começo —, senão viram duas cópias
  e o acesso carregado não é compartilhado).
