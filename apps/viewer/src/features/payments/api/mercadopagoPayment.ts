import { publicProcedure } from "@/helpers/server/trpc";
import { TRPCError } from "@trpc/server";
import type { mercadoPagoCredentialsSchema } from "@typebot.io/blocks-inputs/payment/schema";
import { decrypt } from "@typebot.io/lib/api/encryption/decrypt";
import prisma from "@typebot.io/prisma";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

type MercadoPagoCredentials = z.infer<typeof mercadoPagoCredentialsSchema>;

const PAYMENT_METHODS = {
  bank_transfer: "bank_transfer",
  ticket: "ticket",
  debit_card: "debit_card",
  credit_card: "credit_card",
  onboarding_credits: "onboarding_credits",
  wallet_purchase: "wallet_purchase",
} as const;

type PaymentMethodType = keyof typeof PAYMENT_METHODS;

const createMercadoPagoPaymentSchema = z.object({
  sessionId: z.string(),
  paymentMethodId: z.enum(
    Object.keys(PAYMENT_METHODS) as [PaymentMethodType, ...PaymentMethodType[]],
  ),
  formData: z.record(z.unknown()),
  amount: z.number(),
  currency: z.string(),
  credentialsId: z.string(),
  additionalInformation: z
    .object({
      email: z.string(),
      name: z.string().optional(),
      phoneNumber: z.string().optional(),
      description: z.string().optional(),
      documentType: z.string().optional(),
      documentNumber: z.string().optional(),
    })
    .optional(),
});

const paymentResponseSchema = z.object({
  status: z.string(),
  id: z.number().optional(),
  point_of_interaction: z
    .object({
      transaction_data: z
        .object({
          qr_code: z.string().optional(),
          qr_code_base64: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  message: z.string().optional(),
});

const getMercadoPagoCredentials = async (credentialsId: string) => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });
  if (!credentials) return null;

  try {
    return await decrypt(credentials.data, credentials.iv);
  } catch (error) {
    return null;
  }
};

const preparePaymentData = (
  {
    sessionId,
    amount,
    additionalInformation,
    paymentMethodId,
    formData,
  }: z.infer<typeof createMercadoPagoPaymentSchema>,
  isPreview: boolean,
) => {
  if (!additionalInformation?.email) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Email is required for MercadoPago payment",
    });
  }

  const paymentData: any = {
    transaction_amount: amount,
    description:
      additionalInformation.description || `Payment via ${paymentMethodId}`,
    payment_method_id: paymentMethodId,
    installments: 1,
    issuer_id: 310,
    payer: {
      email: additionalInformation.email,
      identification: {
        number: additionalInformation.documentNumber || "12345678909",
        type: additionalInformation.documentType || "CPF",
      },
    },
  };

  if (paymentMethodId === "credit_card" && formData?.token) {
    paymentData.token = formData.token;
  }

  if (sessionId) {
    paymentData.metadata = {
      sessionId,
      environment: isPreview ? "test" : "production",
    };
  }

  if (formData) {
    Object.keys(formData).forEach((key) => {
      if (!paymentData[key]) {
        paymentData[key] = formData[key];
      }
    });
  }

  return paymentData;
};

export const mercadoPagoPayment = publicProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/v1/payments/mercadopago",
      tags: ["Payments"],
      summary: "Create MercadoPago payment",
      description: "Create a new payment using MercadoPago payment brick",
    },
  })
  .input(createMercadoPagoPaymentSchema)
  .output(paymentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { credentialsId, additionalInformation } = input;

    if (!credentialsId || !additionalInformation?.email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: !credentialsId
          ? "Missing MercadoPago credentials"
          : "Email is required for payment",
      });
    }

    const mercadoPagoKeys = await getMercadoPagoCredentials(credentialsId);
    if (!mercadoPagoKeys) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "MercadoPago credentials not found",
      });
    }

    const isPreview = ctx.isPreview ?? false;
    const accessToken = isPreview
      ? mercadoPagoKeys.test?.accessToken
      : mercadoPagoKeys.live?.accessToken;

    if (!accessToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Missing MercadoPago ${isPreview ? "test" : "live"} access token`,
      });
    }

    try {
      const payment = new Payment(new MercadoPagoConfig({ accessToken }));
      const paymentBody = preparePaymentData(input, isPreview);

      const response = await payment.create({
        body: paymentBody,
        requestOptions: { idempotencyKey: uuidv4() },
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        const errorDetails = JSON.parse(JSON.stringify(error));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `MercadoPago Payment Error: ${errorDetails.message || "Unknown error"}`,
          cause: errorDetails,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process MercadoPago payment",
      });
    }
  });
