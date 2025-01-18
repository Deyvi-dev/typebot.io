import type { BotContext } from "@/types";
import { PaymentProvider } from "@typebot.io/blocks-inputs/payment/constants";
import type { PaymentInputBlock } from "@typebot.io/blocks-inputs/payment/schema";
import type { RuntimeOptions } from "@typebot.io/bot-engine/schemas/api";
import { MercadoPagoPaymentForm } from "./MercadoPagoPaymentForm";
import { OpenPixPaymentForm } from "./OpenPixPaymentForm";
import { StripePaymentForm } from "./StripePaymentForm";

type Props = {
  context: BotContext;
  options: PaymentInputBlock["options"] & RuntimeOptions;
  onSuccess: () => void;
  onTransitionEnd: () => void;
};

export const PaymentForm = (props: Props) => {
  switch (props.options?.provider) {
    case PaymentProvider.STRIPE:
      return (
        <StripePaymentForm
          onSuccess={props.onSuccess}
          options={props.options}
          context={props.context}
          onTransitionEnd={props.onTransitionEnd}
        />
      );
    case PaymentProvider.MERCADO_PAGO:
      return (
        <MercadoPagoPaymentForm
          onSuccess={props.onSuccess}
          options={props.options}
          context={props.context}
          onTransitionEnd={props.onTransitionEnd}
        />
      );
    case PaymentProvider.OPENPIX:
      return (
        <OpenPixPaymentForm
          onSuccess={props.onSuccess}
          options={props.options}
          context={props.context}
          onTransitionEnd={props.onTransitionEnd}
        />
      );
    default:
      return null;
  }
};
