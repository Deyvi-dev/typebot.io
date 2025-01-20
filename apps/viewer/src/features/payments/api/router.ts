import { router } from "@/helpers/server/trpc";
import { mercadoPagoPayment } from "./mercadopago";
import { openPixPayment, openPixPaymentStatus } from "./openpix";

export const paymentsRouter = router({
  openPixPayment,
  openPixPaymentStatus,
  mercadoPagoPayment,
});
