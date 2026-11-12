import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>페이지를 찾을 수 없어요.</h1>
      <Link href="/">준비 목록으로 이동</Link>
    </main>
  );
}
