import { publicProcedure } from "@/helpers/server/trpc";
import { TRPCError } from "@trpc/server";
import type { MercadoPagoCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { decrypt } from "@typebot.io/lib/api/encryption/decrypt";
import prisma from "@typebot.io/prisma";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const createMercadoPagoPaymentSchema = z.object({
  sessionId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  payer: z.record(z.unknown()).optional(),
  formData: z.record(z.unknown()),
  credentialsId: z.string(),
  isPreview: z.boolean().optional(),
  additionalInformation: z
    .object({
      email: z.string().optional(),
      name: z.string().optional(),
      phoneNumber: z.string().optional(),
      description: z.string().optional(),
      documentType: z.string().optional(),
      documentNumber: z.string().optional(),
    })
    .optional(),
});

const getMercadoPagoCredentials = async (
  credentialsId: string,
): Promise<MercadoPagoCredentials> => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });

  if (!credentials) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid or missing MercadoPago credentials",
    });
  }

  const decryptedData = await decrypt(credentials.data, credentials.iv);
  console.log("decryptedData", decryptedData);
  return {
    type: "mercadopago",
    name: credentials.name ?? "",
    id: credentials.id,
    data: decryptedData as {
      live: {
        accessToken: string;
        publicKey: string;
      };
      test: {
        accessToken?: string;
        publicKey?: string;
      };
    },
    createdAt: credentials.createdAt,
    workspaceId: credentials.workspaceId,
    iv: credentials.iv,
  };
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
  .output(z.any())
  .mutation(async ({ input, ctx }) => {
    const { credentialsId } = input;

    const mercadoPagoKeys = await getMercadoPagoCredentials(credentialsId);
    console.log(mercadoPagoKeys);
    const isPreview = input.isPreview ?? false;
    const accessToken = isPreview
      ? mercadoPagoKeys.data.test?.accessToken
      : mercadoPagoKeys.data.live.accessToken;

    if (!accessToken) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Missing MercadoPago ${
          isPreview ? "test" : "live"
        } access token`,
      });
    }

    try {
      const payment = new Payment(new MercadoPagoConfig({ accessToken }));
      const paymentBody = input.formData!;
      console.log("paymentBody", paymentBody);
      const response = await payment.create({
        body: paymentBody,
        requestOptions: { idempotencyKey: uuidv4() },
      });

      return response;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process MercadoPago payment",
      });
    }
  });
