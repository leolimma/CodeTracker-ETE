# CodeTracker ETE - Aplicação para acompanhamento de aulas de programação em python

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
2. Copie a **Connection String** (`postgresql://...`). Ela será sua variável `DATABASE_URL` no Render.
3. No menu lateral do Neon, clique em **SQL Editor**:
   - Copie e execute o arquivo [`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql) para criar as tabelas.
   - Copie e execute o arquivo [`migrations/002_seed_data.sql`](migrations/002_seed_data.sql) para carregar os dados iniciais e o usuário administrador (`admin@ete.edu.br` / `admin123`).

### Passo 3: Configurar a Hospedagem no Render

O seu projeto já possui um arquivo Infrastructure as Code (`render.yaml`) pronto para automatizar o processo.
1. Acesse o [Render](https://render.com/) e faça login com seu GitHub.
2. No Dashboard, clique em **New** e selecione **Blueprint**.
3. Selecione o repositório do projeto. O Render lerá seu `render.yaml` automaticamente.
4. Preencha as Variáveis de Ambiente Necessárias:
   - `DATABASE_URL`: Cole a URL de conexão do Neon (com `?sslmode=require`).
   - `GEMINI_API_KEY`: Sua chave de API do Google Gemini (se for utilizar o tutor IA).
   - `VITE_API_URL`: A URL final do seu app no Render (ex: `https://codetracker-ete.onrender.com`).
   - `SESSION_SECRET`: *(Gerado automaticamente pelo Render)*.
5. Clique em **Apply** / **Create Blueprint**.

### Passo 4: Acompanhar o Deploy

1. O Render iniciará o Deploy automaticamente executando o `build.sh`:
   - `npm install`
   - `npm run build`
   - `pip install -r requirements.txt`
2. Após o build, o Gunicorn iniciará sua aplicação Flask servindo tudo (arquivos React e API).
3. Quando o status mudar para **Live**, seu site estará online e pronto para uso!
   - Login do Admin: `admin@ete.edu.br` | Senha: `admin123`

---

## 🤖 Integração CI/CD (GitHub Actions)

Este repositório está configurado com um fluxo automatizado utilizando **GitHub Actions** para gerenciamento do ciclo de vida de Pull Requests com o banco de dados Neon:

- Sempre que um **Pull Request (PR)** é aberto, uma Action (`neon_pr.yml`) intercepta o evento.
- Ela cria automaticamente uma **nova branch no banco de dados Neon**, permitindo que as alterações de código do PR sejam testadas sem alterar o banco de produção.
- Ao fazer o merge ou **fechar o PR**, a Action apaga a branch do banco de dados, mantendo os recursos do servidor sempre limpos.

Para que isso funcione, certifique-se de preencher as seguintes informações no seu repositório GitHub (Aba Settings > Secrets and Variables > Actions):
- **Secrets:** `NEON_API_KEY` (Chave da sua conta no Neon)
- **Variables:** `NEON_PROJECT_ID` (ID do seu projeto no Neon)

## 🎖️ Créditos e Reconhecimentos

Este projeto foi desenvolvido e aprimorado utilizando ferramentas e modelos avançados de Inteligência Artificial:

* **[Google AI Studio](https://aistudio.google.com/):** Plataforma para prototipagem de prompts, engenharia de contexto e integração das APIs de IA.
* **Modelos Google Gemini:**
  * **Gemini 3.8:** Raciocínio arquitetural profundo, otimização de integrações e refatoração de código.
  * **Gemini 3.7:** Estruturação fullstack, geração de componentes e lógica de negócios.
  * **Gemini Pro:** Motor do Tutor de IA pedagógico socrático integrado ao CodeTracker ETE.
* **[Antigravity IDE](https://antigravity.google/):** Ambiente de desenvolvimento agentico avançado (Google DeepMind) utilizado durante o pair programming, planejamento de arquitetura e implantação da aplicação.
