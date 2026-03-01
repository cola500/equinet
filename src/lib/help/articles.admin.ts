import type { HelpArticle } from "./types"

export const adminArticles: HelpArticle[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    role: "admin",
    section: "Översikt",
    keywords: [
      "dashboard",
      "KPI",
      "statistik",
      "översikt",
      "trender",
      "intäkter",
      "bokningar",
      "användare",
      "leverantörer",
    ],
    summary:
      "Admin-dashboarden visar KPI-kort, trendgrafer och snabblänkar för att ge en överblick över plattformens status.",
    content: [
      {
        paragraphs: [
          "Admin-panelen nås via /admin och kräver att din användare har admin-behörighet. Sidan är skyddad med både middleware och per-route kontroller.",
        ],
      },
      {
        heading: "KPI-kort",
        paragraphs: [
          "Startsidan visar fyra klickbara KPI-kort:",
        ],
        bullets: [
          "Användare -- totalt, kunder, leverantörer, nya denna månad",
          "Bokningar -- totalt, per status (väntande/bekräftade/genomförda/avbokade), genomförda denna månad",
          "Leverantörer -- totalt, aktiva, verifierade, väntande verifieringar",
          "Intäkter -- totalt genomfört belopp, belopp denna månad",
        ],
      },
      {
        heading: "Trendgrafer",
        bullets: [
          "Bokningar per vecka (senaste 8 veckorna) -- linjediagram med genomförda och avbokade",
          "Intäkter per månad (senaste 6 månaderna) -- stapeldiagram",
        ],
      },
      {
        heading: "Onboarding-checklista",
        paragraphs: [
          "Checklistan visar status för nya leverantörers onboarding:",
        ],
        bullets: [
          "Fyll i företagsprofil",
          "Lägg till minst en tjänst",
          "Sätt öppettider",
          "Verifiera e-postadress",
        ],
      },
      {
        heading: "Snabblänkar",
        paragraphs: [
          "Snabblänkar till vanliga åtgärder som att skapa ny bokning, lägga till tjänst med mera.",
        ],
      },
    ],
  },
  {
    slug: "anvandarhantering",
    title: "Användarhantering",
    role: "admin",
    section: "Hantering",
    keywords: [
      "användare",
      "hantering",
      "blockera",
      "avblockera",
      "admin",
      "behörighet",
      "filter",
      "sök",
      "leverantör",
      "kund",
    ],
    summary:
      "Hantera alla registrerade användare med sök, filter och åtgärder som blockering och adminbehörighet.",
    content: [
      {
        paragraphs: [
          "Under Användare ser du alla registrerade användare med sök och filter.",
        ],
      },
      {
        heading: "Filtrera på",
        bullets: [
          "Typ (kund / leverantör)",
          "Fritextsökning i namn och e-post",
        ],
      },
      {
        heading: "Åtgärder per användare",
        bullets: [
          "Blockera/avblockera -- blockerade användare kan inte logga in",
          "Ge/ta bort admin-behörighet -- du kan inte ta bort din egen admin-behörighet",
        ],
      },
      {
        paragraphs: [
          "Leverantörer visas med extra information: företagsnamn, antal bokningar, tjänster, genomsnittsbetyg och Fortnox-koppling.",
        ],
      },
    ],
  },
  {
    slug: "bokningshantering",
    title: "Bokningshantering",
    role: "admin",
    section: "Hantering",
    keywords: [
      "bokningar",
      "hantering",
      "avboka",
      "status",
      "datum",
      "filter",
      "admin",
    ],
    summary:
      "Hantera alla bokningar med status- och datumfilter samt möjlighet att avboka med anledning.",
    content: [
      {
        paragraphs: [
          "Under Bokningar ser du alla bokningar med status- och datumfilter.",
        ],
      },
      {
        heading: "Åtgärder",
        bullets: [
          "Avboka bokning -- ange en anledning som skickas till både kund och leverantör. Avbokningsmeddelandet prefixas med \"[Admin]\".",
        ],
      },
    ],
  },
  {
    slug: "recensionsmoderation",
    title: "Recensionsmoderation",
    role: "admin",
    section: "Hantering",
    keywords: [
      "recensioner",
      "moderation",
      "moderera",
      "ta bort",
      "kundrecension",
      "leverantörsrecension",
      "filter",
      "sök",
    ],
    summary:
      "Moderera alla recensioner med filter och möjlighet att permanent ta bort olämpliga recensioner.",
    content: [
      {
        paragraphs: [
          "Under Recensioner ser du alla recensioner (både kund-till-leverantör och leverantör-till-kund).",
        ],
      },
      {
        heading: "Filtrera på",
        bullets: [
          "Typ (kundrecensioner / leverantörsrecensioner)",
          "Fritextsökning i kommentarer",
        ],
      },
      {
        heading: "Åtgärder",
        bullets: [
          "Ta bort recension -- permanent borttagning (kräver bekräftelse)",
        ],
      },
    ],
  },
  {
    slug: "verifieringsgranskning",
    title: "Verifieringsgranskning",
    role: "admin",
    section: "Hantering",
    keywords: [
      "verifiering",
      "granskning",
      "kompetens",
      "certifikat",
      "diplom",
      "godkänn",
      "avvisa",
      "leverantör",
    ],
    summary:
      "Granska leverantörers kompetensansökningar och godkänn eller avvisa med kommentar.",
    content: [
      {
        paragraphs: [
          "Under Verifieringar granskar du leverantörers kompetensansökningar.",
        ],
      },
      {
        heading: "För varje ansökan ser du",
        bullets: [
          "Leverantörsnamn och företag",
          "Kompetenstyp, titel, utfärdare och år",
          "Uppladdade bilder (diplom, certifikat, etc.)",
        ],
      },
      {
        heading: "Åtgärder",
        bullets: [
          "Godkänn -- kompetensen visas med grön badge på leverantörens profil",
          "Avvisa -- skriv en kommentar som förklarar varför (leverantören kan redigera och skicka in igen)",
        ],
      },
    ],
  },
  {
    slug: "notifikationer",
    title: "Notifikationer",
    role: "admin",
    section: "Kommunikation",
    keywords: [
      "notifikationer",
      "meddelanden",
      "skicka",
      "målgrupp",
      "alla",
      "kunder",
      "leverantörer",
      "bulk",
    ],
    summary:
      "Skicka notifikationer till alla användare eller en specifik målgrupp som kunder eller leverantörer.",
    content: [
      {
        paragraphs: [
          "Under Notifikationer kan du skicka meddelanden till användare.",
        ],
      },
      {
        heading: "Målgrupper",
        bullets: [
          "Alla -- alla registrerade användare",
          "Kunder -- bara kunder",
          "Leverantörer -- bara leverantörer",
        ],
      },
      {
        paragraphs: [
          "Ange rubrik och meddelande. Notifikationerna skapas i bulk och visas i användarnas klocka.",
        ],
      },
    ],
  },
  {
    slug: "systeminstellningar",
    title: "Systeminställningar",
    role: "admin",
    section: "System",
    keywords: [
      "system",
      "inställningar",
      "feature flags",
      "flaggor",
      "hälsa",
      "cron",
      "databas",
      "e-post",
      "toggle",
    ],
    summary:
      "Övervaka systemhälsa och hantera feature flags som styr vilka funktioner som är aktiva på plattformen.",
    content: [
      {
        paragraphs: ["Under System ser du:"],
        bullets: [
          "Systemhälsa -- databasstatus och svarstid",
          "Cron-status -- senaste påminnelsekörning",
        ],
      },
      {
        heading: "Feature flags",
        paragraphs: [
          "Feature flags styr vilka funktioner som är aktiva. Varje flagga kan slås av och på i realtid.",
        ],
        bullets: [
          "Röstloggning -- AI-baserad arbetsloggning",
          "Ruttplanering -- Ruttplaneringsverktyg",
          "Rutt-annonser -- Publicera ruttannonser",
          "Kundinsikter -- AI-genererade kundinsikter",
          "Besöksplanering -- Återbesöksplanering",
          "Gruppbokningar -- Gruppbokningsfunktionalitet (under utveckling)",
          "Affärsinsikter -- Utökad analytics-sida",
          "Självservice-ombokning -- Kunder kan boka om sina egna bokningar",
          "Återkommande bokningar -- Möjlighet att skapa återkommande bokningsserier",
          "Offlineläge -- PWA-stöd med offline-cachning av bokningar och rutter för leverantörer",
          "Följ leverantör -- Kunder kan följa leverantörer och få personliga ruttannonser",
          "Besöksplanering (kund) -- Kunder ser servicestatus-badges och kan sätta egna intervall",
        ],
      },
      {
        paragraphs: [
          "Flaggor kan slås av och på i realtid. Ändringar sparas i Redis och gäller omedelbart.",
        ],
      },
      {
        heading: "Utveckling & Test",
        bullets: [
          "E-post-toggle -- stäng av skarp e-postutskick (loggar istället). Användbart under utveckling och testning.",
        ],
      },
    ],
  },
]
