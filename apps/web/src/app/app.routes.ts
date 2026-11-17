import { Routes } from '@angular/router';
import { testi } from './testi/it';
import { Home } from './pagine/home/home';

export const routes: Routes = [
  { path: '', component: Home, title: testi.app.titolo },
  { path: '**', redirectTo: '' },
];
