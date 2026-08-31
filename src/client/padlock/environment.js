/**
 * A tiny equirectangular studio, prefiltered into the scene environment. It is
 * what the case and the shackle are reflecting: a cool softbox overhead, a
 * warm bounce off to one side, and a dark floor so the metal has a horizon to
 * catch. Two brushed-steel greys with nothing to look at read as plastic.
 */
export function buildEnvironment({ stage, THREE }) {
  try {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const ctx = c.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#e6ecf4');
    g.addColorStop(0.42, '#8d97a6');
    g.addColorStop(0.52, '#2a2e35');
    g.addColorStop(1, '#0a0c0f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 32);

    /** The softbox, and a warm fill on the other side of the room. */
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.beginPath(); ctx.ellipse(20, 6, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,160,0.55)';
    ctx.beginPath(); ctx.ellipse(50, 12, 8, 4, 0, 0, Math.PI * 2); ctx.fill();

    const tex = new THREE.Texture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(stage._renderer);
    stage._scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
  } catch {
  }
}
