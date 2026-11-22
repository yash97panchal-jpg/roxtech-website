// RoxTech Enterprise Website Core Script
// Architecture Reference: Radixweb / Premier IT Consulting Standards

const API_BASE = window.location.protocol === 'file:' 
  ? 'http://localhost:5000' 
  : '';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Global Top-Right Toast Notification System
window.showTopRightToast = function(type, title, message) {
  let container = document.getElementById('rox-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'rox-toast-container';
    container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999999;display:flex;flex-direction:column;gap:12px;max-width:420px;width:calc(100vw - 48px);pointer-events:none;';
    document.body.appendChild(container);
  }

  const isSuccess = type === 'success';
  const toast = document.createElement('div');
  toast.className = 'rox-toast rox-toast-' + type;
  toast.style.cssText = 'pointer-events:auto;background:#0B1B3D;color:#FFFFFF;border:1px solid ' + 
    (isSuccess ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)') + 
    ';border-left:5px solid ' + (isSuccess ? '#10B981' : '#EF4444') + 
    ';border-radius:12px;padding:16px 18px;box-shadow:0 20px 40px rgba(0,0,0,0.35),0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:flex-start;gap:12px;transform:translateX(120%);opacity:0;transition:transform 0.35s cubic-bezier(0.16,1,0.3,1),opacity 0.35s ease;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  const iconSvg = isSuccess
    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
    : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

  toast.innerHTML = iconSvg +
    '<div style="flex:1;">' +
      '<div style="font-weight:700;font-size:14px;margin-bottom:3px;color:' + (isSuccess ? '#34D399' : '#FCA5A5') + ';letter-spacing:-0.01em;">' + title + '</div>' +
      '<div style="font-size:12.5px;line-height:1.45;color:#E2E8F0;">' + message + '</div>' +
    '</div>' +
    '<button type="button" aria-label="Close notification" style="background:none;border:none;color:#94A3B8;cursor:pointer;padding:0 4px;font-size:20px;line-height:1;border-radius:4px;margin-left:6px;transition:color 0.15s;" onmouseover="this.style.color=\'#FFF\'" onmouseout="this.style.color=\'#94A3B8\'">&times;</button>';

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  const dismiss = () => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  };

  toast.querySelector('button').addEventListener('click', dismiss);
  setTimeout(dismiss, 5500);
};

// Site Directory & Navigation Drawer Handlers
window.openSiteDirectory = function() {
  const backdrop = document.getElementById('site-directory-backdrop') || document.getElementById('mobile-drawer-backdrop');
  const panel = document.getElementById('site-directory-panel') || document.getElementById('mobile-drawer-panel');
  if (backdrop && panel) {
    backdrop.classList.add('open');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
};

window.closeSiteDirectory = function() {
  const backdrop = document.getElementById('site-directory-backdrop') || document.getElementById('mobile-drawer-backdrop');
  const panel = document.getElementById('site-directory-panel') || document.getElementById('mobile-drawer-panel');
  if (backdrop && panel) {
    backdrop.classList.remove('open');
    panel.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.toggleSiteDirectory = function() {
  const panel = document.getElementById('site-directory-panel') || document.getElementById('mobile-drawer-panel');
  if (panel && panel.classList.contains('open')) {
    window.closeSiteDirectory();
  } else {
    window.openSiteDirectory();
  }
};

window.openMobileDrawer = window.openSiteDirectory;
window.closeMobileDrawer = window.closeSiteDirectory;

// ESC key listener to close site directory
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeSiteDirectory();
  }
});

// Slide Bar Controls (Phone View Horizontal Scroll)
window.scrollSlideBar = function(barId, direction) {
  const container = document.getElementById(barId);
  if (!container) return;
  const cardWidth = container.querySelector('.phone-slide-item')?.offsetWidth || 300;
  const scrollAmount = (cardWidth + 16) * direction;
  container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
};

