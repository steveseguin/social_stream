(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(hex) {
    var value = String(hex || "").replace("#", "");
    if (value.length === 3) {
      value = value.charAt(0) + value.charAt(0) +
        value.charAt(1) + value.charAt(1) +
        value.charAt(2) + value.charAt(2);
    }
    return {
      r: parseInt(value.substring(0, 2), 16) || 0,
      g: parseInt(value.substring(2, 4), 16) || 0,
      b: parseInt(value.substring(4, 6), 16) || 0
    };
  }

  function createParticle(width, height, palette) {
    var color = palette[Math.floor(Math.random() * palette.length)];
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      radius: 50 + Math.random() * 140,
      alpha: 0.05 + Math.random() * 0.12,
      color: color
    };
  }

  function createSSNBokehBackground(canvas, options) {
    if (!canvas || !canvas.getContext) return null;

    var settings = options || {};
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var palette = (settings.colors || ["#6c89fd", "#fa6d47", "#363753"]).map(hexToRgb);
    var particles = [];
    var particleCount = settings.count || 18;
    var animationFrame = 0;
    var disposed = false;
    var width = 0;
    var height = 0;
    var dpr = 1;

    function resize() {
      if (disposed) return;
      width = canvas.clientWidth || window.innerWidth || 1920;
      height = canvas.clientHeight || window.innerHeight || 1080;
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);

      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!particles.length) {
        var i;
        for (i = 0; i < particleCount; i++) {
          particles.push(createParticle(width, height, palette));
        }
      }
    }

    function drawParticle(particle) {
      var gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.radius
      );

      gradient.addColorStop(
        0,
        "rgba(" + particle.color.r + ", " + particle.color.g + ", " + particle.color.b + ", " + particle.alpha + ")"
      );
      gradient.addColorStop(
        0.45,
        "rgba(" + particle.color.r + ", " + particle.color.g + ", " + particle.color.b + ", " + (particle.alpha * 0.45) + ")"
      );
      gradient.addColorStop(
        1,
        "rgba(" + particle.color.r + ", " + particle.color.g + ", " + particle.color.b + ", 0)"
      );

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick() {
      if (disposed) return;

      ctx.clearRect(0, 0, width, height);

      var i;
      for (i = 0; i < particles.length; i++) {
        var particle = particles[i];

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -particle.radius) particle.x = width + particle.radius;
        if (particle.x > width + particle.radius) particle.x = -particle.radius;
        if (particle.y < -particle.radius) particle.y = height + particle.radius;
        if (particle.y > height + particle.radius) particle.y = -particle.radius;

        drawParticle(particle);
      }

      animationFrame = window.requestAnimationFrame(tick);
    }

    function destroy() {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width, height);
    }

    resize();
    window.addEventListener("resize", resize);
    tick();

    return {
      destroy: destroy
    };
  }

  window.createSSNBokehBackground = createSSNBokehBackground;
})();
