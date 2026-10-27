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
          "Finish at least one task in a day to grow your 🔥 streak. Tap your avatar (top right) to see your profile.",
          "Set a daily goal on your profile: pick at least 1 to 10 tasks in a day, or all of them, and a higher goal earns bonus XP. Finish a task (you will be asked to confirm) to earn XP: more for important and urgent ones, boosted by your streak. Starting a timer late or finishing after the deadline takes 25% off that task's XP. Watch your level fill up on your profile.",
          "Tap the people button (bottom right) to add friends by username, compare streaks and nudge each other.",
        ]}
      />
    </ModalCard>
  );
}
