# CoNexo

**Conectando a AACD a parceiros de impressão 3D.**

O CoNexo é um projeto acadêmico para organizar solicitações de fabricação de dispositivos assistivos. A plataforma permite que a equipe AACD informe os requisitos de uma peça, encontre parceiros com impressoras compatíveis e acompanhe o pedido até sua conclusão.

O projeto está em desenvolvimento e sua execução atual é **local**, com frontend e API atendidos pelo mesmo servidor Node.js.

## Funcionalidades

### Área AACD

- Cadastro e login de profissionais, com homologação por uma conta AACD já aprovada.
- Análise e homologação de parceiros e de novas contas AACD.
- Consulta à rede de parceiros, com busca por instituição, localização, responsável e materiais.
- Criação de solicitações com código, prioridade, dimensões, materiais, bicos e link do arquivo.
- Geração opcional de códigos persistentes, como `PLA-000123`.
- Recomendações de impressoras compatíveis, ordenadas pela distância em linha reta.
- Encaminhamento de pedidos e nova tentativa após recusa.
- Consulta de pedidos da própria unidade, com filtros, paginação, detalhes e exportação CSV.
- Cancelamento de pedidos pendentes ou em produção.
- Edição do próprio perfil.

### Área do parceiro

- Cadastro da instituição, confirmação da localização no mapa e registro da primeira impressora.
- Aviso de homologação pendente e acesso à área interna após aprovação da AACD.
- Cadastro, edição e remoção lógica de impressoras.
- Consulta à fila de pedidos, com informações de prioridade e requisitos.
- Aceite, recusa e finalização de pedidos.
- Histórico dos pedidos finalizados, cancelados e recusados.
- Edição dos dados da instituição e de sua localização.

## Como funciona um pedido

1. A AACD preenche os requisitos da solicitação.
2. O backend consulta parceiros homologados e impressoras ativas que atendam às dimensões, aos materiais e aos bicos informados.
3. As opções são ordenadas pela distância entre a unidade AACD e o local confirmado pelo parceiro.
4. A AACD escolhe uma opção e encaminha o pedido. Nesse momento, o sistema cria ou reutiliza a solicitação, revalida a impressora e registra o pedido como `pendente`.
5. O parceiro aceita ou recusa. Ao aceitar, o pedido passa para `em_producao`.
6. Ao finalizar a fabricação, o parceiro encerra o pedido e a solicitação.

A consulta de recomendações não cria uma solicitação. A geração de código reserva um identificador em uma tabela própria.

### Estados do pedido

| Ação | Responsável | Transição |
| --- | --- | --- |
| Encaminhar | AACD | Cria um pedido `pendente` |
| Aceitar | Parceiro responsável | `pendente` → `em_producao` |
| Recusar | Parceiro responsável | `pendente` → `recusado` |
| Finalizar | Parceiro responsável | `em_producao` → `finalizado` |
| Cancelar | AACD da unidade solicitante | `pendente` ou `em_producao` → `cancelado` |

A recusa preserva a tentativa no histórico e mantém a solicitação disponível para reencaminhamento. Finalização e cancelamento encerram a solicitação. Cada solicitação pode ter apenas um pedido ativo por vez.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML5, CSS3, JavaScript com módulos ES e Bootstrap 5 |
| Mapas | Leaflet e imagens do OpenStreetMap |
| Busca de endereço | Nominatim, consultado pelo backend |
| API | Node.js 24+ e Express 5 |
| Dados relacionais | MySQL |
| Impressoras | MongoDB |
| Autenticação | bcrypt, express-session e express-mysql-session |
| Testes | Node.js Test Runner, Python, Playwright e Chromium |

Bootstrap e Leaflet são referenciados por CDN no HTML. As imagens, os ícones e a fonte do projeto ficam em `frontend/assets/`. A página também carrega o widget de acessibilidade UserWay.

## Organização do projeto

```text
Conexo_AACD/
├── frontend/
│   ├── index.html              # Telas e templates
│   ├── css/styles.css          # Estilos da aplicação
│   ├── assets/                 # Imagens, ícones e fonte
│   └── js/
│       ├── app.js              # Inicialização, login e cadastros
│       ├── aacd.js             # Coordenação da área AACD
│       ├── partner.js          # Coordenação da área do parceiro
│       ├── auth-client.js      # Chamadas HTTP, sessão e CSRF
│       ├── router.js           # Navegação entre as seções
│       ├── location-ui.js      # Mapa e confirmação do pino
│       ├── data.js             # Funções de dados usadas pelas telas
│       ├── shared-ui.js        # Funções compartilhadas da interface
│       ├── order-status.js     # Estados e rótulos dos pedidos
│       ├── client-api/         # Comunicação com a API e conversão de dados
│       └── ui/                 # Formulários, cards e ações de cada tela
├── backend/
│   ├── src/                    # Configuração, serviços e validações
│   │   ├── server.js           # Conexões e início do servidor
│   │   ├── app.js              # Montagem da aplicação Express
│   │   └── routes/             # Rotas HTTP organizadas por recurso
│   ├── db/                     # Schemas, migrações e validator MongoDB
│   ├── data/                   # Limites geográficos do Brasil
│   ├── scripts/                # Preparação dos bancos e seed AACD
│   ├── tests/                  # Testes do backend
│   ├── .env.example            # Modelo de configuração local
│   └── package.json            # Dependências e comandos do backend
├── tests/                      # Contrato HTTP e testes de navegador
├── package.json                # Comandos de execução na raiz
└── README.md
```

