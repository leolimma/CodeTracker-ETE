# Guia de Implantação (Deployment) - CodeTracker ETE

Este guia detalha o passo a passo para colocar sua aplicação no ar utilizando **Neon** (Banco de Dados PostgreSQL), **GitHub** (Hospedagem de Código) e **Render** (Hospedagem do Servidor Web e Frontend).

A aplicação foi projetada para rodar como um único serviço no Render (o Flask serve tanto a API quanto os arquivos estáticos compilados do React), utilizando o arquivo `render.yaml` já configurado no projeto.

---

## Passo 1: Preparar o Repositório no GitHub

O Render precisa puxar o seu código de algum lugar. O padrão da indústria é o GitHub.

1. Crie uma conta no [GitHub](https://github.com/) (se ainda não tiver).
2. Crie um novo repositório (pode ser Privado ou Público).
3. No terminal da sua máquina (dentro da pasta do projeto), rode os comandos para enviar seu código:
   ```bash
   git init
   git add .
   git commit -m "Commit inicial para deploy"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
   *(Atenção: Garanta que o arquivo `.env` não está sendo enviado para o GitHub. Ele já deve estar listado no seu `.gitignore`)*

---

## Passo 2: Configurar o Banco de Dados no Neon

O Neon fornecerá um banco de dados PostgreSQL serverless para sua aplicação.

1. Acesse o [Neon](https://neon.tech/) e crie/faça login na sua conta.
2. Clique em **New Project** (Novo Projeto).
3. Dê um nome ao projeto (ex: `codetracker-db`), escolha a região mais próxima e a versão do Postgres (15 ou 16) e clique em **Create Project**.
4. Na página inicial do seu novo projeto Neon (Dashboard), você verá a sua **Connection String** (começa com `postgres://` ou `postgresql://`).
5. Copie essa URL. Ela será a sua variável de ambiente `DATABASE_URL` no Render.

---

## Passo 3: Configurar a Hospedagem no Render

O Render vai ler o seu código do GitHub, rodar o `build.sh` (para compilar o React e instalar as libs do Python) e iniciar o servidor Flask. O seu projeto já possui um `render.yaml` (Infrastructure as Code) pronto para facilitar esse processo.

1. Acesse o [Render](https://render.com/) e crie uma conta (você pode fazer login com o próprio GitHub).
2. No Dashboard (Dashboard), clique em **New** (Novo) e depois em **Blueprint**.
   > *Usamos Blueprint porque ele lê automaticamente o seu arquivo `render.yaml` e configura o servidor web.*
3. Conecte sua conta do GitHub ao Render e selecione o repositório que você criou no Passo 1.
4. O Render vai ler o `render.yaml` e pedir para você preencher os valores (Values) para as Variáveis de Ambiente necessárias.
5. Preencha os campos (ou deixe para preencher na aba "Environment" depois de criar):

### Variáveis de Ambiente Necessárias no Render:

*   **`DATABASE_URL`**: Cole a URL de conexão do Neon (Passo 2).
*   **`NEON_AUTH_SECRET`**: (Se estiver usando Auth do Neon) Coloque a chave secreta de autenticação.
*   **`NEON_AUTH_JWKS_URL`**: A URL JWKS fornecida pelo Neon Auth.
*   **`NEON_AUTH_PROJECT_ID`**: O ID do seu projeto no Neon.
*   **`GEMINI_API_KEY`**: A chave da API do Google Gemini (se o projeto utilizar).
*   **`VITE_NEON_AUTH_PROJECT_ID`**: Mesmo valor do `NEON_AUTH_PROJECT_ID` (usado pelo frontend).
*   **`VITE_NEON_AUTH_PUBLISHABLE_KEY`**: Chave pública do Neon Auth para o frontend.
*   **`VITE_API_URL`**: A URL que o seu app vai ter no Render (ex: `https://codetracker-ete.onrender.com`). *Você pode pegar a URL exata do Render depois que o projeto for criado e voltar para atualizar.*
*   **`SESSION_SECRET`**: (O `render.yaml` já está configurado para gerar um valor aleatório, mas você pode fornecer uma string segura qualquer).

6. Clique em **Apply** / **Create Blueprint**.

---

## Passo 4: Acompanhar o Deploy (Build e Inicialização)

1. Após criar, o Render começará o primeiro *Deploy*.
2. Clique no nome do seu Web Service (ex: `codetracker-ete`) para ver os logs do servidor.
3. Você verá os logs executando os passos do seu `build.sh`:
   * Instalação de dependências do Node.js (`npm install`)
   * Build da aplicação React (`npm run build`)
   * Instalação de dependências do Python (`pip install -r requirements.txt`)
4. Após o build, ele rodará o comando Gunicorn definido no `render.yaml` para iniciar a aplicação.
5. Se tudo der certo, você verá uma mensagem indicando que o deploy foi bem-sucedido e o seu site estará no ar na URL gerada pelo Render (ex: `codetracker-ete.onrender.com`).

---

## Passo 5: Migrações do Banco de Dados (Pós-Deploy)

Como você está conectando a um banco Neon limpo pela primeira vez, as tabelas não existem lá. Você precisa rodar o script de criação/migração.

1. No dashboard do seu Web Service no **Render**, vá na aba **Shell**.
2. Aguarde o terminal conectar na sua máquina hospedada.
3. Execute o comando para rodar as migrações/criar as tabelas (conforme configurado no seu `package.json`):
   ```bash
   python scripts/run_migrations.py
   ```
   *(Ou execute diretamente o arquivo python responsável por criar as tabelas no banco).*
4. Verifique se as tabelas foram criadas com sucesso (você também pode checar pelo painel do próprio Neon, na aba "Tables").

---

## Sucesso! 🎉
Seu aplicativo agora está rodando na nuvem. Toda vez que você fizer um `git push` para a branch `main` no GitHub, o Render vai detectar automaticamente a mudança, fazer um novo build (rodando o `build.sh`) e colocar a versão nova no ar (Auto-Deploy).
