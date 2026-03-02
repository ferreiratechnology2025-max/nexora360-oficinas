# Nexora AG - Sistema de Gestão de Oficina

Backend Node.js com TypeScript, Prisma ORM e PostgreSQL para gestão de oficina mecânica.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **TypeScript** - Tipagem estática
- **NestJS** - Framework para construção de APIs
- **Prisma** - ORM para Node.js
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação e autorização
- **Multer** - Upload de arquivos
- **Nodemailer** - Envio de e-mails
- **WhatsApp API** - Integração com WhatsApp

## 📋 Pré-requisitos

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm ou yarn

## 🔧 Instalação

### 1. Clonar/navegar para o projeto

```bash
cd C:\Users\becat\nexora-ag\backend
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar .env

Copie o arquivo `.env.example` para `.env` e preencha as variáveis:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nexora_ag?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
NODE_ENV=development
PORT=3000
```

### 4. Rodar migrations

```bash
npx prisma migrate dev
```

### 5. Inserir planos no banco

```bash
npx prisma studio
```

Ou execute o SQL manualmente:

```sql
INSERT INTO "Plan" (id, name, "displayName", "priceMonthly", "messageLimit", "isActive")
VALUES 
  ('basic', 'basic', 'Básico', 97.00, 500, true),
  ('pro', 'pro', 'Profissional', 197.00, 2000, true),
  ('enterprise', 'enterprise', 'Enterprise', 397.00, 10000, true);
```

### 6. Iniciar servidor

```bash
npm run start:dev
```

O servidor estará rodando em: `http://localhost:3000`

## 📚 Documentação da API

A documentação interativa está disponível em: `http://localhost:3000/api`

## 🔑Endpoints Principais

### Autenticação
- `POST /auth/register` - Registrar novo usuário
- `POST /auth/login` - Fazer login

### Clientes
- `POST /customers` - Criar cliente
- `GET /customers` - Listar clientes
- `GET /customers/:id` - Buscar cliente por ID
- `PUT /customers/:id` - Atualizar cliente
- `DELETE /customers/:id` - Deletar cliente

### Veículos
- `POST /vehicles` - Criar veículo
- `GET /vehicles` - Listar veículos
- `GET /vehicles/:id` - Buscar veículo por ID

### Ordens de Serviço
- `POST /orders` - Criar OS (gera número automaticamente)
- `GET /orders` - Listar OS
- `GET /orders/number/:number` - Buscar OS por número
- `GET /orders/:id` - Buscar OS por ID
- `PUT /orders/:id` - Atualizar OS

### Upload de Arquivos
- `POST /files/upload` - Upload de fotos (use multipart/form-data)

### Webhook WhatsApp
- `POST /whatsapp/webhook` - Receber mensagens do WhatsApp (público)

## 🔍 Checklist para Validação

- [x] Backend compila sem erros
- [x] Banco de dados conectado
- [x] POST /auth/register funciona
- [x] POST /auth/login retorna JWT
- [x] Criar cliente → Criar veículo → Criar OS (gera número)
- [x] Upload de foto funciona
- [x] Webhook do WhatsApp (testar com ngrok)
- [x] CRONs estão agendados

## 🤖 CRONs Automáticos

- `every hour` - Atualizar ordens pendentes
- `every day at midnight` - Enviar lembretes de ordens
- `every week` - Gerar relatórios semanais

## 🌐 Webhook do WhatsApp (com Ngrok)

Para testar o webhook:

```bash
# Instalar ngrok
npm install -g ngrok

# Expor a porta 3000
ngrok http 3000
```

Configure o webhook no painel do WhatsApp API com a URL do ngrok + `/whatsapp/webhook`

## 📱 Testando com Postman/Insomnia

1. Cadastre um usuário via `POST /auth/register`
2. Faça login via `POST /auth/login` e copie o token JWT
3. Use o token nos headers `Authorization: Bearer <token>`
4. Crie clientes, veículos e ordens de serviço

## 📝 Observações

- As senhas são criptografadas com bcrypt
- Os uploads de arquivos são salvos em `./uploads`
- Logs são salvos no banco para e-mail e WhatsApp
- O sistema gera números sequenciais para ordens de serviço automaticamente
