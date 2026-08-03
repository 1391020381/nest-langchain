import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: RegisterBody) {
    return this.authService.register(body);
  }

  @Post("login")
  login(@Body() body: LoginBody) {
    return this.authService.login(body);
  }
}
