import type { MercadoPagoInstance } from "@/types";

const MERCADOPAGO_SCRIPT_URL = "https://sdk.mercadopago.com/js/v2";

export const loadMercadoPago = (
  publicKey: string,
): Promise<MercadoPagoInstance> =>
  new Promise<MercadoPagoInstance>((resolve, reject) => {
    if (window.MercadoPago) return resolve(new window.MercadoPago(publicKey));

    const script = document.createElement("script");
    script.src = MERCADOPAGO_SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (!window.MercadoPago) {
        reject(new Error("MercadoPago.js failed to load."));
        return;
      }
      resolve(new window.MercadoPago(publicKey));
    };

    script.onerror = () => {
      reject(new Error("Failed to load MercadoPago SDK"));
    };
  });
