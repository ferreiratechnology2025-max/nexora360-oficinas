import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as winston from 'winston';
import { ExceptionsInterceptor } from './interceptors/exceptions.interceptor';

async function bootstrap() {
  // GlitchTip error tracking (uses Sentry SDK)
  if (process.env.GLITCHTIP_DSN) {
    Sentry.init({
      dsn: process.env.GLITCHTIP_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,
    });
    Logger.log('GlitchTip/Sentry initialized', 'Bootstrap');
  }

  const app = await NestFactory.create(AppModule);
  
  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4200', 'http://localhost:8100'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Exceptions interceptor
  app.useGlobalInterceptors(new ExceptionsInterceptor());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Nexora AG API')
    .setDescription('Backend para sistema de gestão de oficina - Nexora AG')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Server running on http://${process.env.HOST || 'localhost'}:${port}`, 'Bootstrap');
  Logger.log(`📝 Swagger documentation available at http://${process.env.HOST || 'localhost'}:${port}/api`, 'Swagger');
  Logger.log(`🏥 Health checks available at http://${process.env.HOST || 'localhost'}:${port}/health`, 'Health');
}

bootstrap();
