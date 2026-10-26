import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, radius } from "../../assets/colors/colors";

type ModalCardProps = {
  visible: boolean;
  title?: string;
  headerRight?: ReactNode;
  maxWidth?: number;
  children?: ReactNode;
  footer?: ReactNode;
  // Rendered inside the Modal so nested modals stack correctly on iOS.
  overlay?: ReactNode;
};

export default function ModalCard({
  visible,
  title,
  headerRight,
  maxWidth = 440,
  children,
  footer,
  overlay,
}: ModalCardProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <Content
          title={title}
          headerRight={headerRight}
          maxWidth={maxWidth}
          footer={footer}
        >
          {children}
        </Content>
      </SafeAreaProvider>
      {overlay}
    </Modal>
  );
}

// Lives inside the Modal's own SafeAreaProvider so insets are right on every
// platform, and the card never grows past the screen: the body scrolls and the
// footer stays pinned.
function Content({
  title,
  headerRight,
  maxWidth,
  children,
  footer,
}: Pick<ModalCardProps, "title" | "headerRight" | "maxWidth" | "children" | "footer">) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: Math.max(20, insets.top + 8),
            paddingBottom: Math.max(20, insets.bottom + 8),
            paddingLeft: Math.max(20, insets.left + 8),
            paddingRight: Math.max(20, insets.right + 8),
          },
        ]}
      >
        <View style={[styles.card, { maxWidth }]}>
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              {headerRight}
            </View>
          ) : null}
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxHeight: "100%",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  title: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  body: { marginTop: 12, flexShrink: 1, flexGrow: 0 },
  footer: { marginTop: 24, gap: 10 },
});
