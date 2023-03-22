import './env';

import express from 'express';
import cors from 'cors';

import * as handlers from './routes';
import { attachRoutes } from './server';
import { loadPlayground } from './playground/loadPlayground';
import { loadMoviesFromApi } from './api/Api';

const PORT = 4000;

async function main() {
  await loadMoviesFromApi();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  loadPlayground(app);

  const middleware = attachRoutes(...Object.values(handlers));
  app.use(middleware);

  app.get('/', (request, response) => {
    response.send(`<p>Open the <a href="/playground">REST Playground</a></p>`);
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
