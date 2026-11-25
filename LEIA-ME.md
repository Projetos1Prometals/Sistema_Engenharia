# Sistema Engenharia — Prometals

Um sistema só para a Engenharia, com o mesmo visual do sistema do PCP.
Funciona no navegador do computador e do celular, e os dados ficam no **Firebase** (Google):
todos os usuários liberados veem e editam os mesmos dados, em tempo real.

| Módulo | Situação |
|---|---|
| **Cálculo de Liga** (corridas, retornos, ligas, sucatas e ferroligas) | Pronto (etapa 1) |
| **Controle de Modelos** (prateleiras, manutenção, histórico, desenho em PDF, lista comercial) | Pronto |
| **Certificados** de qualidade (busca por OP, edição na folha, análise vinda da corrida, impressão A4) | Pronto |
| Instrução de Processo | App separado (Supabase), atalho no menu |

## Arquivos

| Pasta / arquivo | O que é |
|---|---|
| `index.html` | Entrada: login e visão geral |
| `config.js` | **Configuração do Firebase**: o único arquivo que precisa ser editado |
| `firestore.rules` | Regras de segurança + lista de e-mails liberados (colar no Firebase) |
| `comum/` | Partes usadas por todos os módulos: visual (`tema.css`), menu (`casca.js`), banco de dados (`banco.js`), logo |
| `liga/` | Módulo Cálculo de Liga: tela (`index.html`, `liga.css`, `liga.js`), contas (`calculo.js`), importação da planilha (`importar.js`), dados iniciais (`dados-iniciais.js`) |
| `modelos/` | Módulo Controle de Modelos: telas (`index.html`, `modelos.css`, `modelos.js`), regras (`regras.js`), importação da planilha Almoxarifado_Modelos (`importar.js`) |

| `certificados/` | Módulo Certificados: folha A4 (`folha.js`), telas (`index.html`, `certificados.css`, `certificados.js`) |

## 1. Colocar no GitHub

1. GitHub (conta **projetos1prometals**) → **New repository** → nome `sistema-engenharia` → **Public** → **Create repository**.
2. Clique em **uploading an existing file** e **arraste a pasta inteira** descompactada (com as pastas `comum` e `liga`) → **Commit changes**.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
4. Em 1–2 minutos o site fica em `https://projetos1prometals.github.io/sistema-engenharia/`.

Sem o Firebase configurado, o sistema já abre em **modo local** (os dados ficam só no navegador de quem usa). Dá para testar tudo assim.

## 2. Criar o banco no Firebase (uma vez só)

> Se você já criou o projeto do Certificados no Firebase, pode usar **o mesmo projeto**. Nesse caso, no passo das Regras, **não apague** as regras que já existem: acrescente só o bloco `match /{colecao}/{doc}` do arquivo `firestore.rules`.

1. https://console.firebase.google.com → **Criar um projeto** → nome `engenharia-prometals` → desative o Google Analytics → **Criar projeto**.
2. **Criação → Firestore Database → Criar banco de dados** → edição **Standard** → local **southamerica-east1 (São Paulo)** → modo **produção** → **Criar**.
3. Aba **Regras** → apague tudo → cole o conteúdo de `firestore.rules` → **Publicar**.
4. **Criação → Authentication → Vamos começar** → **E-mail/senha** → ative → **Salvar**.
5. Aba **Usuários → Adicionar usuário**: crie `projetos1@prometals.co` (e os outros), cada um com uma senha.
6. (Recomendado) **Authentication → Configurações → Ações do usuário**: desmarque a criação de conta (sign-up).

## 3. Ligar o site ao Firebase

1. Engrenagem ⚙ → **Configurações do projeto** → **Seus apps** → ícone **`</>`** (Web) → apelido `engenharia` → **Registrar app**.
2. Copie o bloco `const firebaseConfig = { … }`.
3. No GitHub, abra `config.js` → lápis ✏ → **apague tudo** → cole → **Commit changes**. Pode colar com as linhas de `import`, do jeito que o Firebase mostra.
4. Abra o site com **Ctrl+F5** e entre com seu e-mail e senha.

