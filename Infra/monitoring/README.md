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

알림 규칙, 정책, 연락처, 대시보드는 Grafana 화면에서 관리하며 저장소에 보관하지 않는다. 원본은 모니터링 서버의 `/var/lib/grafana/grafana.db` 하나뿐이므로 인스턴스를 잃으면 함께 사라진다. 필요하면 이 파일을 주기적으로 백업한다.

운영(`deployment_environment_name="production"`)만 호출 대상으로 둔다. Critical 평가 그룹은 10초, Warning 평가 그룹은 1분이다. 규칙에는 `severity`(`critical`/`warning`)와 `alert_id`(`C1`~`W9`) 라벨을 붙이고, No data는 Normal, Error는 Error로 둔다. 데이터가 끊기는 상황은 C2(backend 수집 실패)가 따로 잡는다.

하위 정책을 쓰지 않고 등급별로 이름 붙은 정책을 만들어 규칙마다 직접 고른다. 규칙을 만들 때 정책 선택을 빠뜨리지 않는다.

- Critical(C1~C6): 정책 `bibbidi-critical` → 연락처 `irm-critical`(Webhook) → IRM 연동 `bibbidi-grafana`(Alertmanager 유형) → 전화. Discord로는 보내지 않는다.
- Warning(W1~W9): 정책 `bibbidi-warning` → Discord. IRM으로는 보내지 않는다(Discord와 중복).

규칙이 정책을 고르지 않으면 기본 정책을 타서 Discord로만 간다. Critical 규칙이 Discord에 보이면 정책 선택을 확인한다.

IRM 에스컬레이션 체인 `bibbidi-critical`은 다음 순서로 부른다. 모든 단계는 Important 알림이다.

1. `bibbidi-oncall`(1차 당번)
2. 15분 대기
3. `bibbidi-oncall-secondary`(2차 당번)
4. 15분 대기
5. 서버 개발자 3명 전원

현재는 팀원 2명이 등록 전이라 세 단계 모두 1명만 들어 있다. 무료 플랜은 IRM 활성 사용자가 3명까지라 4명 이상이면 유료(1명당 월 $20)다.

앱 장애 알림을 받으면 먼저 8081 Actuator health와 nginx `/healthz`, Alloy 상태를 확인한다. 모니터링 서버 장애는 CloudWatch EC2 상태 검사 알림(Discord·IRM 전화)으로 확인한다. 복구 후 Prometheus의 `up{deployment_environment_name="production"}`와 `disk_free_bytes{deployment_environment_name="production"}`가 다시 수집되는지 확인한다.

Grafana Cloud는 IRM에 사용한다. Synthetic Monitoring(`https://monitoring.bibbidi.kr/api/health` 외부 점검)은 예정이며 아직 설정하지 않았다. 기존 Cloud 대시보드, 알림, 데이터소스는 새 알림의 실제 수신을 확인한 뒤 정리한다.

## AWS 상태 검사 (수동 설정)

모니터링 EC2가 AWS 호스트 장애로 멈추면 CloudWatch 경보가 Discord와 IRM 전화로 알린다. 복구는 사람이 직접 한다. 이 구성은 저장소에서 자동 적용하지 않으므로 AWS 콘솔에서 아래 순서대로 직접 만든다. 인스턴스 안의 Grafana 장애는 이 알람으로 잡히지 않는다(Synthetic Monitoring 예정).

```
CloudWatch 알람(StatusCheckFailed_System) ─> SNS 주제 ─┬─> Lambda ─> Discord
                                                      └─> IRM 연동 bibbidi-cloudwatch ─> 체인 bibbidi-critical(전화)
```

자동 복구·재부팅은 쓰지 않는다. CloudWatch 경보의 EC2 작업은 계정에 서비스 연결 역할(`AWSServiceRoleForCloudWatchEvents`)과 생성 권한(`iam:CreateServiceLinkedRole`)이 없어 쓸 수 없고, Lambda 실행 역할에는 `ec2:RebootInstances` 권한이 없다. 하드웨어 장애로 인스턴스를 중지 후 시작하면 퍼블릭 IP가 바뀌므로(Elastic IP 없음) Cloudflare의 `monitoring.bibbidi.kr` A 레코드를 새 IP로 고친다.

경보가 Lambda를 직접 호출하지 않고 SNS를 거친다. Lambda 리소스 기반 정책 추가 화면이 `access-analyzer:ValidatePolicy` 권한 부족으로 막히지만, Lambda의 SNS 트리거 추가는 호출 권한을 자동으로 넣어 준다.

모든 리소스는 모니터링 EC2가 있는 계정·리전에 만든다.

### 1. Discord 웹훅 URL

웹훅 URL은 Lambda 환경 변수 `DISCORD_WEBHOOK_URL`에만 넣고 코드와 저장소에는 넣지 않는다.

### 2. Lambda 실행 역할

uteco 계정에서는 IAM 역할을 만들 수 없으므로 기존 `techcourse-lambda-execution-role`을 쓴다. 이 역할에는 `ec2:RebootInstances` 권한이 없다.

### 3. Lambda 함수

1. Lambda → **함수 생성** → 런타임 `Python 3.13`, 아키텍처 `arm64`, 실행 역할은 2번 역할.
2. 구성 → 일반 구성에서 제한 시간을 10초로 바꾼다.
3. 구성 → 환경 변수에 `DISCORD_WEBHOOK_URL`을 추가한다.
4. 코드는 저장소의 `lambda/lambda_function.py`로 바꾸고 **Deploy**한다. 코드를 고치면 저장소와 Lambda 콘솔을 함께 맞춘다.

