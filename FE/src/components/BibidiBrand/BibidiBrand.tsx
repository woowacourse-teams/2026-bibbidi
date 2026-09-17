import bibidiLogo from "../../assets/bibbidi-logo.png";
import "./BibidiBrand.css";

export function BibidiBrand() {
  return (
    <>
      <span aria-hidden="true" className="bibidi-brand__logo-clip">
        <img alt="" className="bibidi-brand__logo" src={bibidiLogo} />
      </span>
      <span className="bibidi-brand__name">비비디</span>
    </>
  );
}
