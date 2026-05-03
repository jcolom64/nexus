import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const LOGIN_METHODS = ['password', 'sso-saml', 'oauth', 'ldap'] as const;
const MFA_MODES = ['off', 'optional', 'required'] as const;
const TLS_VERSIONS = ['1.2', '1.3'] as const;

export class UpdateSecuritySettingsDto {
  // Authentication
  @IsOptional()
  @IsArray()
  @IsIn(LOGIN_METHODS as unknown as string[], { each: true })
  @ArrayUnique()
  loginMethods?: string[];

  @IsOptional() @IsIn(MFA_MODES as unknown as string[]) mfaMode?: string;
  @IsOptional() @IsString() @MaxLength(2048) ssoIssuer?: string;
  @IsOptional() @IsInt() @Min(1) @Max(43200) sessionTimeoutMinutes?: number;
  @IsOptional() @IsBoolean() rememberMeEnabled?: boolean;

  // Password policy
  @IsOptional() @IsInt() @Min(4) @Max(128) passwordMinLength?: number;
  @IsOptional() @IsBoolean() passwordRequireUppercase?: boolean;
  @IsOptional() @IsBoolean() passwordRequireLowercase?: boolean;
  @IsOptional() @IsBoolean() passwordRequireNumber?: boolean;
  @IsOptional() @IsBoolean() passwordRequireSymbol?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(3650) passwordExpiryDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(50) passwordHistoryCount?: number;

  // Account lockout
  @IsOptional() @IsInt() @Min(1) @Max(100) failedAttemptThreshold?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) lockoutDurationMinutes?: number;

  // Network
  @IsOptional() @IsString() @MaxLength(8192) ipAllowlist?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) rateLimitPerMinute?: number;

  // Compliance
  @IsOptional() @IsIn(TLS_VERSIONS as unknown as string[]) tlsMinimumVersion?: string;
  @IsOptional() @IsBoolean() encryptionAtRest?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(36500) auditRetentionDays?: number;
}
