import type { HelpArticle } from "./types"

export const customerArticles: HelpArticle[] = [
  {
    slug: "hitta-leverantorer",
    title: "Hitta leverantörer",
    role: "customer",
    section: "Sökning",
    keywords: [
      "leverantör",
      "sök",
      "filter",
      "betyg",
      "recensioner",
      "profil",
      "avstånd",
      "plats",
      "kompetenser",
      "öppettider",
    ],
    summary:
      "Sök och filtrera bland alla aktiva tjänsteleverantörer baserat på namn, plats, betyg och tjänstetyp.",
    content: [
      {
        paragraphs: [
          "Gå till Leverantörer i menyn för att bläddra bland alla aktiva tjänsteleverantörer.",
        ],
      },
      {
        heading: "Du kan",
        bullets: [
          "Söka på namn eller tjänstetyp",
          "Filtrera på plats och avstånd",
          "Sortera på högst betyg eller flest recensioner",
          "Se varje leverantörs profilbild, betyg och antal omdömen",
          "Klicka på en leverantör för att se fullständig profil",
        ],
      },
      {
        paragraphs: [
          "Dina sökfilter sparas i URL:en, så om du klickar in på en leverantörsprofil och sedan går tillbaka bevaras dina filter.",
        ],
      },
      {
        heading: "På leverantörens profil ser du",
        bullets: [
          "Beskrivning av verksamheten",
          "Alla tjänster med priser och tidsåtgång",
          "Öppettider per veckodag",
          "Omdömen från andra kunder",
          "Kompetenser och utbildningar med verifieringsstatus (grön badge = verifierad, grå = ej granskad) och bilder",
          "Kommande besök i ditt område",
        ],
      },
    ],
  },
  {
    slug: "boka-en-tjanst",
    title: "Boka en tjänst",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "boka",
      "bokning",
      "tid",
      "datum",
      "kalender",
      "bekräfta",
      "häst",
      "tjänst",
      "traditionell",
    ],
    summary:
      "Boka en tjänst genom att välja leverantör, tjänst, datum, tid och häst.",
    content: [
      {
        paragraphs: [
          "Traditionell bokning innebär att du väljer ett specifikt datum och en tid.",
        ],
      },
      {
        heading: "Så här bokar du",
        steps: [
          "Gå till leverantörens profil",
          "Välj den tjänst du vill boka",
          "Välj datum i kalendern (lediga dagar visas)",
          "Välj en ledig tid",
          "Välj häst från ditt register (eller skriv hästens namn manuellt)",
          "Lägg till eventuella kommentarer eller önskemål",
          "Granska en sammanfattning av bokningen (tjänst, datum, tid, häst)",
          "Bekräfta bokningen",
        ],
      },
      {
        heading: "Vad händer sen?",
        bullets: [
          "Leverantören får en notifikation om din bokning",
          "Du får besked när leverantören accepterar eller avböjer",
          "Vid bekräftelse kan du betala direkt i appen",
        ],
      },
      {
        paragraphs: [
          "Systemet kontrollerar automatiskt att det inte finns dubbelbokningar och att det finns tillräckligt med restid mellan leverantörens bokningar.",
        ],
      },
    ],
  },
  {
    slug: "flexibel-bokning",
    title: "Flexibel bokning",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "flexibel",
      "beställning",
      "rutt",
      "datumintervall",
      "akut",
      "prioritet",
      "adress",
      "order",
    ],
    summary:
      "Skapa en flexibel beställning utan exakt tid så att leverantören lägger in dig i en rutt när det passar.",
    content: [
      {
        paragraphs: [
          "Om du inte behöver en exakt tid kan du skapa en flexibel beställning. Leverantören lägger då in dig i en rutt när det passar.",
        ],
      },
      {
        heading: "Skapa en flexibel beställning",
        steps: [
          "Gå till Beställningar eller bläddra bland leverantörers annonserade rutter",
          "Välj tjänstetyp (t.ex. \"Hovbeläggning\")",
          "Ange din adress",
          "Välj ett datumintervall (t.ex. \"15 feb - 1 mar\")",
          "Ange antal hästar",
          "Välj prioritet: Normal eller Akut",
          "Lägg till eventuella instruktioner (t.ex. \"Parkera vid röda ladan\")",
        ],
      },
      {
        paragraphs: [
          "Om en leverantör redan har annonserat en rutt i ditt område kan du ansluta dig direkt till den rutten.",
          "Du får en notifikation när leverantören har planerat in dig i en rutt, inklusive beräknad ankomsttid.",
        ],
      },
    ],
  },
  {
    slug: "aterkommande-bokning",
    title: "Återkommande bokning",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "återkommande",
      "regelbunden",
      "serie",
      "intervall",
      "schema",
      "automatisk",
      "vecka",
      "hovbeläggning",
    ],
    summary:
      "Skapa en återkommande bokning som schemalägger flera tillfällen automatiskt med valfritt intervall.",
    content: [
      {
        paragraphs: [
          "Om du behöver regelbundna besök (t.ex. hovbeläggning var 8:e vecka) kan du skapa en återkommande bokning som schemalägger flera tillfällen automatiskt.",
          "Förutsättning: Leverantören måste ha aktiverat återkommande bokningar i sina inställningar.",
        ],
      },
      {
        heading: "Skapa en återkommande bokning",
        steps: [
          "Börja boka som vanligt (välj leverantör, tjänst, datum och tid)",
          "Slå på \"Gör detta återkommande\"",
          "Välj intervall: varje vecka, varannan vecka, var 4:e, 6:e eller 8:e vecka",
          "Välj antal tillfällen: 2, 4, 6, 8 eller 12",
          "Bekräfta bokningen",
        ],
      },
      {
        paragraphs: [
          "Systemet skapar alla bokningar i serien automatiskt. Datum som krockar med leverantörens schema (stängt, redan fullbokat, för kort restid) hoppas över -- du ser vilka datum som hoppades över och varför i resultatdialogen.",
        ],
      },
      {
        heading: "Resultatdialog",
        bullets: [
          "Hur många bokningar som skapades (t.ex. \"8 av 8 bokningar skapades\")",
          "Startdatum och intervall",
          "Om några datum hoppades över visas de med anledning",
        ],
      },
      {
        heading: "I bokningslistan",
        paragraphs: [
          "Bokningar som tillhör en serie markeras med en lila \"Återkommande\"-badge i din bokningslista. Varje bokning i serien kan avbokas individuellt utan att påverka övriga bokningar i serien.",
        ],
      },
      {
        heading: "E-postbekräftelse",
        paragraphs: [
          "Du får en bekräftelse via e-post med en lista över alla skapade datum i serien.",
        ],
      },
      {
        tip: "Bakom feature flag: Funktionen kan stängas av via admin-systeminställningar.",
      },
    ],
  },
  {
    slug: "hantera-bokningar",
    title: "Hantera bokningar",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "bokningar",
      "status",
      "avboka",
      "betala",
      "omdöme",
      "bekräftad",
      "genomförd",
      "väntar",
      "filtrera",
    ],
    summary:
      "Se och hantera alla dina bokningar med statusöversikt, filtrering och möjlighet att avboka eller betala.",
    content: [
      {
        paragraphs: [
          "Under Mina bokningar ser du alla dina bokningar med status.",
        ],
      },
      {
        heading: "Statusar",
        bullets: [
          "Väntar på svar -- Leverantören har inte svarat ännu",
          "Bekräftad -- Leverantören har accepterat",
          "Genomförd -- Tjänsten är utförd",
          "Ej infunnit -- Du dök inte upp till bokningen",
          "Avbokad -- Bokningen är avbokad",
        ],
      },
      {
        heading: "Du kan",
        bullets: [
          "Filtrera på kommande, tidigare eller alla bokningar",
          "Avboka en bokning (om den inte redan är betald)",
          "Betala för bekräftade bokningar",
          "Lämna omdöme efter genomförd bokning",
        ],
      },
    ],
  },
  {
    slug: "betalning-och-kvitto",
    title: "Betalning och kvitto",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "betala",
      "betalning",
      "kvitto",
      "PDF",
      "faktura",
      "pris",
      "kr",
      "fakturanummer",
    ],
    summary:
      "Betala för bekräftade bokningar direkt i appen och ladda ner kvitto som PDF.",
    content: [
      {
        paragraphs: [
          "När en bokning är bekräftad eller genomförd kan du betala direkt i appen.",
        ],
      },
      {
        heading: "Så här betalar du",
        steps: [
          "Gå till Mina bokningar",
          "Klicka Betala X kr på den aktuella bokningen",
          "Betalningen behandlas och du får ett kvittonummer",
          "Kvittot kan laddas ner som PDF",
        ],
      },
      {
        paragraphs: [
          "Kvittot innehåller fakturanummer (format: EQ-YYYYMM-XXXX), datum, tjänst, belopp och leverantörsinformation.",
        ],
      },
    ],
  },
  {
    slug: "hastregistret",
    title: "Hästregistret",
    role: "customer",
    section: "Hästar",
    keywords: [
      "häst",
      "registrera",
      "namn",
      "ras",
      "UELN",
      "mikrochip",
      "foto",
      "kön",
      "färg",
      "födelseår",
    ],
    summary:
      "Registrera och hantera dina hästar med uppgifter som ras, UELN-nummer, foto och medicinsk information.",
    content: [
      {
        paragraphs: [
          "Under Mina hästar kan du registrera och hantera alla dina hästar.",
        ],
      },
      {
        heading: "Lägg till häst",
        bullets: [
          "Namn (obligatoriskt)",
          "Ras",
          "Födelseår",
          "Färg",
          "Kön (sto, valack, hingst)",
          "UELN-nummer (Unique Equine Life Number, max 15 tecken)",
          "Mikrochip-ID (max 15 tecken)",
          "Särskilda behov och medicinsk information",
          "Foto (dra och släpp eller klicka för att ladda upp)",
        ],
      },
      {
        heading: "Fördelar med att registrera hästar",
        bullets: [
          "Vid bokning kan du välja häst från en dropdown istället för att skriva manuellt",
          "All bokningshistorik kopplas till rätt häst",
          "Hälsotidslinjen ger en samlad bild av vård och behandlingar",
          "Foto gör det lättare att identifiera hästen",
        ],
      },
      {
        paragraphs: [
          "Borttagna hästar tas bort mjukt (dold men inte raderad) så att bokningshistoriken bevaras.",
        ],
      },
    ],
  },
  {
    slug: "servicestatus",
    title: "Servicestatus",
    role: "customer",
    section: "Hästar",
    keywords: [
      "service",
      "status",
      "badge",
      "försenad",
      "snart",
      "intervall",
      "hovvård",
      "påminnelse",
    ],
    summary:
      "Se automatiska statusbadges på dina hästar som visar om det är dags för service baserat på senaste bokningen.",
    content: [
      {
        paragraphs: [
          "På din hästlista ser du automatiskt om någon häst behöver service. Systemet beräknar detta baserat på senaste bokningens datum och tjänstens rekommenderade intervall.",
        ],
      },
      {
        heading: "Statusbadges på hästlistan",
        bullets: [
          "Röd badge \"Försenad\" -- Hästen borde redan ha fått service",
          "Gul badge \"Snart dags\" -- Service behövs inom 2 veckor",
        ],
      },
      {
        paragraphs: [
          "Badges visar tjänstens namn (t.ex. \"Hovvård\") så du ser vilken typ av service det gäller.",
        ],
      },
      {
        heading: "Kundstyrda serviceintervall",
        paragraphs: [
          "Du kan själv bestämma hur ofta din häst ska få service -- oberoende av leverantörens standardintervall.",
        ],
        steps: [
          "Gå till en häst under Mina hästar",
          "Klicka på fliken Intervall",
          "Sätt intervall (i veckor) per tjänstetyp",
        ],
      },
      {
        paragraphs: [
          "Ditt eget intervall gäller före leverantörens rekommendation och tjänstens standardvärde. Om du inte har satt ett eget intervall används leverantörens rekommendation.",
        ],
        tip: "Bakom feature flag: Funktionen kan stängas av via admin-systeminställningar.",
      },
    ],
  },
  {
    slug: "halsotidslinje",
    title: "Hälsotidslinje",
    role: "customer",
    section: "Hästar",
    keywords: [
      "hälsa",
      "tidslinje",
      "historik",
      "anteckning",
      "veterinär",
      "hovvård",
      "medicinering",
      "skada",
      "vårdhistorik",
    ],
    summary:
      "Se hela hästens vårdhistorik kronologiskt med bokningar och egna hälsoanteckningar.",
    content: [
      {
        paragraphs: [
          "Varje registrerad häst har en hälsotidslinje som samlar all vårdinformation kronologiskt.",
        ],
      },
      {
        heading: "Tidslinjen visar",
        bullets: [
          "Genomförda bokningar (hovslagare, veterinär, etc.)",
          "Hälsoanteckningar du lagt till själv",
        ],
      },
      {
        heading: "Kategorier för anteckningar",
        bullets: [
          "Veterinär (vaccinationer, hälsokontroller)",
          "Hovvård (skoning, verkning)",
          "Skada (skador, olyckor)",
          "Medicinering (läkemedel, doser)",
          "Övrigt (egna observationer)",
        ],
      },
      {
        paragraphs: [
          "Du kan filtrera tidslinjen per kategori och lägga till nya anteckningar när som helst. Det här ger dig och dina leverantörer en komplett bild av hästens vårdhistorik.",
        ],
      },
    ],
  },
  {
    slug: "recensioner",
    title: "Recensioner",
    role: "customer",
    section: "Omdömen",
    keywords: [
      "recension",
      "omdöme",
      "betyg",
      "stjärnor",
      "kommentar",
      "redigera",
      "leverantör",
      "svar",
    ],
    summary:
      "Lämna omdöme med betyg och kommentar efter genomförda bokningar, och redigera eller ta bort i efterhand.",
    content: [
      {
        paragraphs: [
          "Efter en genomförd bokning kan du lämna ett omdöme.",
        ],
      },
      {
        heading: "Så här fungerar omdömen",
        bullets: [
          "Ge betyg 1-5 stjärnor",
          "Skriv en valfri kommentar (max 500 tecken)",
          "Du kan redigera eller ta bort ditt omdöme i efterhand",
        ],
      },
      {
        paragraphs: [
          "Omdömen visas publikt på leverantörens profil och hjälper andra hästägare att välja rätt leverantör. Leverantören kan svara på ditt omdöme.",
        ],
      },
    ],
  },
  {
    slug: "gruppbokning",
    title: "Gruppbokning",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "grupp",
      "gruppbokning",
      "stall",
      "inbjudningskod",
      "kod",
      "dela",
      "tillsammans",
      "grupprequest",
    ],
    summary:
      "Skapa eller gå med i en gruppbokning med andra hästägare på samma stall eller i samma område.",
    content: [
      {
        paragraphs: [
          "Om ni är flera hästägare på samma stall eller i samma område kan ni skapa en grupprequest och boka tillsammans. Det ger leverantören möjlighet att planera in alla i samma besök.",
        ],
      },
      {
        heading: "Skapa en grupprequest",
        steps: [
          "Gå till Gruppbokning i menyn",
          "Välj tjänstetyp (t.ex. \"Hovbeläggning\")",
          "Ange plats och ett datumintervall",
          "Systemet skapar en unik inbjudningskod (8 tecken)",
          "Dela koden med andra hästägare",
        ],
      },
      {
        heading: "Gå med i en grupp",
        bullets: [
          "Ange inbjudningskoden eller klicka på en delad länk",
          "Fyll i information om din häst",
          "Du ser hur många som redan gått med",
        ],
      },
      {
        heading: "Vad händer sen?",
        bullets: [
          "Leverantörer ser öppna grupprequests i sitt område",
          "När en leverantör matchar gruppen skapas individuella bokningar för alla deltagare",
          "Du får en notifikation med datum, tid och leverantörsinformation",
        ],
      },
      {
        paragraphs: [
          "Du kan lämna en grupp innan den matchats. Om du är den som skapade gruppen kan du även avbryta hela requesten.",
        ],
      },
    ],
  },
  {
    slug: "hastprofil",
    title: "Hästprofil",
    role: "customer",
    section: "Hästar",
    keywords: [
      "profil",
      "dela",
      "länk",
      "veterinär",
      "försäkring",
      "vårdhistorik",
      "utskrift",
      "delbar",
    ],
    summary:
      "Skapa en delbar länk till din hästs uppgifter och vårdhistorik som är giltig i 30 dagar.",
    content: [
      {
        paragraphs: [
          "Du kan skapa en delbar länk till din hästs uppgifter och vårdhistorik -- en digital hästprofil.",
        ],
      },
      {
        heading: "Skapa en delbar hästprofil",
        steps: [
          "Gå till din häst under Mina hästar",
          "Klicka Dela hästprofil",
          "En unik länk skapas som är giltig i 30 dagar",
          "Dela länken med veterinär, ny ägare eller försäkringsbolag",
        ],
      },
      {
        heading: "Vad visas i hästprofilen",
        bullets: [
          "Hästens grunduppgifter (namn, ras, födelseår, kön, foto)",
          "UELN-nummer och mikrochip-ID (om registrerat)",
          "Vårdhistorik: veterinär, hovvård, skador och medicinering",
          "Utskriftsvänlig layout",
        ],
      },
      {
        heading: "Integritetsskydd",
        paragraphs: [
          "Privata anteckningar (kategorin \"Övrigt\") visas inte i hästprofilen. Länken kräver ingen inloggning men upphör automatiskt efter 30 dagar.",
        ],
      },
    ],
  },
  {
    slug: "dataexport",
    title: "Dataexport",
    role: "customer",
    section: "Konto",
    keywords: [
      "export",
      "data",
      "GDPR",
      "JSON",
      "CSV",
      "personuppgifter",
      "ladda ner",
    ],
    summary:
      "Exportera all din personliga data i JSON- eller CSV-format enligt GDPR.",
    content: [
      {
        paragraphs: [
          "Du har rätt att exportera all din personliga data (GDPR).",
        ],
      },
      {
        heading: "Så här exporterar du din data",
        steps: [
          "Gå till Min profil",
          "Klicka Exportera min data",
          "Välj format: JSON eller CSV",
          "Filen laddas ner direkt",
        ],
      },
      {
        heading: "Exporten innehåller",
        bullets: [
          "Personuppgifter (namn, e-post)",
          "Alla bokningar med status och detaljer",
          "Hästregister med anteckningar",
          "Recensioner du skrivit",
        ],
      },
    ],
  },
  {
    slug: "notifikationer",
    title: "Notifikationer",
    role: "customer",
    section: "Konto",
    keywords: [
      "notifikation",
      "avisering",
      "klocka",
      "olästa",
      "e-post",
      "meddelande",
      "påminnelse",
    ],
    summary:
      "Få notifikationer vid viktiga händelser som bokningsbekräftelser, betalningar och ruttannonser.",
    content: [
      {
        paragraphs: [
          "Du får notifikationer vid viktiga händelser. Klockikonen i menyraden visar antal olästa.",
        ],
      },
      {
        heading: "Du notifieras när",
        bullets: [
          "Leverantören bekräftar eller avböjer din bokning",
          "En bokning markeras som genomförd",
          "Betalning har gått igenom",
          "Leverantören svarar på ditt omdöme",
          "Det är dags att boka om en tjänst (automatisk påminnelse)",
          "En leverantör annonserar en rutt i ditt område",
          "Någon går med i din grupprequest",
          "En grupprequest matchas av en leverantör",
        ],
      },
      {
        paragraphs: [
          "Klicka på en notifikation för att komma direkt till den aktuella bokningen eller sidan. Du kan markera enskilda eller alla notifikationer som lästa.",
          "Notifikationer skickas även via e-post.",
        ],
      },
    ],
  },
  {
    slug: "bokningspaminnelser",
    title: "Bokningspåminnelser",
    role: "customer",
    section: "Bokningar",
    keywords: [
      "påminnelse",
      "24 timmar",
      "e-post",
      "checklista",
      "förberedelse",
      "avprenumerera",
    ],
    summary:
      "Få automatiska påminnelser 24 timmar innan varje bekräftad bokning med förberedelsechecklista.",
    content: [
      {
        paragraphs: [
          "Du får automatiskt en påminnelse 24 timmar innan varje bekräftad bokning.",
        ],
      },
      {
        heading: "Påminnelsen innehåller",
        bullets: [
          "Datum, tid och tjänst",
          "Leverantörens namn",
          "Förberedelsechecklista (lugn miljö, upplyst, plant underlag, ren häst)",
        ],
      },
      {
        heading: "Hur påminnelserna skickas",
        bullets: [
          "E-post med bokningsdetaljer och checklista",
          "In-app-notifikation i klockikonen",
        ],
      },
      {
        heading: "Stänga av påminnelser",
        bullets: [
          "Klicka på unsubscribe-länken i påminnelsemailet",
          "Eller gå till Min profil och inaktivera e-postpåminnelser",
        ],
      },
      {
        paragraphs: [
          "Du kan när som helst slå på påminnelser igen via din profil.",
        ],
      },
    ],
  },
  {
    slug: "folj-leverantor",
    title: "Följ leverantör",
    role: "customer",
    section: "Sökning",
    keywords: [
      "följ",
      "leverantör",
      "ruttannons",
      "kommun",
      "personlig",
      "notifikation",
      "servicebehov",
    ],
    summary:
      "Följ leverantörer du gillar för att få personliga ruttannonser och servicemeddelanden.",
    content: [
      {
        paragraphs: [
          "Du kan följa leverantörer du gillar för att få personliga ruttannonser.",
        ],
      },
      {
        heading: "Följ en leverantör",
        steps: [
          "Gå till leverantörens profil",
          "Klicka Följ",
          "Knappen ändras till Följer (klicka igen för att sluta följa)",
        ],
      },
      {
        heading: "Välj kommun",
        paragraphs: [
          "För att få relevanta ruttannonser behöver du ange vilken kommun du befinner dig i.",
        ],
        steps: [
          "Gå till Min profil",
          "Välj kommun i dropdown-menyn",
          "Spara",
        ],
      },
      {
        heading: "Personliga ruttannonser",
        paragraphs: [
          "När en leverantör du följer annonserar en rutt i din kommun får du en notifikation. Om din häst dessutom är försenad för service får du ett personligt meddelande med information om både hästens servicebehov och leverantörens lediga tider.",
          "Exempel: \"Blansen behövde skoning för 2 veckor sedan. Anna har lediga tider i Kungsbacka nästa vecka.\"",
        ],
      },
      {
        tip: "Bakom feature flag: Funktionen kan stängas av via admin-systeminställningar.",
      },
    ],
  },
]
