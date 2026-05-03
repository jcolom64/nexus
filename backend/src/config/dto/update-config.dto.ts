import { Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';

export class NotificationEventDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsString()
  @MaxLength(256)
  label!: string;

  @IsBoolean()
  enabled!: boolean;
}

// PUT-style replace: every field is optional in transit, but the server stores
// the full row. Missing fields fall back to whatever's already persisted.
export class UpdateSystemConfigDto {
  // General
  @IsOptional() @IsString() @MaxLength(128) appNameOverride?: string;
  @IsOptional() @IsIn(['default', 'dark']) defaultTheme?: string;
  @IsOptional() @IsString() @MaxLength(16) defaultLocale?: string;
  @IsOptional() @IsString() @MaxLength(64) defaultTimezone?: string;
  @IsOptional() @IsString() @MaxLength(32) dateFormat?: string;
  @IsOptional() @IsIn(['sunday', 'monday', 'saturday']) firstDayOfWeek?: string;

  // Data sources
  @IsOptional() @IsInt() @Min(1) @Max(86400) defaultRefreshSeconds?: number;
  @IsOptional() @IsInt() @Min(0) @Max(20) defaultRetryAttempts?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) retryBackoffMultiplier?: number;
  @IsOptional() @IsInt() @Min(1) @Max(256) maxConcurrentConnectors?: number;

  // Notifications & Email
  @IsOptional() @IsString() @MaxLength(255) smtpHost?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) smtpPort?: number;
  @IsOptional() @IsBoolean() smtpRequireAuth?: boolean;
  @IsOptional() @IsString() @MaxLength(255) smtpUsername?: string;
  @IsOptional() @IsString() @MaxLength(255) smtpFromAddress?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NotificationEventDto) @ArrayUnique((e: NotificationEventDto) => e.id) notificationEvents?: NotificationEventDto[];
  @IsOptional() @IsString() @MaxLength(2048) slackWebhookUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) teamsWebhookUrl?: string;

  // Performance & Limits
  @IsOptional() @IsInt() @Min(0) @Max(86400) cacheTtlSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3600) queryTimeoutSeconds?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10240) maxUploadMb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1024) maxConcurrentJobs?: number;
  @IsOptional() @IsInt() @Min(1) @Max(256) workerPoolSize?: number;

  // Licensing
  @IsOptional() @IsString() @MaxLength(255) licenseKey?: string;
  @IsOptional() @IsIn(['starter', 'professional', 'enterprise']) plan?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) seatsUsed?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) seatsTotal?: number;
  @IsOptional() @IsString() @MaxLength(32) licenseExpires?: string;
}
