import { Button } from "equinet-ui"

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button variant="default">Boka nu</Button>
      <Button variant="secondary">Avboka</Button>
      <Button variant="outline">Se detaljer</Button>
      <Button variant="destructive">Ta bort</Button>
      <Button variant="ghost">Avbryt</Button>
      <Button variant="link">Läs mer</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button size="sm">Liten</Button>
      <Button size="default">Standard</Button>
      <Button size="lg">Stor</Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Button disabled>Boka nu</Button>
      <Button variant="outline" disabled>
        Se detaljer
      </Button>
    </div>
  )
}