O MySQL armazena contas, solicitações, pedidos, eventos e sessões. O MongoDB armazena as impressoras e suas especificações. O vínculo entre os bancos utiliza o identificador do parceiro.

As telas ficam em seções do mesmo HTML. O JavaScript controla a navegação, a visibilidade e o foco. A API utiliza o prefixo `/api`, e o Express publica somente a pasta `frontend/` como conteúdo estático.

## Requisitos

- **Node.js 24 ou superior**, com npm.
- **MySQL Server 8.0.16 ou superior**, ou MySQL 8.4.
- **MongoDB 7 ou superior**.
- Navegador atualizado.
- Acesso à internet para carregar as bibliotecas por CDN, as imagens do mapa e a busca real de endereço.

MySQL Workbench e MongoDB Compass são ferramentas de gerenciamento. Os servidores MySQL e MongoDB também precisam estar instalados e em execução.

## Instalação local

Os comandos abaixo partem da raiz do repositório, onde estão `frontend/` e `backend/`.

### 1. Obter o projeto e instalar as dependências

```sh
git clone https://github.com/Thallesneto/Conexo_AACD.git
cd Conexo_AACD
npm --prefix backend ci
```

Se você já tem o projeto no computador, entre em sua pasta e execute somente a instalação das dependências.

### 2. Preparar o acesso ao MySQL

Em uma conexão autorizada a criar schemas e usuários, execute o SQL abaixo, substituindo `SUA_SENHA_LOCAL` pela senha escolhida para o banco:

```sql
CREATE DATABASE IF NOT EXISTS conexo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'conexo_app'@'localhost'
  IDENTIFIED BY 'SUA_SENHA_LOCAL';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON conexo.* TO 'conexo_app'@'localhost';
```

Se esse usuário MySQL já existir, mantenha sua senha atual ou ajuste-a pelo gerenciamento do banco. `CREATE USER IF NOT EXISTS` não redefine uma senha existente.

### 3. Configurar o ambiente

No **Windows/CMD**:

```bat
copy backend\.env.example backend\.env
notepad backend\.env
```

No **Linux/macOS**:

```sh
cp backend/.env.example backend/.env
```

Se o `.env` já existir, edite a configuração atual. Use o [modelo de ambiente](backend/.env.example) como referência.

| Variáveis | O que configurar |
| --- | --- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Conexão com o MySQL local |
| `MONGO_URI`, `MONGO_DATABASE` | Conexão e nome do banco MongoDB |
| `SESSION_SECRET` | Chave aleatória de pelo menos 32 caracteres |
| `NOMINATIM_USER_AGENT` | Identificação do projeto com contato válido para a busca de endereço |
| `SEED_AACD_EMAIL`, `SEED_AACD_PASSWORD`, `SEED_AACD_PHONE`, `SEED_AACD_UNIT`, `SEED_AACD_NAME` | Dados da conta AACD inicial |
| `PORT`, `NODE_ENV` | Porta local e ambiente; o modelo usa `3000` e `development` |

Gere uma chave de sessão com:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `SESSION_SECRET`. Substitua os valores de exemplo antes de iniciar. O arquivo `.env` é ignorado pelo Git.

As unidades e suas coordenadas padrão ficam em [backend/src/units.js](backend/src/units.js). `AACD_UNITS` e `AACD_UNIT_LOCATIONS` permitem personalizar essa configuração. A unidade do seed deve corresponder a uma unidade configurada.

**As credenciais `MYSQL_*` dão acesso ao banco. Os campos `SEED_AACD_*` definem o login da conta AACD da aplicação.**

### 4. Inicializar os bancos

Com MySQL e MongoDB em execução:

```sh
npm --prefix backend run db:init
```

O comando prepara as tabelas, aplica as migrações e cria a coleção de impressoras com seu validator e índices. Se detectar uma base parcial, interrompe a preparação para que a estrutura seja revisada. Uma coleção MongoDB existente mantém seu validator atual.

### 5. Criar a primeira conta AACD

```sh
npm --prefix backend run seed:aacd
```

O seed cria uma conta AACD homologada com os valores `SEED_AACD_*`. Essa conta pode analisar os demais cadastros pela interface.

Alterar esses valores depois não troca a senha de uma conta existente. Repetir o seed com um email já cadastrado retorna erro, preservando a conta. Após a criação, os dados `SEED_AACD_*` podem ser removidos do ambiente de execução.

### 6. Iniciar a aplicação

```sh
npm start
```

Abra **http://localhost:3000/**. Se mudar `PORT`, utilize a porta configurada.

Para reiniciar o backend automaticamente durante o desenvolvimento:

```sh
npm run dev
```

