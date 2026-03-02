#!/bin/bash

echo "Nexora AG - Instalando dependências..."
echo "====================================="

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "Próximos passos:"
echo "1. Configure o arquivo .env com suas credenciais do banco de dados"
echo "2. Execute: npx prisma migrate dev"
echo "3. Execute: npx prisma db seed"
echo "4. Inicie o servidor: npm run start:dev"
