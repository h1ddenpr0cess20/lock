/**
 * What each state does to the lock.
 *
 *  jitter  — tremor, in stage units
 *  lean    — forward tilt on x, positive leans away
 *  sway    — how far it rocks on its base, and how fast
 *  shuffle — how much it hops around: 0 stands still, 1 paces
 *  spin    — how hard the dial is being worked
 */
export const MOODS = {
  idle: { jitter: 0.10, lean: 0.0, sway: 0.05, swaySpeed: 1.0, shuffle: 0, spin: 0.05 },
  listening: { jitter: 0.04, lean: -0.13, sway: 0.10, swaySpeed: 1.5, shuffle: 0, spin: 0.12 },
  thinking: { jitter: 0.12, lean: 0.08, sway: 0.03, swaySpeed: 1.0, shuffle: 0.45, spin: 1 },
  speaking: { jitter: 0.18, lean: 0.05, sway: 0.05, swaySpeed: 1.5, shuffle: 0.6, spin: 0.2 },
  angry: { jitter: 1.00, lean: 0.18, sway: 0.05, swaySpeed: 2.6, shuffle: 0, spin: 0 },
};

export const ENERGY_GAIN = { jitter: 0.5, sway: 0.045, swaySpeed: 0.9 };
