import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Användarvillkor - Equinet",
  description: "Användarvillkor för Equinet bokningsplattform",
}

export default function AnvandarvillkorPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Användarvillkor</h1>
      <p className="mb-6 text-sm text-gray-500">Senast uppdaterad: 2026-02-15</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">1. Allmänt</h2>
        <p className="mb-3">
          Equinet är en bokningsplattform för hästtjänster som drivs av
          [Företagsnamn], org.nr [Org.nr] (&quot;vi&quot;, &quot;oss&quot;).
          Genom att skapa ett konto och använda tjänsten godkänner du dessa
          villkor.
        </p>
        <p>
          Tjänsten förmedlar kontakt mellan kunder som söker hästtjänster
          (hovslagare, veterinärer m.fl.) och leverantörer som erbjuder sådana
          tjänster.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">2. Användarkonto</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Du måste vara minst 18 år för att skapa ett konto.
          </li>
          <li>
            Du ansvarar för att de uppgifter du anger är korrekta och aktuella.
          </li>
          <li>
            Du ansvarar för att hålla ditt lösenord säkert och för all aktivitet
            som sker via ditt konto.
          </li>
          <li>
            Vi förbehåller oss rätten att stänga av eller ta bort konton som
            bryter mot dessa villkor eller missbrukar tjänsten.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">3. Bokningar</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            En bokning utgör ett avtal mellan kund och leverantör. Equinet är
            inte part i detta avtal.
          </li>
          <li>
            Avbokning ska ske enligt leverantörens avbokningsregler. Om inga
            regler anges gäller avbokning senast 24 timmar före bokad tid.
          </li>
          <li>
            Leverantören ansvarar för att utföra den bokade tjänsten enligt
            överenskommelse.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">4. Recensioner</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Recensioner ska vara sakliga och baserade på verkliga upplevelser.
          </li>
          <li>
            Vi förbehåller oss rätten att ta bort recensioner som innehåller
            kränkande, hotfullt eller vilseledande innehåll.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">5. Ansvarsbegränsning</h2>
        <p className="mb-3">
          Equinet är en förmedlingsplattform och utför inte själva
          hästtjänsterna. Vi ansvarar inte för:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Kvaliteten på utförda tjänster</li>
          <li>Skador som uppstår i samband med en bokad tjänst</li>
          <li>Tvister mellan kund och leverantör</li>
          <li>Tillfälliga driftstörningar eller dataförlust</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">6. Immateriella rättigheter</h2>
        <p>
          Allt innehåll på plattformen (design, logotyper, kod) tillhör
          [Företagsnamn] eller respektive rättighetsinnehavare. Du får inte
          kopiera, distribuera eller använda innehållet utan skriftligt
          tillstånd.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">7. Ändringar av villkoren</h2>
        <p>
          Vi förbehåller oss rätten att uppdatera dessa villkor. Vid väsentliga
          ändringar meddelar vi dig via e-post eller genom ett meddelande i
          tjänsten. Fortsatt användning efter ändringar innebär att du godkänner
          de nya villkoren.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">8. Tillämplig lag och tvister</h2>
        <p>
          Dessa villkor regleras av svensk lag. Tvister som inte kan lösas genom
          dialog ska avgöras av svensk allmän domstol.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">9. Kontakt</h2>
        <p className="mb-2">
          Har du frågor om dessa villkor? Kontakta oss:
        </p>
        <p className="mb-1">[Företagsnamn]</p>
        <p className="mb-1">[Adress]</p>
        <p>[E-post]</p>
      </section>

      <div className="mt-12 border-t pt-6 text-sm text-gray-500">
        <Link href="/integritetspolicy" className="text-green-700 underline hover:text-green-900">
          Läs vår integritetspolicy
        </Link>
      </div>
    </div>
  )
}
