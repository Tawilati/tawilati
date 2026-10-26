// Shown while the menu loads: grey placeholders in the shape of the header, tabs and item boxes.
export default function MenuLoading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-[18px] pt-6" aria-busy="true" aria-label="Loading the menu">
      <div className="h-[22px] w-3/5 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
      <div className="h-5 w-24 animate-pulse rounded-full bg-surface-muted motion-reduce:animate-none" />
      <div className="mt-2 h-12 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-surface-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}
