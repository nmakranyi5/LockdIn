import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { colors, radius } from "../../assets/colors/colors";

type ModalCardProps = {
  visible: boolean;
  title?: string;
  headerRight?: ReactNode;
  maxWidth?: number;
  scroll?: boolean;
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
  scroll,
  children,
  footer,
  overlay,
}: ModalCardProps) {
  const { height } = useWindowDimensions();
  const body = scroll ? (
    <ScrollView
      style={{ maxHeight: height * 0.58 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.backdrop}>
          <View style={[styles.card, { maxWidth }]}>
            {title ? (
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {headerRight}
              </View>
            ) : null}
            <View style={styles.body}>{body}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      {overlay}
    </Modal>
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
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  body: { marginTop: 12 },
  footer: { marginTop: 24, gap: 10 },
});
