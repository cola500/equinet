"use client"

import Link from "next/link"
import {
  Search,
  CalendarDays,
  Bell,
  Heart,
  Route,
  Mic,
  MessageSquare,
  Map,
  BarChart3,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { HorseIcon } from "@/components/icons/HorseIcon"
import { AnnouncementPreview } from "@/components/AnnouncementPreview"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// --- Data ---

const features = [
  {
    icon: Search,
    title: "Sök och boka direkt",
    description: "Hitta leverantörer i ditt område, se lediga tider och boka online.",
  },
  {
    icon: HorseIcon,
    title: "Hästprofil med vårdhistorik",
    description: "Samla besök, anteckningar och vårdscheman per häst -- delbar med din veterinär.",
  },
  {
    icon: Bell,
    title: "Besökspåminnelser",
    description: "Equinet räknar ut när hästen behöver nästa besök och påminner dig.",
  },
  {
    icon: Heart,
    title: "Följ din leverantör",
    description: "Få notis direkt när din hovslagare eller terapeut annonserar besök i ditt område.",
  },
  {
    icon: Route,
    title: "Ruttplanering och annonser",
    description: "Leverantörer planerar rutter på karta och annonserar besök till intresserade kunder.",
  },
  {
    icon: Mic,
    title: "Röstloggning i fält",
    description: "Leverantörer loggar utfört arbete med rösten. AI tolkar och sparar automatiskt.",
  },
]

const customerBenefits = [
  {
    icon: CalendarDays,
    title: "Samlad vårdhistorik per häst",
    description: "Alla besök, anteckningar och intervall samlade i en tidslinje. Dela med veterinären via en länk.",
  },
  {
    icon: Bell,
    title: "Automatiska påminnelser",
    description: "Equinet beräknar nästa besöksdatum baserat på tjänstens intervall. Du behöver aldrig hålla koll själv.",
  },
  {
    icon: Map,
    title: "Se lediga tider i ditt område",
    description: "Följ leverantörer eller bevaka din kommun. Få notis när någon annonserar besök nära dig.",
  },
]

const providerBenefits = [
  {
    icon: MessageSquare,
    title: "Färre SMS, fler bokningar",
    description: "Kunder bokar direkt i din kalender. Bekräfta, boka om eller avboka med ett klick.",
  },
  {
    icon: Route,
    title: "Planera rutter på karta",
    description: "Skapa rutter med stopp, optimera körsträckan och annonsera besök till kunder i området.",
  },
  {
    icon: BarChart3,
    title: "AI-loggning och insikter",
    description: "Logga arbete med rösten i fält. Få affärsinsikter, kundanalys och bokningsstatistik.",
  },
]

const steps = [
  {
    step: "1",
    title: "Skapa konto",
    description: "Registrera dig gratis som hästägare eller leverantör. Tar under en minut.",
  },
  {
    step: "2",
    title: "Hitta och boka",
    description: "Sök på tjänst och område. Se tillgängliga tider och boka direkt.",
  },
  {
    step: "3",
    title: "Håll koll",
    description: "Få bekräftelser, påminnelser och en samlad vårdhistorik för varje häst.",
  },
]

const faqItems = [
  {
    question: "Kostar det något att använda Equinet?",
    answer: "Det är gratis att skapa konto och boka tjänster. Leverantörer sätter sina egna priser.",
  },
  {
    question: "Vilka tjänster kan jag boka?",
    answer: "Hovslagare, veterinärer, hästterapeuter, massörer, tandvård och andra professionella hästtjänster. Leverantörer väljer själva vilka tjänster de erbjuder.",
  },
  {
    question: "Hur skiljer sig Equinet från vanliga bokningsappar?",
    answer: "Equinet är byggt specifikt för hästbranschen. Vi förstår att leverantörer reser till kunderna, att hästar behöver regelbunden vård med bestämda intervall, och att hästägare vill ha en samlad vårdhistorik. Det kan inte Bokadirekt eller en Facebook-grupp erbjuda.",
  },
  {
    question: "Kan jag använda Equinet utan internetuppkoppling?",
    answer: "Ja. Equinet fungerar som en app på din telefon och stödjer offlineläge. Leverantörer kan se bokningar och logga arbete även utan täckning -- allt synkas automatiskt när uppkopplingen är tillbaka.",
  },
]

// --- Page ---

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.96_0.02_80)] to-white">
      <Header />

      <main className="container mx-auto px-4">

        {/* A) Hero */}
        <section className="py-12 md:py-20 text-center max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6">
            Boka hästtjänster -- utan krångel
          </h1>
          <p className="text-base md:text-xl text-gray-600 mb-6 md:mb-8 px-2 max-w-2xl mx-auto">
            Hitta hovslagare, veterinärer och terapeuter.
            Boka direkt. Få påminnelser. Håll koll på dina hästar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
                Registrera dig gratis
              </Button>
            </Link>
            <Link href="/providers" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
                Hitta tjänster
              </Button>
            </Link>
          </div>
        </section>

        {/* B) Problemet */}
        <section className="py-12 md:py-16 max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-8">
            Känner du igen det här?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">
                Hästägare
              </p>
              <p className="text-gray-700 leading-relaxed">
                SMS-bokning som tar dagar. Ingen aning om när hovarna gjordes senast.
                Ingen samlad bild av hästens vårdhistorik.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border">
              <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">
                Leverantör
              </p>
              <p className="text-gray-700 leading-relaxed">
                47 olästa SMS, tre dubbelbokningar och en kund som glömde att du kommer imorgon.
                Noll koll på vem som behöver nästa besök.
              </p>
            </div>
          </div>
        </section>

        {/* C) Features */}
        <section className="py-12 md:py-16">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-4">
            Allt du behöver -- samlat
          </h2>
          <p className="text-gray-600 text-center mb-10 max-w-xl mx-auto">
            Equinet är byggt specifikt för hästbranschen, inte anpassat från en generisk bokningsapp.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className="w-12 h-12 bg-accent-warm/20 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-accent-warm-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Announcement Preview (existing component) */}
        <AnnouncementPreview />

        {/* D) USP för kunder */}
        <section className="py-12 md:py-16 max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-10">
            För dig med häst
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {customerBenefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div key={benefit.title} className="text-center">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* E) USP för leverantörer */}
        <section className="py-12 md:py-16 max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-10">
            För dig som leverantör
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {providerBenefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div key={benefit.title} className="text-center">
                  <div className="w-14 h-14 bg-accent-warm/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-accent-warm-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* F) Så funkar det */}
        <section className="py-12 md:py-16 max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-10">
            Så funkar det
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* G) FAQ */}
        <section className="py-12 md:py-16 max-w-2xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-8">
            Vanliga frågor
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* H) Varför inte vanliga alternativ */}
        <section className="py-12 md:py-16 max-w-4xl mx-auto">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-8">
            Varför inte bara SMS eller Facebook?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-semibold mb-2 text-gray-400">SMS / telefon</h3>
              <p className="text-sm text-gray-400">Ingen kalender, inga påminnelser, ingen historik. Bokningen lever i en chattbubbla.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserCheck className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="font-semibold mb-2 text-gray-400">Facebook-grupper</h3>
              <p className="text-sm text-gray-400">Svårt att hitta rätt. Inget bokningssystem. Inlägget försvinner i flödet.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-primary/30 text-center relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Byggt för hästbranschen
                </span>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <HorseIcon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Equinet</h3>
              <p className="text-sm text-gray-600">Bokning, ruttplanering, vårdhistorik, påminnelser och offline-stöd -- allt i en app.</p>
            </div>
          </div>
        </section>

        {/* I) CTA */}
        <section className="py-12 md:py-16">
          <div className="bg-primary text-primary-foreground rounded-2xl p-6 md:p-12 text-center mx-2 md:mx-0">
            <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
              Redo att testa?
            </h2>
            <p className="text-base md:text-lg mb-6 opacity-85 max-w-lg mx-auto">
              Skapa konto gratis och se varför hästmänniskor byter från SMS till Equinet.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Kom igång gratis
                </Button>
              </Link>
              <Link href="/register?role=provider">
                <Button size="lg" variant="ghost" className="text-lg px-8 border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  Registrera som leverantör
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-12 border-t text-center text-gray-600">
        <p>&copy; 2026 Equinet. Alla rättigheter förbehållna.</p>
      </footer>
    </div>
  )
}
