import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;
}
