import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../../assets/colors/colors";
import Button from "../../components/ui/Button";
import ModalCard from "../../components/ui/ModalCard";
import type { SyncStatus } from "../../components/sync/useSync";
import ConfirmModal from "./ConfirmModal";
import HelpHomeScreenModal from "./HelpHomeScreenModal";

export type AccountInfo = {
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  pending: number;
  nudgesEnabled: boolean;
  onToggleNudges: (enabled: boolean) => Promise<void>;
  onSyncNow: () => void;
  onSignOut: () => Promise<void>;
  // Resolves to an error message, or undefined on success.
  onDeleteAccount: () => Promise<string | undefined>;
};

type SettingsModalProps = {
  isVisible: boolean;
  onClose: () => void;
  // Present only when the app is connected to Supabase.
  account?: AccountInfo;
  // Developer hint: no Supabase keys were found, so there is no sign-in.
  localOnly?: boolean;
};

function ago(ms: number | null) {
  if (!ms) return "Not synced yet";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 10) return "Synced just now";
  if (s < 60) return `Synced ${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `Synced ${m} min ago`;
  return `Synced ${Math.round(m / 60)} h ago`;
}

export default function SettingsModal({
  isVisible,
  onClose,
  account,
  localOnly,
}: SettingsModalProps) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [confirm, setConfirm] = useState<"signOut" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sync = account && {
    syncing: account.status === "syncing",
    failed: account.status === "error",
  };
  const dot = sync?.failed ? colors.danger : sync?.syncing ? colors.warning : colors.success;
  const line = !account
    ? ""
    : sync?.syncing
    ? "Syncing…"
    : sync?.failed
    ? `Couldn't sync${account.pending > 0 ? ` (${account.pending} waiting)` : ""}. Will retry automatically.`
    : account.pending > 0
    ? `${account.pending} change${account.pending === 1 ? "" : "s"} waiting to sync`
    : ago(account.lastSyncedAt);

  return (
    <ModalCard
      visible={isVisible}
      title="Settings"
      footer={<Button label="Done" onPress={onClose} />}
      // Rendered inside this modal so iOS can present them on top.
      overlay={
        <>
          <HelpHomeScreenModal
            isVisible={helpVisible}
            onClose={() => setHelpVisible(false)}
          />
          <ConfirmModal
            visible={confirm === "signOut"}
            title="Sign out?"
            message={
              account && account.pending > 0
                ? `You have ${account.pending} change${account.pending === 1 ? "" : "s"} that haven't synced yet. They'll be lost if you sign out.`
                : "Your tasks are saved to your account and will be here when you sign back in."
            }
            confirmText={busy ? "Signing out…" : "Sign out"}
            onCancel={() => setConfirm(null)}
            onConfirm={async () => {
              setBusy(true);
              try {
                await account?.onSignOut();
              } finally {
                setBusy(false);
                setConfirm(null);
              }
            }}
          />
          <ConfirmModal
            visible={confirm === "delete"}
            title="Delete account?"
            message={
              deleteError ??
              "This permanently deletes your account, tasks, streak and history. This can't be undone."
            }
            confirmText={busy ? "Deleting…" : "Delete account"}
            onCancel={() => {
              setConfirm(null);
              setDeleteError(null);
            }}
            onConfirm={async () => {
              setBusy(true);
              const err = await account?.onDeleteAccount();
              setBusy(false);
              if (err) setDeleteError(err);
              else setConfirm(null);
            }}
          />
        </>
      }
    >
      {localOnly && !account && (
        <View style={styles.devNote}>
          <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.devNoteText}>
            {__DEV__
              ? "Supabase is not configured, so there is no sign-in and data stays on this device. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file, then restart with npx expo start -c."
              : "This build was made without the backend keys, so there is no sign-in and data stays on this device. Rebuild it with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY set (see supabase/README.md)."}
          </Text>
        </View>
      )}

      {account && (
        <View style={styles.account}>
          <View style={styles.accountTop}>
            <View style={styles.iconWrap}>
              <Ionicons name="person-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowSub}>Signed in as</Text>
              <Text style={styles.email} numberOfLines={1}>
                {account.email ?? "your account"}
              </Text>
            </View>
          </View>
          <View style={styles.syncRow}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={styles.syncText} numberOfLines={2}>
              {line}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Sync now"
              hitSlop={8}
              disabled={sync?.syncing}
              onPress={account.onSyncNow}
            >
              <Ionicons
                name="refresh"
                size={20}
                color={sync?.syncing ? colors.textMuted : colors.accent}
              />
            </TouchableOpacity>
          </View>
          {sync?.failed && account.error ? (
            <Text style={styles.errorText} numberOfLines={3}>
              {account.error}
            </Text>
          ) : null}
        </View>
      )}

      {account && (
        <View style={[styles.row, styles.rowBottomGap]}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications-outline" size={21} color={colors.accent} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Friend nudges</Text>
            <Text style={styles.rowSub}>Let friends nudge you to finish your day</Text>
          </View>
          <Switch
            accessibilityLabel="Friend nudges"
            value={account.nudgesEnabled}
            onValueChange={(v) => {
              account.onToggleNudges(v).catch(() => {});
            }}
            trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
          />
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Help"
        style={styles.row}
        onPress={() => setHelpVisible(true)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="help-circle-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Help</Text>
          <Text style={styles.rowSub}>How LockdIn works</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {account && (
        <>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={[styles.row, styles.rowGap]}
            onPress={() => setConfirm("signOut")}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="log-out-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Sign out</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            style={[styles.row, styles.rowGap, styles.rowDanger]}
            onPress={() => {
              setDeleteError(null);
              setConfirm("delete");
            }}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.danger }]}>Delete account</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  devNote: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  devNoteText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, color: colors.textPrimary },
  account: {
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  email: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { flex: 1, minWidth: 0, fontSize: 13, color: colors.textMuted },
  errorText: { fontSize: 12, color: colors.danger },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowGap: { marginTop: 10 },
  rowBottomGap: { marginBottom: 10 },
  rowDanger: { borderColor: colors.dangerSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
});
