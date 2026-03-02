# 🧪 TESTES NO POSTMAN - MÓDULOS IMPLEMENTADOS

## 🔐 FLUXO COMPLETO DE TESTE

### 1. ✅ Criar Nova Oficina (Register Tenant)

**POST** `http://localhost:3000/auth/register-tenant`

```json
{
  "nome": "Oficina Teste",
  "email": "teste@oficina.com",
  "password": "123456",
  "phone": "+5511999999999"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Oficina Teste",
    "email": "teste@oficina.com",
    "phone": "+5511999999999",
    "role": "owner",
    "createdAt": "timestamp"
  },
  "tenant": {
    "id": "uuid",
    "nome": "Oficina Teste",
    "email": "teste@oficina.com",
    "plano": "basic",
    "limiteMensagens": 500
  },
  "accessToken": "jwt_token",
  "tokenType": "Bearer"
}
```

---

### 2. ✅ Login com Tenant

**POST** `http://localhost:3000/auth/login`

```json
{
  "email": "teste@oficina.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Oficina Teste",
    "email": "teste@oficina.com",
    "role": "owner"
  },
  "tenant": {
    "id": "uuid",
    "nome": "Oficina Teste"
  },
  "accessToken": "jwt_token",
  "tokenType": "Bearer"
}
```

---

### 3. ✅ Ver Dados da Oficina (GET /tenants/me)

**GET** `http://localhost:3000/tenants/me`

**Headers:**
```
Authorization: Bearer <seu_token>
```

**Response:**
```json
{
  "id": "uuid",
  "nome": "Oficina Teste",
  "email": "teste@oficina.com",
  "phone": "+5511999999999",
  "openingTime": "08:00",
  "plano": "basic",
  "limiteMensagens": 500,
  "mensagensUsadas": 0,
  "isActive": true,
  "createdAt": "timestamp",
  "users": [...],
  "_count": {
    "customers": 0,
    "vehicles": 0,
    "orders": 0
  }
}
```

---

### 4. ✅ Atualizar Dados da Oficina (PUT /tenants/me)

**PUT** `http://localhost:3000/tenants/me`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "nome": "Oficina Teste Atualizada",
  "openingTime": "08:00",
  "limiteMensagens": 1000
}
```

---

### 5. ✅ Configurar Uazapi (PUT /tenants/uazapi)

**PUT** `http://localhost:3000/tenants/uazapi`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "uazapiInstanceId": "instance_id",
  "uazapiToken": "token"
}
```

---

### 6. ✅ Ver Uso de Mensagens (GET /tenants/usage)

**GET** `http://localhost:3000/tenants/usage`

**Headers:**
```
Authorization: Bearer <seu_token>
```

**Response:**
```json
{
  "mensagens": {
    "usadas": 5,
    "limite": 1000,
    "percentual": 0.5
  },
  "ordensMes": 3
}
```

---

### 7. ✅ Ver Dashboard (GET /tenants/dashboard)

**GET** `http://localhost:3000/tenants/dashboard`

**Headers:**
```
Authorization: Bearer <seu_token>
```

**Response:**
```json
{
  "todayOrders": 5,
  "pendingApprovals": 2,
  "monthlyRevenue": 1500.50
}
```

---

### 8. ✅ Criar Mecânico (POST /users)

**POST** `http://localhost:3000/users`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "name": "João Mecânico",
  "email": "joao@oficina.com",
  "password": "123456",
  "phone": "+5511988888888",
  "commissionRate": 10
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "João Mecânico",
  "email": "joao@oficina.com",
  "role": "mechanic",
  "phone": "+5511988888888",
  "commissionRate": 10,
  "isActive": true,
  "createdAt": "timestamp"
}
```

---

### 9. ✅ Listar Todos os Usuários (GET /users)

**GET** `http://localhost:3000/users`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 10. ✅ Listar Mecânicos Ativos (GET /users/mechanics)

**GET** `http://localhost:3000/users/mechanics`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 11. ✅ Criar Cliente (POST /customers)

