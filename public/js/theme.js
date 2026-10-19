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

    /* เงานุ่มแบบลอยตัว (ใช้กับการ์ดและแผงต่าง ๆ) */
    --shadow-block: 0 24px 48px -24px rgba(17, 19, 24, .35);
    --shadow-block-sm: 0 10px 24px -12px rgba(17, 19, 24, .45);

    --animate-marquee: marquee 38s linear infinite;
    --animate-rise: rise .45s cubic-bezier(.2,.8,.2,1) both;
    --animate-pop: pop-in .38s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
  @keyframes rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
  @keyframes pop-in { 0% { transform: scale(.82) } 60% { transform: scale(1.12) } 100% { transform: scale(1) } }

  @layer components {
    /* ปุ่มแบบ Tactile: กดแล้วยุบลงเล็กน้อย */
    .btn { @apply inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-bold text-sm transition duration-150 select-none
                 active:translate-y-px active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt; }
    .btn-primary { @apply bg-ink text-white hover:bg-cobalt; }
    .btn-cobalt { @apply bg-cobalt text-white hover:bg-ink; }
    .btn-tangerine { @apply bg-tangerine text-white hover:bg-ink; }
    .btn-outline { @apply border-2 border-ink bg-white text-ink hover:bg-ink hover:text-white; }
    .btn-ghost { @apply text-ink hover:bg-mist; }
    .btn-danger { @apply bg-danger text-white hover:bg-ink; }
    .btn-sm { @apply h-9 px-4 text-xs; }
    .btn-lg { @apply h-14 px-7 text-base; }
    .icon-btn { @apply inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-mist transition active:scale-95; }
    .icon-btn-line { @apply inline-flex items-center justify-center w-11 h-11 rounded-full border border-line bg-white hover:border-ink transition active:scale-95; }

    /* การ์ดพื้นขาว ขอบบาง มุมโค้งมาก (Colorful Minimal) */
    .card { @apply bg-white rounded-3xl border border-line; }
    .card-block { @apply bg-white rounded-[2rem] border border-line shadow-block; }

    .input { @apply w-full h-12 px-4 rounded-2xl border border-line bg-white text-sm text-ink placeholder:text-ink-soft/60
                   focus:outline-none focus:border-cobalt focus:ring-4 focus:ring-cobalt/15 transition; }
    textarea.input { @apply h-auto py-3; }
    select.input { @apply pr-10; }
    .label { @apply block text-xs font-bold mb-1.5 text-ink; }
    .chip { @apply inline-flex shrink-0 whitespace-nowrap items-center gap-2 h-10 px-4 rounded-full border border-line bg-white text-sm font-bold transition hover:border-ink active:scale-95; }
    .chip-on { @apply bg-ink text-white border-ink; }
    .eyebrow { @apply text-[11px] font-bold tracking-[0.18em] uppercase; }
    /* หัวข้อใหญ่: ตัวหนา ตัวพิมพ์ใหญ่ ระยะตัวอักษรชิด */
    .display { @apply font-display font-bold uppercase tracking-[-0.03em] leading-[0.95]; }
    .pill { @apply inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]; }
    .link { @apply font-bold underline underline-offset-4 decoration-2 hover:text-cobalt; }
  }`;
  const style = document.createElement('style');
  style.type = 'text/tailwindcss';
  style.textContent = css;
  document.head.appendChild(style);
})();
