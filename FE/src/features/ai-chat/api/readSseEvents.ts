export interface SseEvent {
  type: string;
  data: string;
}

// 이벤트 형식만 해석한다. onEvent가 true를 반환하면 수신을 끝낸다.
export async function readSseEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: SseEvent) => boolean,
  signal: AbortSignal,
): Promise<boolean> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let type = "";
  let data: string[] = [];

  while (true) {
    signal.throwIfAborted();
    const chunk = await reader.read();
    signal.throwIfAborted();
    buffer += decoder.decode(chunk.value, { stream: !chunk.done });
    let lineEnd: RegExpExecArray | null;
    while ((lineEnd = /\r\n|\r|\n/.exec(buffer))) {
      // CRLF가 두 응답 조각에 나뉘면 LF까지 기다린다.
      if (
        lineEnd[0] === "\r" &&
        lineEnd.index === buffer.length - 1 &&
        !chunk.done
      )
        break;
      const line = buffer.slice(0, lineEnd.index);
      buffer = buffer.slice(lineEnd.index + lineEnd[0].length);
      if (!line) {
        const event = { type: type || "message", data: data.join("\n") };
        const hasData = data.length > 0;
        type = "";
        data = [];
        if (hasData && onEvent(event)) return true;
      } else {
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") type = value;
        if (field === "data") data.push(value);
      }
    }
    // 빈 줄로 끝나지 않은 마지막 이벤트는 전달하지 않는다.
    if (chunk.done) return false;
  }
}
