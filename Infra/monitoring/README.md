# 비비디 모니터링 운영

`grafana/`에는 Prometheus, Loki, Tempo, Grafana 데이터소스, Alloy 설정이 있다. 앱 서버의 Alloy 설정은 CD가 배포하지만 이 디렉터리의 모니터링 서버 설정은 직접 설치해야 한다.

## 모니터링 서버 설정 적용

모니터링 서버에서 설치 경로를 확인한 뒤 아래 파일을 대응하는 위치에 설치한다. 설정에는 비밀 값을 넣지 않는다.

| 저장소 파일 | 서버 위치 |
| --- | --- |
| `grafana/prometheus/prometheus.yaml` | `/etc/prometheus/prometheus.yml` |
| `grafana/loki/loki.yaml` | `/etc/loki/config.yml` |
| `grafana/tempo/tempo.yaml` | `/etc/tempo/config.yml` |
| `grafana/datasources.yaml` | Grafana provisioning 데이터소스 경로 |

적용 후 해당 서비스를 재시작하고 `systemctl status` 및 각 서비스 `/ready`(Grafana는 `/api/health`)를 확인한다. Loki 설정은 조회 결과 캐시를 사용한다.

## 모니터링 서버 서비스 설정

systemd 설정은 저장소에 두지 않고 모니터링 서버에서만 관리한다. 현재 값은 서버에서 `systemctl cat prometheus loki tempo grafana-server`로 확인한다.

- Prometheus: `/etc/systemd/system/prometheus.service` (바이너리 직접 설치)
- Loki, Tempo, Grafana: 패키지 유닛 위에 `/etc/systemd/system/<서비스>.service.d/override.conf`로 덮어쓴다. 수정은 `sudo systemctl edit <서비스>`로 한다.
- 공통으로 `GOMEMLIMIT`(Go GC 목표, MemoryMax보다 낮게), `MemoryMax`(cgroup 하드 상한), `Restart=on-failure`, `RestartSec=5s`, `LimitNOFILE=65536`을 둔다.
- Grafana override는 GitHub OAuth 값을 `/etc/grafana/github-oauth.env`에서 읽는다. 비밀 파일이라 서버를 새로 만들 때 직접 만든다(소유자 `root:root`, 권한 `600`).

## 앱 서버 점검

- 사용자 요청은 8080, Actuator는 8081에서 처리한다. 호스트의 두 포트는 loopback에만 바인딩하며 Alloy는 Docker 네트워크의 `backend:8081/actuator/prometheus`를 수집한다.
- 배포 헬스체크는 `http://127.0.0.1:8081/actuator/health`를 사용한다. 외부 nginx의 `/actuator`는 404를 반환한다.
- Spring 종료 대기 30초보다 Docker 종료 유예 40초를 길게 둔다.
- 개발 환경 nginx는 요청 횟수와 동시 연결 제한을 적용하지 않는다. 운영 환경에는 기존 제한을 적용한다.
- Docker 로그는 컨테이너별 최대 10MB 파일 5개를 보관한다.

## 알림과 장애 대응

알림 규칙은 Grafana 화면에서 수정하고 **매번 Alerting Export YAML을 저장소에 반영하는 PR**을 만든다. 운영(`deployment_environment_name="production"`)만 호출 대상으로 둔다. Critical 평가 그룹은 10초, Warning 평가 그룹은 1분이다. Critical은 IRM 중요 전화와 Discord, Warning은 IRM 기본 푸시와 Discord로 보낸다. IRM은 서버 개발자 3명이 주간 교대하며 Critical 미응답 시 15분 뒤 다음 담당자, 다시 15분 뒤 전원에게 전달한다.

앱 장애 알림을 받으면 먼저 8081 Actuator health와 nginx `/healthz`, Alloy 상태를 확인한다. 모니터링 서버의 `https://monitoring.bibbidi.kr/api/health`가 실패하면 Grafana Cloud Synthetic Monitoring과 CloudWatch EC2 상태 검사 알림을 확인한다. 복구 후 Prometheus의 `up{deployment_environment_name="production"}`와 `disk_free_bytes{deployment_environment_name="production"}`가 다시 수집되는지 확인한다.

Grafana Cloud는 IRM과 Synthetic Monitoring에 사용한다. 기존 Cloud 대시보드, 알림, 데이터소스는 새 알림과 외부 점검의 실제 수신을 확인한 뒤 정리한다.

## AWS 상태 검사 (수동 설정)

모니터링 EC2가 AWS 호스트 장애로 멈추면 CloudWatch가 인스턴스를 자동 복구하고 Discord로 알린다. 이 구성은 저장소에서 자동 적용하지 않으므로 AWS 콘솔에서 아래 순서대로 직접 만든다. 인스턴스 안의 Grafana 장애는 이 알람으로 잡히지 않으며 Synthetic Monitoring이 감지한다.

```
CloudWatch 알람(StatusCheckFailed_System) ─┬─> EC2 복구(recover)
                                           └─> SNS 토픽 ─> Lambda ─> Discord
```

모든 리소스는 모니터링 EC2가 있는 계정·리전에 만든다.

### 1. Discord 웹훅 URL 저장

1. Secrets Manager → **새 보안 암호 저장** → **다른 유형의 보안 암호**를 고른다.
2. **일반 텍스트** 탭에서 내용 전체를 웹훅 URL 한 줄로 바꾼다(키/값 JSON이 아니다).
3. 이름은 `bibbidi/monitoring/discord-webhook`으로 하고 ARN을 기록한다.

