"use client"

import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HelpCenter } from "@/components/help/HelpCenter"

export default function CustomerHelpPage() {
  return (
    <CustomerLayout>
      <HelpCenter role="customer" basePath="/customer/help" />
    </CustomerLayout>
  )
}
