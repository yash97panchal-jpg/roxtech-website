/**
 * RoxTech — Customer Authentication, Project Inquiries & Service Order System
 * 
 * Rules:
 * 1. Customer authentication required to Order Services and Submit Inquiries.
 * 2. Smart Email Detection:
 *    - If user enters an email that already exists -> prompts & switches to Log In.
 *    - If user enters an email that does not exist -> prompts & switches to Sign Up.
 * 3. After auth, automatically resumes and executes the pending order or inquiry.
 */

(function () {
  'use strict';

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
  // 1. CUSTOMER SESSION STATE
  // ---------------------------------------------------------------------------
  function getCsrfToken() {
    const match = document.cookie.match(/roxtech_csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function getCustomer() {
    try {
      const data = localStorage.getItem('roxtech_customer');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function setCustomer(customer) {
    try {
      localStorage.setItem('roxtech_customer', JSON.stringify(customer));
      updateNavAuth();
      syncCustomerForms();
    } catch (e) {}
  }

  function clearCustomer() {
    try {
      localStorage.removeItem('roxtech_customer');
      localStorage.removeItem('roxtech_customer_token');
      const headers = { 'Content-Type': 'application/json' };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers }).catch(() => {});
      updateNavAuth();
      syncCustomerForms();
      window.location.reload();
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // 2. INJECT MODAL MARKUP
  // ---------------------------------------------------------------------------
  function injectModals() {
    if (document.getElementById('rox-auth-modal-root')) return;

    const root = document.createElement('div');
    root.id = 'rox-auth-modal-root';
    root.innerHTML = `
      <!-- ===================================================================== -->
      <!-- A. CUSTOMER AUTHENTICATION MODAL (Log In / Create Account)           -->
      <!-- ===================================================================== -->
      <div id="auth-modal" class="fixed inset-0 z-[100] hidden flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <div class="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-slate-800">
          
          <!-- Close Button -->
          <button onclick="window.closeAuthModal()" class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors" title="Close">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <!-- Modal Header -->
          <div class="text-center space-y-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF5E14]">
              <span>RoxTech Client Portal</span>
            </div>
            <h3 id="auth-modal-title" class="text-2xl font-extrabold text-[#0B1B3D]">Sign In Required</h3>
            <p id="auth-modal-desc" class="text-xs text-slate-600 leading-relaxed">
              Please sign in or create an account to order services or submit your project inquiry.
            </p>
          </div>

          <!-- Auth Tabs -->
          <div class="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button id="tab-login" onclick="window.switchAuthTab('login')" class="flex-1 py-2.5 rounded-lg bg-[#FF5E14] text-white transition-all shadow-xs">
              Log In
            </button>
            <button id="tab-register" onclick="window.switchAuthTab('register')" class="flex-1 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all">
              Sign Up (New Account)
            </button>
          </div>

          <!-- Smart Notification Banner (Auto Switch & Verification Status) -->
          <div id="auth-alert" class="hidden"></div>

          <!-- 1. LOGIN FORM -->
          <form id="form-auth-login" onsubmit="window.handleAuthLogin(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address *</label>
              <input type="email" id="login-email" required placeholder="alex@company.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password *</label>
              <input type="password" id="login-pass" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <button type="submit" id="btn-login-submit" class="btn-enterprise-primary w-full py-3 justify-center text-sm font-bold shadow-md">
              <span>Sign In &amp; Continue</span>
            </button>
            <div class="text-center pt-1 text-xs text-slate-500">
              New here? <button type="button" onclick="window.switchAuthTab('register')" class="text-[#FF5E14] font-bold hover:underline">Create an account</button>
            </div>
          </form>

          <!-- 2. REGISTER FORM -->
          <form id="form-auth-register" onsubmit="window.handleAuthRegister(event)" class="space-y-3 hidden">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
              <input type="text" id="reg-name" required placeholder="Alex Harrison" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Company / Organization</label>
              <input type="text" id="reg-company" placeholder="Acme Corporation" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Work Email Address *</label>
              <input type="email" id="reg-email" required placeholder="alex@acme.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Create Password *</label>
              <input type="password" id="reg-pass" required placeholder="At least 6 characters" minlength="6" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14] focus:bg-white transition-colors">
            </div>
            <button type="submit" id="btn-reg-submit" class="btn-enterprise-primary w-full py-3 justify-center text-sm font-bold shadow-md">
              <span>Create Account &amp; Continue</span>
            </button>
            <div class="text-center pt-1 text-xs text-slate-500">
              Already have an account? <button type="button" onclick="window.switchAuthTab('login')" class="text-[#FF5E14] font-bold hover:underline">Log in here</button>
            </div>
          </form>

        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- B. SERVICE ORDER BOOKING MODAL                                       -->
      <!-- ===================================================================== -->
      <div id="order-modal" class="fixed inset-0 z-[100] hidden flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <div class="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-800">
          
          <!-- Close Button -->
          <button onclick="window.closeBookOrderModal()" class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors" title="Close">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>

          <div class="space-y-1">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-[#FF5E14]">
              <span>Official Service Order</span>
            </div>
            <h3 class="text-2xl font-extrabold text-[#0B1B3D]">Order IT Service</h3>
            <p class="text-xs text-slate-600">Select your required technical services and submit your project requirements.</p>
          </div>

          <form id="form-book-order" onsubmit="window.handleBookOrderSubmit(event)" class="space-y-4">
            <div id="order-user-badge" class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span class="text-slate-700">Verified Client: <strong id="order-client-name" class="text-slate-900"></strong> (<span id="order-client-email" class="text-[#FF5E14] font-mono"></span>)</span>
              <button type="button" onclick="window.clearCustomerSession()" class="text-[11px] text-red-600 hover:underline font-bold">Sign Out</button>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Service Area *</label>
              <select id="order-service" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14]">
                <option value="Custom Web Development">Custom Web Development</option>
                <option value="ERP & Custom Software Development">ERP &amp; Custom Software</option>
                <option value="Mobile & Application Development">Mobile App Engineering</option>
                <option value="Data Entry & Back-Office Support Services">Data Entry &amp; BPO Support</option>
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Project Scale *</label>
                <select id="order-scale" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14]">
                  <option value="Startup MVP / Fast Launch">Startup MVP / Fast Launch</option>
                  <option value="Mid-Market Growth Scale" selected>Mid-Market Growth Scale</option>
                  <option value="Enterprise Custom Infrastructure">Enterprise Scale</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Engagement Model *</label>
                <select id="order-budget" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14]">
                  <option value="Dedicated Engineering Pod">Dedicated Engineering Team</option>
                  <option value="Full-Lifecycle Turnkey Build">Fixed-Price Milestone Build</option>
                  <option value="Managed Operations & SLA Support">Managed Operations &amp; Support</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Project Requirements &amp; Scope *</label>
              <textarea id="order-requirements" required rows="4" placeholder="Describe your required system features, timeline, and goals..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-[#FF5E14]"></textarea>
            </div>

            <div class="p-3 rounded-xl bg-orange-50 border border-orange-200 text-[11px] text-slate-700 flex items-center gap-2">
              <span class="text-[#FF5E14] font-bold">100%</span>
              <span>Full source code ownership, bilateral NDA, and guaranteed project SLAs.</span>
            </div>

            <button type="submit" id="btn-submit-order" class="btn-enterprise-primary w-full py-3.5 justify-center text-sm font-bold shadow-md">
              <span>Submit &amp; Confirm Order</span>
            </button>
          </form>

          <!-- Order Confirmation Box -->
          <div id="order-success-box" class="hidden p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-bold">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h4 class="text-xl font-bold text-emerald-900">Service Order Received!</h4>
            <p id="order-success-msg" class="text-xs text-slate-600 leading-relaxed"></p>
            <div class="pt-2">
              <button onclick="window.closeBookOrderModal()" class="btn-enterprise-outline text-xs">Return to Website</button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(root);
  }

  // ---------------------------------------------------------------------------
  // 3. SMART AUTH CONTROLLER METHODS
  // ---------------------------------------------------------------------------
  let pendingAuthCallback = null;
  let checkDebounce = null;

  // Live Email Duplicate & Existence Check
  function setupLiveEmailListeners() {
    const regEmail = document.getElementById('reg-email');
    const loginEmail = document.getElementById('login-email');

    // Register email input: if email already exists, notify and switch to Log In
    if (regEmail && !regEmail._hasCheckListener) {
      regEmail._hasCheckListener = true;

      const checkRegEmail = () => {
        const email = regEmail.value.trim().toLowerCase();
        if (!email || !email.includes('@') || !email.includes('.')) return;

        fetch('/api/auth/check-email?email=' + encodeURIComponent(email))
          .then(res => res.json())
          .then(data => {
            if (data.exists) {
              window.switchToLoginWithEmail(email, 'Account already exists with this email address. Please enter your password to Log In.');
            }
          })
          .catch(() => {});
      };

      regEmail.addEventListener('input', () => {
        clearTimeout(checkDebounce);
        checkDebounce = setTimeout(checkRegEmail, 600);
      });
      regEmail.addEventListener('blur', checkRegEmail);
    }

    // Login email input: if user leaves field and email does not exist, switch to Sign Up
    if (loginEmail && !loginEmail._hasCheckListener) {
      loginEmail._hasCheckListener = true;

      const checkLoginEmail = () => {
        const email = loginEmail.value.trim().toLowerCase();
        if (!email || !email.includes('@') || !email.includes('.')) return;

        fetch('/api/auth/check-email?email=' + encodeURIComponent(email))
          .then(res => res.json())
          .then(data => {
            if (!data.exists) {
              window.switchToRegisterWithEmail(email, 'No account found with this email. Please sign up to create your new account.');
            }
          })
          .catch(() => {});
      };

      loginEmail.addEventListener('blur', checkLoginEmail);
    }
  }

  window.openAuthModal = function (callback, title, desc, preferredTab) {
    injectModals();
    setupLiveEmailListeners();
    pendingAuthCallback = callback || null;

    const titleEl = document.getElementById('auth-modal-title');
    const descEl = document.getElementById('auth-modal-desc');

    if (titleEl) {
      titleEl.textContent = title || 'Sign In Required';
    }
    if (descEl) {
      descEl.textContent = desc || 'Customer sign in is required to order services or submit your project inquiry.';
    }

    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');

    window.switchAuthTab(preferredTab || 'login');
  };

  window.closeAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
    pendingAuthCallback = null;
  };

  window.switchAuthTab = function (tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-auth-login');
    const formReg = document.getElementById('form-auth-register');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox && !alertBox.dataset.keep) {
      alertBox.classList.add('hidden');
      alertBox.innerHTML = '';
    } else if (alertBox) {
      delete alertBox.dataset.keep;
    }

    if (tab === 'login') {
      if (tabLogin) tabLogin.className = 'flex-1 py-2.5 rounded-lg bg-[#FF5E14] text-white font-bold transition-all shadow-xs';
      if (tabReg) tabReg.className = 'flex-1 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all';
      if (formLogin) formLogin.classList.remove('hidden');
      if (formReg) formReg.classList.add('hidden');
    } else {
      if (tabReg) tabReg.className = 'flex-1 py-2.5 rounded-lg bg-[#FF5E14] text-white font-bold transition-all shadow-xs';
      if (tabLogin) tabLogin.className = 'flex-1 py-2.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all';
      if (formReg) formReg.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
    }
  };

  window.switchToLoginWithEmail = function (email, customMessage) {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) alertBox.dataset.keep = 'true';

    window.switchAuthTab('login');

    const emailInput = document.getElementById('login-email');
    if (emailInput && email) {
      emailInput.value = email;
    }
    const passInput = document.getElementById('login-pass');
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }

    if (alertBox) {
      alertBox.className = 'p-3.5 rounded-2xl text-xs font-medium border bg-amber-50 border-amber-200 text-amber-900 leading-relaxed';
      alertBox.innerHTML = `<strong>Account Exists:</strong> ${escapeHtml(customMessage || `An account already exists for ${email}. Please enter your password to sign in.`)}`;
      alertBox.classList.remove('hidden');
    }
  };

  window.switchToRegisterWithEmail = function (email, customMessage) {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) alertBox.dataset.keep = 'true';

    window.switchAuthTab('register');

    const emailInput = document.getElementById('reg-email');
    if (emailInput && email) {
      emailInput.value = email;
    }
    const nameInput = document.getElementById('reg-name');
    if (nameInput) {
      nameInput.focus();
    }

    if (alertBox) {
      alertBox.className = 'p-3.5 rounded-2xl text-xs font-medium border bg-blue-50 border-blue-200 text-blue-900 leading-relaxed';
      alertBox.innerHTML = `<strong>New Account:</strong> ${escapeHtml(customMessage || `No existing account found for ${email}. Please complete registration to continue.`)}`;
      alertBox.classList.remove('hidden');
    }
  };

  window.handleAuthLogin = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();
    const alertBox = document.getElementById('auth-alert');
    const submitBtn = document.getElementById('btn-login-submit');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Signing In...</span>';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In &amp; Continue</span>';
      }

      if (data.success && data.customer) {
        setCustomer(data.customer);
        window.closeAuthModal();

        if (pendingAuthCallback) {
          const cb = pendingAuthCallback;
          pendingAuthCallback = null;
          cb(data.customer);
        } else {
          showToast(`Welcome back, ${data.customer.name}!`);
        }
      } else {
        // If login failed, check if account exists at all
        const checkRes = await fetch('/api/auth/check-email?email=' + encodeURIComponent(email));
        const checkData = await checkRes.json();

        if (!checkData.exists) {
          // Account doesn't exist -> user wants to sign in, but needs to register first!
          window.switchToRegisterWithEmail(email, 'No account found with this email. Please fill in your name and password to create your account.');
        } else {
          alertBox.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 border-rose-200 text-rose-800';
          alertBox.textContent = data.message || 'Incorrect password. Please verify and try again.';
          alertBox.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In &amp; Continue</span>';
      }
      alertBox.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 border-rose-200 text-rose-800';
      alertBox.textContent = 'Connection error. Please try again.';
      alertBox.classList.remove('hidden');
    }
  };

  window.handleAuthRegister = async function (e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const company = document.getElementById('reg-company').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value.trim();
    const alertBox = document.getElementById('auth-alert');
    const submitBtn = document.getElementById('btn-reg-submit');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Creating Account...</span>';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ name, company, email, password })
      });
      const data = await res.json();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Create Account &amp; Continue</span>';
      }

      if (data.success && data.customer) {
        setCustomer(data.customer);
        window.closeAuthModal();

        if (pendingAuthCallback) {
          const cb = pendingAuthCallback;
          pendingAuthCallback = null;
          cb(data.customer);
        } else {
          showToast(`Account created! Welcome, ${data.customer.name}.`);
        }
      } else if (res.status === 409 || data.code === 'EMAIL_ALREADY_EXISTS') {
        // Account already exists -> switch to Log In tab immediately
        window.switchToLoginWithEmail(email, 'An account is already registered with this email address. Please enter your password to Log In.');
      } else {
        alertBox.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 border-rose-200 text-rose-800';
        alertBox.textContent = data.message || 'Registration failed.';
        alertBox.classList.remove('hidden');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Create Account &amp; Continue</span>';
      }
      alertBox.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 border-rose-200 text-rose-800';
      alertBox.textContent = 'Connection error. Please try again.';
      alertBox.classList.remove('hidden');
    }
  };

  window.clearCustomerSession = function () {
    clearCustomer();
  };

  // ---------------------------------------------------------------------------
  // 4. ORDER SERVICE CONTROLLER (Customer Login Required)
  // ---------------------------------------------------------------------------
  window.openBookOrderModal = function (preselectedService) {
    injectModals();
    setupLiveEmailListeners();
    const customer = getCustomer();

    if (!customer) {
      window.openAuthModal((authedCustomer) => {
        window.openBookOrderModal(preselectedService);
      }, 'Sign In Required to Order Service', 'Please sign in or create an account to book your development order.');
      return;
    }

    // Populate customer details
    const nameEl = document.getElementById('order-client-name');
    const emailEl = document.getElementById('order-client-email');
    if (nameEl) nameEl.textContent = customer.name;
    if (emailEl) emailEl.textContent = customer.email;

    if (preselectedService) {
      const select = document.getElementById('order-service');
      if (select) {
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].value.toLowerCase().includes(preselectedService.toLowerCase())) {
            select.selectedIndex = i;
            break;
          }
        }
      }
    }

    const orderForm = document.getElementById('form-book-order');
    const successBox = document.getElementById('order-success-box');
    const modal = document.getElementById('order-modal');

    if (orderForm) orderForm.classList.remove('hidden');
    if (successBox) successBox.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeBookOrderModal = function () {
    const modal = document.getElementById('order-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleBookOrderSubmit = async function (e) {
    e.preventDefault();
    const customer = getCustomer();
    if (!customer) {
      window.closeBookOrderModal();
      window.openAuthModal();
      return;
    }

    const service_type = document.getElementById('order-service').value;
    const project_scope = document.getElementById('order-scale').value;
    const budget_tier = document.getElementById('order-budget').value;
    const requirements = document.getElementById('order-requirements').value.trim();

    const submitBtn = document.getElementById('btn-submit-order');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Booking Order...</span>';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;

      const res = await fetch('/api/orders/book', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          service_type,
          project_scope,
          budget_tier,
          requirements
        })
      });
      const data = await res.json();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit &amp; Confirm Order</span>';
      }

      if (data.success) {
        document.getElementById('form-book-order').classList.add('hidden');
        const successBox = document.getElementById('order-success-box');
        successBox.classList.remove('hidden');
        document.getElementById('order-success-msg').innerHTML = `
          ${escapeHtml(data.message)}<br><br>
          <span class="font-mono text-emerald-600 font-bold">Order Tracking ID: #ROX-${escapeHtml(data.order_id || '2026-X')}</span><br>
          A confirmation receipt has been assigned to <span class="text-slate-900 font-semibold">${escapeHtml(customer.email)}</span>.
        `;
      } else {
        alert(data.message || 'Could not process order booking.');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit &amp; Confirm Order</span>';
      }
      alert('Network error while booking order.');
    }
  };

  // ---------------------------------------------------------------------------
  // 5. INQUIRY AUTH GATE
  // ---------------------------------------------------------------------------
  window.requireInquiryAuth = function (callback) {
    const customer = getCustomer();
    if (customer) {
      if (callback) callback(customer);
    } else {
      window.openAuthModal((authedCustomer) => {
        syncCustomerForms();
        if (callback) callback(authedCustomer);
      }, 'Sign In Required for Inquiry', 'Please sign in or create an account to submit your project inquiry.');
    }
  };

  // Header Schedule Inquiry Handler
  window.handleScheduleInquiryClick = function (e) {
    const customer = getCustomer();
    if (!customer) {
      if (e) e.preventDefault();
      window.openAuthModal((authedCustomer) => {
        syncCustomerForms();
        const inquirySection = document.getElementById('inquiry-section');
        if (inquirySection) {
          inquirySection.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.location.href = 'index.html#inquiry-section';
        }
      }, 'Sign In Required for Inquiry', 'Please sign in or create an account to schedule an enterprise inquiry.');
    } else {
      const inquirySection = document.getElementById('inquiry-section');
      if (inquirySection) {
        if (e) e.preventDefault();
        inquirySection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Universal Project Inquiry Submitter (Requires Customer Sign In)
  window.handleInquirySubmit = async function (e) {
    if (e) e.preventDefault();
    const customer = getCustomer();
    if (!customer) {
      window.openAuthModal((authedCustomer) => {
        syncCustomerForms();
        window.handleInquirySubmit();
      }, 'Sign In Required for Inquiry', 'Please sign in or create an account to submit your project inquiry.');
      return;
    }

    const nameInput = document.getElementById('contact-name') || document.getElementById('c-name');
    const emailInput = document.getElementById('contact-email') || document.getElementById('c-email');
    const companyInput = document.getElementById('contact-company') || document.getElementById('c-company');
    const serviceInput = document.getElementById('contact-service') || document.getElementById('c-service');
    const messageInput = document.getElementById('contact-message') || document.getElementById('c-msg');
    const submitBtn = document.getElementById('contact-submit-btn') || document.getElementById('c-submit-btn');
    const statusEl = document.getElementById('contact-status') || document.getElementById('c-status');

    const name = (nameInput && nameInput.value.trim()) || customer.name;
    const email = (emailInput && emailInput.value.trim()) || customer.email;
    const company = (companyInput && companyInput.value.trim()) || customer.company || '';
    const service = (serviceInput && serviceInput.value) || 'Custom Web Development';
    const message = (messageInput && messageInput.value.trim()) || '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Submitting Inquiry...</span>';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const csrf = getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          customer_id: customer.id,
          name,
          email,
          company,
          service,
          message
        })
      });
      const data = await res.json();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Inquiry Submitted!</span>';
      }
      if (statusEl) {
        statusEl.className = 'mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-center font-bold';
        statusEl.textContent = 'Inquiry submitted successfully! A Principal Architect will contact you within 24 hours.';
      }
      showToast('Inquiry submitted successfully!');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit Inquiry</span>';
      }
      if (statusEl) {
        statusEl.className = 'mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center font-bold';
        statusEl.textContent = 'Connection error. Please try again.';
      }
    }
  };

  // ESC key listener to dismiss active modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeAuthModal();
      window.closeBookOrderModal();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. NAVBAR AUTH BADGE INJECTION
  // ---------------------------------------------------------------------------
  function updateNavAuth() {
    const customer = getCustomer();
    const navContainers = document.querySelectorAll('.nav-auth-slot');

    navContainers.forEach((container) => {
      if (customer) {
        container.innerHTML = `
          <div class="relative group">
            <button class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 transition-all shadow-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>${escapeHtml(customer.name.split(' ')[0])}</span>
              <span class="text-[10px] text-slate-500 font-semibold">Client</span>
            </button>
            <div class="absolute right-0 top-full mt-2 w-52 bg-white text-slate-800 border border-slate-200 rounded-lg p-2 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div class="px-3 py-2 border-b border-slate-100 text-xs">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(customer.name)}</div>
                <div class="text-[10px] text-slate-500 truncate font-mono">${escapeHtml(customer.email)}</div>
              </div>
              <button onclick="window.openBookOrderModal()" class="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#FF5E14] rounded-md transition-colors flex items-center justify-between font-medium">
                <span>Order IT Service</span>
                <span class="text-[#FF5E14]">&rarr;</span>
              </button>
              <button onclick="window.clearCustomerSession()" class="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors font-semibold">
                Sign Out
              </button>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <button onclick="window.openAuthModal(null, 'Sign In', 'Sign in to access your RoxTech customer portal.')" class="btn-enterprise-outline text-xs py-1.5 px-3">
            <span>Sign In</span>
          </button>
        `;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 7. SYNC CUSTOMER DATA INTO FORMS (Contact, Quote Estimator, Inquiry)
  // ---------------------------------------------------------------------------
  function syncCustomerForms() {
    const customer = getCustomer();

    // Contact Form on contact.html
    const contactBadge = document.getElementById('contact-auth-badge');
    const contactName = document.getElementById('contact-name') || document.getElementById('c-name');
    const contactEmail = document.getElementById('contact-email') || document.getElementById('c-email');
    const contactCompany = document.getElementById('contact-company') || document.getElementById('c-company');

    if (contactBadge) {
      if (customer) {
        contactBadge.innerHTML = `
          <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between text-slate-800">
            <div class="flex items-center gap-2">
              <span class="font-bold text-emerald-700">Verified Client:</span>
              <strong class="text-slate-900">${escapeHtml(customer.name)}</strong>
              <span class="text-slate-500 font-mono">(${escapeHtml(customer.email)})</span>
            </div>
            <button type="button" onclick="window.clearCustomerSession()" class="text-[11px] text-slate-500 hover:text-red-600 font-semibold transition-colors">Sign Out</button>
          </div>
        `;
      } else {
        contactBadge.innerHTML = `
          <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="text-slate-700">
              <span class="font-bold text-slate-900">Sign In Required:</span> Please sign in or create an account to submit your project inquiry.
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" onclick="window.openAuthModal(null, 'Sign In Required for Project Inquiry', 'Sign in to your customer account to send project inquiries.')" class="btn-enterprise-primary text-xs py-1.5 px-3">
                <span>Sign In</span>
              </button>
              <button type="button" onclick="window.openAuthModal(null, 'Create Account for Project Inquiry', 'Create an account to submit your project requirements.'); window.switchAuthTab('register');" class="btn-enterprise-outline text-xs py-1.5 px-3">
                <span>Create Account</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    if (customer) {
      if (contactName && !contactName.value) contactName.value = customer.name;
      if (contactEmail && !contactEmail.value) contactEmail.value = customer.email;
      if (contactCompany && customer.company && !contactCompany.value) contactCompany.value = customer.company;
    }

    // Estimator Form
    const quoteBadge = document.getElementById('quote-auth-badge');
    const quoteName = document.getElementById('q-name');
    const quoteEmail = document.getElementById('q-email');
    const quoteCompany = document.getElementById('q-company');

    if (quoteBadge) {
      if (customer) {
        quoteBadge.innerHTML = `
          <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between text-slate-800">
            <div class="flex items-center gap-2">
              <span class="font-bold text-emerald-700">Verified Client:</span>
              <strong class="text-slate-900">${escapeHtml(customer.name)}</strong>
              <span class="text-slate-500 font-mono">(${escapeHtml(customer.email)})</span>
            </div>
            <button type="button" onclick="window.clearCustomerSession()" class="text-[11px] text-slate-500 hover:text-red-600 font-semibold transition-colors">Sign Out</button>
          </div>
        `;
        if (quoteName) quoteName.value = customer.name;
        if (quoteEmail) quoteEmail.value = customer.email;
        if (quoteCompany && customer.company && !quoteCompany.value) quoteCompany.value = customer.company;
      } else {
        quoteBadge.innerHTML = `
          <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="text-slate-700">
              <span class="font-bold text-slate-900">Authentication Required:</span> Sign in to register your estimated scope with our Solutions Architects.
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" onclick="window.openAuthModal(null, 'Sign In Required for Architecture Quote', 'Sign in to save and submit your project budget calculation.')" class="btn-enterprise-primary text-xs py-1.5 px-3">
                <span>Sign In</span>
              </button>
              <button type="button" onclick="window.openAuthModal(null, 'Create Account for Quote', 'Create an account to submit your project estimate.'); window.switchAuthTab('register');" class="btn-enterprise-outline text-xs py-1.5 px-3">
                <span>Create Account</span>
              </button>
            </div>
          </div>
        `;
      }
    }
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl bg-[#0B1B3D] border border-[#FF5E14] text-white text-xs font-bold shadow-2xl transition-all';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  // Intercept Protected Forms (Contact Form / Inquiry Form)
  function initProtectedInterceptors() {
    const contactForms = [
      document.getElementById('contact-form'),
      document.getElementById('inquiry-form')
    ].filter(Boolean);

    contactForms.forEach(form => {
      if (form._hasAuthGuard) return;
      form._hasAuthGuard = true;

      form.addEventListener('submit', function (e) {
        const customer = getCustomer();
        if (!customer) {
          e.preventDefault();
          e.stopImmediatePropagation();
          window.openAuthModal((authedCustomer) => {
            syncCustomerForms();
            showToast('Account verified! Submitting your inquiry...');
            if (typeof window.submitContactForm === 'function') {
              window.submitContactForm();
            } else if (typeof window.handleContactSubmit === 'function') {
              window.handleContactSubmit(e);
            } else {
              form.requestSubmit ? form.requestSubmit() : form.submit();
            }
          }, 'Sign In Required for Inquiry', 'Please sign in or create an account to submit your project inquiry.');
        }
      }, true);
    });
  }

  window.requireAuthForAction = function (actionName, callback) {
    const customer = getCustomer();
    if (customer) {
      callback(customer);
    } else {
      window.openAuthModal(callback, `Sign In Required: ${actionName}`, `Please sign in or create an account to proceed with ${actionName.toLowerCase()}.`);
    }
  };

  window.getCurrentCustomer = getCustomer;
  window.syncCustomerForms = syncCustomerForms;

  function init() {
    injectModals();
    setupLiveEmailListeners();
    updateNavAuth();
    syncCustomerForms();
    initProtectedInterceptors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
