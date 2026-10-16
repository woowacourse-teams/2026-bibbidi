export interface SseEvent {
  name: string;
  data: string;
}

export function parseSseEvents(body: string | null): SseEvent[] {
  if (!body) {
    return [];
  }

  const events: SseEvent[] = [];
  for (const block of body.replace(/\r\n/g, '\n').split('\n\n')) {
    let name = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        name = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice('data:'.length).trim());
      }
    }
    if (data.length > 0 || name !== 'message') {
      events.push({ name, data: data.join('\n') });
    }
  }
  return events;
}

export function isChatCompleted(status: number, body: string | null): boolean {
  if (status !== 200) {
    return false;
  }
  const names = parseSseEvents(body).map((event) => event.name);
  return names.includes('done') && !names.includes('failure');
}
