# Sistema Engenharia — Prometals

Um sistema só para a Engenharia, com o mesmo visual do sistema do PCP.
Funciona no navegador do computador e do celular, e os dados ficam no **Firebase** (Google):
todos os usuários liberados veem e editam os mesmos dados, em tempo real.

| Módulo | Situação |
|---|---|
| **Cálculo de Liga** (corridas, retornos, ligas, sucatas e ferroligas) | Pronto (etapa 1) |
| Controle de Modelos | Próxima etapa |
| Certificados | Próxima etapa |
| Instrução de Processo | Próxima etapa |

## Arquivos

| Pasta / arquivo | O que é |
|---|---|
| `index.html` | Entrada: login e visão geral |
| `config.js` | **Configuração do Firebase**: o único arquivo que precisa ser editado |
| `firestore.rules` | Regras de segurança + lista de e-mails liberados (colar no Firebase) |
| `comum/` | Partes usadas por todos os módulos: visual (`tema.css`), menu (`casca.js`), banco de dados (`banco.js`), logo |
| `liga/` | Módulo Cálculo de Liga: tela (`index.html`, `liga.css`, `liga.js`), contas (`calculo.js`), importação da planilha (`importar.js`), dados iniciais (`dados-iniciais.js`) |

Cada módulo novo vai ganhar a sua pasta (`modelos/`, `certificados/`, `instrucao/`).

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
- **Imprimir boletim**: a mesma folha "Boletim de Corrida" da planilha, em uma página A4: dados de produção, carga metálica (Elemento / Solicitado / Recarga, com os códigos MP do NW) e as 12 linhas de ligas sempre na mesma ordem.
- **Laboratório**: o resultado real da corrida fica ao lado do estimado. O botão **Gerar retorno desta corrida** cria o retorno (ex.: `64-257-CRK`) já com a análise; o peso pode ser informado depois, na tela Retornos.
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
