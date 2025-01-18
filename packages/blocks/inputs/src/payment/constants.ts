import type { PaymentInputBlock } from "./schema";

export enum PaymentProvider {
  STRIPE = "Stripe",
  MERCADO_PAGO = "MercadoPago",
  OPENPIX = "OpenPix",
}

export const defaultPaymentInputOptions = {
  provider: PaymentProvider.STRIPE,
  labels: { button: "Pay", success: "Success" },
  retryMessageContent: "Payment failed. Please, try again.",
  currency: "USD",
} as const satisfies PaymentInputBlock["options"];
