import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { AuthTokensDto } from './types/auth-tokens.type';
import type { JwtPayloadWithRefreshToken } from './types/jwt-payload.type';

@ApiTags('auth')
@Controller('auth')
@Throttle({ auth: {} })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and receive a token pair' })
  @ApiOkResponse({ type: AuthTokensDto })
  register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  @ApiOkResponse({ type: AuthTokensDto })
  login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and get a new token pair' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(
    @CurrentUser() user: JwtPayloadWithRefreshToken,
    // Body is validated here; the guard extracts the token from it.
    @Body() _dto: RefreshTokenDto,
  ): Promise<AuthTokensDto> {
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate the stored refresh token' })
  async logout(@CurrentUser('sub') userId: string): Promise<{ success: boolean }> {
    await this.authService.logout(userId);
    return { success: true };
  }
}
