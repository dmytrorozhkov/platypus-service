export type AppRoute = '/analytics' | '/administration' | '/support/tickets';

export interface MountContext {
  container: HTMLElement;
  route: AppRoute;
  locale: 'en';
  signal: AbortSignal;
  navigate: (route: AppRoute) => void;
  onError: (error: unknown) => void;
}

export interface MountedApplication {
  unmount(): void;
}

export interface RemoteModuleV1 {
  contractVersion: 1;
  mount(context: MountContext): MountedApplication;
}
