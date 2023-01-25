import './env';

import express from 'express';

import * as handlers from './routes';
import { attachRoutes } from './server';
import { loadPlayground } from './playground/loadPlayground';

const PORT = 4000;

const app = express();
app.disable('x-powered-by');
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
