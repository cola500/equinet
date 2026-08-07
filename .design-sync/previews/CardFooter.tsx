import { Card, CardHeader, CardTitle, CardFooter, Button } from "equinet-ui"

export function Default() {
  return (
    <div className="p-4 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Helskoning</CardTitle>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button size="sm">Se detaljer</Button>
          <Button size="sm" variant="outline">
            Boka om
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
