import "./BrandHeader.css";
import { HeaderBrandLink } from "./HeaderBrandLink";

export function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="service-page-container brand-header__inner">
        <HeaderBrandLink to="/" />
      </div>
    </header>
  );
}
