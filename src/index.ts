import express from 'express';

import * as handlers from './routes';
import { attachRoutes } from './server';

const PORT = 4000;

const app = express();
app.disable('x-powered-by');

const middleware = attachRoutes(...Object.values(handlers));
app.use(middleware);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on http://localhost:${PORT}`);
});
