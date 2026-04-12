import { notFound } from "next/navigation"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { getFeatureFlags } from "@/lib/feature-flags"
import { getAllArticles, getArticleSections } from "@/lib/help/index"

export default async function ProviderHelpPage() {
  const flags = await getFeatureFlags()
  if (!flags["help_center"]) notFound()

  const articles = getAllArticles("provider")
  const sections = getArticleSections("provider")

  return (
    <ProviderLayout>
      <HelpCenter
        initialArticles={articles}
        sections={sections}
        role="provider"
        basePath="/provider/help"
      />
    </ProviderLayout>
  )
}
