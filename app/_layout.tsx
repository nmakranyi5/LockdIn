import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../assets/colors/colors";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
