import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Integritetspolicy - Equinet",
  description: "Integritetspolicy för Equinet bokningsplattform",
}

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Integritetspolicy</h1>
      <p className="mb-6 text-sm text-gray-500">Senast uppdaterad: 2026-02-15</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">1. Personuppgiftsansvarig</h2>
        <p className="mb-2">
          [Företagsnamn], org.nr [Org.nr], är personuppgiftsansvarig för behandlingen
          av dina personuppgifter inom Equinet.
        </p>
        <p className="mb-2">Adress: [Adress]</p>
        <p>E-post: [E-post]</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">2. Vilka uppgifter vi samlar in</h2>
        <p className="mb-3">Vi samlar in följande personuppgifter:</p>
        <ul className="mb-3 list-disc pl-6 space-y-1">
          <li>Namn och e-postadress (vid registrering)</li>
          <li>Telefonnummer och adress (om du anger det i din profil)</li>
          <li>Information om dina hästar (namn, ras, specialbehov)</li>
          <li>Bokningshistorik och arbetsloggar</li>
          <li>Recensioner och omdömen</li>
          <li>Teknisk information (IP-adress, webbläsare) vid felinrapportering</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">3. Ändamål och rättslig grund</h2>
        <p className="mb-3">Vi behandlar dina uppgifter för följande ändamål:</p>
        <ul className="mb-3 list-disc pl-6 space-y-2">
          <li>
            <strong>Fullgöra avtal</strong> -- hantera bokningar, kommunicera med
            leverantörer och kunder, skicka bekräftelser och påminnelser.
          </li>
          <li>
            <strong>Berättigat intresse</strong> -- förbättra tjänsten, förhindra
            missbruk, felövervakning och säkerhet.
          </li>
          <li>
            <strong>Rättslig förpliktelse</strong> -- uppfylla bokföringskrav och
            andra lagkrav.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">4. Mottagare och personuppgiftsbiträden</h2>
        <p className="mb-3">
          Vi delar dina uppgifter med följande tjänsteleverantörer som behandlar
          data på vårt uppdrag:
        </p>
        <ul className="mb-3 list-disc pl-6 space-y-1">
          <li><strong>Supabase</strong> (EU) -- databashantering</li>
          <li><strong>Vercel</strong> (EU/US) -- hosting och serverhantering</li>
          <li><strong>Resend</strong> (US) -- e-postutskick</li>
          <li><strong>Sentry</strong> (US) -- felövervakning (anonymiserad teknisk data)</li>
        </ul>
        <p>
          Alla biträden har avtal som säkerställer att dina uppgifter hanteras
          enligt GDPR. Överföringar utanför EU/EES sker med stöd av
          EU-kommissionens standardavtalsklausuler.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">5. Lagringstider</h2>
        <ul className="mb-3 list-disc pl-6 space-y-1">
          <li><strong>Kontouppgifter</strong> -- så länge ditt konto är aktivt, plus 30 dagar efter radering</li>
          <li><strong>Bokningsdata</strong> -- 24 månader efter avslutad bokning</li>
          <li><strong>Tekniska loggar</strong> -- 90 dagar</li>
          <li><strong>Recensioner</strong> -- så länge kontot är aktivt</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">6. Dina rättigheter</h2>
        <p className="mb-3">Enligt GDPR har du rätt att:</p>
        <ul className="mb-3 list-disc pl-6 space-y-1">
          <li><strong>Få tillgång</strong> till dina personuppgifter (registerutdrag)</li>
          <li><strong>Rätta</strong> felaktiga uppgifter</li>
          <li><strong>Radera</strong> dina uppgifter (&quot;rätten att bli glömd&quot;)</li>
          <li><strong>Exportera</strong> dina uppgifter i maskinläsbart format (dataportabilitet)</li>
          <li><strong>Invända</strong> mot viss behandling</li>
          <li><strong>Begränsa</strong> behandlingen i vissa fall</li>
        </ul>
        <p className="mb-3">
          Du kan exportera dina uppgifter via{" "}
          <strong>Mitt konto &gt; Exportera mina uppgifter</strong>.
        </p>
        <p>
          Kontakta oss på <strong>[E-post]</strong> för att utöva dina
          rättigheter. Vi svarar inom 30 dagar.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">7. Cookies</h2>
        <p className="mb-3">
          Equinet använder en enda cookie som är strikt nödvändig för att tjänsten
          ska fungera:
        </p>
        <table className="mb-3 w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 text-left font-medium">Namn</th>
              <th className="py-2 pr-4 text-left font-medium">Syfte</th>
              <th className="py-2 text-left font-medium">Livslängd</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4 font-mono text-xs">authjs.session-token</td>
              <td className="py-2 pr-4">Håller dig inloggad</td>
              <td className="py-2">24 timmar</td>
            </tr>
          </tbody>
        </table>
        <p>
          Eftersom vi bara använder strikt nödvändiga cookies krävs inget
          samtycke enligt ePrivacy-direktivet (PTS vägledning). Vi använder inga
          tredjepartscookies, spårningscookies eller annonscookies.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">8. Klagomål</h2>
        <p>
          Om du anser att vi behandlar dina uppgifter felaktigt har du rätt att
          lämna klagomål till{" "}
          <a
            href="https://www.imy.se"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 underline hover:text-green-900"
          >
            Integritetsskyddsmyndigheten (IMY)
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">9. Kontakt</h2>
        <p className="mb-2">
          Har du frågor om hur vi hanterar dina personuppgifter? Kontakta oss:
        </p>
        <p className="mb-1">[Företagsnamn]</p>
        <p className="mb-1">[Adress]</p>
        <p>[E-post]</p>
      </section>

      <div className="mt-12 border-t pt-6 text-sm text-gray-500">
        <Link href="/anvandarvillkor" className="text-green-700 underline hover:text-green-900">
          Läs våra användarvillkor
        </Link>
      </div>
    </div>
  )
}
