"use client"

import { useParams } from "next/navigation"
import { notFound } from "next/navigation"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { getArticle } from "@/lib/help/index"

export default function ProviderHelpArticlePage() {
  const params = useParams()
  const slug = params.slug as string
  const helpEnabled = useFeatureFlag("help_center")

  if (!helpEnabled) {
    notFound()
  }

  const article = getArticle(slug, "provider")

  if (!article) {
    notFound()
  }

  return (
    <ProviderLayout>
      <HelpArticleView article={article} backHref="/provider/help" />
    </ProviderLayout>
  )
}
