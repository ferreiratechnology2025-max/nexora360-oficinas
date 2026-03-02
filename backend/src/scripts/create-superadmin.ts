/**
 * Cria o primeiro superadmin vinculado ao tenant "Nexora360 HQ".
 *
 * Uso:
 *   npx ts-node src/scripts/create-superadmin.ts <email> <senha>
 *
 * Exemplo:
 *   npx ts-node src/scripts/create-superadmin.ts admin@nexora360.cloud MinhaSenh@123
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Uso: npx ts-node src/scripts/create-superadmin.ts <email> <senha>');
    process.exit(1);
  }

  // 1. Garantir que o tenant HQ existe
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'nexora360-hq' } });

  if (!tenant) {
    const hqPassword = await bcrypt.hash('hq-internal-not-used', 10);
    tenant = await prisma.tenant.create({
      data: {
        nome: 'Nexora360 HQ',
        email: 'hq@nexora360.cloud',
        password: hqPassword,
        slug: 'nexora360-hq',
        plano: 'enterprise',
        status: 'active',
        isActive: true,
      },
    });
    console.log(`Tenant "Nexora360 HQ" criado (id: ${tenant.id})`);
  } else {
    console.log(`Tenant "Nexora360 HQ" já existe (id: ${tenant.id})`);
  }

  // 2. Verificar se o usuário já existe
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Erro: usuário com email "${email}" já existe.`);
    process.exit(1);
  }

  // 3. Criar o superadmin
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email,
      password: hashedPassword,
      role: 'superadmin',
      isActive: true,
      tenantId: tenant.id,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  console.log('\nSuperadmin criado com sucesso!');
  console.log(`  Email : ${user.email}`);
  console.log(`  Role  : ${user.role}`);
  console.log(`  ID    : ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
