import { Card, CardHeader, CardTitle, CardDescription } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Helskoning</CardTitle>
          <CardDescription>Lisa Andersson &middot; Molly</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
