import { notFound } from "next/navigation"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { getFeatureFlags } from "@/lib/feature-flags"
import { getAllArticles, getArticleSections } from "@/lib/help/index"

export default async function CustomerHelpPage() {
  const flags = await getFeatureFlags()
  if (!flags["help_center"]) notFound()

  const articles = getAllArticles("customer")
  const sections = getArticleSections("customer")

  return (
    <CustomerLayout>
      <HelpCenter
        initialArticles={articles}
        sections={sections}
        role="customer"
        basePath="/customer/help"
      />
    </CustomerLayout>
  )
}
