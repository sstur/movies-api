import { createApplication } from '@nbit/express';

const { defineRoutes, attachRoutes } = createApplication({
  // getContext: (request) => ({
  //   authenticate: async () => {
  //     const auth = request.headers.get('authorization') ?? '';
  //     const token = auth.replace(/^Bearer /i, '');
  //     // TODO
  //   },
  // }),
});

export { defineRoutes, attachRoutes };
