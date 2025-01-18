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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { MercadoPagoCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { isNotEmpty } from "@typebot.io/lib/utils";
import type React from "react";
import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onNewCredentials: (id: string) => void;
};

export const MercadoPagoConfigModal = ({
  isOpen,
  onNewCredentials,
  onClose,
}: Props) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <MercadoPagoCreateModalContent
        onNewCredentials={onNewCredentials}
        onClose={onClose}
      />
    </Modal>
  );
};

export const MercadoPagoCreateModalContent = ({
  onNewCredentials,
  onClose,
}: Pick<Props, "onClose" | "onNewCredentials">) => {
  const { t } = useTranslate();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToast();
  const [mercadoPagoConfig, setMercadoPagoConfig] = useState<
    MercadoPagoCredentials["data"] & { name: string }
  >({
    name: "",
    live: {
      accessToken: "",
      publicKey: "",
    },
    test: {
      accessToken: "",
      publicKey: "",
    },
  });
  const {
    credentials: {
      listCredentials: { refetch: refetchCredentials },
    },
  } = trpc.useContext();
  const { mutate } = trpc.credentials.createCredentials.useMutation({
    onMutate: () => setIsCreating(true),
    onSettled: () => setIsCreating(false),
    onError: (err) => {
      showToast({
        description: err.message,
        status: "error",
      });
    },
    onSuccess: (data) => {
      refetchCredentials();
      onNewCredentials(data.credentialsId);
      onClose();
    },
  });

  const handleNameChange = (name: string) =>
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      name,
    });

  const handlePublicKeyChange = (publicKey: string) =>
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      live: { ...mercadoPagoConfig.live, publicKey },
    });

  const handleAccessTokenChange = (accessToken: string) =>
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      live: { ...mercadoPagoConfig.live, accessToken },
    });

  const handleTestPublicKeyChange = (publicKey: string) =>
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      test: { ...mercadoPagoConfig.test, publicKey },
    });

  const handleTestAccessTokenChange = (accessToken: string) =>
    setMercadoPagoConfig({
      ...mercadoPagoConfig,
      test: { ...mercadoPagoConfig.test, accessToken },
    });

  const createCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !workspace?.id) return;
    mutate({
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
        type: "mercadopago" as const,
        workspaceId: workspace.id,
      },
    });
  };

  return (
    <ModalContent>
      <ModalHeader>
        {t("blocks.inputs.payment.settings.mercadoPagoConfig.title.label")}
      </ModalHeader>
      <ModalCloseButton />
      <form onSubmit={createCredentials}>
        <ModalBody>
          <Stack spacing={4}>
            <TextInput
              isRequired
              label={t(
                "blocks.inputs.payment.settings.mercadoPagoConfig.accountName.label",
              )}
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
                  debounceTimeout={0}
                />
                <TextInput
                  onChange={handleTestAccessTokenChange}
                  placeholder="TEST_ACCESS_TOKEN"
                  withVariableButton={false}
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
                    debounceTimeout={0}
                  />
                </FormControl>
                <FormControl>
                  <TextInput
                    onChange={handleAccessTokenChange}
                    placeholder="LIVE_ACCESS_TOKEN"
                    withVariableButton={false}
                    debounceTimeout={0}
                    type="password"
                  />
                </FormControl>
              </HStack>
            </Stack>

            <Text>
              (
              {t(
                "blocks.inputs.payment.settings.mercadoPagoConfig.findKeys.label",
              )}{" "}
              <TextLink
                href="https://www.mercadopago.com.br/developers/panel"
                isExternal
              >
                {t(
                  "blocks.inputs.payment.settings.mercadoPagoConfig.findKeys.here.label",
                )}
              </TextLink>
              )
            </Text>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button
            type="submit"
            colorScheme="blue"
            isDisabled={
              mercadoPagoConfig.live.publicKey === "" ||
              mercadoPagoConfig.name === "" ||
              mercadoPagoConfig.live.accessToken === ""
            }
            isLoading={isCreating}
          >
            {t("connect")}
          </Button>
        </ModalFooter>
      </form>
    </ModalContent>
  );
};
