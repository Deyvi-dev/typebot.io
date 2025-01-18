import { getRuntimeVariable } from "@typebot.io/env/getRuntimeVariable";
import { clsx } from "clsx";
import { Show, createSignal, onMount } from "solid-js";

import type { BotContext } from "@/types";
import type { PaymentInputBlock } from "@typebot.io/blocks-inputs/payment/schema";
import type { RuntimeOptions } from "@typebot.io/bot-engine/schemas/api";

type Props = {
  context: BotContext;
  options: PaymentInputBlock["options"] & RuntimeOptions;
  onSuccess: () => void;
  onTransitionEnd: () => void;
};

export const OpenPixPaymentForm = (props: Props) => {
  const [state, setState] = createSignal<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
    qrCode?: {
      url: string;
      paymentLink: string;
    };
  }>({ status: "idle" });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState((prev) => ({
        ...prev,
        status: "success",
        message: "Payment link copied!",
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: "error",
        message: "Failed to copy link",
      }));
    }
  };

  onMount(async () => {
    if (!props.options?.credentialsId) {
      setState({
        status: "error",
        message: "Missing OpenPix Credentials ID",
      });
      return;
    }

    try {
      setState({ status: "loading", message: "Generating payment..." });

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
        throw new Error(errorData.message || "Payment generation failed");
      }

      const data = await response.json();

      setState({
        status: "success",
        qrCode: {
          url: data.charge.qrCodeUrl,
          paymentLink: data.charge.paymentLinkUrl,
        },
      });

      props.onTransitionEnd();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Payment generation failed",
      });
    }
  });

  return (
    <div class="flex flex-col items-center w-full p-4 space-y-4">
      <Show
        when={state().status === "success" && state().qrCode}
        fallback={
          <div
            class={clsx(
              "text-center p-2 rounded-md w-full",
              state().status === "error" && "bg-red-50 text-red-600",
              state().status === "loading" && "bg-blue-50 text-blue-600",
            )}
          >
            {state().message || "Preparing payment..."}
          </div>
        }
      >
        <div class="relative group">
          <img
            src={state().qrCode?.url}
            alt="OpenPix QR Code"
            class="max-w-[250px] w-full rounded-lg shadow-md transition-transform group-hover:scale-105"
          />
          <button
            onClick={() => copyToClipboard(state().qrCode?.paymentLink ?? "")}
            class="absolute top-2 right-2 bg-white/80 hover:bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out"
            title="Copy Payment Link"
          >
            <span class="sr-only">Copy Payment Link</span>
            <i class="i-lucide-copy text-gray-700 w-5 h-5" />
          </button>
        </div>
      </Show>
    </div>
  );
};
