import { Label, Input } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm space-y-2">
      <Label htmlFor="ds-label-name">Hästens namn</Label>
      <Input id="ds-label-name" placeholder="Molly" />
    </div>
  )
}
