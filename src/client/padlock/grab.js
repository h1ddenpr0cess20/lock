import { DIAL_R } from './geometry.js';

const TAU = Math.PI * 2;

/** How much wider than the dial the grab is, so a fingertip catches the edge. */
const PAD = 1.3;

/** A flick is only a flick if the hand was still moving when it let go. */
const FLICK_MS = 90;

/**
 * The dial, under a finger.
 *
 * Where a pointer lands is read off the plane of the dial itself rather than
 * off the screen, so the turn survives the lock swaying, hopping and rolling
 * about underneath it. The angle is taken in the case's frame — the one the
 * dial spins inside — so it does not chase its own rotation, and it is
 * unwrapped, so a hand going round and round keeps counting up.
 *
 * Reports the turn in radians, signed the way `dial.rotation.z` is: hand it
 * straight to the dial.
 */
export function grabbableDial({ stage, THREE, dial, onGrab, onTurn, onRelease }) {
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  let held = null;
  let last = 0;
  let lastAt = 0;
  let turn = 0;
  let spin = 0;

  /** The angle a pointer is at, or null if it is not on the dial. Once it is
   *  held the radius stops mattering — a hand that slides off the edge
   *  mid-turn is still turning it. */
  const angleAt = (event, bounded = true) => {
    const camera = stage._camera;
    const rect = stage.getBoundingClientRect();
    if (!camera || !rect.width || !rect.height) return null;

    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);

    dial.updateWorldMatrix(true, false);
    normal.set(0, 0, 1).transformDirection(dial.matrixWorld).normalize();
    /** Only the face it is showing: no reaching round the back of the case. */
    if (normal.dot(raycaster.ray.direction) > -0.15) return null;

    plane.setFromNormalAndCoplanarPoint(normal, point.setFromMatrixPosition(dial.matrixWorld));
    if (!raycaster.ray.intersectPlane(plane, point)) return null;

    dial.parent.worldToLocal(point);
    const x = point.x - dial.position.x;
    const y = point.y - dial.position.y;
    if (bounded && x * x + y * y > (DIAL_R * PAD) ** 2) return null;
    return Math.atan2(y, x);
  };

  const letGo = (event) => {
    if (held === null || event.pointerId !== held) return;
    held = null;
    stage.style.cursor = '';
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {}
    /** Stopped before letting go: it stays where it was put. */
    onRelease({ turn, spin: event.timeStamp - lastAt > FLICK_MS ? 0 : spin });
  };

  stage.addEventListener('pointerdown', (event) => {
    /** A second finger while the dial is held belongs to the dial, not to the
     *  camera — swallow it rather than let it start an orbit. */
    if (held !== null) return event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const a = angleAt(event);
    if (a === null) return;

    held = event.pointerId;
    last = a;
    lastAt = event.timeStamp;
    turn = 0;
    spin = 0;
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {}
    stage.style.cursor = 'grabbing';
    /** The stage's own orbit controls sit on the canvas inside the shadow
     *  root, so stopping the event here keeps the camera still. */
    event.stopPropagation();
    event.preventDefault();
    onGrab();
  }, true);

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerId !== held) {
      if (held === null && event.pointerType === 'mouse') {
        stage.style.cursor = angleAt(event) === null ? '' : 'grab';
      }
      return;
    }

    const a = angleAt(event, false);
    if (a === null) return;

    let d = a - last;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;

    const dt = Math.max(event.timeStamp - lastAt, 1) / 1000;
    spin += (d / dt - spin) * 0.45;
    last = a;
    lastAt = event.timeStamp;
    turn += d;

    event.stopPropagation();
    onTurn(turn);
  });

  stage.addEventListener('pointerup', letGo);
  stage.addEventListener('pointercancel', letGo);
}
