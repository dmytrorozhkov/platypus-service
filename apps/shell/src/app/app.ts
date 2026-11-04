import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'ps-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div
      class="workspace sh:grid sh:min-h-dvh sh:grid-cols-[250px_minmax(0,1fr)] sh:max-wide:grid-cols-1"
    >
      <aside
        class="sh:flex sh:flex-col sh:bg-sidebar sh:px-5 sh:pt-8 sh:pb-6 sh:text-sidebar-text sh:max-wide:p-[18px]"
        aria-label="Workspace navigation"
      >
        <a
          class="sh:mx-2.5 sh:mb-12 sh:flex sh:items-center sh:gap-3 sh:text-[19px] sh:font-[650] sh:text-white sh:no-underline sh:max-wide:mx-0 sh:max-wide:mb-5"
          routerLink="/analytics"
          aria-label="Platypus Service home"
        >
          <img src="/favicon.svg" width="38" height="38" alt="" />
          <span
            >Platypus<span
              class="sh:mt-[3px] sh:block sh:text-[11px] sh:font-normal sh:tracking-[.025em] sh:text-[#999eb7]"
              >Service workspace</span
            ></span
          >
        </a>
        <p
          class="sh:mx-[15px] sh:mb-3.5 sh:text-[10px] sh:tracking-[.16em] sh:text-[#9096b3] sh:max-wide:hidden"
        >
          WORKSPACE
        </p>
        <nav
          class="workspace-nav sh:grid sh:gap-2 sh:max-wide:grid-cols-2"
          aria-label="Main"
        >
          <a
            class="sh:flex sh:items-center sh:gap-3 sh:rounded-[9px] sh:px-3.5 sh:py-[13px] sh:text-sm sh:no-underline sh:[&:not(.active):hover]:bg-[#242a48] sh:max-wide:gap-2 sh:max-wide:px-2.5 sh:max-wide:py-3 sh:max-wide:text-xs"
            routerLink="/analytics"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 19V5m0 14h16M8 15v-4m5 4V7m5 8v-6" />
            </svg>
            Analytics
            <span
              class="sh:ml-auto sh:text-[23px] sh:leading-[14px] sh:opacity-70"
              aria-hidden="true"
              >&rsaquo;</span
            >
          </a>
          <a
            class="sh:flex sh:items-center sh:gap-3 sh:rounded-[9px] sh:px-3.5 sh:py-[13px] sh:text-sm sh:no-underline sh:[&:not(.active):hover]:bg-[#242a48] sh:max-wide:gap-2 sh:max-wide:px-2.5 sh:max-wide:py-3 sh:max-wide:text-xs"
            routerLink="/administration"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
            Administration
            <span
              class="sh:ml-auto sh:text-[23px] sh:leading-[14px] sh:opacity-70"
              aria-hidden="true"
              >&rsaquo;</span
            >
          </a>
          <a
            class="sh:flex sh:items-center sh:gap-3 sh:rounded-[9px] sh:px-3.5 sh:py-[13px] sh:text-sm sh:no-underline sh:[&:not(.active):hover]:bg-[#242a48] sh:max-wide:gap-2 sh:max-wide:px-2.5 sh:max-wide:py-3 sh:max-wide:text-xs"
            routerLink="/support/tickets"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            ><svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" />
              <path d="M8 9h8M8 13h6" /></svg
            >Tickets<span
              class="sh:ml-auto sh:text-[23px] sh:leading-[14px] sh:opacity-70"
              aria-hidden="true"
              >&rsaquo;</span
            ></a
          >
        </nav>
        <div
          class="sh:mt-auto sh:flex sh:items-center sh:gap-[9px] sh:px-3.5 sh:pt-[34px] sh:text-[11px] sh:text-[#a3aac5] sh:max-wide:hidden"
        >
          <span class="sh:size-[7px] sh:rounded-full sh:bg-[#71d3b3]"></span
          >Local development
        </div>
      </aside>
      <div class="sh:flex sh:min-w-0 sh:flex-col">
        <header
          class="sh:flex sh:h-20 sh:items-center sh:justify-between sh:gap-4 sh:border-b sh:border-[#e7e9f1] sh:bg-white sh:px-11 sh:text-xs sh:text-[#697189] sh:max-wide:h-[62px] sh:max-wide:px-[22px]"
        >
          <span
            >Platypus Service
            <span class="sh:px-3.5 sh:text-[#c0c5d5]">/</span> Workspace</span
          >
          <span
            class="sh:rounded-[5px] sh:border sh:border-[#e2e4f3] sh:bg-[#eff0fb] sh:px-[9px] sh:py-[5px] sh:text-[9px] sh:font-bold sh:tracking-[.12em] sh:text-[#62658d]"
            >LOCAL</span
          >
        </header>
        <main
          id="main-content"
          class="sh:mx-auto sh:w-full sh:max-w-[1440px] sh:flex-1 sh:px-11 sh:py-12 sh:max-wide:px-[22px] sh:max-wide:py-8"
        >
          <router-outlet />
        </main>
        <footer
          class="sh:flex sh:justify-between sh:gap-4 sh:border-t sh:border-[#e7e9f1] sh:px-11 sh:py-[22px] sh:text-[11px] sh:text-[#9197aa] sh:max-wide:flex-wrap sh:max-wide:px-[22px] sh:max-wide:py-5"
        >
          Platypus Service<span>Frontend foundation &middot; 01</span>
        </footer>
      </div>
    </div>
  `,
})
export class App {}
