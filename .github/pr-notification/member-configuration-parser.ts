export type Member = {
  github: string;
  nickname: string;
  discordUserId?: string;
  reviewer?: boolean;
};

function isMember(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false;
  if (!("github" in value) || !("nickname" in value)) return false;
  if (typeof value.github !== "string" || typeof value.nickname !== "string") return false;
  if ("discordUserId" in value && typeof value.discordUserId !== "string") return false;
  return !("reviewer" in value) || typeof value.reviewer === "boolean";
}

export function loadMembers(value: string | undefined): Member[] {
  if (!value) throw new Error("PR_NOTIFICATION_MEMBERS_JSON 시크릿이 필요합니다.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("PR_NOTIFICATION_MEMBERS_JSON은 올바른 JSON 형식이어야 합니다.");
  }

  if (!parsed || typeof parsed !== "object" || !("members" in parsed) || !Array.isArray(parsed.members)) {
    throw new Error("PR_NOTIFICATION_MEMBERS_JSON은 members 배열을 포함해야 합니다.");
  }
  if (!parsed.members.every(isMember)) {
    throw new Error("각 구성원은 문자열 형식의 github과 nickname을 포함해야 합니다.");
  }

  return parsed.members;
}
