# Backend do CoNexo

API responsável por contas, autenticação, homologação, localização, impressoras, solicitações e pedidos do CoNexo.

O backend utiliza **Node.js, Express, MySQL e MongoDB**. Também publica os arquivos de `../frontend/`, permitindo que a interface e a API funcionem na mesma origem. A execução atual é local, com o servidor escutando em `127.0.0.1`.

Para a apresentação geral da plataforma, consulte o [README da raiz](../README.md).

## Requisitos

- Node.js **24 ou superior**, com npm.
- MySQL Server **8.0.16 ou superior**, ou MySQL 8.4.
- MongoDB **7 ou superior**.
- Acesso à internet para a consulta real de endereços pelo Nominatim.

MySQL Workbench e MongoDB Compass são clientes de gerenciamento. Os respectivos servidores também precisam estar instalados e em execução.

## Executar localmente

**Os comandos deste documento são executados dentro da pasta `backend/`**, salvo indicação diferente.

### 1. Instalar as dependências

A partir da raiz do projeto:

```sh
cd backend
npm ci
```

A instalação utiliza as versões fixadas em `package-lock.json`.

### 2. Preparar o acesso ao MySQL

Em uma conexão com permissão para criar schemas e usuários, execute o SQL abaixo. Substitua `SUA_SENHA_LOCAL` pela senha escolhida para o banco:

```sql
CREATE DATABASE IF NOT EXISTS conexo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'conexo_app'@'localhost'
  IDENTIFIED BY 'SUA_SENHA_LOCAL';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON conexo.* TO 'conexo_app'@'localhost';
```

Se esse usuário já existir, use sua senha atual ou ajuste-a pelo gerenciamento do MySQL. `CREATE USER IF NOT EXISTS` preserva a senha de um usuário existente.

### 3. Configurar o ambiente

No **Windows/CMD**:

```bat
copy .env.example .env
notepad .env
```

No **Linux/macOS**:

```sh
cp .env.example .env
```

