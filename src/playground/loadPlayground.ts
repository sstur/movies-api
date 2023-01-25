import fetch from 'node-fetch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Application } from 'express';

export function loadPlayground(app: Application) {
  app.get('/playground', (request, response, next) => {
    (async () => {
      const fetchResponse = await fetch('https://rest-playground.github.io/');
      let html = await fetchResponse.text();
      html = html.replace(
        '<script',
        `<script>history.replaceState({}, null, '/')</script><script`,
      );
      response.send(html);
    })().catch(next);
  });

  app.use(
    createProxyMiddleware(['/_nuxt', '/images'], {
      target: 'https://rest-playground.github.io',
      changeOrigin: true,
    }),
  );
}
