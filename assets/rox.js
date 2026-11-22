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

  // 4. Global Top-Right Toast Notification System
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

  // 5. Quotation & Contact Form Handling with Strict Input Validation & Direct Background Email
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const nameInput = contactForm.querySelector('input[name="name"]');
    const emailInput = contactForm.querySelector('input[name="email"]');
    const phoneInput = contactForm.querySelector('input[name="phone"]');
    const companyInput = contactForm.querySelector('input[name="company"]');
    const messageInput = contactForm.querySelector('textarea[name="message"]');

    // Real-time input filtering so customer CANNOT type invalid characters:
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        nameInput.value = nameInput.value.replace(/[^a-zA-Z\s.'-]/g, '');
      });
    }
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        // Only allow numbers, +, spaces, hyphens
        phoneInput.value = phoneInput.value.replace(/[^\d+ -]/g, '');
      });
    }
    if (emailInput) {
      emailInput.addEventListener('input', () => {
        emailInput.value = emailInput.value.replace(/\s/g, '');
      });
    }

    const highlightError = (el) => {
      if (!el) return;
      el.style.borderColor = '#EF4444';
      el.style.backgroundColor = '#FEF2F2';
      el.focus();
      const clear = () => {
        el.style.borderColor = '';
        el.style.backgroundColor = '';
        el.removeEventListener('input', clear);
      };
      el.addEventListener('input', clear);
    };

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = document.getElementById('form-note');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : 'Send it <span class="btn-arrow">→</span>';

      // 1. Validate Name
      const nameVal = nameInput ? nameInput.value.trim() : '';
      if (!nameVal || nameVal.length < 2 || !/^[a-zA-Z\s.'-]+$/.test(nameVal)) {
        highlightError(nameInput);
        window.showTopRightToast('error', 'Name Required', 'Please enter your real full name using letters only (minimum 2 characters).');
        return;
      }

      // 2. Validate Email
      const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : '';
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailVal || !emailRegex.test(emailVal)) {
        highlightError(emailInput);
        window.showTopRightToast('error', 'Valid Email Required', 'Please enter a valid email address (e.g. name@company.com).');
        return;
      }

      // 3. Validate Mobile Number (MANDATORY!)
      const phoneVal = phoneInput ? phoneInput.value.trim() : '';
      const digitsOnly = phoneVal.replace(/\D/g, '');
      if (!phoneVal || digitsOnly.length < 10 || digitsOnly.length > 15) {
        highlightError(phoneInput);
        window.showTopRightToast('error', 'Mobile Number Mandatory', 'Mobile number is mandatory. Please enter a valid 10 to 15-digit mobile number.');
        return;
      }

      // 4. Validate Message
      const messageVal = messageInput ? messageInput.value.trim() : '';
      if (!messageVal || messageVal.length < 5) {
        highlightError(messageInput);
        window.showTopRightToast('error', 'Project Details Required', 'Please describe your project requirements (at least 5 characters).');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending quotation…';
      }
      if (note) {
        note.className = 'note';
        note.textContent = '';
      }

      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());
      payload.name = nameVal;
      payload.email = emailVal;
      payload.phone = phoneVal;
      payload.message = messageVal;
      payload._subject = `New Quotation & Project Inquiry: ${nameVal} (${phoneVal})`;
      payload._template = 'table';
      payload._captcha = 'false';

      try {
        // Direct background email delivery (FormSubmit AJAX + Backend API)
        // Does NOT open any email apps or popups!
        const formSubmitPromise = fetch('https://formsubmit.co/ajax/hello@roxtech.online', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        }).catch(() => null);

        const backendPromise = fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => null);

        const responses = await Promise.all([formSubmitPromise, backendPromise]);
        const accepted = await Promise.all(responses.map(async response => {
          if (!response?.ok) return false;
          const result = await response.json().catch(() => null);
          return result?.success === true || result?.success === 'true';
        }));
        if (!accepted.some(Boolean)) throw new Error('Quotation delivery was not confirmed');

        // Success Feedback via Top-Right Popup Toast
        window.showTopRightToast(
          'success',
          'Quotation Sent Successfully',
          'Your quotation sent successfully! Our senior engineering team will respond within 24 hours.'
        );

        if (note) {
          note.textContent = 'Thank you! Your quotation inquiry has been sent successfully. Our senior engineering team will respond within 24 hours.';
          note.className = 'note ok';
        }

        contactForm.reset();
      } catch (err) {
        console.error('[Quotation Submit Error]', err);
        window.showTopRightToast(
          'error',
          'Submission Error',
          'There is some error sending your quotation. Please try again or reach us at hello@roxtech.online.'
        );
        if (note) {
          note.textContent = 'There was an issue sending your quotation. Please check your network or reach us at hello@roxtech.online.';
          note.className = 'note';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  // 6. Homepage Embedded Quotation Form Handling
  const homeQuoteForm = document.getElementById('home-quote-form');
  if (homeQuoteForm) {
    const hqName = document.getElementById('hq-name');
    const hqEmail = document.getElementById('hq-email');
    const hqPhone = document.getElementById('hq-phone');
    const hqService = document.getElementById('hq-service');
    const hqMessage = document.getElementById('hq-message');
    const hqNote = document.getElementById('hq-note');
    const hqSubmitBtn = document.getElementById('btn-submit-home-quote');

    if (hqName) {
      hqName.addEventListener('input', () => {
        hqName.value = hqName.value.replace(/[^a-zA-Z\s.'-]/g, '');
        hqName.style.borderColor = '';
      });
    }
    if (hqPhone) {
      hqPhone.addEventListener('input', () => {
        hqPhone.value = hqPhone.value.replace(/[^\d+ -]/g, '');
        hqPhone.style.borderColor = '';
      });
    }
    if (hqEmail) {
      hqEmail.addEventListener('input', () => {
        hqEmail.value = hqEmail.value.replace(/\s/g, '');
        hqEmail.style.borderColor = '';
      });
    }
    if (hqMessage) {
      hqMessage.addEventListener('input', () => {
        hqMessage.style.borderColor = '';
      });
    }

    homeQuoteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const originalText = hqSubmitBtn ? hqSubmitBtn.innerHTML : 'Send it <span class="btn-arrow">→</span>';

      const nameVal = hqName ? hqName.value.trim() : '';
      if (!nameVal || nameVal.length < 2 || !/^[a-zA-Z\s.'-]+$/.test(nameVal)) {
        if (hqName) { hqName.style.borderColor = '#EF4444'; hqName.focus(); }
        window.showTopRightToast('error', 'Name Required', 'Please enter your full name with letters only (minimum 2 characters).');
        return;
      }

      const emailVal = hqEmail ? hqEmail.value.trim().toLowerCase() : '';
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailVal || !emailRegex.test(emailVal)) {
        if (hqEmail) { hqEmail.style.borderColor = '#EF4444'; hqEmail.focus(); }
        window.showTopRightToast('error', 'Valid Email Required', 'Please enter a valid work email address (e.g. name@company.com).');
        return;
      }

      const phoneVal = hqPhone ? hqPhone.value.trim() : '';
      const digitsOnly = phoneVal.replace(/\D/g, '');
      if (!phoneVal || digitsOnly.length < 10 || digitsOnly.length > 15) {
        if (hqPhone) { hqPhone.style.borderColor = '#EF4444'; hqPhone.focus(); }
        window.showTopRightToast('error', 'Mobile Number Mandatory', 'Mobile number is mandatory. Please enter a valid 10 to 15-digit mobile number.');
        return;
      }

      const messageVal = hqMessage ? hqMessage.value.trim() : '';
      if (!messageVal || messageVal.length < 5) {
        if (hqMessage) { hqMessage.style.borderColor = '#EF4444'; hqMessage.focus(); }
        window.showTopRightToast('error', 'Details Required', 'Please describe your project requirements (at least 5 characters).');
        return;
      }

      if (hqSubmitBtn) {
        hqSubmitBtn.disabled = true;
        hqSubmitBtn.innerHTML = 'Sending quotation…';
      }

      const payload = {
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        service: hqService ? hqService.value : 'Custom Web Development',
        message: messageVal,
        _subject: `New Homepage Quotation Request: ${nameVal} (${phoneVal})`,
        _template: 'table',
        _captcha: 'false'
      };

      try {
        const formSubmitPromise = fetch('https://formsubmit.co/ajax/hello@roxtech.online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => null);

        const backendPromise = fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => null);

        const responses = await Promise.all([formSubmitPromise, backendPromise]);
        const accepted = await Promise.all(responses.map(async response => {
          if (!response?.ok) return false;
          const result = await response.json().catch(() => null);
          return result?.success === true || result?.success === 'true';
        }));
        if (!accepted.some(Boolean)) throw new Error('Quotation delivery was not confirmed');

        window.showTopRightToast(
          'success',
          'Quotation Sent Successfully',
          'Your quotation sent successfully! Our senior engineering team will respond within 24 hours.'
        );

        if (hqNote) {
          hqNote.textContent = 'Thank you! Your quotation request has been sent successfully. We will follow up within 24 hours.';
          hqNote.className = 'note ok';
        }

        homeQuoteForm.reset();
      } catch (err) {
        window.showTopRightToast(
          'error',
          'Submission Error',
          'There is some error sending your quotation. Please try again or reach us at hello@roxtech.online.'
        );
      } finally {
        if (hqSubmitBtn) {
          hqSubmitBtn.disabled = false;
          hqSubmitBtn.innerHTML = originalText;
        }
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRox);
} else {
  initRox();
}
