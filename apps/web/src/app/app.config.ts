import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';
import { routes } from './app.routes';
import { GestoreErrori, gestisciErroreNavigazione } from './core/gestore-errori';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GestoreErrori },
    provideRouter(routes, withNavigationErrorHandler(gestisciErroreNavigazione)),
  ],
};
