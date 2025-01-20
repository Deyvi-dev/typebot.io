import { publicProcedure } from "@/helpers/server/trpc";
import { TRPCError } from "@trpc/server";
import type { OpenPixCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { decrypt } from "@typebot.io/lib/api/encryption/decrypt";
import prisma from "@typebot.io/prisma";
import ky from "ky";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const OPENPIX_API_BASE_URL = "https://api.openpix.com.br/api/v1/charge";
const OPENPIX_PAYMENT_STATUS_URL = "https://api.openpix.com.br/api/v1/charge";
const CONVERSION_FACTOR = 100;

const openPixPaymentInputSchema = z.object({
  credentialsId: z.string(),
  amount: z.number().positive(),
  correlationId: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      taxID: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
});

const openPixPaymentOutputSchema = z.object({
  success: z.boolean(),
  charge: z.object({
    id: z.string(),
    qrCodeUrl: z.string(),
    paymentLinkUrl: z.string(),
    status: z.string(),
    brCode: z.string().optional(),
  }),
});

const openPixPaymentStatusInputSchema = z.object({
  credentialsId: z.string(),
  correlationId: z.string(),
});

const openPixPaymentStatusOutputSchema = z.object({
  success: z.boolean(),
  status: z.string(),
  paidAmount: z.number().optional(),
});

const fetchOpenPixCredentials = async (
  credentialsId: string,
): Promise<OpenPixCredentials> => {
  const credentials = await prisma.credentials.findUnique({
    where: { id: credentialsId },
  });

  if (!credentials) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid or missing OpenPix credentials",
    });
  }

  const decryptedData = await decrypt(credentials.data, credentials.iv);
  return {
    name: credentials.name ?? "",
    type: "openpix",
    id: credentials.id,
    data: decryptedData as {
      live: { secretKey: string };
      test: { secretKey?: string };
    },
    createdAt: credentials.createdAt,
    workspaceId: credentials.workspaceId,
    iv: credentials.iv,
  };
};

export const openPixPayment = publicProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/v1/payments/openpix",
      tags: ["Payments"],
      summary: "Create OpenPix payment",
      description: "Create a new payment using OpenPix payment method",
    },
  })
  .input(openPixPaymentInputSchema)
  .output(openPixPaymentOutputSchema)
  .mutation(async ({ input }) => {
    const credentials = await fetchOpenPixCredentials(input.credentialsId);
    const correlationId = input.correlationId ?? uuidv4();
    console.log("correlationId, credentials", correlationId, credentials);
    try {
      const { charge } = await ky
        .post(OPENPIX_API_BASE_URL, {
          headers: {
            "Content-Type": "application/json",
            Authorization: credentials.data.live.secretKey,
          },
          json: {
            correlationID: correlationId,
            value: Math.round(input.amount * CONVERSION_FACTOR),
          },
        })
        .json<{
          charge: {
            correlationID: string;
            qrCodeImage: string;
            paymentLinkUrl: string;
            status: string;
            brCode?: string;
          };
        }>();

      return {
        success: true,
        charge: {
          id: charge.correlationID,
          qrCodeUrl: charge.qrCodeImage,
          paymentLinkUrl: charge.paymentLinkUrl,
          status: charge.status,
          brCode: charge.brCode,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Payment processing failed",
      });
    }
  });

export const openPixPaymentStatus = publicProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/v1/payments/openpix/status",
      tags: ["Payments"],
      summary: "Check OpenPix payment status",
      description: "Check the status of an OpenPix payment",
    },
  })
  .input(openPixPaymentStatusInputSchema)
  .output(openPixPaymentStatusOutputSchema)
  .mutation(async ({ input }) => {
    const credentials = await fetchOpenPixCredentials(input.credentialsId);

    try {
      const response = await ky
        .get(`${OPENPIX_PAYMENT_STATUS_URL}/${input.correlationId}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: credentials.data.live.secretKey,
          },
        })
        .json<{
          charge: {
            status: string;
            value?: number;
          };
        }>();
      return {
        success: true,
        status: response.charge.status,
        paidAmount: response.charge.value
          ? response.charge.value / CONVERSION_FACTOR
          : undefined,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Payment status check failed",
      });
    }
  });
