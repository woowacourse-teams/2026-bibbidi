import { ChecklistFeature } from "../features/checklist";
import "./ChecklistPage.css";

export function ChecklistPage() {
  return (
    <div className="checklist-page">
      <main aria-label="체크리스트" className="checklist-page__content">
        <ChecklistFeature />
      </main>
    </div>
  );
}
