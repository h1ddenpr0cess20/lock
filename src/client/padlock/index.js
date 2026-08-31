import { buildEnvironment } from './environment.js';
import { createPadlock, LIFT, SWING } from './geometry.js';
import { ENERGY_GAIN, MOODS } from './moods.js';

function spring(s, k, c, dt, to = 0) {
  s.v += (to - s.p) * k * dt - s.v * c * dt;
  s.p += s.v * dt;
}

const TAU = Math.PI * 2;
/** Forty numbers on the dial, so one click is a fortieth of a turn. */
const DETENT = TAU / 40;

/** How far it can get from the middle of the stage, at the narrowest and
 *  widest. A phone held upright is nearly all height, and reserving a boulder's
 *  worth of room to pace in there only pushes the camera back — so on a narrow
 *  screen it stays put and gets bigger instead. */
const TRAVEL_MIN = 0.36;
const TRAVEL_MAX = 1.35;

/** Half-extents to keep in frame: the case is a shade under a unit wide, and
 *  the shackle standing open is most of a unit above the bounding centre. */
const HALF_W = 0.55;
const HALF_H = 1.3;

/** Three legs of a combination, and how often the third one actually lands. At
 *  roughly six seconds a run, that is an unlock every quarter minute or so of
 *  solid thinking — often enough to catch, rare enough to still be a moment. */
const LEGS = 3;
const CRACK_CHANCE = 0.6;

/** How long it stays open before the shackle drops back in. */
const OPEN_MIN = 2.6;
const OPEN_VAR = 3.4;

