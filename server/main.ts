import { NestFactory } from '@nestjs/core';
import { ApplicationModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(ApplicationModule);
  app.setGlobalPrefix('api');
  const server = await app.listen(4200);
  server.setTimeout(1800000);
}
bootstrap();
