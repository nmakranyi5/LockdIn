import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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
import { normalizeUsername, usernameAvailable, USERNAME_RE } from "../friends/api";
import Button from "../ui/Button";
import { useAuth } from "./AuthProvider";

type Mode = "signIn" | "signUp";
type NameStatus = "idle" | "invalid" | "checking" | "ok" | "taken";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // After sign-up, when the account needs its email confirmed.
  const [confirming, setConfirming] = useState(false);

  const isSignUp = mode === "signUp";

  useEffect(() => {
    if (auth.linkError) setError(auth.linkError);
  }, [auth.linkError]);

  // Tell people right away whether the username is free.
  useEffect(() => {
    if (!isSignUp) return;
    const wanted = normalizeUsername(username);
    if (!USERNAME_RE.test(wanted)) {
      setNameStatus(wanted ? "invalid" : "idle");
      return;
    }
    setNameStatus("checking");
    let stale = false;
    const t = setTimeout(async () => {
      const free = await usernameAvailable(wanted);
      if (!stale) setNameStatus(free === null ? "idle" : free ? "ok" : "taken");
    }, 450);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [username, isSignUp]);

  const validate = () => {
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (isSignUp) {
      if (!USERNAME_RE.test(normalizeUsername(username)))
        return "Choose a username: 3–20 letters, numbers or underscores.";
      if (nameStatus === "taken") return "That username isn't available. Try another.";
    }
    if (password.length < 6) return "Your password needs at least 6 characters.";
    return null;
  };

  const submit = async () => {
    setNotice(null);
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const r = await auth.signUp(email, password, normalizeUsername(username));
        if (r.error) setError(r.error);
        else if (r.needsConfirmation) setConfirming(true);
      } else {
        const r = await auth.signIn(email, password);
        if (r.error) setError(r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError("Enter your email above first.");
    setError(null);
    setBusy(true);
    const r = await auth.resetPassword(email);
    setBusy(false);
    if (r.error) setError(r.error);
    else setNotice("If that email has an account, a reset link is on its way.");
  };

  const resend = async () => {
    setBusy(true);
    const r = await auth.resendConfirmation(email);
    setBusy(false);
    setNotice(r.error ?? "Sent again. Check your inbox.");
  };

  const switchMode = () => {
    setMode(isSignUp ? "signIn" : "signUp");
    setError(null);
    setNotice(null);
    setConfirming(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <View style={styles.logo}>
              <Ionicons name="lock-closed" size={30} color={colors.accent} />
            </View>
            <Text style={styles.brand}>LockdIn</Text>
            <Text style={styles.tagline}>Plan your day. Finish what you start.</Text>

            {confirming ? (
              <View style={styles.card}>
                <Ionicons name="mail-outline" size={32} color={colors.accent} />
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardText}>
                  We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.
                </Text>
                {notice && <Text style={styles.notice}>{notice}</Text>}
                <Button label="Resend email" variant="secondary" onPress={resend} />
                <Button
                  label="Back to sign in"
                  onPress={() => {
                    setMode("signIn");
                    setConfirming(false);
                    setNotice(null);
                  }}
                />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {isSignUp ? "Create your account" : "Welcome back"}
                </Text>

                <Text style={styles.label}>Email</Text>
                <View style={styles.field}>
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError(null);
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    style={styles.input}
                  />
                </View>

                {isSignUp && (
                  <>
                    <Text style={styles.label}>Username</Text>
                    <View
                      style={[
                        styles.field,
                        nameStatus === "taken" && styles.fieldBad,
                        nameStatus === "ok" && styles.fieldOk,
                      ]}
                    >
                      <Text style={styles.at}>@</Text>
                      <TextInput
                        value={username}
                        onChangeText={(t) => {
                          setUsername(t.replace(/[^a-zA-Z0-9_]/g, ""));
                          setError(null);
                        }}
                        placeholder="choose_a_username"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username-new"
                        textContentType="username"
                        maxLength={20}
                        returnKeyType="next"
                        style={styles.input}
                      />
                      {nameStatus === "ok" && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      )}
                      {nameStatus === "taken" && (
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.hint,
                        nameStatus === "taken" && { color: colors.danger },
                        nameStatus === "ok" && { color: colors.success },
                      ]}
                    >
                      {nameStatus === "checking"
                        ? "Checking…"
                        : nameStatus === "ok"
                        ? `@${normalizeUsername(username)} is available`
                        : nameStatus === "taken"
                        ? "That username isn’t available. Try another."
                        : "Friends add you with this. 3–20 letters, numbers or underscores."}
                    </Text>
                  </>
                )}

                <Text style={styles.label}>Password</Text>
                <View style={styles.field}>
                  <TextInput
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setError(null);
                    }}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    textContentType={isSignUp ? "newPassword" : "password"}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                )}
                {notice && <Text style={styles.notice}>{notice}</Text>}

                <Button
                  label={busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
                  onPress={busy ? () => {} : submit}
                  style={styles.submit}
                />

                {!isSignUp && (
                  <TouchableOpacity onPress={forgot} disabled={busy} style={styles.link}>
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!confirming && (
              <TouchableOpacity onPress={switchMode} style={styles.switch}>
                <Text style={styles.switchText}>
                  {isSignUp ? "Already have an account? " : "New here? "}
                  <Text style={styles.switchStrong}>
                    {isSignUp ? "Sign in" : "Create an account"}
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            {!confirming && (
              <View style={styles.guest}>
                <TouchableOpacity
                  onPress={auth.continueAsGuest}
                  accessibilityRole="button"
                  accessibilityLabel="Continue without an account"
                  style={styles.guestButton}
                >
                  <Text style={styles.guestText}>Continue without an account</Text>
                </TouchableOpacity>
                <Text style={styles.guestNote}>
                  Your tasks stay on this device. Make an account any time to back them up.
                </Text>
              </View>
            )}
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
  brand: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, color: colors.textPrimary },
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
  cardTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  cardText: { fontSize: 15, lineHeight: 22, color: colors.textMuted, marginBottom: 10 },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "600",
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
  at: { fontSize: 16, color: colors.textMuted, marginRight: -6 },
  fieldBad: { borderColor: colors.danger },
  fieldOk: { borderColor: colors.success },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 16,
    color: colors.textPrimary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  error: { marginTop: 10, fontSize: 14, color: colors.danger },
  notice: { marginTop: 10, fontSize: 14, color: colors.success },
  submit: { marginTop: 16 },
  link: { alignSelf: "center", paddingVertical: 12 },
  linkText: { fontSize: 14, fontWeight: "600", color: colors.accent },
  guest: { alignItems: "center", marginTop: 14, gap: 6 },
  guestButton: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  guestText: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  guestNote: { fontSize: 13, lineHeight: 18, textAlign: "center", color: colors.textMuted },
  switch: { marginTop: 18, paddingVertical: 8 },
  switchText: { fontSize: 15, color: colors.textMuted },
  switchStrong: { color: colors.accent, fontWeight: "700" },
});
