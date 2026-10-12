import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { LoggerService } from '../common';
import { RedisService, RedisTTL } from '../infra/redis';
import { SupportService } from './support.service';

interface SocketUser {
  id: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  // Default namespace: /
  // Path: /socket.io (socket.io default)
})
export class SupportGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
    private readonly support: SupportService,
  ) {}

  afterInit() {
    this.logger.log('SupportGateway initialized', SupportGateway.name);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        throw new Error('No token provided');
      }

      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        type: 'access' | 'refresh';
      }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type (access required)');
      }

      const user: SocketUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      // Attach user to socket data
      client.data.user = user;

      // Presence in Redis (TTL 5m — refresh on activity later)
      await this.redis.set(
        `presence:${user.id}`,
        client.id,
        RedisTTL.PRESENCE ?? 300,
      );

      // Broadcast online (to all staff later; for now global)
      client.broadcast.emit('presence:online', {
        userId: user.id,
        role: user.role,
      });

      this.logger.log(
        `WS connected: ${user.email} (socket=${client.id})`,
        SupportGateway.name,
      );
    } catch (err) {
      this.logger.warn(
        `WS auth failed (socket=${client.id}): ${(err as Error).message}`,
        SupportGateway.name,
      );
      client.emit('auth:error', { message: (err as Error).message });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return;

    // Clear presence only if this socket is still the active one
    const current = await this.redis.get(`presence:${user.id}`);
    if (current === client.id) {
      await this.redis.del(`presence:${user.id}`);

      client.broadcast.emit('presence:offline', {
        userId: user.id,
        role: user.role,
      });
    }

    this.logger.log(
      `WS disconnected: ${user.email} (socket=${client.id})`,
      SupportGateway.name,
    );
  }


  // ─────────────────────────────────────────
  // ROOM: JOIN
  // ─────────────────────────────────────────
  @SubscribeMessage('support:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      return { ok: false, error: 'Not authenticated' };
    }

    const ticketId = body?.ticketId;
    if (!ticketId || typeof ticketId !== 'string') {
      return { ok: false, error: 'ticketId is required' };
    }

    try {
      // Verify access (reuse SupportService ownership)
      const isStaff = user.role === 'admin' || user.role === 'agent';
      await this.support.findById(ticketId, user.id, isStaff);

      const room = `support:${ticketId}`;
      await client.join(room);

      const roomSize = this.server.sockets.adapter.rooms.get(room)?.size ?? 1;

      client.emit('support:joined', { ticketId, room, roomSize });

      this.logger.log(
        `WS join: ${user.email} → ${room} (size=${roomSize})`,
        SupportGateway.name,
      );

      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(
        `WS join denied: ${user.email} → ${ticketId}: ${msg}`,
        SupportGateway.name,
      );
      client.emit('support:error', { action: 'join', message: msg });
      return { ok: false, error: msg };
    }
  }

  // ─────────────────────────────────────────
  // ROOM: LEAVE
  // ─────────────────────────────────────────
  @SubscribeMessage('support:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { ticketId: string },
  ): Promise<{ ok: boolean }> {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      return { ok: false };
    }

    const ticketId = body?.ticketId;
    if (!ticketId || typeof ticketId !== 'string') {
      return { ok: false };
    }

    const room = `support:${ticketId}`;
    await client.leave(room);

    const roomSize = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;

    client.emit('support:left', { ticketId, room, roomSize });

    this.logger.log(
      `WS leave: ${user.email} ← ${room} (size=${roomSize})`,
      SupportGateway.name,
    );

    return { ok: true };
  }

  // ─────────────────────────────────────────
  private extractToken(client: Socket): string | null {
    // 1. handshake.auth.token
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    // 2. handshake.headers.authorization
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.trim().length > 0) {
      return header.replace(/^Bearer\s+/i, '').trim();
    }

    // 3. handshake.query.token
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    return null;
  }
}
