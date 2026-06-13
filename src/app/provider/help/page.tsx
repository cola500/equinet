"use client"

import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { HelpCenter } from "@/components/help/HelpCenter"

export default function ProviderHelpPage() {
  return (
    <ProviderLayout>
      <HelpCenter role="provider" basePath="/provider/help" />
    </ProviderLayout>
  )
}
