import type { NextFunction, Request, Response } from 'express';

/**
 * Headers that describe one hop of the connection and must not be forwarded.
 * Content-length is dropped as well: fetch recomputes it for the body it sends,
 * and a stale value makes the other end wait for bytes that never arrive.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'host'
]);

/**
 * Forwards the API calls of the rendered page to the backend.
 *
 * <p>In development the Angular dev server does this through
 * `proxy.conf.json`, which the production build never reads. Without an
 * equivalent here, the browser would request /api/... from the SSR server,
 * which serves only the application, and every call would come back as the
 * index page or a 404.
 *
 * <p>Keeping both behind one origin also removes CORS from the picture: the
 * browser only ever talks to the SSR server, so the backend needs no
 * cross-origin configuration.
 *
 * <p>Written on the global fetch rather than a proxy library, so the server
 * bundle gains no runtime dependency.
 *
 * @param target backend base URL, e.g. http://api:8080 inside the compose
 *               network
 */
export function apiProxy(target: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    forward(req, res, target).catch(next);
  };
}

async function forward(req: Request, res: Response, target: string): Promise<void> {
  // originalUrl keeps the /api prefix and the query string, which is what the
  // backend is mapped under — no rewriting needed.
  const url = new URL(req.originalUrl, target);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(name)) continue;
    if (typeof value === 'string') {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    }
  }

  /*
   * The body is added only when there is one. Passing `body: undefined`
   * would be rejected under `exactOptionalPropertyTypes`, which treats an
   * explicit undefined as a value rather than as an absent property.
   */
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readBody(req);
  }

  let upstream: Response_;
  try {
    upstream = await fetch(url, init);
  } catch (error) {
    // The backend is down or unreachable: 502 says who failed, and the
    // browser shows the API error instead of a broken page.
    console.error(`[api-proxy] ${req.method} ${url.toString()} failed`, error);
    res.status(502).json({ message: 'The API is not reachable.' });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP.has(name.toLowerCase())) {
      res.setHeader(name, value);
    }
  });

  // 204 and 304 carry no body — DELETE answers 204 here.
  if (upstream.status === 204 || upstream.status === 304) {
    res.end();
    return;
  }

  res.end(Buffer.from(await upstream.arrayBuffer()));
}

/**
 * Collects the request body; Angular's server mounts no body parser.
 *
 * Handed to fetch as an ArrayBuffer: a Node Buffer is typed over
 * ArrayBufferLike, which the DOM's BodyInit does not accept.
 */
function readBody(req: Request): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(toArrayBuffer(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

/** Alias for the DOM Response, shadowed by Express's Response in this file. */
type Response_ = Awaited<ReturnType<typeof fetch>>;
