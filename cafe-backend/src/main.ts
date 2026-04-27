import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  console.log('[Backend] Starting bootstrap...');
  // const app = await NestFactory.create(AppModule, { cors: true });
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['https://hello-cafe.vercel.app', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  console.log('[Backend] App created (NestFactory.create done)');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .filter(Boolean);
        return new BadRequestException(
          messages.join(', ') || 'Validation failed',
        );
      },
    }),
  );
  console.log('[Backend] Global validation pipe configured');

  app.useGlobalInterceptors(new LoggingInterceptor());
  console.log('[Backend] Global logging interceptor registered');

  const port = process.env.PORT || 3001;
  console.log('[Backend] Listening on port', port, '...');
  await app.listen(port);
  console.log('[Backend] Server is running at http://localhost:' + port);
}
bootstrap().catch((err) => {
  console.error('[Backend] Bootstrap failed:', err);
  process.exit(1);
});
