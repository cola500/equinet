import { Switch, Label } from "equinet-ui"

export function States() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Switch id="ds-switch-off" />
        <Label htmlFor="ds-switch-off">Röstloggning</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ds-switch-on" defaultChecked />
        <Label htmlFor="ds-switch-on">Push-notiser</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="ds-switch-disabled" disabled />
        <Label htmlFor="ds-switch-disabled">Inaktiverad</Label>
      </div>
    </div>
  )
}
