import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { AppRoute, MountedApplication } from '@platypus/mfe-contract';
import {
  StylesheetRegistry,
  validateConfiguration,
  validateModule,
  validateMountHandle,
  type RemoteName,
} from './runtime';

import { loadFederatedModule } from './federation';

const stylesheets = new StylesheetRegistry();

interface Activation {
  id: number;
  controller: AbortController;
  releases: Array<() => void>;
  application?: MountedApplication;
}

@Component({
  selector: 'ps-remote-host',
  template: ` @if (state() === 'loading') {
      <section class="remote-status" role="status" aria-live="polite">
        <div class="loader" aria-hidden="true"></div>
        <h1>Opening {{ title }}...</h1>
        <p>Your workspace section is loading.</p>
      </section>
    }
    @if (state() === 'error') {
      <section class="remote-status error" role="alert">
        <p class="eyebrow">SECTION UNAVAILABLE</p>
        <h1>We could not open {{ title }}.</h1>
        <p>{{ message() }}</p>
        <div class="actions">
          <button type="button" (click)="retry()">Retry</button>
          <button type="button" class="secondary" (click)="reload()">
            Reload page
          </button>
        </div>
        <p class="error-help">
          You can still choose another section from the menu.
        </p>
      </section>
    }
    <div
      #container
      [hidden]="state() !== 'ready'"
      [attr.aria-busy]="state() === 'loading'"
    ></div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .remote-status {
        background: #fff;
        border: 1px solid #e5e8f1;
        border-radius: 16px;
        padding: 42px;
      }
      h1 {
        font-size: 25px;
        font-weight: 650;
        margin: 14px 0;
        letter-spacing: -0.025em;
      }
      p {
        font-size: 14px;
        color: #697189;
        line-height: 1.7;
      }
      .loader {
        border: 3px solid #e8e8fb;
        border-top-color: #6160df;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      button {
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 10px 16px;
        border: 1px solid #6160df;
        border-radius: 8px;
        background: #6160df;
        color: #fff;
        cursor: pointer;
      }
      .secondary {
        background: #fff;
        color: #5656bd;
        border-color: #dcdff0;
      }
      .error-help {
        font-size: 12px;
        margin-top: 24px;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .loader {
          animation: none;
        }
      }
    `,
  ],
})
export class RemoteHost implements AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true })
  private container!: ElementRef<HTMLElement>;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly name = this.route.snapshot.data['remote'] as RemoteName;
  readonly title = this.name === 'analytics' ? 'Analytics' : 'Administration';
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly message = signal('');
  private generation = 0;
  private active?: Activation;
  private destroyed = false;

  ngAfterViewInit(): void {
    void this.activate();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.dispose();
  }
  retry(): void {
    void this.activate();
  }
  reload(): void {
    window.location.reload();
  }

  private isCurrent(activation: Activation): boolean {
    return (
      !this.destroyed &&
      this.active === activation &&
      !activation.controller.signal.aborted
    );
  }

  private dispose(): void {
    const previous = this.active;
    this.active = undefined;
    if (!previous) return;
    previous.controller.abort();
    try {
      previous.application?.unmount();
    } catch (error) {
      console.error('Remote cleanup failed.', error);
    } finally {
      for (const release of previous.releases) release();
      this.container?.nativeElement.replaceChildren();
    }
  }

  private fail(activation: Activation, error: unknown): void {
    if (!this.isCurrent(activation)) return;
    console.error('Remote application failed.', error);
    this.dispose();
    this.message.set(
      error instanceof Error
        ? error.message
        : 'The application could not be loaded.',
    );
    this.state.set('error');
  }

  private async activate(): Promise<void> {
    this.dispose();
    if (this.destroyed) return;
    const activation: Activation = {
      id: ++this.generation,
      controller: new AbortController(),
      releases: [],
    };
    this.active = activation;
    this.state.set('loading');
    this.message.set('');
    const configTimeout = setTimeout(() => {
      this.fail(
        activation,
        new Error('Timed out loading workspace configuration.'),
      );
    }, 10000);
    try {
      const response = await fetch('/runtime-config.json', {
        cache: 'no-store',
        signal: activation.controller.signal,
      });
      if (!response.ok)
        throw new Error('Workspace configuration could not be loaded.');
      const config = validateConfiguration(await response.json());
      clearTimeout(configTimeout);
      if (!this.isCurrent(activation)) return;
      const remote = config.remotes[this.name];
      const styleLeases = remote.cssUrls.map((url) => stylesheets.acquire(url));
      activation.releases.push(...styleLeases.map((lease) => lease.release));
      await Promise.all(styleLeases.map((lease) => lease.ready));
      if (!this.isCurrent(activation)) return;
      const module = validateModule(
        await loadFederatedModule(this.name, remote),
      );
      if (!this.isCurrent(activation)) return;
      const application = module.mount({
        container: this.container.nativeElement,
        route: ('/' + this.name) as AppRoute,
        locale: 'en',
        signal: activation.controller.signal,
        navigate: (route) => {
          if (
            this.isCurrent(activation) &&
            ['/analytics', '/administration'].includes(route)
          ) {
            void this.router.navigateByUrl(route);
          }
        },
        onError: (error) => {
          // A mount callback can fail synchronously before its handle is returned.
          queueMicrotask(() => this.fail(activation, error));
        },
      });
      validateMountHandle(application);
      if (!this.isCurrent(activation)) {
        application.unmount();
        return;
      }
      activation.application = application;
      this.state.set('ready');
    } catch (error) {
      this.fail(activation, error);
    } finally {
      clearTimeout(configTimeout);
    }
  }
}
