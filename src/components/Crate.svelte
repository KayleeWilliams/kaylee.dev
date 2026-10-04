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
const DISC_NUDGE = 8; // % of sleeve width the focused record shifts left
const STEP = 130; // px of drag that advances one record
const SCALE_FALLOFF = 0.07;
const BRIGHT_FALLOFF = 0.12;
const FADE_START = 4; // records this far out begin fading
const FADE_RANGE = 4;
const WINDOW = 9; // only render this many sleeves either side of centre
const RING = 2 * Math.PI * 20; // circumference of the play button's progress ring
// The idle spin is 4.6s a turn; playing speeds it to 33⅓ rpm (1.8s a turn).
const PLAYING_SPIN_RATE = 4.6 / 1.8;
const SPIN_RAMP_MS = 900; // a turntable takes a moment to come up to speed

const count = records.length;

let active = $state(0);
let dragging = $state(false);
let dragDx = $state(0);
let reduceMotion = $state(false);
// Suppresses the slide transition for the one-off random landing on mount.
let snapInstant = $state(false);
let playing = $state(false);
// 0–1 position through the 30s clip, for the play button's progress ring.
let progress = $state(0);

let stageEl: HTMLDivElement;
let headingEl: HTMLDivElement;
let audioEl: HTMLAudioElement;
let startX = 0;
let moved = false;
let started = false;
let wheelAccum = 0;
let audioCtx: AudioContext | null = null;

const current = $derived(records[active]);
const preview = $derived(current?.preview ?? null);
const announce = $derived(
  current
    ? `Now showing ${current.titleRoman ?? current.title} by ${current.artistRoman ?? current.artist}, ${active + 1} of ${count}`
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

// Prefer romanized names for screen readers (and English-reading users) when a
// native-script record has a Latin equivalent.
function label(record: ClientRecord): string {
  return `${record.titleRoman ?? record.title} by ${record.artistRoman ?? record.artist}`;
}

// Scale the title down so the artist + title always fit a fixed-height box,
// keeping everything below (chips, link, cover wall) from shifting as titles
// change length. No-op when the heading isn't height-constrained (mobile).
function fitHeading() {
  const box = headingEl;
  const title = box?.querySelector(".now-title") as HTMLElement | null;
  if (!(box && title)) {
    return;
  }
  title.style.fontSize = "";
  let size = Number.parseFloat(getComputedStyle(title).fontSize);
  let guard = 0;
  while (box.scrollHeight > box.clientHeight && size > 11 && guard < 80) {
    size -= 1;
    title.style.fontSize = `${size}px`;
    guard += 1;
  }
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
  // Shift the focused sleeve left by a share of its own width so the pulled
  // disc's extra reach stays inside the stage.
  const nudge = records[index].disc === "none" ? 0 : focus * DISC_NUDGE;
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
    `transform:translate3d(calc(${x.toFixed(2)}px - ${nudge.toFixed(2)}%), ${lift}px, ${z.toFixed(1)}px) rotateY(${rotateY.toFixed(2)}deg) scale(${scale.toFixed(3)});` +
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

  // Open on a random record so every visit is a fresh dig. SSR renders index 0
  // (so no-JS degrades cleanly and hydration matches); we land instantly here,
  // with no sweep. Reduced-motion visitors keep the stable alphabetical start.
  if (!started) {
    started = true;
    // Reveal the crate only once we've landed on the record to show, so the
    // SSR'd index-0 record never flashes before the random landing.
    const reveal = () =>
      stageEl?.closest(".crate-reveal")?.classList.add("is-ready");
    if (!query.matches && count > 1) {
      snapInstant = true;
      active = Math.floor(Math.random() * count);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          snapInstant = false;
          reveal();
        })
      );
    } else {
      // Reduced-motion / single record: no random landing, reveal right away.
      requestAnimationFrame(reveal);
    }
  }

  return () => {
    query.removeEventListener("change", onChange);
  };
});

// Refit the title whenever the record changes. The synchronous pass keeps
// normal navigation flash-free (the DOM already holds the new title by the time
// this runs). The deferred pass covers the random landing on mount: there the
// effect fires in the same flush that sets `active`, before Svelte paints the
// new title, so the sync measure sees the index-0 title and skips scaling — and
// since `current.id` is already the landed record's, it never re-fires. The
// extra frame lets the real title paint, then refits a long one down.
$effect(() => {
  void current?.id;
  fitHeading();
  const frame = requestAnimationFrame(fitHeading);
  return () => cancelAnimationFrame(frame);
});

