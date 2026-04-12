import { notFound } from "next/navigation"
import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { getFeatureFlags } from "@/lib/feature-flags"
import { getArticle } from "@/lib/help/index"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function CustomerHelpArticlePage({ params }: Props) {
  const { slug } = await params
  const flags = await getFeatureFlags()
  if (!flags["help_center"]) notFound()

  const article = getArticle(slug, "customer")
  if (!article) notFound()

  return (
    <CustomerLayout>
      <HelpArticleView article={article} backHref="/customer/help" />
    </CustomerLayout>
  )
}
