import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Use the plain `ws` adapter rather than the default socket.io. We don't
  // need socket.io's reconnect/transport-fallback machinery — the frontend
  // EventsClient handles reconnect explicitly. The path is set on the
  // gateway (@WebSocketGateway({ path: '/events' })).
  app.useWebSocketAdapter(new WsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);

  Logger.log(`Nexus API listening on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