O servidor escuta em `127.0.0.1`. Frontend e API funcionam na mesma origem. A preparação dos bancos e a criação da conta inicial são comandos separados do início do servidor.

No Windows, também estão disponíveis [preparar-bancos.bat](backend/preparar-bancos.bat), [seed-aacd.bat](backend/seed-aacd.bat) e [iniciar.bat](backend/iniciar.bat).

## Regras de funcionamento

- O perfil do usuário é obtido pelo banco. A seleção AACD/Parceiro na tela organiza o formulário de login.
- Novas contas aguardam homologação. A conta AACD inicial é criada homologada pelo seed.
- Contas AACD acessam pedidos e solicitações da própria unidade. Parceiros acessam os próprios pedidos e impressoras.
- A unidade de uma conta AACD é mantida na edição do próprio perfil.
- A compatibilidade considera os eixos X/Y/Z, sem rotacionar a peça. Material e bico são conferidos separadamente: a impressora precisa suportar ao menos um material e ao menos um bico da solicitação, e cada par suportado vira uma opção. A impressora não declara quais pares material/bico consegue produzir.
- Materiais compatíveis determinam as opções de fabricação. Materiais disponíveis informam se a AACD precisa fornecer o material escolhido.
- A recomendação utiliza distância em linha reta e não considera a prioridade. A prioridade ordena apenas a fila do parceiro: urgentes primeiro; depois, peso da prioridade (médio 7, padrão 0, configuráveis) somado aos dias desde a criação da solicitação.
- O link do arquivo aceita qualquer URL HTTP/HTTPS sem credenciais, com até 500 caracteres. O backend não baixa nem verifica o arquivo.
- A localização deve ser confirmada pelo parceiro. Alterar o endereço invalida a confirmação anterior.
- Remover uma impressora define `ativa = false`, preservando seu registro para referências históricas.
- Se a conta do parceiro for criada e o registro da primeira impressora falhar, a interface permite repetir a gravação da impressora.

As senhas são armazenadas com bcrypt. A autenticação utiliza sessão persistente no MySQL e cookie HttpOnly/SameSite. As chamadas que alteram dados utilizam token CSRF, e o backend verifica as permissões das operações protegidas.

## Localização e dados geográficos

A busca de endereço utiliza o Nominatim pelo backend, enviando rua, cidade e estado, sem o número. Se a rua não for encontrada, o sistema consulta a cidade e exige que o parceiro ajuste o pino até a instituição.

O arquivo [brasil-estados.geojson](backend/data/brasil-estados.geojson) fornece os polígonos usados para verificar se a coordenada está dentro do Brasil. Sua origem é o projeto [Click That ’Hood, da comunidade Code for Germany](https://github.com/codeforgermany/click_that_hood/blob/main/public/data/brazil-states.geojson). O arquivo local foi compactado, preservando as coordenadas e as propriedades utilizadas pela aplicação. A fonte e os limites estão documentados em [backend/data/README.md](backend/data/README.md).

## Testes

### Contrato do frontend

Na raiz do projeto, com Node.js instalado:

```sh
node tests/data_contract.mjs
```

Essa verificação simula respostas HTTP para conferir a comunicação do cliente com a API.

### Backend

Prepare `backend/.env.test` usando o formato de `.env.example`, com:

- `NODE_ENV=test`.
- MySQL e MongoDB **descartáveis**, com nomes terminados em `_test`.
- Credenciais com acesso a esses bancos e uma chave de sessão de teste válida.

Exemplo de nomes: `MYSQL_DATABASE=conexo_test` e `MONGO_DATABASE=conexo_test`. Prepare as permissões desses bancos na sua instalação local. Os testes criam e alteram registros; use uma base separada dos dados que a equipe precisa preservar.

Depois, na raiz:

```sh
node --env-file=backend/.env.test backend/scripts/init-db.js
npm --prefix backend test
```

A suíte cobre localização, contas, sessão, homologação, impressoras, isolamento, concorrência, solicitações, transições e histórico. A busca de endereço é simulada nesses testes.

### Navegador

Os scripts Python em `tests/` utilizam Playwright e Chromium. Há verificações de cadastro, localização, pedidos, impressoras, paginação e responsividade. Os fluxos conectados precisam de um backend de teste ativo e das fixtures criadas por `backend/tests/seed-orders-browser.js`.

A instalação dos navegadores, o caminho do Chromium e as variáveis dos testes precisam corresponder ao ambiente local. O comando `npm test` do backend executa os testes Node.js; os scripts Python são executados separadamente. Consulte os detalhes no [guia do backend](backend/README.md).

## Comandos principais

| Comando na raiz | Finalidade |
| --- | --- |
| `npm --prefix backend ci` | Instalar as dependências fixadas no lockfile |
| `npm --prefix backend run db:init` | Preparar os bancos e aplicar migrações |
| `npm --prefix backend run seed:aacd` | Criar a conta AACD inicial |
| `npm start` | Iniciar o servidor local |
| `npm run dev` | Reiniciar o backend após alterações |
| `npm --prefix backend test` | Executar a suíte Node.js com `.env.test` |
| `node tests/data_contract.mjs` | Verificar o contrato do cliente HTTP |
