"use client"

import { CustomerLayout } from "@/components/layout/CustomerLayout"
import { PreparationChecklist } from "@/components/booking/PreparationChecklist"
import { Card, CardContent } from "@/components/ui/card"

const faqItems = [
  {
    question: "Vad behöver jag förbereda inför besöket?",
    content: "checklist" as const,
  },
  {
    question: "Hur avbokar jag en bokning?",
    answer:
      "Du kan avboka en bokning genom att gå till dina bokningar och klicka på den bokning du vill avboka. Klicka sedan på \"Avboka\" och bekräfta. Observera att leverantören kan ha avbokningsregler.",
  },
  {
    question: "Vad händer om leverantören avbokar?",
    answer:
      "Om leverantören avbokar en bokning får du en notifikation via e-post och i appen. Du kan då boka en ny tid direkt från dina bokningar.",
  },
  {
    question: "Hur fungerar betalning?",
    answer:
      "Betalning sker direkt till leverantören. Equinet hanterar inte betalningar utan är en bokningsplattform. Leverantören bestämmer själv vilka betalningsmetoder som accepteras.",
  },
  {
    question: "Kan jag boka för flera hästar?",
    answer:
      "Ja! Du kan antingen boka separata tider för varje häst, eller använda \"Flexibel bokning\" och ange antal hästar i formuläret. Leverantören planerar sedan in alla hästar i ett besök.",
  },
  {
    question: "Hur lägger jag till en häst?",
    answer:
      "Gå till \"Mina hästar\" i menyn. Klicka på \"Lägg till häst\" och fyll i namn, ras och eventuella specialbehov. Dina hästar visas sedan automatiskt i bokningsformuläret.",
  },
  {
    question: "Vad är en flexibel bokning?",
    answer:
      "En flexibel bokning innebär att du anger en tidsperiod (t.ex. \"1-5 mars\") istället för en exakt tid. Leverantören planerar sedan in dig i sin rutt under den perioden. Det är perfekt om du inte har ett tight schema.",
  },
  {
    question: "Vad är en ruttbokning?",
    answer:
      "En ruttbokning innebär att du bokar en tid när leverantören redan planerat att besöka ditt område. Det kan ge bättre tillgänglighet och ibland lägre pris eftersom leverantören redan är i närheten.",
  },
]

export default function FAQPage() {
  return (
    <CustomerLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Vanliga frågor</h1>
      <p className="text-gray-600 mb-6">Hittar du inte svaret? Kontakta oss gärna.</p>

      <Card>
        <CardContent className="pt-6 divide-y">
          {faqItems.map((item, index) => (
            <details key={index} className="group py-4 first:pt-0 last:pb-0">
              <summary className="flex cursor-pointer items-center justify-between font-medium text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span className="ml-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <div className="mt-3 text-gray-600 text-sm leading-relaxed">
                {item.content === "checklist" ? (
                  <PreparationChecklist />
                ) : (
                  <p>{item.answer}</p>
                )}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </CustomerLayout>
  )
}
