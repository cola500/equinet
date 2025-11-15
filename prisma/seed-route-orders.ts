// Seed script for route orders with Göteborg addresses
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Göteborg test addresses with coordinates
const goteborgAddresses = [
  {
    address: "Avenyn 45, Göteborg",
    latitude: 57.7003,
    longitude: 11.9669,
  },
  {
    address: "Haga Nygata 20, Göteborg",
    latitude: 57.6988,
    longitude: 11.9547,
  },
  {
    address: "Karl Johansgatan 88, Göteborg",
    latitude: 57.6944,
    longitude: 11.9190,
  },
  {
    address: "Lindholmen 5, Göteborg",
    latitude: 57.7389,
    longitude: 11.9673,
  },
  {
    address: "Frölunda Torg 3, Göteborg",
    latitude: 57.6527,
    longitude: 11.9159,
  },
  {
    address: "Kungsbackavägen 120, Mölndal",
    latitude: 57.6558,
    longitude: 12.0134,
  },
  {
    address: "Torslanda Torg 12, Göteborg",
    latitude: 57.7294,
    longitude: 11.7742,
  },
  {
    address: "Partihallsvägen 8, Partille",
    latitude: 57.7394,
    longitude: 12.1061,
  },
]

async function main() {
  console.log('🌱 Seeding route orders with Göteborg addresses...')

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
  const dateFrom = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
  const dateTo = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 2 weeks from now

  for (let i = 0; i < goteborgAddresses.length; i++) {
    const addr = goteborgAddresses[i]
    const serviceTypes = ['hovslagning', 'massage', 'tandvård', 'veterinär']
    const priorities = ['normal', 'normal', 'normal', 'urgent'] // 75% normal, 25% urgent

    const order = await prisma.routeOrder.create({
      data: {
        customerId: testCustomer.id,
        serviceType: serviceTypes[i % serviceTypes.length],
        address: addr.address,
        latitude: addr.latitude,
        longitude: addr.longitude,
        numberOfHorses: Math.floor(Math.random() * 3) + 1, // 1-3 hästar
        dateFrom,
        dateTo,
        priority: priorities[i % priorities.length],
        specialInstructions: i % 2 === 0 ? 'Parkera vid stora gården' : null,
        contactPhone: testCustomer.phone || '0701234567',
        status: 'pending'
      }
    })

    console.log(`✅ Created route order: ${addr.address} (${order.serviceType})`)
  }

  console.log('\n✅ Route order seeding complete!')
  console.log(`   Created ${goteborgAddresses.length} route orders in Göteborg area`)
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
