/**
 * Migration script to geocode existing providers
 *
 * This script:
 * 1. Finds all providers with address but no lat/lon coordinates
 * 2. Geocodes each address using Google Maps API
 * 3. Updates provider records with coordinates
 *
 * Usage:
 *   npx tsx prisma/migrate-geocode-providers.ts
 *
 * Requirements:
 *   - GOOGLE_MAPS_API_KEY must be set in .env
 *   - Providers must have address field populated
 */

import { PrismaClient } from '@prisma/client'
import { geocodeAddress } from '../src/lib/geocoding'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting provider geocoding migration...\n')

  // 1. Check API key
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables')
    console.error('   Please add it to your .env file')
    process.exit(1)
  }

  // 2. Find providers that need geocoding
  const providersToGeocode = await prisma.provider.findMany({
    where: {
      address: { not: null },
      latitude: null, // Only geocode if not already done
    },
    select: {
      id: true,
      businessName: true,
      address: true,
      city: true,
      postalCode: true,
    },
  })

  if (providersToGeocode.length === 0) {
    console.log('✅ No providers need geocoding. All done!')
    return
  }

  console.log(`📍 Found ${providersToGeocode.length} provider(s) to geocode:\n`)

  let successCount = 0
  let failCount = 0
  const failedProviders: Array<{ id: string; businessName: string; reason: string }> = []

  // 3. Geocode each provider
  for (const provider of providersToGeocode) {
    try {
      console.log(`   Processing: ${provider.businessName}`)
      console.log(`   Address: ${provider.address}, ${provider.city || ''}, ${provider.postalCode || ''}`)

      const geocoded = await geocodeAddress(
        provider.address!,
        provider.city || undefined,
        provider.postalCode || undefined
      )

      if (geocoded) {
        // Update provider with coordinates
        await prisma.provider.update({
          where: { id: provider.id },
          data: {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          },
        })

        console.log(`   ✅ Success: (${geocoded.latitude}, ${geocoded.longitude})`)
        console.log(`   Formatted: ${geocoded.formattedAddress}\n`)
        successCount++
      } else {
        console.log(`   ⚠️  Failed: Could not geocode address\n`)
        failCount++
        failedProviders.push({
          id: provider.id,
          businessName: provider.businessName,
          reason: 'Geocoding returned null (invalid address)',
        })
      }

      // 4. Rate limiting: Google Maps allows ~50 requests/sec
      // We use 20ms delay = 50 req/s max
      await sleep(20)

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      failCount++
      failedProviders.push({
        id: provider.id,
        businessName: provider.businessName,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // 5. Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Migration Summary:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Successfully geocoded: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`📈 Total processed: ${providersToGeocode.length}`)

  if (failedProviders.length > 0) {
    console.log('\n⚠️  Failed providers:')
    failedProviders.forEach((p) => {
      console.log(`   - ${p.businessName} (ID: ${p.id})`)
      console.log(`     Reason: ${p.reason}`)
    })
    console.log('\n💡 Tip: You can manually update these providers via the API')
  }

  console.log('\n✨ Migration complete!')
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run migration
main()
  .catch((error) => {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
