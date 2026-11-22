/* RoxTech 3D Hero: Pointer parallax + Cyber 0 1 Binary Code Matrix Background Animation */
(function () {
  'use strict';

  var scene = document.getElementById('scene3d');
  if (!scene) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = scene.closest('.hero') || scene;
  var stage = scene.closest('.hero-brand-stage') || scene.parentElement;
  var raf = null, mx = 0, my = 0;

  // 1. Pointer Parallax for 3D Tower Scene
  function applyParallax() {
    raf = null;
    scene.style.setProperty('--mx', mx.toFixed(3));
    scene.style.setProperty('--my', my.toFixed(3));
  }

  if (!reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(applyParallax);
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      mx = 0; my = 0;
      if (!raf) raf = requestAnimationFrame(applyParallax);
    });
  }

  // 2. Periodic Live Bit-Flipping for 3D Binary Wall
  var bitElements = scene.querySelectorAll('.scene-binary-wall i');
  if (bitElements && bitElements.length > 0) {
    setInterval(function () {
      if (document.hidden) return;
      var count = Math.min(4, Math.floor(bitElements.length * 0.08) + 1);
      for (var k = 0; k < count; k++) {
        var idx = Math.floor(Math.random() * bitElements.length);
        var el = bitElements[idx];
        if (el) {
          el.textContent = el.textContent === '0' ? '1' : '0';
          el.style.color = '#e0f2fe';
          el.style.textShadow = '0 0 12px #38bdf8';
          setTimeout((function (target) {
            return function () {
              target.style.color = '';
              target.style.textShadow = '';
            };
          })(el), 350);
        }
      }
    }, 450);
  }

  // 3. High-Performance 0 1 Binary Code Matrix Canvas Background
  var canvas = document.getElementById('heroBinaryCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var width = 0, height = 0, dpr = 1;
  var columns = [];
  var isVisible = true;
  var animFrameId = null;

  var FONT_SIZE = 14;
  var CHAR_POOL = ['0', '1'];

  function initColumns() {
    var colCount = Math.floor(width / 22);
    columns = [];
    for (var i = 0; i < colCount; i++) {
      var len = Math.floor(Math.random() * 12) + 10;
      var chars = [];
      for (var j = 0; j < len; j++) {
        chars.push(CHAR_POOL[Math.floor(Math.random() * 2)]);
      }
      columns.push({
        x: i * 22 + 11,
        y: Math.random() * height * -1,
        speed: Math.random() * 1.6 + 1.2,
        length: len,
        chars: chars,
        lastFlip: 0,
        flipRate: Math.floor(Math.random() * 8) + 6
      });
    }
  }

  function resizeCanvas() {
    var rect = stage ? stage.getBoundingClientRect() : canvas.getBoundingClientRect();
    width = rect.width || 480;
    height = rect.height || 480;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initColumns();
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  // Animation Loop
  var frameCount = 0;
  function renderBinaryMatrix() {
    if (!isVisible) {
      animFrameId = null;
      return;
    }

    frameCount++;
    ctx.clearRect(0, 0, width, height);

    // Subtle parallax shift matching cursor movement
    ctx.save();
    var pX = mx * -12;
    var pY = my * -8;
    ctx.translate(pX, pY);

    ctx.font = '600 ' + FONT_SIZE + 'px "JetBrains Mono", Consolas, "Courier New", monospace';
    ctx.textAlign = 'center';

    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      col.y += col.speed;

      // Random bit flipping inside active column
      if (frameCount % col.flipRate === 0) {
        var flipIdx = Math.floor(Math.random() * col.chars.length);
        col.chars[flipIdx] = col.chars[flipIdx] === '0' ? '1' : '0';
      }

      for (var j = 0; j < col.chars.length; j++) {
        var charY = col.y - (col.chars.length - 1 - j) * (FONT_SIZE + 4);

        if (charY < -20 || charY > height + 20) continue;

        var progress = j / (col.chars.length - 1); // 0 (tail) -> 1 (head)

        if (j === col.chars.length - 1) {
          // Leading bit: ultra bright white-cyan glow
          ctx.fillStyle = '#f0fdfa';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
        } else if (progress > 0.65) {
          // Mid-bright cyan bits
          ctx.fillStyle = 'rgba(56, 189, 248, ' + (0.45 + progress * 0.4).toFixed(2) + ')';
          ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
          ctx.shadowBlur = 4;
        } else {
          // Tail bits: fading cyber blue
          ctx.fillStyle = 'rgba(30, 64, 175, ' + (0.12 + progress * 0.4).toFixed(2) + ')';
          ctx.shadowBlur = 0;
        }

        ctx.fillText(col.chars[j], col.x, charY);
      }

      // Reset column once entire stream travels past bottom
      if (col.y - col.chars.length * (FONT_SIZE + 4) > height) {
        col.y = Math.random() * -60 - 20;
        col.speed = Math.random() * 1.6 + 1.2;
        col.length = Math.floor(Math.random() * 12) + 10;
      }
    }

    ctx.restore();
    animFrameId = requestAnimationFrame(renderBinaryMatrix);
  }

  // Observer to pause when not in view
  if ('IntersectionObserver' in window && stage) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        isVisible = entry.isIntersecting && !document.hidden;
        if (isVisible && !animFrameId) {
          animFrameId = requestAnimationFrame(renderBinaryMatrix);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(stage);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      isVisible = false;
    } else {
      isVisible = true;
      if (!animFrameId) animFrameId = requestAnimationFrame(renderBinaryMatrix);
    }
  });

  animFrameId = requestAnimationFrame(renderBinaryMatrix);
})();
