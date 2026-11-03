<template>
  <section
    class="ps-administration ad:font-sans ad:text-ink"
    aria-labelledby="administration-title"
  >
    <div
      class="ad:mb-3.5 ad:text-[10px] ad:font-[650] ad:tracking-[.15em] ad:text-eyebrow"
    >
      YOUR WORKSPACE
    </div>
    <div class="ad:flex ad:items-center ad:gap-3.5">
      <h1
        id="administration-title"
        class="ad:m-0 ad:text-[clamp(28px,4vw,34px)] ad:leading-[1.2] ad:font-[650] ad:tracking-[-.045em]"
      >
        Administration
      </h1>
      <span
        class="ad:rounded-md ad:border ad:border-solid ad:border-[#d8ebe3] ad:bg-[#eef8f2] ad:px-2 ad:py-1 ad:text-[10px] ad:font-[650] ad:text-[#46856b]"
        >Vue</span
      >
    </div>
    <p class="ad:mt-3.5 ad:mb-9 ad:text-sm ad:leading-[1.7] ad:text-muted">
      A dedicated space to manage your service workspace.
    </p>
    <div
      data-workspace-card
      class="ad:rounded-panel ad:border ad:border-solid ad:border-line ad:bg-white ad:px-6 ad:pt-[52px] ad:pb-10 ad:text-center ad:shadow-panel"
    >
      <div
        class="ad:mx-auto ad:mb-[26px] ad:grid ad:size-[76px] ad:place-items-center ad:rounded-[22px] ad:bg-admin-surface ad:text-admin-accent"
        aria-hidden="true"
      >
        <svg class="ad:size-[42px]" viewBox="0 0 48 48">
          <rect x="10" y="10" width="11" height="11" rx="2" />
          <rect x="27" y="10" width="11" height="11" rx="2" />
          <rect x="10" y="27" width="11" height="11" rx="2" />
          <rect x="27" y="27" width="11" height="11" rx="2" />
        </svg>
      </div>
      <div
        class="ad:text-[9px] ad:font-[650] ad:tracking-[.15em] ad:text-[#9296ad]"
      >
        ADMINISTRATION WORKSPACE
      </div>
      <h2
        class="ad:mt-[13px] ad:mb-3 ad:text-[23px] ad:font-semibold ad:tracking-[-.025em]"
      >
        Your workspace, organized.
      </h2>
      <p class="ad:m-0 ad:text-[13px] ad:leading-[1.9] ad:text-card-copy">
        This section is ready for the next stage.<br />Administration tools will
        be added as we build.
      </p>
      <div
        class="ad:mt-7 ad:flex ad:items-center ad:justify-center ad:gap-[7px] ad:text-[10px] ad:font-[550] ad:text-ready"
      >
        <span class="ad:size-1.5 ad:rounded-full ad:bg-ready-dot"></span
        >Workspace connected
      </div>
    </div>
    <div
      class="ad:mt-5 ad:flex ad:items-center ad:gap-2 ad:text-[11px] ad:leading-[1.6] ad:text-note"
    >
      <span class="ad:text-[17px] ad:text-[#7d7bb7]" aria-hidden="true">↗</span
      >An independent application within Platypus Service.
    </div>
  </section>
</template>
