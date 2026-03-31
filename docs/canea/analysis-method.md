# Genomlysning av komplext enterprise-system

> Metod for att identifiera forbattringsomraden i ett Canea One-liknande system.
> Fokus: oka forandringstakt, minska komplexitet, inkrementellt.

## 1. Metod: Tre spar, parallellt, 2-3 veckor

### Spar A: Hotspot-analys (data-driven)

Anvand **git-historik** som primar datakalla -- inte arkitekturdokument.

```bash
# Mest andrade filer senaste 6 man (change frequency)
git log --since="6 months ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head 30

# Filer som andras tillsammans (coupling)
# Verktyg: code-maat, git-of-theseus, eller manuell analys

# Filer med flest forfattare (koordineringskostnad)
git log --since="6 months ago" --pretty=format:%an --name-only -- <hot-file> | sort -u
```

**Hotspot = hog andringsfrekvens + hog komplexitet.** Korsreferera med cyklomatisk komplexitet (SonarQube, CodeClimate, eller `radon` for Python, `plato` for JS).

De 5-10 filerna som hamnar hogt pa *bada* axlarna ar dar friktionen finns.

### Spar B: Utvecklarintervjuer (kvalitativt)

**8-10 intervjuer, 30 min var.** Blanda seniora och juniora. Stall dessa fragor:

| Kategori | Fraga |
|----------|-------|
| Vardagsfrikt | "Beskriv senaste gangen du blev blockerad mer an en timme. Vad hande?" |
| Fortroende | "Hur saker kanner du dig att din andring inte bryter nagot?" |
| Feedback-loop | "Hur lang tid tar det fran commit till att du vet att allt fungerar?" |
| Onboarding | "Vilken del av systemet skulle du aldrig vilja rora? Varfor?" |
| Beroenden | "Vilka team/moduler maste du koordinera med oftast?" |
| Testning | "Hur testar du en typisk andring? Vad testar du inte?" |
| Deploy | "Vad ar din kansla dagarna efter en deploy?" |

**Nyckeln:** Lyssna efter *monster*. Om 4 av 8 namner samma modul/process -- det ar signalen.

### Spar C: Teststrategi & feedback-loop-kartlaggning

Mat konkret:

| Matpunkt | Hur |
|----------|-----|
| **Commit -> gron CI** | Mat mediantid i CI-systemet |
| **Commit -> produktion** | Lead time (DORA-metrik) |
| **Testsvitens kortid** | Total + uppdelad per typ (unit/integration/E2E) |
| **Flaky test-frekvens** | Antal reruns senaste manaden |
| **Test-coverage per hotspot** | Coverage-rapport filtrerad pa de 10 hetaste filerna |
| **Manuellt testberoende** | Vilka floden *kraver* manuell QA? |

---

## 2. Hitta ratt forsta "slice"

### Urvalskriterier

Valj den modul/doman som har:

1. **Hog andringsfrekvens** (data visar det)
2. **Utvecklare klagar pa den** (intervjuer bekraftar det)
3. **Begransad blast radius** (inte karnan i allt)
4. **Synligt affarsvarde** (stakeholders bryr sig)

### Konkret process

```
Hotspot-topp-10  ∩  Intervju-smartpunkter  ∩  Avgransbar modul
         ↓
    Det ar din slice.
```

**Exempel:** Om git-historiken visar att `OrderProcessing/`-mappen andras 3x oftare an genomsnittet, och utvecklare sager "jag ar alltid radd att andra orderflodet" -- borja dar.

---

## 3. Fem konkreta forsta forbattringar

### 1. Strangler fig runt den hetaste hotspoten

Extrahera ett tydligt interface runt den mest andringsunga modulen. Andra inte insidan -- bara ytan. Detta ger:
- Mojlighet att testa modulen isolerat
- Frihet att refaktorera insidan utan att rora konsumenterna
- **Effort:** 1-2 veckor. **Effekt:** Alla framtida andringar i modulen blir sakrare.

### 2. Karakteriseringstester pa de 5 mest andrade filerna

Skriv tester som fangar *nuvarande beteende* (inte onskat). Anvand approval testing / snapshot testing. Syftet ar inte coverage -- det ar **fortroendenat** for refaktorering.
- **Effort:** 3-5 dagar. **Effekt:** Utvecklare vagar andra.

### 3. Halvera CI-tiden

Identifiera den langsammaste delen av CI-pipelinen. Typiska quick wins:
- Parallelisera testsviter
- Cacha beroenden (Docker layers, npm/Maven cache)
- Kor bara paverkade tester vid PR (test impact analysis)
- **Effort:** 2-3 dagar. **Effekt:** Snabbare feedback = fler deploys = mindre risk per deploy.

### 4. Infor "15-minuters-regeln" for lokala byggen

Om en utvecklare inte kan kora en meningsfull delcheck pa <15 minuter lokalt, fixa det. Ge varje team:
- Ett snabbkommando som kor enbart berorda tester
- En lokal smoke-check som tar <2 min
- **Effort:** 1-2 dagar. **Effekt:** Kortare inner loop = fler iterationer per dag.

### 5. Synliggor DORA-metriker pa en dashboard

Mat fyra saker, visa dem oppet:
- **Deploy frequency** -- hur ofta vi levererar
- **Lead time** -- commit till produktion
- **Change failure rate** -- andel deploys som orsakar incident
- **MTTR** -- tid att aterstalla efter incident

Ingen target. Bara synlighet. Team som ser sina siffror borjar forbattra dem.
- **Effort:** 2-3 dagar med befintliga CI/CD-data. **Effekt:** Gemensam bild av var vi ar.

---

## Sammanfattning: Tidsplan

```
Vecka 1:     Git-analys + intervjuer (parallellt)
Vecka 2:     Syntes -> valj slice -> starta forbattring 1+2+4
Vecka 3:     CI-optimering + dashboard
Lopande:     Mat, justera, valj nasta slice
```

**Princip:** Mat fore du andrar. Andra en sak i taget. Valj det som ger mest fortroende -- inte mest coverage.
