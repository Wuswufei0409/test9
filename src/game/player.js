// First-person player controller: pointer-look + WASD + jump, gravity and
// AABB collision against solid blocks. Pure JS (no Three dependency).

import { Block, isSolid } from '../world/blocks.js';

export const EYE_HEIGHT = 1.62;

export class Player {
  constructor(getBlock, spawn = { x: 0.5, y: 40, z: 0.5 }) {
    this.getBlock = getBlock;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z }; // feet position
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;   // radians, 0 = -Z
    this.pitch = 0; // radians
    this.onGround = false;
    this.HALF = 0.3;
    this.HEIGHT = 1.8;
    this.EYE = EYE_HEIGHT;
  }

  // Eye position (world).
  eye() {
    return { x: this.pos.x, y: this.pos.y + this.EYE, z: this.pos.z };
  }

  addLook(dyaw, dpitch) {
    this.yaw += dyaw;
    this.pitch -= dpitch;
    // clamp pitch
    const lim = Math.PI / 2 - 0.001;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  // Horizontal forward/right vectors from yaw.
  dirs() {
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    return { forward, right };
  }

  step(dt, input) {
    // input: { fwd, strafe, jump, sneaking, sprinting, swimming }
    const { forward, right } = this.dirs();

    const sprintMult = input.sprinting && input.fwd > 0 ? 1.5 : 1;
    const sneakMult = input.sneaking ? 0.4 : 1;
    const speed = 5.2 * sprintMult * sneakMult;

    // horizontal acceleration toward input direction
    let tx = forward.x * input.fwd + right.x * input.strafe;
    let tz = forward.z * input.fwd + right.z * input.strafe;
    const len = Math.hypot(tx, tz);
    if (len > 1) {
      tx /= len;
      tz /= len;
    }
    const targetVx = tx * speed;
    const targetVz = tz * speed;
    const accel = 12;
    this.vel.x += (targetVx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVz - this.vel.z) * Math.min(1, accel * dt);

    // gravity
    this.vel.y -= 28 * dt;

    if (input.jump && this.onGround) {
      this.vel.y = 8.5;
      this.onGround = false;
    }

    // naive swim: in water reduce gravity.
    const inWater = this._blockAt(this.pos.x, this.pos.y + 0.5, this.pos.z) === Block.WATER;
    if (inWater) {
      this.vel.y = Math.max(this.vel.y, -3);
    }

    // integrate with axis-separated collision
    this._moveAxis('x', this.vel.x * dt);
    this._moveAxis('z', this.vel.z * dt);
    this._moveAxis('y', this.vel.y * dt);

    // recheck ground flag
    const belowSolid = this._solidAt(this.pos.x, this.pos.y - 0.001, this.pos.z) ||
      this._solidAt(this.pos.x - this.HALF, this.pos.y - 0.001, this.pos.z) ||
      this._solidAt(this.pos.x + this.HALF, this.pos.y - 0.001, this.pos.z) ||
      this._solidAt(this.pos.x, this.pos.y - 0.001, this.pos.z - this.HALF) ||
      this._solidAt(this.pos.x, this.pos.y - 0.001, this.pos.z + this.HALF);
    this.onGround = belowSolid;
  }

  _solidAt(x, y, z) {
    const id = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return isSolid(id);
  }

  _blockAt(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  }

  _collides(px, py, pz) {
    const x0 = Math.floor(px - this.HALF);
    const x1 = Math.floor(px + this.HALF);
    const y0 = Math.floor(py);
    const y1 = Math.floor(py + this.HEIGHT - 1e-6);
    const z0 = Math.floor(pz - this.HALF);
    const z1 = Math.floor(pz + this.HALF);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (isSolid(this.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  _moveAxis(axis, amount) {
    if (amount === 0) return;
    const p = { ...this.pos };
    p[axis] += amount;
    if (this._collides(p.x, p.y, p.z)) {
      // nudge back: try to slide along the axis in small increments fallback
      if (this._collides(this.pos.x, this.pos.y, this.pos.z)) return;
      this.vel[axis] = 0;
      if (axis === 'y') this.onGround = amount < 0;
    } else {
      this.pos[axis] = p[axis];
    }
  }
}
