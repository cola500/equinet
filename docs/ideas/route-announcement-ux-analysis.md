# Rutt-annonsering: UX-genomlysning + omvärldsanalys

> Genomförd 2026-02-19. Underlag för framtida förbättringar.

## Equinets unika position

Ingen konkurrent i hästbranschen kombinerar proaktiv ruttannonsering + direkt bokning. Inget digitalt verktyg i Sverige låter hovslagare proaktivt annonsera "jag åker till X område datum Y-Z". Facebook-grupper och SMS-listor är dagens lösning. Det är ett **blue ocean**-scenario.

| Feature | Equinet | Tended (UK) | MarketBox | TrimCheck | Food truck-appar |
|---------|---------|-------------|-----------|-----------|-----------------|
| Proaktiv ruttannonsering | Ja | Nej | Nej | Delvis | Ja |
| Hästspecifik | Ja | Ja | Nej | Nej | Nej |
| "Due for service"-data | Ja | Nej | Nej | Nej | N/A |
| Bokning direkt från annons | Ja | Ja | Ja | Ja | Delvis |
| Svensk marknad | Ja | Nej | Nej | Nej | Nej |

---

## UX-styrkor att bevara

- Annonskort med bra informationshierarki (leverantör, tjänst, datum, chips)
- Auto-sök vid kommunval (inget extra klick)
- Empty state med fallback "Sök bland alla leverantörer istället"
- MunicipalitySelect med tangentbordsnavigation

---

## Identifierade UX-problem

### Kritiska
1. **Kundsidor saknar CustomerLayout** -- BottomTabBar försvinner, kunden "lämnar" appen
2. **Bokning via annons syns som vanlig bokning** -- ingen "Via rutt"-indikation
3. **Kalender visar alla dagar** -- kund kan boka utanför perioden leverantören är i området

### Höga
4. **Horse-selector saknas** -- fritext istället för registrerade hästar
5. **"Planerade rutter"** -- leverantörsorienterat namn, kunder förstår inte
6. **ServiceType-filter saknas i UI** -- state finns men ingen input
7. **Ingen bekräftelsedialog** vid avbokning av enskild bokning
8. **Pris saknas** på tjänste-chips

### Tillgänglighet
9. MunicipalitySelect saknar `role="combobox"` och `aria-expanded`
10. Filter-badges "x"-knapp saknar `aria-label`

---

## Omvärldsanalys -- Närmaste analogier

### TrimCheck (mobila barberare)
- Barberaren grupperar områden per dag, systemet visar kunder bokningsfönster baserat på effektivaste rutten
- **Inspiration:** Låt hovslagaren definiera "Måndag=Kungsbacka, Tisdag=Mölndal"

### Truckily (food trucks)
- Push-notis till fans vid ny tillgänglighet i område
- **Inspiration:** "Anna har annonserat tider i Kungsbacka 15-20 mars"

### MarketBox (fältservice SaaS)
- Travel Zones med unik tillgänglighet per zon, smart matchning
- **Inspiration:** Systemet visar BARA leverantörer som kan nå kundens adress

### Tended (hästtjänster, UK)
- Jämför leverantörer: plats, pris, betyg, tillgänglighet
- **Inspiration:** Jämförelsesvy vid multipla annonser i samma kommun

### Rover (husdjurstjänster)
- Karta + lista split-vy, "följ"-mekanik, grön bock för uppdaterad tillgänglighet
- **Inspiration:** Split-vy med pins och preview-kort

### StreetFoodFinder (food trucks)
- Spara favoriter, notis vid närhet
- **Inspiration:** "Följ leverantör" + "Bevaka område" som två separata opt-ins

### Vev (veterinärer)
- Automatisk ruttplanering, serviceområde-definition, avståndsprissättning
- **Inspiration:** Kund anger adress -> ser direkt om leverantören täcker området

---

## Top 10 framtida feature-idéer

### 1. "Följ leverantör" + push-notis
Kund följer sin hovslagare. När hen annonserar ny rutt i kundens område -> automatisk push. SMS som fallback (98% öppningsfrekvens).

### 2. "Due for service" + annons = hyper-relevant notis
"Blansen behövde skos för 2 veckor sedan. Anna har lediga tider i Kungsbacka nästa vecka." Kombinerar två datapunkter som ingen annan plattform har.

### 3. Karta + lista split-vy
Airbnb/Zillow-mönstret: karta med pins + lista med preview-kort. Klick på lista -> karta zoomar. Mobilt: lista som standard, karta som toggle.

### 4. "X tider kvar"-brist-indikator
"Torsdag: 2 av 5 tider kvar" på annonskort. Standard i hotell/flyg, underanvänt i fältservice. Urgency driver konvertering.

### 5. Område-per-dag (TrimCheck-modell)
Hovslagaren definierar Mån=Kungsbacka, Tis=Mölndal, Ons=Borås. Systemet visar kunder rätt tider per dag automatiskt.

### 6. MarketBox Travel Zones
Leverantör skapar zoner med unik tillgänglighet per zon. Kund anger adress -> ser bara relevanta leverantörer.

### 7. Leverantörsjämförelse
Vid multipla annonser i samma kommun -> sida-vid-sida jämförelse (pris, betyg, datum, tider).

### 8. "Bevaka kommun"-notis
Opt-in: "Meddela mig när någon erbjuder hovslagning i Kungsbacka". Push till alla bevakare vid ny annons.

### 9. Automatisk "fyll luckor"
När leverantören har 3 bokningar med luckor -> föreslå "fyll lucka 13:00-14:00 med ny bokning i närområdet".

### 10. Delbar annonslänk
"Kopiera länk"-knapp på leverantörens annonsdetalj -> SMS/WhatsApp till befintliga kunder. URL finns redan (`/announcements/[id]`).

---

## Konverteringskedja

```
Leverantör annonserar rutt
  -> Kund får notis (push/SMS)
    -> Preview-kort (namn, betyg, pris, datum, "3 tider kvar")
      -> Detaljvy (profil, recensioner, karta)
        -> Bokning (få klick, tydlig CTA)
          -> Bekräftelse (SMS + email)
```

**Drivare:** Timing, social proof (betyg), brist ("3 tider kvar"), bekvämlighet (få klick), tillit (profil + certifieringar).

---

## Marketplace loop

1. **Börja smalt:** En kommun, en tjänstetyp (hovslagare). Skapa täthet.
2. **Supply först:** Rekrytera hovslagare som redan åker runt. Deras annonser är "content" som drar kunder.
3. **Mät:** search-to-booking rate, svarstid, annonser per sökning.
4. **Concierge-fas:** Hjälp kunder manuellt att matcha tidigt.
5. **Nätverkseffekter:** Kunder följer leverantörer -> sticky relationer.

---

## Källor

- [TrimCheck](https://www.trimcheck.com/booking-app-for-mobile-barbers)
- [Truckily](https://www.touchbistro.com/blog/which-food-truck-apps-to-use/)
- [MarketBox](https://www.gomarketbox.com/)
- [Tended Equine](https://www.tendedequine.org/)
- [Rover](https://www.rover.com/)
- [StreetFoodFinder](https://streetfoodfinder.com/apps)
- [Vev](https://vev.co/specialty/mobile-veterinarian)
- [Best Food Trucks](https://www.bestfoodtrucks.com/)
- [Sharetribe Marketplace Academy](https://www.sharetribe.com/academy/)
- [Cal.com Location-Based Issue](https://github.com/calcom/cal.com/issues/17412)
