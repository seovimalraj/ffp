import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { auth: string; secret?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.auth) return;

    // Optional: verify system secret if provided
    const systemSecret = process.env.INTERNAL_API_KEY || 'debug-secret-123';
    if (data.secret === systemSecret) {
      this.logger.log(`System client ${client.id} joined room as ${data.auth}`);
    }

    this.logger.log(`Client ${client.id} joining room for user: ${data.auth}`);
    client.join(`user:${data.auth}`);
  }

  /**
   * Special event for system-to-user notifications.
   * Only works if the client has joined or provides the secret.
   */
  @SubscribeMessage('systemMessage')
  handleSystemMessage(
    @MessageBody()
    data: { targetUserId: string; event: string; payload: any; secret: string },
    @ConnectedSocket() client: Socket,
  ) {
    const systemSecret = process.env.INTERNAL_API_KEY || 'debug-secret-123';
    if (data.secret !== systemSecret) {
      this.logger.warn(`Unauthorized systemMessage attempt from ${client.id}`);
      return { success: false, error: 'unauthorized' };
    }

    this.logger.log(
      `System message to room user:${data.targetUserId}: ${data.event}`,
    );

    console.log('triggered 1');
    this.sendToUser(data.targetUserId, data.event, data.payload);
    return { success: true };
  }

  /**
   * Send a notification to all active sockets of a specific user.
   * Call this from other services (e.g. OrdersService, QuotesService).
   *
   * @param userId  - the user's ID
   * @param event   - socket event name, e.g. 'receiveMessage'
   * @param payload - data to send
   */
  sendToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
    this.logger.log(`Emitted '${event}' to user room user:${userId}`);
  }

  /**
   * Echo a test message back only to the sender's own sockets.
   * Useful for verifying the connection from the frontend.
   */
  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(
      `Received message from ${client.id}: ${JSON.stringify(data)}`,
    );
    // Echo only to the sender's own joined room
    this.sendToUser(client.id, 'receiveMessage', data);
    console.log('triggered');
    // Fallback: echo only to this specific socket if not yet registered
    client.emit('receiveMessage', data);
  }
}
