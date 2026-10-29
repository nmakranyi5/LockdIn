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
          "Switch days with the strip. Tap a task to edit it, or the bin to delete it.",
          "Tap + to add a task. You can plan ahead, but each task can only be done on its own day.",
          "Finish at least one task a day to grow your 🔥 streak. Set your daily goal on your profile (top right).",
          "Finishing a task earns XP: more for urgent ones, boosted by your streak and goal. Late starts and finishes cost 25%.",
          "Missed a task? Tap Reschedule to copy it to another day.",
          "Log glasses of water on the Water card. It doesn't affect streaks or XP.",
          "Tap the people button to add friends and compare streaks.",
          "Each morning a recap shows how yesterday went and what's on today. Reopen it from Settings.",
          "Find this again under Settings → Help (top left).",
        ]}
      />
    </ModalCard>
  );
}
