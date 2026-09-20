import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  /*
  Depends on an id that only exists at runtime, so it cannot be prerendered.
  The screen fetches the place in the browser anyway.
  */
  {
    path: 'place/:id/edit',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
