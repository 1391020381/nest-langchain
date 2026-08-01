import { Injectable } from "@nestjs/common";
import { createChatModel } from "./model.factory";

@Injectable()
export class LlmService {
  private model = createChatModel();
}
