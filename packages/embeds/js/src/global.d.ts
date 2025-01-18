import type { MercadoPagoInstance, PaymentBrickController } from "./types";

declare global {
  module "*.css";
  interface Window {
    MercadoPago: new (publicKey: string) => MercadoPagoInstance;
    paymentBrickController?: PaymentBrickController;
  }
}