Se `.env` já existir, edite a configuração atual. O [arquivo de exemplo](.env.example) contém as variáveis utilizadas pelo projeto.

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta HTTP; padrão `3000` |
| `NODE_ENV` | Ambiente; para execução local, utilize `development` |
| `MYSQL_HOST`, `MYSQL_PORT` | Endereço e porta do servidor MySQL |
| `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Credenciais e schema MySQL |
| `MONGO_URI`, `MONGO_DATABASE` | Conexão e banco MongoDB |
| `SESSION_SECRET` | Chave aleatória de pelo menos 32 caracteres |
| `NOMINATIM_USER_AGENT` | Identificação do projeto com contato válido para geocodificação |
| `AACD_UNITS` | Unidades disponíveis, separadas por vírgula |
| `AACD_UNIT_LOCATIONS` | Objeto JSON opcional para substituir as coordenadas das unidades |
| `QUEUE_MEDIUM_WEIGHT` | Peso de prioridade média na fila; padrão `7` |
| `QUEUE_STANDARD_WEIGHT` | Peso das demais prioridades na pontuação da fila; padrão `0` |
| `SEED_AACD_EMAIL`, `SEED_AACD_PASSWORD` | Credenciais da conta AACD inicial |
| `SEED_AACD_PHONE`, `SEED_AACD_UNIT`, `SEED_AACD_NAME` | Dados complementares dessa conta |

Gere a chave de sessão com:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie a saída para `SESSION_SECRET`. O programa recusa a chave de exemplo iniciada por `troque-`. Os arquivos `.env` e `.env.test` são ignorados pelo Git.

As coordenadas padrão das sete unidades estão em [src/units.js](src/units.js). A unidade informada no seed deve corresponder a uma das unidades configuradas. Para criar solicitações e calcular recomendações, a unidade também precisa ter coordenadas válidas.

**`MYSQL_USER` e `MYSQL_PASSWORD` acessam o banco. `SEED_AACD_EMAIL` e `SEED_AACD_PASSWORD` definem o login da conta AACD na aplicação.**

### 4. Inicializar os bancos

Com os servidores MySQL e MongoDB em execução:

```sh
npm run db:init
```

O comando executa [scripts/init-db.js](scripts/init-db.js):

1. Confere a estrutura do schema MySQL.
2. Cria as tabelas base quando o schema está vazio.
3. Aplica as migrações de autenticação e pedidos que ainda não foram registradas.
4. Cria a coleção `impressoras`, caso ainda não exista, com seu validator.
5. Prepara os índices utilizados nas consultas de impressoras.

Uma base MySQL parcial interrompe a preparação para que a estrutura seja revisada. Em uma coleção MongoDB existente, o script mantém o validator atual. O arquivo `db/mongo-base.js` é uma referência para mongosh; o inicializador utiliza `db/impressoras-validator.json`.

Os schemas e as migrações estão em [db/](db/). A estrutura operacional usa as tabelas `aacd` e `parceiro` separadas.

### 5. Criar a primeira conta AACD

Preencha os campos `SEED_AACD_*` e execute:

```sh
npm run seed:aacd
```

O [seed](scripts/seed-aacd.js) cria uma conta AACD homologada, com senha protegida por bcrypt. Essa conta pode analisar os demais cadastros pela interface.

Repetir o seed com um email existente retorna erro. Alterar `SEED_AACD_PASSWORD` depois da criação preserva a senha já cadastrada; esse script não realiza redefinição de senha. Após criar a conta inicial, os dados `SEED_AACD_*` podem ser removidos do ambiente de execução.

### 6. Iniciar o servidor

```sh
npm start
```

Abra **http://localhost:3000/**, ou a porta definida em `PORT`.

Durante o desenvolvimento:

```sh
npm run dev
```

O modo de desenvolvimento reinicia o processo após alterações no backend. A preparação dos bancos e a execução do seed são etapas separadas do início do servidor.

No Windows, os atalhos [preparar-bancos.bat](preparar-bancos.bat), [seed-aacd.bat](seed-aacd.bat) e [iniciar.bat](iniciar.bat) executam esses comandos a partir da pasta correta.

## Organização do código

```text
backend/
├── src/
│   ├── server.js              # Conexões, início e encerramento do servidor
│   ├── app.js                 # Express, sessão, proteções e registro das rotas
│   ├── config.js              # Leitura e validação das variáveis de ambiente
│   ├── db.js                  # Pool MySQL e execução de transações
│   ├── repository.js          # Consulta de contas e controle de unicidade do email
│   ├── auth-service.js        # Cadastro e login
│   ├── profiles.js            # Atualização do próprio perfil
│   ├── printers.js            # Operações de impressoras no MongoDB
│   ├── requests.js            # Solicitações e persistência dos requisitos
│   ├── recommendations.js     # Compatibilidade e distância
│   ├── orders.js              # Encaminhamento, fila, estados e eventos
│   ├── code-service.js        # Reserva de identificadores e geração de códigos
│   ├── geo.js                 # Geocodificação e validação de coordenadas
│   ├── units.js               # Coordenadas das unidades AACD
│   ├── material-catalog.js    # Materiais e necessidade de fornecimento
│   ├── validations.js         # Validações compartilhadas de campos
│   ├── printer-validation.js  # Validação das especificações das impressoras
│   ├── request-validation.js  # Validação dos requisitos das solicitações
│   ├── order-migrations.js    # Controle da migração de pedidos
│   ├── errors.js              # Erros HTTP e verificação de condições
│   └── routes/                # Rotas de contas, parceiros, impressoras e pedidos
├── db/                        # Schemas, migrações e validator MongoDB
├── data/                      # Polígonos dos estados e documentação da fonte
├── scripts/                   # Inicialização dos bancos e seed AACD
├── tests/                     # Testes Node.js e fixture de navegador
├── .env.example               # Modelo de configuração
├── package.json
└── package-lock.json
```

As rotas recebem as requisições HTTP e chamam os serviços. Os serviços aplicam as regras e consultam os bancos. `server.js` monta as conexões, enquanto `app.js` monta a aplicação e seus serviços.

## Persistência e regras principais

### MySQL e MongoDB

O MySQL armazena contas, códigos, solicitações, materiais e bicos solicitados, pedidos, eventos e sessões. O MongoDB armazena documentos de impressoras com modelo, capacidade, bicos, materiais, proprietário, atividade e data de criação.

O `id_parceiro` de uma impressora é definido pelo backend a partir da sessão. A exclusão de uma impressora altera `ativa` para `false`, preservando o documento e as referências de pedidos anteriores.

As gravações de impressoras e o encaminhamento de pedidos usam um bloqueio na linha do parceiro no MySQL para coordenar operações da aplicação. As gravações do MongoDB são próprias desse banco; essa coordenação não constitui uma transação distribuída.

### Contas e sessão

- Novos cadastros aguardam homologação. A conta AACD inicial utiliza o seed.
- Um email deve identificar uma única conta entre os dois perfis. O repositório serializa cadastro e edição de email para conferir ambas as tabelas.
- O login identifica o perfil pelo banco. A seleção visual AACD/Parceiro não concede permissões.
- A autenticação usa cookie `conexo.sid` e sessão persistente no MySQL, com duração configurada de oito horas.
- O login regenera a sessão; o logout a destrói no servidor.
- As senhas usam bcrypt com custo 12. Senhas de cadastro devem ter pelo menos oito caracteres e no máximo 72 bytes UTF-8.
- A própria conta mantém seu perfil, sua homologação e, no caso AACD, sua unidade ao editar os dados.

Contas AACD homologadas podem homologar novos profissionais e parceiros. Pedidos e solicitações da AACD são isolados por unidade; parceiros acessam os próprios pedidos. A API de impressoras permite o cadastro da primeira máquina antes da homologação do parceiro, enquanto as operações de pedidos exigem aprovação.

### Solicitações e pedidos

Uma **solicitação** guarda a demanda e seus requisitos. Um **pedido** registra uma tentativa de encaminhamento dessa demanda a um parceiro, com uma impressora, um material e um bico selecionados.

A consulta de recomendações valida os requisitos e calcula opções. A solicitação é criada ou reutilizada no encaminhamento pela interface. Gerar um código reserva um identificador em `codigo_solicitacao`.

Um código é único dentro da unidade AACD. Ao reutilizar um código existente, o backend confere se os requisitos são os mesmos; a ordem de materiais e bicos não altera essa comparação.

| Ação | Perfil autorizado | Transição |
| --- | --- | --- |
| Encaminhar | AACD homologada | Cria pedido `pendente` |
| Aceitar | Parceiro responsável homologado | `pendente` → `em_producao` |
| Recusar | Parceiro responsável homologado | `pendente` → `recusado` |
| Finalizar | Parceiro responsável homologado | `em_producao` → `finalizado` |
| Cancelar | AACD homologada da unidade | `pendente` ou `em_producao` → `cancelado` |

Cada solicitação pode ter apenas um pedido ativo. A recusa preserva a tentativa e permite reencaminhamento; finalização e cancelamento encerram a solicitação. As mudanças geram registros em `pedido_evento`, com ação, autor, perfil e horário.

### Recomendações e fila

As recomendações utilizam parceiros homologados e impressoras ativas com capacidade X/Y/Z suficiente, sem rotacionar a peça, e uma combinação válida de material e bico. As opções são ordenadas pela distância em linha reta calculada por Haversine.

Materiais compatíveis determinam a capacidade de fabricação. Materiais disponíveis informam se a AACD precisa fornecer o material escolhido. A resposta da impressora também inclui `necessidade_por_material`; o campo legado `precisa_material` representa um resumo geral.

Antes de gravar o pedido, o backend confere novamente a solicitação, a homologação do parceiro, a propriedade e a atividade da impressora e os requisitos escolhidos.

A fila do parceiro coloca urgentes primeiro. Em seguida, considera o peso da prioridade somado aos dias de espera desde a criação da solicitação, em ordem decrescente, e o identificador do pedido como desempate.

### Localização

A geocodificação consulta o Nominatim com rua, cidade e estado, sem enviar o número do endereço. Se a rua não for localizada, consulta a cidade. A interface exige ajuste do pino quando recebe apenas a aproximação da cidade.

O serviço controla o intervalo das consultas externas, com padrão de um segundo, e mantém um cache em memória por 24 horas, limitado a 1.000 entradas. A configuração `NOMINATIM_USER_AGENT` deve identificar o projeto e um contato válido.

A coordenada confirmada é validada com os polígonos de [data/brasil-estados.geojson](data/brasil-estados.geojson), provenientes do projeto Click That ’Hood, da comunidade Code for Germany. A fonte e os limites estão em [data/README.md](data/README.md).

## Consumir a API

A URL base local é **`http://localhost:3000/api`**. O frontend usa os caminhos relativos por meio de [auth-client.js](../frontend/js/auth-client.js).

