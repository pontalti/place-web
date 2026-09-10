import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

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
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

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
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
