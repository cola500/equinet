import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

// GET - Get receipt HTML for a paid booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const session = await auth()

    // Verify booking belongs to customer and has payment
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { customerId: session.user.id },
          { provider: { userId: session.user.id } }
        ]
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            address: true,
          },
        },
        service: true,
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        payment: true,
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Bokning hittades inte" },
        { status: 404 }
      )
    }

    if (!booking.payment || booking.payment.status !== "succeeded") {
      return NextResponse.json(
        { error: "Ingen betalning hittades för denna bokning" },
        { status: 400 }
      )
    }

    const receiptHtml = generateReceiptHtml({
      invoiceNumber: booking.payment.invoiceNumber || "N/A",
      paidAt: booking.payment.paidAt
        ? format(new Date(booking.payment.paidAt), "d MMMM yyyy HH:mm", { locale: sv })
        : "N/A",
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerEmail: booking.customer.email,
      customerAddress: booking.customer.address || "",
      providerName: `${booking.provider.user.firstName} ${booking.provider.user.lastName}`,
      businessName: booking.provider.businessName,
      serviceName: booking.service.name,
      serviceDescription: booking.service.description || "",
      bookingDate: format(new Date(booking.bookingDate), "d MMMM yyyy", { locale: sv }),
      startTime: booking.startTime,
      endTime: booking.endTime,
      amount: booking.payment.amount,
      currency: booking.payment.currency,
    })

    // Return HTML that can be printed or saved as PDF
    return new NextResponse(receiptHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  } catch (error) {
    // If error is a Response (from auth()), return it
    if (error instanceof Response) {
      return error
    }

    console.error("Error generating receipt:", error)
    return NextResponse.json(
      { error: "Kunde inte generera kvitto" },
      { status: 500 }
    )
  }
}

interface ReceiptData {
  invoiceNumber: string
  paidAt: string
  customerName: string
  customerEmail: string
  customerAddress: string
  providerName: string
  businessName: string
  serviceName: string
  serviceDescription: string
  bookingDate: string
  startTime: string
  endTime: string
  amount: number
  currency: string
}

function generateReceiptHtml(data: ReceiptData): string {
  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kvitto ${data.invoiceNumber} - Equinet</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f9fafb;
      padding: 20px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: #16a34a;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 5px;
    }
    .header .invoice-number {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      color: #6b7280;
    }
    .value {
      font-weight: 500;
      text-align: right;
    }
    .total-row {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      margin-top: 20px;
    }
    .total-row .label {
      font-weight: 600;
      color: #333;
    }
    .total-row .value {
      font-size: 20px;
      color: #16a34a;
      font-weight: 700;
    }
    .footer {
      background: #f3f4f6;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .print-button {
      display: block;
      width: 100%;
      max-width: 200px;
      margin: 20px auto;
      padding: 12px 24px;
      background: #16a34a;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .print-button:hover {
      background: #15803d;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .receipt {
        box-shadow: none;
      }
      .print-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>KVITTO</h1>
      <div class="invoice-number">${data.invoiceNumber}</div>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">Betalningsinformation</div>
        <div class="row">
          <span class="label">Betaldatum</span>
          <span class="value">${data.paidAt}</span>
        </div>
        <div class="row">
          <span class="label">Kvittonummer</span>
          <span class="value">${data.invoiceNumber}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Kund</div>
        <div class="row">
          <span class="label">Namn</span>
          <span class="value">${data.customerName}</span>
        </div>
        <div class="row">
          <span class="label">E-post</span>
          <span class="value">${data.customerEmail}</span>
        </div>
        ${data.customerAddress ? `
        <div class="row">
          <span class="label">Adress</span>
          <span class="value">${data.customerAddress}</span>
        </div>
        ` : ""}
      </div>

      <div class="section">
        <div class="section-title">Leverantör</div>
        <div class="row">
          <span class="label">Företag</span>
          <span class="value">${data.businessName}</span>
        </div>
        <div class="row">
          <span class="label">Kontaktperson</span>
          <span class="value">${data.providerName}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Tjänst</div>
        <div class="row">
          <span class="label">Tjänst</span>
          <span class="value">${data.serviceName}</span>
        </div>
        <div class="row">
          <span class="label">Datum</span>
          <span class="value">${data.bookingDate}</span>
        </div>
        <div class="row">
          <span class="label">Tid</span>
          <span class="value">${data.startTime} - ${data.endTime}</span>
        </div>
      </div>

      <div class="total-row">
        <div class="row" style="border: none;">
          <span class="label">Totalt betalt</span>
          <span class="value">${data.amount} ${data.currency}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Equinet - Din plattform för hästtjänster</p>
      <p>Detta kvitto är ett bevis på genomförd betalning.</p>
    </div>
  </div>

  <button class="print-button" onclick="window.print()">
    Skriv ut kvitto
  </button>
</body>
</html>
`
}
