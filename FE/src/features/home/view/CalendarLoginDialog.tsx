import { useHref, useLinkClickHandler } from "react-router";
import { Button } from "../../../components/button";
import { Dialog } from "../../../components/dialog";

export function CalendarLoginDialog({
  onClose,
  loginTo,
}: {
  onClose: () => void;
  loginTo: string;
}) {
  const href = useHref(loginTo);
  const navigate = useLinkClickHandler<HTMLAnchorElement>(loginTo);
  return (
    <Dialog
      open
      onClose={onClose}
      title={<Dialog.Title>로그인이 필요해요</Dialog.Title>}
      description={
        <Dialog.Description>
          일정을 추가하려면 로그인해 주세요.
          <br />
          로그인 후 캘린더에서 계속할 수 있어요.
        </Dialog.Description>
      }
      actions={
        <>
          <div>
            <Button
              size="large"
              color="dark"
              variant="weak"
              display="block"
              onClick={onClose}
            >
              취소
            </Button>
          </div>
          <div>
            <Button.Link
              size="large"
              display="block"
              href={href}
              onClick={navigate}
            >
              로그인
            </Button.Link>
          </div>
        </>
      }
    />
  );
}
