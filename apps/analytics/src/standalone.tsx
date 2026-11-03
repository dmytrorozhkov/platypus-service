import '@platypus/theme/standalone.css';
import { mount } from './remote';

const controller = new AbortController();
const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('Standalone Analytics container is missing.');
mount({
  container,
  route: '/analytics',
  locale: 'en',
  signal: controller.signal,
  navigate: (route) => {
    window.location.href = 'http://localhost:4200' + route;
  },
  onError: (error) => {
    console.error('Analytics failed.', error);
    controller.abort();
    container.textContent = 'Analytics could not be loaded.';
  },
});
window.addEventListener('pagehide', () => controller.abort(), { once: true });
