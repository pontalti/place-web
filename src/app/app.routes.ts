import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./home/home').then(r => r.Home)
    },
    {
        path: 'place/new',
        loadComponent: () => import('./place-form/place-form').then(r => r.PlaceFormComponent)
    }
    ,
    {
        path: 'place/list',
        loadComponent: () => import('./place-list/place-list').then(r => r.PlaceListComponent)
    }

];

