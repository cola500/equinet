"use client"

import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { PreparationChecklist } from "@/components/booking/PreparationChecklist"

export default function FAQPage() {
  return (
    <CustomerLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vanliga frågor</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Vad behöver jag förbereda inför besöket?
          </h2>
          <PreparationChecklist />
        </div>
      </div>
    </CustomerLayout>
  )
}
