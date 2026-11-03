import '@platypus/theme/standalone.css';
import { mount } from './remote';

const controller = new AbortController();
const container = document.querySelector<HTMLElement>('#app');
if (!container)
  throw new Error('Standalone Administration container is missing.');
mount({
  container,
  route: '/administration',
  locale: 'en',
  signal: controller.signal,
  navigate: (route) => {
    window.location.href = 'http://localhost:4200' + route;
  },
  onError: (error) => {
    console.error('Administration failed.', error);
    controller.abort();
    container.textContent = 'Administration could not be loaded.';
  },
});
window.addEventListener('pagehide', () => controller.abort(), { once: true });
