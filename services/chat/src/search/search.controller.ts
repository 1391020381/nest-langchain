import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  CurrentUser,
  type CurrentUserData,
} from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SearchService } from "./search.service";

export interface SearchBody {
  query: string;
  topK?: number;
}

@Controller("api/search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  search(@CurrentUser() user: CurrentUserData, @Body() body: SearchBody) {
    return this.searchService.similaritySearch(
      body.query,
      user.userId,
      body.topK,
    );
  }
}
