"use client"

import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { notFound } from "next/navigation"

export default function ProviderHelpPage() {
  const helpEnabled = useFeatureFlag("help_center")

  if (!helpEnabled) {
    notFound()
  }

  return (
    <ProviderLayout>
      <HelpCenter role="provider" basePath="/provider/help" />
    </ProviderLayout>
  )
}
