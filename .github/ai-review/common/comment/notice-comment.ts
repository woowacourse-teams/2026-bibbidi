import { SUMMARY_MARKER } from "./comment-markers.ts";
import type { HeadMarker } from "./head-marker.ts";

/**
 * 리뷰를 하지 않은 이유를 알리는 요약 댓글.
 * HEAD marker를 붙이지 않으면 PR을 고친 뒤 같은 커밋에서 다시 실행할 수 있다.
 */
export class NoticeComment {
  private readonly message: string;
  private readonly headMarker: HeadMarker | undefined;

  constructor(message: string, headMarker?: HeadMarker) {
    this.message = message;
    this.headMarker = headMarker;
  }

  body() {
    return `${SUMMARY_MARKER}
${this.headMarker ? `${this.headMarker.text()}\n` : ""}## 🤖 AI Code Review

${this.message}`;
  }
}
