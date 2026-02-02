/**
 * Seed script for creating test users for E2E tests
 * Run with: npx tsx prisma/seed-test-users.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding test users...')

  // Hasha lösenord
  const customerPassword = await bcrypt.hash('TestPassword123!', 10)
  const providerPassword = await bcrypt.hash('ProviderPass123!', 10)

  // Skapa eller uppdatera testkund
  const customer = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: 'test@example.com',
      passwordHash: customerPassword,
      firstName: 'Test',
      lastName: 'Testsson',
      phone: '0701234567',
      userType: 'customer',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
  console.log('✅ Customer created:', customer.email)

  // Skapa eller uppdatera testleverantör (user)
  const providerUser = await prisma.user.upsert({
    where: { email: 'provider@example.com' },
    update: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: 'provider@example.com',
      passwordHash: providerPassword,
      firstName: 'Leverantör',
      lastName: 'Testsson',
      phone: '0709876543',
      userType: 'provider',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  })
  console.log('✅ Provider user created:', providerUser.email)

  // Skapa provider-profil
  const provider = await prisma.provider.upsert({
    where: { userId: providerUser.id },
    update: {
      businessName: 'Test Stall AB',
      description: 'Vi erbjuder professionell hovslagning och hästskötsel',
      city: 'Stockholm',
      isActive: true,
    },
    create: {
      userId: providerUser.id,
      businessName: 'Test Stall AB',
      description: 'Vi erbjuder professionell hovslagning och hästskötsel',
      city: 'Stockholm',
      isActive: true,
    },
  })
  console.log('✅ Provider profile created:', provider.businessName)

  // Skapa några test-tjänster för leverantören (om de inte redan finns)
  const existingService1 = await prisma.service.findFirst({
    where: {
      providerId: provider.id,
      name: 'Hovslagning Standard'
    }
  })

  const service1 = existingService1 || await prisma.service.create({
    data: {
      providerId: provider.id,
      name: 'Hovslagning Standard',
      description: 'Grundläggande hovslagning för alla hästar',
      price: 800,
      durationMinutes: 60,
      isActive: true,
    },
  })
  console.log('✅ Service created:', service1.name)

  const existingService2 = await prisma.service.findFirst({
    where: {
      providerId: provider.id,
      name: 'Ridlektion'
    }
  })

  const service2 = existingService2 || await prisma.service.create({
    data: {
      providerId: provider.id,
      name: 'Ridlektion',
      description: 'Privat ridlektion för alla nivåer',
      price: 500,
      durationMinutes: 45,
      isActive: true,
    },
  })
  console.log('✅ Service created:', service2.name)

  // Skapa en test-bokning (pending status)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(14, 0, 0, 0)

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      providerId: provider.id,
      serviceId: service1.id,
      bookingDate: tomorrow,
      startTime: '14:00',
      endTime: '15:00',
      horseName: 'Thunder',
      horseInfo: 'Lugn och trygg häst',
      customerNotes: 'Test-bokning för E2E-tester',
      status: 'pending',
    },
  })
  console.log('✅ Test booking created:', booking.id)

  console.log('\n🎉 Seed completed successfully!')
  console.log('\nTest Users:')
  console.log('📧 Customer: test@example.com / TestPassword123!')
  console.log('📧 Provider: provider@example.com / ProviderPass123!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
