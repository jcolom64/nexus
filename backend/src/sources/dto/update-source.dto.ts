import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SourceStatus, SourceType } from '@prisma/client';

// Same fields as CreateSourceDto but every one is optional. `type` is
// allowed to change but in practice doing so reinterprets every Asset
// owned by the source — UI should warn before letting that happen.
export class UpdateSourceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) name?: string;
  @IsOptional() @IsEnum(SourceType) type?: SourceType;
  @IsOptional() @IsEnum(SourceStatus) status?: SourceStatus;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(255) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(128) database?: string;
  @IsOptional() @IsString() @MaxLength(128) username?: string;

  // Same semantics as `CreateSourceDto.password` plus a special case: an
  // explicit empty string clears the stored credential. `undefined` leaves
  // it alone.
  @IsOptional() @IsString() @MaxLength(512) password?: string;
}
