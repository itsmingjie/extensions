import {
  ActionPanel,
  Action,
  showToast,
  Toast,
  getPreferenceValues,
  List,
  Icon,
  launchCommand,
  LaunchType,
  Color,
  Keyboard,
  confirmAlert,
  Alert,
} from "@raycast/api";
import { getApiClient, getProfileName } from "./libs/api";
import { DomainListItem } from "./types/nextdns";
import { useEffect, useState } from "react";
import { showFailureToast, useCachedState } from "@raycast/utils";

type AllowlistStore = Record<string, boolean>;

export default function Command() {
  const [profileName, setProfileName] = useState<string>("Loading...");
  const [allowlist, setAllowlist] = useCachedState<AllowlistStore | undefined>("allow-list");

  const preferences = getPreferenceValues<Preferences>();

  const endpoint = `/profiles/${preferences.nextdns_profile_id}/allowlist`;
  const api = getApiClient();

  const handleSwitch = async (id: string, active: boolean) => {
    const idHex = Buffer.from(id).toString("hex");
    const patchEndpoint = `${endpoint}/hex:${idHex}`;

    const { status } = await api.patch(patchEndpoint, {
      active,
    });

    if (status === 204) {
      showToast({
        style: Toast.Style.Success,
        title: "Success",
        message: `Domain ${id} has been ${active ? "activated" : "deactivated"}`,
      });

      setAllowlist({ ...allowlist, [id]: active });
    } else {
      showToast({
        style: Toast.Style.Failure,
        title: "Something went wrong",
        message: `Please try again`,
      });
    }
  };

  const handleRemove = async (id: string) => {
    await confirmAlert({
      title: "Remove item",
      icon: Icon.Trash,
      message: `Are you sure you want to remove ${id}?`,
      rememberUserChoice: true,
      primaryAction: {
        title: "Remove",
        style: Alert.ActionStyle.Destructive,
        onAction: async () => {
          const idHex = Buffer.from(id).toString("hex");
          const deleteEndpoint = `${endpoint}/hex:${idHex}`;

          const { status } = await api.delete(deleteEndpoint);
          if (status === 204) {
            showToast({
              style: Toast.Style.Success,
              title: "Success",
              message: `Domain ${id} has been removed from the allowlist`,
            });

            if (allowlist) {
              const { [id]: _, ...rest } = allowlist; // eslint-disable-line @typescript-eslint/no-unused-vars
              setAllowlist(rest);
            }
          } else {
            showToast({
              style: Toast.Style.Failure,
              title: "Something went wrong",
              message: `Please try again`,
            });
          }
        },
      },
    });
  };

  useEffect(() => {
    (async () => {
      setProfileName(await getProfileName());

      await api.get(endpoint).then((response) => {
        if (response.status === 200) {
          const allowlist = response.data.data as DomainListItem[];
          setAllowlist(allowlist.map((item) => ({ [item.id]: item.active })).reduce((a, b) => ({ ...a, ...b }), {}));
        } else {
          showToast({
            style: Toast.Style.Failure,
            title: "Error",
            message: "Could not fetch allowlist",
          });
        }
      });
    })();
  }, []);

  return (
    <List searchBarPlaceholder={`Search allowlist of ${profileName} (${preferences.nextdns_profile_id})`}>
      {allowlist === undefined && <List.EmptyView title="Loading..." />}

      {allowlist && Object.keys(allowlist).length === 0 && (
        <List.EmptyView
          title="No domains in allowlist"
          actions={
            <ActionPanel>
              <Action
                title="Add Domain to Allowlist"
                icon={Icon.PlusCircle}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                onAction={async () => {
                  try {
                    launchCommand({ name: "add-allowlist", type: LaunchType.UserInitiated });
                  } catch (error) {
                    showFailureToast(error);
                  }
                }}
              />
            </ActionPanel>
          }
        />
      )}

      {allowlist &&
        Object.keys(allowlist).length > 0 &&
        Object.entries(allowlist).map(([id, active]) => (
          <List.Item
            id={id}
            key={id}
            title={`*.${id}`}
            icon={
              active
                ? { source: Icon.CheckCircle, tintColor: Color.Green }
                : { source: Icon.Circle, tintColor: Color.SecondaryText }
            }
            actions={
              <ActionPanel title={`Manage ${id}`}>
                <ActionPanel.Section>
                  {active && (
                    <Action
                      title="Deactivate Domain"
                      icon={Icon.XMarkCircle}
                      onAction={() => handleSwitch(id, false)}
                    />
                  )}
                  {!active && (
                    <Action title="Activate Domain" icon={Icon.CheckCircle} onAction={() => handleSwitch(id, true)} />
                  )}
                  <Action
                    title="Remove Domain"
                    icon={Icon.Trash}
                    onAction={() => handleRemove(id)}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    style={Action.Style.Destructive}
                  />
                </ActionPanel.Section>

                <Action
                  title="Add Domain to Allowlist"
                  icon={Icon.PlusCircle}
                  shortcut={{ modifiers: ["cmd"], key: "n" }}
                  onAction={() => {
                    launchCommand({ name: "add-allowlist", type: LaunchType.UserInitiated });
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
    </List>
  );
}
