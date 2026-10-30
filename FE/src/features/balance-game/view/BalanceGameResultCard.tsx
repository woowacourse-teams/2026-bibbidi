import { useState } from "react";
import type { BalanceGameResult } from "../model/balanceGame";
import "./BalanceGameResultCard.css";

export function BalanceGameResultCard({
  result,
}: {
  result: BalanceGameResult;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!result.imageUrl || imageFailed) return null;

  return (
    <div className="balance-result-card">
      <img
        className="balance-result-card__image"
        src={result.imageUrl}
        alt={result.name}
        draggable={false}
        onError={() => setImageFailed(true)}
      />
    </div>
  );
}
