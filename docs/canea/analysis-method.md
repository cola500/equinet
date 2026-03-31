# Genomlysning av komplext enterprise-system — Analysmetod

> Metod för att identifiera förbättringsområden i ett Canea One-liknande system.
> Fokus: öka förändringstakt, minska komplexitet, inkrementellt.

## Förutsättningar

- Tillgång till git-historik (minst 6 månader)
- Tillgång till CI/CD-pipeline och dess metriker
- Mandat att boka 30 min med 8–10 utvecklare
- 2–3 utvecklare avsatta för analysfasen (3 veckor)

---

## 1. Metod: Tre spår, parallellt, 2–3 veckor

### Spår A: Hotspot-analys (data-driven)

Använd **git-historik** som primär datakälla — inte arkitekturdokument. Dokumentation ljuger. Git-loggen ljuger inte.

```bash
# Mest ändrade filer senaste 6 mån (change frequency)
git log --since="6 months ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head 30

# Filer som ändras tillsammans (temporal coupling)
# Verktyg: code-maat, git-of-theseus, eller manuell analys

# Filer med flest författare (koordineringskostnad)
git log --since="6 months ago" --pretty=format:%an --name-only -- <hot-file> | sort -u
```

**Hotspot = hög ändringsfrekvens + hög komplexitet.** Korsreferera med cyklomatisk komplexitet (SonarQube, CodeClimate, eller `radon` för Python, `plato` för JS).

De 5–10 filerna som hamnar högt på *båda* axlarna är där friktionen finns.

> Referens: Adam Tornhill, *Your Code as a Crime Scene* — hela metoden bygger på detta tänk.

### Spår B: Utvecklarintervjuer (kvalitativt)

**8–10 intervjuer, 30 min var.** Blanda seniora och juniora, blanda team. Ställ dessa frågor:

| Kategori | Fråga | Vad vi lyssnar efter |
|----------|-------|----------------------|
| Vardagsfriktion | "Beskriv senaste gången du blev blockerad mer än en timme. Vad hände?" | Återkommande blockerare |
| Förtroende | "Hur säker känner du dig att din ändring inte bryter något?" | Brist på testtäckning eller för långa feedback-loopar |
| Feedback-loop | "Hur lång tid tar det från commit till att du vet att allt fungerar?" | CI-tid, manuella steg |
| Rädsla | "Vilken del av systemet skulle du aldrig vilja röra? Varför?" | Kandidater för strangler fig |
| Beroenden | "Vilka team/moduler måste du koordinera med oftast?" | Tight coupling mellan team |
| Testning | "Hur testar du en typisk ändring? Vad testar du *inte*?" | Blinda fläckar i teststrategin |
| Deploy | "Vad är din känsla dagarna efter en deploy?" | Förtroende för release-processen |

**Nyckeln:** Lyssna efter *mönster*. Om 4 av 8 nämner samma modul eller process — det är signalen. Enstaka klagomål kan vara personliga preferenser. Återkommande teman är systemiska problem.

### Spår C: Teststrategi & feedback-loop-kartläggning

Mät konkret:

| Mätpunkt | Hur | Varför det spelar roll |
|----------|-----|------------------------|
| **Commit → grön CI** | Mediantid i CI-systemet | >15 min = utvecklare kontextväxlar |
| **Commit → produktion** | Lead time (DORA-metrik) | Visar faktisk leveransförmåga |
| **Testsvitens körtid** | Total + uppdelad per typ (unit/integration/E2E) | Identifierar flaskhalsar |
| **Flaky test-frekvens** | Antal reruns senaste månaden | Flaky tests urholkar förtroende |
| **Test-coverage per hotspot** | Coverage-rapport filtrerad på de 10 hetaste filerna | Hög traffic + låg coverage = risk |
| **Manuellt testberoende** | Vilka flöden *kräver* manuell QA? | Varje manuellt steg är en flaskhals |

---

## 2. Hitta rätt första "slice"

### Urvalskriterier

Välj den modul/domän som har:

1. **Hög ändringsfrekvens** — data visar det
2. **Utvecklare klagar på den** — intervjuer bekräftar det
3. **Begränsad blast radius** — inte kärnan i allt
4. **Synligt affärsvärde** — stakeholders bryr sig om denna del

Alla fyra behöver inte vara uppfyllda. Men de två första är obligatoriska — vi fixar inte saker som varken ändras ofta eller upplevs som problematiska.

### Konkret process

```
Hotspot-topp-10  ∩  Intervju-smärtpunkter  ∩  Avgränsbar modul
         ↓
    Det är din slice.
```

