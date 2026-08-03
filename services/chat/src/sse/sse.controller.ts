import { Controller, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";
import {
  CurrentUser,
  type CurrentUserData,
} from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SseService } from "./sse.service";

@Controller("api/sse")
@UseGuards(JwtAuthGuard)
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse()
  stream(@CurrentUser() user: CurrentUserData): Observable<MessageEvent> {
    return this.sseService.stream(user.userId);
  }
}
