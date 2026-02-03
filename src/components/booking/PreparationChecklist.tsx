import { PREPARATION_CHECKLIST } from "@/lib/preparation-checklist"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function PreparationChecklist() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inför besöket</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3">
          Se till att följande är på plats:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          {PREPARATION_CHECKLIST.map((item) => (
            <li key={item} className="text-gray-900">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
