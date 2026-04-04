// Lightweight session endpoint for client-side auth state.
// Replaces the NextAuth [...nextauth] catch-all.
// NOT behind middleware auth (so clients can check their auth state).
import { getSession } from "@/lib/auth-server"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json(session)
}
