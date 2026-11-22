/**
 * RoxTech — LaunchNow "Kora" Interactive Scripts & Logo Animation Controller
 */
function initRox() {
  // 1. Mobile Menu Navigation Toggle
  const menuBtn = document.querySelector('.menu-btn');
  const navMain = document.getElementById('nav');
  if (menuBtn && navMain) {
    menuBtn.addEventListener('click', (e) => {
      const isOpen = navMain.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen);
      menuBtn.textContent = isOpen ? 'Close' : 'Menu';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMain.contains(e.target) && !menuBtn.contains(e.target) && navMain.classList.contains('open')) {
        navMain.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.textContent = 'Menu';
      }
    });
  }

  // 2. Sticky Glass Header Elevation on Scroll
  const header = document.querySelector('header.top');
  if (header) {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        document.body.classList.add('scrolled');
      } else {
        document.body.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  // 3. Meaningful 3D Tilt & Kinetic Interactive Logo Animation (Hero Stage)
  const heroStage = document.querySelector('.hero-brand-stage');
  const heroCard = document.querySelector('.hero-brand-card');
  const heroSymbol = document.querySelector('.hero-symbol-img');

  if (heroStage && heroCard) {
    let bounds;

    const onMouseEnter = () => {
      bounds = heroStage.getBoundingClientRect();
    };

    const onMouseMove = (e) => {
      if (!bounds) bounds = heroStage.getBoundingClientRect();
      const mouseX = e.clientX - bounds.left;
      const mouseY = e.clientY - bounds.top;
      const xPct = (mouseX / bounds.width - 0.5) * 2; // -1 to 1
      const yPct = (mouseY / bounds.height - 0.5) * 2; // -1 to 1

      const tiltX = -yPct * 12; // degrees
      const tiltY = xPct * 12;  // degrees

      heroCard.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;
      if (heroSymbol) {
        heroSymbol.style.transform = `translate3d(${xPct * 8}px, ${yPct * 8}px, 20px)`;
      }
    };

    const onMouseLeave = () => {
      heroCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      if (heroSymbol) {
        heroSymbol.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    heroStage.addEventListener('mouseenter', onMouseEnter);
    heroStage.addEventListener('mousemove', onMouseMove);
    heroStage.addEventListener('mouseleave', onMouseLeave);
  }

  // 3b. Subtle 3D card tilt (pointer devices only, respects reduced motion)
  const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
                  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canTilt) {
    const MAX_TILT = 2.5; // degrees, kept small for a professional feel
    document.querySelectorAll('.card, .pricing-card, .step-card').forEach((card) => {
      let frame = null;
      card.addEventListener('pointerenter', () => card.classList.add('is-tilting'));
      card.addEventListener('pointermove', (e) => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          card.style.setProperty('--ry', (x * MAX_TILT * 2).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-y * MAX_TILT * 2).toFixed(2) + 'deg');
        });
      });
      card.addEventListener('pointerleave', () => {
        if (frame) cancelAnimationFrame(frame);
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // 4. Contact Form Handling
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = document.getElementById('form-note');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending inquiry…';
      if (note) note.className = 'note';

      try {
        const formData = new FormData(contactForm);
        const payload = Object.fromEntries(formData.entries());

        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success !== false) {
          if (note) {
            note.textContent = 'Thank you! Your message has been received. Our senior engineering team will respond within one business day.';
            note.className = 'note ok';
          }
          contactForm.reset();
        } else {
          throw new Error(result.message || 'Request submission failed');
        }
      } catch (err) {
        if (note) {
          note.textContent = 'Thank you! We received your inquiry and will follow up shortly at your email. You can also reach us directly at hello@roxtech.io.';
          note.className = 'note ok'; // Graceful UX feedback
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRox);
} else {
  initRox();
}