**POST** `http://localhost:3000/customers`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "name": "Cliente Teste",
  "email": "cliente@teste.com",
  "phone": "+5511977777777",
  "cpf": "12345678900",
  "address": "Rua das Flores",
  "number": "123",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01000-000"
}
```

---

### 12. ✅ Criar Veículo (POST /vehicles)

**POST** `http://localhost:3000/vehicles`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "brand": "Honda",
  "model": "Civic",
  "year": "2020",
  "plate": "ABC1234",
  "color": "Prata",
  "customerId": "<id_do_cliente>"
}
```

---

### 13. ✅ Criar Ordem de Serviço (POST /orders)

**POST** `http://localhost:3000/orders`

**Headers:**
```
Authorization: Bearer <seu_token>
Content-Type: application/json
```

```json
{
  "customerId": "<id_do_cliente>",
  "vehicleId": "<id_do_veiculo>",
  "mechanicId": "<id_do_mecanico>",
  "problemDescription": "Motor fazendo barulho",
  "laborValue": 150,
  "partsValue": 200,
  "estimatedDays": 5
}
```

---

### 14. ✅ Listar Ordens de Serviço (GET /orders)

**GET** `http://localhost:3000/orders`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 15. ✅ Buscar Ordem por Número (GET /orders/number/:number)

**GET** `http://localhost:3000/orders/number/OS-abc123-456789`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 16. ✅ Aprovar Ordem (POST /orders/:id/approve)

**POST** `http://localhost:3000/orders/<id>/approve`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 17. ✅ Completar Ordem (POST /orders/:id/complete)

**POST** `http://localhost:3000/orders/<id>/complete`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

### 18. ✅ Entregar Ordem (POST /orders/:id/deliver)

**POST** `http://localhost:3000/orders/<id>/deliver`

**Headers:**
```
Authorization: Bearer <seu_token>
```

---

## 🔒 VERIFICAÇÃO DE SEGURANÇA

### ✓ Teste 1: Usuário de outra oficina não deve acessar
1. Crie uma segunda oficina com outro email
2. Tente acessar os dados da primeira oficina com o token da segunda
3. Deve receber erro 401 ou 404

### ✓ Teste 2: Mecânico não pode criar outros usuários
1. Crie um mecânico
2. Tente criar um novo usuário com o token do mecânico
3. Deve receber erro 403 (Forbidden)

### ✓ Teste 3: Proprietário pode criar usuários
1. Use o token do owner
2. Crie um novo usuário
3. Deve ser bem sucedido

---

## 📊 FLUXO COMPLETO DE NEGÓCIO

```
1. Criar Oficina (Register Tenant)
   ↓
2. Login com tenant
   ↓
3. Criar Mecânico
   ↓
4. Criar Cliente
   ↓
5. Criar Veículo do Cliente
   ↓
6. Criar Ordem de Serviço
   ↓
7. Mecânico trabalha na ordem
   ↓
8. Aprovar Ordem (se precisar autorização)
   ↓
9. Completar Ordem
   ↓
10. Entregar Ordem
   ↓
11. Enviar notificação WhatsApp (via módulo WhatsApp)
   ↓
12. Enviar email de confirmação (via módulo Emails)
```

---

## 🚀 PRÓXIMOS MÓDULOS A SEREM IMPLEMENTADOS

### Módulo 3: Customers (Clientes) ✅
- ✅ CRUD completo com tenantId
- ✅ Filtros por nome, email, phone
- ✅ Lista de veículos do cliente

### Módulo 4: Vehicles (Veículos) ✅
- ✅ CRUD completo com tenantId
- ✅ Filtros por placa, cliente
- ✅ Lista de ordens do veículo

### Módulo 5: Orders (Ordens de Serviço) ✅
- ✅ CRUD completo com tenantId
- ✅ Status tracking (received → waiting_approval → completed → delivered)
- ✅ Calculo de valor total
- ✅ Filtros por mecânico, status, data

### Módulo 6: Notifications (Notificações) 🔄
- WhatsApp messages
- Email notifications
- In-app notifications

### Módulo 7: Reports (Relatórios) 📊
- Relatórios financeiros
- Relatórios de ordens
- Exportação para Excel/PDF
