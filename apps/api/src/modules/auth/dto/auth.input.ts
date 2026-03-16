import { InputType, Field } from '@nestjs/graphql';
import { IsString, MinLength, IsEmail } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsString()
  username: string;

  @Field()
  @IsString()
  @MinLength(1)
  password: string;
}

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  @MinLength(2)
  username: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;
}
