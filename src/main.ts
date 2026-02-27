import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    // Trong dev: chấp nhận mọi origin (Zalo WebView gửi từ h5.zadn.vn)
    // Trong production: chỉ cho phép các domain được liệt kê
    origin: isDev
      ? true
      : (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173']),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
