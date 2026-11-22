# RoxTech — Production Website (Live Cloudflare Deployment)

This repository contains the standalone, high-performance static website for **RoxTech** (`roxtech.io`), pre-configured specifically for **Cloudflare Pages** and custom domain hosting.

---

## 🚀 Cloudflare Pages Setup (Connect to GitHub)

1. Go to **[Cloudflare Dashboard](https://dash.cloudflare.com/)** -> **Workers & Pages**.
2. Click **Create application** -> **Pages** tab -> **Connect to Git**.
3. Select this repository: `roxtech-website`.
4. Build configuration:
   - **Framework preset**: `None`
   - **Build command**: *(Leave blank)*
   - **Build output directory**: `/` *(Root)*
5. Click **Save and Deploy**.
6. Under **Custom domains**, click **Set up a custom domain** and enter your live domain.

---

## ⚡ What is included:
- **HTML Pages**: All responsive pages (`index`, `about`, `services`, `industries`, `case-studies`, `careers`, `blog`, `estimator`, `contact`, `admin`, `404`)
- **`_headers`**: Cloudflare HSTS, CSP, and 1-year immutable caching for static assets.
- **`_redirects`**: Clean URL rewrites.
- **`robots.txt` & `sitemap.xml`**: Production SEO.
- **`assets/`**: High-resolution branding, CSS (`tailwind.css`, `rox.css`), and JavaScript (`hero3d.js`, `main.js`, `chatbot.js`, `auth.js`).
