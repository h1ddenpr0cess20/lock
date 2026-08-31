/**
 * A 48 mm dial padlock, built to the proportions of the real thing — 48 mm
 * body, 7 mm shackle at 21 mm inner width, a 40-number dial — and then scaled
 * up by UNIT so the stage has something around a unit tall to frame.
 */
const W = 0.048, H = 0.058, D = 0.017;
const R_TOP = 0.021, R_BOT = 0.008;
const FRONT = D / 2;

const DIAL_Y = -0.0035, DIAL_R = 0.019;
const ROD = 0.0035, SPAN = 0.028, BEND = 0.014, TOPY = 0.0085;

/** Metres to stage units. The body ends up a shade over one unit tall. */
export const UNIT = 20;

/** How far the shackle rises when it lets go, and how far it swings out. Both
 *  live inside the scaled group, so the lift stays in the model's metres. */
export const LIFT = 0.023;
export const SWING = 1.15;

/** Where the case ends up standing, once the group is scaled. */
export const BODY_HEIGHT = H * UNIT;

function dialTexture(THREE) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), C = S / 2, R = S / 2;
  /** The cap UVs of a z-facing cylinder swap and mirror the axes, so map a
   *  world-space angle (degrees CCW from +x) straight to where it lands. */
  const pt = (deg, r) => {
    const a = deg * Math.PI / 180;
    return [C - R * r * Math.sin(a), C - R * r * Math.cos(a)];
  };

  g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(C, C, R, 0, 7); g.fill();
  const sheen = g.createRadialGradient(C * 0.62, C * 0.6, R * 0.1, C, C, R);
  sheen.addColorStop(0, 'rgba(255,250,240,0.14)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = sheen; g.beginPath(); g.arc(C, C, R, 0, 7); g.fill();

  g.strokeStyle = '#efe9dd';
  for (let n = 0; n < 40; n++) {
    const a = 90 - n * 9, major = n % 5 === 0;
    const [x1, y1] = pt(a, 0.965), [x2, y2] = pt(a, major ? 0.865 : 0.915);
    g.lineWidth = major ? 9 : 4.5;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  g.fillStyle = '#f4efe4'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 104px Georgia, "Times New Roman", serif';
  for (let n = 0; n < 40; n += 5) {
    const a = 90 - n * 9, [x, y] = pt(a, 0.715);
    g.save(); g.translate(x, y); g.rotate(-a * Math.PI / 180);
    g.fillText(String(n), 0, 0); g.restore();
  }

  g.strokeStyle = 'rgba(240,234,222,0.28)'; g.lineWidth = 4;
  g.beginPath(); g.arc(C, C, R * 0.44, 0, 7); g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bodyShape(THREE, inset) {
  const s = new THREE.Shape(), w = W / 2 - inset, h = H / 2 - inset;
  const rt = R_TOP - inset, rb = R_BOT - inset;
  s.moveTo(-w + rb, -h);
  s.lineTo(w - rb, -h); s.quadraticCurveTo(w, -h, w, -h + rb);
  s.lineTo(w, h - rt); s.quadraticCurveTo(w, h, w - rt, h);
  s.lineTo(-w + rt, h); s.quadraticCurveTo(-w, h, -w, h - rt);
  s.lineTo(-w, -h + rb); s.quadraticCurveTo(-w, -h, -w + rb, -h);
  return s;
}

export function createPadlock(THREE) {
  const steelCase = new THREE.MeshStandardMaterial({ name: 'stainless_case', color: 0xb9bec0, metalness: 0.4, roughness: 0.3 });
  const steelShackle = new THREE.MeshStandardMaterial({ name: 'steel_shackle', color: 0xc8cdcf, metalness: 0.4, roughness: 0.18 });
  const brass = new THREE.MeshStandardMaterial({ name: 'brass', color: 0xc09248, metalness: 0.35, roughness: 0.34 });
  const darkSteel = new THREE.MeshStandardMaterial({ name: 'dark_steel', color: 0x35322e, metalness: 0.25, roughness: 0.6 });
  const dialEdge = new THREE.MeshStandardMaterial({ name: 'dial_knurl', color: 0x2a2724, metalness: 0.2, roughness: 0.55, flatShading: true });

  const lock = new THREE.Group();
  lock.name = 'combination_padlock';
  lock.scale.setScalar(UNIT);

  /* ── case ────────────────────────────────────────────────── */
  const cover = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape(THREE, 0), {
    depth: 0.0135, bevelEnabled: true, bevelThickness: 0.0012,
    bevelSize: 0.0012, bevelSegments: 4, curveSegments: 24,
  }), steelCase);
  cover.name = 'case_cover';
  cover.position.z = -D / 2 + 0.0035;
  lock.add(cover);

  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape(THREE, 0.0009), {
    depth: 0.0035, bevelEnabled: true, bevelThickness: 0.0008,
    bevelSize: 0.0008, bevelSegments: 3, curveSegments: 24,
  }), darkSteel);
  back.name = 'case_back';
  back.position.z = -D / 2;
  lock.add(back);

  const holeGeo = new THREE.CylinderGeometry(0.0039, 0.0039, 0.004, 24);
  [-0.014, 0.014].forEach((x, i) => {
    const m = new THREE.Mesh(holeGeo, darkSteel);
    m.name = `shackle_hole_${i + 1}`;
    m.position.set(x, H / 2 - 0.0016, 0);
    lock.add(m);
  });

  /* ── dial: a raised, knurled drum standing proud of the case ─ */
  const collarGeo = new THREE.CylinderGeometry(DIAL_R + 0.0022, DIAL_R + 0.0032, 0.0022, 64);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, steelCase);
  collar.name = 'dial_collar';
  collar.position.set(0, DIAL_Y, FRONT + 0.0008);
  lock.add(collar);

  const dial = new THREE.Group();
  dial.name = 'dial';
  dial.position.set(0, DIAL_Y, FRONT);
  lock.add(dial);

  const skirtGeo = new THREE.CylinderGeometry(DIAL_R, DIAL_R - 0.0011, 0.0052, 46);
  skirtGeo.rotateX(Math.PI / 2);
  const skirt = new THREE.Mesh(skirtGeo, dialEdge);
  skirt.name = 'dial_skirt';
  skirt.position.z = 0.0026;
  dial.add(skirt);

  const dialFaceMat = new THREE.MeshStandardMaterial({
    name: 'dial_face', map: dialTexture(THREE), color: 0xffffff, metalness: 0.15, roughness: 0.42,
  });
  const faceGeo = new THREE.CylinderGeometry(DIAL_R - 0.0003, DIAL_R - 0.0003, 0.0014, 64);
  faceGeo.rotateX(Math.PI / 2);
  const face = new THREE.Mesh(faceGeo, [dialEdge, dialFaceMat, dialEdge]);
  face.name = 'dial_face_plate';
  face.position.z = 0.0056;
  dial.add(face);

  const hubGeo = new THREE.SphereGeometry(0.0042, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  hubGeo.rotateX(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, brass);
  hub.name = 'dial_hub';
  hub.position.z = 0.0062;
  dial.add(hub);

  const index = new THREE.Mesh(new THREE.ConeGeometry(0.0028, 0.0055, 3), brass);
  index.name = 'index_mark';
  index.rotation.z = Math.PI;
  index.position.set(0, DIAL_Y + DIAL_R + 0.0055, FRONT + 0.0018);
  lock.add(index);

  /* ── shackle, pivoting on its long leg ───────────────────── */
  const shackle = new THREE.Group();
  shackle.name = 'shackle_pivot';
  shackle.position.set(0.014, H / 2, 0);
  lock.add(shackle);

  const longLeg = new THREE.Mesh(new THREE.CylinderGeometry(ROD, ROD, 0.0305, 32), steelShackle);
  longLeg.name = 'shackle_leg_long';
  longLeg.position.set(0, TOPY - 0.01525, 0);
  shackle.add(longLeg);

  const shortLeg = new THREE.Mesh(new THREE.CylinderGeometry(ROD, ROD, 0.0185, 32), steelShackle);
  shortLeg.name = 'shackle_leg_short';
  shortLeg.position.set(-SPAN, TOPY - 0.00925, 0);
  shackle.add(shortLeg);

  const bend = new THREE.Mesh(new THREE.TorusGeometry(BEND, ROD, 24, 72, Math.PI), steelShackle);
  bend.name = 'shackle_bend';
  bend.position.set(-BEND, TOPY, 0);
  shackle.add(bend);

  const notch = new THREE.Mesh(new THREE.CylinderGeometry(ROD * 0.6, ROD * 0.6, 0.0035, 24), darkSteel);
  notch.name = 'shackle_notch';
  notch.position.set(-SPAN, -0.0072, 0);
  shackle.add(notch);

  /** The case stands on the ground rather than straddling it. */
  lock.position.y = (H / 2) * UNIT;

  /** onBeforeRender only fires on something that draws, so the animation hangs
   *  off the case rather than the group around it. */
  return { lock, dial, shackle, shut: H / 2, driver: cover };
}
