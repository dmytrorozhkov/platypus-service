export function App() {
  return (
    <section
      className="ps-analytics an:font-sans an:text-ink"
      aria-labelledby="analytics-title"
    >
      <div className="an:mb-3.5 an:text-[10px] an:font-[650] an:tracking-[.15em] an:text-eyebrow">
        YOUR WORKSPACE
      </div>
      <div className="an:flex an:items-center an:gap-3.5">
        <h1
          id="analytics-title"
          className="an:m-0 an:text-[clamp(28px,4vw,34px)] an:leading-[1.2] an:font-[650] an:tracking-[-.045em]"
        >
          Analytics
        </h1>
        <span className="an:rounded-md an:border an:border-solid an:border-[#dce6f0] an:bg-[#edf7fa] an:px-2 an:py-1 an:text-[10px] an:font-[650] an:text-[#47849b]">
          React
        </span>
      </div>
      <p className="an:mt-3.5 an:mb-9 an:text-sm an:leading-[1.7] an:text-muted">
        A clear view of your support operations, in one place.
      </p>
      <div
        data-workspace-card
        className="an:rounded-panel an:border an:border-solid an:border-line an:bg-white an:px-6 an:pt-[52px] an:pb-10 an:text-center an:shadow-panel"
      >
        <div
          className="an:mx-auto an:mb-[26px] an:grid an:size-[76px] an:place-items-center an:rounded-[22px] an:bg-analytics-surface an:text-analytics-accent"
          aria-hidden="true"
        >
          <svg className="an:size-[42px]" viewBox="0 0 48 48">
            <path d="M10 36V12m0 24h28M18 29v-8m8 8V14m8 15V19" />
          </svg>
        </div>
        <div className="an:text-[9px] an:font-[650] an:tracking-[.15em] an:text-[#9296ad]">
          ANALYTICS WORKSPACE
        </div>
        <h2 className="an:mt-[13px] an:mb-3 an:text-[23px] an:font-semibold an:tracking-[-.025em]">
          Your analytics starts here.
        </h2>
        <p className="an:m-0 an:text-[13px] an:leading-[1.9] an:text-card-copy">
          This section is ready for the next stage.
          <br />
          Charts and reporting will be added as we build.
        </p>
        <div className="an:mt-7 an:flex an:items-center an:justify-center an:gap-[7px] an:text-[10px] an:font-[550] an:text-ready">
          <span className="an:size-1.5 an:rounded-full an:bg-ready-dot"></span>
          Workspace connected
        </div>
      </div>
      <div className="an:mt-5 an:flex an:items-center an:gap-2 an:text-[11px] an:leading-[1.6] an:text-note">
        <span className="an:text-[17px] an:text-[#7d7bb7]" aria-hidden="true">
          ↗
        </span>
        An independent application within Platypus Service.
      </div>
    </section>
  );
}
