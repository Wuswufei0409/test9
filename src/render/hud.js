// Bedrock-1.4.0-style HUD (DOM): centered crosshair, bottom hotbar with block
// icons (drawn from the procedural atlas), health/hunger bars, help overlay.

export function createHUD(root, assets) {
  const { TILE_BY_NAME, canvas: atlasCanvas } = assets;

  // Crosshair
  const cross = document.createElement('div');
  cross.className = 'crosshair';
  cross.textContent = '+';
  root.appendChild(cross);

  // Hotbar
  const hotbar = document.createElement('div');
  hotbar.className = 'hotbar';
  const slots = [];
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';
    const icon = document.createElement('canvas');
    icon.width = 16;
    icon.height = 16;
    icon.className = 'hotbar-icon';
    slot.appendChild(icon);
    if (i === 0) slot.classList.add('selected');
    slots.push({ el: slot, icon });
    hotbar.appendChild(slot);
  }
  root.appendChild(hotbar);

  // Top-left stats
  const stats = document.createElement('div');
  stats.className = 'stats';
  const hearts = document.createElement('div');
  hearts.className = 'hearts';
  const hunger = document.createElement('div');
  hunger.className = 'hunger';
  const oxygen = document.createElement('div');
  oxygen.className = 'oxygen';
  oxygen.style.display = 'none';
  stats.appendChild(hearts);
  stats.appendChild(hunger);
  stats.appendChild(oxygen);
  root.appendChild(stats);

  // XP bar above hotbar
  const xp = document.createElement('div');
  xp.className = 'xp';
  const xpFill = document.createElement('div');
  xpFill.className = 'xp-fill';
  xp.appendChild(xpFill);
  root.appendChild(xp);

  // Help overlay
  const help = document.createElement('div');
  help.className = 'help';
  help.innerHTML =
    '<b>Voxelcraft (Bedrock-1.4 style · W1)</b><br>' +
    'Click to lock mouse · WASD move · Space jump · Shift sneak · Ctrl sprint<br>' +
    'T day/night toggle · R reset view';
  root.appendChild(help);

  const hud = {
    slots,
    setSlot(i, texName) {
      const c = slots[i].icon;
      if (!c) return;
      const g = c.getContext('2d');
      const idx = TILE_BY_NAME[texName];
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, 16, 16);
      if (idx !== undefined) {
        g.drawImage(atlasCanvas, idx * 16, 0, 16, 16, 0, 0, 16, 16);
      } else {
        g.fillStyle = '#333';
        g.fillRect(0, 0, 16, 16);
      }
    },
    select(i) {
      slots.forEach((s, k) => s.el.classList.toggle('selected', k === i));
    },
    update({ health: hp = 10, hunger: food = 10, oxygen: ox, xp: xpVal = 0, sprinting = false } = {}) {
      hearts.textContent = '❤'.repeat(Math.max(0, Math.round(hp)));
      hunger.textContent = '🍗'.repeat(Math.max(0, Math.round(food)));
      if (ox !== undefined && ox < 10) {
        oxygen.style.display = '';
        oxygen.textContent = '🫧'.repeat(Math.max(0, Math.round(ox)));
      } else {
        oxygen.style.display = 'none';
      }
      xp.style.opacity = sprinting ? '1' : '0.35';
      xpFill.style.width = (Math.max(0, Math.min(1, xpVal)) * 100) + '%';
    },
    showHelp(show) {
      help.style.opacity = show ? '1' : '0.2';
    },
  };

  const starter = [
    'grass_top', 'dirt', 'stone', 'log_side', 'leaves', 'sand',
    'cobblestone', 'plank', 'snow',
  ];
  starter.forEach((t, i) => hud.setSlot(i, t));

  return hud;
}
