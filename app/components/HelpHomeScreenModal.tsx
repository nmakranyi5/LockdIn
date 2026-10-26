import Button from "../../components/ui/Button";
import HelpList from "../../components/ui/HelpList";
import ModalCard from "../../components/ui/ModalCard";

type HelpModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function HelpHomeScreenModal({
  isVisible,
  onClose,
}: HelpModalProps) {
  return (
    <ModalCard
      visible={isVisible}
      title="Welcome!"
      footer={<Button label="Continue" onPress={onClose} />}
    >
      <HelpList
        items={[
          "With LockdIn, stay on top of your tasks and get things done.",
          "Use the day strip to switch days. Tap a task to edit it, or the trash to delete.",
          "You can find this again under Settings → Help (top left).",
          "Hit the + button to create your first task and get started.",
          "Finish every task in a day to grow your 🔥 streak. Tap your avatar (top right) to see your profile.",
        ]}
      />
    </ModalCard>
  );
}
