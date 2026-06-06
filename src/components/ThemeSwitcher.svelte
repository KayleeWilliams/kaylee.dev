<script lang="ts">
let theme = $state<"light" | "dark">("light");

function applyTheme(nextTheme: "light" | "dark") {
  theme = nextTheme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

$effect(() => {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored === "dark" || (!stored && prefersDark) ? "dark" : "light");
});
</script>

<button
  aria-label="Toggle theme"
  type="button"
  onclick={() => applyTheme(theme === "dark" ? "light" : "dark")}
>
  <span
    class="flex aspect-square h-14 items-center justify-center rounded-lg border border-border bg-card text-card-foreground shadow-xs transition-[background-color] duration-150 ease hover:bg-violet-50 active:scale-[0.97] dark:hover:bg-violet-500"
  >
    {#if theme === "dark"}
      <svg aria-hidden="true" class="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM11 1h2v3h-2V1Zm0 19h2v3h-2v-3ZM3.515 4.929l1.414-1.414L7.05 5.636 5.636 7.05 3.515 4.929Zm13.435 13.435 1.414-1.414 2.121 2.121-1.414 1.414-2.121-2.121ZM1 11h3v2H1v-2Zm19 0h3v2h-3v-2ZM4.929 20.485l-1.414-1.414 2.121-2.121 1.414 1.414-2.121 2.121ZM18.364 7.05 16.95 5.636l2.121-2.121 1.414 1.414-2.121 2.121Z"
        />
      </svg>
    {:else}
      <svg aria-hidden="true" class="size-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M10 7a7 7 0 0 0 7 7 7.38 7.38 0 0 0 3.18-.72A9 9 0 1 1 10.72 3.82 7.38 7.38 0 0 0 10 7Z"
        />
      </svg>
    {/if}
  </span>
</button>
