import { REVIEW_MARKER_PREFIX } from "./comment-markers.ts";

export class HeadMarker {
  private readonly headSha: string;

  constructor(headSha: string) {
    this.headSha = headSha;
  }

  text() {
    return `${REVIEW_MARKER_PREFIX}${this.headSha} -->`;
  }
}
