import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AssetDomain, AssetTag, AssetType } from '@prisma/client';

export class SchemaFieldDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsString()
  @MaxLength(64)
  type!: string;

  @IsOptional()
  @IsBoolean()
  pii?: boolean;
}

export class CreateAssetDto {
  @IsString() @MinLength(1) @MaxLength(128) name!: string;
  @IsString() @MinLength(1) @MaxLength(256) qualifiedName!: string;

  @IsEnum(AssetType) type!: AssetType;
  @IsEnum(AssetDomain) domain!: AssetDomain;

  @IsString()
  sourceId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchemaFieldDto)
  schema!: SchemaFieldDto[];

  @IsOptional() @IsInt() @Min(0) rowCount?: number;
  @IsOptional() @IsInt() @Min(0) sizeMb?: number;

  @IsOptional() @IsEmail() ownerEmail?: string;
  @IsOptional() @IsString() @MaxLength(128) ownerName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(AssetTag, { each: true })
  @ArrayUnique()
  tags?: AssetTag[];

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  // Lineage edges, expressed by qualifiedName (more stable across the
  // wire than ids). The service resolves them when present.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  upstream?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  downstream?: string[];
}
