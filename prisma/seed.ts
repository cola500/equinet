/**
 * Seed script for Equinet database (Idempotent)
 *
 * Creates test data with providers in multiple cities.
 * Only seeds if the database is empty (no existing providers).
 *
 * Run with: npm run db:seed
 * Force re-seed: npm run db:seed:force
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const forceReseed = process.argv.includes('--force')

  // Check if database already has providers
  const existingProviders = await prisma.provider.count()

  if (existingProviders > 0 && !forceReseed) {
    console.log(`Database already has ${existingProviders} providers. Skipping seed.`)
    console.log('Use --force to reseed: npm run db:seed:force')
    return
  }

  if (forceReseed && existingProviders > 0) {
    console.log('Force reseed requested. Clearing existing data...')
    // Clear existing data (in correct order to respect foreign keys)
    await prisma.routeStop.deleteMany()
    await prisma.routeOrder.deleteMany()
    await prisma.route.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.availability.deleteMany()
    await prisma.service.deleteMany()
    await prisma.provider.deleteMany()
    await prisma.user.deleteMany()
    console.log('Cleared existing data')
  }

  console.log('Seeding database...')

  // Hash password for all test users
  const passwordHash = await bcrypt.hash('test123', 10)

  // Create providers with their users and services
  const providers = [
    {
      user: {
        email: 'erik@hovslagare-uppsala.se',
        firstName: 'Erik',
        lastName: 'Eriksson',
        userType: 'provider',
        phone: '070-123 45 67',
      },
      provider: {
        businessName: 'Hovslagare Eriksson',
        description: 'Erfaren hovslagare med över 20 års erfarenhet. Specialiserad på sportponnyer och dressyrhästar.',
        city: 'Uppsala',
        address: 'Stallvägen 12',
        postalCode: '75320',
        latitude: 59.8586,
        longitude: 17.6389,
        serviceAreaKm: 50,
        isActive: true,
      },
      services: [
        { name: 'Skoning', description: 'Komplett skoning med nya skor', price: 1800, durationMinutes: 90 },
        { name: 'Verkning', description: 'Verkning utan skor', price: 800, durationMinutes: 45 },
        { name: 'Akutbesök', description: 'Akut hovslagarbesök', price: 2500, durationMinutes: 60 },
      ],
    },
    {
      user: {
        email: 'anna@hastvard-goteborg.se',
        firstName: 'Anna',
        lastName: 'Johansson',
        userType: 'provider',
        phone: '073-234 56 78',
      },
      provider: {
        businessName: 'Västkustens Hästvård',
        description: 'Legitimerad veterinär och hästmassör. Erbjuder komplett hästvård från veterinärbesök till avslappnande massage.',
        city: 'Göteborg',
        address: 'Hästgatan 5',
        postalCode: '41708',
        latitude: 57.7089,
        longitude: 11.9746,
        serviceAreaKm: 60,
        isActive: true,
      },
      services: [
        { name: 'Veterinärbesök', description: 'Rutinkontroll och vaccinationer', price: 1500, durationMinutes: 60 },
        { name: 'Hästmassage', description: 'Avslappnande massage för tävlingshästar', price: 900, durationMinutes: 45 },
        { name: 'Tandkontroll', description: 'Kontroll och raspning av tänder', price: 1200, durationMinutes: 40 },
      ],
    },
    {
      user: {
        email: 'lars@ridskola-malmo.se',
        firstName: 'Lars',
        lastName: 'Svensson',
        userType: 'provider',
        phone: '076-345 67 89',
      },
      provider: {
        businessName: 'Skånes Ridskola',
        description: 'Diplomerad ridlärare med inriktning på dressyr och hoppning. Undervisar alla nivåer från nybörjare till tävlingsryttare.',
        city: 'Malmö',
        address: 'Ridvägen 8',
        postalCode: '21432',
        latitude: 55.6050,
        longitude: 13.0038,
        serviceAreaKm: 40,
        isActive: true,
      },
      services: [
        { name: 'Ridlektion - Nybörjare', description: 'Grundläggande ridlektion för nybörjare', price: 600, durationMinutes: 60 },
        { name: 'Dressyrträning', description: 'Avancerad dressyrträning', price: 900, durationMinutes: 60 },
        { name: 'Hoppträning', description: 'Hoppträning för tävlingsryttare', price: 900, durationMinutes: 60 },
      ],
    },
    {
      user: {
        email: 'maria@hovservice-alingsas.se',
        firstName: 'Maria',
        lastName: 'Andersson',
        userType: 'provider',
        phone: '070-456 78 90',
      },
      provider: {
        businessName: 'Alingsås Hovservice',
        description: 'Certifierad hovslagare som arbetar med alla typer av hästar. Flexibla tider och snabb service.',
        city: 'Alingsås',
        address: 'Smedjegatan 3',
        postalCode: '44130',
        latitude: 57.9303,
        longitude: 12.5331,
        serviceAreaKm: 45,
        isActive: true,
      },
      services: [
        { name: 'Skoning', description: 'Komplett skoning', price: 1700, durationMinutes: 90 },
        { name: 'Verkning', description: 'Verkning och hovvård', price: 750, durationMinutes: 45 },
      ],
    },
    {
      user: {
        email: 'karin@test-stall.se',
        firstName: 'Karin',
        lastName: 'Lindqvist',
        userType: 'provider',
        phone: '072-567 89 01',
      },
      provider: {
        businessName: 'Test Stall AB',
        description: 'Komplett hästservice i Stockholm. Hovslagning, ridlektioner och stalluthyrning.',
        city: 'Stockholm',
        address: 'Kungsgatan 42',
        postalCode: '11135',
        latitude: 59.3350,
        longitude: 18.0716,
        serviceAreaKm: 30,
        isActive: true,
      },
      services: [
        { name: 'Hovslagning', description: 'Professionell skoning', price: 1900, durationMinutes: 90 },
        { name: 'Ridlektion', description: 'Privat ridlektion', price: 700, durationMinutes: 60 },
        { name: 'Stallhyra', description: 'Hyra av stallplats per månad', price: 5000, durationMinutes: 30 },
      ],
    },
  ]

  // Create each provider with user and services
  for (const data of providers) {
    const user = await prisma.user.create({
      data: {
        ...data.user,
        passwordHash,
      },
    })

    const provider = await prisma.provider.create({
      data: {
        ...data.provider,
        userId: user.id,
      },
    })

    for (const service of data.services) {
      await prisma.service.create({
        data: {
          ...service,
          providerId: provider.id,
          isActive: true,
        },
      })
    }

    // Create availability: Mon-Fri 09:00-17:00, Sat-Sun closed
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isClosed = dayOfWeek >= 5 // Saturday (5) and Sunday (6) are closed
      await prisma.availability.create({
        data: {
          providerId: provider.id,
          dayOfWeek,
          startTime: isClosed ? '00:00' : '09:00',
          endTime: isClosed ? '00:00' : '17:00',
          isClosed,
          isActive: true,
        },
      })
    }

    console.log(`Created provider: ${data.provider.businessName} (${data.provider.city})`)
  }

  // Create a test customer
  const customer = await prisma.user.create({
    data: {
      email: 'kund@test.se',
      passwordHash,
      firstName: 'Test',
      lastName: 'Kund',
      userType: 'customer',
      phone: '070-111 22 33',
    },
  })
  console.log(`Created customer: ${customer.firstName} ${customer.lastName}`)

  console.log('\nSeeding complete!')
  console.log('Test accounts:')
  console.log('- Provider: erik@hovslagare-uppsala.se / test123')
  console.log('- Provider: anna@hastvard-goteborg.se / test123')
  console.log('- Provider: lars@ridskola-malmo.se / test123')
  console.log('- Provider: maria@hovservice-alingsas.se / test123')
  console.log('- Provider: karin@test-stall.se / test123')
  console.log('- Customer: kund@test.se / test123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
