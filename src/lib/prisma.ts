import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

// Create base Prisma client with logging configuration
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

// Extend Prisma client with query timeout middleware
// Using modern Client Extension API (replaces deprecated $use middleware)
const prismaWithExtensions = basePrisma.$extends({
  query: {
    $allModels: {
      // Prisma extension callback types are complex generics -- narrowing beyond
      // the Prisma-provided types is not practical here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        const timeout = 10000 // 10 seconds timeout for all queries

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Query timeout after ${timeout}ms: ${model}.${operation}`))
          }, timeout)
        })

        const start = Date.now()

        try {
          // Race between actual query and timeout
          const result = await Promise.race([query(args), timeoutPromise])
          const duration = Date.now() - start

          // Log slow queries (skip in test environment)
          if (process.env.NODE_ENV !== 'test') {
            if (duration > 2000) {
              logger.warn(`Slow query: ${model}.${operation} took ${duration}ms`, {
                model,
                operation,
                duration,
              })
            } else if (duration > 500) {
              logger.database(`${model}.${operation} (${duration}ms)`, model, {
                duration,
              })
            }
          }

          return result
        } catch (error) {
          const duration = Date.now() - start

          // Log query timeout errors for debugging
          if (error instanceof Error && error.message.includes('Query timeout')) {
            logger.error(`Query timeout: ${model}.${operation} after ${duration}ms`, {
              model,
              operation,
              timeout: `${timeout}ms`,
            })
          }
          throw error
        }
      },
    },
  },
})

type PrismaWithExtensions = typeof prismaWithExtensions

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaWithExtensions | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaWithExtensions

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Database health check
 * Use this to verify database connectivity and monitor connection pool
 * Returns response time in milliseconds
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  responseTimeMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    await basePrisma.$queryRaw`SELECT 1`
    return {
      healthy: true,
      responseTimeMs: Date.now() - start,
    }
  } catch (error) {
    console.error('[Database Health Check Failed]', error)
    return {
      healthy: false,
      responseTimeMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
