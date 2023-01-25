import type { Application } from 'express';

export function attachHandlers(app: Application) {
  app.disable('x-powered-by');
}
