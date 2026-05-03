import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AssetDomain, AssetTag, AssetType } from '@prisma/client';
import { SchemaFieldDto } from './create-asset.dto';

export class UpdateAssetDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(256) qualifiedName?: string;
  @IsOptional() @IsEnum(AssetType) type?: AssetType;
  @IsOptional() @IsEnum(AssetDomain) domain?: AssetDomain;
  @IsOptional() @IsString() sourceId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchemaFieldDto)
  schema?: SchemaFieldDto[];

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

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayUnique() upstream?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayUnique() downstream?: string[];
}