No primeiro acesso, o sistema grava sozinho as **28 ligas**, as **sucatas** e as **ferroligas** com os teores da planilha.

## 4. Trazer os dados da planilha

**Configurações → Importar a planilha Calculo de Ligas** → escolha o `.xlsm` atual.
Traz as normas das ligas, os retornos (análise, peso, saldo), o histórico de corridas (aba Banco de dados) e os contadores.
Pode importar quantas vezes quiser; faça a **última importação no dia em que pararem de usar a planilha**, para os saldos baterem.

Depois, **Configurações → Importar a planilha Controle de Corrida** → escolha a `CONTROLE_CORRIDA_ENGENHARIA` (.xlsx).
Traz o histórico das abas **Controle Corrida 2023, 2024…**: nº anual, recarga, nº do relatório e datas do laboratório. As corridas que já vieram da Calculo de Ligas são só completadas (as datas das duas planilhas às vezes diferem em alguns dias; o sistema casa pelo nº da corrida, OP, liga e carga). As outras entram como histórico, sem composição estimada.

> As planilhas com dados **não** vão para o GitHub (o repositório é público). Deixe-as na pasta `planilhas_dados`, que é ignorada.

## Como funciona o Cálculo de Liga

- **Corrida**: liga, nº do refratário e nº anual (já vêm preenchidos com o próximo número), data, temperatura, **Corrida PCP (FS)** e **OPs da liga**.
  Escolha os retornos (só aparecem os que têm saldo, primeiro os da mesma liga), as sucatas e os elementos de liga. O peso da carga e a composição estimada aparecem na hora, comparados com a norma (**BAIXO / OK / ALTO**, como na planilha).
- **Retorno: Solicitado e Recarga**: ao escolher o retorno, o **Solicitado** vem com o saldo disponível. Se o forneiro separar uma **Recarga**, digite-a: o Solicitado vira (disponível − recarga), a não ser que você já tenha mudado o Solicitado à mão. Só o Solicitado entra na carga do forno e na composição; o saldo do retorno baixa Solicitado + Recarga (ex.: 370 kg, recarga 80 → 290 no forno, saldo 0). Se os dois juntos passarem do saldo, aparece um aviso em vermelho.
- **Entrada manual**: material que não está no cadastro (forma perdida, retorno sem análise), com kg e composição.
- **Amostras do dia** (menu Cálculo de Liga, ou botão na lista de corridas): escolha a data e marque as corridas. **Imprimir etiquetas** imprime a etiqueta do saquinho das amostras e uma etiqueta para cada retorno (10 × 5 cm, com Peso em branco e a COR da liga — cadastre a cor em **Ligas e normas**). **Imprimir formulário A4** imprime a solicitação de análise da Priner com uma linha por corrida (os dados fixos ficam em **Dados do formulário**). Na impressora de etiquetas, escolha papel 100 × 50 mm, sem margens e escala 100%.
- **Imprimir boletim**: a mesma folha "Boletim de Corrida" da planilha, em uma página A4: dados de produção, carga metálica (Elemento / Solicitado / Recarga, com os códigos MP do NW) e as 12 linhas de ligas sempre na mesma ordem.
- **Retorno da corrida**: ao salvar a corrida, o sistema cria sozinho o retorno dela (ex.: `64-257-CRK`), sem peso. Quando o PDF do laboratório chegar, abra o retorno em **Retornos** e clique em **Ler PDF do laboratório**: a análise fica no retorno e aparece na corrida e no certificado. Pese e informe o kg na tela **Retornos** (filtro "Sem peso") ou no botão **Atualizar retorno** da corrida.
- **Ligação futura com o PCP**: cada corrida guarda a **FS** e as **OPs**; nas próximas etapas, a Instrução de Processo vai usar o **código do produto**.

