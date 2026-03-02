import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Planos Nexora360
  const plans = [
    {
      name: 'starter',
      displayName: 'Starter',
      priceMonthly: 297.0,
      priceYearly: 2970.0,
      messageLimit: 500,
      isActive: true,
    },
    {
      name: 'profissional',
      displayName: 'Profissional',
      priceMonthly: 597.0,
      priceYearly: 5970.0,
      messageLimit: 2000,
      isActive: true,
    },
    {
      name: 'elite',
      displayName: 'Elite',
      priceMonthly: 997.0,
      priceYearly: 9970.0,
      messageLimit: 10000,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        messageLimit: plan.messageLimit,
        isActive: plan.isActive,
      },
      create: plan,
    });
    console.log(`✔ Plano ${plan.displayName} criado/atualizado`);
  }

  // Tenant demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'nexora-demo' },
    update: {
      nome: 'Nexora Demo',
      email: 'admin@nexora360.com',
      phone: '11999999999',
    },
    create: {
      nome: 'Nexora Demo',
      slug: 'nexora-demo',
      email: 'admin@nexora360.com',
      password: await bcrypt.hash('admin123', 10),
      phone: '11999999999',
      plano: 'starter',
      limiteMensagens: 500,
      mensagensUsadas: 0,
    },
  });
  console.log(`✔ Tenant demo: ${tenant.slug}`);

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nexora360.com' },
    update: { name: 'Admin', phone: '11999999999' },
    create: {
      name: 'Admin',
      email: 'admin@nexora360.com',
      password: await bcrypt.hash('admin123', 10),
      phone: '11999999999',
      role: 'owner',
      tenantId: tenant.id,
    },
  });
  console.log(`✔ Admin user: ${adminUser.email} (senha: admin123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
