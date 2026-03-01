import type { HelpArticle } from "./types"

export const providerArticles: HelpArticle[] = [
  {
    slug: "komma-igang",
    title: "Komma igång som leverantör",
    role: "provider",
    section: "Kom igång",
    keywords: [
      "komma igång",
      "starta",
      "checklista",
      "ny leverantör",
      "uppsättning",
      "setup",
      "registrera",
    ],
    summary:
      "Steg-för-steg-checklista för att komma igång som leverantör på Equinet.",
    content: [
      {
        paragraphs: [
          "När du skapar ett leverantörskonto möts du av en checklista på din dashboard som vägleder dig genom uppsättningen.",
        ],
        steps: [
          "Fyll i din företagsprofil",
          "Lägg till minst en tjänst",
          "Ställ in dina öppettider",
          "Verifiera din e-postadress",
          "(Valfritt) Ansök om verifiering",
        ],
      },
      {
        paragraphs: [
          "Du ser din framgång som en procent-indikator. När alla steg är klara är du redo att ta emot bokningar.",
        ],
      },
    ],
  },
  {
    slug: "foretagsprofil",
    title: "Företagsprofil",
    role: "provider",
    section: "Profil",
    keywords: [
      "profil",
      "företagsprofil",
      "profilbild",
      "företagsnamn",
      "beskrivning",
      "adress",
      "serviceområde",
      "bokningsinställningar",
    ],
    summary:
      "Så fyller du i och hanterar din företagsprofil med kontaktuppgifter, serviceområde och bokningsinställningar.",
    content: [
      {
        paragraphs: ["Under Min profil finns tre flikar:"],
      },
      {
        heading: "Profil-fliken",
        bullets: [
          "Profilbild -- ladda upp en bild som visas för kunder (dra och släpp eller klicka)",
          "Företagsnamn -- det namn kunder ser",
          "Beskrivning -- berätta om din verksamhet och erfarenhet",
          "Adress, ort, postnummer -- din utgångspunkt (används för avståndberäkning)",
          "Serviceområde -- hur långt du åker (standard 50 km radie)",
        ],
      },
      {
        heading: "Tillgänglighet-fliken",
        bullets: [
          "Veckoschema och tillgänglighetsundantag",
          "Kompetenser & verifiering",
        ],
      },
      {
        heading: "Bokningsinställningar-fliken",
        bullets: [
          "Bokningsinställningar (acceptera nya kunder, etc.)",
          "Ombokning och återkommande bokningar",
        ],
      },
      {
        paragraphs: [
          "Adressen omvandlas automatiskt till GPS-koordinater som används vid ruttplanering och restidsberäkning.",
        ],
      },
    ],
  },
  {
    slug: "stang-for-nya-kunder",
    title: "Stäng för nya kunder",
    role: "provider",
    section: "Profil",
    keywords: [
      "stäng",
      "nya kunder",
      "acceptera",
      "befintliga kunder",
      "toggle",
      "fullt schema",
    ],
    summary:
      "Hur du stänger för nya kunder så att bara befintliga kunder kan boka hos dig.",
    content: [
      {
        paragraphs: [
          'Under Min profil hittar du en toggle "Accepterar nya kunder".',
        ],
        bullets: [
          "Aktiverad (standard): Alla kunder kan boka hos dig",
          "Inaktiverad: Bara befintliga kunder kan boka",
        ],
      },
      {
        paragraphs: [
          "Vem räknas som befintlig kund? En kund som har minst en genomförd bokning hos dig.",
          "Nya kunder som besöker din profil ser en informationsruta som förklarar att du inte tar emot nya kunder just nu. Befintliga kunder märker ingen skillnad.",
        ],
        tip: "Det här är användbart om du har fullt schema och bara vill fokusera på dina återkommande kunder.",
      },
    ],
  },
  {
    slug: "hantera-tjanster",
    title: "Hantera tjänster",
    role: "provider",
    section: "Tjänster",
    keywords: [
      "tjänster",
      "pris",
      "tid",
      "hovbeläggning",
      "akupunktur",
      "återbesöksintervall",
      "inaktivera",
    ],
    summary:
      "Så lägger du till, redigerar och hanterar de tjänster du erbjuder.",
    content: [
      {
        paragraphs: [
          "Under Mina tjänster lägger du till de tjänster du erbjuder.",
        ],
      },
      {
        heading: "För varje tjänst anger du",
        bullets: [
          'Namn (t.ex. "Hovbeläggning", "Akupunktur")',
          "Beskrivning",
          "Pris i kronor",
          "Tidsåtgång i minuter",
          "Rekommenderat återbesöksintervall (i veckor) -- t.ex. 8 veckor för hovbeläggning",
        ],
      },
      {
        paragraphs: [
          "Återbesöksintervallet gör att systemet automatiskt påminner kunden när det är dags att boka igen. Detta genererar återkommande bokningar utan att du behöver följa upp manuellt.",
          "Du kan aktivera och inaktivera tjänster. Inaktiva tjänster visas inte för kunder.",
        ],
      },
    ],
  },
  {
    slug: "tillganglighet-och-schema",
    title: "Tillgänglighet och schema",
    role: "provider",
    section: "Kalender",
    keywords: [
      "tillgänglighet",
      "schema",
      "öppettider",
      "veckoschema",
      "undantag",
      "semester",
      "kalender",
      "stängt",
    ],
    summary:
      "Hur du ställer in veckoschema, skapar undantag och använder kalendervyn.",
    content: [
      {
        heading: "Veckoschema",
        paragraphs: [
          "Under Kalender ställer du in dina ordinarie öppettider per veckodag. Till exempel:",
        ],
        bullets: [
          "Måndag-fredag: 08:00-17:00",
          "Lördag: 09:00-13:00",
          "Söndag: Stängt",
        ],
      },
      {
        heading: "Undantag",
        paragraphs: [
          "För enskilda datum kan du skapa undantag som överträder veckoschemat:",
        ],
        bullets: [
          "Stängt en dag (semester, sjukdom, etc.)",
          "Ändrade tider (t.ex. 10:00-14:00 istället för ordinarie)",
          "Alternativ plats (om du jobbar från annan ort den dagen)",
        ],
      },
      {
        paragraphs: [
          'Du kan ange en anledning ("Semester", "Mässa i Jönköping") och alternativa koordinater om du befinner dig på annan plats.',
        ],
      },
      {
        heading: "Kalendervy",
        paragraphs: ["Kalendern visar en veckoöversikt med:"],
        bullets: [
          "Gröna block för lediga tider",
          "Röda block för bokade tider",
          "Svarta block för undantag",
        ],
      },
    ],
  },
  {
    slug: "hantera-bokningar",
    title: "Hantera bokningar",
    role: "provider",
    section: "Bokningar",
    keywords: [
      "bokningar",
      "acceptera",
      "avböja",
      "genomförd",
      "avbokad",
      "väntande",
      "bekräftad",
      "leverantörsanteckningar",
    ],
    summary:
      "Hur du hanterar inkommande och befintliga bokningar med statusar, detaljer och leverantörsanteckningar.",
    content: [
      {
        paragraphs: [
          "Under Bokningar ser du alla inkommande och befintliga bokningar.",
        ],
      },
      {
        heading: "Statusar",
        bullets: [
          "Väntande -- Acceptera eller avböj (med anledning)",
          "Bekräftad -- Utför tjänsten, markera sedan som genomförd",
          "Genomförd -- Klar, kunden kan nu betala och lämna omdöme",
          "Ej infunnit -- Kunden infann sig inte",
          "Avbokad -- Avbokad av kund eller dig",
        ],
      },
      {
        heading: "För varje bokning ser du",
        bullets: [
          "Kundens namn och kontaktuppgifter",
          "Tjänst, datum, tid",
          "Hästinformation och eventuella kundkommentarer",
        ],
      },
      {
        heading: "Leverantörsanteckningar",
        paragraphs: [
          "På bekräftade och genomförda bokningar kan du skriva egna anteckningar -- till exempel vad du observerade, vilken behandling du gav, eller vad som bör följas upp nästa gång.",
        ],
        steps: [
          "Klicka på en bokning i kalendern för att öppna bokningsdetaljen",
          'Skriv din anteckning i textfältet "Leverantörsanteckningar"',
          "Klicka Spara (eller Rensa för att ta bort)",
        ],
      },
      {
        paragraphs: [
          "Dina anteckningar är bara synliga för dig. Kunden ser dem inte, och de visas inte i hästpasset eller andra publika vyer. Anteckningarna visas även i hästens hälsotidslinje så att du kan se dina tidigare observationer inför nästa besök.",
        ],
      },
    ],
  },
  {
    slug: "manuell-bokning",
    title: "Manuell bokning",
    role: "provider",
    section: "Bokningar",
    keywords: [
      "manuell bokning",
      "skapa bokning",
      "boka åt kund",
      "kalender",
      "ny bokning",
      "ringer",
    ],
    summary:
      "Hur du skapar bokningar åt kunder direkt från kalendervyn, till exempel när en kund ringer.",
    content: [
      {
        paragraphs: [
          "Du kan skapa bokningar åt kunder direkt från kalendervyn -- till exempel när en kund ringer och vill boka.",
        ],
        steps: [
          "Klicka på en dag i Kalendern",
          "Klicka Ny bokning",
          "Sök efter en befintlig kund (bland dina tidigare kunder) eller ange namn och telefonnummer för en ny kund",
          "Välj tjänst och tid från en dropdown med lediga 15-minutersintervall",
          "Välj häst (om kunden har registrerade hästar) eller ange hästinformation manuellt",
          "Bekräfta",
        ],
      },
      {
        paragraphs: [
          'Manuellt skapade bokningar markeras med ett "M" i kalendern så du kan skilja dem från kundinitierade bokningar. De bekräftas automatiskt (hoppar över "väntar på svar"-steget).',
        ],
      },
    ],
  },
  {
    slug: "aterkommande-bokningar",
    title: "Återkommande bokningar",
    role: "provider",
    section: "Bokningar",
    keywords: [
      "återkommande",
      "serie",
      "intervall",
      "max tillfällen",
      "upprepning",
      "regelbundna",
    ],
    summary:
      "Hur du aktiverar återkommande bokningar, sätter max antal tillfällen och skapar serier åt kunder.",
    content: [
      {
        paragraphs: [
          "Som leverantör bestämmer du om dina kunder ska kunna skapa återkommande bokningar, och hur långa serier de får skapa.",
        ],
      },
      {
        heading: "Aktivera återkommande bokningar",
        steps: [
          "Gå till Min profil",
          'Slå på "Tillåt återkommande bokningar"',
          'Välj "Max antal tillfällen per serie" -- det högsta antal bokningar en kund kan skapa i en serie',
        ],
      },
      {
        paragraphs: [
          "Tillgängliga max-värden: 4, 6, 8, 12, 24 eller 52 tillfällen.",
          "Inställningen sparas direkt och gäller för alla nya bokningsserier. Befintliga serier påverkas inte.",
        ],
      },
      {
        heading: "Skapa serie via manuell bokning",
        paragraphs: [
          "Du kan också skapa återkommande bokningar åt kunder via Ny bokning i kalendervyn:",
        ],
        steps: [
          "Fyll i bokningsuppgifterna som vanligt (kund, tjänst, datum, tid)",
          'Slå på "Gör detta återkommande"',
          "Välj intervall och antal tillfällen",
          "Bekräfta -- alla bokningar i serien skapas automatiskt",
        ],
      },
      {
        heading: "Serie i kalendern",
        paragraphs: [
          'Bokningar som tillhör en serie markeras med en upprepningsikon i kalendern. Hovra över ikonen för att se "Återkommande bokning".',
          "Varje bokning i serien hanteras individuellt -- du kan bekräfta, genomföra eller avboka enskilda bokningar utan att påverka resten av serien.",
        ],
        tip: "Den här funktionen kan vara inaktiverad och kanske inte är tillgänglig i alla konton.",
      },
    ],
  },
  {
    slug: "rostloggning",
    title: "Röstloggning",
    role: "provider",
    section: "Dagligt arbete",
    keywords: [
      "röstloggning",
      "arbetslogg",
      "diktera",
      "mikrofon",
      "AI",
      "logga arbete",
      "vokabulär",
    ],
    summary:
      "Hur du snabbt dokumenterar utfört arbete genom att diktera eller skriva fritt med AI-stöd.",
    content: [
      {
        paragraphs: [
          "Under Logga arbete kan du snabbt dokumentera utfört arbete genom att diktera eller skriva fritt.",
        ],
      },
      {
        heading: "Så fungerar det",
        steps: [
          "Gå till Logga arbete i leverantörsmenyn (eller tryck på den gröna mikrofon-knappen på mobil)",
          "Diktera med mikrofonen eller skriv i textfältet",
          "AI tolkar din text och föreslår vilken bokning arbetet tillhör",
          "Granska och justera -- AI:n visar en confidence-indikator",
          "Bekräfta för att spara arbetsloggen på bokningen",
        ],
      },
      {
        heading: "Vokabulärinlärning",
        bullets: [
          "Om du korrigerar AI:ns tolkning lär den sig dina termer",
          "Nästa gång du loggar arbete använder AI:n din personliga ordlista",
          "Max 50 termer sparas (äldsta fasas ut)",
        ],
      },
      {
        tip: 'Fungerar bäst med korta, koncisa beskrivningar ("Verkade fram, normalställd, klipper lite kil"). Du kan logga flera bokningar i rad med "Logga nästa"-flödet. Röstinspelning fungerar i Chrome och Safari. I Firefox används textfältet.',
      },
      {
        tip: "Den här funktionen kan vara inaktiverad och kanske inte är tillgänglig i alla konton.",
      },
    ],
  },
  {
    slug: "ruttplanering",
    title: "Ruttplanering",
    role: "provider",
    section: "Ruttplanering",
    keywords: [
      "ruttplanering",
      "rutt",
      "optimera",
      "körsträcka",
      "avstånd",
      "beställningar",
      "kartvy",
    ],
    summary:
      "Hur du använder ruttplaneringen för att optimera din dag med flera besök.",
    content: [
      {
        paragraphs: [
          "Ruttplaneringen hjälper dig att optimera din dag när du har flera besök.",
        ],
      },
      {
        heading: "Bläddra bland beställningar",
        paragraphs: [
          "Under Ruttplanering ser du flexibla beställningar från kunder i ditt område:",
        ],
        bullets: [
          "Sorterade efter avstånd (närmast först)",
          "Filtrerbara på tjänstetyp, prioritet och datum",
          "Akuta beställningar markeras i rött",
          "Kartvy med markörer för varje beställning",
        ],
      },
      {
        heading: "Skapa en optimerad rutt",
        steps: [
          "Välj de beställningar du vill ta med",
          "Systemet beräknar automatiskt den mest effektiva ruttordningen",
          "Du ser total körsträcka och beräknad tid",
          "Justera ordningen manuellt om du vill",
          "Namnge rutten och välj datum",
          "Spara -- kunderna notifieras med beräknad ankomsttid",
        ],
      },
      {
        paragraphs: [
          "Optimeringen använder avståndberäkning fågelvägen med en marginal på 20% för verklig vägsträcka, plus 10 minuters buffert mellan varje stopp.",
        ],
      },
    ],
  },
  {
    slug: "annonsera-rutter",
    title: "Annonsera rutter",
    role: "provider",
    section: "Ruttplanering",
    keywords: [
      "annonsera",
      "annonserade rutter",
      "planerade rutter",
      "kunder i området",
      "haka på",
    ],
    summary:
      "Hur du annonserar planerade rutter så att kunder i området kan ansluta sig.",
    content: [
      {
        paragraphs: [
          "Du kan annonsera planerade rutter så att kunder i området kan ansluta sig.",
        ],
        steps: [
          "Gå till Annonserade rutter",
          "Skapa en ny annons med tjänstetyp, område och datum",
          "Kunder i området ser din annons och kan boka sig",
          "När du har tillräckligt med bokningar skapar du rutten",
        ],
      },
      {
        paragraphs: [
          "Det här fungerar bra för t.ex. hovslagare som regelbundet besöker samma område -- kunderna kan enkelt haka på din planerade tur.",
        ],
      },
      {
        heading: "Kundupplevelsen vid annonserade rutter",
        bullets: [
          "Kunder hittar annonserade rutter under Lediga tider i navigationen",
          "Filtrering på tjänstetyp (t.ex. skoning, verkning) via dropdown",
          "Kalendern gråar ut dagar utanför annonsperioden så kunden ser tillgängliga datum",
          "Vid bokning väljer kunden häst via en dropdown istället för fritext",
          "Tjänster visas med pris direkt på service-chips",
          'Bokningar gjorda via en annonserad rutt visas med en "Via rutt"-badge i kundens bokningslista',
        ],
      },
    ],
  },
  {
    slug: "genomfora-en-rutt",
    title: "Genomföra en rutt",
    role: "provider",
    section: "Ruttplanering",
    keywords: [
      "genomföra rutt",
      "starta rutt",
      "steg-för-steg",
      "stopp",
      "Google Maps",
      "vägbeskrivning",
    ],
    summary:
      "Hur du följer och genomför en rutt steg för steg med statushantering för varje stopp.",
    content: [
      {
        paragraphs: [
          "När du startar en rutt får du en steg-för-steg-vy.",
        ],
      },
      {
        heading: "För varje stopp kan du",
        bullets: [
          "Se kundinformation, adress och tjänst",
          "Öppna vägbeskrivning i Google Maps",
          "Markera ankomst och avgång",
          "Rapportera problem (med kommentar)",
          "Markera stoppet som genomfört",
        ],
      },
      {
        heading: "Stoppstatus",
        bullets: [
          "Planerat (inte påbörjat)",
          "Pågår (du är på plats)",
          "Genomfört",
          "Problem (med anteckning)",
        ],
      },
      {
        paragraphs: [
          "Systemet beräknar automatiskt uppskattad ankomsttid till nästa stopp.",
        ],
      },
    ],
  },
  {
    slug: "recensioner-och-betyg",
    title: "Recensioner och betyg",
    role: "provider",
    section: "Omdömen",
    keywords: [
      "recensioner",
      "betyg",
      "omdömen",
      "svara",
      "genomsnittligt betyg",
      "rykte",
    ],
    summary:
      "Hur du ser och svarar på omdömen från dina kunder.",
    content: [
      {
        paragraphs: [
          "Under Recensioner ser du alla omdömen från dina kunder.",
        ],
      },
      {
        heading: "Du kan",
        bullets: [
          "Se ditt genomsnittliga betyg",
          "Läsa alla omdömen med datum och kommentarer",
          "Svara på omdömen -- skriv ett svar som visas publikt under kundens omdöme",
        ],
      },
      {
        paragraphs: [
          "Bra omdömen bygger ditt rykte och gör att fler kunder hittar dig. Ta dig tid att svara -- det visar att du bryr dig om kundnöjdheten.",
        ],
      },
    ],
  },
  {
    slug: "kundrecensioner",
    title: "Kundrecensioner",
    role: "provider",
    section: "Omdömen",
    keywords: [
      "kundrecension",
      "betygsätt kund",
      "stjärnor",
      "privat",
      "kundomdöme",
    ],
    summary:
      "Hur du betygsätter dina kunder med stjärnor och kommentarer som bara du kan se.",
    content: [
      {
        paragraphs: [
          "Som leverantör kan du också betygsätta dina kunder. Det hjälper dig att komma ihåg upplevelser och planera framtida besök.",
        ],
      },
      {
        heading: "Lämna en kundrecension",
        steps: [
          "Gå till en genomförd bokning",
          "Klicka Betygsätt kund",
          "Ge 1-5 stjärnor",
          "Skriv en valfri kommentar",
        ],
      },
      {
        paragraphs: [
          "Kundrecensioner är bara synliga för dig. Kunden ser inte betyget eller kommentaren.",
        ],
      },
    ],
  },
  {
    slug: "kundregister",
    title: "Kundregister",
    role: "provider",
    section: "Kunder",
    keywords: [
      "kundregister",
      "kunder",
      "kundlista",
      "aktiva",
      "inaktiva",
      "sök kund",
      "hästar",
    ],
    summary:
      "Hur du använder kundregistret för att se, filtrera och söka bland dina kunder.",
    content: [
      {
        paragraphs: [
          "Under Kunder i leverantörsmenyn hittar du en samlad översikt över alla dina kunder.",
        ],
      },
      {
        heading: "Listan visar",
        bullets: [
          "Kundens namn, e-post och telefon",
          "Antal genomförda bokningar",
          "Datum för senaste bokning",
          "Kundens registrerade hästar",
        ],
      },
      {
        heading: "Filtrera och sök",
        bullets: [
          "Alla -- visa samtliga kunder",
          "Aktiva -- kunder med bokning senaste 12 månaderna",
          "Inaktiva -- kunder utan bokning senaste 12 månaderna",
          "Fritextsök -- sök på namn eller e-postadress",
        ],
      },
      {
        paragraphs: [
          "Klicka på en kund för att visa detaljerad information och en lista på kundens hästar.",
          "Kundlistan bygger automatiskt upp sig från genomförda bokningar, men du kan även lägga till kunder manuellt.",
        ],
      },
    ],
  },
  {
    slug: "manuell-kundregistrering",
    title: "Manuell kundregistrering",
    role: "provider",
    section: "Kunder",
    keywords: [
      "manuell kund",
      "lägg till kund",
      "registrera kund",
      "kundregistrering",
    ],
    summary:
      "Hur du lägger till kunder manuellt i kundregistret utan att de behöver ha bokat via plattformen.",
    content: [
      {
        paragraphs: [
          "Du kan lägga till kunder direkt i kundregistret utan att de behöver ha bokat via plattformen.",
        ],
        steps: [
          "Gå till Kunder i leverantörsmenyn",
          "Klicka Lägg till kund",
          "Fyll i namn (obligatoriskt), telefon och e-post (valfritt)",
          "Klicka Spara",
        ],
      },
      {
        paragraphs: [
          "Manuellt tillagda kunder visas i kundregistret med samma funktioner som bokningsgenererade kunder. Du kan ta bort en manuellt tillagd kund via kuvert-ikonen.",
        ],
      },
    ],
  },
  {
    slug: "bjud-in-kund",
    title: "Bjud in manuell kund",
    role: "provider",
    section: "Kunder",
    keywords: [
      "bjud in",
      "inbjudan",
      "spökkund",
      "aktivera konto",
      "e-post",
      "aktiveringslänk",
    ],
    summary:
      "Hur du bjuder in manuellt tillagda kunder att skapa ett riktigt konto via e-postinbjudan.",
    content: [
      {
        paragraphs: [
          'Manuellt tillagda kunder (så kallade "spökkunder") har inget riktigt konto -- de kan inte logga in, boka själva eller se sin hälsotidslinje. Du kan bjuda in dem att skapa ett konto.',
        ],
      },
      {
        heading: "Krav",
        bullets: [
          "Kunden måste ha en giltig e-postadress registrerad",
        ],
      },
      {
        heading: "Så här gör du",
        steps: [
          "Gå till Kunder i leverantörsmenyn",
          "Klicka på den manuellt tillagda kunden",
          "Klicka Skicka inbjudan",
          "Kunden får ett e-postmeddelande med en aktiveringslänk",
          "Kunden klickar på länken och sätter ett lösenord",
          "Kontot aktiveras -- kunden kan nu logga in och boka själv",
        ],
      },
      {
        heading: "Bra att veta",
        bullets: [
          "Inbjudningslänken är giltig i 48 timmar",
          "Om kunden inte aktiverar i tid kan du skicka en ny inbjudan",
          "Kundens bokningshistorik och hästkopplingar bevaras vid aktiveringen",
        ],
        tip: "Den här funktionen kan vara inaktiverad och kanske inte är tillgänglig i alla konton.",
      },
    ],
  },
  {
    slug: "sla-ihop-konton",
    title: "Slå ihop konton",
    role: "provider",
    section: "Kunder",
    keywords: [
      "slå ihop",
      "merge",
      "sammanslagning",
      "dubbla konton",
      "manuell kund",
      "befintligt konto",
    ],
    summary:
      "Hur du slår ihop en manuellt tillagd kund med ett befintligt riktigt konto.",
    content: [
      {
        paragraphs: [
          "Om en manuellt tillagd kund redan har skapat ett eget konto i Equinet (med en annan e-postadress eller separat registrering), kan du slå ihop de två kontona.",
        ],
      },
      {
        heading: "Så här gör du",
        steps: [
          "Gå till Kunder i leverantörsmenyn",
          "Klicka på den manuellt tillagda kunden",
          "Klicka Slå ihop med befintligt konto",
          "Sök efter det riktiga kontot (via namn eller e-post)",
          "Bekräfta sammanslagningen",
        ],
      },
      {
        heading: "Vad händer vid sammanslagning",
        bullets: [
          "Alla bokningar överförs till det riktiga kontot",
          "Hästkopplingar bevaras",
          "Anteckningar och historik slås ihop",
          "Det manuella kontot tas bort",
          "Sammanslagningen är atomär -- allt eller inget sker",
        ],
      },
      {
        paragraphs: [
          "Sammanslagningen kan inte ångras. Kontrollera att du valt rätt konto innan du bekräftar.",
        ],
      },
    ],
  },
  {
    slug: "kundanteckningar",
    title: "Kundanteckningar",
    role: "provider",
    section: "Kunder",
    keywords: [
      "anteckningar",
      "kundanteckningar",
      "journal",
      "privat",
      "redigera",
      "ta bort",
    ],
    summary:
      "Hur du skriver, redigerar och tar bort privata anteckningar om dina kunder.",
    content: [
      {
        paragraphs: [
          "Under varje kund i kundregistret kan du skriva privata anteckningar -- en slags journal.",
        ],
      },
      {
        heading: "Skapa anteckning",
        steps: [
          "Klicka på en kund i kundregistret",
          "Skriv din anteckning i textfältet",
          "Klicka Spara",
        ],
      },
      {
        heading: "Redigera anteckning",
        bullets: [
          "Klicka pennikonen bredvid anteckningen",
          "Uppdatera texten",
          "Klicka Spara",
          'Redigerade anteckningar markeras med "(redigerad)"',
        ],
      },
      {
        heading: "Ta bort anteckning",
        bullets: [
          "Klicka papperskorgen bredvid anteckningen",
        ],
      },
      {
        paragraphs: [
          "Dina anteckningar är bara synliga för dig. Kunden ser dem inte, och de visas inte i hästprofilen eller andra publika vyer.",
        ],
      },
    ],
  },
  {
    slug: "kundinsikter",
    title: "Kundinsikter",
    role: "provider",
    section: "Kunder",
    keywords: [
      "kundinsikter",
      "AI",
      "VIP-score",
      "besöksfrekvens",
      "riskflaggor",
      "mönster",
      "insikter",
    ],
    summary:
      "Hur du använder AI-drivna insikter för att förstå dina kunders beteende och värde.",
    content: [
      {
        paragraphs: [
          "Under varje kund i kundregistret kan du generera AI-drivna insikter som hjälper dig förstå kunden bättre.",
        ],
      },
      {
        heading: 'Klicka "Generera insikter" för att se',
        bullets: [
          "VIP-score -- hur värdefull kunden är (baserat på frekvens, intäkt, lojalitet)",
          "Besöksfrekvens -- genomsnittligt intervall mellan bokningar",
          "Riskflaggor -- varning om kunden visar tecken på att sluta boka (t.ex. ökande intervall, avbokningar)",
          "Mönster -- insikter om kundens beteende (föredragen dag, tjänst, etc.)",
        ],
      },
      {
        heading: "Viktigt att veta",
        bullets: [
          "Insikterna baseras på bokningshistorik, inte personlig data",
          "En confidence-indikator visar hur säkra insikterna är (fler bokningar = mer tillförlitligt)",
          "Insikterna genereras on-demand och cachas inte",
        ],
        tip: "Den här funktionen kan vara inaktiverad och kanske inte är tillgänglig i alla konton.",
      },
    ],
  },
  {
    slug: "besoksplanering",
    title: "Besöksplanering",
    role: "provider",
    section: "Planering",
    keywords: [
      "besöksplanering",
      "försenad",
      "återbesök",
      "intervall",
      "due-for-service",
      "hästar",
      "planering",
    ],
    summary:
      "Hur du ser vilka hästar som snart behöver besök och planerar ditt schema utifrån angelägenhet.",
    content: [
      {
        paragraphs: [
          "Under Besöksplanering ser du vilka hästar som snart behöver besök, sorterade efter angelägenhet. Det hjälper dig att planera ditt schema och aldrig missa en kund.",
        ],
      },
      {
        heading: "Varje häst visas med",
        bullets: [
          "Hästnamn och ägare",
          "Vilken tjänst som utfördes",
          "Antal dagar sedan senaste besök",
          "Återbesöksintervall (i veckor)",
          "Beräknat nästa besöksdatum",
          "Statusbadge",
        ],
      },
      {
        heading: "Statusbadges",
        bullets: [
          "Röd (Försenad) -- Besöket borde redan ha skett",
          "Gul (Inom 2 veckor) -- Dags att planera in besöket",
          "Grön (Ej aktuell) -- Inget besök behövs ännu",
        ],
      },
      {
        heading: "Filtrering",
        bullets: [
          "Alla -- visa samtliga hästar med återbesöksintervall",
          "Försenade -- enbart hästar som passerat sitt datum",
          "Inom 2 veckor -- hästar som snart behöver besök",
        ],
      },
      {
        heading: "Individuella intervall per häst och tjänst",
        paragraphs: [
          "Standardintervallet sätts på tjänstenivå (t.ex. 8 veckor för hovbeläggning). Men ibland behöver en specifik häst tätare -- eller glesare -- besök. Du kan sätta individuella intervall per häst och per tjänst.",
          "Gå till Hästens hälsohistorik (klicka på en häst) och tryck Lägg till under Återbesöksintervall. Välj tjänst, välj intervall och spara. Du kan ha olika intervall för olika tjänster på samma häst -- t.ex. 6 veckor för hovslagning och 8 veckor för massage.",
          "Det individuella intervallet gäller bara för dig som leverantör. Kunden kan också ha satt ett eget intervall som har högre prioritet (prioritetsordning: Kundens intervall > Leverantörens intervall > Tjänstens standard).",
        ],
      },
    ],
  },
  {
    slug: "kompetenser-och-verifiering",
    title: "Kompetenser och verifiering",
    role: "provider",
    section: "Profil",
    keywords: [
      "kompetenser",
      "verifiering",
      "utbildning",
      "certifikat",
      "licens",
      "organisation",
      "badge",
      "bilder",
    ],
    summary:
      "Hur du lägger till utbildningar, certifikat och andra meriter som visas på din profil.",
    content: [
      {
        paragraphs: [
          "Under Kompetenser & Verifiering lägger du till dina utbildningar, certifikat och meriter. Godkända kompetenser visas på din profil och stärker förtroendet hos potentiella kunder.",
        ],
      },
      {
        heading: "Kompetenstyper",
        bullets: [
          'Utbildning -- formell utbildning (t.ex. "Wångens gesällprov")',
          "Organisation -- medlemskap i branschorganisation",
          'Certifikat -- godkänt certifieringsprov (t.ex. "EHB-certifikat")',
          "Erfarenhet -- arbetserfarenhet och referenser",
          "Licens -- yrkeslicens (t.ex. veterinärlicens)",
        ],
      },
      {
        heading: "Lägg till en kompetens",
        steps: [
          "Gå till Kompetenser & Verifiering i leverantörsmenyn",
          "Klicka Ny kompetens",
          "Välj typ och fyll i titel (obligatoriskt)",
          'Ange utfärdare (t.ex. "Wången", "SHF") och år -- valfritt men rekommenderas',
          "Lägg till en beskrivning om du vill",
          "Skicka in",
        ],
      },
      {
        heading: "Ladda upp bilder",
        paragraphs: [
          "Efter att du skapat en kompetenspost kan du ladda upp bilder som styrker din merit -- till exempel diplom, certifikat eller intyg.",
        ],
        bullets: [
          "Dra och släpp eller klicka för att ladda upp",
          "Max 5 bilder per kompetenspost",
          "Bilder komprimeras automatiskt (max 1 MB)",
          "Du kan ta bort bilder genom att hovra och klicka krysset",
        ],
      },
      {
        paragraphs: [
          "Bilder kan bara laddas upp och tas bort på poster som inte är godkända.",
        ],
      },
      {
        heading: "Redigera och ta bort",
        paragraphs: [
          'Du kan redigera och ta bort kompetenser som har status "Under granskning" eller "Avvisad".',
        ],
        bullets: [
          "Klicka Redigera för att uppdatera titel, typ, utfärdare, år eller beskrivning",
          "Om en avvisad kompetens redigeras återgår den automatiskt till granskning",
          "Klicka Ta bort för att radera en kompetens och alla tillhörande bilder (kräver bekräftelse)",
          "Godkända kompetenser kan inte redigeras eller tas bort",
        ],
      },
      {
        heading: "Statusar",
        bullets: [
          "Under granskning -- En administratör har inte granskat ännu",
          "Godkänd -- Kompetensen är verifierad och visas med grön badge på din profil",
          "Avvisad -- Administratören behöver mer information (se granskningskommentaren)",
        ],
      },
      {
        paragraphs: [
          "Du kan ha max 5 kompetenser under granskning samtidigt. Vänta tills befintliga har granskats innan du skickar fler.",
        ],
      },
      {
        heading: "Vad ser kunder?",
        paragraphs: [
          'På din profil ser kunder en sektion "Kompetenser & Utbildningar" med:',
        ],
        bullets: [
          "Titel, typ, utfärdare och år",
          'Grön badge "Verifierad" för godkända kompetenser',
          'Grå badge "Ej granskad" för poster under granskning',
          "Klickbara bilder (öppnas i förstoring)",
          "Avvisade kompetenser visas inte för kunder",
        ],
      },
    ],
  },
  {
    slug: "gruppbokning",
    title: "Gruppbokning",
    role: "provider",
    section: "Bokningar",
    keywords: [
      "gruppbokning",
      "grupprequest",
      "stall",
      "stallgemenskap",
      "matcha",
      "deltagare",
    ],
    summary:
      "Hur du ser och matchar grupprequests från stallgemenskaper i ditt serviceområde.",
    content: [
      {
        paragraphs: [
          "Under Grupprequests ser du öppna grupprequests från stallgemenskaper i ditt serviceområde.",
        ],
      },
      {
        heading: "För varje request ser du",
        bullets: [
          "Tjänstetyp, plats och önskat datumintervall",
          "Antal deltagare och deras hästar",
          "Kontaktperson",
        ],
      },
      {
        heading: "Matcha en grupprequest",
        steps: [
          "Välj en öppen grupprequest",
          "Systemet skapar automatiskt individuella bokningar för alla deltagare i sekvens (t.ex. 09:00, 09:45, 10:30)",
          "Alla deltagare notifieras med sin individuella tid",
        ],
      },
      {
        paragraphs: [
          "Det här är ett effektivt sätt att fylla en halv- eller heldag med bokningar på samma plats.",
        ],
      },
    ],
  },
  {
    slug: "bokforing-fortnox",
    title: "Bokföring (Fortnox)",
    role: "provider",
    section: "Integrationer",
    keywords: [
      "bokföring",
      "Fortnox",
      "faktura",
      "integration",
      "OAuth",
      "synkning",
    ],
    summary:
      "Hur du kopplar ditt Fortnox-konto för automatisk fakturering av genomförda bokningar.",
    content: [
      {
        paragraphs: [
          "Du kan koppla ditt Fortnox-konto för automatisk fakturering.",
        ],
        steps: [
          "Gå till Inställningar i leverantörsmenyn",
          "Klicka Koppla Fortnox",
          "Logga in med ditt Fortnox-konto (OAuth)",
          "Equinet kan nu skapa fakturor i Fortnox",
        ],
      },
      {
        heading: "Funktioner",
        bullets: [
          "Manuell synkning av osynkade bokningar till Fortnox-fakturor",
          "Automatisk token-förnyelse (du behöver inte logga in igen)",
          "Du kan koppla bort Fortnox när som helst",
        ],
      },
      {
        paragraphs: [
          "Tokens lagras krypterat. Under utveckling/demo används en mock-implementation.",
        ],
      },
    ],
  },
  {
    slug: "hastens-halsotidslinje",
    title: "Hästens hälsotidslinje",
    role: "provider",
    section: "Hästar",
    keywords: [
      "hälsotidslinje",
      "häst",
      "veterinär",
      "hovvård",
      "skador",
      "medicinering",
      "historik",
    ],
    summary:
      "Hur du ser hälsotidslinjen för hästar kopplade till dina bokningar med veterinär- och hovvårdshistorik.",
    content: [
      {
        paragraphs: [
          "Som leverantör kan du se en begränsad hälsotidslinje för hästar som är kopplade till dina bokningar. Det ger dig viktig kontext inför ett besök.",
        ],
      },
      {
        heading: "Du ser",
        bullets: [
          "Veterinärhistorik",
          "Hovvårdshistorik",
          "Skadehistorik",
          "Medicineringshistorik",
          "Dina egna leverantörsanteckningar (kopplade till respektive bokning)",
        ],
      },
      {
        paragraphs: [
          'Du ser inte ägarens privata anteckningar (kategorin "Övrigt").',
          "Informationen är skrivskyddad -- du kan inte redigera kundens anteckningar.",
        ],
      },
    ],
  },
  {
    slug: "notifikationer",
    title: "Notifikationer",
    role: "provider",
    section: "Konto",
    keywords: [
      "notifikationer",
      "aviseringar",
      "klocka",
      "e-post",
      "bokning",
      "omdöme",
      "grupprequest",
    ],
    summary:
      "Vilka notifikationer du får som leverantör och var de visas.",
    content: [
      {
        paragraphs: [
          "Du får notifikationer vid viktiga händelser.",
        ],
      },
      {
        heading: "Du notifieras när",
        bullets: [
          "En kund bokar en tjänst hos dig",
          "En kund avbokar",
          "En kund betalar",
          "En kund lämnar ett omdöme",
          "En verifieringsansökan godkänns eller avvisas",
          "En ny grupprequest skapas i ditt område",
        ],
      },
      {
        paragraphs: [
          "Notifikationer visas i klockan i menyraden och skickas även via e-post.",
        ],
      },
    ],
  },
  {
    slug: "installera-equinet",
    title: "Installera Equinet som app",
    role: "provider",
    section: "Konto",
    keywords: [
      "installera",
      "app",
      "PWA",
      "hemskärm",
      "Android",
      "iPhone",
      "iPad",
      "Safari",
      "Chrome",
    ],
    summary:
      "Hur du installerar Equinet som app på din hemskärm för snabbare åtkomst och offline-stöd.",
    content: [
      {
        paragraphs: [
          "Du kan installera Equinet på din hemskärm för snabbare åtkomst och offline-stöd. En installerad app öppnas i helskärm utan webbläsarens adressfält.",
        ],
      },
      {
        heading: "Android (Chrome)",
        steps: [
          "Besök Equinet i Chrome",
          "En blå banner visas med knappen Installera -- klicka på den",
          "Bekräfta installationen",
          "Equinet-ikonen visas på din hemskärm",
        ],
      },
      {
        heading: "iPhone/iPad (Safari)",
        steps: [
          "Besök Equinet i Safari",
          "En blå banner visas med instruktioner",
          "Tryck på Dela-ikonen (rutan med uppåtpilen)",
          "Välj Lägg till på hemskärmen",
          "Klicka Lägg till",
        ],
      },
      {
        paragraphs: [
          "Du kan stänga installationsbannern om du inte vill installera. Den visas inte igen efter att du stängt den.",
        ],
      },
    ],
  },
  {
    slug: "offline-lage",
    title: "Offline-läge",
    role: "provider",
    section: "Konto",
    keywords: [
      "offline",
      "utan nät",
      "synka",
      "sparad lokalt",
      "mobilnät",
      "återansluten",
      "banner",
    ],
    summary:
      "Hur offline-läget fungerar så att du kan använda Equinet utan internetanslutning.",
    content: [
      {
        paragraphs: [
          "Om du kör i ett område utan mobilnät kan du fortfarande använda Equinet tack vare offline-stöd. Du kan både se och göra ändringar -- ändringarna sparas lokalt och synkas automatiskt när du får nät igen.",
        ],
      },
      {
        heading: "Så fungerar det",
        bullets: [
          "När du har internetåtkomst sparas dina bokningar, rutter och profildata automatiskt lokalt på enheten",
          "Om du tappar nätverket visar Equinet den senast sparade datan",
          'En gul banner visas längst upp på sidan med texten "Du är offline"',
          'När nätverket kommer tillbaka visas en grön banner med "Återansluten" och antal synkade ändringar',
        ],
      },
      {
        heading: "Ändringar offline",
        bullets: [
          "Du kan markera bokningar som klara -- bokningen uppdateras direkt i appen",
          "Du kan uppdatera anteckningar på bokningar",
          "Du kan ändra status på ruttstopp (markera som besökt)",
          'Ändringar som väntar på synk visas med en gul badge ("Väntar på synk")',
          "Vid återanslutning synkas alla ändringar automatiskt i bakgrunden",
        ],
      },
      {
        heading: "Begränsningar i offline-läge",
        bullets: [
          "Data som är äldre än 4 timmar visas inte (du uppmanas att ansluta igen)",
          "Funktioner som kräver nätverksåtkomst (betala, boka nya tider, skicka meddelanden) fungerar inte offline",
          "Om en annan person ändrar samma bokning medan du är offline gäller den senaste ändringen",
        ],
        tip: "Den här funktionen kan vara inaktiverad och kanske inte är tillgänglig i alla konton.",
      },
    ],
  },
]