## Incluir uma pessoa nova
1. Firebase → **Authentication → Usuários → Adicionar usuário**.
2. **Firestore Database → Regras**: acrescente o e-mail na lista → **Publicar**.

## Cópia de segurança
**Configurações → Baixar cópia (.json)**. Guarde na rede de vez em quando. Para voltar uma cópia: **Restaurar cópia…**

## Sem internet
Dá para continuar trabalhando. O rodapé avisa, e as alterações são enviadas sozinhas quando a conexão voltar.

## Custos
O plano gratuito do Firebase (Spark) cobre a Engenharia com folga: 1 GB de dados, 50 mil leituras e 20 mil gravações por dia.

## Como funciona o Controle de Modelos

- **Prateleiras**: o mapa de cada rua, desenhado sozinho. Verde = disponível, laranja = em manutenção, azul = vaga livre. Clique numa posição para abrir o modelo ou, numa vaga livre, colocar um modelo.
- **Modelos**: cada modelo tem um **código único** — o sistema não deixa cadastrar código repetido (nem com maiúscula/minúscula diferente). Cada posição guarda um modelo só.
- **Manutenção**: na ficha do modelo, **Mandar para manutenção** e **Voltou da manutenção**. A data fica no histórico e a posição fica reservada enquanto ele está fora.
- **Desenho (PDF)**: na ficha do modelo, **Enviar o PDF do desenho** (até 20 MB). Quem consulta abre ou baixa o PDF pela ficha ou pela **Lista comercial**. Os PDFs ficam no banco do Firebase (não vão para o GitHub).
- **Lista comercial**: a aba Comercial da planilha — diâmetro, variação, refinador, área, setores… com a situação no estoque atualizada sozinha.
- **Importar a planilha**: **Ruas e importação → Escolher planilha…** → `Almoxarifado_Modelos.xlsx`. Código repetido na planilha não entra (aparece no aviso).
- **Quem edita**: só a Engenharia (lista `EDITORES` em `comum/casca.js` e `editor()` no `firestore.rules`). Para alguém **só consultar**, crie o usuário no Firebase e coloque o e-mail na lista `leitor()` do `firestore.rules`.

## Como funcionam os Certificados

- **Busca**: digite a **OP** e veja em qual corrida ela está; também busca por corrida (ex.: `33-229`), material, cliente, pedido ou nº do certificado. `Enter` abre quando há um só resultado.
- **Novo certificado**: pelo botão em **Certificados** ou, na ficha da corrida (Cálculo de Liga → Laboratório), em **Novo certificado**. Vem com corrida, material, OP da liga e a **análise do laboratório** já preenchidos. Cliente, pedido e produtos podem ser copiados de outro certificado.
- **Edição**: clique em qualquer campo da folha e digite — **salva sozinho**. Cole uma linha de valores do Excel/espectrômetro no campo **C** para preencher a análise inteira.
- **Conferência** (não imprime): compara a análise com a norma da liga em **Ligas e normas** e marca o que estiver fora.
- **Análise chegou depois?** No certificado, **Trazer a análise da corrida**.
- **Imprimir / PDF**: botão no alto ou `Ctrl+P` — folha A4, mesmo formato de antes. Com muitos itens, sai em **2 folhas ou mais** (os itens continuam na folha seguinte, com assinatura e "Página 1 de 2"). Na busca, marque vários e **Imprimir selecionados**.
- **Assinatura e backup**: imagem da assinatura e cópia de segurança. Para trazer os certificados do app antigo: lá, **Backup → Exportar backup (.json)**; aqui, **Assinatura e backup → Escolher o backup**. Os que tiverem a corrida no formato `33-229` são ligados sozinhos à corrida.
- O resultado do laboratório da corrida agora tem os **20 elementos** do certificado (P, Co, Pb, Sn, B, Mg e Fe a mais).
