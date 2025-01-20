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
import type { OpenPixCredentials } from "@typebot.io/blocks-inputs/payment/schema";
import { isNotEmpty } from "@typebot.io/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  credentialsId: string;
  onUpdate: () => void;
};

export const UpdateOpenPixCredentialsModalContent = ({
  credentialsId,
  onUpdate,
}: Props) => {
  const { t } = useTranslate();
  const { user } = useUser();
  const { workspace } = useWorkspace();
  const [isUpdating, setIsUpdating] = useState(false);
  const { showToast } = useToast();
  const [openPixConfig, setOpenPixConfig] = useState<
    OpenPixCredentials["data"] & { name: string }
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
    if (!existingCredentials || openPixConfig) return;
    setOpenPixConfig({
      name: existingCredentials.name,
      live: existingCredentials.data.live,
      test: existingCredentials.data.test,
    });
  }, [existingCredentials, openPixConfig]);

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
    openPixConfig &&
    setOpenPixConfig({
      ...openPixConfig,
      name,
    });

  const handleSecretKeyChange = (secretKey: string) =>
    openPixConfig &&
    setOpenPixConfig({
      ...openPixConfig,
      live: { ...openPixConfig.live, secretKey },
    });

  const handleTestSecretKeyChange = (secretKey: string) =>
    openPixConfig &&
    setOpenPixConfig({
      ...openPixConfig,
      test: { ...openPixConfig.test, secretKey },
    });

  const updateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !workspace?.id || !openPixConfig) return;

    mutate({
      credentialsId,
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

  if (!openPixConfig) return null;

  return (
    <ModalContent>
      <ModalHeader>
        {t("blocks.inputs.payment.settings.openPixConfig.title.label")}
      </ModalHeader>
      <ModalCloseButton />
      <form onSubmit={updateCredentials}>
        <ModalBody>
          <Stack spacing={4}>
            <TextInput
              isRequired
              label={t(
                "blocks.inputs.payment.settings.openPixConfig.accountName.label",
              )}
              defaultValue={openPixConfig.name}
              onChange={handleNameChange}
              placeholder="Typebot OpenPix"
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
                  defaultValue={openPixConfig.test.secretKey}
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
                    defaultValue={openPixConfig.live.secretKey}
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
            isLoading={isUpdating}
          >
            {t("update")}
          </Button>
        </ModalFooter>
      </form>
    </ModalContent>
  );
};
