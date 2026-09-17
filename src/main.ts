import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
bootstrapApplication(AppComponent).catch(error => { console.error('Unable to start Prompt Queue', error); document.body.textContent = 'Prompt Queue could not start. Please reload the page.'; });
