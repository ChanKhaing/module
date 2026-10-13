import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { LoggerService } from '../common';

interface SocketUser {
  id: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  afterInit() {
    this.logger.log('NotificationsGateway initialized', NotificationsGateway.name);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');

      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        type: 'access' | 'refresh';
      }>(token, { secret: this.config.get<string>('JWT_ACCESS_SECRET') });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      const user: SocketUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      client.data.user = user;
      await client.join(`user:${user.id}`);

      this.logger.log(
        `Notif WS connected: ${user.email} → user:${user.id}`,
        NotificationsGateway.name,
      );
    } catch (err) {
      this.logger.warn(
        `Notif WS auth failed (${client.id}): ${(err as Error).message}`,
        NotificationsGateway.name,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as SocketUser | undefined;
    if (user) {
      this.logger.log(
        `Notif WS disconnected: ${user.email}`,
        NotificationsGateway.name,
      );
    }
  }

  // ─── Public API for other services ───
  emitToUser(userId: string, event: string, payload: any): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token;
    if (typeof auth === 'string' && auth.trim().length > 0) {
      return auth.replace(/^Bearer\s+/i, '').trim();
    }
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.trim().length > 0) {
      return header.replace(/^Bearer\s+/i, '').trim();
    }
    const q = client.handshake.query?.token;
    if (typeof q === 'string' && q.trim().length > 0) {
      return q.trim();
    }
    return null;
  }
}
