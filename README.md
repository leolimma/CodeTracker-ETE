<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# CodeTracker ETE - Aplicação Fullstack com AI

Esta é a documentação completa para rodar sua aplicação localmente e realizar o deploy (implantação) na nuvem.

## 🚀 Rodando Localmente

**Pré-requisitos:**
- [Node.js](https://nodejs.org/) (Frontend Vite)
- [Python 3.10+](https://www.python.org/) (Backend Flask)

### Passo a Passo

1. Instale as dependências do Frontend (Node.js):
   ```bash
   npm install
   ```
2. Instale as dependências do Backend (Python):
   ```bash
   pip install -r requirements.txt
   ```
3. Configure o arquivo de variáveis de ambiente local. 
   Crie um arquivo `.env` (ou `.env.local`) na raiz do projeto contendo as seguintes chaves principais (veja o arquivo `.env.example` para referência):
   - `GEMINI_API_KEY`: Sua chave de API do Gemini AI.
   - `DATABASE_URL`: A connection string do banco de dados (ex: Neon PostgreSQL).
4. Rode a aplicação em modo de desenvolvimento (Frontend e Backend simultâneos):
   ```bash
   npm run dev
   ```

---

## ☁️ Guia de Implantação (Deploy na Nuvem)

A aplicação foi projetada para rodar como um único serviço de forma eficiente (o Flask serve tanto a API quanto os arquivos estáticos compilados do React), utilizando o **Render** para Hospedagem Web e o **Neon** para o Banco de Dados Serverless.

### Passo 1: Preparar o Repositório no GitHub

O servidor puxará o seu código diretamente do GitHub.
1. Crie uma conta no [GitHub](https://github.com/) e um repositório.
2. Suba o código usando o terminal:
   ```bash
   git init
   git add .
   git commit -m "Commit inicial para deploy"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
*(Atenção: Garanta que o arquivo `.env` com suas senhas não seja enviado para o GitHub. Ele já está no `.gitignore`)*

### Passo 2: Configurar o Banco de Dados no Neon

O [Neon](https://neon.tech/) fornece um banco PostgreSQL serverless rápido e escalável.
1. Acesse o Neon e crie um **New Project**.
2. Escolha o nome e região, e crie o projeto.
3. Copie a **Connection String** (`postgres://...`). Ela será sua variável `DATABASE_URL` no Render.

### Passo 3: Configurar a Hospedagem no Render

O seu projeto já possui um arquivo Infrastructure as Code (`render.yaml`) pronto para facilitar e automatizar o processo.
1. Acesse o [Render](https://render.com/) e crie uma conta usando seu GitHub.
2. No Dashboard, clique em **New** e selecione **Blueprint**.
3. Selecione o repositório que você conectou. O Render lerá seu `render.yaml` automaticamente.
4. Preencha as Variáveis de Ambiente Necessárias (Values):
   - `DATABASE_URL`: Cole a URL de conexão do Neon (Passo 2).
   - `GEMINI_API_KEY`: A chave da API do Google Gemini.
   - Variáveis de Auth (se utilizar): `NEON_AUTH_SECRET`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_PROJECT_ID`, `VITE_NEON_AUTH_PROJECT_ID`, `VITE_NEON_AUTH_PUBLISHABLE_KEY`.
   - `VITE_API_URL`: A URL final que seu app terá no Render.
5. Clique em **Apply** / **Create Blueprint**.

### Passo 4: Acompanhar o Deploy (Build e Inicialização)

1. O Render iniciará o primeiro Deploy automaticamente. Ele executará os passos definidos no script `build.sh`:
   - `npm install` (Instalação das libs Node)
   - `npm run build` (Compilação do app React)
   - `pip install -r requirements.txt` (Instalação das libs Python)
2. Após o build, o Gunicorn iniciará sua aplicação Flask servindo tudo (arquivos React e API).
3. Se tudo ocorrer bem, seu site estará online!

### Passo 5: Migrações do Banco de Dados (Pós-Deploy)

Como o banco no Neon está limpo, você precisa criar as tabelas.
1. No dashboard do Render, abra o serviço web criado e vá até a aba **Shell**.
2. Rode o script de migrações:
   ```bash
   python scripts/run_migrations.py
   ```
*(Verifique se as tabelas apareceram no painel do Neon, na aba "Tables").*

---

## 🤖 Integração CI/CD (GitHub Actions)

Este repositório está configurado com um fluxo automatizado utilizando **GitHub Actions** para gerenciamento do ciclo de vida de Pull Requests com o banco de dados Neon:

- Sempre que um **Pull Request (PR)** é aberto, uma Action (`neon_pr.yml`) intercepta o evento.
- Ela cria automaticamente uma **nova branch no banco de dados Neon**, permitindo que as alterações de código do PR sejam testadas sem alterar o banco de produção.
- Ao fazer o merge ou **fechar o PR**, a Action apaga a branch do banco de dados, mantendo os recursos do servidor sempre limpos.

Para que isso funcione, certifique-se de preencher as seguintes informações no seu repositório GitHub (Aba Settings > Secrets and Variables > Actions):
- **Secrets:** `NEON_API_KEY` (Chave da sua conta no Neon)
- **Variables:** `NEON_PROJECT_ID` (ID do seu projeto no Neon)