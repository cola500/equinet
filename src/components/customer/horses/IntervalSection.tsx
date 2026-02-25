import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription,
  ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import type { ServiceInterval, AvailableService } from "@/app/customer/horses/[id]/types"

interface IntervalSectionProps {
  intervals: ServiceInterval[]
  availableServices: AvailableService[]
  dialogOpen: boolean
  onDialogOpenChange: (open: boolean) => void
  editingInterval: ServiceInterval | null
  intervalForm: { serviceId: string; intervalWeeks: string }
  onIntervalFormChange: (form: { serviceId: string; intervalWeeks: string }) => void
  isSaving: boolean
  onSave: (e: React.FormEvent) => void
  onDelete: (serviceId: string, serviceName: string) => void
  onEditInterval: (interval: ServiceInterval) => void
  onNewInterval: () => void
  onServiceSelect: (serviceId: string) => void
}

export function IntervalSection({
  intervals, availableServices, dialogOpen, onDialogOpenChange,
  editingInterval, intervalForm, onIntervalFormChange,
  isSaving, onSave, onDelete, onEditInterval, onNewInterval, onServiceSelect,
}: IntervalSectionProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Serviceintervall</h2>
        <Button variant="outline" size="sm" onClick={onNewInterval}>Lägg till</Button>
      </div>

      {intervals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-2">Inga serviceintervall satta.</p>
            <p className="text-sm text-gray-500">
              Lägg till för att få påminnelser när det är dags för service.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {intervals.map((interval) => (
            <Card key={interval.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{interval.service.name}</p>
                    <p className="text-sm text-gray-600">
                      Var {interval.intervalWeeks} vecka{interval.intervalWeeks !== 1 ? "r" : ""}
                    </p>
                    {interval.service.recommendedIntervalWeeks && (
                      <p className="text-xs text-gray-400">
                        Leverantörens rekommendation: {interval.service.recommendedIntervalWeeks} veckor
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onEditInterval(interval)}>Ändra</Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onDelete(interval.serviceId, interval.service.name)}
                    >
                      Ta bort
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResponsiveDialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editingInterval ? "Ändra serviceintervall" : "Lägg till serviceintervall"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Ange hur ofta denna tjänst ska utföras. Du får en påminnelse när det är dags.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            {!editingInterval && (
              <div>
                <Label htmlFor="interval-service">Tjänst *</Label>
                {availableServices.length > 0 ? (
                  <Select value={intervalForm.serviceId} onValueChange={onServiceSelect}>
                    <SelectTrigger id="interval-service">
                      <SelectValue placeholder="Välj tjänst..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Inga tjänster hittades. Boka en tjänst först så dyker den upp här.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="interval-weeks">Intervall (veckor) *</Label>
              <Input
                id="interval-weeks"
                type="number"
                min={1} max={104}
                value={intervalForm.intervalWeeks}
                onChange={(e) => onIntervalFormChange({ ...intervalForm, intervalWeeks: e.target.value })}
                placeholder="T.ex. 6"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                1-104 veckor. T.ex. 6 veckor för hovslagare, 26 veckor för tandvård.
              </p>
            </div>
            <ResponsiveDialogFooter>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !intervalForm.serviceId.trim() ||
                  !intervalForm.intervalWeeks ||
                  Number(intervalForm.intervalWeeks) < 1 ||
                  Number(intervalForm.intervalWeeks) > 104
                }
              >
                {isSaving ? "Sparar..." : "Spara"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
