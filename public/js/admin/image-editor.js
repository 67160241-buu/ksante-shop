// ============================================================================
// ตัวแก้ไขรูปภาพบนหน้าเว็บ (ใช้ในหน้าฟอร์มสินค้าของแอดมิน)
//  - เลือกไฟล์ / ลากไฟล์มาวาง / แก้ไขรูปเดิมจากลิงก์
//  - หมุนซ้าย-ขวา, กลับด้าน, ครอปตามสัดส่วน (ต้นฉบับ / 1:1 / 4:5 / 4:3), ซูม และลากเพื่อเลื่อนตำแหน่ง
//  - ย่อรูปให้ด้านยาวไม่เกิน 1200px แล้วบีบอัดเป็น WebP (ถ้าเบราว์เซอร์ไม่รองรับใช้ JPEG) ก่อนอัปโหลด
//  - อัปโหลดไปที่ POST /api/admin/images แล้วได้ URL /api/images/<id> กลับมา
// ทั้งหมดทำด้วย <canvas> ในเบราว์เซอร์ ไม่ต้องใช้ไลบรารีภายนอก
// ใช้งาน:  const url = await KS.imageEditor.open(fileหรือลิงก์รูป, { title: 'รูปภาพหลัก' })  // ได้ null ถ้ากดยกเลิก
// ============================================================================
(function () {
  const KS = window.KS;
  const { $, esc } = KS;
  const MAX_SIDE = 1200;                 // ด้านยาวสุดของรูปที่บันทึก (px)
  const MAX_BYTES = 1_500_000;           // ต้องตรงกับฝั่งเซิร์ฟเวอร์ functions/api/admin/images.js
  const MAX_INPUT = 20 * 1024 * 1024;    // ไฟล์ต้นฉบับที่เลือกได้สูงสุด 20MB (ก่อนย่อ)
  const RATIOS = [
    { key: 'orig', label: 'ต้นฉบับ', value: null },
    { key: '1:1', label: '1:1', value: 1 },
    { key: '4:5', label: '4:5', value: 4 / 5 },
    { key: '4:3', label: '4:3', value: 4 / 3 },
  ];

  // ---------------------------------------------------------------------------
  // สร้างหน้าต่าง (modal) ครั้งเดียว แล้วใช้ซ้ำทุกครั้งที่เปิด
  // ---------------------------------------------------------------------------
  const root = document.createElement('div');
  root.id = 'image-editor';
  root.className = 'fixed inset-0 z-[70] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-3';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'ie-title');
  root.innerHTML = `
    <div class="bg-white rounded-3xl w-full max-w-4xl max-h-[96vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center gap-3 px-5 py-4 border-b border-line">
        <span class="w-9 h-9 rounded-full bg-cobalt-soft text-cobalt grid place-items-center">${KS.icon('crop', 'w-[18px] h-[18px]')}</span>
        <div class="min-w-0"><h2 id="ie-title" class="font-display font-bold text-lg leading-tight">แก้ไขรูปภาพ</h2>
          <p id="ie-sub" class="text-xs text-ink-soft truncate"></p></div>
        <button type="button" class="icon-btn ml-auto" data-ie="close" aria-label="ปิดหน้าต่างแก้ไขรูป">${KS.icon('x', 'w-5 h-5')}</button>
      </div>
      <div class="grid md:grid-cols-[minmax(0,1fr)_240px] gap-5 p-5">
        <div>
          <div id="ie-stage" class="relative h-[min(42vh,440px)] md:h-[min(52vh,440px)] rounded-2xl bg-mist border border-line flex items-center justify-center overflow-hidden"
               style="background-image:conic-gradient(#e7e9ee 25%,transparent 0 50%,#e7e9ee 0 75%,transparent 0);background-size:20px 20px">
            <canvas id="ie-canvas" tabindex="0" class="touch-none cursor-grab rounded-md shadow-lg outline-offset-4" aria-label="ตัวอย่างรูป ลากเพื่อเลื่อน ใช้ลูกศรเพื่อเลื่อน และ + / - เพื่อซูม"></canvas>
            <div id="ie-loading" class="absolute inset-0 grid place-items-center text-sm font-bold text-ink-soft bg-mist/80" hidden>${KS.icon('refresh-cw', 'w-5 h-5 animate-spin')}</div>
          </div>
          <p class="text-[11px] text-ink-soft mt-2">ลากรูปเพื่อเลื่อนตำแหน่ง • เลื่อนลูกกลิ้งเมาส์หรือใช้แถบซูมเพื่อขยาย • ส่วนที่อยู่ในกรอบคือรูปที่จะบันทึก</p>
        </div>
        <div class="space-y-5">
          <div><p class="label">สัดส่วนการครอป</p>
            <div id="ie-ratios" class="grid grid-cols-4 gap-1.5">${RATIOS.map(r => `<button type="button" data-ratio="${r.key}"
              class="h-10 rounded-xl border text-xs font-bold">${r.label}</button>`).join('')}</div></div>
          <div><p class="label">หมุน / กลับด้าน</p>
            <div class="grid grid-cols-3 gap-1.5">
              <button type="button" data-ie="rotl" class="btn btn-outline btn-sm px-0" aria-label="หมุนซ้าย 90 องศา" title="หมุนซ้าย">${KS.icon('rotate-ccw', 'w-4 h-4')}</button>
              <button type="button" data-ie="rotr" class="btn btn-outline btn-sm px-0" aria-label="หมุนขวา 90 องศา" title="หมุนขวา">${KS.icon('rotate-cw', 'w-4 h-4')}</button>
              <button type="button" data-ie="flip" class="btn btn-outline btn-sm px-0" aria-label="กลับด้านซ้าย-ขวา" title="กลับด้าน">${KS.icon('flip-horizontal-2', 'w-4 h-4')}</button>
            </div></div>
          <div><label class="label flex items-center justify-between" for="ie-zoom">ซูม <span id="ie-zoom-val" class="tabular text-ink-soft">100%</span></label>
            <div class="flex items-center gap-2">${KS.icon('zoom-out', 'w-4 h-4 text-ink-soft shrink-0')}
              <input id="ie-zoom" type="range" min="1" max="4" step="0.01" value="1" class="w-full accent-[#1D4ED8]">
              ${KS.icon('zoom-in', 'w-4 h-4 text-ink-soft shrink-0')}</div></div>
          <button type="button" data-ie="reset" class="btn btn-ghost btn-sm w-full border border-line">${KS.icon('undo-2', 'w-4 h-4')} เริ่มใหม่</button>
          <div class="rounded-2xl bg-mist p-3 text-xs text-ink-soft space-y-1">
            <p>ขนาดที่จะบันทึก: <b id="ie-out" class="text-ink tabular">-</b></p>
            <p>ไฟล์ต้นฉบับ: <b id="ie-src" class="text-ink tabular">-</b></p>
          </div>
          <div id="ie-error" class="rounded-xl bg-danger-soft text-danger text-sm font-semibold p-3 flex gap-2" hidden></div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-line">
        <button type="button" data-ie="file" class="btn btn-ghost btn-sm border border-line">${KS.icon('image-plus', 'w-4 h-4')} เลือกรูปอื่น</button>
        <div class="ml-auto flex gap-2">
          <button type="button" data-ie="close" class="btn btn-ghost btn-sm border border-line">ยกเลิก</button>
          <button type="button" id="ie-apply" class="btn btn-primary btn-sm">${KS.icon('upload', 'w-4 h-4')} บันทึกและใช้รูปนี้</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const canvas = $('#ie-canvas', root);
  const ctx = canvas.getContext('2d');
  const stage = $('#ie-stage', root);
  const zoomEl = $('#ie-zoom', root);
  const applyBtn = $('#ie-apply', root);

  // สถานะของการแก้ไขปัจจุบัน
  let img = null;                   // รูปต้นฉบับ (HTMLImageElement)
  let srcLabel = '';
  let objectUrl = null;             // URL ชั่วคราวของไฟล์ที่เลือก (ต้องคืนหน่วยความจำตอนปิด)
  let rot = 0;                      // จำนวนครั้งที่หมุน 90 องศา (0-3)
  let flip = false;
  let ratioKey = 'orig';
  let zoom = 1;
  let ox = 0, oy = 0;               // ตำแหน่งกึ่งกลางรูปเทียบกับกรอบ (หน่วย = สัดส่วนของความกว้าง/สูงกรอบ)
  let resolver = null;              // ฟังก์ชันส่งผลลัพธ์กลับให้ผู้เรียก open()
  let lastFocus = null;

  /** ขนาดรูปหลังหมุน */
  const rotated = () => (rot % 2 ? { w: img.naturalHeight, h: img.naturalWidth } : { w: img.naturalWidth, h: img.naturalHeight });
  /** สัดส่วนกรอบครอป (กว้าง/สูง) */
  const frameRatio = () => RATIOS.find(r => r.key === ratioKey).value || (rotated().w / rotated().h);

  /** สเกลที่ทำให้รูปเต็มกรอบพอดี (cover) x ซูม */
  function scaleFor(W, H) {
    const { w, h } = rotated();
    return Math.max(W / w, H / h) * zoom;
  }

  /** บังคับไม่ให้ลากรูปจนเห็นขอบว่างในกรอบ */
  function clampOffset(W, H) {
    const { w, h } = rotated();
    const s = scaleFor(W, H);
    const mx = Math.max(0, (w * s - W) / 2 / W);
    const my = Math.max(0, (h * s - H) / 2 / H);
    ox = Math.min(mx, Math.max(-mx, ox));
    oy = Math.min(my, Math.max(-my, oy));
  }

  /** วาดรูปลง canvas ขนาด W x H ตามสถานะปัจจุบัน (ใช้ทั้งตัวอย่างบนจอและไฟล์ที่บันทึก) */
  function paint(c, W, H, background) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (background) { g.fillStyle = background; g.fillRect(0, 0, W, H); }
    const s = scaleFor(W, H);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.translate(W / 2 + ox * W, H / 2 + oy * H);
    g.scale(flip ? -1 : 1, 1);           // กลับด้านก่อนหมุน เพื่อให้กลับซ้าย-ขวาบนจอเสมอ
    g.rotate(rot * Math.PI / 2);
    g.drawImage(img, -img.naturalWidth * s / 2, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
  }

  /** ขนาดไฟล์ที่จะบันทึก: ไม่เกิน 1200px และไม่ขยายเกินความละเอียดจริงของต้นฉบับ */
  function outputSize() {
    const A = frameRatio();
    const W = A >= 1 ? 1000 : 1000 * A;
    const H = A >= 1 ? 1000 / A : 1000;
    const srcLong = Math.max(W, H) / scaleFor(W, H);           // จำนวนพิกเซลต้นฉบับที่อยู่ในกรอบ (ด้านยาว)
    const long = Math.max(1, Math.round(Math.min(MAX_SIDE, srcLong)));
    return A >= 1 ? { w: long, h: Math.max(1, Math.round(long / A)) } : { w: Math.max(1, Math.round(long * A)), h: long };
  }

  /** วาดตัวอย่างบนจอ ให้กรอบพอดีกับพื้นที่ */
  function render() {
    if (!img) return;
    const A = frameRatio();
    const pad = 24;
    const sw = stage.clientWidth - pad * 2;
    const sh = stage.clientHeight - pad * 2;
    let fw = sw, fh = sw / A;
    if (fh > sh) { fh = sh; fw = sh * A; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${Math.round(fw)}px`;
    canvas.style.height = `${Math.round(fh)}px`;
    canvas.width = Math.round(fw * dpr);
    canvas.height = Math.round(fh * dpr);
    clampOffset(canvas.width, canvas.height);
    paint(canvas, canvas.width, canvas.height);
    const o = outputSize();
    $('#ie-out', root).textContent = `${o.w} × ${o.h} px`;
    $('#ie-zoom-val', root).textContent = `${Math.round(zoom * 100)}%`;
    zoomEl.value = zoom;
    for (const b of root.querySelectorAll('[data-ratio]')) {
      const on = b.dataset.ratio === ratioKey;
      b.className = `h-10 rounded-xl border text-xs font-bold ${on ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-ink'}`;
      b.setAttribute('aria-pressed', on);
    }
  }

  function showError(msg) {
    const el = $('#ie-error', root);
    el.hidden = !msg;
    el.innerHTML = msg ? `${KS.icon('circle-alert', 'w-4 h-4 shrink-0 mt-0.5')}<span>${esc(msg)}</span>` : '';
  }

  function resetEdits() { rot = 0; flip = false; zoom = 1; ox = 0; oy = 0; }

  /** โหลดรูปจาก File หรือ URL  (รูปจากเว็บอื่นต้องอนุญาต CORS ถึงจะนำมาแก้ไขและบันทึกได้) */
  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      let url;
      if (source instanceof Blob) {
        if (!source.type.startsWith('image/')) return reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ'));
        if (source.size > MAX_INPUT) return reject(new Error('ไฟล์ใหญ่เกิน 20MB กรุณาเลือกรูปที่เล็กลง'));
        url = URL.createObjectURL(source);
      } else {
        url = String(source);
        el.crossOrigin = 'anonymous';
      }
      el.onload = () => resolve({ el, url: source instanceof Blob ? url : null });
      el.onerror = () => {
        if (source instanceof Blob) URL.revokeObjectURL(url);
        reject(new Error(source instanceof Blob
          ? 'เปิดไฟล์รูปนี้ไม่ได้ (รองรับ JPG, PNG, WebP, GIF) ไฟล์ HEIC จาก iPhone ให้แปลงเป็น JPG ก่อน'
          : 'โหลดรูปจากลิงก์นี้มาแก้ไขไม่ได้ (เว็บต้นทางไม่อนุญาต) กรุณาบันทึกรูปลงเครื่องแล้วกด "เลือกรูปอื่น"'));
      };
      el.src = url;
    });
  }

  async function setSource(source) {
    showError('');
    $('#ie-loading', root).hidden = false;
    try {
      const { el, url } = await loadImage(source);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = url;
      img = el;
      srcLabel = source instanceof Blob
        ? `${source.name || 'รูปภาพ'} • ${img.naturalWidth} × ${img.naturalHeight} px • ${(source.size / 1024 / 1024).toFixed(2)} MB`
        : `${img.naturalWidth} × ${img.naturalHeight} px`;
      $('#ie-src', root).textContent = srcLabel;
      resetEdits();
      applyBtn.disabled = false;
      render();
    } catch (err) {
      showError(err.message);
      if (!img) applyBtn.disabled = true;
    } finally {
      $('#ie-loading', root).hidden = true;
    }
  }

  /** แปลง canvas เป็นไฟล์: ลอง WebP ก่อน แล้วลดคุณภาพ/เปลี่ยนเป็น JPEG จนขนาดไม่เกิน 1.5MB */
  async function encode(w, h) {
    const tries = [['image/webp', 0.86], ['image/webp', 0.7], ['image/jpeg', 0.85], ['image/jpeg', 0.65], ['image/jpeg', 0.45]];
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    for (const [type, q] of tries) {
      // JPEG ไม่มีพื้นโปร่งใส จึงเติมพื้นขาวก่อน
      paint(out, w, h, type === 'image/jpeg' ? '#FFFFFF' : null);
      let blob;
      try {
        blob = await new Promise(r => out.toBlob(r, type, q));
      } catch {
        throw new Error('รูปจากลิงก์นี้ถูกป้องกันการแก้ไข กรุณาบันทึกรูปลงเครื่องแล้วกด "เลือกรูปอื่น"');
      }
      if (!blob || blob.type !== type) continue;        // เบราว์เซอร์ไม่รองรับชนิดนี้ (เช่น Safari รุ่นเก่ากับ WebP)
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw new Error('รูปมีขนาดใหญ่เกินไปหลังบีบอัด ลองครอปให้เล็กลง');
  }

  /** ส่งไฟล์รูปขึ้นเซิร์ฟเวอร์ คืนค่า URL ของรูป */
  async function upload(blob, w, h) {
    let res;
    try {
      res = await fetch('/api/admin/images', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': blob.type, 'X-Image-Width': String(w), 'X-Image-Height': String(h) },
        body: blob,
      });
    } catch {
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
    }
    const data = await res.json().catch(() => null);
    if (res.status === 401) location.replace('/admin/login?next=' + encodeURIComponent(location.pathname + location.search));
    if (!res.ok || !data?.ok) throw new Error(data?.error || `อัปโหลดไม่สำเร็จ (${res.status})`);
    return data.url;
  }

  function close(result) {
    root.hidden = true;
    document.documentElement.classList.remove('overflow-hidden');
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    img = null;
    KS.busy(applyBtn, false);
    const done = resolver;
    resolver = null;
    lastFocus?.focus?.();
    done?.(result ?? null);
  }

  // ---------------------------------------------------------------------------
  // เลือกไฟล์จากเครื่อง (ใช้ input type=file ตัวเดียว)
  // ---------------------------------------------------------------------------
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);
  let fileResolver = null;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0] || null;
    fileInput.value = '';
    fileResolver?.(f);
    fileResolver = null;
  });
  fileInput.addEventListener('cancel', () => { fileResolver?.(null); fileResolver = null; });
  function pickFile() {
    return new Promise(resolve => { fileResolver = resolve; fileInput.click(); });
  }

  // ---------------------------------------------------------------------------
  // ปุ่มและการลาก/ซูม
  // ---------------------------------------------------------------------------
  root.addEventListener('click', async e => {
    if (e.target === root) return close(null);                 // คลิกพื้นหลังนอกกล่อง = ยกเลิก
    const r = e.target.closest('[data-ratio]');
    if (r && img) { ratioKey = r.dataset.ratio; ox = 0; oy = 0; return render(); }
    const act = e.target.closest('[data-ie]')?.dataset.ie;
    if (!act) return;
    if (act === 'close') return close(null);
    if (act === 'file') { const f = await pickFile(); if (f) setSource(f); return; }
    if (!img) return;
    if (act === 'rotl') rot = (rot + 3) % 4;
    if (act === 'rotr') rot = (rot + 1) % 4;
    if (act === 'flip') flip = !flip;
    if (act === 'reset') { resetEdits(); ratioKey = 'orig'; }
    render();
  });

  zoomEl.addEventListener('input', () => { zoom = Number(zoomEl.value); render(); });
  canvas.addEventListener('wheel', e => {
    if (!img) return;
    e.preventDefault();
    zoom = Math.min(4, Math.max(1, zoom * Math.exp(-e.deltaY * 0.0015)));
    render();
  }, { passive: false });

  // ลากรูปด้วยเมาส์หรือนิ้ว (Pointer Events รองรับทั้งสองแบบ)
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!img) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
    canvas.classList.replace('cursor-grab', 'cursor-grabbing');
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    ox += (e.clientX - drag.x) / canvas.clientWidth;
    oy += (e.clientY - drag.y) / canvas.clientHeight;
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  const endDrag = () => { drag = null; canvas.classList.replace('cursor-grabbing', 'cursor-grab'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ใช้คีย์บอร์ดได้: ลูกศร = เลื่อน, + / - = ซูม, Esc = ปิด
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); return close(null); }
    if (document.activeElement !== canvas || !img) return;
    const step = 0.02;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { ox += moves[e.key][0]; oy += moves[e.key][1]; }
    else if (e.key === '+' || e.key === '=') zoom = Math.min(4, zoom + 0.1);
    else if (e.key === '-') zoom = Math.max(1, zoom - 0.1);
    else return;
    e.preventDefault();
    render();
  });
  window.addEventListener('resize', () => { if (!root.hidden) render(); });

  // ปุ่ม "บันทึกและใช้รูปนี้": สร้างไฟล์ -> อัปโหลด -> ส่ง URL กลับ
  applyBtn.addEventListener('click', async () => {
    if (!img) return;
    showError('');
    KS.busy(applyBtn, true, 'กำลังอัปโหลด...');
    try {
      const { w, h } = outputSize();
      const blob = await encode(w, h);
      const url = await upload(blob, w, h);
      close(url);
    } catch (err) {
      KS.busy(applyBtn, false);
      showError(err.message);
    }
  });

  // ---------------------------------------------------------------------------
  // API ที่หน้าอื่นเรียกใช้
  // ---------------------------------------------------------------------------
  KS.imageEditor = {
    pickFile,
    /**
     * เปิดหน้าต่างแก้ไขรูป
     * @param {File|string|null} source ไฟล์ที่เลือก หรือ URL รูปเดิม (null = ให้เลือกไฟล์ก่อน)
     * @param {{title?: string, ratio?: string}} opts
     * @returns {Promise<string|null>} URL รูปใหม่ (/api/images/<id>) หรือ null ถ้ายกเลิก
     */
    async open(source, opts = {}) {
      if (resolver) close(null);
      if (!source) {
        source = await pickFile();
        if (!source) return null;
      }
      lastFocus = document.activeElement;
      $('#ie-title', root).textContent = opts.title ? `แก้ไขรูปภาพ: ${opts.title}` : 'แก้ไขรูปภาพ';
      $('#ie-sub', root).textContent = 'ครอป หมุน หรือซูม แล้วกดบันทึก รูปจะถูกย่อและบีบอัดให้อัตโนมัติ';
      $('#ie-src', root).textContent = '-';
      $('#ie-out', root).textContent = '-';
      ratioKey = RATIOS.some(r => r.key === opts.ratio) ? opts.ratio : 'orig';
      img = null;
      applyBtn.disabled = true;
      root.hidden = false;
      document.documentElement.classList.add('overflow-hidden');
      const result = new Promise(resolve => { resolver = resolve; });
      await setSource(source);
      applyBtn.focus();
      return result;
    },
  };
})();
