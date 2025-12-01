// Seed script for extended route orders with longer distances (10-30 km)
// Covers Göteborg region with realistic spread
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Extended Göteborg region addresses (10-30 km spread)
const extendedAddresses = [
  // Göteborgsstaden (3 st)
  {
    address: "Avenyn 45, Göteborg",
    latitude: 57.7003,
    longitude: 11.9669,
  },
  {
    address: "Haga Nygata 25, Göteborg",
    latitude: 57.6988,
    longitude: 11.9547,
  },
  {
    address: "Sisjön Fritidsområde, Göteborg",
    latitude: 57.6389,
    longitude: 12.0233,
  },
  // Sydväst (3 st)
  {
    address: "Mölndals Centrum, Mölndal",
    latitude: 57.6558,
    longitude: 12.0134,
  },
  {
    address: "Kungsbacka Stationsväg, Kungsbacka",
    latitude: 57.4875,
    longitude: 12.0775,
  },
  {
    address: "Landvetter Centrum, Härryda",
    latitude: 57.6833,
    longitude: 12.2833,
  },
  // Norr (3 st)
  {
    address: "Kungälv Tingshuset, Kungälv",
    latitude: 57.8708,
    longitude: 11.9803,
  },
  {
    address: "Ytterby Kyrka, Kungälv",
    latitude: 57.8894,
    longitude: 11.9150,
  },
  {
    address: "Bohus-Björkö, Kungälv",
    latitude: 57.9211,
    longitude: 11.9156,
  },
  // Öst (3 st)
  {
    address: "Partille Centrum, Partille",
    latitude: 57.7394,
    longitude: 12.1061,
  },
  {
    address: "Alingsås Stationsområde, Alingsås",
    latitude: 57.9308,
    longitude: 12.5347,
  },
  {
    address: "Vårgårda Centrum, Vårgårda",
    latitude: 58.0347,
    longitude: 12.8086,
  },
  // Väst (3 st)
  {
    address: "Torslanda Flygplats, Göteborg",
    latitude: 57.7294,
    longitude: 11.7742,
  },
  {
    address: "Tjörn Skärhamn, Tjörn",
    latitude: 58.0267,
    longitude: 11.5633,
  },
  {
    address: "Stenungsund Centrum, Stenungsund",
    latitude: 58.0706,
    longitude: 11.8239,
  },
  // Omkringliggande (3 st)
  {
    address: "Lerum Centrum, Lerum",
    latitude: 57.7708,
    longitude: 12.2694,
  },
  {
    address: "Gråbo Station, Lerum",
    latitude: 57.7539,
    longitude: 12.3847,
  },
  {
    address: "Frölunda Torg, Göteborg",
    latitude: 57.6527,
    longitude: 11.9159,
  },
]

async function main() {
  console.log('🌱 Seeding extended route orders (10-30 km spread)...')

  // Check if test customer exists
  const testCustomer = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  })

  if (!testCustomer) {
    console.log('❌ Test customer (test@example.com) not found!')
    console.log('   Run: npx tsx prisma/seed-test-users.ts first')
    return
  }

  // Create route orders
  const now = new Date()
  const serviceTypes = ['hovslagning', 'massage', 'tandvård', 'veterinär']
  const priorities = ['normal', 'normal', 'normal', 'normal', 'urgent'] // 80% normal, 20% urgent

  for (let i = 0; i < extendedAddresses.length; i++) {
    const addr = extendedAddresses[i]

    // Randomize date ranges (1-3 days from now, lasting ~7 days)
    const daysOffset = Math.floor(Math.random() * 3) + 1 // 1-3 days
    const dateFrom = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000)
    const dateTo = new Date(dateFrom.getTime() + 7 * 24 * 60 * 60 * 1000)

    const order = await prisma.routeOrder.create({
      data: {
        customerId: testCustomer.id,
        serviceType: serviceTypes[i % serviceTypes.length],
        address: addr.address,
        latitude: addr.latitude,
        longitude: addr.longitude,
        numberOfHorses: Math.floor(Math.random() * 4) + 1, // 1-4 hästar
        dateFrom,
        dateTo,
        priority: priorities[i % priorities.length] as 'normal' | 'urgent',
        specialInstructions: i % 3 === 0 ? 'Parkera vid stora gården' : null,
        contactPhone: testCustomer.phone || '0701234567',
        status: 'pending'
      }
    })

    console.log(`✅ Created route order: ${addr.address} (${order.serviceType})`)
  }

  console.log('\n✅ Extended route order seeding complete!')
  console.log(`   Created ${extendedAddresses.length} route orders across Göteborg region`)
  console.log('   Distances: 10-30 km between locations')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