Para um cliente HTTP próprio:

1. Faça `GET /api/auth/csrf` e preserve o cookie recebido.
2. Envie o `csrfToken` retornado no cabeçalho `X-CSRF-Token` das chamadas POST, PATCH e DELETE.
3. Faça login com email e senha, mantendo o cookie.
4. Após o login, utilize o novo `csrfToken` retornado e o cookie atualizado nas próximas operações.

O frontend já executa esse controle. O backend aceita JSON com limite de 24 KB. Cadastro e login compartilham um limitador de 40 requisições por janela de 15 minutos; a geocodificação permite 12 requisições por minuto.

### Sessão, cadastro e perfil

| Método | Rota | Acesso e finalidade |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Obter token CSRF |
| POST | `/api/auth/cadastros/aacd` | Cadastro público AACD, com CSRF |
| POST | `/api/auth/cadastros/parceiros` | Cadastro público de parceiro, com CSRF |
| POST | `/api/auth/login` | Autenticar, com CSRF |
| GET | `/api/auth/me` | Consultar a própria conta autenticada |
| POST | `/api/auth/logout` | Encerrar sessão, com CSRF |
| PATCH | `/api/me` | Editar a própria conta; conta AACD precisa estar homologada |

### Homologação, impressoras e localização

| Método | Rota | Acesso e finalidade |
| --- | --- | --- |
| GET | `/api/aacd/pendentes` | AACD homologada: listar profissionais pendentes |
| POST | `/api/aacd/:id/homologacao` | AACD homologada: aprovar profissional |
| GET | `/api/parceiros` | AACD homologada: listar parceiros; filtro opcional `homologado=true` ou `false` |
| POST | `/api/parceiros/:id/homologacao` | AACD homologada: aprovar parceiro |
| GET | `/api/impressoras` | Parceiro autenticado: listar suas impressoras ativas |
| POST | `/api/impressoras` | Parceiro autenticado: cadastrar impressora |
| GET | `/api/impressoras/:id` | Proprietário: consultar impressora ativa |
| PATCH | `/api/impressoras/:id` | Proprietário: atualizar impressora ativa |
| DELETE | `/api/impressoras/:id` | Proprietário: realizar exclusão lógica |
| POST | `/api/localizacoes/geocodificar` | Buscar endereço, com CSRF e limite de requisições |
| GET | `/api/catalogos` | Consultar UFs, unidades e materiais |

