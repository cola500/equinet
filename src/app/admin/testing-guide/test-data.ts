import {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestItem {
  id: string
  label: string
}

export interface TestSection {
  id: string
  title: string
  description?: string
  items: TestItem[]
}

export interface TestCategory {
  id: string
  title: string
  icon: LucideIcon
  sections: TestSection[]
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const TEST_DATA: TestCategory[] = [
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
          { id: "pbooking-3", label: "Avvisa bokning" },
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
        description: "Alltid tillgänglig (ingen feature flag)",
        items: [
          { id: "fdfs-2", label: "Hästar som behöver besök listas" },
          { id: "fdfs-3", label: "Intervall kan sättas per häst/tjänst" },
          { id: "fdfs-4", label: "Förfallna besök markeras tydligt" },
        ],
      },
      {
        id: "feat-group",
        title: "Gruppbokningar",
        description: "Alltid tillgänglig (ingen feature flag)",
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
        description: "Alltid tillgänglig (ingen feature flag)",
        items: [
          { id: "finsights-1", label: "Menyval synligt under Mitt företag" },
          { id: "finsights-2", label: "KPI-kort visar total intäkt, delta-indikatorer mot föregående period" },
          { id: "finsights-3", label: "Grafer: tjänster, tidsanalys, retention" },
          { id: "finsights-4", label: "Tomtläge visas när ingen data i perioden" },
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
