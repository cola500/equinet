// Server Component -- no "use client" needed
export function DevBanner() {
  if (process.env.NODE_ENV === 'production') return null

  const dbUrl = process.env.DATABASE_URL || ''
  const isLocalDb = dbUrl.includes('localhost')
  const dbLabel = isLocalDb ? 'Lokal DB' : 'Supabase'

  return (
    <div className="bg-amber-500 text-amber-950 text-center text-xs font-medium py-1 px-2">
      Utvecklingsmiljö &mdash; {dbLabel}
    </div>
  )
}
