import { pathToFileURL } from "node:url";
import { GitHubApi } from "../github/github-api.ts";
import { RetryingHttp } from "../github/retrying-http.ts";
import { WorkflowFailureAlert } from "./workflow-failure-alert.ts";

/** workflow_run 이벤트로 실행되어 실패한 워크플로를 Discord로 알린다. */
class WorkflowAlertCommand {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  async run() {
    const github = new GitHubApi(
      new RetryingHttp(),
      this.environment.GITHUB_TOKEN ?? "",
      this.environment.GITHUB_REPOSITORY ?? "",
    );
    const result = await new WorkflowFailureAlert(this.environment, github).send();
    console.log(`워크플로 실패 알림: ${result}`);
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await new WorkflowAlertCommand(process.env).run();
