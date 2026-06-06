"use client"

import { useState, useCallback } from "react"
// `/pure` defers loading the js.stripe.com script until loadStripe() is actually
// called — the bare "@stripe/stripe-js" import loads it as a module side-effect,
// which fired on /customer/bookings even in mock mode. Combined with the lazy
// getStripePromise() below, Stripe.js now only loads in the real Stripe flow.
import { loadStripe } from "@stripe/stripe-js/pure"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog"
import { clientLogger } from "@/lib/client-logger"

// Lazy singleton: loadStripe() (which injects the js.stripe.com script) only
// fires the first time the dialog actually renders — i.e. the real Stripe flow
// with a clientSecret. In mock mode the dialog never mounts, so Stripe.js is
// never loaded. The Stripe test-mode path is unchanged, just deferred.
let stripePromiseCache: ReturnType<typeof loadStripe> | null | undefined
function getStripePromise() {
  if (stripePromiseCache === undefined) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    stripePromiseCache = key ? loadStripe(key) : null
  }
  return stripePromiseCache
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientSecret: string
  amount: number
  currency: string
  onSuccess: () => void
  onError: (message: string) => void
}

function PaymentForm({
  amount,
  onSuccess,
  onError,
  onClose,
}: {
  amount: number
  onSuccess: () => void
  onError: (message: string) => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements) return

    setIsProcessing(true)
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      })

      if (error) {
        clientLogger.error("Stripe payment error", { type: error.type, message: error.message })
        onError(error.message ?? "Betalningen misslyckades")
      } else {
        onSuccess()
      }
    } catch (err) {
      clientLogger.error("Payment confirmation error", err)
      onError("Ett oväntat fel uppstod vid betalning")
    } finally {
      setIsProcessing(false)
    }
  }, [stripe, elements, onSuccess, onError])

  return (
    <div className="space-y-4">
      <PaymentElement />
      <ResponsiveDialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isProcessing}
        >
          Avbryt
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!stripe || !elements || isProcessing}
          className="min-h-[44px] sm:min-h-0"
        >
          {isProcessing ? "Bearbetar..." : `Betala ${amount} kr`}
        </Button>
      </ResponsiveDialogFooter>
    </div>
  )
}

export function PaymentDialog({
  open,
  onOpenChange,
  clientSecret,
  amount,
  currency,
  onSuccess,
  onError,
}: PaymentDialogProps) {
  const stripePromise = getStripePromise()
  if (!stripePromise) {
    return null
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Betala {amount} {currency}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Fyll i dina kortuppgifter nedan
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#16a34a",
              },
            },
            locale: "sv",
          }}
        >
          <PaymentForm
            amount={amount}
            onSuccess={onSuccess}
            onError={onError}
            onClose={() => onOpenChange(false)}
          />
        </Elements>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
