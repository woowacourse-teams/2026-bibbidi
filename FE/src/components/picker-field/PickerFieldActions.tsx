import { Button } from "../button";
import { BottomSheet } from "../bottom-sheet";

export function PickerFieldActions({
  mobile,
  clearable,
  disabled,
  onClear,
  onConfirm,
}: {
  mobile: boolean;
  clearable: boolean;
  disabled: boolean;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const size = mobile ? "large" : "medium";
  const Confirm = mobile ? BottomSheet.CTA : Button;
  const confirm = (
    <Confirm size={size} disabled={disabled} onClick={onConfirm}>
      확인
    </Confirm>
  );
  if (!clearable) return confirm;
  const clear = (
    <Button
      size={size}
      disabled={disabled}
      color="dark"
      variant="weak"
      onClick={onClear}
    >
      시간 지우기
    </Button>
  );
  return mobile ? (
    <BottomSheet.DoubleCTA leftButton={clear} rightButton={confirm} />
  ) : (
    <>
      {clear}
      {confirm}
    </>
  );
}
