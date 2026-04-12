import { AdminLayout } from "@/components/layout/AdminLayout"
import { HelpCenter } from "@/components/help/HelpCenter"
import { getAllArticles, getArticleSections } from "@/lib/help/index"

export default function AdminHelpPage() {
  const articles = getAllArticles("admin")
  const sections = getArticleSections("admin")

  return (
    <AdminLayout>
      <HelpCenter
        initialArticles={articles}
        sections={sections}
        role="admin"
        basePath="/admin/help"
      />
    </AdminLayout>
  )
}
