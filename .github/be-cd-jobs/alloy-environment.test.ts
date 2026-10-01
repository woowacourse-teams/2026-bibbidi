import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractDeclaredNames, extractRequiredNames, findUndeclaredNames } from "./alloy-environment.ts";

const compose = `services:
  backend:
    environment:
      SPRING_PROFILES_ACTIVE: prod
  alloy:
    image: grafana/alloy:v1.11.0
    environment:
      # 주석은 무시한다
      DOCKER_HOST_URL: tcp://dockerproxy:2375
      GRAFANA_CLOUD_OTLP_URL: \${GRAFANA_CLOUD_OTLP_URL:?required}
    volumes:
      - ./config.alloy:/etc/alloy/config.alloy:ro
  nginx:
    environment:
      NGINX_ONLY: "1"
`;

test("config.alloy가 읽는 환경변수 이름을 중복 없이 뽑는다", () => {
  const config = `
    url = sys.env("GRAFANA_CLOUD_OTLP_URL")
    host = coalesce(sys.env("DOCKER_HOST_URL"), "unix:///var/run/docker.sock")
    again = sys.env( "GRAFANA_CLOUD_OTLP_URL" )
  `;

  assert.deepEqual(extractRequiredNames(config), ["GRAFANA_CLOUD_OTLP_URL", "DOCKER_HOST_URL"]);
});

test("compose에서 지정한 서비스의 environment 키만 뽑는다", () => {
  assert.deepEqual(extractDeclaredNames(compose, "alloy"), ["DOCKER_HOST_URL", "GRAFANA_CLOUD_OTLP_URL"]);
});

test("environment가 없는 서비스는 빈 목록이다", () => {
  assert.deepEqual(extractDeclaredNames(compose, "missing"), []);
});

test("선언되지 않은 이름만 골라낸다", () => {
  assert.deepEqual(findUndeclaredNames(["A", "B", "C"], ["A", "C"]), ["B"]);
});

test("모두 선언되어 있으면 빈 목록이다", () => {
  assert.deepEqual(findUndeclaredNames(["A"], ["A", "B"]), []);
});

test("저장소의 config.alloy가 읽는 이름은 운영·로컬 compose의 alloy.environment에 모두 선언되어 있다", () => {
  const config = readFileSync(new URL("../../Infra/monitoring/alloy/config.alloy", import.meta.url), "utf8");

  for (const composeFile of ["compose.prod.yml", "compose.local.yml"]) {
    const composeText = readFileSync(new URL(`../../BE/${composeFile}`, import.meta.url), "utf8");
    const undeclared = findUndeclaredNames(extractRequiredNames(config), extractDeclaredNames(composeText, "alloy"));

    assert.deepEqual(undeclared, [], `${composeFile}에 선언되지 않은 환경변수: ${undeclared.join(", ")}`);
  }
});