export function createLock({ stage, THREE }) {
  buildEnvironment({ stage, THREE });

  const character = new THREE.Group();
  character.name = 'lock_character';

  const body = new THREE.Group();
  body.name = 'body';
  character.add(body);

  const { lock, dial, shackle, shut, driver } = createPadlock(THREE);
  body.add(lock);

  let state = 'idle';
  const target = { ...MOODS.idle };
  const m = { ...MOODS.idle };

  let sustain = 0;
  let impulse = 0;
  let energy = 0;
  let lastEnergy = 0;
  let rage = 0;

  const clock = new THREE.Clock();
  let t = 0;

  /** Squash, and the three axes it rocks on. */
  const sq = { p: 0, v: 0 };
  const tz = { p: 0, v: 0 };
  const tx = { p: 0, v: 0 };
  const ty = { p: 0, v: 0 };

  let y = 0, yV = 0, airborne = false;
  let x = 0, dir = 1, hopT = -1, xFrom = 0, hopReach = 0, hopDur = 0.34, hopLift = 0.2;
  let hops = 0, run = 2, rest = 0.6;
  let evtT = 2.2, stompT = 0.2;
  let travel = TRAVEL_MAX;

  /** The dial: where it is going, which way round, and how far through a run. */
  let dialTo = 0;
  let dialDir = 1;
  let leg = 0;
  let dwell = 0;
  let clicked = 0;
  let landed = true;

  /** The shackle: open now, open wanted, and how long until it drops shut. */
  let openT = 0, openTo = 0, openFor = 0;
  let fidget = 1.8;
  /** How long until it is allowed to pop open on a word it likes the sound of. */
  let flourish = 20 + Math.random() * 30;

  const land = (force) => {
    sq.v += force;
    tz.v += (Math.random() - 0.5) * force * 0.5;
    tx.v += (Math.random() - 0.5) * force * 0.3;
  };

  /** Snap the dial's destination onto a number, so it always lands on one. */
  const toDetent = (a) => Math.round(a / DETENT) * DETENT;

  const spinTo = (turns) => {
    dialDir = -dialDir;
    dialTo = toDetent(dialTo + dialDir * TAU * turns);
  };

  /** One more leg of the combination. Three of them and it has a go at opening. */
  const nextLeg = () => {
    if (leg >= LEGS) {
      leg = 0;
      if (Math.random() < CRACK_CHANCE) {
        dwell = 0.6 + Math.random() * 0.5;
        return open();
      }
      /** Missed it. The wheels drop and it spins off to start the run again. */
      sq.v += 2.2;
      tz.v += (Math.random() - 0.5) * 2.4;
      spinTo(0.85 + Math.random() * 0.7);
      dwell = 0.3 + Math.random() * 0.3;
      return;
    }
    leg++;
    spinTo(leg === 1 ? 1.4 + Math.random() * 1.1 : 0.5 + Math.random() * 0.85);
    dwell = 0.14 + Math.random() * 0.22;
  };

  function open() {
    if (openTo === 1) return;
    openTo = 1;
    openFor = OPEN_MIN + Math.random() * OPEN_VAR;
    /** The pop: it stretches as the shackle lets go. */
    sq.v -= 2.6;
    ty.v += (Math.random() - 0.5) * 1.6;
  }

  function shutIt(force) {
    if (openTo === 0) return;
    openTo = 0;
    openFor = 0;
    land(force);
  }

  driver.onBeforeRender = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    impulse = Math.max(0, impulse - impulse * Math.min(1, dt * 3.4) - dt * 0.05);
    lastEnergy = energy;
    energy += (Math.min(1, sustain + impulse) - energy) * Math.min(1, dt * 6);
    rage = Math.max(0, rage - dt * 0.55);

    const mood = MOODS[state] ?? MOODS.idle;
    for (const k in target) {
      const to = mood[k] + (MOODS.angry[k] - mood[k]) * rage;
      target[k] = to;
      m[k] += (to - m[k]) * Math.min(1, dt * 3.4);
    }

    const loud = ENERGY_GAIN;
    const jitter = m.jitter + energy * loud.jitter;
    const swayAmt = Math.sin(t * (m.swaySpeed + energy * loud.swaySpeed) * 2.0)
      * (m.sway + energy * loud.sway);
    const shuffling = m.shuffle > 0.08;
    const raging = rage > 0.35;

    /* ── the dial ─────────────────────────────────────────────
       A working run while it is thinking; the odd single click the rest of
       the time, so it is never quite still. Nothing to crack while it is
       already open, so it leaves the dial alone until the shackle drops. */
    if (dwell > 0) dwell -= dt;
    const working = target.spin > 0.6 && !raging && openTo === 0;
    const arrived = Math.abs(dialTo - dial.rotation.z) < DETENT * 0.05;
    if (arrived && !landed) {
      /** It has just come to rest on a number: hold it there for a beat. */
      landed = true;
      dwell = working ? 0.16 + Math.random() * 0.26 : 0.3;
    } else if (arrived && dwell <= 0) {
      /** Where a run gets to is kept, so a short think picks up where the last
       *  one left off rather than starting the combination over every time. */
      if (working) { nextLeg(); landed = false; }
      else if (target.spin > 0.02) {
        fidget -= dt * target.spin * 4;
        if (fidget <= 0) {
          fidget = 1.4 + Math.random() * 3.2;
          dialTo = toDetent(dial.rotation.z + (Math.random() < 0.5 ? -1 : 1) * DETENT
            * (1 + Math.floor(Math.random() * 3)));
          landed = false;
        }
      }
    }
    const was = dial.rotation.z;
    dial.rotation.z += (dialTo - dial.rotation.z) * Math.min(1, dt * 6);
    const speed = Math.abs(dial.rotation.z - was) / Math.max(dt, 1e-4);

    /** The clicks you can feel — only once it is slow enough to feel them. */
    const at = Math.round(dial.rotation.z / DETENT);
    if (at !== clicked) {
      clicked = at;
      if (speed < DETENT * 9) {
        tz.v += (Math.random() - 0.5) * 0.5;
        sq.v += 0.16;
      }
    }

    /* ── the shackle ─────────────────────────────────────────── */
    if (openTo === 1) {
      openFor -= dt;
      if (openFor <= 0) shutIt(5.4);
    }
    if (Math.abs(openTo - openT) > 1e-4) {
      /** Slower out than in: it lets go, then it drops. */
      openT += (openTo - openT) * Math.min(1, dt * (openTo > openT ? 9.6 : 20));
    }
    const e = openT * openT * (3 - 2 * openT);
    shackle.position.y = shut + e * LIFT;
    shackle.rotation.y = -e * (SWING + Math.sin(t * 2.4) * 0.11 * e);

    /* ── getting about ───────────────────────────────────────
       A lock cannot roll, so it hops: a crouch, an arc, and a landing that
       goes through the whole body. */
    let lift = 0;
    if (shuffling) {
      if (hopT < 0) {
        rest -= dt * (0.6 + m.shuffle);
        if (rest <= 0) {
          const reach = 0.34 * (0.55 + Math.random() * 0.75);
          /** Turn round rather than hop off the edge of the stage. */
          let room = travel - dir * x;
          if (reach > room) { dir = -dir; room = travel - dir * x; }
          hopReach = Math.max(0.05, Math.min(reach, room));
          hopDur = 0.26 + Math.random() * 0.12;
          hopLift = 0.11 + hopReach * 0.34;
          xFrom = x; hopT = 0;
          sq.v -= 1.9;
        }
      } else {
        hopT += dt;
        const u = Math.min(1, hopT / hopDur);
        x = xFrom + dir * hopReach * u;
        lift = Math.sin(Math.PI * u) * hopLift;
        if (u >= 1) {
          hopT = -1;
          land(4.2 + hopReach * 3);
          ty.v += dir * 1.1;
          if (++hops >= run) {
            hops = 0;
            run = 1 + Math.floor(Math.random() * 3);
            rest = 0.5 + Math.random() * 1.5;
            if (Math.random() < 0.66) dir *= -1;
          } else {
            rest = 0.05 + Math.random() * 0.12;
          }
        }
      }
    } else {
      x += (0 - x) * Math.min(1, dt * 1.4);
      hopT = -1; hops = 0; rest = 0.5;
    }

    /* ── temper ───────────────────────────────────────────────
       Cut off mid-sentence, it slams the shackle down and stamps. */
    if (raging) {
      stompT -= dt;
      if (stompT <= 0 && !airborne) {
        yV = 1.9 + Math.random() * 0.6;
        airborne = true;
        sq.v -= 2.6;
        stompT = 0.5 + Math.random() * 0.25;
      }
    }
    if (airborne) {
      yV -= 13 * dt;
      y += yV * dt;
      if (y <= 0) {
        y = 0;
        airborne = false;
        land(6.5 + Math.abs(yV));
        ty.v += (Math.random() - 0.5) * 4;
      }
    } else {
      y += (0 - y) * Math.min(1, dt * 8);
    }

    /* ── standing there ─────────────────────────────────────── */
    if (!shuffling && !raging) {
      evtT -= dt;
      if (evtT <= 0) {
        const r = Math.random();
        if (r < 0.36) sq.v += 1.9;
        else if (r < 0.68) ty.v += (Math.random() < 0.5 ? -1 : 1) * 2.2;
        else { tz.v += (Math.random() - 0.5) * 3.6; tx.v += 1.2; }
        evtT = 2.4 + Math.random() * 4;
      }
    }

    if (state === 'speaking') {
      flourish -= dt;
      const onset = Math.max(0, energy - lastEnergy);
      if (onset > 0.008) {
        sq.v += onset * 20;
        tz.v += (Math.random() - 0.5) * onset * 16;
        /** A word it means lands as a nudge on the dial. */
        if (onset > 0.05 && dwell <= 0) dialTo = toDetent(dialTo + (Math.random() < 0.5 ? -1 : 1) * DETENT);
        /** And once in a while it makes a point hard enough to open itself. */
        if (onset > 0.09 && flourish <= 0) {
          flourish = 35 + Math.random() * 45;
          open();
        }
      }
    }

    spring(sq, 190, 11, dt);
    spring(tz, 74, 6.8, dt, hopT >= 0 ? -dir * 0.24 : swayAmt);
    spring(tx, 74, 6.8, dt, m.lean * 0.2);
    spring(ty, 40, 5, dt, 0);

    const tremor = jitter * 0.014;
    const breathe = Math.sin(t * 1.25) * 0.006;

    character.position.set(
      x + (Math.random() - 0.5) * tremor,
      y + lift + breathe * 0.5,
      (Math.random() - 0.5) * tremor,
    );
    character.rotation.set(
      tx.p + (Math.random() - 0.5) * tremor,
      ty.p * 0.6,
      tz.p + (Math.random() - 0.5) * tremor * 1.4,
    );

    /** Steel does not squash much. Enough to read, not enough to look soft. */
    const s = sq.p * 0.06 + breathe;
    body.scale.set(1 + s * 0.45, 1 - s, 1 + s * 0.45);
  };

  stage.setObject(character);

  /** Three-quarters on: far enough round that the shackle swinging open reads
   *  as a swing and not just a lift, near enough to front that the dial is
   *  still a face. */
  const dir3 = new THREE.Vector3(0.52, 0.3, 1).normalize();
  stage._camera.position.copy(stage._controls.target).addScaledVector(dir3, 4);

  const frame = () => {
    const camera = stage._camera;
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    const aspect = w / h;

    travel = Math.min(TRAVEL_MAX, Math.max(TRAVEL_MIN, TRAVEL_MIN + (aspect - 0.5) * 0.9));

    const halfW = HALF_W + travel + 0.1;
    const halfH = HALF_H;
    const dist = Math.max(halfH, halfW / aspect) / Math.tan((camera.fov * Math.PI) / 360);

    const focus = stage._controls.target;
    const away = camera.position.clone().sub(focus);
    if (away.lengthSq() === 0) away.copy(dir3);
    camera.position.copy(focus).addScaledVector(away.normalize(), dist);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = dist * 100;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    stage._controls.update();
  };

  frame();
  new ResizeObserver(frame).observe(stage);

  stage._ground.visible = false;
  stage._key.castShadow = false;
  character.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = false;
  });

  return {
    get state() {
      return state;
    },

    get open() {
      return openTo === 1;
    },

    setState(next) {
      if (!Object.hasOwn(MOODS, next) || next === state) return;
      state = next;
      if (next === 'idle' || next === 'thinking') sustain = 0;
      /** Back to itself with nobody talking: tidy up and shut. */
      if (next === 'idle') shutIt(3.4);
    },

    setLevel(level) {
      sustain = Math.min(1, Math.max(0, level));
    },

    pulse(weight = 0.3) {
      impulse = Math.min(1, impulse + Math.min(1, Math.max(0, weight)));
    },

    /** It got there on its own, or something it reached for got it there. */
    unlock() {
      open();
    },

    anger(weight = 1) {
      rage = Math.min(1, rage + weight);
      sq.v += 3.0;
      /** Cut off, it shuts itself with a bang and goes back to the start. */
      shutIt(7.5);
      leg = 0;
      dwell = 0.3;
      dialTo = toDetent(dial.rotation.z - TAU * 0.6);
    },
  };
}
