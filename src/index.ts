import express from 'express';

import { attachHandlers } from './server';

const PORT = 3000;

const app = express();

attachHandlers(app);

app.get('/', (request, response) => {
  response.send(`<h1>Hello world!</h1>`);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on port ${PORT}`);
});
