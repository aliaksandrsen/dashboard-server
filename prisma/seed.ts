import 'dotenv/config';
import { PrismaClient, type Product } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const main = async () => {
  console.log('🧹 Clearing old data and resetting IDs...');
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "User", "Order", "Product", "_OrderToProduct" RESTART IDENTITY CASCADE;`,
  );

  console.log('🌱 Starting seeding (5 products, 5 orders)...');

  // 1. Create a user
  const user = await db.user.create({
    data: {
      name: faker.person.fullName(),
      address: faker.location.streetAddress(),
      email: faker.internet.email(),
    },
  });

  // 2. Create 5 products
  const createdProducts: Product[] = [];
  for (let i = 0; i < 5; i++) {
    const product = await db.product.create({
      data: {
        id: faker.string.uuid(),
        name: faker.commerce.productName(),
        price: faker.number.float({ min: 35, max: 1055, fractionDigits: 2 }),
        createdAt: faker.date.anytime(),
        updatedAt: faker.date.anytime(),
      },
    });
    createdProducts.push(product);
  }

  // 3. Create 5 orders linked to the user and random products (1-3 products per order)
  for (let i = 0; i < 5; i++) {
    const randomProducts = faker.helpers.arrayElements(
      createdProducts,
      faker.number.int({ min: 1, max: 3 }),
    );

    await db.order.create({
      data: {
        total: faker.number.float({ min: 50, max: 5000, fractionDigits: 2 }),
        createdAt: faker.date.anytime(),
        updatedAt: faker.date.anytime(),
        userId: user.id,
        products: {
          connect: randomProducts.map((p) => ({ id: p.id })),
        },
      },
    });
  }

  console.log(
    '✅ Seeding completed! Created 1 user, 5 products, and 5 orders.',
  );
};

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding error:', e);
    await db.$disconnect();
    process.exit(1);
  });
