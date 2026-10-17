import { readFile } from "node:fs/promises";
import { load } from "js-yaml";
import type { ReviewPrompts } from "../../common/ai-review-types.ts";

export class PromptFile {
  private readonly location: URL;

  constructor(location: URL) {
    this.location = location;
  }

  async read() {
    return load(await readFile(this.location, "utf8")) as ReviewPrompts;
  }
}
