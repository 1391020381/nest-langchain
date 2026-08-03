import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

const BCRYPT_COST = 10;

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password, name }: RegisterInput) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    try {
      return await this.prisma.user.create({
        data: { email, password: passwordHash, name },
        select: { id: true, email: true },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  async login({ email, password }: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }
}
