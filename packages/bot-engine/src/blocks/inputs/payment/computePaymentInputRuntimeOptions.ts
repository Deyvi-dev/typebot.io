import { TRPCError } from "@trpc/server";
import { defaultPaymentInputOptions } from "@typebot.io/blocks-inputs/payment/constants";
import { PaymentProvider } from "@typebot.io/blocks-inputs/payment/constants";
import type {
  MercadoPagoCredentials,
  OpenPixCredentials,
  PaymentInputBlock,
  PaymentInputRuntimeOptions,
  StripeCredentials,
} from "@typebot.io/blocks-inputs/payment/schema";
import { decrypt } from "@typebot.io/lib/api/encryption/decrypt";
import prisma from "@typebot.io/prisma";
import { parseVariables } from "@typebot.io/variables/parseVariables";
import Stripe from "stripe";
import type { SessionState } from "../../../schemas/chatSession";

export const computePaymentInputRuntimeOptions =
  (state: SessionState) => (options: PaymentInputBlock["options"]) => {
    switch (options?.provider) {
      case PaymentProvider.STRIPE:
        return createStripePaymentIntent(state)(options);
      case PaymentProvider.MERCADO_PAGO:
        return createMercadoPagoPreference(state)(options);
      case PaymentProvider.OPENPIX:
        return createOpenPixPayment(state)(options);
      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported payment provider",
        });
    }
  };

const createStripePaymentIntent =
  (state: SessionState) =>
  async (
    options: PaymentInputBlock["options"],
  ): Promise<PaymentInputRuntimeOptions> => {
    const {
      resultId,
      typebot: { variables },
    } = state.typebotsQueue[0];
    const isPreview = !resultId;
    if (!options?.credentialsId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing credentialsId",
      });
    const stripeKeys = await getStripeInfo(options.credentialsId);
    if (!stripeKeys)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credentials not found",
      });
    const stripe = new Stripe(
      isPreview && stripeKeys?.test?.secretKey
        ? stripeKeys.test.secretKey
        : stripeKeys.live.secretKey,
      { apiVersion: "2024-09-30.acacia" },
    );
    const currency = options?.currency ?? defaultPaymentInputOptions.currency;
    const amount = Math.round(
      Number(parseVariables(variables)(options.amount)) *
        (isZeroDecimalCurrency(currency) ? 1 : 100),
    );
    if (isNaN(amount))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Could not parse amount, make sure your block is configured correctly",
      });
    const receiptEmail = parseVariables(variables)(
      options.additionalInformation?.email,
    );
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: receiptEmail === "" ? undefined : receiptEmail,
      description: parseVariables(variables)(
        options.additionalInformation?.description,
      ),
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Could not create payment intent",
      });

    const priceFormatter = new Intl.NumberFormat(
      options.currency === "EUR" ? "fr-FR" : undefined,
      {
        style: "currency",
        currency,
      },
    );

    return {
      paymentIntentSecret: paymentIntent.client_secret,
      publicKey:
        isPreview && stripeKeys.test?.publicKey
          ? stripeKeys.test.publicKey
          : stripeKeys.live.publicKey,
      amountLabel: priceFormatter.format(
        amount / (isZeroDecimalCurrency(currency) ? 1 : 100),
      ),
    };
  };

const createMercadoPagoPreference =
  (state: SessionState) =>
  async (
    options: PaymentInputBlock["options"],
  ): Promise<PaymentInputRuntimeOptions> => {
    const {
      resultId,
      typebot: { variables },
    } = state.typebotsQueue[0];
    const isPreview = !resultId;
    if (!options?.credentialsId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing credentialsId",
      });
    const mercadoPagoKeys = await getMercadoPagoInfo(options.credentialsId);
    if (!mercadoPagoKeys)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credentials not found",
      });

    const currency = options?.currency ?? defaultPaymentInputOptions.currency;
    const amount = Number(parseVariables(variables)(options.amount));
    if (isNaN(amount))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Could not parse amount, make sure your block is configured correctly",
      });

    const priceFormatter = new Intl.NumberFormat(
      options.currency === "EUR" ? "fr-FR" : undefined,
      {
        style: "currency",
        currency,
      },
    );

    return {
      preferenceId: "",
      publicKey:
        isPreview && mercadoPagoKeys.test?.publicKey
          ? mercadoPagoKeys.test.publicKey
          : mercadoPagoKeys.live.publicKey,
      amountLabel: priceFormatter.format(amount),
    };
  };

const getStripeInfo = async (
  credentialsId: string,
): Promise<StripeCredentials["data"] | undefined> => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });
  if (!credentials) return undefined;
  const decryptedData = (await decrypt(
    credentials.data,
    credentials.iv,
  )) as StripeCredentials["data"];
  return decryptedData;
};

const getMercadoPagoInfo = async (
  credentialsId: string,
): Promise<MercadoPagoCredentials["data"] | undefined> => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });
  if (!credentials) return undefined;
  const decryptedData = (await decrypt(
    credentials.data,
    credentials.iv,
  )) as MercadoPagoCredentials["data"];
  return decryptedData;
};

const getOpenPixInfo = async (
  credentialsId: string,
): Promise<OpenPixCredentials["data"] | undefined> => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });
  if (!credentials) return undefined;
  const decryptedData = (await decrypt(
    credentials.data,
    credentials.iv,
  )) as OpenPixCredentials["data"];
  return decryptedData;
};

const createOpenPixPayment =
  (state: SessionState) =>
  async (
    options: PaymentInputBlock["options"],
  ): Promise<PaymentInputRuntimeOptions> => {
    const {
      resultId,
      typebot: { variables },
    } = state.typebotsQueue[0];
    const isPreview = !resultId;

    if (!options?.credentialsId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing credentialsId",
      });

    const openPixKeys = await getOpenPixInfo(options.credentialsId);
    if (!openPixKeys)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credentials not found",
      });

    const currency = options?.currency ?? defaultPaymentInputOptions.currency;
    const amount = Number(parseVariables(variables)(options.amount));

    if (isNaN(amount))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Could not parse amount, make sure your block is configured correctly",
      });

    const priceFormatter = new Intl.NumberFormat(
      options.currency === "EUR" ? "fr-FR" : undefined,
      {
        style: "currency",
        currency,
      },
    );

    return {
      publicKey:
        isPreview && openPixKeys.test?.secretKey
          ? openPixKeys.test.secretKey
          : openPixKeys.live.secretKey,
      amountLabel: priceFormatter.format(amount),
    };
  };

// https://stripe.com/docs/currencies#zero-decimal
const isZeroDecimalCurrency = (currency: string) =>
  [
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
  ].includes(currency);
