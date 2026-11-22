/**
 * Rox Assistant — IT Consultant & Consultation Booking
 * Plain Vanilla JS, zero dependencies, accessible, session-aware.
 */
(function () {
  'use strict';

  if (window.RoxAssistantInitialized) return;
  window.RoxAssistantInitialized = true;

  const STORAGE_KEY = 'rox_chat_session';
  const TEASER_KEY = 'rox_chat_teaser_dismissed';

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  const state = {
    isOpen: false,
    isTyping: false,
    unknownCount: 0,
    booking: null, // { step, service, name, email, phone, date, time, note, availableSlots }
    estimate: null, // { step, type, scale }
    messages: [] // { id, sender: 'bot'|'user', text, link, pills }
  };

  function loadSession() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          state.messages = parsed.messages;
          state.booking = parsed.booking || null;
          state.estimate = parsed.estimate || null;
          state.unknownCount = parsed.unknownCount || 0;
          return true;
        }
      }
    } catch (e) {
      console.warn('Session load error:', e);
    }
    return false;
  }

  function saveSession() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: state.messages,
        booking: state.booking,
        estimate: state.estimate,
        unknownCount: state.unknownCount
      }));
    } catch (e) {
      console.warn('Session save error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // DOM INJECTION & SETUP
  // ---------------------------------------------------------------------------
  function injectChatUI() {
    if (document.getElementById('rox-chat-root')) return;

    // Check if a WhatsApp button exists on page
    const wa = document.querySelector('[href*="whatsapp"], [href*="wa.me"], .whatsapp-float, .whatsapp-button');
    if (wa) {
      document.body.classList.add('has-whatsapp');
    }

    const root = document.createElement('div');
    root.id = 'rox-chat-root';
    root.innerHTML = `
      <!-- Floating launcher button with 3D Company Symbol -->
      <button class="rox-chat-launcher" id="rox-chat-launcher" aria-label="Open RoxTech Assistant" aria-expanded="false" aria-controls="rox-chat-window">
        <span class="rox-chat-launcher-symbol-box">
          <img src="assets/roxtech-symbol-trans.png" alt="RoxTech 3D Symbol" class="rox-chat-launcher-symbol" width="40" height="40">
        </span>
        <svg class="rox-chat-launcher-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- 8-Second Teaser Bubble -->
      <div class="rox-chat-teaser" id="rox-chat-teaser" role="status">
        <img src="assets/roxtech-symbol-trans.png" alt="" width="20" height="20" class="rox-chat-teaser-symbol">
        <span>Need help choosing a service?</span>
        <button class="rox-chat-teaser-close" id="rox-chat-teaser-close" aria-label="Dismiss teaser">&times;</button>
      </div>

      <!-- Chat window: 380px wide (full screen width minus 24px on phones), max-height 600px, border-radius 14px, 1px --line border, --surface background -->
      <div class="rox-chat-window" id="rox-chat-window" role="dialog" aria-modal="true" aria-labelledby="rox-chat-title">
        <!-- Header: --navy background, white text "Rox Assistant", subtitle "Usually replies instantly", close button, 3D avatar -->
        <div class="rox-chat-header">
          <div class="rox-chat-header-info">
            <div class="rox-chat-avatar-box">
              <img src="assets/roxtech-symbol-trans.png" alt="RoxTech" width="26" height="26" class="rox-chat-avatar">
            </div>
            <div class="rox-chat-title-group">
              <h3 id="rox-chat-title">Rox Assistant</h3>
              <p>Usually replies instantly</p>
            </div>
          </div>
          <button class="rox-chat-close-btn" id="rox-chat-close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Messages list with aria-live="polite" -->
        <div class="rox-chat-messages" id="rox-chat-messages" aria-live="polite"></div>

        <!-- Input bar with text field and send button (--cyan). Enter key sends -->
        <form class="rox-chat-input-bar" id="rox-chat-form">
          <input type="text" class="rox-chat-input" id="rox-chat-input" placeholder="Type a message..." autocomplete="off" aria-label="Chat message">
          <button type="submit" class="rox-chat-send" id="rox-chat-send" aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4Z"/>
              <path d="M22 2 11 13"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(root);

    // Event Listeners
    const launcher = document.getElementById('rox-chat-launcher');
    const closeBtn = document.getElementById('rox-chat-close-btn');
    const teaser = document.getElementById('rox-chat-teaser');
    const teaserClose = document.getElementById('rox-chat-teaser-close');
    const form = document.getElementById('rox-chat-form');
    const input = document.getElementById('rox-chat-input');
    const windowEl = document.getElementById('rox-chat-window');

    launcher.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', closeChat);

    teaser.addEventListener('click', (e) => {
      if (e.target !== teaserClose) {
        dismissTeaser();
        openChat();
      }
    });

    teaserClose.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissTeaser();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || state.isTyping) return;
      input.value = '';
      handleUserMessage(text);
    });

    // Keyboard accessibility: Escape closes, Focus Trap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) {
        closeChat();
        launcher.focus();
      }
      if (e.key === 'Tab' && state.isOpen) {
        trapFocus(e, windowEl);
      }
    });

    // 8-second teaser timeout
    if (sessionStorage.getItem(TEASER_KEY) !== 'true') {
      setTimeout(() => {
        if (!state.isOpen && sessionStorage.getItem(TEASER_KEY) !== 'true') {
          const t = document.getElementById('rox-chat-teaser');
          if (t) t.classList.add('show');
        }
      }, 8000);
    }
  }

  function dismissTeaser() {
    sessionStorage.setItem(TEASER_KEY, 'true');
    const teaser = document.getElementById('rox-chat-teaser');
    if (teaser) teaser.classList.remove('show');
  }

  function trapFocus(e, container) {
    const focusable = container.querySelectorAll('button:not([disabled]):not(.hidden), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openChat() {
    state.isOpen = true;
    dismissTeaser();
    const win = document.getElementById('rox-chat-window');
    const launcher = document.getElementById('rox-chat-launcher');
    const input = document.getElementById('rox-chat-input');
    if (win) win.classList.add('open');
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    renderMessages();
    setTimeout(() => {
      if (input) input.focus();
    }, 120);
  }

  function closeChat() {
    state.isOpen = false;
    const win = document.getElementById('rox-chat-window');
    const launcher = document.getElementById('rox-chat-launcher');
    if (win) win.classList.remove('open');
    if (launcher) launcher.setAttribute('aria-expanded', 'false');
  }

  function toggleChat() {
    if (state.isOpen) closeChat();
    else openChat();
  }

  // ---------------------------------------------------------------------------
  // MESSAGE RENDERING
  // ---------------------------------------------------------------------------
  function renderMessages() {
    const container = document.getElementById('rox-chat-messages');
    if (!container) return;

    container.innerHTML = '';
    state.messages.forEach((msg, idx) => {
      const msgEl = document.createElement('div');
      msgEl.className = `rox-chat-msg ${msg.sender}`;

      if (msg.sender === 'bot') {
        const botAvatar = document.createElement('img');
        botAvatar.src = 'assets/roxtech-symbol-trans.png';
        botAvatar.alt = 'Rox';
        botAvatar.className = 'rox-chat-msg-avatar';
        msgEl.appendChild(botAvatar);
      }

      const bubbleWrap = document.createElement('div');
      bubbleWrap.className = 'rox-chat-bubble-wrap';

      const bubble = document.createElement('div');
      bubble.className = 'rox-chat-bubble';

      const safeText = escapeHtml(msg.text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

      bubble.innerHTML = safeText;

      if (msg.link && typeof msg.link.url === 'string') {
        const urlStr = msg.link.url.trim();
        const isSafe = urlStr.startsWith('/') || /^https?:\/\//i.test(urlStr);
        if (isSafe) {
          const linkEl = document.createElement('a');
          linkEl.className = 'rox-chat-link';
          linkEl.href = urlStr;
          if (urlStr.startsWith('http')) {
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';
          }
          linkEl.textContent = msg.link.text;
          bubble.appendChild(document.createElement('br'));
          bubble.appendChild(linkEl);
        }
      }

      bubbleWrap.appendChild(bubble);

      // Only show pills on the latest bot message with pills
      const isLatestBotWithPills = msg.sender === 'bot' && msg.pills && idx === state.messages.length - 1 && !state.isTyping;
      if (isLatestBotWithPills) {
        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'rox-chat-pills';

        msg.pills.forEach(pill => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rox-chat-pill';
          btn.textContent = pill.label || pill;
          const val = pill.value || pill.label || pill;
          btn.addEventListener('click', () => {
            // Hide pills immediately once chosen
            pillsContainer.classList.add('hidden');
            msg.pills = null;
            saveSession();
            handleUserMessage(val, pill.label || pill);
          });
          pillsContainer.appendChild(btn);
        });

        bubbleWrap.appendChild(pillsContainer);
      }

      msgEl.appendChild(bubbleWrap);
      container.appendChild(msgEl);
    });

    if (state.isTyping) {
      const typingEl = document.createElement('div');
      typingEl.className = 'rox-chat-msg bot';
      const typingAvatar = document.createElement('img');
      typingAvatar.src = 'assets/roxtech-symbol-trans.png';
      typingAvatar.alt = 'Rox';
      typingAvatar.className = 'rox-chat-msg-avatar';
      typingEl.appendChild(typingAvatar);

      const dots = document.createElement('div');
      dots.className = 'rox-chat-typing';
      dots.setAttribute('aria-label', 'Rox Assistant is typing');
      dots.innerHTML = '<span></span><span></span><span></span>';
      typingEl.appendChild(dots);

      container.appendChild(typingEl);
    }

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------------
  // BOT DISPATCHER WITH 600MS TYPING INDICATOR
  // ---------------------------------------------------------------------------
  function botReply(text, options = {}) {
    state.isTyping = true;
    renderMessages();

    setTimeout(() => {
      state.isTyping = false;
      state.messages.push({
        id: Date.now(),
        sender: 'bot',
        text,
        link: options.link || null,
        pills: options.pills || null
      });
      saveSession();
      renderMessages();
    }, 600);
  }

  // ---------------------------------------------------------------------------
  // MAIN CONVERSATION FLOWS
  // ---------------------------------------------------------------------------
  const MAIN_PILLS = [
    { label: 'Find a service', value: 'Find a service' },
    { label: 'Book a consultation', value: 'Book a consultation' },
    { label: 'Get a price estimate', value: 'Get a price estimate' },
    { label: 'Talk to a person', value: 'Talk to a person' }
  ];

  function showGreeting() {
    botReply("Hi, I'm Rox Assistant. I can help you find the right service or book a free consultation.", {
      pills: MAIN_PILLS
    });
  }

  // 1) Find a service
  function askServiceNeeds() {
    state.booking = null;
    state.estimate = null;
    botReply("What do you want to achieve?", {
      pills: [
        { label: 'Build a website', value: 'Build a website' },
        { label: 'Manage my business with software', value: 'Manage my business with software' },
        { label: 'Create a mobile app', value: 'Create a mobile app' },
        { label: 'Move to the cloud', value: 'Move to the cloud' },
        { label: 'Automate with AI', value: 'Automate with AI' },
        { label: 'Clean or enter data', value: 'Clean or enter data' }
      ]
    });
  }

  function handleServiceRecommendation(type) {
    const t = type.toLowerCase();
    let text = '';
    let link = null;

    if (t.includes('website') || t.includes('web') || t.includes('portal') || t.includes('storefront')) {
      text = "We build fast, secure company websites and customer portals designed to convert visitors and load in under two seconds. Every build includes responsive design, secure payments, and easy content editing without needing a developer.";
      link = { text: 'Explore Web Development →', url: 'services.html#web' };
    } else if (t.includes('manage') || t.includes('software') || t.includes('erp') || t.includes('inventory')) {
      text = "We replace spreadsheets and disconnected tools with tailored systems for inventory, orders, billing, and reporting in one place. Your software includes role-based access, Tally and GST integration, and full team training at handover.";
      link = { text: 'Explore ERP & Custom Software →', url: 'services.html#erp' };
    } else if (t.includes('mobile') || t.includes('app') || t.includes('ios') || t.includes('android')) {
      text = "We engineer iOS and Android apps from a single Flutter codebase that your customers or field teams will actually use. Each app includes offline mode with auto-sync, push notifications, and App Store and Play Store publishing.";
      link = { text: 'Explore Mobile Apps →', url: 'services.html#mobile' };
    } else if (t.includes('cloud') || t.includes('aws') || t.includes('azure') || t.includes('devops')) {
      text = "We manage seamless migrations, automated deployments, and continuous monitoring on AWS, Azure, or Google Cloud. Our cloud architecture cuts monthly infrastructure spend while maintaining enterprise-grade security.";
      link = { text: 'Explore Cloud & DevOps →', url: 'services.html#web' };
    } else if (t.includes('ai') || t.includes('automate') || t.includes('bot') || t.includes('chatbot')) {
      text = "We build custom chatbots, document processing pipelines, and workflow automations that remove repetitive manual work from your team. These smart automation systems integrate directly into your existing databases to save hours every week.";
      link = { text: 'Explore AI & Automation →', url: 'services.html#data' };
    } else if (t.includes('data') || t.includes('clean') || t.includes('catalog') || t.includes('digitiz')) {
      text = "We provide catalog digitization, database cleanup, and bulk data entry delivered at 99.9% accuracy. We also configure interactive dashboards for sales, stock, and operations so decisions rest on accurate numbers.";
      link = { text: 'Explore Data Services →', url: 'services.html#data' };
    } else {
      text = "We build tailored software, cloud infrastructure, and data workflows designed around how your business operates. Every solution is delivered on time with fixed milestone pricing and complete code ownership.";
      link = { text: 'View All Services →', url: 'services.html' };
    }

    botReply(text, {
      link,
      pills: [
        { label: 'Book a consultation', value: 'Book a consultation' },
        { label: 'Ask something else', value: 'Ask something else' }
      ]
    });
  }

  // 2) Book a consultation
  function startBookingFlow(preselectedService) {
    state.booking = {
      step: 'service',
      service: preselectedService || '',
      name: '',
      email: '',
      phone: '',
      date: '',
      time: '',
      note: '',
      availableSlots: []
    };

    if (preselectedService) {
      askBookingName();
    } else {
      botReply("Which service would you like to discuss?", {
        pills: [
          { label: 'Web development', value: 'Web development' },
          { label: 'ERP & custom software', value: 'ERP & custom software' },
          { label: 'Mobile apps', value: 'Mobile apps' },
          { label: 'Cloud and DevOps', value: 'Cloud and DevOps' },
          { label: 'AI and automation', value: 'AI and automation' },
          { label: 'Data services', value: 'Data services' }
        ]
      });
    }
  }

  function askBookingName() {
    state.booking.step = 'name';
    botReply("Great! What is your full name?");
  }

  function askBookingEmail() {
    state.booking.step = 'email';
    botReply("What is your work email address?");
  }

  function askBookingPhone() {
    state.booking.step = 'phone';
    botReply("What is your phone number? (Optional – click Skip if you prefer email only)", {
      pills: [{ label: 'Skip', value: 'skip' }]
    });
  }

  // Preferred date: next 14 days, weekdays only
  function generateNextWeekdays(maxDays = 14) {
    const dates = [];
    const d = new Date();
    for (let i = 1; i <= maxDays; i++) {
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + i);
      const day = nextD.getDay();
      if (day !== 0 && day !== 6) {
        const yyyy = nextD.getFullYear();
        const mm = String(nextD.getMonth() + 1).padStart(2, '0');
        const dd = String(nextD.getDate()).padStart(2, '0');
        const val = `${yyyy}-${mm}-${dd}`;
        const label = nextD.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        dates.push({ label, value: val });
      }
    }
    return dates;
  }

  function askBookingDate() {
    state.booking.step = 'date';
    const weekdays = generateNextWeekdays(14);
    botReply("Please choose a preferred consultation date (weekdays only):", {
      pills: weekdays
    });
  }

  async function checkAvailabilityAndAskTime(selectedDate) {
    state.booking.date = selectedDate;
    state.booking.step = 'time';

    const parts = selectedDate.split('-').map(Number);
    const dateFormatted = new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    botReply(`Checking available time slots for **${dateFormatted}**...`);

    try {
      const res = await fetch(`/api/bookings/availability?date=${encodeURIComponent(selectedDate)}`);
      const data = await res.json();
      const slots = data.available_slots || data.slots || ['10:00', '12:00', '15:00', '17:00'];
      state.booking.availableSlots = slots;

      if (!slots || slots.length === 0) {
        botReply(`All consultation slots are already booked on ${dateFormatted}. Please select another date:`, {
          pills: generateNextWeekdays(14)
        });
        state.booking.step = 'date';
        return;
      }

      const slotPills = slots.map(s => ({
        label: `${s} IST`,
        value: s
      }));

      botReply(`Please select a preferred time slot on **${dateFormatted}**:`, {
        pills: slotPills
      });
    } catch (err) {
      console.warn('Availability check error:', err);
      state.booking.availableSlots = ['10:00', '12:00', '15:00', '17:00'];
      botReply(`Please select a preferred time slot on **${dateFormatted}**:`, {
        pills: [
          { label: '10:00 IST', value: '10:00' },
          { label: '12:00 IST', value: '12:00' },
          { label: '15:00 IST', value: '15:00' },
          { label: '17:00 IST', value: '17:00' }
        ]
      });
    }
  }

  function askBookingNote() {
    state.booking.step = 'note';
    botReply("Would you like to add a short project note before our consultation? (Optional)", {
      pills: [{ label: 'Skip', value: 'skip' }]
    });
  }

  function showBookingSummary() {
    state.booking.step = 'confirm';
    const b = state.booking;
    const summaryText =
      `Please review your consultation details:\n\n` +
      `• **Service:** ${b.service}\n` +
      `• **Name:** ${b.name}\n` +
      `• **Email:** ${b.email}\n` +
      `• **Phone:** ${b.phone || 'Not provided'}\n` +
      `• **Date:** ${b.date}\n` +
      `• **Time:** ${b.time} IST\n` +
      `• **Note:** ${b.note || 'None'}`;

    botReply(summaryText, {
      pills: [
        { label: 'Confirm booking', value: 'Confirm booking' },
        { label: 'Edit details', value: 'Edit details' },
        { label: 'Cancel', value: 'Cancel booking' }
      ]
    });
  }

  async function submitBooking() {
    const b = state.booking;
    botReply("Booking your consultation...");

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: b.name,
          email: b.email,
          phone: b.phone === 'Not provided' ? '' : b.phone,
          service: b.service,
          booking_date: b.date,
          booking_time: b.time,
          note: b.note
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Booking submission failed');
      }

      state.booking = null;
      saveSession();

      botReply(`Your consultation is confirmed! Reference ID: **#BKG-${data.id}**.\n\nA calendar invitation and confirmation details have been sent to **${b.email}**. We look forward to meeting with you on **${b.date}** at **${b.time} IST**.`, {
        pills: [
          { label: 'Ask something else', value: 'Ask something else' },
          { label: 'Close chat', value: 'Close chat' }
        ]
      });
    } catch (err) {
      botReply(`We could not complete your booking: ${err.message}. Would you like to select another slot?`, {
        pills: [
          { label: 'Choose another slot', value: 'Book a consultation' },
          { label: 'Talk to a person', value: 'Talk to a person' }
        ]
      });
    }
  }

  // 3) Price estimate
  function startPriceEstimateFlow() {
    state.booking = null;
    state.estimate = { step: 'type', type: '', scale: '' };
    botReply("Which type of project would you like a price estimate for?", {
      pills: [
        { label: 'Web development', value: 'Web development' },
        { label: 'ERP & custom software', value: 'ERP & custom software' },
        { label: 'Mobile app', value: 'Mobile app' },
        { label: 'Cloud migration', value: 'Cloud migration' },
        { label: 'Data services & AI', value: 'Data services & AI' }
      ]
    });
  }

  function askEstimateScale(type) {
    state.estimate.type = type;
    state.estimate.step = 'scale';
    botReply(`What is the planned size or scope for your **${type}**?`, {
      pills: [
        { label: 'Starter / MVP', value: 'Starter / MVP' },
        { label: 'Growth / Multi-module', value: 'Growth / Multi-module' },
        { label: 'Enterprise scale', value: 'Enterprise scale' }
      ]
    });
  }

  function showEstimateResult(scale) {
    const type = state.estimate ? state.estimate.type : 'Custom software';
    state.estimate = null;

    let range = '$5,000 to $12,000';
    let timeline = '4 to 6 weeks';

    const s = scale.toLowerCase();
    if (s.includes('enterprise')) {
      range = '$35,000 to $70,000+';
      timeline = '12 to 20 weeks';
    } else if (s.includes('growth') || s.includes('multi')) {
      range = '$12,000 to $35,000';
      timeline = '6 to 12 weeks';
    }

    const reply =
      `Starting from **${range}** for ${scale} (${type}).\n\n` +
      `Typical delivery timeframe is **${timeline}** in agile sprints. You receive fixed milestone pricing, 100% code ownership, and 30 days of post-launch care. You can also calculate a tailored estimate using our Project Estimator:`;

    botReply(reply, {
      link: { text: 'Open Project Estimator →', url: 'estimator.html' },
      pills: [
        { label: 'Book a consultation', value: 'Book a consultation' },
        { label: 'Ask something else', value: 'Ask something else' }
      ]
    });
  }

  // 4) Talk to a person
  function showContactInfo() {
    state.booking = null;
    state.estimate = null;
    botReply(
      `You can reach a RoxTech consultant directly:\n\n` +
      `• **RoxTech Technology Center of Excellence (HQ):** RoxTech Tower, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380054, India\n` +
      `• **Phone:** +91 79 4912 3000 (Toll-Free: 1800 120 7698)\n` +
      `• **Email:** hello@roxtech.io\n` +
      `• **Hours:** Monday to Friday, 9:00 AM – 7:00 PM IST\n\n` +
      `We reply to all inquiries within one business day.`,
      {
        link: { text: 'Go to Contact Page →', url: 'contact.html' },
        pills: [
          { label: 'Book a consultation', value: 'Book a consultation' },
          { label: 'Ask something else', value: 'Ask something else' }
        ]
      }
    );
  }

  // ---------------------------------------------------------------------------
  // USER INPUT & INTENT MATCHING
  // ---------------------------------------------------------------------------
  function handleUserMessage(text, displayLabel) {
    state.messages.push({
      id: Date.now(),
      sender: 'user',
      text: displayLabel || text
    });
    saveSession();
    renderMessages();

    const q = text.trim();
    const lower = q.toLowerCase();

    // Active booking flow
    if (state.booking && state.booking.step) {
      handleBookingStep(q, lower);
      return;
    }

    // Active estimate flow
    if (state.estimate && state.estimate.step) {
      handleEstimateStep(q);
      return;
    }

    // Main options
    if (lower === 'find a service' || lower.includes('find service')) {
      state.unknownCount = 0;
      askServiceNeeds();
      return;
    }

    if (lower === 'book a consultation' || lower.includes('consultation') || lower.includes('appointment') || lower.includes('schedule a call') || lower.includes('book call')) {
      state.unknownCount = 0;
      startBookingFlow();
      return;
    }

    if (lower === 'get a price estimate' || lower.includes('price estimate')) {
      state.unknownCount = 0;
      startPriceEstimateFlow();
      return;
    }

    if (lower === 'talk to a person' || lower.includes('talk to person') || lower.includes('human') || lower.includes('speak with')) {
      state.unknownCount = 0;
      showContactInfo();
      return;
    }

    if (lower === 'ask something else' || lower === 'menu' || lower === 'start over' || lower === 'restart') {
      state.unknownCount = 0;
      state.booking = null;
      state.estimate = null;
      showGreeting();
      return;
    }

    if (lower === 'close chat') {
      closeChat();
      return;
    }

    // Find a service button options
    if (lower === 'build a website') {
      state.unknownCount = 0;
      handleServiceRecommendation('website');
      return;
    }
    if (lower === 'manage my business with software') {
      state.unknownCount = 0;
      handleServiceRecommendation('erp');
      return;
    }
    if (lower === 'create a mobile app') {
      state.unknownCount = 0;
      handleServiceRecommendation('mobile');
      return;
    }
    if (lower === 'move to the cloud') {
      state.unknownCount = 0;
      handleServiceRecommendation('cloud');
      return;
    }
    if (lower === 'automate with ai') {
      state.unknownCount = 0;
      handleServiceRecommendation('ai');
      return;
    }
    if (lower === 'clean or enter data') {
      state.unknownCount = 0;
      handleServiceRecommendation('data');
      return;
    }

    // Free-text keyword matchers
    if (lower.includes('website') || lower.includes('web') || lower.includes('portal') || lower.includes('storefront')) {
      state.unknownCount = 0;
      handleServiceRecommendation('website');
      return;
    }

    if (lower.includes('erp') || lower.includes('inventory') || lower.includes('billing') || lower.includes('tally')) {
      state.unknownCount = 0;
      handleServiceRecommendation('erp');
      return;
    }

    if (lower.includes('app') || lower.includes('mobile') || lower.includes('ios') || lower.includes('android') || lower.includes('flutter')) {
      state.unknownCount = 0;
      handleServiceRecommendation('mobile');
      return;
    }

    if (lower.includes('cloud') || lower.includes('aws') || lower.includes('azure') || lower.includes('devops')) {
      state.unknownCount = 0;
      handleServiceRecommendation('cloud');
      return;
    }

    if (lower.includes('ai') || lower.includes('chatbot') || lower.includes('automation') || lower.includes('ocr')) {
      state.unknownCount = 0;
      handleServiceRecommendation('ai');
      return;
    }

    if (lower.includes('data entry') || lower.includes('catalog') || lower.includes('clean data') || lower.includes('digitiz')) {
      state.unknownCount = 0;
      handleServiceRecommendation('data');
      return;
    }

    if (lower.includes('price') || lower.includes('estimate') || lower.includes('cost') || lower.includes('pricing') || lower.includes('quote')) {
      state.unknownCount = 0;
      startPriceEstimateFlow();
      return;
    }

    if (lower.includes('career') || lower.includes('job') || lower.includes('hiring') || lower.includes('apply')) {
      state.unknownCount = 0;
      botReply("We are actively hiring talented software engineers, product designers, and data specialists across our engineering pods. You can browse our current openings and submit your application on our Careers page.", {
        link: { text: 'View Careers →', url: 'careers.html' },
        pills: MAIN_PILLS
      });
      return;
    }

    if (lower.includes('ahmedabad') || lower.includes('gujarat') || lower.includes('office') || lower.includes('location') || lower.includes('address') || lower.includes('where are you') || lower.includes('headquarters') || lower.includes('india')) {
      state.unknownCount = 0;
      botReply(
        `**RoxTech Technology Center of Excellence (HQ):**\n\n` +
        `• **Ahmedabad Headquarters:** RoxTech Tower, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380054, India\n` +
        `• **Phone:** +91 79 4912 3000 | Toll-Free: 1800 120 7698\n` +
        `• **Email:** hello@roxtech.io\n` +
        `• **Support Hours:** 9:00 AM – 7:00 PM IST (Mon–Fri) & 24/7 SLA Engineering Operations`,
        {
          link: { text: 'View Office & Contact Details →', url: 'contact.html' },
          pills: MAIN_PILLS
        }
      );
      return;
    }

    if (lower.includes('contact') || lower.includes('phone') || lower.includes('email') || lower.includes('reach')) {
      state.unknownCount = 0;
      showContactInfo();
      return;
    }

    // Fallback: If not understood twice, offer four main quick replies and contact link
    state.unknownCount++;
    if (state.unknownCount === 1) {
      botReply("I'm not sure I understood that. I can help you find a service, book a consultation, or estimate project pricing.", {
        pills: MAIN_PILLS
      });
    } else {
      botReply("I'm sorry, I'm still having trouble understanding your request. Please choose one of the options below or contact our team directly:", {
        link: { text: 'Contact RoxTech Team →', url: 'contact.html' },
        pills: MAIN_PILLS
      });
      state.unknownCount = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP-BY-STEP BOOKING HANDLER
  // ---------------------------------------------------------------------------
  function handleBookingStep(raw, lower) {
    const b = state.booking;

    if (lower === 'cancel booking' || lower === 'cancel') {
      state.booking = null;
      saveSession();
      botReply("Consultation booking cancelled. How else can I help you today?", {
        pills: MAIN_PILLS
      });
      return;
    }

    if (lower === 'edit details') {
      b.step = 'name';
      botReply("Let's revise your details. What is your full name?");
      return;
    }

    // 1. Service
    if (b.step === 'service') {
      b.service = raw;
      askBookingName();
      return;
    }

    // 2. Name
    if (b.step === 'name') {
      if (raw.trim().length < 2) {
        botReply("Please enter your full name (at least 2 letters):");
        return;
      }
      b.name = raw.trim();
      askBookingEmail();
      return;
    }

    // 3. Email
    if (b.step === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(raw.trim())) {
        botReply("Please enter a valid email address (e.g., name@company.com):");
        return;
      }
      b.email = raw.trim().toLowerCase();
      askBookingPhone();
      return;
    }

    // 4. Phone (optional)
    if (b.step === 'phone') {
      b.phone = (lower === 'skip' || lower === 'no') ? 'Not provided' : raw.trim();
      askBookingDate();
      return;
    }

    // 5. Preferred date
    if (b.step === 'date') {
      let dateVal = raw.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          dateVal = parsed.toISOString().split('T')[0];
        }
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        botReply("Please select a date from the options below:", {
          pills: generateNextWeekdays(14)
        });
        return;
      }

      checkAvailabilityAndAskTime(dateVal);
      return;
    }

    // 6. Preferred time slot
    if (b.step === 'time') {
      let slotVal = raw.replace(/\s*(AM|PM|IST)/gi, '').trim();
      const validSlots = ['10:00', '12:00', '15:00', '17:00'];
      if (!validSlots.includes(slotVal)) {
        botReply("Please select one of the allowed time slots ([10:00] [12:00] [15:00] [17:00] IST):", {
          pills: (b.availableSlots && b.availableSlots.length > 0 ? b.availableSlots : validSlots).map(s => ({
            label: `${s} IST`,
            value: s
          }))
        });
        return;
      }

      // Check if slot is already booked on this date
      if (b.availableSlots && b.availableSlots.length > 0 && !b.availableSlots.includes(slotVal)) {
        botReply(`Sorry, the ${slotVal} IST slot is already booked for this date. Please choose an available slot:`, {
          pills: b.availableSlots.map(s => ({
            label: `${s} IST`,
            value: s
          }))
        });
        return;
      }

      b.time = slotVal;
      askBookingNote();
      return;
    }

    // 7. Short project note (optional)
    if (b.step === 'note') {
      b.note = (lower === 'skip' || lower === 'no') ? '' : raw.trim();
      showBookingSummary();
      return;
    }

    // 8. Confirmation summary
    if (b.step === 'confirm') {
      if (lower === 'confirm booking' || lower === 'confirm' || lower === 'yes') {
        submitBooking();
      } else {
        botReply("Please confirm your booking, edit your details, or cancel:", {
          pills: [
            { label: 'Confirm booking', value: 'Confirm booking' },
            { label: 'Edit details', value: 'Edit details' },
            { label: 'Cancel', value: 'Cancel booking' }
          ]
        });
      }
    }
  }

  function handleEstimateStep(raw) {
    if (state.estimate.step === 'type') {
      askEstimateScale(raw);
    } else if (state.estimate.step === 'scale') {
      showEstimateResult(raw);
    }
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION ON PAGE LOAD
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    injectChatUI();
    const hadSession = loadSession();
    if (!hadSession) {
      showGreeting();
    } else if (state.messages.length > 0) {
      renderMessages();
    }
  });

})();