함수는 SNS 이벤트의 `Records[].Sns.Message`를 읽어 Discord로 보낸다. 경보가 울릴 때만 "할 일"(중지 후 시작, Cloudflare A 레코드 수정)을 붙인다. 자동 재부팅은 하지 않는다.

### 4. SNS 주제와 구독

1. SNS → 주제 생성 → 유형 `표준`, 이름 `bibbidi-monitoring-alarm`.
2. Lambda → 3번 함수 → **트리거 추가** → `SNS`, 주제는 1번 주제. 콘솔이 Lambda 호출 권한을 함께 추가한다.
3. Grafana Cloud IRM → 연동 추가 → 유형 `Amazon SNS`, 이름 `bibbidi-cloudwatch`, Default route는 체인 `bibbidi-critical`. 연동 URL을 기록한다.
4. 주제에서 **구독 생성** → 프로토콜 `HTTPS`, 엔드포인트는 3번의 연동 URL, 원시 메시지 전송은 끈다. IRM이 자동으로 확인하므로 구독 상태가 `Confirmed`인지 본다.
5. 주제에서 **메시지 게시**로 테스트 메시지를 보내 Discord 수신을 확인한다. 안 오면 Lambda → 모니터링 → CloudWatch Logs를 본다.

### 5. CloudWatch 알람

1. CloudWatch → 경보 → **경보 생성** → 지표 `EC2 > 인스턴스별 지표`에서 모니터링 EC2의 `StatusCheckFailed_System`.
2. 통계 `최대`, 기간 `1분`.
3. 조건 `보다 큼` `0`, 추가 구성에서 경보를 발생시킬 데이터 포인트 `2/2`, 누락된 데이터 처리 `누락`.
4. 작업: 상태 `경보 상태`와 `정상` 모두 4번 SNS 토픽으로 보낸다. `정상` 알림이 IRM 알림을 자동 해소한다. EC2 작업은 추가하지 않는다.
5. 이름은 `bibbidi-monitoring-system-status`로 한다.
6. 임계값을 잠시 `0`으로 바꿔 ALARM 발화(Discord·전화)를 확인하고, `1`로 되돌려 OK와 IRM 자동 해소를 확인한다.

### 6. Grafana CloudWatch 데이터소스

CloudWatch 데이터소스는 `grafana/datasources.yaml`의 provisioning(`uid: cloudwatch`, 인증 `default`, 리전 `ap-northeast-2`)으로만 만든다. 대시보드 패널이 `uid: cloudwatch`를 전제로 하므로 화면에서 추가하지 않는다. 화면에서 추가하면 uid가 무작위로 붙어 패널이 깨진다. 모니터링 EC2의 인스턴스 역할(`ec2-project`)에는 읽기 권한이 있어야 한다.

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

2. `grafana/datasources.yaml`을 모니터링 서버에 설치하고 Grafana를 재시작한다.
3. Explore에서 `AWS/EC2` `StatusCheckFailed_System`이 조회되는지 확인한다. Connections → Data sources에 CloudWatch가 두 개 보이면 provisioned 표시가 없는 쪽을 지운다.

CloudWatch 조회는 `GetMetricData` 요금이 든다(월 예산 70달러). CloudWatch를 쓰는 인프라 대시보드는 자동 새로고침을 5분으로 둔다. 모니터링 서버와 DB 서버(`bibbidi-mysql`)는 CPU·네트워크·상태 검사만 보며 디스크·메모리는 수집하지 않는다.

## 수동 작업 체크리스트

아래 항목은 저장소에서 자동 적용되지 않는다. 처음 구성하거나 서버를 다시 만들 때 순서대로 확인한다.

- [ ] 모니터링 서버에 `grafana/` 설정 설치, systemd 서비스 설정 확인 후 서비스 재시작
- [ ] AWS 상태 검사 1~5단계, SNS 테스트 메시지로 Discord 수신과 IRM 구독 `Confirmed` 확인
- [ ] Lambda 코드가 저장소 `lambda/lambda_function.py`와 같은지 확인
- [ ] Grafana CloudWatch 데이터소스(6단계, provisioning)
- [ ] IRM 연동: `bibbidi-grafana`(Alertmanager, 서비스 알림), `bibbidi-cloudwatch`(Amazon SNS, 모니터링 서버 장애). 둘 다 체인 `bibbidi-critical`로 보낸다
- [ ] Grafana 연락처: Discord, `irm-critical`(Webhook → `bibbidi-grafana`). 각 연락처의 **Test** 버튼으로 수신 확인
- [ ] 알림 정책: `bibbidi-critical` → `irm-critical`, `bibbidi-warning` → Discord
- [ ] 알림 규칙 C1~C6, W1~W9 작성. 규칙마다 등급에 맞는 정책을 골랐는지 확인
- [ ] `/var/lib/grafana/grafana.db` 백업
- [ ] IRM 일정 `bibbidi-oncall`, `bibbidi-oncall-secondary`와 체인 `bibbidi-critical`(1차 → 15분 → 2차 → 15분 → 전원). 담당자마다 IRM 앱 설치와 전화번호 인증
- [ ] (예정) Grafana Cloud Synthetic Monitoring: `https://monitoring.bibbidi.kr/api/health`와 서비스 주소 HTTP 점검, 실패 알림을 IRM으로 연결
- [ ] 새 알림 수신 확인 후 Grafana Cloud 대시보드·알림·데이터소스 정리
