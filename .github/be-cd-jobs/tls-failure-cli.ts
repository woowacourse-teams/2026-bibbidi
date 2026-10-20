import { pathToFileURL } from "node:url";
import { TlsFailureAlert } from "./tls-failure-alert.ts";

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await new TlsFailureAlert(process.env).send();
