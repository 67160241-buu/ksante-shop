// หน้าแรก: โหลดหมวดหมู่ สินค้าใหม่ และสินค้าแนะนำจาก API
(async function () {
  const { $, api, esc, img, productCard, skeletonCards, bindCards, fmt } = KS;
  const TONES = { caps: ['bg-cobalt', 'text-white'], 'bucket-hats': ['bg-tangerine', 'text-white'], beanies: ['bg-sage', 'text-white'], berets: ['bg-mustard', 'text-ink'] };
  const TH = { caps: 'หมวกแก๊ป / Baseball / Snapback', 'bucket-hats': 'หมวกบักเก็ต', beanies: 'หมวกไหมพรม', berets: 'หมวกเบเร่ต์' };

  $('#new-drops').innerHTML = skeletonCards(4);
  $('#featured').innerHTML = skeletonCards(8);
  bindCards($('#new-drops'));
  bindCards($('#featured'));

  try {
    const [cats, newest, all] = await Promise.all([
      api('/api/categories'), api('/api/products?sort=newest&limit=4'), api('/api/products?sort=featured'),
    ]);
    $('#categories').innerHTML = cats.categories.map(c => {
      const [bg, fg] = TONES[c.slug] || ['bg-ink', 'text-white'];
      return `<a href="/shop?category=${encodeURIComponent(c.slug)}" class="group rounded-2xl ${bg} ${fg} p-5 aspect-[4/3] flex flex-col justify-between border-2 border-ink hover:shadow-block transition">
        <span class="text-xs font-bold opacity-80">${c.product_count} สินค้า</span>
        <span><span class="block font-display font-bold text-2xl">${esc(c.name)}</span><span class="block text-xs opacity-80 mt-1">${esc(TH[c.slug] || '')}</span></span>
        <span class="self-end w-9 h-9 rounded-full bg-white text-ink grid place-items-center group-hover:translate-x-1 transition">${KS.icon('arrow-right', 'w-4 h-4')}</span></a>`;
    }).join('');
    $('#new-drops').innerHTML = newest.products.map(productCard).join('');
    $('#featured').innerHTML = all.products.slice(0, 8).map(productCard).join('');

    // Hero: รูปสินค้าจริง 1 ชิ้นต่อหมวด วางบนบล็อกสี
    const pick = slug => all.products.find(p => p.category.slug === slug) || all.products[0];
    $('#hero-tiles').innerHTML = ['caps', 'bucket-hats', 'beanies', 'berets'].map(slug => {
      const p = pick(slug);
      return `<a href="/product-detail?slug=${encodeURIComponent(p.slug)}" class="relative rounded-2xl ${TONES[slug][0]} aspect-square overflow-hidden border-2 border-ink group">
        ${img(p.image_url, p.name, 'w-full h-full object-cover mix-blend-normal group-hover:scale-105 transition duration-500')}
        <span class="absolute bottom-2 left-2 right-2 bg-white/95 rounded-xl px-3 py-2 text-xs font-bold flex justify-between gap-2"><span class="truncate">${esc(p.name)}</span><span class="tabular">${fmt.money(p.price)}</span></span></a>`;
    }).join('');
  } catch (err) {
    $('#featured').innerHTML = `<p class="col-span-full text-danger font-bold">${esc(err.message)}</p>`;
  }

  // สินค้าที่เพิ่งดู: อ่านได้เฉพาะเมื่อยอมรับคุกกี้ Preferences
  function renderRecent() {
    const wrap = $('#recent-wrap');
    let list = [];
    if (KS.consent?.allowed('preferences')) { try { list = JSON.parse(localStorage.getItem('ks_recent')) || []; } catch { list = []; } }
    wrap.hidden = !list.length;
    $('#recent').innerHTML = list.map(r => `<a href="/product-detail?slug=${encodeURIComponent(r.slug)}" class="card w-40 shrink-0 overflow-hidden hover:border-ink">
      <span class="block aspect-square bg-mist">${img(r.image_url, r.name, 'w-full h-full object-cover')}</span>
      <span class="block p-3 text-xs font-bold truncate">${esc(r.name)}</span></a>`).join('');
  }
  renderRecent();
  document.addEventListener('consent:change', renderRecent);
})();
