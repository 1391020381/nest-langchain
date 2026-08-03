import { Injectable, type MessageEvent } from "@nestjs/common";
import { map, Observable, Subject } from "rxjs";

export type SseTaskEvent = {
  type: "processing" | "done" | "error";
  documentId: string;
  message?: string;
};

@Injectable()
export class SseService {
  private readonly streams = new Map<string, Subject<SseTaskEvent>>();

  publish(userId: string, event: SseTaskEvent): void {
    this.getOrCreateStream(userId).next(event);
  }

  stream(userId: string): Observable<MessageEvent> {
    return this.getOrCreateStream(userId).pipe(
      map((event) => ({ data: JSON.stringify(event) })),
    );
  }

  private getOrCreateStream(userId: string): Subject<SseTaskEvent> {
    const existing = this.streams.get(userId);
    if (existing) {
      return existing;
    }

    const stream = new Subject<SseTaskEvent>();
    this.streams.set(userId, stream);
    return stream;
  }
}
