// ============================================================================
// Design Tokens (Colorful Minimal) สำหรับ Tailwind CSS browser build
// ไฟล์นี้ต้องโหลด "ก่อน" สคริปต์ Tailwind เพื่อให้ทุกหน้าใช้สีและฟอนต์ชุดเดียวกัน
// แก้สีแบรนด์ที่นี่ที่เดียว ทุกหน้าจะเปลี่ยนตาม
// ============================================================================
(function () {
  const css = `
  @theme {
    --font-sans: "Plus Jakarta Sans", "IBM Plex Sans Thai", ui-sans-serif, system-ui, sans-serif;
    --font-display: "Space Grotesk", "IBM Plex Sans Thai", ui-sans-serif, sans-serif;

    --color-canvas: #F8F9FA;
    --color-ink: #111318;
    --color-ink-soft: #4B5160;
    --color-line: #E4E6EB;
    --color-mist: #EEF0F3;

    --color-cobalt: #1D4ED8;
    --color-cobalt-soft: #E0E8FD;
    --color-tangerine: #F97316;
    --color-tangerine-soft: #FFEBDD;
    --color-sage: #10B981;
    --color-sage-soft: #DCF7EC;
    --color-mustard: #F59E0B;
    --color-mustard-soft: #FEF1D6;
    --color-danger: #DC2626;
    --color-danger-soft: #FEE2E2;

    --shadow-block: 4px 4px 0 0 #111318;
    --shadow-block-sm: 2px 2px 0 0 #111318;
  }

  @layer components {
    /* ปุ่มแบบ Tactile: กดแล้วยุบลงเล็กน้อย */
    .btn { @apply inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-bold text-sm transition duration-150 select-none
                 active:translate-y-px active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt; }
    .btn-primary { @apply bg-ink text-white hover:bg-cobalt; }
    .btn-cobalt { @apply bg-cobalt text-white hover:bg-ink; }
    .btn-tangerine { @apply bg-tangerine text-white hover:bg-ink; }
    .btn-outline { @apply border-2 border-ink bg-white text-ink hover:bg-ink hover:text-white; }
    .btn-ghost { @apply text-ink hover:bg-mist; }
    .btn-danger { @apply bg-danger text-white hover:bg-ink; }
    .btn-sm { @apply h-9 px-4 text-xs; }
    .icon-btn { @apply inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-mist transition active:scale-95; }

    /* การ์ดเรขาคณิต ขอบคม + เงาบล็อก */
    .card { @apply bg-white rounded-2xl border border-line; }
    .card-block { @apply bg-white rounded-2xl border-2 border-ink shadow-block; }

    .input { @apply w-full h-11 px-4 rounded-xl border border-line bg-white text-sm text-ink placeholder:text-ink-soft/60
                   focus:outline-none focus:border-cobalt focus:ring-4 focus:ring-cobalt/15 transition; }
    textarea.input { @apply h-auto py-3; }
    select.input { @apply pr-10; }
    .label { @apply block text-xs font-bold mb-1.5 text-ink; }
    .chip { @apply inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line bg-white text-xs font-bold transition hover:border-ink; }
    .chip-on { @apply bg-ink text-white border-ink; }
    .eyebrow { @apply text-[11px] font-bold tracking-[0.18em] uppercase; }
    .link { @apply font-bold underline underline-offset-4 decoration-2 hover:text-cobalt; }
  }`;
  const style = document.createElement('style');
  style.type = 'text/tailwindcss';
  style.textContent = css;
  document.head.appendChild(style);
})();
