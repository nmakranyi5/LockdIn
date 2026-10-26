import Button from "../../components/ui/Button";
import ModalCard from "../../components/ui/ModalCard";

type TimerModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onResume?: () => void;
  onComplete?: () => void;
};

export default function TimerModal({
  isVisible,
  onClose,
  onResume,
  onComplete,
}: TimerModalProps) {
  return (
    <ModalCard
      visible={isVisible}
      title="Pause Task"
      footer={
        <>
          <Button label="Resume" onPress={() => onResume?.()} />
          <Button
            label="Complete Task"
            variant="secondary"
            onPress={() => onComplete?.()}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </>
      }
    >
    </ModalCard>
  );
}
