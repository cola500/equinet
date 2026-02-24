"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
  Globe,
  LogIn,
  User,
  Wrench,
  Shield,
  Flag,
  Bell,
  Smartphone,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface TestItem {
  id: string
  label: string
}

interface TestSection {
  id: string
  title: string
  description?: string
  items: TestItem[]
}

interface TestCategory {
  id: string
  title: string
  icon: LucideIcon
  sections: TestSection[]
}

const TEST_DATA: TestCategory[] = [
  {
    id: "public",
    title: "Startsida & Offentliga sidor",
    icon: Globe,
    sections: [
      {
        id: "landing",
        title: "Startsidan",
        items: [
          { id: "landing-1", label: "Sidan laddas och visar hero-sektion" },
          { id: "landing-2", label: "\"Registrera dig gratis\" leder till /register" },
          { id: "landing-3", label: "\"Hitta tjänster\" leder till /providers" },
          { id: "landing-4", label: "Feature-sektionen visar tre kort" },
          { id: "landing-5", label: "CTA \"Är du tjänsteleverantör?\" visas" },
          { id: "landing-6", label: "Annonsförhandsvisning visas" },
          { id: "landing-7", label: "Footer med copyright visas" },
        ],
      },
      {
        id: "public-pages",
        title: "Övriga offentliga sidor",
        items: [
          { id: "pub-1", label: "Integritetspolicy laddas" },
          { id: "pub-2", label: "Användarvillkor laddas" },
          { id: "pub-3", label: "Leverantörslista visas utan inloggning" },
          { id: "pub-4", label: "Sök på namn/tjänstetyp fungerar" },
          { id: "pub-5", label: "Leverantörsprofil visar info, tjänster, omdömen" },
          { id: "pub-6", label: "Lediga tider visas" },
        ],
      },
    ],
  },
  {
    id: "auth",
    title: "Registrering & Inloggning",
    icon: LogIn,
    sections: [
      {
        id: "register",
        title: "Registrering",
        items: [
          { id: "reg-1", label: "Rollval visas (Hästägare / Tjänsteleverantör)" },
          { id: "reg-2", label: "Validering: kort lösenord ger felmeddelande" },
          { id: "reg-3", label: "Validering: ogiltig e-post ger felmeddelande" },
          { id: "reg-4", label: "Lyckad registrering skickar verifieringsmail" },
          { id: "reg-5", label: "Omdirigering till /check-email" },
        ],
      },
      {
        id: "verify",
        title: "E-postverifiering",
        items: [
          { id: "ver-1", label: "Verifieringslänk aktiverar kontot" },
          { id: "ver-2", label: "Kan begära ny verifieringslänk" },
        ],
      },
      {
        id: "login",
        title: "Inloggning",
        items: [
          { id: "login-1", label: "Logga in med verifierat konto" },
          { id: "login-2", label: "Felmeddelande vid fel lösenord" },
          { id: "login-3", label: "Kund → /providers, Leverantör → /provider/dashboard" },
        ],
      },
      {
        id: "password",
        title: "Lösenordsåterställning",
        items: [
          { id: "pwd-1", label: "Glömt lösenord skickar e-post" },
          { id: "pwd-2", label: "Återställningslänken fungerar" },
          { id: "pwd-3", label: "Nytt lösenord kan sättas och användas" },
        ],
      },
      {
        id: "logout",
        title: "Utloggning",
        items: [
          { id: "logout-1", label: "Logga ut fungerar" },
          { id: "logout-2", label: "Omdirigeras till startsidan" },
        ],
      },
    ],
  },
  {
    id: "customer",
    title: "Kundflöden",
    icon: User,
    sections: [
      {
        id: "cust-nav",
        title: "Navigation",
        items: [
          { id: "cnav-1", label: "Bottenmeny: Sök, Bokningar, Hästar + Mer" },
          { id: "cnav-2", label: "Mer-meny visar rätt alternativ" },
          { id: "cnav-3", label: "Aktiv sida markeras med grön färg" },
        ],
      },
      {
        id: "cust-book",
        title: "Sök och boka",
        items: [
          { id: "cbook-1", label: "Leverantörslista med sök och filter" },
          { id: "cbook-2", label: "Leverantörsprofil visar info och priser" },
          { id: "cbook-3", label: "Bokningsdialog öppnas" },
          { id: "cbook-4", label: "Steg: tjänst → datum/tid → häst → bekräfta" },
          { id: "cbook-5", label: "Bokning skapas med status \"Väntande\"" },
        ],
      },
      {
        id: "cust-bookings",
        title: "Mina bokningar",
        items: [
          { id: "cbookings-1", label: "Lista visar alla bokningar" },
          { id: "cbookings-2", label: "Filtrera på status fungerar" },
          { id: "cbookings-3", label: "Avboka väntande bokning" },
          { id: "cbookings-4", label: "Betalning fungerar (mock)" },
          { id: "cbookings-5", label: "Kvitto kan laddas ner" },
          { id: "cbookings-6", label: "Ombokning fungerar [kräver self_reschedule]" },
        ],
      },
      {
        id: "cust-review",
        title: "Recensioner",
        items: [
          { id: "crev-1", label: "Recensionsknapp efter genomförd bokning" },
          { id: "crev-2", label: "Stjärnbetyg och kommentar fungerar" },
          { id: "crev-3", label: "Recensionen syns på leverantörens profil" },
        ],
      },
      {
        id: "cust-horses",
        title: "Mina hästar",
        items: [
          { id: "chorses-1", label: "Lista visar alla hästar" },
          { id: "chorses-2", label: "Lägg till häst med alla fält" },
          { id: "chorses-3", label: "Redigera hästuppgifter" },
          { id: "chorses-4", label: "Hälsotidslinje visar historik" },
          { id: "chorses-5", label: "Exportera hästdata" },
        ],
      },
      {
        id: "cust-profile",
        title: "Profil & Övrigt",
        items: [
          { id: "cprof-1", label: "Visa och redigera personuppgifter" },
          { id: "cprof-2", label: "FAQ-sidan laddas" },
          { id: "cprof-3", label: "GDPR-export fungerar" },
          { id: "cprof-4", label: "Följ/avfölj leverantör [kräver follow_provider]" },
        ],
      },
    ],
  },
  {
    id: "provider",
    title: "Leverantörsflöden",
    icon: Wrench,
    sections: [
      {
        id: "prov-dashboard",
        title: "Dashboard & Onboarding",
        items: [
          { id: "pdash-1", label: "KPI-kort visas" },
          { id: "pdash-2", label: "Onboarding-checklista för nya leverantörer" },
        ],
      },
      {
        id: "prov-services",
        title: "Mina tjänster",
        items: [
          { id: "pserv-1", label: "Lista visar alla tjänster" },
          { id: "pserv-2", label: "Lägg till ny tjänst" },
          { id: "pserv-3", label: "Redigera befintlig tjänst" },
          { id: "pserv-4", label: "Aktivera/inaktivera tjänst" },
        ],
      },
      {
        id: "prov-bookings",
        title: "Bokningshantering",
        items: [
          { id: "pbooking-1", label: "Inkommande bokningar med filter" },
          { id: "pbooking-2", label: "Acceptera → Bekräftad" },
          { id: "pbooking-3", label: "Avböj bokning" },
          { id: "pbooking-4", label: "Markera som genomförd" },
          { id: "pbooking-5", label: "Markera som \"ej infunnen\"" },
          { id: "pbooking-6", label: "Anteckningar och snabbanteckning" },
        ],
      },
      {
        id: "prov-calendar",
        title: "Kalender",
        items: [
          { id: "pcal-1", label: "Veckoöversikt med bokningar" },
          { id: "pcal-2", label: "Navigera mellan veckor" },
          { id: "pcal-3", label: "Redigera öppettider" },
          { id: "pcal-4", label: "Tillgänglighetsundantag" },
          { id: "pcal-5", label: "Manuell bokning via \"+\"" },
        ],
      },
      {
        id: "prov-manual",
        title: "Manuell bokning",
        items: [
          { id: "pman-1", label: "Sök efter kund" },
          { id: "pman-2", label: "Skapa bokning åt kund" },
          { id: "pman-3", label: "Bokningen syns i kundens lista" },
        ],
      },
      {
        id: "prov-customers",
        title: "Kunder",
        items: [
          { id: "pcust-1", label: "Kundlista med sök" },
          { id: "pcust-2", label: "Kunddetaljer med hästar och historik" },
          { id: "pcust-3", label: "Privata anteckningar: skapa, redigera, ta bort" },
        ],
      },
      {
        id: "prov-horse-timeline",
        title: "Hästtidslinje",
        items: [
          { id: "ptimeline-1", label: "Tidslinje visar alla händelser" },
          { id: "ptimeline-2", label: "Anteckningar visas kronologiskt" },
        ],
      },
      {
        id: "prov-reviews",
        title: "Recensioner",
        items: [
          { id: "prev-1", label: "Lista visar kundrecensioner" },
          { id: "prev-2", label: "Svara på recension" },
        ],
      },
      {
        id: "prov-profile",
        title: "Profil & Verifiering",
        items: [
          { id: "pprof-1", label: "Redigera företagsinfo" },
          { id: "pprof-2", label: "Uppdatera adress (geokodning)" },
          { id: "pprof-3", label: "\"Accepterar nya kunder\"-toggle" },
          { id: "pprof-4", label: "Skicka in verifieringsförfrågan" },
          { id: "pprof-5", label: "Verifieringsstatus visas korrekt" },
          { id: "pprof-6", label: "GDPR-export" },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Adminflöden",
    icon: Shield,
    sections: [
      {
        id: "admin-overview",
        title: "Dashboard & Användare",
        items: [
          { id: "adash-1", label: "KPI-kort: användare, bokningar, leverantörer, intäkter" },
          { id: "adash-2", label: "Sök och filtrera användare" },
          { id: "adash-3", label: "Blockera/avblockera användare" },
          { id: "adash-4", label: "Tilldela admin-rättighet" },
        ],
      },
      {
        id: "admin-content",
        title: "Innehåll & Moderering",
        items: [
          { id: "acontent-1", label: "Bokningslista med sök/filter" },
          { id: "acontent-2", label: "Admin kan avboka med anledning" },
          { id: "acontent-3", label: "Ta bort olämplig recension" },
          { id: "acontent-4", label: "Verifieringar: godkänn/avslå med kommentar" },
        ],
      },
      {
        id: "admin-system",
        title: "System & Notifikationer",
        items: [
          { id: "asys-1", label: "Databasstatus visas" },
          { id: "asys-2", label: "Feature flags kan togglas" },
          { id: "asys-3", label: "E-postinställningar fungerar" },
          { id: "asys-4", label: "Massnotifikation fungerar" },
          { id: "asys-5", label: "Integrationssidan (Fortnox) laddas" },
        ],
      },
    ],
  },
  {
    id: "features",
    title: "Feature-flaggor",
    icon: Flag,
    sections: [
      {
        id: "feat-voice",
        title: "Röstloggning",
        description: "Slå PÅ voice_logging i Admin → System",
        items: [
          { id: "fvoice-1", label: "\"Logga arbete\" visas när PÅ, döljs när AV" },
          { id: "fvoice-2", label: "Mikrofon startar inspelning" },
          { id: "fvoice-3", label: "AI tolkar och matchar mot bokningar" },
          { id: "fvoice-4", label: "Fallback till text i Firefox" },
        ],
      },
      {
        id: "feat-route",
        title: "Ruttplanering",
        description: "Slå PÅ route_planning i Admin → System",
        items: [
          { id: "froute-1", label: "Menyval visas när PÅ, döljs när AV" },
          { id: "froute-2", label: "Skapa rutt med datum och stopp" },
          { id: "froute-3", label: "Kartvy med stopp" },
          { id: "froute-4", label: "Optimera ordning och restidsberäkning" },
        ],
      },
      {
        id: "feat-announce",
        title: "Rutt-annonser",
        description: "Slå PÅ route_announcements i Admin → System",
        items: [
          { id: "fannounce-1", label: "Menyval visas när PÅ, döljs när AV" },
          { id: "fannounce-2", label: "Skapa annons kopplad till rutt" },
          { id: "fannounce-3", label: "Kunder ser annonser under \"Lediga tider\"" },
          { id: "fannounce-4", label: "Kund kan boka via annons" },
        ],
      },
      {
        id: "feat-dfs",
        title: "Besöksplanering",
        description: "Slå PÅ due_for_service i Admin → System",
        items: [
          { id: "fdfs-1", label: "Menyval visas när PÅ, döljs när AV" },
          { id: "fdfs-2", label: "Hästar som behöver besök listas" },
          { id: "fdfs-3", label: "Intervall kan sättas per häst/tjänst" },
          { id: "fdfs-4", label: "Förfallna besök markeras tydligt" },
        ],
      },
      {
        id: "feat-group",
        title: "Gruppbokningar",
        description: "Slå PÅ group_bookings i Admin → System",
        items: [
          { id: "fgroup-1", label: "Menyval visas för kund och leverantör" },
          { id: "fgroup-2", label: "Kund kan skapa och bjuda in" },
          { id: "fgroup-3", label: "Kund kan ansluta till grupp" },
          { id: "fgroup-4", label: "Leverantör kan matcha gruppbokning" },
        ],
      },
      {
        id: "feat-insights",
        title: "Affärsinsikter",
        description: "Slå PÅ business_insights i Admin → System",
        items: [
          { id: "finsights-1", label: "Menyval visas när PÅ, döljs när AV" },
          { id: "finsights-2", label: "Grafer: tjänster, tidsanalys, retention" },
        ],
      },
      {
        id: "feat-recurring",
        title: "Återkommande bokningar",
        description: "Slå PÅ recurring_bookings i Admin → System",
        items: [
          { id: "frecurring-1", label: "Seriealternativ visas/döljs korrekt" },
          { id: "frecurring-2", label: "Skapa serie (veckovis, varannan, månadsvis)" },
          { id: "frecurring-3", label: "Avbryt en hel serie" },
        ],
      },
      {
        id: "feat-offline",
        title: "Offlineläge",
        description: "Stäng av nätverket (flygplansläge / DevTools)",
        items: [
          { id: "foffline-1", label: "Översikt, Kalender, Bokningar offline" },
          { id: "foffline-2", label: "Offlineindikator visas" },
          { id: "foffline-3", label: "Ändringar synkas vid återanslutning" },
          { id: "foffline-4", label: "Ej cacheade sidor visar offline-meddelande" },
        ],
      },
      {
        id: "feat-reschedule",
        title: "Självservice-ombokning",
        description: "Slå PÅ self_reschedule i Admin → System",
        items: [
          { id: "freschedule-1", label: "Ombokning visas/döljs baserat på flagga" },
          { id: "freschedule-2", label: "Kund kan välja nytt datum/tid" },
          { id: "freschedule-3", label: "Leverantör ser ombokningshistorik" },
        ],
      },
      {
        id: "feat-follow",
        title: "Följ leverantör",
        description: "Slå PÅ follow_provider i Admin → System",
        items: [
          { id: "ffollow-1", label: "Följ-knapp visas på leverantörsprofil" },
          { id: "ffollow-2", label: "Kund kan följa och avfölja" },
          { id: "ffollow-3", label: "Notis vid ny rutt-annons i kundens kommun" },
        ],
      },
      {
        id: "feat-municipality",
        title: "Bevaka kommun",
        description: "Slå PÅ municipality_watch i Admin → System",
        items: [
          { id: "fmunicipality-1", label: "Bevakningsval visas i kundprofil" },
          { id: "fmunicipality-2", label: "Välj kommun + tjänstetyp" },
          { id: "fmunicipality-3", label: "Notis vid ny rutt-annons i bevakad kommun" },
        ],
      },
      {
        id: "feat-custinsights",
        title: "Kundinsikter",
        description: "Slå PÅ customer_insights i Admin → System",
        items: [
          { id: "fcustinsights-1", label: "Kundinsikter visas/döljs baserat på flagga" },
          { id: "fcustinsights-2", label: "AI-genererade insikter på kunddetaljsida" },
          { id: "fcustinsights-3", label: "Insikter uppdateras vid ny bokningshistorik" },
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifikationer & E-post",
    icon: Bell,
    sections: [
      {
        id: "notif-inapp",
        title: "In-app",
        items: [
          { id: "notif-1", label: "Oläst-badge visas i header" },
          { id: "notif-2", label: "Notifikationslista öppnas" },
          { id: "notif-3", label: "Markera som läst" },
          { id: "notif-4", label: "Notifikation vid ny bokning" },
          { id: "notif-5", label: "Notifikation vid statusändring" },
        ],
      },
      {
        id: "notif-email",
        title: "E-post",
        items: [
          { id: "email-1", label: "Verifieringsmail vid registrering" },
          { id: "email-2", label: "Återställningsmail fungerar" },
          { id: "email-3", label: "Bokningsbekräftelse skickas" },
          { id: "email-4", label: "Bokningspåminnelse (24h innan)" },
          { id: "email-5", label: "Avprenumerera-länk fungerar" },
        ],
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobil & PWA",
    icon: Smartphone,
    sections: [
      {
        id: "mobile-general",
        title: "Responsiv design",
        items: [
          { id: "mob-1", label: "Alla sidor användbara på 375px" },
          { id: "mob-2", label: "Bottenmeny på mobil, döljs på desktop" },
          { id: "mob-3", label: "Knappar minst 48px (tumvänliga)" },
          { id: "mob-4", label: "Formulär fungerar med mobilt tangentbord" },
          { id: "mob-5", label: "Modaler scrollbara vid långt innehåll" },
        ],
      },
      {
        id: "mobile-pwa",
        title: "PWA",
        items: [
          { id: "pwa-1", label: "\"Installera app\"-prompt visas" },
          { id: "pwa-2", label: "Appen kan installeras" },
          { id: "pwa-3", label: "Öppnas i helskärm utan adressfält" },
          { id: "pwa-4", label: "App-ikon visas korrekt" },
        ],
      },
    ],
  },
]

const STORAGE_KEY = "equinet-testing-guide-checks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryStats(category: TestCategory, checked: Record<string, boolean>) {
  const items = category.sections.flatMap((s) => s.items)
  const total = items.length
  const done = items.filter((i) => checked[i.id]).length
  return { total, done }
}

function getSectionStats(section: TestSection, checked: Record<string, boolean>) {
  const total = section.items.length
  const done = section.items.filter((i) => checked[i.id]).length
  return { total, done }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-green-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Overview: list of categories as tappable cards */
function OverviewView({
  checked,
  onSelect,
  onReset,
}: {
  checked: Record<string, boolean>
  onSelect: (id: string) => void
  onReset: () => void
}) {
  const allItems = TEST_DATA.flatMap((c) => c.sections.flatMap((s) => s.items))
  const totalCount = allItems.length
  const checkedCount = allItems.filter((i) => checked[i.id]).length
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Testningsguide</h1>
          <p className="text-sm text-gray-500">Tryck på en kategori för att börja</p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Nollställ
        </Button>
      </div>

      {/* Total progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">
                  {checkedCount} / {totalCount}
                </span>
                <span className="text-sm font-bold text-green-700">{pct}%</span>
              </div>
              <ProgressBar done={checkedCount} total={totalCount} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category cards */}
      <div className="space-y-3">
        {TEST_DATA.map((category) => {
          const { total, done } = getCategoryStats(category, checked)
          const complete = done === total && total > 0
          const Icon = category.icon
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className="w-full text-left p-4 rounded-xl border bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-4"
            >
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  complete ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    complete ? "text-green-600" : "text-gray-500"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate">
                    {category.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {complete && (
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        Klar
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {done}/{total}
                    </span>
                  </div>
                </div>
                <ProgressBar done={done} total={total} />
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Tips */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-2">Tips</p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Testa &quot;happy path&quot; först</li>
            <li>Testa på mobil &mdash; de flesta använder mobilen i stallet</li>
            <li>Testa flöden: sök → boka → bekräfta → genomför → recensera</li>
            <li>Växla roller: kund, leverantör, admin</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/** Detail: a single category with its sections and checkboxes */
function CategoryView({
  category,
  checked,
  onToggle,
  onBack,
  onNavigate,
}: {
  category: TestCategory
  checked: Record<string, boolean>
  onToggle: (id: string, value: boolean) => void
  onBack: () => void
  onNavigate: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { total, done } = getCategoryStats(category, checked)

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-2 -ml-1 py-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{category.title}</h1>
          <Badge
            variant={done === total ? "default" : "secondary"}
            className={done === total && total > 0 ? "bg-green-600" : ""}
          >
            {done}/{total}
          </Badge>
        </div>
        <div className="mt-2">
          <ProgressBar done={done} total={total} />
        </div>
      </div>

      {/* Sections */}
      {category.sections.map((section) => {
        const secStats = getSectionStats(section, checked)
        const isCollapsed = collapsed[section.id]
        const sectionComplete = secStats.done === secStats.total && secStats.total > 0

        return (
          <Card key={section.id}>
            <CardHeader className="pb-2 px-4">
              <button
                type="button"
                onClick={() => toggleCollapse(section.id)}
                className="w-full flex items-center justify-between text-left py-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    {section.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {section.description}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 ml-2 ${
                    sectionComplete ? "border-green-600 text-green-700" : ""
                  }`}
                >
                  {secStats.done}/{secStats.total}
                </Badge>
              </button>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={item.id}
                      className="flex items-start gap-3 cursor-pointer min-h-[44px] items-center"
                    >
                      <Checkbox
                        id={item.id}
                        checked={checked[item.id] ?? false}
                        onCheckedChange={(value) =>
                          onToggle(item.id, value === true)
                        }
                      />
                      <span
                        className={`text-sm leading-snug ${
                          checked[item.id]
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Next category navigation */}
      <CategoryNavigation currentId={category.id} onNavigate={onNavigate} />
    </div>
  )
}

function CategoryNavigation({
  currentId,
  onNavigate,
}: {
  currentId: string
  onNavigate: (id: string) => void
}) {
  const currentIdx = TEST_DATA.findIndex((c) => c.id === currentId)
  const next = currentIdx < TEST_DATA.length - 1 ? TEST_DATA[currentIdx + 1] : null

  if (!next) return null

  return (
    <div className="pt-2 pb-4">
      <button
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" })
          setTimeout(() => onNavigate(next.id), 100)
        }}
        className="w-full p-3 rounded-lg border bg-white hover:bg-gray-50 active:bg-gray-100 text-left flex items-center justify-between"
      >
        <span className="text-sm text-gray-500">
          Nästa: <span className="font-medium text-gray-900">{next.title}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TestingGuidePage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setChecked(JSON.parse(stored))
    } catch {
      // Ignore
    }
  }, [])

  const persist = useCallback((next: Record<string, boolean>) => {
    setChecked(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore
    }
  }, [])

  function handleToggle(id: string, value: boolean) {
    persist({ ...checked, [id]: value })
  }

  function handleReset() {
    persist({})
    toast.success("Alla markeringar nollställda")
  }

  function handleSelectCategory(id: string) {
    setActiveCategory(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleBack() {
    setActiveCategory(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const category = activeCategory
    ? TEST_DATA.find((c) => c.id === activeCategory)
    : null

  return (
    <AdminLayout>
      <div className="max-w-lg mx-auto">
        {category ? (
          <CategoryView
            category={category}
            checked={checked}
            onToggle={handleToggle}
            onBack={handleBack}
            onNavigate={handleSelectCategory}
          />
        ) : (
          <OverviewView
            checked={checked}
            onSelect={handleSelectCategory}
            onReset={handleReset}
          />
        )}
      </div>
    </AdminLayout>
  )
}
