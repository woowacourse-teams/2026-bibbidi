import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { extractDeclaredNames, extractRequiredNames, findUndeclaredNames } from "./alloy-environment.ts";

const ALLOY_SERVICE = "alloy";

export async function main(argv: string[] = process.argv.slice(2)) {
  try {
    const [configPath, ...composePaths] = argv;
    if (!configPath || composePaths.length === 0) {
      throw new Error("사용법: alloy-environment-cli.ts <config.alloy> <compose 파일...>");
    }

    const required = extractRequiredNames(await readFile(configPath, "utf8"));
    for (const composePath of composePaths) {
      const declared = extractDeclaredNames(await readFile(composePath, "utf8"), ALLOY_SERVICE);
      const undeclared = findUndeclaredNames(required, declared);
      if (undeclared.length > 0) {
        throw new Error(`${composePath}의 ${ALLOY_SERVICE}.environment에 선언되지 않은 환경변수: ${undeclared.join(", ")}`);
      }
    }
    console.log(`Alloy 환경변수 ${required.length}개가 모두 선언되어 있습니다.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error(`::error title=Alloy 환경변수 검증 실패::${message}`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await main();
