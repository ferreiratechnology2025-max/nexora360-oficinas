import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const contentLength = req.get('content-length');
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const content = contentLength ? `${contentLength}b` : '';
      const duration = Date.now() - startTime;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${content} ${userAgent} ${duration}ms`,
      );
    });

    next();
  }
}
