import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { App } from './app/app';
import { routes } from './app/routes';

bootstrapApplication(App, { providers: [provideRouter(routes)] }).catch(
  (error) => console.error('Shell startup failed.', error),
);
