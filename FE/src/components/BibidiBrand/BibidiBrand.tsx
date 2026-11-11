import "./BibidiBrand.css";

export function BibidiBrand() {
  return (
    <>
      <span aria-hidden="true" className="bibidi-brand__logo-clip">
        <img
          alt=""
          className="bibidi-brand__logo"
          draggable={false}
          src="/brand/bibbidi-logo.webp"
        />
      </span>
      <span className="bibidi-brand__name">bibbidi</span>
    </>
  );
}
