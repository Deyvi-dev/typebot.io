import { MoreInfoTooltip } from "@/components/MoreInfoTooltip";
import { TextLink } from "@/components/TextLink";
import { TextInput } from "@/components/inputs";
import { useUser } from "@/features/account/hooks/useUser";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc";
import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { MercadoPagoCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { isNotEmpty } from "@typebot.io/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  credentialsId: string;
  onUpdate: () => void;
};

export const UpdateMercadoPagoCredentialsModalContent = ({
  credentialsId,
  onUpdate,
}: Props) => {
  const { t } = useTranslate();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);
  const { showToast } = useToast();
  const [mercadoPagoConfig, setMercadoPagoConfig] = useState<
    MercadoPagoCredentials["data"] & { name: string }
  >();

  const { data: existingCredentials } =
    trpc.credentials.getCredentials.useQuery(
      {
        credentialsId,
        workspaceId: workspace!.id,
      },
      {
        enabled: !!workspace?.id,
      },
    );

  useEffect(() => {
    if (!existingCredentials || mercadoPagoConfig) return;
    setMercadoPagoConfig({
      name: existingCredentials.name,
      live: existingCredentials.data.live,
      test: existingCredentials.data.test,
    });
  }, [existingCredentials, mercadoPagoConfig]);

  const { mutate } = trpc.credentials.updateCredentials.useMutation({
    onMutate: () => setIsUpdating(true),
    onSettled: () => setIsUpdating(false),
    onError: (err) => {
      showToast({
        description: err.message,
        status: "error",
      });
    },
    onSuccess: () => {
      onUpdate();
    },
  });

  const handleNameChange = (name: string) =>
    mercadoPagoConfig &&
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      name,
    });

  const handlePublicKeyChange = (publicKey: string) =>
    mercadoPagoConfig &&
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      live: { ...mercadoPagoConfig.live, publicKey },
    });

  const handleAccessTokenChange = (accessToken: string) =>
    mercadoPagoConfig &&
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      live: { ...mercadoPagoConfig.live, accessToken },
    });

  const handleTestPublicKeyChange = (publicKey: string) =>
    mercadoPagoConfig &&
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      test: { ...mercadoPagoConfig.test, publicKey },
    });

  const handleTestAccessTokenChange = (accessToken: string) =>
    mercadoPagoConfig &&
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      test: { ...mercadoPagoConfig.test, accessToken },
    });

  const updateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !workspace?.id || !mercadoPagoConfig) return;

    mutate({
      credentialsId,
      credentials: {
        data: {
          live: mercadoPagoConfig.live,
          test: {
            publicKey: isNotEmpty(mercadoPagoConfig.test.publicKey)
              ? mercadoPagoConfig.test.publicKey
              : undefined,
            accessToken: isNotEmpty(mercadoPagoConfig.test.accessToken)
              ? mercadoPagoConfig.test.accessToken
              : undefined,
          },
        },
        name: mercadoPagoConfig.name,
        type: "mercadopago",
        workspaceId: workspace.id,
      },
    });
  };

  if (!mercadoPagoConfig) return null;

  return (
    <ModalContent>
      <ModalHeader>
        {t("blocks.inputs.payment.settings.mercadoPagoConfig.title.label")}
      </ModalHeader>
      <ModalCloseButton />
      <form onSubmit={updateCredentials}>
        <ModalBody>
          <Stack spacing={4}>
            <TextInput
              isRequired
              label={t(
                "blocks.inputs.payment.settings.mercadoPagoConfig.accountName.label",
              )}
              defaultValue={mercadoPagoConfig.name}
              onChange={handleNameChange}
              placeholder="Typebot Mercado Pago"
              withVariableButton={false}
              debounceTimeout={0}
            />
            <Stack>
              <FormLabel>
                {t(
                  "blocks.inputs.payment.settings.mercadoPagoConfig.testKeys.label",
                )}{" "}
                <MoreInfoTooltip>
                  {t(
                    "blocks.inputs.payment.settings.mercadoPagoConfig.testKeys.infoText.label",
                  )}
                </MoreInfoTooltip>
              </FormLabel>
              <HStack>
                <TextInput
                  onChange={handleTestPublicKeyChange}
                  placeholder="TEST_PUBLIC_KEY"
                  withVariableButton={false}
                  defaultValue={mercadoPagoConfig.test.publicKey}
                  debounceTimeout={0}
                />
                <TextInput
                  onChange={handleTestAccessTokenChange}
                  placeholder="TEST_ACCESS_TOKEN"
                  withVariableButton={false}
                  defaultValue={mercadoPagoConfig.test.accessToken}
                  debounceTimeout={0}
                  type="password"
                />
              </HStack>
            </Stack>
            <Stack>
              <FormLabel>
                {t(
                  "blocks.inputs.payment.settings.mercadoPagoConfig.liveKeys.label",
                )}
              </FormLabel>
              <HStack>
                <FormControl>
                  <TextInput
                    onChange={handlePublicKeyChange}
                    placeholder="LIVE_PUBLIC_KEY"
                    withVariableButton={false}
                    defaultValue={mercadoPagoConfig.live.publicKey}
                    debounceTimeout={0}
                  />
                </FormControl>
                <FormControl>
                  <TextInput
                    onChange={handleAccessTokenChange}
                    placeholder="LIVE_ACCESS_TOKEN"
                    withVariableButton={false}
                    defaultValue={mercadoPagoConfig.live.accessToken}
                    debounceTimeout={0}
                    type="password"
                  />
                </FormControl>
              </HStack>
            </Stack>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button
            type="submit"
            colorScheme="blue"
            isDisabled={
              mercadoPagoConfig.live.accessToken === "" ||
              mercadoPagoConfig.live.publicKey === "" ||
              mercadoPagoConfig.name === ""
            }
            isLoading={isUpdating}
          >
            {t("update")}
          </Button>
          <TextLink
            href="https://www.mercadopago.com.ar/developers/es_ar/guides/additional-content/dashboard/introduction"
            isExternal
          >
            {t(
              "blocks.inputs.payment.settings.mercadoPagoConfig.findCredentials.label",
            )}
          </TextLink>
        </ModalFooter>
      </form>
    </ModalContent>
  );
};
