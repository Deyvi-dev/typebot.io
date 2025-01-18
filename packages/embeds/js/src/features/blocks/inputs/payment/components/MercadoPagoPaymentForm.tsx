import { loadMercadoPago } from "@/lib/mercadopago";
import type {
  MercadoPagoInstance,
  PaymentBrickError,
  PaymentBrickSettings,
  PaymentBrickSubmitData,
} from "@/types";
import type { BotContext } from "@/types";
import type { PaymentInputBlock } from "@typebot.io/blocks-inputs/payment/schema";
import type { RuntimeOptions } from "@typebot.io/bot-engine/schemas/api";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

declare global {
  interface Window {
    paymentBrickController?: {
      unmount: () => void;
    };
    statusScreenBrickController?: {
      unmount: () => void;
    };
    cardPaymentBrickController?: {
      unmount: () => void;
    };
  }
}

type Props = {
  context: BotContext;
  options: PaymentInputBlock["options"] & RuntimeOptions;
  onSuccess: () => void;
  onTransitionEnd: () => void;
};

type PaymentMethodData = {
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount: number;
  description?: string;
  payer?: {
    name?: string;
    email?: string;
    phone?: {
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

const PAYMENT_CONTAINER_ID = "paymentBrick_container";
const STATUS_CONTAINER_ID = "statusScreenBrick_container";
const CARD_PAYMENT_CONTAINER_ID = "cardPaymentBrick_container";
const SLOT_NAME = "mercadopago-payment-form";

export function MercadoPagoPaymentForm(props: Props) {
  const [message, setMessage] = createSignal<string>();
  const [currentView, setCurrentView] = createSignal<"payment" | "status">(
    "payment",
  );
  let paymentElementSlot: HTMLSlotElement | undefined;

  const initShadowMountPoint = () => {
    if (!paymentElementSlot) return;

    const rootNode = paymentElementSlot.getRootNode() as ShadowRoot;
    const host = rootNode.host;

    const paymentPlaceholder = document.createElement("div");
    paymentPlaceholder.style.width = "100%";
    paymentPlaceholder.slot = SLOT_NAME;
    host.appendChild(paymentPlaceholder);

    const paymentElementContainer = document.createElement("div");
    paymentElementContainer.id = PAYMENT_CONTAINER_ID;
    paymentPlaceholder.appendChild(paymentElementContainer);

    const statusElementContainer = document.createElement("div");
    statusElementContainer.id = STATUS_CONTAINER_ID;
    statusElementContainer.style.display = "none";
    paymentPlaceholder.appendChild(statusElementContainer);

    const cardPaymentElementContainer = document.createElement("div");
    cardPaymentElementContainer.id = CARD_PAYMENT_CONTAINER_ID;
    cardPaymentElementContainer.style.display = "none";
    paymentPlaceholder.appendChild(cardPaymentElementContainer);
  };

  const renderStatusScreenBrick = async (
    bricksBuilder: ReturnType<MercadoPagoInstance["bricks"]>,
    paymentId: number,
  ) => {
    const settings: PaymentBrickSettings = {
      initialization: {
        amount: Number(props?.options?.amount) || 0,
        preferenceId: paymentId.toString(),
      },
      callbacks: {
        onReady: () => {
          document.getElementById(PAYMENT_CONTAINER_ID)!.style.display = "none";
          document.getElementById(STATUS_CONTAINER_ID)!.style.display = "block";
          props.onTransitionEnd();
        },
        onError: (error: PaymentBrickError) => {
          console.error("Status Screen Brick Error:", error);
          setMessage(error.message);
        },
      },
    };

    try {
      window.statusScreenBrickController = await bricksBuilder.create(
        "statusScreen",
        STATUS_CONTAINER_ID,
        settings,
      );
    } catch (err) {
      console.error("Failed to create Status Screen Brick:", err);
      setMessage(
        err instanceof Error
          ? err.message
          : "Failed to initialize status screen",
      );
    }
  };

  const renderPaymentBrick = async (
    bricksBuilder: ReturnType<MercadoPagoInstance["bricks"]>,
  ) => {
    const settings: PaymentBrickSettings = {
      initialization: {
        amount: Number(props?.options?.amount) || 0,
      },
      customization: {
        paymentMethods: {
          atm: "all",
          bank_transfer: "all",
          ticket: "all",
          debit_card: "all",
          credit_card: "all",
          onboarding_credits: "all",
          wallet_purchase: "all",
          max_installments: 1,
        },
        visual: {
          style: {
            theme: "default",
          },
          texts: {
            formSubmit: props.options?.labels?.button,
          },
        },
      },
      callbacks: {
        onReady: () => {
          setTimeout(() => {
            props.onTransitionEnd();
          }, 1000);
        },
        onSubmit: async ({
          selectedPaymentMethod,
          formData,
        }: PaymentBrickSubmitData) => {
          try {
            setMessage(undefined);

            const { apiHost, sessionId } = props.context;
            const { amount, currency, credentialsId } = props.options ?? {};

            if (!amount || !currency || !credentialsId) {
              throw new Error("Missing required payment configuration");
            }

            const paymentMethodId =
              typeof selectedPaymentMethod === "string"
                ? selectedPaymentMethod
                : (selectedPaymentMethod as { payment_method_id?: string })
                    ?.payment_method_id;

            if (!paymentMethodId) {
              console.error("Payment Method Debug:", selectedPaymentMethod);
              throw new Error("No payment method selected");
            }

            const paymentData: PaymentMethodData = {
              payment_method_id: paymentMethodId,
              payment_type_id: paymentMethodId,
              transaction_amount: Number(amount),
              description:
                props.options?.additionalInformation?.description ||
                `Payment for ${paymentMethodId}`,
              payer: {
                name: formData?.payer?.name,
                email: formData?.payer?.email || "user@example.com",
                phone: {
                  number: formData?.payer?.phone?.number,
                },
                identification: {
                  type: formData?.payer?.identification?.type || "CPF",
                  number: formData?.payer?.identification?.number,
                },
              },
            };

            const response = await fetch(`/api/v1/payments/mercadopago`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId,
                paymentMethodId,
                amount: Number(amount),
                currency,
                credentialsId,
                formData: paymentData,
                additionalInformation: {
                  name: paymentData.payer?.name,
                  email: paymentData.payer?.email,
                  phoneNumber: paymentData.payer?.phone?.number,
                  description: paymentData.description,
                  documentType: paymentData.payer?.identification?.type,
                  documentNumber: paymentData.payer?.identification?.number,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error?.message || "Payment processing failed",
              );
            }

            const result = await response.json();

            if (result.status === "pending" && result.id) {
              setCurrentView("status");
              const mp = await loadMercadoPago(props.options?.publicKey || "");
              const bricksBuilder = mp.bricks();
              await renderStatusScreenBrick(bricksBuilder, result.id);
              return;
            }

            await props.onSuccess();
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : "Payment submission failed";
            setMessage(errorMessage);
            console.error("MercadoPago payment submission error:", err);
          }
        },
        onError: (error: PaymentBrickError) => {
          setMessage(error.message);
          console.error("MercadoPago payment error:", error);
        },
      },
    };

    try {
      window.paymentBrickController = await bricksBuilder.create(
        "payment",
        PAYMENT_CONTAINER_ID,
        settings,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initialize payment form";
      setMessage(errorMessage);
      console.error("MercadoPago initialization error:", err);
    }
  };

  const renderCardPaymentBrick = async (
    bricksBuilder: ReturnType<MercadoPagoInstance["bricks"]>,
  ) => {
    const settings: PaymentBrickSettings = {
      initialization: {
        amount: Number(props?.options?.amount) || 0,
      },
      customization: {
        visual: {
          style: {
            theme: "default",
          },
          texts: {
            formSubmit: props.options?.labels?.button,
          },
        },
      },
      callbacks: {
        onReady: () => {
          document.getElementById(PAYMENT_CONTAINER_ID)!.style.display = "none";
          document.getElementById(CARD_PAYMENT_CONTAINER_ID)!.style.display =
            "block";
          setTimeout(() => {
            props.onTransitionEnd();
          }, 1000);
        },
        onSubmit: async ({
          selectedPaymentMethod,
          formData,
        }: PaymentBrickSubmitData) => {
          try {
            setMessage(undefined);

            const { apiHost, sessionId } = props.context;
            const { amount, currency, credentialsId } = props.options ?? {};

            if (!amount || !currency || !credentialsId) {
              throw new Error("Missing required payment configuration");
            }

            const paymentMethodId =
              typeof selectedPaymentMethod === "string"
                ? selectedPaymentMethod
                : (selectedPaymentMethod as { payment_method_id?: string })
                    ?.payment_method_id;

            if (!paymentMethodId) {
              console.error(
                "Card Payment Method Debug:",
                selectedPaymentMethod,
              );
              throw new Error("No payment method selected");
            }

            const paymentData: PaymentMethodData = {
              payment_method_id: paymentMethodId,
              payment_type_id: paymentMethodId,
              transaction_amount: Number(amount),
              description:
                props.options?.additionalInformation?.description ||
                `Card Payment for ${paymentMethodId}`,
              payer: {
                name: formData?.payer?.name,
                email: formData?.payer?.email || "user@example.com",
                phone: {
                  number: formData?.payer?.phone?.number,
                },
                identification: {
                  type: formData?.payer?.identification?.type || "CPF",
                  number: formData?.payer?.identification?.number,
                },
              },
            };

            const response = await fetch(`/api/v1/payments/mercadopago`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId,
                paymentMethodId,
                amount: Number(amount),
                currency,
                credentialsId,
                formData: paymentData,
                additionalInformation: {
                  name: paymentData.payer?.name,
                  email: paymentData.payer?.email,
                  phoneNumber: paymentData.payer?.phone?.number,
                  description: paymentData.description,
                  documentType: paymentData.payer?.identification?.type,
                  documentNumber: paymentData.payer?.identification?.number,
                },
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error?.message || "Card Payment processing failed",
              );
            }

            const result = await response.json();

            if (result.status === "pending" && result.id) {
              setCurrentView("status");
              const mp = await loadMercadoPago(props.options?.publicKey || "");
              const bricksBuilder = mp.bricks();
              await renderStatusScreenBrick(bricksBuilder, result.id);
              return;
            }

            await props.onSuccess();
          } catch (err) {
            const errorMessage =
              err instanceof Error
                ? err.message
                : "Card Payment submission failed";
            setMessage(errorMessage);
            console.error("MercadoPago card payment submission error:", err);
          }
        },
        onError: (error: PaymentBrickError) => {
          setMessage(error.message);
          console.error("MercadoPago card payment error:", error);
        },
      },
    };

    try {
      window.cardPaymentBrickController = await bricksBuilder.create(
        "cardPayment",
        CARD_PAYMENT_CONTAINER_ID,
        settings,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initialize card payment form";
      setMessage(errorMessage);
      console.error("MercadoPago card payment initialization error:", err);
    }
  };

  const initMercadoPago = async () => {
    if (!props?.options?.publicKey) {
      setMessage("Missing MercadoPago public key");
      return;
    }

    try {
      const mp = await loadMercadoPago(props.options.publicKey);
      const bricksBuilder = mp.bricks();

      if (props.options?.paymentType === "card") {
        await renderCardPaymentBrick(bricksBuilder);
      } else {
        await renderPaymentBrick(bricksBuilder);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initialize MercadoPago";
      setMessage(errorMessage);
      console.error("MercadoPago initialization error:", err);
    }
  };

  onMount(() => {
    if (paymentElementSlot) {
      initShadowMountPoint();
      initMercadoPago();
    }
  });

  onCleanup(() => {
    window.paymentBrickController?.unmount();
    window.statusScreenBrickController?.unmount();
    window.cardPaymentBrickController?.unmount();
  });

  return (
    <div class="flex flex-col p-4 typebot-input w-full items-center">
      <slot name={SLOT_NAME} ref={paymentElementSlot} />
      <Show when={message()}>
        <div class="typebot-input-error-message mt-4 text-center animate-fade-in">
          {message()}
        </div>
      </Show>
    </div>
  );
}
