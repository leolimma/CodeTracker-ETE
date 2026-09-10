# Guia de Implantação (Deployment) - CodeTracker ETE

Este guia detalha o passo a passo para colocar sua aplicação no ar utilizando **Neon** (Banco de Dados PostgreSQL Serverless), **GitHub** (Hospedagem de Código) e **Render** (Hospedagem do Servidor Web e Frontend).

A aplicação roda como um único serviço no Render (o Flask serve tanto a API REST quanto a aplicação SPA React compilada).

---

## Passo 1: Preparar o Repositório no GitHub

O Render precisa sincronizar seu código a partir de um repositório no GitHub.

1. Crie uma conta no [GitHub](https://github.com/) (se ainda não tiver).
2. Crie um novo repositório (pode ser Privado ou Público).
3. No terminal da sua máquina (dentro da pasta do projeto), envie seu código:
   ```bash
   git init
   git add .
   git commit -m "Deploy CodeTracker ETE com autenticação nativa"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
   *(Nota: O arquivo `.env` não é enviado para o GitHub, pois está protegido no `.gitignore`)*

---

## Passo 2: Configurar o Banco de Dados no Neon

O [Neon](https://neon.tech/) fornece o banco de dados PostgreSQL serverless para a aplicação.

1. Acesse o [Neon](https://neon.tech/) e faça login.
2. Clique em **New Project** (Novo Projeto).
3. Dê um nome ao projeto (ex: `codetracker-db`), escolha a região e clique em **Create Project**.
4. No Dashboard do seu projeto Neon, copie a sua **Connection String** (começa com `postgresql://...`). Ela será a sua variável `DATABASE_URL`.

---

## Passo 3: Criar as Tabelas e Carregar os Dados no Neon (SQL Editor)

Como o Render (no plano gratuito) não possui terminal Shell interativo, a criação do banco de dados é feita de forma rápida e direta no próprio painel web do Neon:

1. No menu lateral esquerdo do painel do **Neon**, clique em **SQL Editor**.
2. **Executar a Estrutura (CREATE):**
   * Abra o arquivo [`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql), copie todo o conteúdo, cole no SQL Editor do Neon e clique em **Run** (ou pressione `Ctrl + Enter`).
   * *Isso cria todas as tabelas, tipos, extensões, índices, views e triggers do sistema.*
3. **Executar a Carga Inicial (SEED):**
   * Abra o arquivo [`migrations/002_seed_data.sql`](migrations/002_seed_data.sql), copie todo o conteúdo, cole no SQL Editor do Neon e clique em **Run**.
   * *Isso cadastra o Administrador Geral (`admin@ete.edu.br` / senha `admin123`), uma turma de teste, exercícios práticos de Python e alunos de demonstração.*

---

## Passo 4: Configurar o Serviço Web no Render

O seu projeto já possui o arquivo `render.yaml` (Infrastructure as Code) pronto para configurar o servidor automaticamente.

1. Acesse o [Render](https://render.com/) e faça login (pode usar sua conta do GitHub).
2. No Dashboard do Render, clique em **New** ➔ **Blueprint**.
3. Conecte sua conta do GitHub e selecione o repositório do projeto.
4. O Render lerá o `render.yaml` e solicitará o preenchimento das variáveis de ambiente:

### Variáveis de Ambiente no Render:

| Variável | Valor / Instrução |
| :--- | :--- |
| **`DATABASE_URL`** | Cole a Connection String copiada do Neon (Passo 2). Certifique-se de que termina com `?sslmode=require`. |
| **`GEMINI_API_KEY`** | Sua chave de API do Google Gemini (para o Tutor Pedagógico de IA). |
| **`SESSION_SECRET`** | *(Gerado automaticamente pelo Render como valor aleatório seguro)* |
| **`VITE_API_URL`** | A URL pública do seu app no Render (ex: `https://codetracker-ete.onrender.com`). |

5. Clique em **Apply** / **Create Blueprint**.

---

## Passo 5: Acompanhar o Deploy e Acessar o Sistema

1. O Render iniciará o primeiro build executando o script `build.sh`:
   * Instalação de dependências do Node.js (`npm install`)
   * Build da aplicação React (`npm run build`)
   * Instalação de dependências do Python (`pip install -r requirements.txt`)
2. Após o build, o Gunicorn iniciará o servidor Flask servindo a API e a interface React.
3. Quando o status mudar para **Live**, seu site estará no ar!

---

## 🔑 Credenciais Iniciais de Acesso

Ao abrir a URL do sistema no navegador, clique em **Acessar Plataforma / Login**:

* **Administrador do Sistema:**
  * **E-mail:** `admin@ete.edu.br`
  * **Senha:** `admin123`
  * *Acesso completo: cadastro de turmas, exercícios, professores, alunos e logs.*

* **Alunos de Demonstração:**
  * **Matrícula/E-mail:** `ETE2026001` (ou `ete2026001@ete.edu.br`)
  * **Senha:** `ETE2026001` (a própria matrícula é a senha padrão do aluno)

---

## 🔄 Atualizações Automáticas (Auto-Deploy)
Toda vez que você fizer um `git push` para a branch `main` no GitHub, o Render detectará a alteração, fará um novo build automaticamente e colocará a nova versão no ar sem nenhuma intervenção manual.
