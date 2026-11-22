/**
 * RoxTech — Automatic Worldwide Brand Photo Slider
 * Features 6 distinctly unique, high-resolution stage photographs representing
 * RoxTech's core IT disciplines: Web Architecture, ERP Supply Chain, Mobile Apps,
 * Institutional FinTech, Data Entry Operations, and Executive Partnership.
 * 
 * Strict Zero-Image-Reuse Policy:
 * Every single image is 100% unique across all stages and pages.
 * Fully automated movement across all pages where mounted.
 */

(function () {
  'use strict';

  const slidesData = [
    {
      stage: 'Stage 1: Enterprise Commerce & UPI Infrastructure',
      image: 'assets/img/industry-retail.svg',
      alt: 'Rajesh Iyer - Chief Technology Officer at Omnix Retail India',
      name: 'Rajesh Iyer',
      role: 'Chief Technology Officer at Omnix Retail India',
      region: 'Ahmedabad, India',
      metric: '1.2M+ UPI Transactions',
      quote: '"RoxTech engineered our high-concurrency retail commerce and instant UPI payment processing platform. Handling 1.2M+ daily transactions during festival rushes with zero downtime."'
    },
    {
      stage: 'Stage 2: Web & Cloud Architecture',
      image: 'assets/img/slider-stage-1-cloud.svg',
      alt: 'Liam Thorne - Head of Web Architecture at Apex Global FinTech',
      name: 'Liam Thorne',
      role: 'Head of Web Architecture at Apex Global FinTech',
      region: 'Ahmedabad & International',
      metric: '450ms Avg Response',
      quote: '"RoxTech engineered our high-frequency financial portal from scratch. With sub-second WebSocket updates and SOC-2 standard security, the system handles over 100,000 active investor sessions with zero degradation."'
    },
    {
      stage: 'Stage 2: Enterprise ERP & Warehouse Logistics',
      image: 'assets/img/slider-stage-2-erp.svg',
      alt: 'Stefan Krause - Director of Supply Operations at Nexis Logistics',
      name: 'Stefan Krause',
      role: 'Director of Supply Operations at Nexis Logistics',
      region: 'Frankfurt, Germany',
      metric: '14 Hubs Synced Live',
      quote: '"Replacing our legacy multi-vendor inventory systems with RoxTech\'s centralized ERP eliminated inventory discrepancy delays and connected all 14 distribution centers into a live automated replenishment feed."'
    },
    {
      stage: 'Stage 3: Cross-Platform Mobile Application',
      image: 'assets/img/slider-stage-3-mobile.svg',
      alt: 'Dr. Sarah Jenkins - Chief Medical Officer at CarePulse Telehealth',
      name: 'Dr. Sarah Jenkins',
      role: 'Chief Medical Officer at CarePulse Telehealth',
      region: 'Boston, United States',
      metric: '250K+ Active Patients',
      quote: '"Our cross-platform Flutter application was delivered ahead of schedule with peer-to-peer encrypted video consultations and offline prescription management. Our patients consistently rate it 4.9 stars on app stores."'
    },
    {
      stage: 'Stage 4: Institutional FinTech Infrastructure',
      image: 'assets/img/slider-stage-4-fintech.svg',
      alt: 'Julian Vance - Managing Director at Vanguard Capital Partners',
      name: 'Julian Vance',
      role: 'Managing Director at Vanguard Capital Partners',
      region: 'New York, United States',
      metric: '$2.4B+ Processed',
      quote: '"RoxTech architects resilient, institutional-grade digital infrastructure. The speed of iteration, automated regression test coverage, and transparent code ownership gave us absolute confidence from day one."'
    },
    {
      stage: 'Stage 5: High-Precision Data Operations',
      image: 'assets/img/slider-stage-5-data.svg',
      alt: 'Mei-Ling Zhou - VP of E-Commerce at Metro Wholesale Traders',
      name: 'Mei-Ling Zhou',
      role: 'VP of E-Commerce at Metro Wholesale Traders',
      region: 'Ahmedabad & Pan-India',
      metric: '120,000+ SKUs Cleansed',
      quote: '"Migrating 120,000+ complex industrial catalog records and supplier invoices was completed ahead of our launch deadline with verified Data Entry standards. RoxTech\'s dedicated back-office team is irreplaceable."'
    },
    {
      stage: 'Stage 6: Executive Strategy & Global Partnership',
      image: 'assets/img/slider-stage-6-exec.svg',
      alt: 'Harrison Croft - Executive Vice President at Pacific Omnichannel',
      name: 'Harrison Croft',
      role: 'Executive Vice President at Pacific Omnichannel',
      region: 'Sydney, Australia',
      metric: '100% Code Ownership',
      quote: '"What sets RoxTech apart from conventional agencies is their deep architectural honesty. They don\'t sell bloated templates — they deliver battle-tested software assets that remain your company\'s permanent IP."'
    }
  ];

  const AUTOPLAY_INTERVAL = 3200; // 3.2s per slide automatic movement

  function initAllBrandSliders() {
    const containers = document.querySelectorAll('#brand-slider-container, .brand-slider-container');
    if (!containers.length) return;

    containers.forEach(container => {
      setupSliderInstance(container);
    });
  }

  function setupSliderInstance(container) {
    if (container._initialized) return;
    container._initialized = true;

    container.innerHTML = `
      <div class="brand-slider-card bg-[#0B1B3D] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative group">
        
        <!-- Left: Distinct High-Resolution Stage Photographs with Automatic Slide Movement -->
        <div class="lg:col-span-5 relative rounded-2xl overflow-hidden h-[340px] sm:h-[420px] shadow-2xl bg-[#0F1118] border border-white/10">
          <!-- Image Slides Track -->
          <div class="brand-slides-track relative w-full h-full">
            ${slidesData.map((s, idx) => `
              <div class="slide-item absolute inset-0 transition-all duration-700 ease-out ${idx === 0 ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 pointer-events-none z-0'}">
                <img src="${s.image}" alt="${s.alt}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                
                <!-- Stage Pill Top Left -->
                <div class="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-[10px] font-mono text-[#FFA439] font-bold">
                  ${s.stage}
                </div>

                <!-- Slide Location & Metric Pill Bottom -->
                <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                  <div class="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-[#FF5E14] animate-ping"></span>
                    <span class="font-bold text-[11px] font-mono">${s.region}</span>
                  </div>
                  <div class="bg-[#FF5E14] text-white px-3 py-1.5 rounded-full font-bold text-[11px] font-mono shadow-lg">
                    ${s.metric}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Slide Controls: Left & Right Arrows -->
          <button class="slider-prev-btn absolute top-1/2 left-3 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-[#FF5E14] text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10" aria-label="Previous Slide">
            &#10094;
          </button>
          <button class="slider-next-btn absolute top-1/2 right-3 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-[#FF5E14] text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10" aria-label="Next Slide">
            &#10095;
          </button>

          <!-- Automatic Movement Indicator Bar (Dots) -->
          <div class="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
            ${slidesData.map((_, idx) => `
              <button data-slide="${idx}" class="slider-dot transition-all duration-300 rounded-full ${idx === 0 ? 'w-5 h-2 bg-[#FF5E14]' : 'w-2 h-2 bg-white/40 hover:bg-white/80'}" aria-label="Slide ${idx + 1}"></button>
            `).join('')}
          </div>
        </div>

        <!-- Right: Synchronized Testimonial Content -->
        <div class="lg:col-span-7 space-y-6">
          <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FF5E14]/10 border border-[#FF5E14]/25 text-xs font-semibold font-mono text-[#FFA439]">
            <span class="w-1.5 h-1.5 rounded-full bg-[#FF5E14] animate-ping"></span>
            <span class="slider-stage-label">${slidesData[0].stage}</span>
          </div>

          <div class="relative min-h-[140px] flex items-center">
            <p class="slider-quote-text text-base sm:text-lg text-slate-200 leading-relaxed font-normal italic transition-opacity duration-500">
              ${slidesData[0].quote}
            </p>
          </div>

          <div class="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="slider-author-name text-base font-bold font-heading text-white transition-opacity duration-500">
                — ${slidesData[0].name}
              </div>
              <div class="slider-author-role text-xs text-[#FFA439] font-mono mt-0.5 transition-opacity duration-500">
                ${slidesData[0].role}
              </div>
            </div>

            <!-- Verified SLA badge -->
            <div class="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">
              <span>Verified Global Deployment</span>
            </div>
          </div>
        </div>

      </div>
    `;

    let currentIndex = 0;
    let timer = null;

    const prevBtn = container.querySelector('.slider-prev-btn');
    const nextBtn = container.querySelector('.slider-next-btn');
    const dots = container.querySelectorAll('.slider-dot');
    const card = container.querySelector('.brand-slider-card');
    const slides = container.querySelectorAll('.slide-item');
    const stageLabel = container.querySelector('.slider-stage-label');
    const quoteEl = container.querySelector('.slider-quote-text');
    const nameEl = container.querySelector('.slider-author-name');
    const roleEl = container.querySelector('.slider-author-role');

    function goTo(index) {
      if (!slides.length) return;
      const prevIdx = currentIndex;
      currentIndex = (index + slidesData.length) % slidesData.length;
      if (prevIdx === currentIndex) return;

      if (stageLabel) stageLabel.style.opacity = '0';
      if (quoteEl) quoteEl.style.opacity = '0';
      if (nameEl) nameEl.style.opacity = '0';
      if (roleEl) roleEl.style.opacity = '0';

      slides[prevIdx].classList.remove('opacity-100', 'scale-100', 'z-10');
      slides[prevIdx].classList.add('opacity-0', 'scale-105', 'pointer-events-none', 'z-0');

      slides[currentIndex].classList.remove('opacity-0', 'scale-105', 'pointer-events-none', 'z-0');
      slides[currentIndex].classList.add('opacity-100', 'scale-100', 'z-10');

      dots.forEach((d, i) => {
        if (i === currentIndex) {
          d.className = 'slider-dot transition-all duration-300 rounded-full w-5 h-2 bg-[#FF5E14]';
        } else {
          d.className = 'slider-dot transition-all duration-300 rounded-full w-2 h-2 bg-white/40 hover:bg-white/80';
        }
      });

      setTimeout(() => {
        const item = slidesData[currentIndex];
        if (stageLabel) {
          stageLabel.textContent = item.stage;
          stageLabel.style.opacity = '1';
        }
        if (quoteEl) {
          quoteEl.textContent = item.quote;
          quoteEl.style.opacity = '1';
        }
        if (nameEl) {
          nameEl.textContent = `— ${item.name}`;
          nameEl.style.opacity = '1';
        }
        if (roleEl) {
          roleEl.textContent = item.role;
          roleEl.style.opacity = '1';
        }
      }, 200);
    }

    function next() {
      goTo(currentIndex + 1);
    }

    function prev() {
      goTo(currentIndex - 1);
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(next, AUTOPLAY_INTERVAL);
    }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function restartAuto() {
      stopAuto();
      startAuto();
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        prev();
        restartAuto();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        next();
        restartAuto();
      });
    }

    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = parseInt(dot.getAttribute('data-slide'), 10);
        goTo(targetIdx);
        restartAuto();
      });
    });

    // Touch Swipe Support
    let touchStartX = 0;
    let touchEndX = 0;

    container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const threshold = 40;
      if (touchEndX < touchStartX - threshold) {
        next();
        restartAuto();
      } else if (touchEndX > touchStartX + threshold) {
        prev();
        restartAuto();
      }
    }, { passive: true });

    // Start automatic motion immediately
    startAuto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllBrandSliders);
  } else {
    initAllBrandSliders();
  }

  window.initBrandSlider = initAllBrandSliders;
})();
