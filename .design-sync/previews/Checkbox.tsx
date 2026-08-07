import { Checkbox, Label } from "equinet-ui"

export function States() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Checkbox id="ds-checkbox-unchecked" />
        <Label htmlFor="ds-checkbox-unchecked">Skicka påminnelse</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-checkbox-checked" defaultChecked />
        <Label htmlFor="ds-checkbox-checked">Godkänn villkoren</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ds-checkbox-disabled" disabled />
        <Label htmlFor="ds-checkbox-disabled">Inaktiverad</Label>
      </div>
    </div>
  )
}
