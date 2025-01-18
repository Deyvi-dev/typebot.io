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
import type { OpenPixCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { isNotEmpty } from "@typebot.io/lib/utils";
import type React from "react";
import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onNewCredentials: (id: string) => void;
};

export const OpenPixConfigModal = ({
  isOpen,
  onNewCredentials,
  onClose,
}: Props) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <OpenPixCreateModalContent
        onNewCredentials={onNewCredentials}
        onClose={onClose}
      />
    </Modal>
  );
};

export const OpenPixCreateModalContent = ({
  onNewCredentials,
  onClose,
}: Pick<Props, "onClose" | "onNewCredentials">) => {
  const { t } = useTranslate();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [isCreating, setIsCreating] = useState(false);
  const { showToast } = useToast();
  const [openPixConfig, setOpenPixConfig] = useState<
    OpenPixCredentials["data"] & { name: string }
  >({
    name: "",
    live: { secretKey: "" },
    test: { secretKey: "" },
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
    setOpenPixConfig({
      ...openPixConfig,
      name,
    });

  const handleSecretKeyChange = (secretKey: string) =>
    setOpenPixConfig({
      ...openPixConfig,
      live: { secretKey },
    });

  const handleTestSecretKeyChange = (secretKey: string) =>
    setOpenPixConfig({
      ...openPixConfig,
      test: { secretKey },
    });

  const createCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !workspace?.id) return;
    mutate({
      credentials: {
        data: {
          live: openPixConfig.live,
          test: {
            secretKey: isNotEmpty(openPixConfig.test.secretKey)
              ? openPixConfig.test.secretKey
              : undefined,
          },
        },
        name: openPixConfig.name,
        type: "openpix",
        workspaceId: workspace.id,
      },
    });
  };

  return (
    <ModalContent>
      <ModalHeader>
        {t("blocks.inputs.payment.settings.openPixConfig.title.label")}
      </ModalHeader>
      <ModalCloseButton />
      <form onSubmit={createCredentials}>
        <ModalBody>
          <Stack spacing={4}>
            <TextInput
              isRequired
              label={t(
                "blocks.inputs.payment.settings.openPixConfig.accountName.label",
              )}
              onChange={handleNameChange}
              placeholder="Typebot"
              withVariableButton={false}
              debounceTimeout={0}
            />
            <Stack>
              <FormLabel>
                {t(
                  "blocks.inputs.payment.settings.openPixConfig.testKeys.label",
                )}{" "}
                <MoreInfoTooltip>
                  {t(
                    "blocks.inputs.payment.settings.openPixConfig.testKeys.infoText.label",
                  )}
                </MoreInfoTooltip>
              </FormLabel>
              <HStack>
                <TextInput
                  onChange={handleTestSecretKeyChange}
                  placeholder="TEST_SECRET_KEY"
                  withVariableButton={false}
                  debounceTimeout={0}
                  type="password"
                />
              </HStack>
            </Stack>
            <Stack>
              <FormLabel>
                {t(
                  "blocks.inputs.payment.settings.openPixConfig.liveKeys.label",
                )}
              </FormLabel>
              <HStack>
                <FormControl>
                  <TextInput
                    onChange={handleSecretKeyChange}
                    placeholder="LIVE_SECRET_KEY"
                    withVariableButton={false}
                    debounceTimeout={0}
                    type="password"
                  />
                </FormControl>
              </HStack>
            </Stack>

            <Text>
              (
              {t("blocks.inputs.payment.settings.openPixConfig.findKeys.label")}{" "}
              <TextLink
                href="https://app.openpix.com.br/home/developers"
                isExternal
              >
                {t(
                  "blocks.inputs.payment.settings.openPixConfig.findKeys.here.label",
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
              openPixConfig.live.secretKey === "" || openPixConfig.name === ""
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
