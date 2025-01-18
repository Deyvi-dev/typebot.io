import { router } from "@/helpers/server/trpc";
import { mercadoPagoPayment } from "./mercadopagoPayment";
import { openPixPayment } from "./openpix";

export const paymentsRouter = router({
  mercadoPagoPayment,
  openPixPayment,
});
