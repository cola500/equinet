## Wrapping and setup

No provider or root wrapper is required — none of the synced components read from React context. Design tokens are plain CSS custom properties on `:root` (and `.dark` for dark mode), already included in `styles.css`. To preview dark mode, add the `dark` class to an ancestor element; no extra setup needed.

## Styling idiom

This is a Tailwind CSS v4 + shadcn/ui system, styled entirely through utility classes — never inline styles or CSS-in-JS. Variant-bearing components (`Button`, `Badge`) use `class-variance-authority`: pass `variant`/`size` props, never hand-compose utility classes for variant state. Every component accepts a `className` prop that merges on top of its defaults (via `cn()` / `tailwind-merge`) — extend spacing/layout this way, don't override variant colors by className.

Real token vocabulary (all defined in `styles.css`, both light and dark):

| Token | Utility class examples |
|---|---|
| `--primary` / `--primary-foreground` | `bg-primary`, `text-primary-foreground` |
| `--secondary` / `--secondary-foreground` | `bg-secondary`, `text-secondary-foreground` |
| `--destructive` | `bg-destructive`, `text-destructive` |
| `--muted` / `--muted-foreground` | `bg-muted`, `text-muted-foreground` |
| `--card` / `--card-foreground` | `bg-card`, `text-card-foreground` |
| `--border` / `--input` / `--ring` | `border`, `border-input`, `ring-ring` |
| `--radius` (+ `-sm`/`-md`/`-lg`/`-xl` scale) | `rounded-md`, `rounded-lg`, `rounded-xl` |

Brand primary is a dark green (`oklch(0.42 0.09 160)`), not the shadcn default — always use `bg-primary`/`variant="default"` rather than a hardcoded green.

## Where the truth lives

- `styles.css` — root token definitions (`:root`, `.dark`) plus the `@import` of `_ds_bundle.css`, which carries the compiled component CSS.
- Each component's `.prompt.md` — usage reference for that component specifically.
- `_ds_bundle.js` — the real compiled components (`Button`, `Badge`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Input`, `Label`, `Textarea`, `Checkbox`, `Switch`, `Skeleton`).

## Example composition

```tsx
import {
  Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter, Button, Badge,
} from "equinet-ui"

function BookingCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Helskoning</CardTitle>
        <CardDescription>Lisa Andersson · Molly</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Fredag 7 augusti, 08:00–09:15
        </p>
        <Badge className="mt-2">Bekräftad</Badge>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Se detaljer</Button>
        <Button size="sm" variant="outline">Boka om</Button>
      </CardFooter>
    </Card>
  )
}
```
