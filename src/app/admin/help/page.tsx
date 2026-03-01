"use client"

import { AdminLayout } from "@/components/layout/AdminLayout"
import { HelpCenter } from "@/components/help/HelpCenter"

export default function AdminHelpPage() {
  return (
    <AdminLayout>
      <HelpCenter role="admin" basePath="/admin/help" />
    </AdminLayout>
  )
}
