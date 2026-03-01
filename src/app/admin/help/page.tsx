"use client"

import { AdminLayout } from "@/components/layout/AdminLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { notFound } from "next/navigation"

export default function AdminHelpPage() {
  const helpEnabled = useFeatureFlag("help_center")

  if (!helpEnabled) {
    notFound()
  }

  return (
    <AdminLayout>
      <HelpCenter role="admin" basePath="/admin/help" />
    </AdminLayout>
  )
}
