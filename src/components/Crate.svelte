<script lang="ts">
import type { ClientRecord } from "../../lib/get-discogs-collection";

type Props = { records: ClientRecord[]; split?: boolean };
const { records, split = false }: Props = $props();

// --- geometry tuning ---------------------------------------------------
const SPREAD = 78; // px between adjacent sleeve centres
const TILT = 40; // deg the sleeves lean as they recede
const DEPTH = 60; // px each step pushes back in Z
// The focused record floats forward so a tilted neighbour (whose near edge
// rotates toward the viewer) can never clip through its plane.
const POP = 72;
const STEP = 130; // px of drag that advances one record
const SCALE_FALLOFF = 0.07;
const BRIGHT_FALLOFF = 0.12;
const FADE_START = 4; // records this far out begin fading
const FADE_RANGE = 4;
const WINDOW = 9; // only render this many sleeves either side of centre

const count = records.length;

let active = $state(0);
let dragging = $state(false);
let dragDx = $state(0);
let reduceMotion = $state(false);
// Suppresses the slide transition for the one-off random landing on mount.
let snapInstant = $state(false);

let stageEl: HTMLDivElement;
let startX = 0;
let moved = false;
let started = false;
let wheelAccum = 0;

const current = $derived(records[active]);
const announce = $derived(
  current
    ? `Now showing ${current.title} by ${current.artist}, ${active + 1} of ${count}`
    : ""
);

// Render only the sleeves near the centre so a large crate stays light.
const visible = $derived(
  records
    .map((record, index) => ({ record, index }))
    .filter(({ index }) => Math.abs(index - active) <= WINDOW)
);

function clamp(value: number): number {
  return Math.max(0, Math.min(count - 1, value));
}

function setActive(next: number) {
  active = clamp(next);
}

// Just the medium: "LP, Album" → "LP", "12\", 45 RPM, Single" → "12\"".
function shortFormat(record: ClientRecord): string {
  return (record.formatDetail ?? record.format).split(",")[0].trim();
}

function itemStyle(index: number): string {
  const offset = index - active + dragDx / STEP;
  const distance = Math.abs(offset);
  const tiltUnit = Math.max(-1.5, Math.min(1.5, offset));
  const rotateY = -tiltUnit * TILT;
  const x = offset * SPREAD;
  // 1 at the centre, ramping to 0 by the next slot — drives the forward float
  // and lift so the focused record transitions smoothly during a drag.
  const focus = Math.max(0, 1 - distance);
  const z = -distance * DEPTH + focus * POP;
  const scale = Math.max(0.6, 1 - distance * SCALE_FALLOFF);
  const lift = -focus * 14;
  const brightness = Math.max(0.42, 1 - Math.min(distance, 4) * BRIGHT_FALLOFF);
  const blur = distance > 3 ? Math.min((distance - 3) * 0.7, 2.4) : 0;
  const opacity =
    distance > FADE_START
      ? Math.max(0, 1 - (distance - FADE_START) / FADE_RANGE)
      : 1;
  const zIndex = 1000 - Math.round(distance * 10);
  const pointer = opacity < 0.12 ? "none" : "auto";
  const filter = `brightness(${brightness.toFixed(2)})${blur ? ` blur(${blur.toFixed(2)}px)` : ""}`;
  return (
    `transform:translate3d(${x.toFixed(2)}px, ${lift}px, ${z.toFixed(1)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)});` +
    `z-index:${zIndex};opacity:${opacity.toFixed(2)};filter:${filter};pointer-events:${pointer};` +
    (dragging || snapInstant ? "transition:none;" : "")
  );
}

// --- pointer drag ------------------------------------------------------
function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === "mouse") {
    return;
  }
  dragging = true;
  moved = false;
  dragDx = 0;
  startX = event.clientX;
  stageEl.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) {
    return;
  }
  dragDx = event.clientX - startX;
  if (Math.abs(dragDx) > 4) {
    moved = true;
  }
}

function onPointerUp() {
  if (!dragging) {
    return;
  }
  setActive(Math.round(active - dragDx / STEP));
  dragDx = 0;
  dragging = false;
}

function onSleeveClick(index: number) {
  if (moved) {
    return;
  }
  setActive(index);
}

function onWheel(event: WheelEvent) {
  const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
  if (!(horizontal || event.shiftKey)) {
    return; // vertical scroll belongs to the page
  }
  wheelAccum += horizontal ? event.deltaX : event.deltaY;
  if (Math.abs(wheelAccum) >= 40) {
    setActive(active + (wheelAccum > 0 ? 1 : -1));
    wheelAccum = 0;
  }
}

