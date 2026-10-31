import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SocialAuthDto {
  @IsIn(['GOOGLE', 'APPLE'])
  provider: 'GOOGLE' | 'APPLE';

  /**
   * Provider-signed ID token (Google ID token / Apple identity token).
   * The account email is derived exclusively from this verified token.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;

  /** Deprecated display hint — ignored for authentication. */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsIn(['login', 'register'])
  action?: 'login' | 'register';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  referralCode?: string;
}
