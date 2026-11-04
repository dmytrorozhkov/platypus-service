import { mount } from './remote';
const container = document.getElementById('support-root');
if (!container) throw new Error('Support root is missing.');
const controller = new AbortController();
const application = mount({
  container,
  route: '/support/tickets',
  locale: 'en',
  signal: controller.signal,
  navigate: () => {},
  onError: (error) => {
    console.error('Support startup failed.', error);
    container.textContent =
      'Support could not start. Reload the page to try again.';
  },
});
window.addEventListener(
  'pagehide',
  () => {
    controller.abort();
    application.unmount();
  },
  { once: true },
);
