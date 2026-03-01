"use client"

import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { notFound } from "next/navigation"

export default function CustomerHelpPage() {
  const helpEnabled = useFeatureFlag("help_center")

  if (!helpEnabled) {
    notFound()
  }

  return (
    <CustomerLayout>
      <HelpCenter role="customer" basePath="/customer/help" />
    </CustomerLayout>
  )
}
