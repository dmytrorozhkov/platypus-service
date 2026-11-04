import { Component } from '@angular/core';
import { RouterLink, type Routes } from '@angular/router';
import { RemoteHost } from './remote-host/remote-host';

@Component({
  selector: 'ps-not-found',
  imports: [RouterLink],
  template: `<section class="shell-not-found">
    <p class="eyebrow">PAGE NOT FOUND</p>
    <h1>This page is not available.</h1>
    <p>Choose a workspace section from the menu.</p>
    <a routerLink="/analytics">Open Analytics &rarr;</a>
  </section>`,
})
class NotFound {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'analytics' },
  { path: 'analytics', component: RemoteHost, data: { remote: 'analytics' } },
  {
    path: 'administration',
    component: RemoteHost,
    data: { remote: 'administration' },
  },
  {
    path: 'support/tickets',
    component: RemoteHost,
    data: { remote: 'support' },
  },
  { path: '**', component: NotFound },
];