function onKeyDown(event: KeyboardEvent) {
  const moves: Record<string, number> = {
    ArrowLeft: active - 1,
    ArrowRight: active + 1,
    Home: 0,
    End: count - 1,
    PageUp: active - 5,
    PageDown: active + 5,
  };
  if (event.key in moves) {
    event.preventDefault();
    setActive(moves[event.key]);
  }
}

$effect(() => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotion = query.matches;
  const onChange = (event: MediaQueryListEvent) => {
    reduceMotion = event.matches;
  };
  query.addEventListener("change", onChange);

  const timers: ReturnType<typeof setTimeout>[] = [];

  // Open on a random record so every visit is a fresh dig. SSR renders index 0
  // (so no-JS degrades cleanly and hydration matches); we land instantly here,
  // with no sweep. Reduced-motion visitors keep the stable alphabetical start.
  if (!started) {
    started = true;
    if (!query.matches && count > 1) {
      snapInstant = true;
      active = Math.floor(Math.random() * count);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          snapInstant = false;
          // One-shot nudge: a gentle tug that peeks the neighbouring sleeves,
          // hinting the crate is draggable. Animates via the normal transition.
          timers.push(
            setTimeout(() => {
              dragDx = 26;
            }, 550),
            setTimeout(() => {
              dragDx = 0;
            }, 1050)
          );
        })
      );
    }
  }

  return () => {
    query.removeEventListener("change", onChange);
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
});
</script>

