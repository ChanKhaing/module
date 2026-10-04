import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument, UserStatus } from '../users/schemas/user.schema';
import {
  Role,
  RoleDocument,
  RoleName,
} from '../roles/schemas/role.schema';                    // ← Role ထည့်

import { PasswordService } from '../common/security';
import { LoggerService, IdService } from '../common';
import { RedisService, RedisKeys, RedisTTL } from '../infra/redis';

import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from './dto';
import { JwtPayload, TokenPair } from './interfaces';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,  // ← ဒါ ထည့်
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly password: PasswordService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly id: IdService,
  ) {}

  // ─────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────
  async register(dto: RegisterDto) {
    const exists = await this.userModel.findOne({ email: dto.email }).exec();
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    // Customer role ရှာ
    const customerRole = await this.roleModel
      .findOne({ name: RoleName.CUSTOMER })
      .exec();

    if (!customerRole) {
      throw new Error('Default customer role not found. Run seed first.');
    }

    const passwordHash = await this.password.hash(dto.password);

    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role: customerRole._id,
      emailVerified: false,
    });

    this.logger.log(`Registered: ${user.email}`, AuthService.name);

    const tokens = await this.issueTokens(user);

    return {
      user: await this.sanitize(user),
      ...tokens,
    };
  }

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+passwordHash')
      .exec();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }

    const valid = await this.password.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }

    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_BANNED',
        message: 'Account is banned',
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'Account is inactive',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    this.logger.log(`Logged in: ${user.email}`, AuthService.name);

    const tokens = await this.issueTokens(user);

    return {
      user: await this.sanitize(user),
      ...tokens,
    };
  }

  // ─────────────────────────────────────────
  // REFRESH (rotation)
  // ─────────────────────────────────────────
  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const sessionKey = RedisKeys.session(payload.sub, payload.jti);
    const exists = await this.redis.exists(sessionKey);

    if (!exists) {
      await this.redis.delByPattern(`session:${payload.sub}:*`);

      this.logger.warn(
        `Token reuse detected: user=${payload.sub} jti=${payload.jti}`,
        AuthService.name,
      );

      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_REUSED',
        message: 'Refresh token has been revoked. Please login again.',
      });
    }

    const user = await this.userModel.findById(payload.sub).exec();
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.redis.del(sessionKey);
      throw new UnauthorizedException({
        code: 'AUTH_USER_INVALID',
        message: 'User not found or inactive',
      });
    }

    await this.redis.del(sessionKey);

    const tokens = await this.issueTokens(user);

    this.logger.log(`Token refreshed: ${user.email}`, AuthService.name);

    return tokens;
  }

  // ─────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────
  async logout(dto: LogoutDto): Promise<{ message: string }> {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      const sessionKey = RedisKeys.session(payload.sub, payload.jti);
      await this.redis.del(sessionKey);

      this.logger.log(
        `Logged out: user=${payload.sub} jti=${payload.jti}`,
        AuthService.name,
      );
    } catch {
      // Invalid token → ignore
    }

    return { message: 'Logged out successfully' };
  }

  // ─────────────────────────────────────────
  // LOGOUT ALL
  // ─────────────────────────────────────────
  async logoutAll(userId: string): Promise<{ message: string; revoked: number }> {
    const pattern = RedisKeys.userSessions(userId);
    const revoked = await this.redis.delByPattern(pattern);

    this.logger.log(
      `Logged out all: user=${userId} revoked=${revoked}`,
      AuthService.name,
    );

    return {
      message: 'Logged out from all devices',
      revoked,
    };
  }

  // ─────────────────────────────────────────
  // VERIFY REFRESH
  // ─────────────────────────────────────────
  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN_TYPE',
        message: 'Invalid token type',
      });
    }

    return payload;
  }

  // ─────────────────────────────────────────
  // ISSUE TOKENS
  // ─────────────────────────────────────────
  private async issueTokens(user: UserDocument): Promise<TokenPair> {
    // ─── Role populate (already populated ဖြစ်နိုင်လည်း safe) ───
    if (!(user.role as any)?.name) {
      await user.populate<{ role: RoleDocument }>('role');
    }
    const roleName =
      (user.role as unknown as RoleDocument)?.name ?? RoleName.CUSTOMER;

    const jti = this.id.uuid();

    const accessPayload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: roleName,
      jti,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      ...accessPayload,
      type: 'refresh',
    };

    const accessExpiresIn = 15 * 60;
    const refreshExpiresIn = 7 * 24 * 60 * 60;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET')!,
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as any,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
          '7d') as any,
      }),
    ]);

    const sessionKey = RedisKeys.session(user._id.toString(), jti);
    await this.redis.set(sessionKey, '1', RedisTTL.SESSION);

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  // ─────────────────────────────────────────
  // SANITIZE
  // ─────────────────────────────────────────
  private async sanitize(user: UserDocument) {
    // Populate (already populated ဖြစ်နိုင်လည်း safe)
    if (!(user.role as any)?.name) {
      await user.populate<{ role: RoleDocument }>('role');
    }
    const roleName =
      (user.role as unknown as RoleDocument)?.name ?? null;

    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: roleName,               // ← ✅ roleName (string)
      status: user.status,
      emailVerified: user.emailVerified,
    };
  }
}