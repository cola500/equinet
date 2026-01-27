import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

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
      async $allOperations({ model, operation, args, query }: {
        model: string
        operation: string
        args: any
        query: (args: any) => Promise<any>
      }) {
        const timeout = 10000 // 10 seconds timeout for all queries

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Query timeout after ${timeout}ms: ${model}.${operation}`))
          }, timeout)
        })

        try {
          // Race between actual query and timeout
          return await Promise.race([query(args), timeoutPromise])
        } catch (error) {
          // Log query timeout errors for debugging
          if (error instanceof Error && error.message.includes('Query timeout')) {
            console.error('[Prisma Timeout]', {
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

export const prisma = globalForPrisma.prisma ?? prismaWithExtensions

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as any

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
