export const REVIEW_MODEL = "gpt-5.6-luna";
export const MAX_INLINE_COMMENTS = 20;
export const MAX_DIFF_CHARACTERS = 180_000;
export const MAX_OUTPUT_TOKENS = 8_000;

export const REVIEW_STAGES = [
  {
    id: "language",
    reasoningEffort: "none",
    focus:
      "언어 문법, 타입 안정성, null 처리, 자원 정리, 오류 처리 누락과 저장소 컨벤션 위반을 검토한다.",
  },
  {
    id: "framework",
    reasoningEffort: "low",
    focus:
      "프레임워크와 인프라 관점에서 트랜잭션, 영속성, HTTP 계약, React 상태 흐름, 빌드와 배포 설정의 문제를 검토한다.",
  },
  {
    id: "domain-security",
    reasoningEffort: "medium",
    focus:
      "도메인 규칙, 동시성, 인증과 인가, 민감정보 노출, 데이터 무결성, 장애 복구와 경계 조건을 검토한다.",
  },
];

export const FINAL_STAGE = {
  id: "final-verification",
  reasoningEffort: "medium",
  focus:
    "앞선 검토 결과를 원본 diff와 다시 대조한다. 오탐과 중복을 제거하고, 실제 변경 줄에 근거한 재현 가능하고 구체적인 지적만 남긴다.",
};
