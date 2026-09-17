export const meta = {
  title: "eldritch_street",
  size: [256, 160],
  palette: "mulfok32",
}

export const frames = [
  { name: "idle0", pose: { t: 0 } },
  { name: "idle1", pose: { t: 1 } },
  { name: "idle2", pose: { t: 2 } },
  { name: "idle3", pose: { t: 3 } },
]

export function paint(C, pal, pose) {
  const t = pose?.t ?? 0

  // 32-color palette mappings from mulfok32
  const c = {
    black: pal.near('#1f102a'),        // Deepest black-purple void #1f102a
    voidDark: pal.near('#390947'),     // Abyssal purple shadow #390947
    deepNight: pal.near('#4e187c'),    // Night sky purple #4e187c
    deepMagenta: pal.near('#611851'),  // Dark magenta #611851
    wineDark: pal.near('#751756'),     // Clotted blood wine #751756
    crimsonDeep: pal.near('#a32858'),  // Deep crimson #a32858
    bloodRed: pal.near('#cc425e'),     // Vivid blood red #cc425e
    coralFlesh: pal.near('#ea6262'),   // Coral flesh red #ea6262
    rustRose: pal.near('#873555'),     // Muddy brick / dried rust #873555
    fleshRot: pal.near('#a6555f'),     // Rotting flesh brown-pink #a6555f
    fleshMid: pal.near('#c97373'),     // Fleshy salmon #c97373
    fleshPale: pal.near('#f2ae99'),    // Pale alien skin / sclera #f2ae99
    fleshLilac: pal.near('#ffc3f2'),   // Pale mucous lilac #ffc3f2
    tentacleDark: pal.near('#7d2da0'), // Deep tentacle shade #7d2da0
    tentacleMid: pal.near('#834dc4'),  // Vibrant cosmic tentacle #834dc4
    tentacleLight: pal.near('#8465ec'),// Mystic violet #8465ec
    corruptMagenta: pal.near('#d46eb3'), // Corrupted magenta #d46eb3
    corruptPink: pal.near('#ee8fcb'),  // Pink orchid #ee8fcb
    fleshPurple: pal.near('#873e84'),  // Bruised flesh purple #873e84
    slateDark: pal.near('#4a3052'),    // Dark asphalt / concrete shadow #4a3052
    slateMid: pal.near('#7b5480'),     // Weathered pavement slate #7b5480
    slateLight: pal.near('#a6859f'),   // Concrete curb / dusty stone #a6859f
    stonePale: pal.near('#d9bdc8'),    // Pale highlight stone / chalk #d9bdc8
    white: pal.near('#ffffff'),        // Stark white glint #ffffff
    slimeDark: pal.near('#5ba675'),    // Toxic moss / dark bile #5ba675
    slimeBright: pal.near('#6bc96c'),  // Radioactive glowing slime #6bc96c
    acidLime: pal.near('#abdd64'),     // Acid lime green #abdd64
    acidYellow: pal.near('#fcef8d'),   // Acidic yellow / pupil iris #fcef8d
    amberWarm: pal.near('#ffb879'),    // Amber filament / warning light #ffb879
    glowCyanPale: pal.near('#aee2ff'), // Ice cyan ocular glow / core #aee2ff
    glowBlueCold: pal.near('#8db7ff'), // Cold blue beam / scanner #8db7ff
    arcBlue: pal.near('#6d80fa'),      // Electric blue arc #6d80fa
  }

  // ============================================================
  // 1. BACKGROUND SKY & VOID ECLIPSE (y: 0 to 52)
  // ============================================================
  // Deep gradient twilight sky
  C.rect(0, 0, 256, 14, c.black)
  C.rect(0, 14, 256, 12, c.voidDark)
  for (let x = 0; x < 256; x += 2) {
    C.pset(x, 13, c.voidDark)
    C.pset(x + 1, 14, c.black)
  }
  C.rect(0, 26, 256, 12, c.deepNight)
  for (let x = 0; x < 256; x += 2) {
    C.pset(x, 25, c.deepNight)
    C.pset(x + 1, 26, c.voidDark)
  }
  C.rect(0, 38, 256, 12, c.slateDark)
  for (let x = 0; x < 256; x += 2) {
    C.pset(x, 37, c.slateDark)
    C.pset(x + 1, 38, c.deepNight)
  }

  // Cosmic Void Eclipse (Top Right Sky: x: 198, y: 16)
  const ex = 198, ey = 16
  C.disc(ex, ey, 16, c.voidDark)
  C.disc(ex, ey, 14, c.deepMagenta)
  C.disc(ex, ey, 12, c.wineDark)
  C.disc(ex, ey, 10, c.black)
  // Coronal solar flare / blood haze
  C.arc(ex, ey, 11, -Math.PI * 0.85, Math.PI * 0.25, c.bloodRed)
  C.arc(ex, ey, 13, -Math.PI * 0.6, 0, c.coralFlesh)
  // Cosmic Slit Pupil peering from the void
  const pupilW = (t === 1 || t === 2) ? 2 : 1
  C.ell(ex, ey, pupilW, 7, c.crimsonDeep)
  C.line(ex, ey - 6, ex, ey + 6, c.coralFlesh)
  C.pset(ex, ey, c.fleshLilac)

  // Sinister crimson cloud tendrils drifting through stratosphere
  C.line(148, 22, 186, 20, c.deepMagenta)
  C.line(208, 24, 246, 28, c.wineDark)
  C.line(166, 14, 218, 11, c.voidDark)

  // ============================================================
  // 2. DISTANT RUINED MONOLITHS & SKYLINE (y: 16 to 55)
  // ============================================================
  // Tower 1 (Far Left)
  C.rect(8, 24, 22, 28, c.voidDark)
  C.rect(12, 18, 14, 6, c.voidDark)
  C.line(19, 12, 19, 18, c.slateDark)
  for (let wy = 26; wy < 48; wy += 5) {
    C.rect(12, wy, 3, 2, c.black)
    C.rect(18, wy, 3, 2, (wy === 36 && t % 2 === 0) ? c.amberWarm : c.black)
    C.rect(24, wy, 3, 2, c.black)
  }

  // Jagged Spire 2
  C.poly([[38, 52], [48, 14], [54, 16], [62, 52]], c.voidDark)
  C.line(50, 6, 50, 14, c.slateDark)
  C.pset(50, 6, (t % 2 === 0) ? c.bloodRed : c.voidDark)

  // Brutalist Block 3 (Center-Left)
  C.rect(74, 22, 28, 30, c.deepNight)
  C.rect(78, 18, 20, 4, c.deepNight)
  for (let wy = 26; wy < 50; wy += 6) {
    C.rect(78, wy, 4, 3, c.voidDark)
    C.rect(88, wy, 4, 3, (wy === 32 && t % 2 === 1) ? c.glowCyanPale : c.black)
  }

  // Radio Spire (Center)
  C.line(106, 10, 106, 52, c.slateDark)
  C.line(102, 22, 110, 22, c.slateDark)
  C.line(100, 34, 112, 34, c.slateDark)
  C.pset(106, 9, (t === 0 || t === 2) ? c.amberWarm : c.black)

  // Twisted Megastructure 4 (Mid-Right)
  C.poly([[138, 52], [144, 20], [168, 18], [172, 52]], c.voidDark)
  C.rect(152, 24, 6, 26, c.black)
  C.line(148, 36, 164, 36, c.slateDark)

  // Titanic Eldritch Tendril silhouetted in deep fog
  C.poly([[228, 52], [236, 30], [244, 18], [250, 14], [254, 20], [248, 34], [242, 52]], c.voidDark)
  C.line(244, 18, 250, 14, c.wineDark)

  // Drooping high-voltage power cables
  function drawSagWire(x1, y1, x2, y2, sag, col) {
    const steps = 24
    for (let i = 0; i < steps; i++) {
      const u1 = i / steps, u2 = (i + 1) / steps
      const px1 = x1 + (x2 - x1) * u1
      const py1 = y1 + (y2 - y1) * u1 + sag * 4 * u1 * (1 - u1)
      const px2 = x1 + (x2 - x1) * u2
      const py2 = y1 + (y2 - y1) * u2 + sag * 4 * u2 * (1 - u2)
      C.line(px1, py1, px2, py2, col)
    }
  }
  drawSagWire(19, 18, 106, 22, 8, c.black)
  drawSagWire(106, 22, 170, 24, 10, c.black)
  drawSagWire(170, 24, 244, 32, 12, c.black)

  // ============================================================
  // 3. MIDGROUND ARCHITECTURE & FACADES (y: 42 to 84)
  // ============================================================
  // BUILDING 1 (Left Block: x: 0 to 66, y: 44 to 80)
  // Roof top rim
  C.rect(0, 44, 66, 3, c.slateDark)
  C.line(0, 44, 66, 44, c.slateLight)
  C.line(0, 46, 66, 46, c.black)
  // Facade Wall
  C.rect(0, 47, 66, 32, c.slateDark)
  // Weathered brickwork
  for (let by = 50; by < 78; by += 4) {
    const shift = (by % 8 === 0) ? 0 : 5
    for (let bx = shift; bx < 66; bx += 10) {
      C.pset(bx, by, c.slateMid)
      C.pset(bx + 1, by, c.black)
    }
  }

  // Windows in Left Building
  function drawArchWindow(wx, wy, w, h, mode) {
    C.rect(wx - 1, wy - 1, w + 2, h + 2, c.black)
    C.rect(wx, wy, w, h, c.black)
    C.line(wx, wy - 1, wx + w - 1, wy - 1, c.slateLight)
    C.line(wx, wy + h, wx + w - 1, wy + h, c.slateMid)
    if (mode === 'cyan') {
      C.rect(wx + 1, wy + 2, w - 2, h - 3, c.glowBlueCold)
      C.rect(wx + 2, wy + 4, w - 4, h - 6, c.glowCyanPale)
      if (t % 2 === 0) C.pset(wx + 3, wy + 5, c.white)
    } else if (mode === 'eyes') {
      const eyeCol = (t === 0 || t === 2) ? c.acidYellow : c.coralFlesh
      C.pset(wx + 2, wy + 4, eyeCol)
      C.pset(wx + 5, wy + 4, eyeCol)
    } else {
      C.line(wx + Math.floor(w / 2), wy, wx + Math.floor(w / 2), wy + h - 1, c.slateDark)
      C.line(wx, wy + Math.floor(h / 2), wx + w - 1, wy + Math.floor(h / 2), c.slateDark)
    }
  }
  drawArchWindow(8, 52, 7, 12, 'dark')
  drawArchWindow(24, 51, 8, 13, 'cyan')  // Cold lab flicker
  drawArchWindow(42, 52, 7, 12, 'eyes')  // Unblinking watching eyes

  // Creeping biological tumor crawling down the left brick wall
  C.poly([[0, 44], [14, 44], [16, 56], [10, 68], [14, 80], [0, 80]], c.wineDark)
  C.poly([[0, 48], [10, 48], [12, 58], [7, 70], [10, 80], [0, 80]], c.crimsonDeep)
  C.poly([[0, 52], [6, 52], [8, 62], [4, 72], [6, 80], [0, 80]], c.coralFlesh)
  // Embedded fleshy eyeball in the building masonry at (7, 62)
  C.disc(7, 62, 4, c.coralFlesh)
  C.disc(7, 62, 3, c.fleshPale)
  C.disc(7, 62, 1, c.acidYellow)
  C.pset(7, 62, c.black)
  C.pset(6, 61, c.white)
  // Tendrils dripping toward sidewalk
  C.line(10, 70, 12, 80, c.wineDark)
  C.line(12, 75, 15, 82, c.crimsonDeep)

  // ALLEY 1 (Center-Left: x: 66 to 108) - Deep urban chasm
  C.rect(66, 42, 42, 38, c.black)
  // Fire escape ladder & platforms
  for (let fy = 48; fy < 76; fy += 7) {
    C.rect(66, fy, 8, 2, c.slateMid)
    C.line(66, fy + 2, 72, fy + 7, c.slateDark)
    C.line(74, fy - 3, 74, fy + 4, c.slateLight)
  }
  C.rect(82, 50, 10, 30, c.voidDark)
  C.line(82, 50, 92, 50, c.slateMid)
  C.rect(98, 56, 6, 24, c.voidDark)

  // BUILDING 2 (Center-Right: x: 108 to 174, y: 38 to 80)
  C.rect(108, 38, 66, 3, c.slateDark)
  C.line(108, 38, 174, 38, c.slateLight)
  C.line(108, 40, 174, 40, c.black)
  C.rect(108, 41, 66, 38, c.slateDark)
  C.line(108, 58, 174, 58, c.black)
  C.line(140, 41, 140, 58, c.black)

  // Windows
  drawArchWindow(116, 44, 7, 10, 'dark')
  drawArchWindow(130, 44, 7, 10, 'dark')
  drawArchWindow(158, 44, 7, 10, 'dark')

  // Warped, Hanging Neon Signboard: "CLINIC / ☿ OCCULT"
  C.rect(116, 48, 30, 10, c.black)
  C.rect(117, 49, 28, 8, c.voidDark)
  C.line(116, 48, 145, 48, c.slateLight)
  C.line(116, 57, 145, 57, c.slateDark)
  C.line(120, 42, 120, 48, c.slateLight)
  C.line(142, 44, 144, 48, c.slateDark)
  const neon1 = (t % 2 === 0) ? c.corruptMagenta : c.wineDark
  const neon2 = (t % 2 === 0) ? c.glowCyanPale : c.arcBlue
  C.line(120, 52, 126, 52, neon1)
  C.line(123, 50, 123, 55, neon1)
  C.pset(129, 53, neon2)
  C.line(132, 51, 137, 51, neon2)
  C.line(132, 54, 137, 54, neon2)
  C.pset(140, 52, neon1)

  // Ground-level roll-down shutter with warding glyphs
  C.rect(114, 60, 52, 19, c.voidDark)
  C.line(114, 60, 166, 60, c.black)
  for (let sy = 62; sy < 79; sy += 2) {
    C.line(115, sy, 165, sy, c.slateDark)
  }
  C.line(122, 65, 126, 73, c.stonePale)
  C.line(126, 65, 122, 73, c.stonePale)
  C.line(120, 69, 128, 69, c.stonePale)
  C.ring(146, 69, 4, c.stonePale)
  C.line(146, 64, 146, 74, c.stonePale)

  // ALLEY 2 (Right Monster Lair: x: 174 to 256)
  C.rect(174, 36, 82, 44, c.black)
  C.poly([[224, 36], [256, 36], [256, 80], [218, 80]], c.voidDark)
  C.line(224, 36, 218, 80, c.slateDark)

  drawSagWire(66, 44, 108, 40, 12, c.black)
  drawSagWire(174, 40, 224, 38, 14, c.black)

  // ============================================================
  // 4. THE SIDEWALK & STREET GROUND PLANE (y: 78 to 148)
  // ============================================================
  // Back Sidewalk (y: 78 to 88)
  C.rect(0, 78, 256, 9, c.slateMid)
  for (let px = 0; px < 256; px += 20) {
    C.line(px, 78, px - 3, 87, c.slateDark)
    C.line(0, 82, 256, 82, c.slateDark)
  }
  C.line(0, 87, 255, 87, c.slateLight)
  C.line(0, 88, 255, 88, c.black)

  // Main Asphalt Street (y: 89 to 148)
  C.rect(0, 89, 256, 59, c.slateDark)

  // Wet reflective asphalt patches & damp road sheen (soft sky reflections)
  const wetPatches = [
    [8, 92, 26, 6], [62, 122, 28, 7], [92, 96, 18, 5],
    [166, 134, 30, 6], [182, 92, 22, 5], [214, 124, 32, 6]
  ]
  wetPatches.forEach(([rx, ry, rw, rh]) => {
    C.ell(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, c.deepNight)
    C.line(rx + 2, ry + rh / 2, rx + rw - 3, ry + rh / 2, c.slateMid)
  })

  // Faded crosswalk on left (x: 48 to 88)
  for (let cw = 50; cw < 88; cw += 8) {
    C.poly([[cw, 91], [cw + 5, 91], [cw + 1, 107], [cw - 4, 107]], c.stonePale)
    C.line(cw - 1, 98, cw + 3, 101, c.slateDark)
  }

  // Faded dashed center divider (y: 114 to 117)
  for (let cx = 96; cx < 256; cx += 26) {
    C.rect(cx, 115, 14, 2, c.acidYellow)
    C.line(cx + 4, 115, cx + 8, 116, c.black)
  }

  // Branching spiderweb asphalt fissure cracks
  C.line(88, 106, 104, 106, c.black)
  C.line(96, 106, 92, 112, c.black)
  C.line(100, 106, 102, 101, c.black)
  C.line(166, 114, 182, 112, c.black)
  C.line(176, 112, 182, 118, c.black)
  C.line(144, 134, 152, 144, c.black)
  C.line(148, 138, 156, 138, c.black)

  // DEEP JAGGERY ABYSSAL CHASM (x: 104 to 166, y: 96 to 134)
  const riftPts = [
    [104, 106], [114, 98], [128, 102], [142, 96], [154, 104],
    [166, 114], [158, 126], [144, 134], [130, 130], [116, 122], [108, 116]
  ]
  C.poly(riftPts, c.black)
  for (let i = 0; i < riftPts.length; i++) {
    const p1 = riftPts[i], p2 = riftPts[(i + 1) % riftPts.length]
    C.line(p1[0], p1[1], p2[0], p2[1], c.tentacleDark)
    C.line(p1[0] + 1, p1[1] + 1, p2[0] + 1, p2[1] + 1, c.corruptMagenta)
  }
  // Boiling radioactive green slime
  C.poly([[120, 108], [138, 106], [150, 114], [136, 122], [122, 116]], c.slimeDark)
  C.poly([[124, 110], [134, 108], [144, 113], [132, 118]], c.slimeBright)
  const bubbleR = (t % 2 === 0) ? 3 : 2
  C.disc(132, 113, bubbleR, c.acidLime)
  C.pset(132, 113, c.acidYellow)
  C.disc(140, 111, (t % 2 === 1) ? 2 : 1, c.acidLime)
  // Slime puddles on asphalt edge
  C.ell(106, 124, 5, 2, c.slimeDark)
  C.ell(106, 124, 3, 1, c.slimeBright)
  C.ell(158, 130, 6, 2, c.slimeDark)
  C.ell(158, 130, 4, 1, c.slimeBright)

  // ============================================================
  // 5. STREET PROPS & WRECKAGE
  // ============================================================
  // Antique Bent Streetlamp (x: 44, y: 46 to 88)
  C.rect(42, 84, 5, 3, c.black)
  C.rect(43, 83, 3, 2, c.slateLight)
  C.line(44, 52, 44, 84, c.slateLight)
  C.line(45, 52, 45, 84, c.black)
  C.line(44, 52, 38, 47, c.slateLight)
  C.line(38, 47, 32, 50, c.slateLight)
  C.line(32, 50, 32, 54, c.slateLight)
  C.line(43, 76, 46, 72, c.wineDark)
  C.line(46, 68, 43, 64, c.crimsonDeep)
  C.line(43, 60, 45, 56, c.coralFlesh)
  C.disc(32, 56, 3, c.slimeDark)
  C.disc(32, 56, 2, c.slimeBright)
  C.pset(32, 56, c.acidLime)
  const dropY = 59 + (t * 2) % 10
  C.pset(32, dropY, c.slimeBright)
  C.ell(32, 92, 4, 2, c.slimeDark)
  C.pset(32, 92, c.slimeBright)

  // Overturned Vehicle Wreckage (x: 16 to 48, y: 104 to 126)
  C.poly([[16, 120], [22, 108], [44, 108], [48, 116], [42, 126], [18, 126]], c.black)
  C.poly([[18, 119], [23, 110], [42, 110], [46, 116], [40, 124], [20, 124]], c.slateMid)
  C.rect(26, 112, 14, 8, c.rustRose)
  C.line(26, 112, 40, 112, c.slateLight)
  C.poly([[20, 112], [24, 112], [23, 118], [19, 118]], c.black)
  C.pset(21, 114, c.glowCyanPale)
  C.disc(36, 124, 4, c.black)
  C.disc(36, 124, 2, c.slateDark)
  C.disc(24, 114, 4, c.wineDark)
  C.disc(24, 114, 2, c.crimsonDeep)
  C.pset(24, 113, c.coralFlesh)
  C.line(24, 118, 20, 124, c.coralFlesh)

  // Rusted oil drum & debris on sidewalk
  C.rect(96, 78, 6, 8, c.rustRose)
  C.line(96, 78, 101, 78, c.slateLight)
  C.line(96, 81, 101, 81, c.black)
  C.ell(103, 84, 4, 2, c.slimeDark)

  // Tilted street signpost
  C.line(169, 74, 172, 85, c.slateLight)
  C.line(170, 74, 173, 85, c.black)
  C.rect(165, 73, 9, 5, c.slateDark)
  C.line(165, 73, 173, 73, c.slateLight)
  C.pset(168, 75, c.coralFlesh)

  // ============================================================
  // 6. THE PIXEL TARGET / OBJECTIVE ANOMALY (x: 140, y: 82..94)
  // "场景中有一处看上去像素目标的地方"
  // ============================================================
  const tx = 140, ty = 84
  const tbob = (t % 2 === 0) ? 0 : -1

  // Ground Reality Distortion Circle / Occult Seal
  C.ell(tx, ty + 12, 14, 5, c.voidDark)
  C.ell(tx, ty + 12, 12, 4, c.arcBlue)
  C.ell(tx, ty + 12, 9, 3, c.glowBlueCold)
  C.ell(tx, ty + 12, 6, 2, c.glowCyanPale)
  C.pset(tx - 12, ty + 12, c.white)
  C.pset(tx + 12, ty + 12, c.white)
  C.pset(tx, ty + 8, c.white)
  C.pset(tx, ty + 16, c.white)

  // Floating Dimensional Anomaly Crystal
  const sy = ty + tbob
  C.disc(tx, sy, 8, c.black)
  C.disc(tx, sy, 6, c.voidDark)
  C.disc(tx, sy, 4, c.arcBlue)
  C.poly([[tx, sy - 6], [tx + 4, sy - 1], [tx, sy + 6], [tx - 4, sy - 1]], c.glowBlueCold)
  C.poly([[tx, sy - 5], [tx + 2, sy - 1], [tx, sy + 5], [tx - 2, sy - 1]], c.glowCyanPale)
  C.line(tx - 1, sy - 4, tx - 1, sy + 4, c.white)
  C.pset(tx, sy, c.white)

  // Orbiting dimensional spark motes
  const ang0 = (t * Math.PI) / 2
  const ox1 = Math.round(tx + Math.cos(ang0) * 8)
  const oy1 = Math.round(sy + Math.sin(ang0) * 4)
  const ox2 = Math.round(tx - Math.cos(ang0) * 8)
  const oy2 = Math.round(sy - Math.sin(ang0) * 4)
  C.pset(ox1, oy1, c.white)
  C.pset(ox2, oy2, c.glowCyanPale)

  // --- CRISP PIXEL TARGET RETICLE / OBJECTIVE BEACON ---
  const rx = tx, ry = sy - 18
  const rpad = (t % 2 === 0) ? 6 : 7

  // Subtle dark halo backdrop behind reticle
  C.rect(rx - rpad - 2, ry - rpad - 2, (rpad + 2) * 2 + 1, (rpad + 2) * 2 + 1, c.black)

  // 4 Corner Brackets: [  ] in crisp ice cyan & white
  // Top-Left
  C.line(rx - rpad, ry - rpad, rx - rpad + 3, ry - rpad, c.white)
  C.line(rx - rpad, ry - rpad, rx - rpad, ry - rpad + 3, c.white)
  // Top-Right
  C.line(rx + rpad, ry - rpad, rx + rpad - 3, ry - rpad, c.white)
  C.line(rx + rpad, ry - rpad, rx + rpad, ry - rpad + 3, c.white)
  // Bottom-Left
  C.line(rx - rpad, ry + rpad, rx - rpad + 3, ry + rpad, c.white)
  C.line(rx - rpad, ry + rpad, rx - rpad, ry + rpad - 3, c.white)
  // Bottom-Right
  C.line(rx + rpad, ry + rpad, rx + rpad - 3, ry + rpad, c.white)
  C.line(rx + rpad, ry + rpad, rx + rpad, ry + rpad - 3, c.white)

  // Center Target Crosshair Dot & Diamond
  C.pset(rx, ry, c.white)
  C.pset(rx - 1, ry, c.glowCyanPale)
  C.pset(rx + 1, ry, c.glowCyanPale)
  C.pset(rx, ry - 1, c.glowCyanPale)
  C.pset(rx, ry + 1, c.glowCyanPale)

  // Vertical locator laser beam pulsing down to the crystal
  for (let ly = ry + rpad + 1; ly < sy - 6; ly += 2) {
    C.pset(rx, ly, c.glowBlueCold)
  }

  // ============================================================
  // 7. THE COMBAT TRIGGER ENTITY (x: 206, y: 84 to 126)
  // "一个可以触发战斗的对象" - 潜伏在小巷口的血肉眼魔
  // ============================================================
  const mx = 206, my = 98
  const mbreathe = (t === 1 || t === 2) ? 1 : 0

  // Ground Aggro Radius / Encounter Perimeter (Dashed red combat boundary)
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const ppx = Math.round(mx + Math.cos(a + t * 0.15) * (24 + mbreathe))
    const ppy = Math.round(my + 18 + Math.sin(a + t * 0.15) * 9)
    C.pset(ppx, ppy, (t % 2 === 0) ? c.coralFlesh : c.bloodRed)
  }

  // Corrupted dark sludge pool beneath the monster
  C.ell(mx, my + 14, 18, 7, c.voidDark)
  C.ell(mx - 2, my + 14, 14, 5, c.wineDark)

  // Monstrosity Body: Grotesque, Pulsating Bio-Horror Bulk with Rich Muscle Shading
  C.ell(mx, my, 17 + mbreathe, 14 + mbreathe, c.black)
  C.ell(mx, my, 16 + mbreathe, 13 + mbreathe, c.voidDark)
  C.ell(mx - 6, my - 2, 11, 10, c.wineDark)
  C.ell(mx + 6, my - 1, 12, 10, c.crimsonDeep)
  C.ell(mx, my + 4, 14, 8, c.rustRose)
  // Glistening muscular ridges & skin folds
  C.arc(mx - 5, my + 2, 8, 0.2, Math.PI * 0.8, c.fleshRot)
  C.arc(mx + 4, my + 3, 7, 0.4, Math.PI * 0.9, c.fleshMid)
  C.arc(mx, my - 6, 9, Math.PI * 0.2, Math.PI * 0.7, c.fleshLilac)
  C.pset(mx + 7, my - 6, c.white) // slimy specular sheen

  // Writhing Muscular Tentacles with Suckers and Barbs
  // Tentacle 1: Lunging left towards the Scavenger
  const t1x = 178 - mbreathe * 2
  const t1y = 114 + (t % 2 === 0 ? 0 : 2)
  C.line(mx - 10, my + 6, mx - 18, my + 12, c.tentacleDark, 2)
  C.line(mx - 18, my + 12, t1x, t1y, c.tentacleMid, 2)
  C.line(t1x, t1y, t1x - 5, t1y + 2, c.tentacleLight)
  C.pset(t1x - 2, t1y - 1, c.fleshLilac)
  C.pset(t1x - 6, t1y + 1, c.fleshLilac)
  C.pset(t1x - 8, t1y + 2, c.coralFlesh)

  // Tentacle 2: Slithering forward onto the asphalt
  const t2x = 194
  const t2y = 124 + (t % 2 === 0 ? 2 : 0)
  C.line(mx - 4, my + 10, mx - 8, my + 18, c.tentacleDark, 2)
  C.line(mx - 8, my + 18, t2x, t2y, c.tentacleMid, 2)
  C.pset(t2x, t2y, c.acidLime)
  C.pset(t2x - 2, t2y - 2, c.corruptPink)

  // Tentacle 3: Coiled against the ruined alley wall
  C.line(mx + 10, my + 8, mx + 18, my + 14, c.tentacleDark, 2)
  C.line(mx + 18, my + 14, mx + 24, my + 10, c.tentacleMid)
  C.line(mx + 24, my + 10, mx + 26, my + 4, c.tentacleLight)

  // Tentacle 4: Raised threat coil ready to strike
  const t4y = my - 16 - mbreathe * 2
  C.line(mx + 8, my - 6, mx + 14, my - 12, c.tentacleDark, 2)
  C.line(mx + 14, my - 12, mx + 18, t4y, c.tentacleMid)
  C.pset(mx + 18, t4y, c.coralFlesh)

  // Dripping acidic toxic mucus
  C.ell(t1x + 2, 120, 5, 2, c.slimeDark)
  C.pset(t1x + 2, 120, c.slimeBright)

  // --- THE CLUSTER OF COSMIC HORROR EYES ---
  // Main Cyclopean Eye (Glaring fiercely left at the Scavenger)
  const cex = mx - 2, cey = my - 2 - mbreathe
  C.disc(cex, cey, 7, c.black)
  C.disc(cex, cey, 6, c.coralFlesh)
  C.disc(cex, cey, 5, c.bloodRed)
  C.disc(cex, cey, 4, c.fleshPale)
  C.disc(cex, cey, 3, c.acidYellow)
  C.line(cex, cey - 3, cex, cey + 3, c.black)
  C.line(cex - 1, cey - 1, cex - 1, cey + 1, c.black)
  C.pset(cex - 2, cey - 2, c.white)
  C.pset(cex + 4, cey - 3, c.bloodRed)
  C.pset(cex - 4, cey + 3, c.coralFlesh)

  // Auxiliary Eye 2 (Upper Left)
  C.disc(mx - 10, my - 7 - mbreathe, 3, c.bloodRed)
  C.disc(mx - 10, my - 7 - mbreathe, 2, c.fleshPale)
  C.pset(mx - 10, my - 7 - mbreathe, (t % 2 === 0) ? c.acidYellow : c.black)
  C.pset(mx - 11, my - 8 - mbreathe, c.white)

  // Auxiliary Eye 3 (Lower Left)
  C.disc(mx - 11, my + 4, 3, c.coralFlesh)
  C.disc(mx - 11, my + 4, 2, c.fleshPale)
  C.pset(mx - 11, my + 4, c.black)

  // Auxiliary Eye 4 (Right side)
  C.disc(mx + 8, my - 4 - mbreathe, 3, c.coralFlesh)
  C.disc(mx + 8, my - 4 - mbreathe, 2, c.fleshPale)
  C.pset(mx + 8, my - 4 - mbreathe, c.acidYellow)
  C.pset(mx + 8, my - 4 - mbreathe, c.black)

  // Auxiliary Eye 5 (Small top twitching eye)
  C.disc(mx + 1, my - 10 - mbreathe, 2, c.fleshPale)
  C.pset(mx + 1, my - 10 - mbreathe, c.bloodRed)

  // --- COMBAT ENCOUNTER ALERT BADGE ---
  const ax = mx, ay = my - 24 - mbreathe
  C.poly([[ax, ay - 6], [ax + 6, ay], [ax, ay + 6], [ax - 6, ay]], c.black)
  C.poly([[ax, ay - 5], [ax + 5, ay], [ax, ay + 5], [ax - 5, ay]], c.coralFlesh)
  C.line(ax, ay - 3, ax, ay, c.white)
  C.pset(ax, ay + 2, c.white)
  if (t % 2 === 0) {
    C.pset(ax - 8, ay - 2, c.coralFlesh)
    C.pset(ax - 8, ay + 2, c.coralFlesh)
    C.pset(ax + 8, ay - 2, c.coralFlesh)
    C.pset(ax + 8, ay + 2, c.coralFlesh)
  }

  // ============================================================
  // 8. THE PROTAGONIST: THE SCAVENGER (x: 72, y: 102..134)
  // "主角是一个背负仪器的‘拾荒者’"
  // ============================================================
  const px = 72, py = 104
  const pbob = (t === 1 || t === 3) ? 1 : 0

  // Ground Shadow (Solid dark anchor on asphalt)
  C.ell(px + 2, 134, 13, 4, c.black)

  // Heavy Armored Boots
  // Left boot (planted)
  C.rect(px - 5, 130, 6, 4, c.black)
  C.rect(px - 5, 131, 5, 2, c.slateDark)
  C.pset(px - 4, 133, c.slateLight)
  // Right boot (stepping forward)
  C.rect(px + 3, 131, 7, 4, c.black)
  C.rect(px + 3, 132, 6, 2, c.slateDark)
  C.pset(px + 7, 134, c.slateLight)

  // Legs & Leather Gaiters
  C.line(px - 3, 124, px - 3, 130, c.black, 2)
  C.line(px + 5, 124, px + 5, 131, c.black, 2)
  C.pset(px - 3, 127, c.rustRose)
  C.pset(px + 5, 128, c.rustRose)

  // Tattered Survival Trenchcoat (Volumetric Shading with clear edge separation!)
  // Black 1px outline for crisp silhouette against the dark road
  C.poly([[px - 9, 113 - pbob], [px + 10, 113 - pbob], [px + 11, 128], [px - 10 + (t % 2), 128]], c.black)
  // Coat base in mid-slate purple (stands out from the dark road!)
  C.poly([[px - 8, 114 - pbob], [px + 9, 114 - pbob], [px + 10, 127], [px - 9 + (t % 2), 127]], c.slateMid)
  // Deep fold shadows
  C.line(px - 2, 116 - pbob, px - 1, 127, c.slateDark)
  C.line(px + 2, 116 - pbob, px + 3, 126, c.slateDark)
  // Dusty hem and fold highlights
  C.line(px - 5, 117 - pbob, px - 4, 126, c.slateLight)
  C.line(px + 6, 117 - pbob, px + 7, 126, c.slateLight)
  C.pset(px - 9 + (t % 2), 127, c.stonePale)
  C.pset(px + 10, 127, c.stonePale)

  // Torso, Shoulder Armor & Utility Harness
  C.rect(px - 7, 103 - pbob, 15, 12, c.black)
  C.rect(px - 6, 104 - pbob, 13, 10, c.slateMid)
  // Shoulder armor plate in slate light
  C.rect(px - 6, 104 - pbob, 5, 3, c.slateLight)
  C.pset(px - 5, 105 - pbob, c.stonePale)
  // Cross-body leather harness & sample pouches
  C.line(px - 5, 105 - pbob, px + 4, 113 - pbob, c.rustRose)
  C.rect(px - 2, 108 - pbob, 3, 2, c.fleshRot)
  C.rect(px + 2, 110 - pbob, 2, 2, c.amberWarm) // brass buckle

  // --- THE BULKY APPARATUS (背负的沉重异形仪器) ---
  const bx = px - 12, by = py - 10 - pbob

  // Heavy metal boiler / casing in warm complementary brass & iron
  C.rect(bx, by + 4, 9, 15, c.black)
  C.rect(bx + 1, by + 5, 7, 13, c.rustRose)
  C.line(bx + 1, by + 5, bx + 7, by + 5, c.amberWarm)
  C.line(bx + 1, by + 17, bx + 7, by + 17, c.slateDark)
  // Brass rivets
  C.pset(bx + 1, by + 6, c.amberWarm)
  C.pset(bx + 7, by + 6, c.amberWarm)
  C.pset(bx + 1, by + 16, c.amberWarm)
  C.pset(bx + 7, by + 16, c.amberWarm)

  // Glowing Glass Vacuum Tube Core
  const ty_core = by + 7
  C.rect(bx + 2, ty_core, 4, 6, c.black)
  C.rect(bx + 2, ty_core, 4, 5, c.glowBlueCold)
  const coreCol = (t % 2 === 0) ? c.amberWarm : c.acidYellow
  C.line(bx + 3, ty_core + 1, bx + 4, ty_core + 4, coreCol)
  C.pset(bx + 3, ty_core + 2, c.white)

  // Pressure Dial / Resonance Gauge
  C.disc(bx + 5, by + 14, 2, c.stonePale)
  C.pset(bx + 5, by + 14, c.coralFlesh)

  // Twin Copper Induction Antennas
  // Antenna 1 (tall with copper coil)
  C.line(bx + 2, by + 4, bx + 1, by - 8, c.black)
  C.line(bx + 2, by + 4, bx + 1, by - 8, c.slateLight)
  C.pset(bx + 1, by - 8, c.amberWarm)
  C.line(bx, by - 3, bx + 3, by - 3, c.amberWarm)
  C.line(bx, by - 1, bx + 3, by - 1, c.amberWarm)
  // Antenna 2 (short sensor spire)
  C.line(bx + 6, by + 4, bx + 7, by - 4, c.slateLight)
  C.pset(bx + 7, by - 4, (t % 2 === 0) ? c.glowCyanPale : c.arcBlue)

  // Scavenger Hood & Cowl
  const hx = px + 1, hy = py - 8 - pbob
  C.disc(hx, hy, 6, c.black)
  C.disc(hx, hy, 5, c.slateMid)
  C.arc(hx, hy, 5, Math.PI, Math.PI * 1.8, c.slateLight)

  // Gas Mask / Respirator
  C.rect(hx + 2, hy + 1, 5, 3, c.black)
  C.rect(hx + 3, hy + 2, 4, 2, c.slateDark)
  C.pset(hx + 5, hy + 3, c.slateLight)

  // --- ICONIC GLOWING OCULAR MONO-VISOR ---
  C.disc(hx + 2, hy - 1, 3, c.black)
  C.disc(hx + 2, hy - 1, 2, c.arcBlue)
  C.pset(hx + 2, hy - 1, c.glowCyanPale)
  C.pset(hx + 3, hy - 2, c.white)

  // Subtle Forward Light Beam from the visor onto the dark road
  for (let sx = hx + 6; sx < hx + 24; sx += 2) {
    const spread = Math.floor((sx - hx) / 5)
    for (let sy = (hy - 1) - spread; sy <= (hy - 1) + spread; sy += 2) {
      if (C.get(sx, sy) === c.slateDark) {
        C.pset(sx, sy, c.slateMid)
      }
    }
  }

  // Hands & Specialized Anomaly Sensor Probe Staff
  C.rect(px + 4, 110 - pbob, 3, 3, c.black)
  C.rect(px + 4, 110 - pbob, 2, 2, c.slateLight)

  const prx1 = px + 6, pry1 = 112 - pbob
  const prx2 = px + 22, pry2 = 127
  C.line(prx1, pry1, prx2, pry2, c.black, 2)
  C.line(prx1, pry1, prx2, pry2, c.slateLight)

  // Probe Emitter Head at tip
  C.rect(prx2 - 1, pry2 - 1, 3, 3, c.black)
  C.rect(prx2, pry2, 2, 2, c.rustRose)
  const sensorLED = (t % 2 === 0) ? c.acidYellow : c.coralFlesh
  C.pset(prx2 + 1, pry2 + 1, sensorLED)

  // Sonar / Reality resonance detection pulses on asphalt
  if (t % 2 === 0) {
    C.ell(prx2 + 1, pry2 + 3, 5, 2, c.glowCyanPale)
  } else {
    C.ell(prx2 + 1, pry2 + 3, 8, 3, c.arcBlue)
  }


  // ============================================================
  // 9. FOREGROUND SILHOUETTE FRAMING & PARTICLES (y: 146 to 160)
  // ============================================================
  // Bottom Sidewalk & Silhouette Barrier
  C.rect(0, 152, 256, 8, c.black)
  C.line(0, 152, 255, 152, c.voidDark)

  function drawBrokenRailing(rx1, rx2) {
    C.line(rx1, 149, rx2, 149, c.black)
    C.line(rx1, 148, rx2, 148, c.slateDark)
    for (let rx = rx1 + 4; rx < rx2; rx += 14) {
      C.line(rx, 148, rx, 155, c.black)
      C.line(rx - 1, 149, rx - 1, 155, c.voidDark)
    }
  }
  drawBrokenRailing(0, 90)
  drawBrokenRailing(170, 256)

  // Sewer drainage storm grate in foreground
  C.rect(122, 153, 22, 5, c.black)
  C.line(122, 153, 143, 153, c.slateLight)
  for (let gx = 124; gx < 142; gx += 3) {
    C.line(gx, 154, gx, 157, c.voidDark)
  }
  const steamY = 150 - (t % 4)
  C.pset(128, steamY, c.slimeDark)
  C.pset(134, steamY - 1, c.slimeBright)
  C.pset(138, steamY, c.slimeDark)

  // Drifting atmospheric cosmic spores & glowing dust motes
  const spores = [
    [36, 68], [92, 102], [116, 90], [158, 76], [178, 110], [214, 62], [82, 138], [148, 126]
  ]
  spores.forEach(([sx, sy], i) => {
    const spX = (sx + t * 2 * (i % 2 === 0 ? 1 : -1) + 256) % 256
    const spY = sy + ((t + i) % 3) - 1
    const spCol = (i % 3 === 0) ? c.slimeBright : (i % 3 === 1 ? c.glowCyanPale : c.fleshLilac)
    C.pset(spX, spY, spCol)
  })
}