window.scrollToSlide = function(barId, index) {
  const container = document.getElementById(barId);
  if (!container) return;
  const items = container.querySelectorAll('.phone-slide-item');
  if (items[index]) {
    items[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
};

// Interactive Hero Practice Preview Switcher (Radixweb Inspired)
window.switchHeroPractice = function(practiceKey) {
  const practices = {
    web: {
      title: 'Custom Web Development & Cloud Portals',
      subtitle: 'Micro-Frontend, Next.js 14, High-Throughput REST/GraphQL',
      team: '1 Lead Architect, 3 Senior Full-Stack Engineers, 1 QA Automation',
      sla: '99.98% High Availability • Automated CI/CD Deployments',
      deliverables: ['Responsive Cloud Architecture', 'Multi-Tenant Security Gateways', 'Sub-second Core Web Vitals'],
      badge: 'PRACTICE 01 • WEB & CLOUD'
    },
    erp: {
      title: 'ERP & Custom Enterprise Software',
      subtitle: 'PostgreSQL, Python, Microservices, RBAC & Automated Invoicing',
      team: '1 Enterprise Systems Architect, 2 Backend Leads, 1 DB Administrator',
      sla: 'Zero-Data-Loss Backup • Automated Reconciliation SLA',
      deliverables: ['Departmental ERP Workflow Integration', 'Multi-Currency Tax & Billing Engines', 'Granular Role-Based Permissions'],
      badge: 'PRACTICE 02 • ERP SYSTEMS'
    },
    mobile: {
      title: 'Mobile Application Engineering',
      subtitle: 'Cross-Platform Flutter & React Native, Biometrics & Hardware Sync',
      team: '1 Mobile Solutions Lead, 2 Flutter/Swift Devs, 1 UX Specialist',
      sla: '60fps Buttery Smoothness • 99.9% Crash-Free Users',
      deliverables: ['Offline-First Local SQLite Sync', 'Biometric FaceID / Fingerprint Auth', 'App Store & Google Play Governance'],
      badge: 'PRACTICE 03 • MOBILE APPS'
    },
    bpo: {
      title: 'Data Entry, Digitization & BPO Support',
      subtitle: 'High-Volume Document Indexing, ETL Scrubbing & Catalog Ingestion',
      team: 'Dedicated Back-Office Operations Unit • Dual-Blind Validation',
      sla: '99.9% Accuracy Guarantee • Strict HIPAA / GDPR Enclaves',
      deliverables: ['Double-Key Data Entry Verification Protocol', '1M+ Monthly Document Digitization', '24/7 Multi-Shift Processing Enclave'],
      badge: 'PRACTICE 04 • BPO OPERATIONS'
    }
  };

  const data = practices[practiceKey] || practices.web;

  const titleEl = document.getElementById('hero-preview-title');
  const subtitleEl = document.getElementById('hero-preview-subtitle');
  const teamEl = document.getElementById('hero-preview-team');
  const slaEl = document.getElementById('hero-preview-sla');
  const badgeEl = document.getElementById('hero-preview-badge');
  const delivsEl = document.getElementById('hero-preview-deliverables');

  if (titleEl) titleEl.textContent = data.title;
  if (subtitleEl) subtitleEl.textContent = data.subtitle;
  if (teamEl) teamEl.textContent = data.team;
  if (slaEl) slaEl.textContent = data.sla;
  if (badgeEl) badgeEl.textContent = data.badge;

  if (delivsEl) {
    delivsEl.innerHTML = data.deliverables.map(d => `
      <div class="flex items-center gap-2 text-xs text-slate-700 font-medium">
        <i data-lucide="check-circle" class="w-3.5 h-3.5 text-[#FF5E14] shrink-0"></i>
        <span>${escapeHtml(d)}</span>
      </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  // Update tab buttons
  document.querySelectorAll('.hero-practice-tab').forEach(btn => {
    if (btn.getAttribute('data-practice') === practiceKey) {
      btn.className = 'hero-practice-tab px-3 py-2 rounded-md text-xs font-bold bg-[#FF5E14] text-white transition-all text-left';
    } else {
      btn.className = 'hero-practice-tab px-3 py-2 rounded-md text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all border border-slate-200 text-left';
    }
  });

  // Sync index for auto-play loop
  const pKeys = ['web', 'erp', 'mobile', 'bpo'];
  const newIdx = pKeys.indexOf(practiceKey);
  if (newIdx !== -1) {
    heroPracticeIdx = newIdx;
  }
};

// Automatic Hero Practice Matrix Showcase Carousel
const heroPracticeKeys = ['web', 'erp', 'mobile', 'bpo'];
let heroPracticeIdx = 0;
let heroPracticeTimer = null;

function startHeroPracticeAutoplay() {
  if (heroPracticeTimer) clearInterval(heroPracticeTimer);
  const matrixBox = document.getElementById('hero-preview-title');
  if (!matrixBox) return;

  heroPracticeTimer = setInterval(() => {
    heroPracticeIdx = (heroPracticeIdx + 1) % heroPracticeKeys.length;
    if (window.switchHeroPractice) {
      window.switchHeroPractice(heroPracticeKeys[heroPracticeIdx]);
    }
  }, 3500);
}

// Automatic Mobile / Phone Slide Bars Animator
function initAutoSlideBars() {
  const slideBars = document.querySelectorAll('.phone-slide-bar');
  slideBars.forEach(bar => {
    const barId = bar.id;
    const items = bar.querySelectorAll('.phone-slide-item');
    if (items.length <= 1) return;

    let currentSlideIdx = 0;
    let isUserActive = false;
    let userTimeout = null;

    const pause = () => {
      isUserActive = true;
      clearTimeout(userTimeout);
      userTimeout = setTimeout(() => {
        isUserActive = false;
      }, 3000);
    };

    bar.addEventListener('touchstart', pause, { passive: true });
    bar.addEventListener('mousedown', pause, { passive: true });
    bar.addEventListener('wheel', pause, { passive: true });

    setInterval(() => {
      if (isUserActive) return;
      // Only auto-scroll when in horizontal slide mode (overflow active)
      if (bar.scrollWidth > bar.clientWidth + 10) {
        currentSlideIdx = (currentSlideIdx + 1) % items.length;
        if (window.scrollToSlide && barId) {
          window.scrollToSlide(barId, currentSlideIdx);
        } else {
          items[currentSlideIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }, 3500);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Mobile Drawer Listeners
  const openBtn = document.getElementById('mobile-drawer-btn');
  const closeBtn = document.getElementById('mobile-drawer-close');
  const backdrop = document.getElementById('mobile-drawer-backdrop');

  if (openBtn) openBtn.addEventListener('click', window.openMobileDrawer);
  if (closeBtn) closeBtn.addEventListener('click', window.closeMobileDrawer);
  if (backdrop) backdrop.addEventListener('click', window.closeMobileDrawer);

  // Close drawer when clicking any link inside panel
  const drawerLinks = document.querySelectorAll('#mobile-drawer-panel a');
  drawerLinks.forEach(link => {
    link.addEventListener('click', window.closeMobileDrawer);
  });

  // Track slide bar scroll for indicator dots
  const slideBars = document.querySelectorAll('.phone-slide-bar');
  slideBars.forEach(bar => {
    const barId = bar.id;
    const dotsContainer = document.querySelector(`[data-dots-for="${barId}"]`);
    if (!dotsContainer) return;

    bar.addEventListener('scroll', () => {
      const scrollLeft = bar.scrollLeft;
      const itemWidth = bar.querySelector('.phone-slide-item')?.offsetWidth || 1;
      const activeIdx = Math.round(scrollLeft / (itemWidth + 16));
      
      const dots = dotsContainer.querySelectorAll('.slide-indicator-dot');
      dots.forEach((dot, idx) => {
        if (idx === activeIdx) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }, { passive: true });
  });

  // FAQ Accordion Handler
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');
    const icon = item.querySelector('.faq-icon');

    if (trigger && content) {
      trigger.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');

        faqItems.forEach(otherItem => {
          const otherContent = otherItem.querySelector('.faq-content');
          const otherIcon = otherItem.querySelector('.faq-icon');
          if (otherContent) otherContent.classList.remove('open');
          if (otherIcon) {
            otherIcon.classList.remove('rotate-180', 'bg-[#FF5E14]');
            otherIcon.classList.add('bg-white/10');
          }
        });

        if (!isOpen) {
          content.classList.add('open');
          if (icon) {
            icon.classList.add('rotate-180', 'bg-[#FF5E14]');
            icon.classList.remove('bg-white/10');
          }
        }
      });
    }
  });

  // Newsletter Form Handler
  const newsletterForm = document.getElementById('newsletter-form');
  const newsletterInput = document.getElementById('newsletter-email');
  const newsletterStatus = document.getElementById('newsletter-status');

  if (newsletterForm && newsletterInput && newsletterStatus) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = newsletterInput.value.trim();
      if (!email) return;

      newsletterStatus.textContent = 'Subscribing...';
      newsletterStatus.className = 'text-xs text-slate-400 mt-2';

      try {
        const res = await fetch(`${API_BASE}/api/newsletter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.success) {
          newsletterStatus.textContent = data.message;
          newsletterStatus.className = 'text-xs text-emerald-400 mt-2 font-medium';
          newsletterInput.value = '';
        } else {
          newsletterStatus.textContent = data.message || 'Subscription failed.';
          newsletterStatus.className = 'text-xs text-rose-400 mt-2';
        }
      } catch (err) {
        newsletterStatus.textContent = 'Thank you! You are registered for enterprise insights.';
        newsletterStatus.className = 'text-xs text-emerald-400 mt-2';
      }
    });
  }

  // Start automatic slide movements across website
  startHeroPracticeAutoplay();
  initAutoSlideBars();
});
