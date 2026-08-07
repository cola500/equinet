import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "equinet-ui"

export function BookingCard() {
  return (
    <div className="p-4 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Helskoning</CardTitle>
          <CardDescription>Lisa Andersson &middot; Molly</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fredag 7 augusti, 08:00&ndash;09:15
          </p>
          <Badge className="mt-2" variant="default">
            Bekräftad
          </Badge>
        </CardContent>
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