웹훅 URL을 Lambda 코드, 환경변수, 저장소에 직접 넣지 않는다.

### 2. Lambda 실행 역할

1. IAM → 역할 → **역할 생성** → 신뢰할 엔터티 `AWS 서비스` / `Lambda`.
2. 관리형 정책 `AWSLambdaBasicExecutionRole`을 붙인다.
3. 인라인 정책으로 1번 보안 암호만 읽게 한다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "<1번 보안 암호 ARN>"
    }
  ]
}
```

### 3. Lambda 함수

1. Lambda → **함수 생성** → 런타임 `Python 3.13`, 실행 역할은 2번 역할.
2. 구성 → 일반 구성에서 제한 시간을 10초로 바꾼다.
3. 구성 → 환경 변수에 `DISCORD_WEBHOOK_SECRET_ARN=<1번 보안 암호 ARN>`을 추가한다.
4. 코드 `lambda_function.py`를 아래로 바꾸고 **Deploy**한다.

```python
import json
import os
import urllib.request

import boto3


def lambda_handler(event, context):
    webhook_url = boto3.client("secretsmanager").get_secret_value(
        SecretId=os.environ["DISCORD_WEBHOOK_SECRET_ARN"]
    )["SecretString"]
    for record in event.get("Records", []):
        message = record["Sns"]["Message"]
        body = json.dumps({"content": "Bibbidi monitoring EC2 status check: " + message[:1700]})
        request = urllib.request.Request(
            webhook_url,
            data=body.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5):
            pass
```

### 4. SNS 토픽과 구독

1. SNS → 주제 생성 → 유형 `표준`, 이름 `bibbidi-monitoring-alert`.
2. 주제에서 **구독 생성** → 프로토콜 `AWS Lambda`, 엔드포인트는 3번 함수. 콘솔이 Lambda 호출 권한을 함께 추가한다.
3. 주제에서 **메시지 게시**로 테스트 메시지를 보내 Discord 수신을 확인한다. 안 오면 Lambda → 모니터링 → CloudWatch Logs를 본다.

### 5. CloudWatch 알람

1. CloudWatch → 경보 → **경보 생성** → 지표 `EC2 > 인스턴스별 지표`에서 모니터링 EC2의 `StatusCheckFailed_System`.
2. 통계 `최대`, 기간 `1분`.
3. 조건 `보다 큼` `0`, 추가 구성에서 경보를 발생시킬 데이터 포인트 `2/2`, 누락된 데이터 처리 `누락`.
4. 작업
   - 알림: 상태 `경보 상태` → 4번 SNS 토픽. 필요하면 `정상` 상태에도 같은 토픽을 추가해 복구 알림을 받는다.
   - EC2 작업: 상태 `경보 상태` → **이 인스턴스 복구**.
5. 이름은 `bibbidi-monitoring-system-status`로 한다.

EC2 작업 목록에 복구가 없으면 인스턴스 유형이 복구를 지원하지 않는 것이다. 이때는 알림만 두고 이 README에 그 사실을 적는다.

### 6. Grafana CloudWatch 데이터소스

Grafana에서 CloudWatch 지표를 보려면 모니터링 EC2의 인스턴스 역할(`ec2-project`)에 읽기 권한이 있어야 한다.

1. IAM → 역할 → `ec2-project`에서 아래 권한이 있는지 확인하고, 없으면 인라인 정책으로 추가한다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:DescribeAlarmsForMetric",
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "ec2:DescribeInstances",
        "ec2:DescribeRegions",
        "ec2:DescribeTags",
        "tag:GetResources"
      ],
      "Resource": "*"
    }
  ]
}
```

2. Grafana → Connections → Data sources → **CloudWatch** 추가 → 인증 공급자 `AWS SDK Default`, 기본 리전은 모니터링 EC2 리전.
3. **Save & test** 후 Explore에서 `AWS/EC2` `StatusCheckFailed_System`이 조회되는지 확인한다.

## 수동 작업 체크리스트

아래 항목은 저장소에서 자동 적용되지 않는다. 처음 구성하거나 서버를 다시 만들 때 순서대로 확인한다.

- [ ] 모니터링 서버에 `grafana/` 설정 설치, systemd 서비스 설정 확인 후 서비스 재시작
- [ ] AWS 상태 검사 1~5단계, SNS 테스트 메시지로 Discord 수신 확인
- [ ] Grafana CloudWatch 데이터소스(6단계)
- [ ] Grafana 연락처: Discord, Grafana Cloud IRM. 각 연락처의 **Test** 버튼으로 수신 확인
- [ ] 알림 정책: `severity=critical` → IRM 중요 + Discord, `severity=warning` → IRM 기본 + Discord
- [ ] 알림 규칙 작성 후 Alerting → Export로 YAML을 받아 저장소에 PR
- [ ] Grafana Cloud IRM 온콜 스케줄(서버 개발자 3명 주간 교대)과 에스컬레이션(15분 → 다음 담당자, 15분 → 전원). 담당자마다 IRM 앱 설치와 전화번호 인증
- [ ] Grafana Cloud Synthetic Monitoring: `https://monitoring.bibbidi.kr/api/health`와 서비스 주소 HTTP 점검, 실패 알림을 IRM으로 연결
- [ ] 새 알림과 외부 점검 수신 확인 후 Grafana Cloud 대시보드·알림·데이터소스 정리