// Refit on viewport resize (column width changes how the title wraps).
$effect(() => {
  const onResize = () => fitHeading();
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
});

// Stop playback whenever the focused record changes.
$effect(() => {
  void current?.id;
  audioEl?.pause();
  progress = 0;
});

// Compressor so a hot-mastered preview can't blast out after a quiet one.
// Built on first play (an AudioContext needs a user gesture);
// createMediaElementSource may run once per element, hence the guard.
function ensureLimiter() {
  if (audioCtx || !window.AudioContext) {
    return;
  }
  try {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audioEl);
    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -20; // start taming around -20 dB
    limiter.knee.value = 24;
    limiter.ratio.value = 8; // hold loud previews close to the threshold
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    source.connect(limiter);
    limiter.connect(audioCtx.destination);
  } catch {
    audioCtx = null; // unsupported / tainted — fall back to the raw element
  }
}

// The clip is hotlinked from Apple's CDN, loaded only on first play.
async function togglePlay() {
  if (!(preview && audioEl)) {
    return;
  }
  if (audioEl.src !== preview.previewUrl) {
    audioEl.src = preview.previewUrl;
  }
  if (audioEl.paused) {
    ensureLimiter();
    // iOS starts contexts suspended; playing against one is silent.
    await audioCtx?.resume().catch(() => {});
    // The record may have flipped while resume was in flight.
    if (audioEl.src !== preview?.previewUrl) {
      return;
    }
    audioEl.play().catch(() => {
      /* autoplay rejection */
    });
  } else {
    audioEl.pause();
  }
}

function onTimeUpdate() {
  progress = audioEl?.duration ? audioEl.currentTime / audioEl.duration : 0;
}

