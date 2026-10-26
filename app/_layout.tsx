import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../assets/colors/colors";
import { AuthProvider } from "../components/auth/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AuthProvider>
  );
}
