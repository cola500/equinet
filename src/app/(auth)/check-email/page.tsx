"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">Kontrollera din e-post</CardTitle>
          <CardDescription>
            Vi har skickat en verifieringslanks till din e-postadress.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600 space-y-2">
            <p>
              Klicka pa lanken i mailet for att verifiera ditt konto.
              Lanken ar giltig i 24 timmar.
            </p>
            <p>
              Hittade du inte mailet? Kolla skrappost/spam-mappen.
            </p>
          </div>

          <div className="pt-4 border-t space-y-3">
            <Link href="/resend-verification" className="block">
              <Button variant="outline" className="w-full">
                Skicka nytt verifieringsmail
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                Tillbaka till inloggning
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
