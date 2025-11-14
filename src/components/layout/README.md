# Layout-komponenter

Återanvändbara layout-komponenter för konsekvent design genom hela appen.

## Komponenter

### `<Header />`
Gemensam header för alla sidor. Visar:
- Equinet-logo (klickbar, går till startsidan)
- Login/Registrera-knappar (när utloggad)
- Användarnamn + dropdown-meny (när inloggad)

**Användning:**
```tsx
import { Header } from "@/components/layout/Header"

export default function MyPage() {
  return (
    <>
      <Header />
      {/* Din content */}
    </>
  )
}
```

### `<ProviderNav />`
Navigations-tabs för provider-sidor. Markerar automatiskt aktiv sida.

**Användning:**
```tsx
import { Header } from "@/components/layout/Header"
import { ProviderNav } from "@/components/layout/ProviderNav"

export default function ProviderPage() {
  return (
    <>
      <Header />
      <ProviderNav />
      {/* Din content */}
    </>
  )
}
```

### `<ProviderLayout />`
Komplett layout för provider-sidor. Inkluderar Header + ProviderNav + main container.

**Användning (rekommenderat för provider-sidor):**
```tsx
import { ProviderLayout } from "@/components/layout/ProviderLayout"

export default function ProviderPage() {
  return (
    <ProviderLayout>
      <h1 className="text-3xl font-bold mb-8">Min sida</h1>
      {/* Din content här */}
    </ProviderLayout>
  )
}
```

### `<CustomerNav />`
Navigations-tabs för kund-sidor. Markerar automatiskt aktiv sida.

### `<CustomerLayout />`
Komplett layout för kund-sidor. Inkluderar Header + CustomerNav + main container.

**Användning (rekommenderat för kund-sidor):**
```tsx
import { CustomerLayout } from "@/components/layout/CustomerLayout"

export default function CustomerPage() {
  return (
    <CustomerLayout>
      <h1 className="text-3xl font-bold mb-8">Min sida</h1>
      {/* Din content här */}
    </CustomerLayout>
  )
}
```

## Framtida komponenter

Du kan enkelt skapa fler layout-komponenter:

- `<PublicLayout />` - För publika sidor (startsida, providers-lista)
- `<Footer />` - Gemensam footer

## Styling-standards

### Header
- Bakgrund: `bg-white border-b`
- Padding: `py-4`
- Container: `container mx-auto px-4`

### Navigation
- Bakgrund: `bg-white border-b`
- Aktiv länk: `border-b-2 border-green-600 text-green-600 font-medium`
- Inaktiv länk: `text-gray-600 hover:text-gray-900`

### Main Content
- Bakgrund: `bg-gray-50`
- Container: `container mx-auto px-4 py-8`

## Varför använda layout-komponenter?

✅ **Konsekvent design** - Alla sidor ser likadana ut
✅ **Enklare underhåll** - Ändra på ett ställe, påverkar alla sidor
✅ **Snabbare utveckling** - Kopiera mindre kod
✅ **Färre buggar** - Mindre duplicerad kod = färre misstag
