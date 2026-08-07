import { Card, CardHeader, CardTitle, CardContent, Badge } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Helskoning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fredag 7 augusti, 08:00&ndash;09:15
          </p>
          <Badge className="mt-2">Bekräftad</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
