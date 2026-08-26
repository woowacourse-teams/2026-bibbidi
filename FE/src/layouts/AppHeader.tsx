import { ReactNode } from "react";

import "./AppHeader.css";

interface AppHeaderProps {
  homeLink: ReactNode;
}

export function AppHeader({ homeLink }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__left">
          {homeLink}

          <nav aria-label="주요 메뉴" className="app-header__navigation">
            <span aria-disabled="true" className="app-header__navigation-item">
              체크리스트
            </span>
            <span aria-disabled="true" className="app-header__navigation-item">
              준비 목록
            </span>
          </nav>
        </div>

        <span aria-label="현재 사용자 나" className="app-header__user">
          나
        </span>
      </div>
    </header>
  );
}
