import json
import os
import urllib.request
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class AlarmEvent:
    """SNS로 전달된 CloudWatch 경보 메시지를 담는다."""

    name: str
    state: str
    reason: str
    changed_at: str | None
    namespace: str
    metric_name: str
    instance_id: str | None

    @classmethod
    def from_sns_message(cls, message: dict) -> "AlarmEvent":
        trigger = message.get("Trigger", {})
        dimensions = {d.get("name"): d.get("value") for d in trigger.get("Dimensions", [])}
        return cls(
            name=message.get("AlarmName", "알 수 없는 경보"),
            state=message.get("NewStateValue", "UNKNOWN"),
            reason=message.get("NewStateReason", ""),
            changed_at=message.get("StateChangeTime"),
            namespace=trigger.get("Namespace", "-"),
            metric_name=trigger.get("MetricName", "-"),
            instance_id=dimensions.get("InstanceId"),
        )

    def is_firing(self) -> bool:
        return self.state == "ALARM"

    def changed_at_iso8601(self) -> str | None:
        """CloudWatch 형식(2026-10-07T04:00:00.000+0000)을 Discord가 받는 ISO 8601로 바꾼다."""
        if not self.changed_at:
            return None
        try:
            return datetime.strptime(self.changed_at, "%Y-%m-%dT%H:%M:%S.%f%z").isoformat()
        except ValueError:
            return None


class SnsRecord:
    """SNS 이벤트의 레코드 하나. 경보 JSON이면 AlarmEvent로, 아니면 원문 그대로 다룬다."""

    def __init__(self, record: dict):
        self._message = record.get("Sns", {}).get("Message", "")

    def to_alarm(self) -> AlarmEvent | None:
        try:
            data = json.loads(self._message)
        except json.JSONDecodeError:
            return None
        if not isinstance(data, dict) or "AlarmName" not in data:
            return None
        return AlarmEvent.from_sns_message(data)

    def raw_text(self) -> str:
        return self._message


class ResponseGuide:
    """경보 지표별로 받은 사람이 해야 할 일을 알려준다."""

    _GUIDES = {
        "StatusCheckFailed_System": "AWS 하드웨어 문제입니다. EC2 콘솔에서 인스턴스를 '중지' 후 '시작'하세요(재부팅으로는 호스트가 바뀌지 않음). 퍼블릭 IP가 바뀌므로 Cloudflare의 monitoring A 레코드를 새 IP로 고치세요.",
        "StatusCheckFailed_Instance": "OS가 응답하지 않습니다. EC2 콘솔에서 인스턴스를 재부팅하세요.",
    }
    _DEFAULT = "EC2 콘솔에서 인스턴스 상태를 확인하세요."

    def for_alarm(self, alarm: AlarmEvent) -> str | None:
        if not alarm.is_firing():
            return None
        return self._GUIDES.get(alarm.metric_name, self._DEFAULT)


class DiscordMessage:
    """경보와 대응 안내로 Discord 웹훅 본문을 만든다."""

    _COLORS = {"ALARM": 0xE74C3C, "OK": 0x2ECC71, "INSUFFICIENT_DATA": 0x95A5A6}
    _DEFAULT_COLOR = 0x95A5A6
    _MAX_DESCRIPTION = 2000

    def __init__(self, alarm: AlarmEvent, guide: str | None = None):
        self._alarm = alarm
        self._guide = guide

    def to_payload(self) -> dict:
        embed = {
            "title": f"[{self._alarm.state}] {self._alarm.name}",
            "description": self._alarm.reason[: self._MAX_DESCRIPTION],
            "color": self._COLORS.get(self._alarm.state, self._DEFAULT_COLOR),
            "fields": self._fields(),
        }
        timestamp = self._alarm.changed_at_iso8601()
        if timestamp:
            embed["timestamp"] = timestamp
        return {"username": "AWS CloudWatch", "embeds": [embed]}

    def _fields(self) -> list[dict]:
        fields = [
            {"name": "지표", "value": f"{self._alarm.namespace} / {self._alarm.metric_name}", "inline": True},
            {"name": "인스턴스", "value": self._alarm.instance_id or "-", "inline": True},
        ]
        if self._guide:
            fields.append({"name": "할 일", "value": self._guide, "inline": False})
        return fields


class TextMessage:
    """경보 형식이 아닌 SNS 메시지(콘솔 테스트 게시 등)를 그대로 보낸다."""

    _MAX_LENGTH = 2000

    def __init__(self, text: str):
        self._text = text

    def to_payload(self) -> dict:
        return {"username": "AWS CloudWatch", "content": f"[SNS] {self._text}"[: self._MAX_LENGTH]}


class DiscordNotifier:
    """Discord 웹훅으로 메시지를 보낸다. to_payload()를 가진 메시지 객체를 받는다."""

    _TIMEOUT_SECONDS = 5
    # 기본 User-Agent(Python-urllib)는 Discord 앞단에서 차단될 수 있다
    _USER_AGENT = "bibbidi-cloudwatch-alarm/1.0"

    def __init__(self, webhook_url: str):
        self._webhook_url = webhook_url

    def send(self, message: DiscordMessage | TextMessage) -> None:
        request = urllib.request.Request(
            self._webhook_url,
            data=json.dumps(message.to_payload()).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": self._USER_AGENT},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self._TIMEOUT_SECONDS) as response:
            response.read()


class AlarmHandler:
    """SNS로 들어온 경보를 대응 안내와 함께 Discord로 알린다."""

    def __init__(self, guide: ResponseGuide, notifier: DiscordNotifier):
        self._guide = guide
        self._notifier = notifier

    @classmethod
    def from_environment(cls) -> "AlarmHandler":
        return cls(
            guide=ResponseGuide(),
            notifier=DiscordNotifier(os.environ["DISCORD_WEBHOOK_URL"]),
        )

    def handle(self, event: dict, context=None) -> dict:
        records = [SnsRecord(record) for record in event.get("Records", [])]
        for record in records:
            self._notifier.send(self._message_for(record))
        return {"ok": True, "sent": len(records)}

    def _message_for(self, record: SnsRecord) -> DiscordMessage | TextMessage:
        alarm = record.to_alarm()
        if alarm is None:
            return TextMessage(record.raw_text())
        return DiscordMessage(alarm, self._guide.for_alarm(alarm))


# Lambda 핸들러 설정값: lambda_function.lambda_handler
# 콜드 스타트 때 객체를 한 번 만들고, 그 객체의 메서드를 핸들러로 노출한다
lambda_handler = AlarmHandler.from_environment().handle
