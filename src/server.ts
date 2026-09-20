import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { apiProxy } from './api-proxy';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Backend the `/api` calls are forwarded to. Inside docker compose the
 * service name resolves (`http://api:8080`); the default covers running the
 * SSR server on the host against a local backend.
 */
const apiTarget = process.env['API_TARGET'] ?? 'http://localhost:8080';

const app = express();
/**
 * Angular 22 validates the `Host` header against an allowlist to prevent SSRF,
 * and discards the `Forwarded` and all `X-Forwarded-*` headers by default.
 *
 * Behind Apache (docker/apache-vhost.conf) we need to trust those headers so
 * the app sees the client's original host and protocol rather than the ones
 * from the internal proxy.
 *
 * The allowed host list comes from `security.allowedHosts` in angular.json;
 * `NG_ALLOWED_HOSTS` can extend it at runtime without a rebuild.
 */
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: [
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-forwarded-port',
    // Sent by Apache's mod_proxy on every request. Without them on the list,
    // Angular drops them and logs a warning. x-forwarded-for is the one that
    // carries the client's real IP.
    'x-forwarded-for',
    'x-forwarded-server',
  ],
});

/**
 * Forward the API calls to the backend.
 *
 * Mounted first, and above all before the Angular handler: that one matches
 * every path, so anything registered after it is never reached. What
 * `proxy.conf.json` does for `ng serve`, this does for the built server —
 * the production build never reads that file.
 *
 * Keeping both behind one origin is also what keeps CORS out of the picture:
 * the browser only ever talks to this server.
 */
app.use('/api', apiProxy(apiTarget));

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const portEnv = process.env['PORT'];
  const port = portEnv !== undefined && portEnv !== '' ? Number(portEnv) : 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
    console.log(`Proxying /api to ${apiTarget}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
