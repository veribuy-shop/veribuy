/**
 * Database Seed Script
 * Creates sample data for development/testing
 * 
 * Run with: npx ts-node scripts/seed-database.ts
 */

import { PrismaClient as AuthClient } from '../services/auth-service/node_modules/.prisma/auth-client';
import { PrismaClient as UserClient } from '../services/user-service/node_modules/.prisma/user-client';
import { PrismaClient as ListingClient } from '../services/listing-service/node_modules/.prisma/listing-client';
import * as bcrypt from 'bcryptjs';

const authDb = new AuthClient();
const userDb = new UserClient();
const listingDb = new ListingClient();

async function main() {
  console.log('Starting database seed...\n');

  // Clean existing data (optional - comment out if you want to keep existing data)
  console.log('Cleaning existing data...');
  await listingDb.listing.deleteMany();
  await userDb.profile.deleteMany();
  await authDb.refreshToken.deleteMany();
  await authDb.user.deleteMany();
  console.log('Cleaned\n');

  // Create users
  console.log('Creating users...');
  
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  const seller1 = await authDb.user.create({
    data: {
      id: '772e1203-53ba-49ae-ab7e-61ef09b779ec',
      name: 'John Seller',
      email: 'john.seller@veribuy.com',
      passwordHash: hashedPassword,
      role: 'SELLER',
      isEmailVerified: true,
    },
  });

  const seller2 = await authDb.user.create({
    data: {
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'Jane Tech',
      email: 'jane.tech@veribuy.com',
      passwordHash: hashedPassword,
      role: 'SELLER',
      isEmailVerified: true,
    },
  });

  const buyer1 = await authDb.user.create({
    data: {
      id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      name: 'Mike Buyer',
      email: 'mike.buyer@veribuy.com',
      passwordHash: hashedPassword,
      role: 'BUYER',
      isEmailVerified: true,
    },
  });

  console.log(`Created ${seller1.email}`);
  console.log(`Created ${seller2.email}`);
  console.log(`Created ${buyer1.email}\n`);

  // Create user profiles
  console.log('Creating user profiles...');
  
  await userDb.profile.create({
    data: {
      userId: seller1.id,
      displayName: 'John Seller',
      firstName: 'John',
      lastName: 'Seller',
      phone: '+1-555-0101',
    },
  });

  await userDb.profile.create({
    data: {
      userId: seller2.id,
      displayName: 'Jane Tech',
      firstName: 'Jane',
      lastName: 'Tech',
      phone: '+1-555-0102',
    },
  });

  await userDb.profile.create({
    data: {
      userId: buyer1.id,
      displayName: 'Mike Buyer',
      firstName: 'Mike',
      lastName: 'Buyer',
      phone: '+1-555-0103',
    },
  });

  console.log('Created profiles\n');

  // Create sample listings
  console.log('Creating sample listings...');

  const listings = [
    {
      sellerId: seller1.id,
      title: 'iPhone 15 Pro Max - 256GB - Natural Titanium',
      description: 'Like new iPhone 15 Pro Max with all original accessories. Perfect condition, no scratches. Includes original box, charger, and case.',
      deviceType: 'SMARTPHONE' as const,
      brand: 'Apple',
      model: 'iPhone 15 Pro Max',
      price: 1099.99,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      imei: '359211234567890',
      serialNumber: 'F17ABC123456',
      trustLensStatus: 'PASSED' as const,
      viewCount: 42,
      publishedAt: new Date(),
    },
    {
      sellerId: seller1.id,
      title: 'MacBook Pro 14" M3 - 16GB RAM - 512GB SSD',
      description: 'Barely used MacBook Pro 14" with M3 chip. Perfect for developers and creators. Battery health at 100%. Comes with original charger.',
      deviceType: 'LAPTOP' as const,
      brand: 'Apple',
      model: 'MacBook Pro 14"',
      price: 1899.00,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      serialNumber: 'C02ABC123456',
      trustLensStatus: 'PASSED' as const,
      viewCount: 28,
      publishedAt: new Date(),
    },
    {
      sellerId: seller2.id,
      title: 'Samsung Galaxy S24 Ultra - 512GB - Titanium Black',
      description: 'Flagship Samsung Galaxy S24 Ultra. Unlocked for all carriers. Includes S Pen and protective case. Minor wear on edges.',
      deviceType: 'SMARTPHONE' as const,
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      price: 949.99,
      currency: 'GBP',
      conditionGrade: 'B' as const,
      status: 'ACTIVE' as const,
      imei: '359212345678901',
      serialNumber: 'R58DEF789012',
      trustLensStatus: 'PASSED' as const,
      viewCount: 35,
      publishedAt: new Date(),
    },
    {
      sellerId: seller2.id,
      title: 'iPad Pro 12.9" M2 - 256GB - Space Gray',
      description: 'Professional tablet with Magic Keyboard and Apple Pencil (2nd gen) included. Screen is pristine, no scratches.',
      deviceType: 'TABLET' as const,
      brand: 'Apple',
      model: 'iPad Pro 12.9"',
      price: 899.00,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      serialNumber: 'DMPABC456789',
      trustLensStatus: 'PASSED' as const,
      viewCount: 19,
      publishedAt: new Date(),
    },
    {
      sellerId: seller1.id,
      title: 'Google Pixel 8 Pro - 256GB - Obsidian',
      description: 'Unlocked Google Pixel 8 Pro with amazing camera. Android updates guaranteed. Mint condition with original packaging.',
      deviceType: 'SMARTPHONE' as const,
      brand: 'Google',
      model: 'Pixel 8 Pro',
      price: 749.99,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      imei: '359213456789012',
      serialNumber: 'G9S4GHI345678',
      trustLensStatus: 'PASSED' as const,
      viewCount: 15,
      publishedAt: new Date(),
    },
    {
      sellerId: seller2.id,
      title: 'Dell XPS 15 - i7-13700H - 32GB RAM - 1TB SSD',
      description: 'Powerful laptop for professionals. OLED 4K display, NVIDIA RTX 4050. Used for light work, excellent condition.',
      deviceType: 'LAPTOP' as const,
      brand: 'Dell',
      model: 'XPS 15',
      price: 1599.00,
      currency: 'GBP',
      conditionGrade: 'B' as const,
      status: 'ACTIVE' as const,
      serialNumber: 'JKL7890MNO12',
      trustLensStatus: 'PASSED' as const,
      viewCount: 22,
      publishedAt: new Date(),
    },
    {
      sellerId: seller1.id,
      title: 'Apple Watch Ultra 2 - 49mm - Titanium',
      description: 'Latest Apple Watch Ultra 2 with titanium case. Perfect for outdoor activities. All bands included.',
      deviceType: 'SMARTWATCH' as const,
      brand: 'Apple',
      model: 'Watch Ultra 2',
      price: 699.99,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      serialNumber: 'APPABC123XYZ',
      trustLensStatus: 'PASSED' as const,
      viewCount: 48,
      publishedAt: new Date(),
    },
    {
      sellerId: seller2.id,
      title: 'Sony PlayStation 5 - Disc Edition',
      description: 'PS5 console with two DualSense controllers and 3 AAA games. Barely used, like new condition.',
      deviceType: 'GAMING_CONSOLE' as const,
      brand: 'Sony',
      model: 'PlayStation 5',
      price: 449.99,
      currency: 'GBP',
      conditionGrade: 'A' as const,
      status: 'ACTIVE' as const,
      serialNumber: 'PS5XYZ789ABC',
      trustLensStatus: 'PASSED' as const,
      viewCount: 67,
      publishedAt: new Date(),
    },
  ];

  for (const listing of listings) {
    const created = await listingDb.listing.create({ data: listing });
    console.log(`Created: ${created.title}`);
  }

  console.log(`\nSeed completed! Created ${listings.length} listings.\n`);
  console.log('Test credentials:');
  console.log('   Seller 1: john.seller@veribuy.com / password123');
  console.log('   Seller 2: jane.tech@veribuy.com / password123');
  console.log('   Buyer 1:  mike.buyer@veribuy.com / password123\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await authDb.$disconnect();
    await userDb.$disconnect();
    await listingDb.$disconnect();
  });
