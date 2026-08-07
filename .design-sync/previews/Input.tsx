import { Input, Label } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm space-y-2">
      <Label htmlFor="ds-input-email">E-post</Label>
      <Input id="ds-input-email" type="email" placeholder="din@email.se" />
    </div>
  )
}

export function Disabled() {
  return (
    <div className="p-4 max-w-sm space-y-2">
      <Label htmlFor="ds-input-disabled">Telefon</Label>
      <Input id="ds-input-disabled" disabled value="070-123 45 67" />
    </div>
  )
}
