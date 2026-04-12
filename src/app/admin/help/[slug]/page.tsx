import { notFound } from "next/navigation"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { HelpArticleView } from "@/components/help/HelpArticleView"
import { getArticle } from "@/lib/help/index"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function AdminHelpArticlePage({ params }: Props) {
  const { slug } = await params

  const article = getArticle(slug, "admin")
  if (!article) notFound()

  return (
    <AdminLayout>
      <HelpArticleView article={article} backHref="/admin/help" />
    </AdminLayout>
  )
}
