/** 리뷰 도중 새 커밋이 올라온 경우. 다음 실행이 이어받으므로 실패로 알리지 않는다. */
export class StaleHeadError extends Error {}