**Exempel:** Om git-historiken visar att `OrderProcessing/`-mappen ändras 3x oftare än genomsnittet, och utvecklare säger "jag är alltid rädd att ändra orderflödet" — börja där.

**Anti-exempel:** Om en modul är komplex men knappt rörs — lämna den ifred. Hotspot-analys handlar om *förändringskostnad*, inte om estetik.

---

## 3. Fem konkreta första förbättringar

### 1. Strangler fig runt den hetaste hotspoten

Extrahera ett tydligt interface runt den mest ändringstunga modulen. Ändra inte insidan — bara ytan. Detta ger:
- Möjlighet att testa modulen isolerat
- Frihet att refaktorera insidan utan att röra konsumenterna
- **Effort:** 1–2 veckor. **Effekt:** Alla framtida ändringar i modulen blir säkrare.

### 2. Karakteriseringstester på de 5 mest ändrade filerna

Skriv tester som fångar *nuvarande beteende* (inte önskat). Använd approval testing / snapshot testing. Syftet är inte coverage — det är ett **förtroendenät** för refaktorering.
- **Effort:** 3–5 dagar. **Effekt:** Utvecklare vågar ändra.

### 3. Halvera CI-tiden

Identifiera den långsammaste delen av CI-pipelinen. Typiska quick wins:
- Parallelisera testsviter
- Cacha beroenden (Docker layers, npm/Maven cache)
- Kör bara påverkade tester vid PR (test impact analysis)
- **Effort:** 2–3 dagar. **Effekt:** Snabbare feedback = fler deploys = mindre risk per deploy.

### 4. Inför "15-minuters-regeln" för lokala byggen

Om en utvecklare inte kan köra en meningsfull delcheck på <15 minuter lokalt, fixa det. Ge varje team:
- Ett snabbkommando som kör enbart berörda tester
- En lokal smoke-check som tar <2 min
- **Effort:** 1–2 dagar. **Effekt:** Kortare inner loop = fler iterationer per dag.

### 5. Synliggör DORA-metriker på en dashboard

Mät fyra saker, visa dem öppet:
- **Deploy frequency** — hur ofta vi levererar
- **Lead time** — commit till produktion
- **Change failure rate** — andel deploys som orsakar incident
- **MTTR** — tid att återställa efter incident

Ingen target. Bara synlighet. Team som ser sina siffror börjar förbättra dem.
- **Effort:** 2–3 dagar med befintliga CI/CD-data. **Effekt:** Gemensam bild av var vi är.

---

## 4. Tidsplan och roller

```
Vecka 1:     Git-analys + intervjuer (parallellt)
Vecka 2:     Syntes → välj slice → starta förbättring 1+2+4
Vecka 3:     CI-optimering + dashboard
Löpande:     Mät, justera, välj nästa slice
```

| Roll | Ansvar |
|------|--------|
| **Tech lead** | Äger analysen, gör hotspot-analysen, sammanställer resultat |
| **1–2 utvecklare** | Genomför intervjuer, implementerar förbättringar |
| **Engineering manager** | Förankrar med ledningen, säkerställer att tiden är avsatt |

---

## 5. Framgångskriterier

Hur vi vet att detta fungerade — efter 3 veckor:

- [ ] Vi kan peka ut de 5 mest problematiska filerna/modulerna, med data som stödjer det
- [ ] Minst en hotspot har ett interface som möjliggör isolerad testning
- [ ] CI-tiden har minskat mätbart (mål: 30%+)
- [ ] Utvecklare har ett lokalt snabbkommando som ger feedback på <2 min
- [ ] DORA-metriker är synliga för teamet

---

## 6. Vanliga fallgropar

| Fallgrop | Motgift |
|----------|---------|
| "Vi borde skriva om hela modulen" | Nej. Strangler fig. Interface först, insida sedan. |
| "Vi måste ha 80% coverage" | Nej. Karakteriseringstester på hotspots. Resten kan vänta. |
| "Låt oss analysera hela systemet först" | Nej. Välj en slice. Lär oss. Iterera. |
| "Vi har ingen tid för detta" | Friktionen kostar redan tid — varje dag. Frågan är om vi vill göra den synlig. |
| "Vi vet redan var problemen är" | Kanske. Men vet alla samma sak? Data tar bort gissningar och interna konflikter. |

---

**Princip:** Mät före du ändrar. Ändra en sak i taget. Välj det som ger mest förtroende — inte mest coverage.
