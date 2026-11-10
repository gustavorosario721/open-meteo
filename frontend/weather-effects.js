const PARTICLE_COUNTS = {
  clear: 28,
  cloudy: 20,
  drizzle: 44,
  rain: 68,
  snow: 55,
  fog: 18,
  heat: 20,
  thunderstorm: 72
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export function createWeatherEffects(canvas) {
  const context = canvas.getContext('2d');
  const particles = [];
  const interactions = [];
  let weather = 'clear-day';
  let particleCount = 0;
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let previousFrame = 0;
  let lightning = 0;
  let pointer = { x: -1000, y: -1000 };

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    seedParticles();
    drawFrame(0);
  }

  function seedParticles() {
    particles.length = 0;
    const kind = getKind(weather);
    particleCount = Math.round((PARTICLE_COUNTS[kind] || PARTICLE_COUNTS.clear) * Math.min(width * height / 850000, 1));
    particleCount = Math.max(kind === 'clear' ? 10 : 14, particleCount);

    for (let index = 0; index < particleCount; index += 1) {
      particles.push(createParticle(kind, Math.random() * width, Math.random() * height));
    }
  }

  function createParticle(kind, x = Math.random() * width, y = Math.random() * height) {
    return {
      x,
      y,
      radius: kind === 'snow' ? 1 + Math.random() * 2.8 : 1 + Math.random() * 2,
      speed: 0.3 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 0.7,
      alpha: 0.12 + Math.random() * 0.28,
      phase: Math.random() * Math.PI * 2
    };
  }

  function getKind(theme) {
    if (theme === 'rain') return 'rain';
    if (theme === 'drizzle') return 'drizzle';
    if (theme === 'snow') return 'snow';
    if (theme === 'fog' || theme === 'cloudy' || theme === 'partly-cloudy') return 'cloudy';
    if (theme === 'thunderstorm') return 'thunderstorm';
    if (theme === 'extreme-heat') return 'heat';
    return 'clear';
  }

  function setWeather(theme) {
    weather = theme;
    seedParticles();
    drawFrame(0);
    start();
  }

  function start() {
    if (document.hidden || reducedMotion.matches || animationFrame) return;
    animationFrame = window.requestAnimationFrame(animate);
  }

  function stop() {
    if (!animationFrame) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function animate(timestamp) {
    animationFrame = 0;
    if (document.hidden || reducedMotion.matches) return;

    const delta = Math.min((timestamp - (previousFrame || timestamp)) / 16.67, 2);
    previousFrame = timestamp;
    drawFrame(delta);
    animationFrame = window.requestAnimationFrame(animate);
  }

  function drawFrame(delta) {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const kind = getKind(weather);
    drawAtmosphere(kind);

    for (const particle of particles) {
      drawParticle(particle, kind);
      if (!reducedMotion.matches) moveParticle(particle, kind, delta);
    }

    drawInteractions();
    if (kind === 'thunderstorm' && lightning > 0) {
      drawLightning();
      lightning = Math.max(0, lightning - delta);
    }
  }

  function drawAtmosphere(kind) {
    if (kind === 'heat') {
      const gradient = context.createRadialGradient(width * 0.82, height * 0.12, 4, width * 0.82, height * 0.12, Math.min(width, height) * 0.43);
      gradient.addColorStop(0, 'rgba(255, 190, 75, 0.14)');
      gradient.addColorStop(1, 'rgba(255, 190, 75, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    } else if (kind === 'thunderstorm' && lightning > 0) {
      context.fillStyle = `rgba(212, 225, 255, ${Math.min(lightning * 0.035, 0.09)})`;
      context.fillRect(0, 0, width, height);
    }
  }

  function drawParticle(particle, kind) {
    context.save();
    context.globalAlpha = particle.alpha;

    if (kind === 'rain' || kind === 'drizzle' || kind === 'thunderstorm') {
      context.strokeStyle = kind === 'thunderstorm' ? '#d9e8ff' : '#5d90c7';
      context.lineWidth = kind === 'drizzle' ? 1 : 1.4;
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.lineTo(particle.x - 3, particle.y + (kind === 'drizzle' ? 7 : 12));
      context.stroke();
    } else if (kind === 'snow') {
      context.fillStyle = '#ffffff';
      context.shadowColor = '#ffffff';
      context.shadowBlur = 7;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    } else if (kind === 'heat') {
      context.strokeStyle = '#e6a14b';
      context.lineWidth = 1.3;
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.bezierCurveTo(
        particle.x - 4,
        particle.y - 7,
        particle.x + 5,
        particle.y - 13,
        particle.x + Math.sin(particle.phase) * 3,
        particle.y - 21
      );
      context.stroke();
    } else if (kind === 'cloudy') {
      context.fillStyle = '#7d95b2';
      context.beginPath();
      context.ellipse(particle.x, particle.y, particle.radius * 8, particle.radius * 2.2, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = kind === 'clear' && weather === 'clear-night' ? '#ffffff' : '#f7d58a';
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * 1.2, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  function moveParticle(particle, kind, delta) {
    const dx = particle.x - pointer.x;
    const dy = particle.y - pointer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const interaction = distance < 110 && distance > 0;
    const push = interaction && (kind === 'snow' || kind === 'clear' || kind === 'heat') ? (110 - distance) / 110 : 0;

    if (kind === 'rain' || kind === 'drizzle' || kind === 'thunderstorm') {
      particle.y += (kind === 'drizzle' ? 2 : 5) * particle.speed * delta;
      particle.x -= (kind === 'thunderstorm' ? 2 : 0.7) * delta;
    } else if (kind === 'snow') {
      particle.y += particle.speed * delta;
      particle.x += (particle.drift + Math.sin(particle.phase) * 0.4) * delta - (dx / (distance || 1)) * push * 2;
      particle.phase += 0.012 * delta;
    } else if (kind === 'heat') {
      particle.y -= particle.speed * 0.35 * delta;
      particle.x += Math.sin(particle.phase) * 0.55 * delta - (dx / (distance || 1)) * push;
      particle.phase += 0.025 * delta;
    } else {
      particle.x += (kind === 'cloudy' ? 0.35 : particle.drift * 0.3) * delta;
      particle.y += Math.sin(particle.phase) * 0.12 * delta;
      particle.phase += 0.004 * delta;
    }

    if (particle.y > height + 24) {
      particle.y = -24;
      particle.x = Math.random() * width;
    }
    if (particle.y < -28) particle.y = height + 20;
    if (particle.x > width + 40) particle.x = -40;
    if (particle.x < -40) particle.x = width + 40;
  }

  function drawInteractions() {
    const time = performance.now();
    for (let index = interactions.length - 1; index >= 0; index -= 1) {
      const interaction = interactions[index];
      const progress = (time - interaction.createdAt) / interaction.duration;
      if (progress >= 1) {
        interactions.splice(index, 1);
        continue;
      }

      const radius = 8 + progress * 55;
      context.beginPath();
      context.arc(interaction.x, interaction.y, radius, 0, Math.PI * 2);
      context.strokeStyle = interaction.color;
      context.globalAlpha = (1 - progress) * 0.48;
      context.lineWidth = 1.5;
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawLightning() {
    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.74)';
    context.shadowColor = '#ffffff';
    context.shadowBlur = 15;
    context.lineWidth = 2;
    context.beginPath();
    let x = width * (0.25 + Math.random() * 0.5);
    context.moveTo(x, 0);
    for (let y = 0; y < height * 0.42; y += 28) {
      x += (Math.random() - 0.5) * 48;
      context.lineTo(x, y + 28);
    }
    context.stroke();
    context.restore();
  }

  function onPointerMove(event) {
    pointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerLeave() {
    pointer = { x: -1000, y: -1000 };
  }

  function onPointerDown(event) {
    if (reducedMotion.matches) return;
    const colors = {
      rain: 'rgba(65, 130, 195, 0.7)',
      drizzle: 'rgba(75, 140, 205, 0.65)',
      snow: 'rgba(255, 255, 255, 0.95)',
      heat: 'rgba(236, 158, 57, 0.7)',
      thunderstorm: 'rgba(221, 235, 255, 0.9)',
      cloudy: 'rgba(132, 156, 185, 0.6)',
      clear: 'rgba(239, 190, 85, 0.7)'
    };
    const kind = getKind(weather);
    interactions.push({
      x: event.clientX,
      y: event.clientY,
      color: colors[kind] || colors.clear,
      createdAt: performance.now(),
      duration: 850
    });

    if (kind === 'thunderstorm') lightning = 3.2;
    start();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      previousFrame = 0;
      start();
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.addEventListener('change', onVisibilityChange);
  resize();
  start();

  return { setWeather };
}
