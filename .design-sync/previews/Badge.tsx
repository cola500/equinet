import { Badge } from "equinet-ui"

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <Badge variant="default">Bekräftad</Badge>
      <Badge variant="secondary">Väntande</Badge>
      <Badge variant="destructive">Avbokad</Badge>
      <Badge variant="outline">Genomförd</Badge>
    </div>
  )
}