### Solicitações, recomendações e pedidos

| Método | Rota | Acesso e finalidade |
| --- | --- | --- |
| POST | `/api/solicitacoes/codigos` | AACD homologada: gerar código por material |
| GET | `/api/solicitacoes` | AACD homologada: listar solicitações da unidade |
| POST | `/api/solicitacoes` | AACD homologada: criar solicitação |
| GET | `/api/solicitacoes/:id` | AACD homologada da unidade: consultar requisitos |
| POST | `/api/recomendacoes` | AACD homologada: consultar opções antes de persistir a demanda |
| GET | `/api/solicitacoes/:id/recomendacoes` | AACD homologada da unidade: consultar opções de uma solicitação |
| POST | `/api/pedidos` | AACD homologada: criar/reutilizar solicitação e encaminhar pedido |
| POST | `/api/solicitacoes/:id/pedidos` | AACD homologada da unidade: encaminhar solicitação existente |
| GET | `/api/pedidos` | Conta homologada: listar pedidos no próprio escopo |
| GET | `/api/pedidos/:id` | Conta homologada: consultar pedido autorizado |
| GET | `/api/pedidos/:id/eventos` | Conta homologada: consultar eventos de pedido autorizado |
| POST | `/api/pedidos/:id/acoes/:action` | Executar `aceitar`, `recusar`, `finalizar` ou `cancelar`, conforme perfil e estado |
| GET | `/api/health` | Verificar disponibilidade básica da API e da conexão MySQL |

### Exemplo: consultar recomendações

Envie para `POST /api/recomendacoes`, com sessão AACD homologada e CSRF:

```json
{
  "code": "PLA-000123",
  "priority": "Padrão",
  "volumes": { "X": 100, "Y": 120, "Z": 50 },
  "materials": ["PLA", "PETG"],
  "nozzles": [0.4],
  "url": "https://example.org/modelo.stl",
  "notes": "Orientações de fabricação"
}
```

A resposta contém `items` com parceiro, impressora, material, bico, distância e necessidade de fornecimento. Utilize os identificadores e a combinação efetivamente retornados ao encaminhar.

### Exemplo: encaminhar um pedido

Envie para `POST /api/pedidos`, mantendo os requisitos da consulta e a opção escolhida:

```json
{
  "request": {
    "code": "PLA-000123",
    "priority": "Padrão",
    "volumes": { "X": 100, "Y": 120, "Z": 50 },
    "materials": ["PLA", "PETG"],
    "nozzles": [0.4],
    "url": "https://example.org/modelo.stl",
    "notes": "Orientações de fabricação"
  },
  "selection": {
    "partnerId": "1",
    "printerId": "507f1f77bcf86cd799439011",
    "material": "PLA",
    "nozzle": 0.4
  }
}
```

