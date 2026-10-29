import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../../assets/colors/colors";
import Button from "../ui/Button";
import { useAuth } from "./AuthProvider";

// Shown after following the link in a "reset your password" email.
export default function ResetPasswordScreen() {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < 6) return setError("Your password needs at least 6 characters.");
    if (password !== again) return setError("The two passwords don't match.");
    setError(null);
    setBusy(true);
    try {
      const r = await auth.updatePassword(password);
      if (r.error) setError(r.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <View style={styles.logo}>
              <Ionicons name="key-outline" size={30} color={colors.accent} />
            </View>
            <Text style={styles.brand}>New password</Text>
            <Text style={styles.tagline}>Choose a new password for {auth.session?.user.email ?? "your account"}.</Text>

            <View style={styles.card}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.field}>
                <TextInput
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    setError(null);
                  }}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  style={styles.input}
                />
                <TouchableOpacity
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={show ? "Hide password" : "Show password"}
                  onPress={() => setShow((v) => !v)}
                >
                  <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Type it again</Text>
              <View style={styles.field}>
                <TextInput
                  value={again}
                  onChangeText={(t) => {
                    setAgain(t);
                    setError(null);
                  }}
                  placeholder="Repeat the new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={styles.input}
                />
              </View>

              {error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}

              <Button
                label={busy ? "Please wait…" : "Save new password"}
                onPress={busy ? () => {} : submit}
                style={styles.submit}
              />
              <TouchableOpacity onPress={() => auth.cancelRecovery()} style={styles.link}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  column: { width: "100%", maxWidth: 420, alignItems: "center" },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    marginBottom: 14,
  },
  brand: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, color: colors.textPrimary },
  tagline: { fontSize: 15, color: colors.textMuted, marginTop: 4, marginBottom: 24, textAlign: "center" },
  card: {
    width: "100%",
    padding: 22,
    gap: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  error: { marginTop: 8, fontSize: 14, color: colors.danger },
  submit: { marginTop: 16 },
  link: { alignSelf: "center", paddingVertical: 12 },
  linkText: { fontSize: 14, fontWeight: "600", color: colors.accent },
});
