import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Sent by Nebular's NbLoginComponent when the "remember me" checkbox is
  // shown (we enabled it in core.module.ts). Accepting it here so the global
  // ValidationPipe (forbidNonWhitelisted) doesn't reject the request as 400.
  // Not yet used to extend token TTL — that'll come later.
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
