(function (root) {
  const names = ['Imam Irfaan', 'Aman', 'Bilaal', 'Nasseer', 'Imtiaz', 'Jameel', 'Ajmal', 'Ashfaaq', 'Bashir', 'Wasseem', 'Fareed'];
  const actions = ['idle', 'talk', 'wave', 'jump', 'dance', 'greet', 'nod', 'walk', 'celebrate'];
  function dimensions(width, height, detail) {
    const limit = Math.max(64, Math.min(256, Number(detail) || 128));
    const k = limit / Math.max(width, height);
    return [Math.max(8, Math.round(width * k)), Math.max(8, Math.round(height * k))];
  }
  function pose(action, t) {
    const p = { y: Math.abs(Math.sin(t * 2)) * .03, ry: 0, hz: 0, hx: 0, aA: .2, aB: -.2, ms: .25 };
    if (action === 'talk') { p.hz = Math.sin(t * 5) * .07; p.ms = .3 + Math.abs(Math.sin(t * 13)) * 1.1; }
    if (action === 'wave') p.aA = 2.4 + Math.sin(t * 10) * .5;
    if (action === 'jump') { p.y = Math.abs(Math.sin(t * 6)) * .5; p.aA = 1.2; p.aB = -1.2; }
    if (action === 'dance') { p.ry = Math.sin(t * 4) * .5; p.aA = 1 + Math.sin(t * 8) * .8; p.aB = -1 + Math.sin(t * 8) * .8; p.y = Math.abs(Math.sin(t * 8)) * .12; }
    if (action === 'greet') { p.aA = .9; p.aB = -.3; p.hx = .12 + Math.sin(t * 2) * .06; }
    if (action === 'nod') p.hx = .18 + Math.sin(t * 4) * .18;
    if (action === 'walk') { p.aA = Math.sin(t * 6) * .65; p.aB = -p.aA; p.y = Math.abs(Math.sin(t * 6)) * .06; }
    if (action === 'celebrate') { p.aA = 2.5 + Math.sin(t * 5) * .2; p.aB = -p.aA; p.y = Math.abs(Math.sin(t * 4)) * .15; }
    return p;
  }
  // Every accepted pixel cell becomes a closed front/back prism; shared walls are omitted.
  function imageMesh(data, width, height, depth) {
    const n = width * height, mask = new Uint8Array(n);
    let alpha = false;
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 250) { alpha = true; break; }
    const corners = [0, width - 1, (height - 1) * width, n - 1];
    const bg = [0, 1, 2].map(c => corners.reduce((s, i) => s + data[i * 4 + c] / 4, 0));
    for (let i = 0; i < n; i++) mask[i] = alpha ? Number(data[i * 4 + 3] > 100) : Number(Math.hypot(...bg.map((b, c) => data[i * 4 + c] - b)) > 60);
    const positions = [], colors = [], indices = [], scale = 1.9 / height, half = Math.max(.025, Math.min(.8, depth)) / 2;
    const face = (points, color) => {
      const start = positions.length / 3;
      for (const point of points) { positions.push(...point); colors.push(...color); }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const l = (x - width / 2) * scale, r = l + scale, top = (height - y) * scale, bottom = top - scale;
      const color = [0, 1, 2].map(c => Math.pow(data[i * 4 + c] / 255, 2.2));
      const a = [l, bottom, half], b = [r, bottom, half], c = [r, top, half], d = [l, top, half];
      const A = [l, bottom, -half], B = [r, bottom, -half], C = [r, top, -half], D = [l, top, -half];
      face([a, b, c, d], color); face([B, A, D, C], color);
      if (x === 0 || !mask[i - 1]) face([A, a, d, D], color);
      if (x === width - 1 || !mask[i + 1]) face([b, B, C, c], color);
      if (y === 0 || !mask[i - width]) face([d, c, C, D], color);
      if (y === height - 1 || !mask[i + width]) face([A, B, b, a], color);
    }
    return { positions, colors, indices };
  }
  root.ToonTools = { names, actions, dimensions, pose, imageMesh };
})(globalThis);