Os IDs desse exemplo são ilustrativos. Em uma chamada real, use os valores da recomendação. A resposta de criação tem status `201` e o identificador do novo pedido.

### Respostas de erro

As respostas de erro da API seguem o formato:

```json
{
  "error": {
    "code": "NOT_AUTHORIZED",
    "message": "Acesso reservado à equipe AACD homologada."
  }
}
```

| Status | Situação comum |
| --- | --- |
| `401` | Sessão ausente ou credenciais incorretas |
| `403` | CSRF inválido, perfil sem autorização ou homologação pendente |
| `404` | Rota, registro ou recurso fora do escopo autorizado |
| `409` | Email/código em conflito, requisitos diferentes ou transição incompatível |
| `422` | Dados de entrada inválidos |
| `429` | Limite de requisições atingido |
| `500` | Falha interna tratada com mensagem genérica |
| `503` | Geocodificação indisponível ou ainda não configurada |

## Testes

### Suíte Node.js

Crie `.env.test` usando o formato de `.env.example`, com `NODE_ENV=test`, uma chave de sessão válida e bancos **descartáveis** terminados em `_test`. Exemplo: `MYSQL_DATABASE=conexo_test` e `MONGO_DATABASE=conexo_test`.

O usuário MySQL também precisa de permissões nesse schema de teste. Prepare-o e conceda as permissões correspondentes na sua instalação. A suíte cria e altera registros; use bases separadas dos dados a preservar.

Dentro de `backend/`:

```sh
node --env-file=.env.test scripts/init-db.js
npm test
```

A suíte atual contém **32 testes**:

| Arquivo | Cobertura |
| --- | --- |
| [tests/geo.test.js](tests/geo.test.js) | Polígonos, busca de endereço, alternativas, intervalo e falhas do provedor |
| [tests/integration.test.js](tests/integration.test.js) | Cadastro, login, sessão, homologação, perfis, impressoras e publicação de arquivos estáticos |
| [tests/orders.test.js](tests/orders.test.js) | Requisitos, compatibilidade, isolamento, concorrência, reencaminhamento, transições e fila |

A consulta ao Nominatim é simulada na suíte. A configuração de testes utiliza bcrypt com custo reduzido apenas nas fixtures.

### Contrato do frontend

Dentro de `backend/`:

```sh
node ../tests/data_contract.mjs
```

Essa verificação simula respostas HTTP e confere as chamadas realizadas pelo cliente.

### Fluxos no navegador

Os scripts em `../tests/` exigem Python, Playwright e Chromium. Instale as ferramentas:

```sh
python -m pip install playwright
python -m playwright install chromium
```

Consulte o executável instalado pelo Playwright:

```sh
python -c "from playwright.sync_api import sync_playwright; p=sync_playwright().start(); print(p.chromium.executable_path); p.stop()"
```

Os testes conectados abaixo aceitam `CHROMIUM_PATH` com o caminho desse executável. Se essa variável não for definida, eles procuram `chromium` no PATH.

No **Windows/CMD**, em um terminal dentro de `backend/`, inicie o servidor com os bancos descartáveis:

```bat
set PORT=3001
node --env-file=.env.test src/server.js
```

Em outro terminal, também dentro de `backend/`, gere uma fixture nova e configure o caminho real do Chromium antes de executar:

```bat
node --env-file=.env.test tests/seed-orders-browser.js
set NODE_ENV=test
set CONEXO_BACKEND_URL=http://localhost:3001/
set CHROMIUM_PATH=C:\caminho\do\chromium\chrome.exe
python ../tests/orders_browser.py
python ../tests/aacd_pagination_browser.py
python ../tests/printers_browser.py
```

A fixture é salva no diretório temporário do sistema. `CONEXO_ORDERS_FIXTURE` permite escolher outro arquivo, desde que o mesmo caminho seja usado na geração e na execução dos testes. Antes de repetir o fluxo de pedidos, gere outra fixture: a execução anterior encerra sua solicitação.

O teste `../tests/backend_browser.py` também cobre cadastro e homologação. Ele exige `SEED_AACD_EMAIL` e `SEED_AACD_PASSWORD` no ambiente do Python, com os dados de uma conta AACD de teste. Variáveis de `.env.test` não são carregadas automaticamente por scripts Python.

Há verificações isoladas de interface, mapa e confirmação do pino em `../tests/`. Os scripts `browser_smoke.py` e `map_visibility.py` procuram o Chromium no PATH. Os testes de navegador são executados separadamente de `npm test`.
