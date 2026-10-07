import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandOptions = {
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
  showStderr?: boolean;
};

export type CommandRunner = (
  file: string,
  args: string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        encoding: "utf8",
        env: options.env ?? process.env,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const result = { stdout: String(stdout), stderr: String(stderr) };
        if (!options.quiet && result.stdout) process.stdout.write(result.stdout);
        if ((!options.quiet || options.showStderr) && result.stderr) process.stderr.write(result.stderr);
        if (error) reject(error);
        else resolve(result);
      },
    );
  });

type Dependencies = {
  run?: CommandRunner;
  sleep?: (milliseconds: number) => Promise<void>;
  logError?: (message: string) => void;
  previousImage?: string;
};

const sleepOneSecond = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function verifyDeployment(dependencies: Dependencies = {}): Promise<void> {
  const run = dependencies.run ?? runCommand;
  const sleep = dependencies.sleep ?? sleepOneSecond;
  const logError = dependencies.logError ?? ((message: string) => console.error(message));
  const previousImage = dependencies.previousImage ?? process.env.PREVIOUS_IMAGE ?? "";

  const rollback = async () => {
    if (!previousImage) {
      logError("::error::deploy failed and no previous image is available to roll back to");
      return;
    }

    logError("::error::deploy failed - rolling back backend to " + previousImage);
    const separator = previousImage.lastIndexOf(":");
    const imageTag = separator < 0 ? previousImage : previousImage.slice(separator + 1);
    try {
      await run(
        "docker",
        ["compose", "up", "-d", "--force-recreate", "backend"],
        { env: { ...process.env, IMAGE_TAG: imageTag } },
      );
    } catch {
      // The original rollback command is best effort.
    }
  };

  let alloyHealth = "unknown";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await run(
        "docker",
        ["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}", "alloy"],
        { quiet: true },
      );
      alloyHealth = result.stdout.trim() || "unknown";
    } catch {
      alloyHealth = "unknown";
    }
    if (alloyHealth === "healthy") break;
    await sleep(1000);
  }

  const alloyFailed = alloyHealth !== "healthy";
  if (alloyFailed) {
    logError("::error::Alloy did not become healthy within 60 seconds (status: " + alloyHealth + ")");
    try {
      await run("docker", ["compose", "logs", "--tail=100", "alloy"]);
    } catch {
      // The original Alloy log command is best effort.
    }
  }

  let backendHealthy = false;
  try {
    const result = await run(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--retry",
        "60",
        "--retry-delay",
        "2",
        "--retry-connrefused",
        "--retry-all-errors",
        "http://127.0.0.1:8081/actuator/health",
      ],
      { quiet: true, showStderr: true },
    );
    backendHealthy = result.stdout.includes('"status":"UP"');
  } catch {
    backendHealthy = false;
  }

  if (!backendHealthy) {
    await run("docker", ["compose", "logs", "--tail=200", "backend", "nginx", "alloy"]);
    await rollback();
    throw new Error("backend health check failed");
  }

  let nginxHealthy = true;
  try {
    await run("curl", ["--fail", "--silent", "http://127.0.0.1/healthz"], { quiet: true });
  } catch {
    nginxHealthy = false;
  }
  if (!nginxHealthy) {
    await run("docker", ["compose", "logs", "--tail=200", "nginx", "alloy"]);
    await rollback();
    throw new Error("nginx health check failed");
  }

  if (alloyFailed) throw new Error("Alloy health check failed");
}

async function main(): Promise<void> {
  try {
    await verifyDeployment();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
