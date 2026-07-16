import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/env';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';

async function bootstrap() {
  const env = validateEnvironment();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: env.corsOrigin,
    credentials: true,
  });

  await app.listen(env.apiPort, '0.0.0.0');
}

void bootstrap();
