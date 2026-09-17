// Sky + fog + sun/moon day-night. Light-driven visuals (scene background, fog
// color/density, sun brightness). W1 keeps this as a closed-loop visual.

import * as THREE from '../../vendor/three.module.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 0.0; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset

    // Sun mesh
    const sunGeo = new THREE.SphereGeometry(26, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0, fog: false });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    // Moon mesh
    const moonGeo = new THREE.SphereGeometry(18, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false });
    this.moon = new THREE.Mesh(moonGeo, moonMat);

    this.cloud = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
    );
    scene.add(this.sun, this.moon, this.cloud);

    // Fog
    this.fog = new THREE.Fog(0x87ceeb, 30, 320);
    scene.fog = this.fog;

    this.update(0);
  }

  // Set absolute time t in [0,1).
  setTime(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this.update(0);
  }

  update(_dt) {
    const t = this.timeOfDay;
    // daylight brightness: 1 at noon, ~0.05 at night
    const day = Math.max(0, Math.sin(t * Math.PI * 2));
    const brightness = 0.14 + 0.86 * day;

    // sky colors
    const dayColor = new THREE.Color(0x78b9ee);
    const nightColor = new THREE.Color(0x0a0e1a);
    const horizonColor = new THREE.Color(0xcfe8ff);
    const bg = new THREE.Color().copy(nightColor).lerp(dayColor, day);
    this.scene.background = bg;

    // fog blend between night and day, denser at dawn/dusk for atmosphere
    const fogColor = new THREE.Color(0x7fb2d9).lerp(nightColor, 1 - day);
    this.fog.color.copy(fogColor);
    // slight density change toward dawn/dusk
    const edge = Math.sin(t * Math.PI * 2);
    const dens = 0.06 + 0.02 * Math.abs(Math.sin((t - 0.25) * Math.PI));
    this.fog.near = 24;
    this.fog.far = 260 + 140 * day;

    // sun / moon elevation along an arc
    const angle = t * Math.PI * 2 - Math.PI / 2; // noon at top
    const r = 240;
    const sx = Math.cos(angle) * r;
    const sy = Math.sin(angle) * r;
    const sz = -0.4 * r;

    // sun up during day (angle between -pi/2..pi/2 ~ >0 when sin>0)
    const sunUp = Math.sin(angle) > 0;
    this.sun.visible = sunUp;
    this.moon.visible = !sunUp;
    if (sunUp) {
      this.sun.position.set(sx, sy * 0.9, sz);
      this.sun.material.color.setHex(0xfff4c0);
    } else {
      this.moon.position.set(sx, sy * 0.9, -sz);
      this.moon.material.color.setHex(0xe2eaff);
    }

    // a few static clouds near horizon (decorative)
    this.cloud.position.set(60, 90, -120);
    this.cloud.scale.set(120, 8, 50);

    this.brightness = brightness;
    return brightness;
  }
}
