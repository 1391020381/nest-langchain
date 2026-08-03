import { BadRequestException } from "@nestjs/common";

const MIN_PASSWORD_LENGTH = 6;

export function validateAuthCredentials(
  email: unknown,
  password: unknown,
): void {
  if (typeof email !== "string" || !email.trim()) {
    throw new BadRequestException("Email is required");
  }
  if (typeof password !== "string" || !password) {
    throw new BadRequestException("Password is required");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
}
