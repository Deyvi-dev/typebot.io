import type {
  ContinueChatResponse,
  StartChatResponse,
} from "@typebot.io/bot-engine/schemas/api";

export type BotContext = {
  typebot: StartChatResponse["typebot"];
  resultId?: string;
  isPreview: boolean;
  apiHost?: string;
  sessionId: string;
  storage: "local" | "session" | undefined;
};

export type OutgoingLog = {
  status: string;
  description: string;
  details?: unknown;
};

export type ClientSideActionContext = {
  apiHost?: string;
  sessionId: string;
  resultId?: string;
};

export type ChatChunk = Pick<ContinueChatResponse, "messages" | "input"> & {
  streamingMessageId?: string;
};

export type Attachment = {
  type: string;
  url: string;
  blobUrl?: string;
};

export type TextInputSubmitContent = {
  type: "text";
  value: string;
  label?: string;
  attachments?: Attachment[];
};

export type RecordingInputSubmitContent = {
  type: "recording";
  url: string;
  blobUrl?: string;
};

export type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: string,
      containerId: string,
      settings: PaymentBrickSettings,
    ) => Promise<PaymentBrickController>;
  };
};

export type PaymentBrickController = {
  unmount: () => void;
};

export type PaymentBrickSettings = {
  initialization: {
    amount: number;
    preferenceId?: string;
  };
  customization?: {
    paymentMethods?: {
      atm?: string;
      ticket?: string;
      bank_transfer?: string;
      credit_card?: string;
      debit_card?: string;
      mercado_pago?: string;
      onboarding_credits?: string;
      wallet_purchase?: string;
      max_installments?: number;
    };
    visual?: {
      style?: {
        theme?: "default" | "dark" | "flat";
      };
      texts?: {
        formSubmit?: string;
        cardNumber?: string;
        cardExpirationDate?: string;
        cardSecurityCode?: string;
        cardName?: string;
        installments?: string;
        issuerBank?: string;
        documentNumber?: string;
        emailAddress?: string;
        formTitle?: string;
      };
    };
  };
  callbacks: {
    onReady?: () => void;
    onSubmit?: (data: PaymentBrickSubmitData) => Promise<void>;
    onError?: (error: PaymentBrickError) => void;
  };
};

export type PaymentBrickSubmitData = {
  selectedPaymentMethod: string;
  formData: Record<string, any>;
};

export type PaymentBrickError = {
  type: string;
  message: string;
  field?: string;
};

export type InputSubmitContent =
  | TextInputSubmitContent
  | RecordingInputSubmitContent;
