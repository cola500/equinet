import { notFound } from "next/navigation"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { getFeatureFlags } from "@/lib/feature-flags"
import { getArticle } from "@/lib/help/index"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProviderHelpArticlePage({ params }: Props) {
  const { slug } = await params
  const flags = await getFeatureFlags()
  if (!flags["help_center"]) notFound()

  const article = getArticle(slug, "provider")
  if (!article) notFound()

  return (
    <ProviderLayout>
      <HelpArticleView article={article} backHref="/provider/help" />
    </ProviderLayout>
  )
}