<!-- Key handling is delegated to the wrapper so the arrow keys work whether the
     stage or one of the nav buttons holds focus. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="crate" class:split onkeydown={onKeyDown}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="stage"
    class:dragging
    bind:this={stageEl}
    role="group"
    aria-roledescription="Record crate"
    aria-label={`Record collection, ${count} releases. Use arrow keys to browse.`}
    tabindex="0"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
  >
    <div class="spotlight" aria-hidden="true"></div>
    <div class="track">
      {#each visible as { record, index } (record.id)}
        <div class="item" style={itemStyle(index)}>
          {#if record.disc !== "none"}
            <div class="disc" class:out={index === active && !dragging}>
              <div
                class="disc-face disc-{record.disc}"
                class:spinning={index === active && !dragging && !reduceMotion}
              >
                <span class="disc-sheen"></span>
                {#if record.disc === "vinyl"}
                  <span class="disc-label"></span>
                {/if}
                <span class="disc-hole"></span>
              </div>
            </div>
          {/if}
          <button
            class="sleeve"
            class:is-active={index === active}
            type="button"
            tabindex="-1"
            aria-label={`${record.artist} – ${record.title}`}
            aria-pressed={index === active}
            onclick={() => onSleeveClick(index)}
          >
            {#if record.hasCover}
              <img
                class="cover"
                src={record.coverPath}
                alt=""
                width="320"
                height="320"
                draggable="false"
                decoding="async"
                loading={Math.abs(index - active) <= 2 ? "eager" : "lazy"}
              />
            {:else}
              <span class="placeholder">
                <span class="ph-artist">{record.artist}</span>
                <span class="ph-title">{record.title}</span>
              </span>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <div class="info">
  <div class="controls">
    <button
      class="nav"
      type="button"
      aria-label="Previous record"
      disabled={active === 0}
      onclick={() => setActive(active - 1)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          fill="currentColor"
          d="M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414L7.828 11Z"
        /></svg
      >
    </button>
    <p class="position" aria-hidden="true">
      <span class="pos-now">{active + 1}</span><span class="pos-sep">/</span><span
        class="pos-total">{count}</span
      >
    </p>
    <button
      class="nav"
      type="button"
      aria-label="Next record"
      disabled={active === count - 1}
      onclick={() => setActive(active + 1)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          fill="currentColor"
          d="M16.172 11H4v2h12.172l-5.364 5.364 1.414 1.414L20 12l-7.778-7.778-1.414 1.414L16.172 11Z"
        /></svg
      >
    </button>
  </div>

  {#if current}
    <div class="details">
      <p class="now-artist">{current.artist}</p>
      <p class="now-title">{current.title}</p>
      <div class="chips">
        {#if current.year}<span class="chip">{current.year}</span>{/if}
        <span class="chip chip-format">{shortFormat(current)}</span>
        {#each current.genres.slice(0, 2) as genre}
          <span class="chip chip-ghost">{genre}</span>
        {/each}
      </div>
      <a
        class="discogs-link"
        href={current.discogsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Discogs
        <svg viewBox="0 0 24 24" aria-hidden="true"
          ><path fill="currentColor" d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" /></svg
        >
      </a>
    </div>
  {/if}

  <p class="hint" aria-hidden="true">Drag to flip · scroll · or use ← →</p>
  </div>

  <div class="wall">
    <p class="wall-label">The whole crate</p>
    <div class="wall-grid">
      {#each records as record, index (record.id)}
        <button
          class="tile"
          class:tile-active={index === active}
          type="button"
          aria-label={`${record.artist} – ${record.title}`}
          aria-pressed={index === active}
          onclick={() => setActive(index)}
        >
          {#if record.hasCover}
            <img
              class="tile-cover"
              src={record.coverPath}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            />
          {:else}
            <span class="tile-ph">{record.title}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <p class="sr-only" aria-live="polite">{announce}</p>
</div>

<style>
  .crate {
    --ease-crate: cubic-bezier(0.16, 1, 0.3, 1);
    /* The coverflow sits inside a normal site card, so the page reads as part of
       kaylee.dev rather than its own separate world. */
    --stage-bg: var(--card);
    --stage-ring: var(--border);
    --stage-shadow: 0 1px 2px rgba(15, 23, 42, 0.06),
      0 16px 40px -28px rgba(76, 29, 149, 0.3);
    --spot-strength: 0.05;
    --sleeve-shadow: 0 1px 1px rgba(15, 23, 42, 0.18),
      0 18px 34px -16px rgba(30, 17, 64, 0.5);
    --disc-core: var(--card);
    --hint: var(--muted-foreground);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    /* The stage has `perspective`, so its 3D-transformed sleeves escape its own
       clip; clipping here on the non-3D wrapper reliably contains them and stops
       horizontal page scroll on narrow screens. */
    overflow-x: clip;
  }

  :global(html.dark) .crate {
    --stage-shadow: 0 1px 2px rgba(0, 0, 0, 0.4),
      0 16px 40px -28px rgba(0, 0, 0, 0.7);
    --spot-strength: 0.16;
    --sleeve-shadow: 0 2px 2px rgba(0, 0, 0, 0.5),
      0 24px 44px -18px rgba(0, 0, 0, 0.8);
  }

  .info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  /* Split layout (option 2): record meta on the left, artwork on the right.
     Collapses back to the stacked layout below md so mobile stays single-column. */
  @media (min-width: 768px) {
    .crate.split {
      display: grid;
      grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
      /* Top-align both columns and put the controls ABOVE the title, so a title
         of any length — even a 7-line one — can never move the prev/next
         buttons. The title grows downward into otherwise-empty space. */
      align-items: start;
      /* generous gap BETWEEN the columns, tight gap DOWN to the cover wall */
      column-gap: clamp(1.5rem, 4vw, 3rem);
      row-gap: 1.25rem;
    }
    .crate.split .stage {
      order: 1;
      /* tighter around the coverflow so the card isn't mostly empty space */
      height: clamp(250px, 26vw, 300px);
    }
    .crate.split .info {
      order: 0;
      align-items: flex-start;
      text-align: left;
    }
    .crate.split .controls {
      order: 0;
      margin: 0 0 1.25rem;
    }
    .crate.split .details {
      order: 1;
      margin-top: 0;
      max-width: none;
      text-align: left;
    }
    .crate.split .hint {
      order: 2;
      margin-top: 0.9rem;
    }
    .crate.split .chips {
      justify-content: flex-start;
    }
    .crate.split .now-title {
      font-size: clamp(1.6rem, 2.4vw, 2.5rem);
    }
    /* Smaller sleeves in the narrower column reveal more of the fan, signalling
       it's a browsable stack rather than a single static cover. */
    .crate.split .item {
      width: clamp(140px, 22vw, 240px);
      height: clamp(140px, 22vw, 240px);
    }
    /* The cover wall spans the full width beneath the meta|artwork row; the
       grid row-gap above already spaces it, so drop the stacked margin. */
    .crate.split .wall {
      grid-column: 1 / -1;
      order: 2;
      margin-top: 0;
    }
  }

  .stage {
    position: relative;
    width: 100%;
    height: clamp(300px, 52vw, 430px);
    border-radius: 14px;
    background: var(--stage-bg);
    box-shadow: var(--stage-shadow);
    border: 1px solid var(--stage-ring);
    /* clip (not hidden) reliably contains the 3D-transformed sleeves so they
       can't spill past the stage and trigger horizontal page scroll on mobile. */
    overflow: clip;
    perspective: 1500px;
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
  }

  .stage.dragging {
    cursor: grabbing;
  }

  .stage:focus-visible {
    outline: 2px solid var(--primary);
    /* Inset so the wrapper's overflow-x clip can't shave the ring's sides. */
    outline-offset: -3px;
  }

  .spotlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      42% 52% at 50% 40%,
      color-mix(in oklab, var(--primary) calc(var(--spot-strength) * 100%), transparent),
      transparent 72%
    );
  }

  .track {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    display: grid;
    place-items: center;
  }

  .item {
    position: absolute;
    width: clamp(150px, 40vw, 300px);
    height: clamp(150px, 40vw, 300px);
    transform-style: preserve-3d;
    transition:
      transform 0.6s var(--ease-crate),
      opacity 0.45s ease,
      filter 0.45s ease;
    will-change: transform;
  }

  .disc {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 50%;
    transform: translateX(0);
    transition: transform 0.7s var(--ease-crate);
  }

  .disc.out {
    transform: translateX(42%);
  }

  .disc-face {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: 0 10px 26px -10px rgba(0, 0, 0, 0.65);
  }

  .disc-vinyl {
    background:
      repeating-radial-gradient(
        circle at 50% 50%,
        rgba(255, 255, 255, 0.05) 0 0.5px,
        rgba(0, 0, 0, 0) 0.6px 2.4px
      ),
      radial-gradient(circle at 50% 50%, #1b1b20 0 16.5%, transparent 17%),
      #08080a;
  }

  .disc-cd {
    background:
      conic-gradient(
        from 210deg at 50% 50%,
        #d8dadd,
        #c4b5e8,
        #b6e9df,
        #ffe1ec,
        #cdd0d4,
        #d8dadd
      );
  }

  .disc-sheen {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(
      circle at 36% 30%,
      rgba(255, 255, 255, 0.28),
      transparent 42%
    );
  }

  .disc-label {
    position: absolute;
    inset: 33%;
    border-radius: 50%;
    background: radial-gradient(
      circle at 38% 34%,
      color-mix(in oklab, var(--primary) 78%, white),
      var(--primary)
    );
  }

  .disc-hole {
    position: absolute;
    inset: 47.5%;
    border-radius: 50%;
    background: var(--disc-core);
  }

  .disc-cd .disc-hole {
    inset: 43%;
  }

  .spinning {
    animation: crate-spin 4.6s linear infinite;
  }

  @keyframes crate-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .sleeve {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: block;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    background: var(--card);
    box-shadow: var(--sleeve-shadow);
    overflow: hidden;
    cursor: pointer;
  }

  :global(html.dark) .sleeve {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.35rem;
    width: 100%;
    height: 100%;
    padding: 14%;
    background: linear-gradient(
      145deg,
      color-mix(in oklab, var(--primary) 18%, var(--card)),
      var(--card)
    );
    text-align: left;
  }

  .ph-artist {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--primary);
  }

  .ph-title {
    font-size: 1.05rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--foreground);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.4rem;
  }

  .nav {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    cursor: pointer;
    transition:
      transform 0.18s var(--ease-crate),
      border-color 0.18s ease,
      color 0.18s ease,
      background-color 0.18s ease;
  }

  .nav svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .nav:hover:not(:disabled) {
    color: var(--primary);
    border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
    transform: translateY(-1px);
  }

  .nav:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .nav:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .position {
    min-width: 4.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground);
  }

  .pos-now {
    font-weight: 800;
    color: var(--foreground);
  }

  .pos-sep {
    margin: 0 0.35rem;
    opacity: 0.5;
  }

  .details {
    width: 100%;
    max-width: 36rem;
    margin-top: 1.6rem;
    margin-inline: auto;
    text-align: center;
  }

  .now-artist {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--primary);
  }

  .now-title {
    margin-top: 0.2rem;
    font-size: clamp(1.25rem, 5vw, 2.1rem);
    font-weight: 800;
    line-height: 1.12;
    text-wrap: balance;
    overflow-wrap: anywhere;
    color: var(--foreground);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: 0.28rem 0.7rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    color: color-mix(in oklab, var(--primary) 72%, var(--foreground));
  }

  .chip-format {
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .chip-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted-foreground);
  }

  .discogs-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 1.2rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--muted-foreground);
    transition: color 0.18s ease;
  }

  .discogs-link svg {
    width: 0.95rem;
    height: 0.95rem;
    transition: transform 0.18s var(--ease-crate);
  }

  .discogs-link:hover {
    color: var(--primary);
  }

  .discogs-link:hover svg {
    transform: translate(2px, -2px);
  }

  .discogs-link:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
    border-radius: 6px;
  }

  .hint {
    margin-top: 1.6rem;
    font-size: 0.78rem;
    color: var(--hint);
    letter-spacing: 0.01em;
  }

  .wall {
    width: 100%;
    margin-top: clamp(2rem, 5vw, 3.5rem);
  }

  .wall-label {
    margin-bottom: 0.9rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .wall-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 0.6rem;
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--card);
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition:
      transform 0.18s var(--ease-crate),
      box-shadow 0.18s ease,
      outline-color 0.18s ease;
  }

  .tile-cover {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tile:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.45);
  }

  .tile:focus-visible {
    outline-color: var(--primary);
  }

  .tile-active {
    border-color: transparent;
    outline-color: var(--primary);
  }

  .tile-ph {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: 4px;
    font-size: 0.5rem;
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    color: var(--muted-foreground);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