// timeupdate only fires ~4 times a second, so the ring would step. Sample it
// every frame while playing.
$effect(() => {
  if (!playing) {
    return;
  }
  let frame = requestAnimationFrame(function tick() {
    onTimeUpdate();
    frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
});

// Spin the focused disc up to speed while its preview plays, and back down
// on pause. playbackRate keeps the current angle, so the change is seamless.
$effect(() => {
  const target = playing ? PLAYING_SPIN_RATE : 1;
  // A drag or record change remounts the spin at idle speed; re-apply then.
  void active;
  void dragging;
  const spin = stageEl
    ?.querySelector(".disc-face.spinning")
    ?.getAnimations()[0];
  if (!spin) {
    return;
  }
  const from = spin.playbackRate;
  const start = performance.now();
  let frame = requestAnimationFrame(function ramp(now) {
    const t = Math.min(1, (now - start) / SPIN_RAMP_MS);
    const eased = 1 - (1 - t) ** 3;
    spin.playbackRate = from + (target - from) * eased;
    if (t < 1) {
      frame = requestAnimationFrame(ramp);
    }
  });
  return () => cancelAnimationFrame(frame);
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
                {#if record.disc === "vinyl"}
                  <!-- The label reuses the sleeve's cover (already cached), so
                       the spin reads and each record looks like its own. -->
                  <span class="disc-label">
                    {#if record.hasCover}
                      <img
                        src={record.coverPath}
                        alt=""
                        width="320"
                        height="320"
                        draggable="false"
                        decoding="async"
                        loading={Math.abs(index - active) <= 2 ? "eager" : "lazy"}
                      />
                    {/if}
                  </span>
                {/if}
                <span class="disc-hole"></span>
              </div>
              <!-- Light sits outside the spinning face: reflections stay fixed
                   to the room while the disc turns beneath them. -->
              <span class="disc-light disc-light-{record.disc}"></span>
            </div>
          {/if}
          <button
            class="sleeve"
            class:is-active={index === active}
            type="button"
            tabindex="-1"
            aria-label={label(record)}
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
      <div class="heading" bind:this={headingEl}>
        <!-- Keyed so the text fades in fresh on each record. Opacity and blur
             only: a transform would add scroll overflow and trip fitHeading. -->
        {#key current.id}
          <div class="artist-block swap-in">
            <p class="now-artist">{current.artistRoman ?? current.artist}</p>
            {#if current.artistRoman}
              <p class="now-sub now-artist-sub">{current.artist}</p>
            {/if}
          </div>
          <p class="now-title swap-in">{current.titleRoman ?? current.title}</p>
          {#if current.titleRoman}
            <p class="now-sub now-title-sub swap-in">{current.title}</p>
          {/if}
        {/key}
      </div>
      {#key current.id}
        <div class="chips swap-in swap-late">
          {#if current.year}<span class="chip">{current.year}</span>{/if}
          <span class="chip chip-format">{shortFormat(current)}</span>
          {#each current.genres.slice(0, 2) as genre}
            <span class="chip chip-ghost">{genre}</span>
          {/each}
        </div>
      {/key}
      {#snippet discogsLink(text: string)}
        <a
          class="discogs-link"
          href={current.discogsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${label(current)} on Discogs`}
        >
          {text}
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path fill="currentColor" d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" /></svg
          >
        </a>
      {/snippet}
      <div class="player">
        {#if preview}
          <div class="preview">
            <!-- aria-pressed carries the play state; keep the label constant. -->
            <button
              class="play"
              type="button"
              aria-pressed={playing}
              aria-label={`Play 30-second preview of ${preview.trackName}`}
              onclick={togglePlay}
            >
              <!-- Not named "ring" — that's a Tailwind utility. -->
              <svg class="progress-ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle class="ring-track" cx="22" cy="22" r="20" />
                <circle
                  class="ring-progress"
                  cx="22"
                  cy="22"
                  r="20"
                  style={`stroke-dasharray:${RING.toFixed(2)};stroke-dashoffset:${(RING * (1 - progress)).toFixed(2)}`}
                />
              </svg>
              <!-- Both icons stay mounted so the swap can crossfade. -->
              <span class="play-icon">
                <svg class="icon-pause" class:shown={playing} viewBox="0 0 24 24" aria-hidden="true"
                  ><path fill="currentColor" d="M7 5h3.4v14H7zm6.6 0H17v14h-3.4z" /></svg
                >
                <svg
                  class="icon-play"
                  class:shown={!playing}
                  viewBox="0 0 24 24"
                  aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg
                >
              </span>
            </button>
            <div class="preview-meta">
              {#key current.id}
                <div class="preview-titles swap-in swap-late">
                  <p class="preview-track">{preview.trackName}</p>
                  {#if preview.artistName}
                    <p class="preview-artist">{preview.artistName}</p>
                  {/if}
                </div>
              {/key}
              <div class="links">
                <a
                  class="apple-link"
                  href={preview.appleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Preview courtesy of Apple Music"
                >
                  Listen on Apple Music
                  <svg viewBox="0 0 24 24" aria-hidden="true"
                    ><path fill="currentColor" d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" /></svg
                  >
                </a>
                {@render discogsLink("Discogs")}
              </div>
            </div>
          </div>
        {:else}
          <div class="links">{@render discogsLink("View on Discogs")}</div>
        {/if}
      </div>
      <audio
        bind:this={audioEl}
        crossorigin="anonymous"
        preload="none"
        ontimeupdate={onTimeUpdate}
        onplay={() => (playing = true)}
        onpause={() => (playing = false)}
        onended={() => {
          playing = false;
          progress = 0;
        }}
      ></audio>
    </div>
  {/if}

  </div>

  <div class="wall">
    <p class="wall-label">The whole crate</p>
    <div class="wall-grid">
      {#each records as record, index (record.id)}
        <button
          class="tile"
          class:tile-active={index === active}
          type="button"
          aria-label={label(record)}
          aria-pressed={index === active}
          onclick={() => setActive(index)}
        >
          {#if record.hasCover}
            <img
              class="tile-cover"
              src={`${record.coverPath}?thumb`}
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
    --vinyl-rim: rgba(255, 255, 255, 0.16);
    --vinyl-smooth: #0d0d10;
    --cd-metal: #dfe2e7;
    --cd-metal-mid: #c9cdd4;
    --cd-metal-edge: #9fa5ae;
    --cd-clear: rgba(196, 202, 212, 0.55);
    --cd-clear-thin: rgba(206, 212, 222, 0.3);
    --cd-ring-hi: rgba(255, 255, 255, 0.85);
    --cd-ring-lo: rgba(120, 128, 140, 0.55);
    --cd-glint: rgba(255, 255, 255, 0.75);
    --cd-shade: rgba(70, 78, 92, 0.22);
    --cd-rainbow: 0.5;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    /* The stage has `perspective`, so its 3D-transformed sleeves escape its own
       clip; clipping here on the non-3D wrapper reliably contains them and stops
       horizontal page scroll on narrow screens. */
    overflow-x: clip;
    /* Room inside the clip so focus rings aren't shaved; margin keeps the box put. */
    padding-inline: 6px;
    margin-inline: -6px;
  }

  :global(html.dark) .crate {
    --stage-shadow: 0 1px 2px rgba(0, 0, 0, 0.4),
      0 16px 40px -28px rgba(0, 0, 0, 0.7);
    --spot-strength: 0.16;
    --sleeve-shadow: 0 2px 2px rgba(0, 0, 0, 0.5),
      0 24px 44px -18px rgba(0, 0, 0, 0.8);
    --vinyl-rim: rgba(255, 255, 255, 0.22);
    /* Dimmer metal so the CD doesn't glow against a dark stage. */
    --cd-metal: #b4b9c2;
    --cd-metal-mid: #9ea4ae;
    --cd-metal-edge: #7a818c;
    --cd-clear: rgba(150, 158, 172, 0.4);
    --cd-clear-thin: rgba(160, 168, 182, 0.2);
    --cd-ring-hi: rgba(225, 230, 238, 0.6);
    --cd-ring-lo: rgba(60, 66, 78, 0.6);
    --cd-glint: rgba(240, 244, 250, 0.5);
    --cd-shade: rgba(20, 24, 34, 0.3);
    --cd-rainbow: 0.38;
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
      width: auto;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      /* Top-align both columns and put the controls ABOVE the title, so a title
         of any length — even a 7-line one — can never move the prev/next
         buttons. The title grows downward into otherwise-empty space. */
      align-items: start;
      /* generous gap BETWEEN the columns, tight gap DOWN to the cover wall */
      column-gap: 2.5rem;
      row-gap: 1.25rem;
    }
    .crate.split .stage {
      order: 1;
      align-self: stretch;
      height: auto;
      min-height: clamp(250px, 26vw, 300px);
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
    /* Fixed-height heading: the title font scales (in JS) to fit, so the chips,
       Discogs link and cover wall never shift as titles change length. */
    .crate.split .heading {
      height: 8.5rem;
      justify-content: flex-start;
      overflow: hidden;
    }
    .crate.split .chips {
      justify-content: flex-start;
    }
    .crate.split .player {
      align-items: flex-start;
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
    /* Going back in is quick, so the next record isn't waiting on it. */
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.6, 1);
  }

  /* Half out, so the hub clears the sleeve edge and the label shows. Waits a
     beat so the sleeve lands first, then the record slides out. */
  .disc.out {
    transform: translateX(50%);
    transition: transform 0.75s var(--ease-crate) 0.16s;
  }

  .disc-face {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.35),
      0 14px 30px -12px rgba(0, 0, 0, 0.6);
  }

  /* Vinyl. Stops use `closest-side`, so percentages are of the radius:
     label 0–34%, smooth run-out to 38%, grooves to 96%, smooth lead-in rim. */
  .disc-vinyl {
    background:
      /* rim: a hairline edge so the disc separates from a dark stage */
      radial-gradient(
        circle closest-side,
        transparent 98.4%,
        var(--vinyl-rim) 99.2%,
        transparent 100%
      ),
      /* run-out and lead-in are pressed smooth, no grooves */
      radial-gradient(
        circle closest-side,
        transparent 34%,
        var(--vinyl-smooth) 34% 38.5%,
        transparent 38.5% 96.5%,
        var(--vinyl-smooth) 96.5%
      ),
      /* gaps between tracks catch light as slightly brighter bands */
      radial-gradient(
        circle closest-side,
        transparent 52%,
        rgba(255, 255, 255, 0.05) 52.4% 53%,
        transparent 53.4% 66%,
        rgba(255, 255, 255, 0.05) 66.4% 67%,
        transparent 67.4% 81%,
        rgba(255, 255, 255, 0.05) 81.4% 82%,
        transparent 82.4%
      ),
      repeating-radial-gradient(
        circle at 50% 50%,
        rgba(255, 255, 255, 0.045) 0 0.6px,
        transparent 0.9px 2.2px
      ),
      radial-gradient(circle closest-side, #141418, #0a0a0c);
  }

  /* Shiny side of a CD: clear hub with a stacking ring, metal from 38%,
     clear polycarbonate rim. */
  .disc-cd {
    background:
      radial-gradient(
        circle closest-side,
        var(--cd-clear) 12.5% 26.5%,
        var(--cd-ring-hi) 27%,
        var(--cd-ring-lo) 28%,
        var(--cd-clear-thin) 28.5% 37%,
        var(--cd-metal-edge) 37.5%,
        var(--cd-metal) 38.5%,
        var(--cd-metal-mid) 70%,
        var(--cd-metal) 97.5%,
        var(--cd-clear) 98%
      );
  }

  .disc-label {
    position: absolute;
    inset: 33%;
    overflow: hidden;
    border-radius: 50%;
    background: var(--primary);
    /* paper label meets vinyl: a faint pressed lip */
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  }

  .disc-label img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .disc-hole {
    position: absolute;
    inset: 48.2%;
    border-radius: 50%;
    background: var(--disc-core);
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.35);
  }

  .disc-cd .disc-hole {
    inset: 43.75%;
    box-shadow: inset 0 0 0 1px var(--cd-ring-lo);
  }

  .disc-light {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    pointer-events: none;
  }

  /* Vinyl's signature: two opposed wedges of light across the grooves. */
  .disc-light-vinyl {
    background: conic-gradient(
      from 18deg,
      transparent 0deg,
      rgba(255, 255, 255, 0.2) 22deg,
      transparent 48deg 180deg,
      rgba(255, 255, 255, 0.12) 202deg,
      transparent 228deg
    );
    mask-image: radial-gradient(
      circle closest-side,
      transparent 34.5%,
      #000 36%,
      #000 99%,
      transparent 100%
    );
  }

  /* Specular streak through the light source, with diffraction rainbows
     fanning either side, kept to the metal band. */
  .disc-light-cd {
    background:
      conic-gradient(
        from 18deg,
        transparent 0deg,
        var(--cd-glint) 22deg,
        transparent 44deg 180deg,
        var(--cd-glint) 202deg,
        transparent 224deg
      ),
      conic-gradient(
        from -32deg,
        transparent 0deg,
        oklch(0.82 0.13 350 / var(--cd-rainbow)) 14deg,
        oklch(0.88 0.13 85 / var(--cd-rainbow)) 26deg,
        oklch(0.86 0.13 160 / var(--cd-rainbow)) 38deg,
        oklch(0.8 0.12 240 / var(--cd-rainbow)) 50deg,
        transparent 62deg 108deg,
        oklch(0.8 0.12 240 / var(--cd-rainbow)) 120deg,
        oklch(0.86 0.13 160 / var(--cd-rainbow)) 132deg,
        oklch(0.88 0.13 85 / var(--cd-rainbow)) 144deg,
        oklch(0.82 0.13 350 / var(--cd-rainbow)) 156deg,
        transparent 168deg 180deg,
        transparent 180deg
      ),
      conic-gradient(
        from 148deg,
        transparent 0deg,
        oklch(0.82 0.13 350 / var(--cd-rainbow)) 14deg,
        oklch(0.88 0.13 85 / var(--cd-rainbow)) 26deg,
        oklch(0.86 0.13 160 / var(--cd-rainbow)) 38deg,
        oklch(0.8 0.12 240 / var(--cd-rainbow)) 50deg,
        transparent 62deg 108deg,
        oklch(0.8 0.12 240 / var(--cd-rainbow)) 120deg,
        oklch(0.86 0.13 160 / var(--cd-rainbow)) 132deg,
        oklch(0.88 0.13 85 / var(--cd-rainbow)) 144deg,
        oklch(0.82 0.13 350 / var(--cd-rainbow)) 156deg,
        transparent 168deg 360deg
      ),
      /* broad darker quadrants give the metal some depth */
      conic-gradient(
        from 18deg,
        transparent 0deg 60deg,
        var(--cd-shade) 90deg,
        transparent 130deg 240deg,
        var(--cd-shade) 270deg,
        transparent 310deg
      );
    mask-image: radial-gradient(
      circle closest-side,
      transparent 38%,
      #000 39%,
      #000 97%,
      transparent 97.5%
    );
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

  .nav:active:not(:disabled) {
    transform: scale(0.94);
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

  .heading {
    /* Fixed height on every layout so the title font scales (in JS) to fit and
       nothing below shifts. Top-anchored (like desktop) so the artist stays put
       and the title grows downward — the heading never jumps between records. */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    width: 100%;
    height: clamp(7.5rem, 26vw, 8.5rem);
    overflow: hidden;
  }

  .artist-block {
    /* Fixed height keeps the romanized artist + its native subtitle tight
       together, and reserves the same space on records without a subtitle, so
       the title below never shifts. flex-shrink:0 stops a tall title from
       squeezing it before fitHeading scales the title down. */
    flex-shrink: 0;
    height: 2.35rem;
    overflow: hidden;
  }

  .now-artist {
    /* Clamp long collab names to two lines; the .artist-block reserves the room. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--primary);
  }

  .now-title {
    margin-top: 0.55rem;
    font-size: clamp(1.25rem, 5vw, 2.1rem);
    font-weight: 800;
    line-height: 1.12;
    text-wrap: balance;
    overflow-wrap: anywhere;
    color: var(--foreground);
    /* fitHeading measures font-size changes synchronously. The global
       reduced-motion rule gives every element a 0.01ms `all` transition, which
       makes those reads stale and shrinks the title to its floor. */
    transition-property: none;
  }

  /* Native-script line for CJK records: the romanized/English reading is the
     primary line (matching every Latin-script record), with the native script
     kept beneath it, muted — the cover art already carries it prominently. */
  .now-sub {
    color: var(--muted-foreground);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .now-artist-sub {
    margin-top: 0.15rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
  }

  /* One line: fitHeading only scales the main title, so a wrapping subtitle
     would get clipped mid-glyph at the bottom of the fixed-height heading. */
  .now-title-sub {
    /* overflow:hidden would otherwise let the flex column squash it to 0. */
    flex-shrink: 0;
    margin-top: 0.25rem;
    overflow: hidden;
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
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

  /* Release links share one row: Apple Music leads, Discogs sits beside it. */
  .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 1rem;
    row-gap: 0.25rem;
  }

  .discogs-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
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

  /* Fixed height so flipping records never shifts the cover wall below. */
  .player {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 4rem;
    margin-top: 1.3rem;
  }

  .preview {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .play {
    position: relative;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 3rem;
    height: 3rem;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: color-mix(in oklab, var(--primary) 10%, var(--card));
    color: var(--primary);
    cursor: pointer;
    transition:
      transform 0.18s var(--ease-crate),
      background-color 0.18s ease;
  }

  .play:hover {
    transform: translateY(-1px);
    background: color-mix(in oklab, var(--primary) 18%, var(--card));
  }

  .play:active {
    transform: scale(0.94);
  }

  .play:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .progress-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg); /* start the sweep at 12 o'clock */
  }

  .ring-track,
  .ring-progress {
    fill: none;
    stroke-width: 2.5;
  }

  .ring-track {
    stroke: color-mix(in oklab, var(--primary) 22%, transparent);
  }

  .ring-progress {
    stroke: var(--primary);
    stroke-linecap: round;
  }

  .play-icon {
    display: grid;
    place-items: center;
  }

  /* Stacked in one cell; the hidden icon shrinks and blurs out as the other
     arrives. */
  .play-icon svg {
    grid-area: 1 / 1;
    width: 1.2rem;
    height: 1.2rem;
    opacity: 0;
    transform: scale(0.5);
    filter: blur(3px);
    transition:
      opacity 0.2s ease,
      transform 0.2s var(--ease-crate),
      filter 0.2s ease;
  }

  .play-icon svg.shown {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }

  /* Optically centre the play triangle (its visual mass sits left of centre). */
  .play-icon .icon-play.shown {
    transform: translateX(1px);
  }

  .preview-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    min-width: 0;
    text-align: left;
  }

  /* Fixed height (same trick as .artist-block) so the links below never shift
     when the artist line comes and goes. */
  .preview-titles {
    height: 2.35rem;
    overflow: hidden;
  }

  .preview-track {
    max-width: 15rem;
    overflow: hidden;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--foreground);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .preview-artist {
    max-width: 15rem;
    margin-top: 0.1rem;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--muted-foreground);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .apple-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--primary);
    transition: opacity 0.18s ease;
  }

  .apple-link svg {
    width: 0.95rem;
    height: 0.95rem;
    transition: transform 0.18s var(--ease-crate);
  }

  .apple-link:hover {
    opacity: 0.8;
  }

  .apple-link:hover svg {
    transform: translate(2px, -2px);
  }

  .apple-link:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 3px;
    border-radius: 6px;
  }

  /* The text swap: a quick fade with a little blur. */
  .swap-in {
    animation: swap-in 0.26s ease-out both;
  }

  .swap-late {
    animation-delay: 0.04s;
  }

  @keyframes swap-in {
    from {
      opacity: 0;
      filter: blur(2px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .play,
    .play-icon svg,
    .apple-link,
    .apple-link svg {
      transition: none;
    }
    .swap-in {
      animation: none;
    }
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

  .tile:active {
    transform: scale(0.95);
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
