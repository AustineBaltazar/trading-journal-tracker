import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { applyTheme, resolveTheme, storedPref } from './app/theme';

// Before the first paint, so a light-mode user doesn't see a dark flash
applyTheme(resolveTheme(storedPref()));

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
