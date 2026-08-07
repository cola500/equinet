import { Textarea, Label } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm space-y-2">
      <Label htmlFor="ds-textarea-notes">Anteckningar</Label>
      <Textarea
        id="ds-textarea-notes"
        placeholder="Skriv en anteckning om besöket..."
      />
    </div>
  )
}

export function Filled() {
  return (
    <div className="p-4 max-w-sm space-y-2">
      <Label htmlFor="ds-textarea-filled">Anteckningar</Label>
      <Textarea
        id="ds-textarea-filled"
        defaultValue="Molly var lite känslig på vänster framhov, håll koll nästa gång."
      />
    </div>
  )
}
