import { getRuntimeVariable } from "@typebot.io/env/getRuntimeVariable";
import { clsx } from "clsx";
import { Show, createSignal, onMount } from "solid-js";

import type { BotContext } from "@/types";
import type { PaymentInputBlock } from "@typebot.io/blocks-inputs/payment/schema";
import type { RuntimeOptions } from "@typebot.io/bot-engine/schemas/api";
import { OpenPixLogo } from "./logo/openpixLogo";

type Props = {
  context: BotContext;
  options: PaymentInputBlock["options"] & RuntimeOptions;
  onSuccess: () => void;
  onTransitionEnd: () => void;
};

export const OpenPixPaymentForm = (props: Props) => {
  const [state, setState] = createSignal<{
    status: "idle" | "loading" | "success" | "error" | "checking";
    message?: string;
    correlationId?: string;
    qrCode?: {
      url: string;
      paymentLinkUrl: string;
      brCode?: string;
    };
  }>({ status: "idle" });

  const [notification, setNotification] = createSignal<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const showNotification = (
    message: string,
    type: "success" | "error" | "warning" = "error",
  ) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const copyToClipboard = async (
    text: string,
    type: "link" | "qr" | "brcode",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(
        type === "link"
          ? "Link de pagamento copiado!"
          : type === "qr"
            ? "URL do QR Code copiada!"
            : "Código Pix copiado!",
        "success",
      );
    } catch {
      showNotification("Falha ao copiar", "error");
    }
  };

  const checkPaymentStatus = async () => {
    if (!state().correlationId || !props.options?.credentialsId) {
      showNotification("Detalhes do pagamento ausentes");
      return;
    }

    try {
      const apiHost =
        props.context.apiHost ?? getRuntimeVariable("NEXT_PUBLIC_VIEWER_URL");

      const response = await fetch(
        `${apiHost}/api/v1/payments/openpix/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credentialsId: props.options.credentialsId,
            correlationId: state().correlationId,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Falha na verificação do status do pagamento",
        );
      }

      const data = await response.json();

      if (data.status === "COMPLETED") {
        setState({
          ...state(),
          status: "success",
          message: `Pagamento confirmado. Valor: ${props.options.amountLabel ?? "R$ 0,00"}`,
        });
        showNotification("Pagamento confirmado!", "success");
        props.onTransitionEnd();
        props.onSuccess();
      } else {
        showNotification("Pagamento ainda não confirmado", "warning");
      }
    } catch (error) {
      showNotification(
        error instanceof Error
          ? error.message
          : "Falha na verificação do status do pagamento",
      );
    }
  };

  onMount(async () => {
    if (!props.options?.credentialsId) {
      showNotification("ID de credenciais do OpenPix ausente");
      return;
    }

    try {
      const apiHost =
        props.context.apiHost ?? getRuntimeVariable("NEXT_PUBLIC_VIEWER_URL");

      const response = await fetch(`${apiHost}/api/v1/payments/openpix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialsId: props.options.credentialsId,
          amount: props.options.amount ?? 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Falha na geração do pagamento");
      }

      const data = await response.json();

      setState({
        status: "success",
        correlationId: data.charge.id,
        qrCode: {
          url: data.charge.qrCodeUrl,
          paymentLinkUrl: data.charge.paymentLinkUrl,
          brCode: data.charge.brCode,
        },
      });

      props.onTransitionEnd();
    } catch (error) {
      showNotification(
        error instanceof Error
          ? error.message
          : "Falha na geração do pagamento",
      );
    }
  });

  return (
    <>
      {notification() && (
        <div
          class={clsx(
            "fixed top-4 right-4 z-50 px-4 py-2 rounded-md shadow-lg transition-all duration-300",
            notification()?.type === "success" && "bg-green-500 text-white",
            notification()?.type === "error" && "bg-red-500 text-white",
            notification()?.type === "warning" && "bg-yellow-500 text-black",
          )}
          style={{
            transform: notification() ? "translateX(0)" : "translateX(120%)",
            opacity: notification() ? 1 : 0,
          }}
        >
          {notification()?.message}
        </div>
      )}

      <div class="flex flex-col items-center w-full p-2">
        <Show
          when={state().status === "success" && state().qrCode}
          fallback={
            <div
              class={clsx(
                "text-center p-2 w-full font-medium text-sm",
                state().status === "error" && "text-red-700",
                state().status === "loading" && "text-blue-700",
                state().status === "checking" && "text-yellow-700",
              )}
            >
              {state().message || "Preparando pagamento..."}
            </div>
          }
        >
          <div class="flex flex-col items-center justify-center w-full max-w-3xl space-y-4">
            <div class="flex flex-col items-center justify-center w-full space-y-2">
              <OpenPixLogo />
              <div class="text-center">
                <p class="text-xl font-bold text-gray-800">
                  Pague {props.options?.amountLabel ?? "R$ 0,00"}
                </p>
              </div>
            </div>

            <div class="w-full max-w-[250px] flex justify-center">
              <img
                src={state().qrCode?.url}
                alt="QR Code Pix"
                class="w-full rounded-xl shadow-lg transform transition-transform duration-300 hover:scale-105"
              />
            </div>

            <div class="flex flex-col items-center w-full max-w-md space-y-3 text-center">
              <div class="space-y-2">
                <h3 class="text-lg font-bold text-emerald-700">
                  Pagamento Pronto
                </h3>
                <div class="text-sm text-gray-600 space-y-2">
                  <p class="text-center font-medium">
                    Escaneie o QR Code ou copie a chave Pix
                  </p>

                  {state().qrCode?.brCode && (
                    <div class="flex items-center justify-center w-full">
                      <button
                        onClick={() =>
                          copyToClipboard(
                            state().qrCode?.brCode ?? "",
                            "brcode",
                          )
                        }
                        class="flex items-center justify-center space-x-2 bg-emerald-500 text-white px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                        title="Copiar Código Pix"
                      >
                        <i class="i-lucide-copy text-base" />
                        <span class="font-medium text-sm">
                          Copiar Chave Pix
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div class="w-full px-2">
                <button
                  onClick={checkPaymentStatus}
                  class="w-full bg-green-600 text-white px-3 py-2.5 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 ease-in-out transform active:scale-95 shadow-md flex items-center justify-center space-x-1.5 text-sm font-medium"
                >
                  <i class="i-lucide-check-circle text-base" />
                  <span>{props.options?.labels?.button ?? "Já Paguei"}</span>
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </>
  );
};
