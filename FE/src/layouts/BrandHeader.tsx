import "./BrandHeader.css";
import { PageContainer } from "../components/page-container";
import { HeaderBrandLink } from "./HeaderBrandLink";

export function BrandHeader() {
  return (
    <header className="brand-header">
      <PageContainer width="wide" className="brand-header__inner">
        <HeaderBrandLink to="/" />
      </PageContainer>
    </header>
  );
}
