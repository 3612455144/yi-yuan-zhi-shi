(() => {
  "use strict";

  const subtract = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = vector => {
    const length = Math.hypot(...vector);
    return length ? vector.map(value => value / length) : [0, 1, 0];
  };
  const pigments = new Map();
  function color(hex) {
    let rgb = pigments.get(hex);
    if (!rgb) {
      rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)/255);
      pigments.set(hex,rgb);
    }
    return rgb;
  }
  const around = (min, max, value) => Math.max(min, Math.min(max, value));
  
  const seasonColors = {
    rain: { ground: "9d9872", grass: "87aa62", second: "aec27c", tree: "8d9f6a", tile: "4f7072", path: "b6ab86", water: "a5c6b5", light: [1.015, 1.07, 1.01] },
    grain: { ground: "b6a882", grass: "8b9e64", second: "acb67b", tree: "7e965a", tile: "687979", path: "c3b89f", water: "829b92", light: [1.035, 1.025, 0.97] },
    dew: { ground: "aea290", grass: "8a895f", second: "a49a65", tree: "be8c48", tile: "4c6374", path: "b9aa9c", water: "928d79", light: [1.025, 1.01, 1.015] },
    winter: { ground: "a99f91", grass: "9e9b72", second: "b3aa8b", tree: "8b806e", tile: "68777f", path: "bcb6a8", water: "a49a86", light: [0.99, 1.015, 1.055] }
  };

  class Mesh {
    constructor() {
      this.data = [];
    }
    face(vertices, pigment) {
      const normal = unit(cross(subtract(vertices[1], vertices[0]), subtract(vertices[2], vertices[0])));
      const rgb = color(pigment);
      for (let i = 1; i < vertices.length - 1; i++) {
        for (const vertex of [vertices[0], vertices[i], vertices[i + 1]]) this.data.push(...vertex, ...normal, ...rgb);
      }
    }
    box(x, y, z, w, h, d, top, side = top) {
      const a = x - w / 2, b = x + w / 2, c = y - h / 2, e = y + h / 2, f = z - d / 2, g = z + d / 2;
      this.face([[a,e,g],[b,e,g],[b,e,f],[a,e,f]], top);
      this.face([[a,c,g],[b,c,g],[b,e,g],[a,e,g]], side);
      this.face([[b,c,g],[b,c,f],[b,e,f],[b,e,g]], side);
      this.face([[a,c,f],[a,c,g],[a,e,g],[a,e,f]], side);
      this.face([[b,c,f],[a,c,f],[a,e,f],[b,e,f]], side);
      this.face([[a,c,f],[b,c,f],[b,c,g],[a,c,g]], side);
    }
    beam(start, end, width, depth, pigment) {
      const direction = unit(subtract(end, start));
      const crossAxis = Math.abs(direction[0]) > 0.8 ? [0, 0, 1] : [1, 0, 0];
      const side = unit(cross(crossAxis, direction));
      const across = cross(side, direction);
      const ring = center => [[-1,-1], [1,-1], [1,1], [-1,1]].map(([a,b]) => center.map((v,i) => v + across[i] * a * width / 2 + side[i] * b * depth / 2));
      const lower = ring(start), upper = ring(end);
      this.face([...lower].reverse(), pigment);
      this.face(upper, pigment);
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        this.face([lower[i], lower[next], upper[next], upper[i]], pigment);
      }
    }
    revolved(x, z, rings, pigments, sides = 12) {
      const ring = ([y, radius]) => Array.from({length: sides}, (_, i) => {
        const angle = 2 * Math.PI * i / sides;
        return [x + radius * Math.cos(angle), y, z + radius * Math.sin(angle)];
      });
      const levels = rings.map(ring);
      for (let j = 0; j < levels.length - 1; j++) {
        for (let i = 0; i < sides; i++) {
          const after = (i + 1) % sides;
          this.face([levels[j][i], levels[j + 1][i], levels[j + 1][after], levels[j][after]], pigments[j % pigments.length]);
        }
      }
      if (rings[0][1] > 0) this.face(levels[0], pigments[0]);
      if (rings.at(-1)[1] > 0) this.face([...levels.at(-1)].reverse(), pigments.at(-1));
    }
    canopy(x, y, z, radius, pigment, flatten = 1) {
      const sides = 7;
      const rings = [[-.63,.48],[0,1],[.68,.54]].map(([height, width], j) => Array.from({length: sides}, (_, i) => {
        const angle = (i + j * .31) * 2 * Math.PI / sides;
        return [x + radius * width * Math.cos(angle), y + radius * height * flatten, z + radius * width * .84 * Math.sin(angle)];
      }));
      this.face(rings[0], pigment);
      this.face([...rings[2]].reverse(), pigment);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < sides; i++) {
          const n = (i + 1) % sides;
          this.face([rings[j][i], rings[j + 1][i], rings[j][n]], pigment);
          this.face([rings[j][n], rings[j + 1][i], rings[j + 1][n]], pigment);
        }
      }
    }
  }

  const plot = {left:-1.74, right:6.53, near:2.59, far:14.58};
  const shallowWater = {height:.280,opacity:.57};
  const outletZ = 4.72;
  const rainPools = [[-.65,4.3,.43],[1.6,5.9,.55],[4.0,7.6,.56],
    [.54,9.1,.46],[5.3,11.2,.5],[2.8,12.9,.56],[-.55,13.3,.41]];
  const footprint = {left:-3.05, right:7.84, back:-5.36, front:15.46};
  const variation = seed => {
    const value = Math.sin(seed * 127.1 + 83.2) * 43758.5453;
    return value - Math.floor(value);
  };

  const yardTrees = [
    { x:-2.57, z:1.35, scale:1, lean:-1, kind:"willow" },
    { x:7.28, z:-.94, scale:1.05, lean:1, kind:"broadleaf" },
    { x:7.27, z:8.02, scale:.61, lean:1, kind:"willow" }
  ];
  const treeLeaves = {
    rain: ["648e50","87aa62","a9c977","c0ce88"],
    grain: ["476949","588451","729a57","96b46a"],
    dew: ["7c795a","9b8061","b77462","c69777"]
  };
  const autumnLeaves = ["a36953","b77462","bf936d","93845e"];
  // Coordinates are relative to the base of each tree.
  const branches = {
    willow: [
      [[.15,1.30,.12],[.85,2.47,-.42],[1.22,2.87,-.72],.67],
      [[.28,1.94,.11],[-.37,2.81,.66],[-.61,3.10,1.02],.76],
      [[.45,2.53,.08],[.33,3.21,-.28],[.63,3.70,-.24],.87],
      [[.33,2.20,.11],[1.12,2.75,.53],[1.63,3.08,.85],.71],
      [[.46,2.63,.08],[.87,3.36,.47],[1.01,3.54,.71],.68]
    ],
    broadleaf: [
      [[.11,1.70,.03],[.67,2.63,.66],[.91,3.24,1.03],.94],
      [[.30,2.02,.10],[-.40,2.72,.47],[-.48,3.21,.62],.76],
      [[.41,2.48,.09],[.99,3.26,-.35],[1.61,3.74,-.58],.95],
      [[.47,2.68,.10],[.17,3.58,-.50],[.34,4.03,-.87],.98],
      [[.44,2.55,.10],[.45,3.49,.42],[.68,4.12,.68],1.02]
    ]
  };

  function bough(mesh, start, end, base, tip, bark) {
    const axes = [[1,0],[.5,.866],[-.5,.866],[-1,0],[-.5,-.866],[.5,-.866]];
    const ring = (point,radius) => axes.map(([x,z]) => [point[0]+x*radius,point[1],point[2]+z*radius]);
    const low = ring(start,base), high = ring(end,tip);
    for (let i=0;i<axes.length;i++) {
      const next=(i+1)%axes.length;
      mesh.face([low[i],high[i],high[next],low[next]],bark[i%bark.length]);
    }
  }

  function growTree(mesh, tree, term) {
    const {x,z,scale,lean,kind} = tree;
    const at = ([a,b,c]) => [x+a*scale*lean,.245+b*scale,z+c*scale];
    const bark = kind === "willow" ? ["74614b","887357","605245"] : ["745342","8b6850","624c41"];
    const stem = [[0,0,0],[.09,1.04,.03],[.29,1.96,.11],[.47,2.75,.10],[.50,3.14,.15]];
    const widths = [.27,.20,.15,.096,.037];
    for (let i=1;i<stem.length;i++) {
      bough(mesh,at(stem[i-1]),at(stem[i]),widths[i-1]*scale,widths[i]*scale,bark);
    }
    for (const [i,[start,bend,tip,size]] of branches[kind].entries()) {
      bough(mesh,at(start),at(bend),.115*scale,.056*scale,bark);
      bough(mesh,at(bend),at(tip),.062*scale,.020*scale,bark);
      for (const side of [-1,1]) {
        const twig = [tip[0]+side*.39,tip[1]+.29,tip[2]+side*.26];
        bough(mesh,at(bend),at(twig),.039*scale,.008*scale,bark);
      }
      if (term === "winter") {
        if (kind === "willow") {
          const sweep = [tip[0]+.17,tip[1]-.55,tip[2]+.13];
          mesh.beam(at(tip),at(sweep),.017*scale,.017*scale,bark[1]);
        }
        continue;
      }

      const willow = kind === "willow";
      const spread = term === "rain" ? (willow ? .72 : .61) : term === "dew" && willow ? .88 : 1;
      const colors = treeLeaves[term];
      const palette = term === "dew" && willow ? ["627151","818660","a49a65","b1a379"] : colors;
      for (let j=0;j<8;j++) {
        const angle = j*2.4 + i*.72;
        const radius = j===0 ? 0 : size*(.43+.27*variation(i*17+j));
        const tuft = [tip[0]+Math.cos(angle)*radius,tip[1]+.16+variation(j+i*11)*.28,
          tip[2]+Math.sin(angle)*radius];
        const bulk = size*scale*spread*(j===0 ? 1 : .45+.25*variation(j*13+i));
        mesh.canopy(...at(tuft),bulk,palette[(i+j)%palette.length],willow ? .81 : 1.02);
        if (willow && j%2===0) {
          const droop = [tuft[0]+.14,tuft[1]-.68,tuft[2]+.1];
          mesh.beam(at(tuft),at(droop),.018*scale,.018*scale,palette[1]);
          mesh.canopy(...at(droop),bulk*.30,palette[2],2.6);
        }
      }
    }

    for (let i=0;i<5;i++) {
      const angle=i*2.4;
      bough(mesh,at([0,.19,0]),at([Math.cos(angle)*.40,.029,Math.sin(angle)*.46]),.11*scale,.025*scale,bark);
      const rock=at([Math.cos(angle)*.48,.017,Math.sin(angle)*.60]);
      mesh.canopy(...rock,(.12+variation(i)*.13)*scale,i%2 ? "9b957e" : "ada38b",.42);
    }
  }

  function leaf(mesh, x, y, z, size, heading, tilt, tone) {
    const dx=Math.cos(heading)*size, dz=Math.sin(heading)*size;
    const width=.42*Math.cos(tilt), bend=.42*Math.sin(tilt)*size;
    const tip=[x+dx,y,z+dz], stem=[x-dx*.7,y,z-dz*.7], rib=[x,y+.023,z];
    mesh.face([stem,rib,tip,[x-dz*width,y+bend,z+dx*width]],tone);
    mesh.face([stem,[x+dz*width,y-bend,z-dx*width],tip,rib],tone);
  }

  function stone(mesh, x, y, z, width, height, depth, face, edge) {
    const outline=[[-.50,-.31],[-.34,-.50],[.36,-.50],[.50,-.31],
      [.50,.34],[.36,.50],[-.35,.50],[-.50,.34]];
    const ring=(level,inset)=>outline.map(([dx,dz])=>[x+dx*width*inset,level,z+dz*depth*inset]);
    const bottom=ring(y-height/2,1), shoulder=ring(y+height*.22,1), top=ring(y+height/2,.88);
    mesh.face([...top].reverse(),face);
    for (let i=0;i<outline.length;i++) {
      const next=(i+1)%outline.length;
      mesh.face([bottom[i],shoulder[i],shoulder[next],bottom[next]],edge);
      mesh.face([shoulder[i],top[i],top[next],shoulder[next]],face);
    }
  }

  function platform(mesh, state) {
    const {left,right,back,front} = footprint;
    const cut=.32;
    const shape=[[left,back+cut],[left+cut,back],[right-cut,back],[right,back+cut],
      [right,front-cut],[right-cut,front],[left+cut,front],[left,front-cut]];
    const centerX=(left+right)/2, centerZ=(back+front)/2;
    const rings=[[-.87,.963],[-.73,.993],[-.42,.993],[-.34,1],[.12,1],[.24,.981]]
      .map(([y,scale]) => shape.map(([x,z]) => [centerX+(x-centerX)*scale,y,centerZ+(z-centerZ)*scale]));
    const strata = ["42372e","69503b","b49a6c","988569",state.grass];
    mesh.face([...rings.at(-1)].reverse(), state.ground);
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < shape.length; i++) {
        const n = (i + 1) % shape.length;
        mesh.face([rings[j][i],rings[j + 1][i],rings[j + 1][n],rings[j][n]],strata[j]);
      }
    }
    const marks=(length) => Math.floor((length-.84)/.68);
    for (let i=0; i<marks(right-left); i++) {
      const x=left+.52+i*.68;
      const tone=["c6b598","ad9c82","bbac90","d3c0a0"][i%4];
      stone(mesh,x,-.11,front+.008,.61+variation(i)*.043,.27,.039,tone,"8c775e");
    }
    for (let i=0; i<marks(front-back); i++) {
      const z=back+.52+i*.68;
      const tone=["bdac91","aa9b84","c9b79a","b4a389"][i%4];
      stone(mesh,right+.008,-.11,z,.039,.27,.61+variation(i+40)*.041,tone,"897761");
      stone(mesh,left-.008,-.11,z,.039,.27,.61+variation(i+13)*.041,tone,"897761");
    }
  }

  function farmhouse(mesh, state, term) {
    // Three bays share a single ridge. Both roof planes extend beyond the bearing walls.
    const xmin = -1.95, xmax = 6.55, rear = -4.13, front = -.57;
    const cx = (xmin + xmax) / 2, cz = (rear + front) / 2;
    const walls = "eddbb8", beam = "654433", timber = "a0714f", footing = "9a8a72";
    mesh.box(cx, .39, cz, 8.78, .30, 3.78, "bfb49c", footing);
    mesh.box(cx, 1.67, cz, 8.5, 2.28, 3.56, walls);
    mesh.box(cx,.645,front+.024,8.49,.22,.069,"aa9d81","968669");
    mesh.box(cx,2.61,front+.043,8.55,.18,.095,"865f43","6d4b36");
    for (let i=0; i<21; i++) {
      const x=xmin+.20+i*.407;
      mesh.box(x,.498,front+.113,.373,.112,.104,i%3===0 ? "b6a48a" : "9a8f7b");
    }
    for (let i=0; i<9; i++) {
      const z=rear+.23+i*.397;
      mesh.box(xmin-.04,.619,z,.12,.16,.38,i%2===0 ? "ad9b80" : "b8ab92");
      mesh.box(xmax+.04,.619,z,.12,.16,.38,i%2===0 ? "ad9b80" : "b8ab92");
    }
    mesh.box(cx,2.73,rear-.025,8.57,.15,.13,timber,beam);
    for (const x of [xmin+.32,2.3,xmax-.32]) mesh.box(x,1.67,rear-.028,.13,2.21,.11,timber,beam);
    for (const x of [-.71,5.22]) {
      mesh.box(x,1.68,rear-.075,.79,.68,.11,beam);
      for (let i=0;i<5;i++) mesh.box(x-.31+i*.155,1.68,rear-.139,.138,.56,.041,i%2 ? "ab8258" : "a27b54");
    }
    for (const x of [xmin, -.05, 2.94, 4.93, xmax]) mesh.box(x, 1.66, front + .048, .15, 2.25, .19, timber, beam);
    for (const x of [xmin, xmax]) {
      for (const z of [rear + .13, cz]) mesh.box(x, 1.70, z, .14, 2.32, .15, timber, beam);
      mesh.face([[x,2.81,rear],[x,2.81,front],[x,4.18,cz]], walls);
      mesh.face([[x,2.81,front],[x,2.81,rear],[x,4.18,cz]], walls);
      mesh.box(x, 2.78, cz, .15, .13, 3.60, timber, beam);
      mesh.box(x, 3.43, cz, .13, 1.36, .12, timber, beam);
    }

    const doorX = 2.27;
    mesh.box(doorX, 1.39, front + .085, 1.68, 1.83, .13, "6b4934");
    for (let i = 0; i < 8; i++) {
      const x = doorX - .73 + i * .207;
      mesh.box(x, 1.39, front + .165, .196, 1.69, .066, i < 4 ? "a37a51" : "af855c");
    }
    for (const y of [.56, 2.26]) mesh.box(doorX, y, front + .219, 1.81, .12, .16, timber, beam);
    for (const x of [doorX - .84,doorX + .84]) mesh.box(x, 1.40, front + .205,.11,1.83,.12,timber,beam);
    for (const x of [doorX-.17,doorX+.17]) {
      mesh.box(x,1.35,front+.23,.087,.155,.045,"625346");
      mesh.beam([x-.027,1.36,front+.27],[x+.028,1.31,front+.274],.024,.022,"b49362");
    }
    mesh.box(doorX,2.40,front+.11,1.85,.16,.16,"7e573e");
    for (let i=0;i<6;i++) mesh.box(doorX-.72+i*.288,2.40,front+.21,.039,.096,.026,"ad855d");
    for (const x of [-1.02, 4.24, 5.66]) {
      const width = x > 5 ? .68 : .97;
      mesh.box(x, 1.65, front + .067, width + .17, .86, .17, timber, beam);
      mesh.box(x,1.66,front+.163,width,.68,.037,"40362f");
      for (const side of [-1,1]) {
        const pane = x + side*width*.13;
        mesh.box(pane,1.67,front+.186,width*.21,.53,.015,side<0 ? "afa082" : "bdab85");
      }
      for (let i = -1; i <= 1; i++) mesh.box(x + i * width / 4,1.66,front + .196,.065,.68,.051,"bb996e");
      mesh.box(x, 1.66, front + .192, width, .055, .053, "bb996e");
      mesh.box(x, 1.26, front + .18, width + .24,.10,.29,"a08462",beam);
    }
    mesh.box(xmax + .035, 1.6, -2.59, .12, .73, .88, beam);
    for (let i = 0; i < 5; i++) mesh.box(xmax + .105,1.6,-2.94 + i * .176,.045,.63,.155,"af8c65");

    mesh.box(cx, .356, -.24, 8.76,.225,.95, state.path, footing);
    stone(mesh,doorX,.315,.29,1.98,.15,.43,"bfb296","887862");
    stone(mesh,doorX,.273,.56,2.12,.068,.25,"ab9b7f","887862");
    mesh.box(cx, 2.53, .12, 8.73,.16,.21,timber,beam);
    for (const x of [xmin + .13, .37, 4.56, xmax - .13]) {
      mesh.box(x,.50,.12,.29,.17,.30,"a79a7e",footing);
      mesh.box(x,1.54,.12,.15,2.07,.15,timber,beam);
    }

    const roofX = [-2.37,6.99];
    const profile = [[-4.62,2.62],[-4.07,2.93],[-3.41,3.34],[-2.35,4.23],[-1.26,3.31],[-.47,2.79],[.56,2.60]];
    const tileTones = ["435861","4b6168","50676d","526772","5c7274"];
    const roofHeight = z => {
      const i=profile.findIndex(([point]) => point>=z);
      if (i<1) return profile[i===0 ? 0 : profile.length-1][1];
      const [za,ya]=profile[i-1], [zb,yb]=profile[i];
      return ya+(yb-ya)*(z-za)/(zb-za);
    };
    const [a,b] = roofX;
    for (let i=0; i<profile.length-1; i++) {
      const [z0,y0]=profile[i], [z1,y1]=profile[i+1];
      mesh.face([[a,y0,z0],[a,y1,z1],[b,y1,z1],[b,y0,z0]],state.tile);
      mesh.face([[b,y0-.14,z0],[b,y1-.14,z1],[a,y1-.14,z1],[a,y0-.14,z0]],"70563f");
      for (const x of [a,b]) mesh.beam([x,y0-.052,z0],[x,y1-.052,z1],.119,.144,"4e605e");
    }
    for (let column=0; column<44; column++) {
      const x=a+.108+column*(b-a-.216)/43;
      const width=.105;
      for (const [ridge,eave] of [[-2.35,.56],[-2.35,-4.62]]) {
        const direction=Math.sign(eave-ridge);
        const rows=Math.round(Math.abs(eave-ridge)/.21);
        for (let row=0; row<rows; row++) {
          const step=(eave-ridge)/rows;
          const z0=ridge+step*row, z1=ridge+step*(row+1);
          const y0=roofHeight(z0), y1=roofHeight(z1);
          const snowLine = .48 + .20*Math.sin(column*.25+direction) + .10*Math.cos(column*.67);
          const covered = term === "winter" && (row+.45)/rows < snowLine;
          const tone = covered ? "dfe9e9" : tileTones[Math.floor(variation(column*7+direction)*tileTones.length)];
          const glaze = covered ? "eaf0ec" : row%5===3 && variation(column+row*3)>.63 ? "64777b" : state.tile;
          const lip = covered ? ["b9ccd0","c1d2d4"] : ["4e5c5c","465658"];
          const edges=[
            [[x-width,y0+.013,z0],[x-width,y1+.020,z1],[x,y1+.070,z1],[x,y0+.057,z0]],
            [[x,y0+.057,z0],[x,y1+.070,z1],[x+width,y1+.020,z1],[x+width,y0+.013,z0]]
          ];
          for (const [i,face] of edges.entries()) mesh.face(direction>0 ? face : face.reverse(),i===0 ? tone : glaze);
          const edge=.017*(row===rows-1 ? 2.4 : 1);
          mesh.face([[x-width,y1+.013-edge,z1+direction*.005],[x,y1+.063-edge,z1+direction*.005],[x,y1+.063,z1],[x-width,y1+.013,z1]],lip[0]);
          mesh.face([[x,y1+.063-edge,z1+direction*.005],[x+width,y1+.013-edge,z1+direction*.005],[x+width,y1+.013,z1],[x,y1+.063,z1]],lip[1]);
        }
      }
    }
    for (const [z,y] of [profile[0],profile.at(-1)]) mesh.beam([a,y-.084,z],[b,y-.084,z],.145,.12,"53615c");
    mesh.beam([a-.025,4.285,cz],[b+.025,4.285,cz],.155,.174,"4a5d5f");
    for (let section=0;section<12;section++) {
      const x0=a+section*(b-a)/12, x1=a+(section+1)*(b-a)/12;
      const tone = term==="winter" ? "e4ece9" : section%3 ? "556970" : "617275";
      mesh.beam([x0+.023,4.37,cz],[x1-.023,4.37,cz],.14,.099,tone);
    }
    for (const x of [a+.11,b-.11]) {
      mesh.beam([x-.075,4.28,cz],[x+.075,4.28,cz],.20,.218,"73847c");
    }
    for (let i=0; i<23; i++) {
      const x=a+.23+i*.40;
      mesh.beam([x,roofHeight(.24)-.17,.24],[x,roofHeight(.54)-.16,.54],.080,.078,"9a6e4b");
    }

    mesh.revolved(5.40,.54,[[.24,.29],[.33,.37],[.72,.42],[.92,.36],[1.01,.34],[1.025,.28]],["805c45","9f795d","976c4e","725341"]);
    mesh.revolved(5.40,.54,[[1.026,.27],[1.029,.265]],[state.water],16);
    mesh.box(6.04,.40,.76,.59,.30,.25,"9c7b58","84654a");
    mesh.beam([6.2,.39,.25],[6.07,1.26,-.41],.07,.07,"a2825a");
    mesh.box(-1.13,.46,.45,.82,.11,.35,"ac8a62","85694d");
    for (const x of [-1.42,-.84]) mesh.box(x,.34,.45,.12,.21,.23,"88664a");
    mesh.revolved(4.53,.31,[[.24,.16],[.29,.21],[.64,.26],[.69,.25]],["92724f","b49160","977b53"],10);
    for (const y of [.31,.54]) mesh.revolved(4.53,.31,[[y,.225],[y+.044,.228]],[ "745d44"],10);
    mesh.revolved(6.26,.88,[[.24,.23],[.31,.27],[.37,.26],[.39,.21]],["a58858","bda270","95805e"],12);

    // A small bamboo drying rack and a woven tray make the porch feel occupied.
    const trayX=.58, trayY=.85, trayZ=.28, trayR=.39;
    const at=(x,y)=>[trayX+x,trayY+y,trayZ-y*.30];
    const rim=Array.from({length:16},(_,i)=>{
      const angle=i*Math.PI/8;
      return at(trayR*Math.cos(angle),trayR*Math.sin(angle));
    });
    mesh.face(rim,"b68a55");
    for (let i=0;i<rim.length;i++) mesh.beam(rim[i],rim[(i+1)%rim.length],.031,.025,"8f623e");
    for (let i=-4;i<=4;i++) {
      const y=i*.075, x=Math.sqrt(trayR*trayR-y*y)-.022;
      const left=at(-x,y), right=at(x,y);
      mesh.beam([left[0],left[1],left[2]+.019],[right[0],right[1],right[2]+.019],.013,.012,i%2 ? "c7a16d" : "92704a");
    }
    for (const x of [3.61,4.21]) {
      mesh.beam([x,.24,.46],[x,.72,.33],.045,.045,"8c6a42");
      mesh.beam([x,.24,.21],[x,.72,.33],.039,.039,"a57f4e");
    }
    for (let i=0;i<5;i++) mesh.beam([3.55,.72,.25+i*.032],[4.27,.72,.25+i*.032],.027,.022,"aa8350");
    for (const x of [1.10,3.42]) {
      mesh.beam([x,2.53,.19],[x,2.01,.26],.017,.020,"7b5339");
      mesh.revolved(x,.26,[[1.82,.035],[1.85,.088],[1.94,.092],[2.04,.052]],["894e38","ad6949","89513c"],8);
    }
  }

  function blade(mesh, x, z, height, bend, tone) {
    const y = .282;
    const stem = [x,y,z], tip = [x+bend,y+height,z+.10];
    const center = [x+bend*.31,y+height*.45,z+.034];
    const width = height * .077;
    mesh.face([stem,[center[0]+width,center[1],center[2]],tip,[center[0]-width,center[1],center[2]]],tone);
    mesh.face([stem,[center[0],center[1],center[2]+width],tip,[center[0],center[1],center[2]-width]],tone);
  }

  function field(mesh, term, state) {
    const {left,right,near,far} = plot;
    const x = (left+right)/2, z = (near+far)/2, width = right-left, depth = far-near;
    const wet = term === "grain", tall = term === "dew";
    const soil = {rain:"7f6853",grain:"918269",dew:"90816a",winter:"938278"}[term];
    const soilHeight=wet ? .259 : .2745;
    mesh.box(x,(.24+soilHeight)/2,z,width,soilHeight-.24,depth,soil);
    if (term === "rain") {
      for (const [px,pz,radius] of rainPools) {
        const edge = Array.from({length:16}, (_, i) => {
          const angle = -i * Math.PI / 8;
          const reach = radius * (.88 + variation(i+10) * .23);
          return [px + Math.cos(angle) * reach,.281,pz + Math.sin(angle) * reach * .70];
        });
        mesh.face(edge,"849c96");
      }
    }
    for (const edge of [near,far]) {
      mesh.box(x,.293,edge,width+.32,.137,.29,state.grass,"8b7454");
      for (let i=0; i<18; i++) {
        const px=left+i*width/17;
        mesh.canopy(px,.363,edge+Math.sin(i*2.9)*.105,.105+variation(i)*.18,i%3 ? state.second : "968462",.39);
      }
    }
    for (const edge of [left,right]) {
      const hasOutlet=tall && edge===left;
      const sections=hasOutlet ? [[near,outletZ-.24],[outletZ+.24,far]] : [[near,far]];
      for (const [start,end] of sections) {
        mesh.box(edge,.293,(start+end)/2,.33,.137,end-start,state.grass,"8b7454");
      }
      for (let i=0; i<14; i++) {
        const pz=near+i*depth/13;
        if (hasOutlet && Math.abs(pz-outletZ)<.48) continue;
        mesh.canopy(edge+Math.sin(i*2.1)*.08,.356,pz,.11+variation(i+20)*.16,i%4 ? state.grass : state.path,.49);
      }
    }

    const plantRows = 18;
    for (let row=0; row<8; row++) {
      const px=left+.52+row*(width-1.04)/7;
      if (!wet && !tall) {
        mesh.box(px,.279,z,.075,.018,depth-.67,term==="rain" ? "a68a67" : "b19a74");
      }
      if (wet) {
        for (let section=0;section<5;section++) {
          const start=near+.27+section*(depth-.54)/5;
          const ridgeZ=start+.70+variation(row+section*8)*.39;
          mesh.box(px-.12,.263,ridgeZ,.23,.014,.97+variation(section+row*3)*.86,
            section%2 ? "a59878" : "7b705f");
        }
      }
      for (let i=0; i<plantRows; i++) {
        const pz=near+.43+i*(depth-.84)/(plantRows-1)+variation(i+row*19)*.12;
        const dx=px-gnomon.x, dz=pz-gnomon.z;
        if (dx*.8+dz*.6>=-.35 && dx*.8+dz*.6<=1.95 && Math.abs(-dx*.6+dz*.8)<.40) continue;
        if ((wet && (i>12 && row<4)) || (tall && row===0 && Math.abs(pz-outletZ)<.43) || term==="rain") continue;
        const seed=row*41+i, height=tall ? .69 : wet ? .35 : .12;
        const stemX=px+variation(seed)*.13-.065;
        const tones=tall ? ["8f835b","aa996f","c3a67c"] : wet ? ["597742","72944e","94a958"] : ["ab8d62","bfa173","9b7e5b"];
        for (let b=-2; b<=2; b++) {
          const length=height*(.72+variation(seed+b)*.32);
          blade(mesh,stemX+b*.026,pz+(b%2)*.077,length,b*height*.20,tones[(b+seed+8)%3]);
        }
        if (tall && i%3!==1) mesh.beam([stemX,.70,pz],[stemX+.17,.92,pz+.05],.040,.032,"c5ad85");
        if (wet && (row+i)%3===0) {
          mesh.box(stemX+.24,.263,pz+.22,.28+variation(seed)*.26,.004,.028,"a99a7c");
        }
      }
    }

    const paving=term==="winter" ? ["899595","99a19d","828e8e","929b99"] :
      ["c1b495","cbbd9e","b1a389","bbb099"];
    // A small courtyard separates the doorway from the head of the field.
    mesh.box(x,.249,1.49,width+.37,.021,1.96,state.path,"a99b7e");
    for (let i=0; i<15; i++) {
      const px=left+.10+i*(width+.07)/14, pz=.8+Math.sin(i*.62)*.067;
      stone(mesh,px,.276,pz,.55,.064,.35+variation(i)*.16,paving[i%4],"9a8b71");
    }
    for (let i=0; i<22; i++) {
      const pz=near+.29+i*(depth-.26)/22;
      stone(mesh,right+.52+Math.sin(i*.51)*.049,.272,pz,.43+variation(i)*.13,.057,.44,paving[(i+1)%4],"9a8b71");
    }
    mesh.box(left-.37,.262,2.59,.29,.036,1.12,wet ? "829f91" : "8c8d74");
    stone(mesh,left-.37,.307,2.07,.43,.12,.23,"b6a586","8b7d64");
  }

  function plantsAndTools(mesh, term, state) {
    const stones=["aa9e86","908770","bbb098","988e79"];
    for (let i=0; i<24; i++) {
      const seed=i*13+74;
      const z=plot.near-.18+variation(seed+5)*(plot.far-plot.near+.37);
      const x=i%2 ? footprint.left+.24+variation(seed)*.37 : footprint.right-.25-variation(seed)*.28;
      const size=.07+variation(seed+9)*.16;
      mesh.canopy(x,.255+size*.08,z,size,i%5===0 ? stones[i%4] : state.grass,.48);
      if (i%4===0) mesh.canopy(x+.09,.26,z+.17,size*.68,state.second,.48);
    }

    for (let i=0;i<20;i++) {
      const x=i<12 ? plot.left-.55+variation(i+537)*.26 : plot.right+.93+variation(i+619)*.15;
      const z=plot.near+.27+variation(i+29)*(plot.far-plot.near-.6);
      if (term==="winter") {
        for (let k=0;k<3;k++) blade(mesh,x+k*.027,z,.10+variation(i+k+85)*.11,(k-1)*.062,"b8a379");
      } else {
        for (let k=0;k<4;k++) {
          const height=.16+variation(i+k+85)*.24, bend=(k-1.5)*.09;
          blade(mesh,x+k*.027,z,height,bend,k%2 ? state.grass : state.second);
        }
      }
    }

    for (let i=0; i<6; i++) {
      const row=i<4 ? 0 : 1, x=-1.45+(i%4)*.18+row*.1;
      mesh.beam([x,.35+row*.14,.80],[x,.35+row*.14,1.18],.145,.154,"9a7552");
      mesh.box(x,.35+row*.14,1.19,.11,.10,.022,"bd9766");
    }
    mesh.revolved(-.38,1.43,[[.26,.25],[.49,.24],[.51,.23]],["8b6545","b39069"],10);

    if (term==="dew") {
      for (let i=0; i<14; i++) {
        const x=3.7+variation(i+14)*1.52, z=1.42+variation(i+52)*.69;
        mesh.face([[x-.06,.267,z],[x+.07,.267,z-.08],[x+.13,.267,z+.07]],i%2 ? "bd8350" : "a96f45");
      }
    }
    if (term==="grain") {
      for (let i=0; i<14; i++) {
        const angle=i*2.40, x=-.92+Math.cos(angle)*.12, z=10.42+Math.sin(angle)*.13;
        mesh.beam([x,.31,z],[x+Math.cos(angle)*.11,.77+(i%3)*.035,z+Math.sin(angle)*.13],.035,.026,i%2 ? "a2b868" : "6f944c");
      }
      mesh.revolved(-.92,10.42,[[.40,.14],[.445,.14]],["b59655"],10);
    }
  }

  const sunHeading = [-.8,-.6];
  const shadeOpacity = {rain:.55,grain:.82,dew:.86,winter:.64};
  const hazeColor = {rain:"b6cdb5",grain:"c9d8b5",dew:"c0c5c7",winter:"c4d2df"};
  const gnomon = {x:5.08,z:13.35,base:.323,height:1.16};

  function sundialStand(mesh) {
    const {x,z,base,height}=gnomon;
    const point=(along,across,y)=>[x+along*.8-across*.6,y,z+along*.6+across*.8];
    const slab=(start,end,width,y,tone)=>{
      mesh.face([point(start,-width,y),point(start,width,y),point(end,width,y),point(end,-width,y)],tone);
    };
    slab(-.20,1.91,.25,base-.011,"988a71");
    slab(-.17,1.88,.214,base,"d9c9a9");
    for (const side of [-.25,.25]) {
      mesh.face([point(-.20,side,.275),point(1.91,side,.275),
        point(1.91,side,base-.011),point(-.20,side,base-.011)],"91826c");
    }
    slab(.13,1.78,.012,base+.003,"a89574");
    for (let i=1;i<=6;i++) {
      const place=i*height/4;
      slab(place-.013,place+.013,i%4===0 ? .18 : .102,base+.004,
        i%4===0 ? "78674c" : "b3a07f");
    }
    mesh.box(x,base+.019,z,.19,.038,.19,"a89b81","88785d");
    mesh.beam([x,base+.038,z],[x,base+height,z],.106,.106,"80613f");
  }

  function chrysanthemum(mesh, x, base, z, scale, seed) {
    for (let i=0;i<13;i++) {
      const angle=i*2.4, reach=(i===0 ? 0 : .18+variation(seed+i)*.42)*scale;
      const dx=Math.cos(angle)*reach, dz=Math.sin(angle)*reach;
      const height=(.52+variation(seed+i*3)*.36)*scale;
      const stem=[x+dx,base+height,z+dz];
      mesh.beam([x+dx*.24,base,z+dz*.24],stem,.024*scale,.025*scale,"687548");
      for (const side of [-1,1]) {
        const y=base+height*(side>0 ? .61 : .43);
        leaf(mesh,x+dx*.66+side*.094*scale,y,z+dz*.66,.143*scale,angle+side*.9,.38,
          side>0 ? "6f8152" : "566b45");
      }
      const radius=(.12+variation(seed+i*11)*.048)*scale;
      for (const [count,spread,lift,tone] of [[12,1,.037,"ebb94e"],[9,.72,.074,"ffdc66"]]) {
        for (let j=0;j<count;j++) {
          const theta=j*2*Math.PI/count+angle;
          const at=(distance,side,y)=>[stem[0]+Math.cos(theta)*distance-Math.sin(theta)*side,
            stem[1]+y*scale,stem[2]+Math.sin(theta)*distance+Math.cos(theta)*side];
          const edge=radius*spread;
          mesh.face([at(edge*.12,0,0),at(edge*.74,edge*.16,lift*.6),
            at(edge,0,lift),at(edge*.74,-edge*.15,lift*.53)],tone);
        }
      }
      mesh.canopy(stem[0],stem[1]+.051*scale,stem[2],radius*.25,"c98a31",.62);
    }
  }

  function seasonalDetails(mesh, term) {
    if (term === "rain") {
      // A shallow channel crosses the bank beside the willow.
      mesh.box(-2.38,.245,3.44,.37,.015,2.57,"687b75");
      for (const side of [-1,1]) {
        mesh.box(-2.38+side*.25,.28,3.47,.14,.073,2.65,"857660");
      }
      mesh.beam([-2.62,.322,2.7],[-2.12,.322,2.7],.12,.085,"b29a76");
      return;
    }
    if (term === "grain") {
      const x=-2.27, z=10.60;
      mesh.revolved(x,z,[[.26,.34],[.33,.44],[.41,.46],[.45,.42]],
        ["917451","ba985f","9b7447"],12);
      for (let i=0;i<17;i++) {
        const angle=i*2.4, reach=.32*Math.sqrt(variation(i+42));
        blade(mesh,x+Math.cos(angle)*reach,z+Math.sin(angle)*reach,
          .27+variation(i+19)*.23,(variation(i+51)-.5)*.25,i%2 ? "8ca855" : "5a8448");
      }
      return;
    }
    if (term === "dew") {
      // A break in the field bank connects the drained paddy to the side ditch.
      mesh.box(plot.left-.11,.279,outletZ,.99,.012,.27,"6f6754");
      mesh.box(plot.left-.62,.253,outletZ-.24,.29,.023,1.53,"706e5f");
      for (const offset of [-.21,.21]) {
        mesh.box(plot.left-.08,.40,outletZ+offset,.084,.30,.085,"8a6949");
      }
      mesh.box(plot.left-.08,.49,outletZ,.073,.11,.36,"ac8960");
      for (const [x,z,scale,seed] of [[-.02,1.68,.93,21],[1.10,1.67,1.05,34],[7.22,4.68,.79,76]]) {
        mesh.revolved(x,z,[[.245,.27*scale],[.30,.33*scale],[.58,.40*scale],[.61,.42*scale],[.63,.37*scale]],
          ["9a5e45","b77b57","ca8b65","925637"],12);
        mesh.revolved(x,z,[[.614,.37*scale],[.618,.37*scale]],["6b5741"],12);
        chrysanthemum(mesh,x,.62,z,scale,seed);
      }
      for (const {x,z,lean} of yardTrees) {
        for (let i=0;i<22;i++) {
          const angle=i*2.4, spread=.28+variation(i+23)*1.16;
          const px=around(footprint.left+.14,footprint.right-.14,x+lean*.32+Math.cos(angle)*spread*.71);
          const pz=z+Math.sin(angle)*spread;
          leaf(mesh,px,.282+variation(i)*.014,pz,.073+variation(i+5)*.075,angle,.28,autumnLeaves[i%4]);
        }
      }
      chrysanthemum(mesh,-2.36,.25,12.26,.94,91);
      chrysanthemum(mesh,-2.42,.25,13.41,.81,53);
      return;
    }
    const mildGreen = ["5e7653","789063","819965","97a16b"];
    mesh.box(-2.24,.268,10.29,.73,.058,4.29,"827864","726953");
    for (let i=0;i<16;i++) {
      const x=-2.40+(i%2)*.34, z=8.54+Math.floor(i/2)*.50;
      for (let j=0;j<5;j++) {
        const angle=j*2.4+i;
        leaf(mesh,x+Math.cos(angle)*.10,.336,z+Math.sin(angle)*.10,.12,angle,.48,mildGreen[j%4]);
      }
    }
    for (let i=0;i<21;i++) {
      const x=i%2 ? plot.left-.43+variation(i+16)*.32 : plot.right+.72+variation(i+16)*.44;
      const z=plot.near+.31+variation(i+68)*(plot.far-plot.near-.49);
      mesh.canopy(x,.271,z,.15+variation(i+77)*.27,"dbe7e5",.12);
    }
    for (let i=0;i<16;i++) {
      const x=plot.left+.02+variation(i+18)*(plot.right-plot.left-.05);
      const z=i%2 ? plot.far-.10 : plot.near+.09;
      mesh.canopy(x,.370,z,.20+variation(i+44)*.29,"e4edeb",.12);
    }
    for (const [x,z,spread] of [[-.60,4.1,.84],[3.95,4.45,.60],[1.76,7.0,.77],
      [5.1,8.6,.84],[-.68,9.2,.54],[3.2,10.8,.64],[.35,12.6,.89]]) {
      for (let i=0;i<4;i++) {
        const angle=i*2.4, width=spread*(.44+variation(i+z)*.38);
        const cx=x+Math.cos(angle)*spread*.44, cz=z+Math.sin(angle)*spread*.55;
        const edge=Array.from({length:10},(_,j)=>{
          const theta=-j*Math.PI/5, reach=width*(.78+variation(i*13+j+z)*.35);
          return [cx+Math.cos(theta)*reach,.287+i*.001,cz+Math.sin(theta)*reach*.66];
        });
        mesh.face(edge,i%3 ? "e3ebe8" : "cddbdc");
      }
    }
    mesh.revolved(.84,.97,[[.255,.23],[.33,.32],[.57,.30],[.62,.24]],
      ["9e775b","a77a59","694f45"],10);
    mesh.revolved(.84,.97,[[.62,.16],[.68,.235],[.80,.21],[.858,.16],[.86,.045]],
      ["4a514f","626661","535957","4e4a42"],12);
    mesh.canopy(.84,.884,.97,.045,"715348",.65);
  }

  function bambooFence(mesh, startX, endX, z) {
    const sections=Math.round((endX-startX)/.82);
    const pitch=(endX-startX)/sections;
    for (let i=0;i<=sections;i++) {
      const x=startX+i*pitch;
      mesh.box(x,.51,z,.105,.53,.108,"ad9062","856a4c");
      mesh.box(x,.78,z,.14,.065,.143,"a98a60","745a42");
      if (i===sections) break;
      for (let j=1;j<=3;j++) {
        const height=.36+variation(i*4+j)*.08;
        const slatX=x+pitch*j/4;
        mesh.box(slatX,.26+height/2,z+.009,.048,height,.056,"c3a46c",j%2 ? "a98b5d" : "b99a65");
      }
    }
    for (const y of [.38,.58]) {
      mesh.beam([startX,y,z-.027],[endX,y,z-.027],.049,.060,"9e8155");
    }
  }

  function waterWell(mesh) {
    const x=-2.37, z=6.96;
    const point=(radius,y,angle)=>[x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius];
    mesh.revolved(x,z,[[.24,.42],[.30,.44],[.34,.39]],["969181","aaa28c"],12);
    mesh.revolved(x,z,[[.435,.29],[.441,.294]],["758e87"],12);
    for (let tier=0;tier<2;tier++) {
      const base=.33+tier*.194, top=base+.183;
      for (let side=0;side<12;side++) {
        const a=(side+.5*tier)*Math.PI/6+.017, b=a+Math.PI/6-.034;
        const stoneTone=["aaa490","989483","bcb29a"][Math.floor(variation(side+tier*9)*3)];
        const rim=tier ? .43 : .40;
        mesh.face([point(rim,base,a),point(rim,top,a),point(rim,top,b),point(rim,base,b)],stoneTone);
        mesh.face([point(rim,top,a),point(.28,top,a),point(.28,top,b),point(rim,top,b)],stoneTone);
        mesh.face([point(.28,base,b),point(.28,top,b),point(.28,top,a),point(.28,base,a)],"7c7a6c");
      }
    }
    const bucketX=-2.48, bucketZ=6.25;
    mesh.revolved(bucketX,bucketZ,[[.248,.139],[.289,.163],[.583,.195],[.608,.196],[.612,.166]],
      ["906a46","a77d50","b28a57","806347"],10);
    for (const [y,radius] of [[.32,.169],[.538,.192]]) {
      mesh.revolved(bucketX,bucketZ,[[y,radius],[y+.023,radius+.002]],["69594a"],10);
    }
    mesh.revolved(bucketX,bucketZ,[[.526,.161],[.529,.162]],["756547"],10);
    for (let i=0;i<8;i++) {
      const at=angle=>[bucketX+Math.cos(angle)*.173,.59+Math.sin(angle)*.16,bucketZ];
      mesh.beam(at(i*Math.PI/8),at((i+1)*Math.PI/8),.016,.016,"685744");
    }
  }

  function porchSupplies(mesh, term) {
    // Drying pole and folded cloths are placed clear of the doorway.
    const z=1.02, startX=5.93, endX=7.46;
    for (const x of [startX,endX]) {
      stone(mesh,x,.272,z,.30,.082,.29,"b0a58d","95896f");
      mesh.beam([x,.30,z],[x,1.59,z],.095,.085,"a88955");
      mesh.beam([x,.34,z],[x,.58,z-.24],.066,.062,"927345");
    }
    mesh.beam([startX-.07,1.52,z],[endX+.07,1.52,z],.061,.062,"be9e63");
    if (term!=="rain") {
      for (const [x,width,length,shade,hem] of [
        [6.31,.46,.57,"b27d60","dec49d"],[6.98,.51,.46,"708995","b6c7c2"]
      ]) {
        for (let i=0;i<6;i++) {
          const left=x+(i/6-.5)*width, right=left+width/6;
          const fold=i%2 ? .036 : .015;
          const y=1.52-length+Math.sin(i*Math.PI/6)*.046;
          mesh.face([[left,1.53,z],[left,y,z+fold],[right,y,z+fold],[right,1.53,z]],shade);
          mesh.face([[left,y+.042,z+fold+.008],[left,y,z+fold+.008],
            [right,y,z+fold+.008],[right,y+.042,z+fold+.008]],hem);
        }
      }
    }
    const crockX=3.85, crockZ=.99;
    mesh.revolved(crockX,crockZ,[[.248,.21],[.30,.26],[.62,.29],[.74,.22],[.76,.18]],
      ["7a5843","996c50","76523e","604536"],12);
    mesh.revolved(crockX,crockZ,[[.759,.21],[.797,.22],[.822,.14],[.835,.064]],["b39568","c3ab7b"],12);
    mesh.revolved(crockX,crockZ,[[.837,.052],[.90,.048]],["8b704e"],8);
    const stoolX=4.43, stoolZ=1.30;
    for (const dx of [-.19,.19]) {
      for (const dz of [-.103,.103]) {
        mesh.beam([stoolX+dx*1.16,.255,stoolZ+dz*1.14],[stoolX+dx,.53,stoolZ+dz],.063,.062,"816045");
      }
    }
    mesh.box(stoolX,.554,stoolZ,.55,.075,.30,"ba9667","98734e");
    mesh.revolved(stoolX,stoolZ,[[.591,.072],[.628,.059],[.677,.087],[.683,.085]],
      ["ad855a","d1bea0","83978c"],10);
    for (let i=0;i<3;i++) {
      const z=-1.06-i*.36, y=.86+i*.10;
      mesh.beam([-2.10,.27,z+.22],[-2.02,y+.38,z],.052,.052,"977653");
      mesh.beam([-2.02,y+.36,z],[-2.02,y+.36,z-.125],.064,.068,i%2 ? "807e6c" : "5a6460");
    }
    if (term==="rain") {
      // Put things that need to stay dry against the wall.
      mesh.box(3.57,.753,.35,.30,.08,.22,"788f95","657d82");
      mesh.box(3.83,.803,.35,.26,.045,.19,"b78f75","9b745a");
    }
  }

  function driftingLeaves(mesh, time) {
    for (const [treeIndex,tree] of yardTrees.entries()) {
      const {x,z,kind,lean,scale} = tree;
      for (let i=0;i<8;i++) {
        const seed=i+treeIndex*9;
        const phase=(time*(.19+variation(seed+39)*.10)+variation(seed+65))%1;
        const tip=branches[kind][i%5][2];
        const flutter=time*4.4+seed*2;
        const fallX=x+(tip[0]*lean*.78+Math.sin(flutter)*.28)*scale-phase*(3.8+variation(seed)*1.9);
        const fallZ=z+tip[2]*scale+phase*2.25+Math.cos(flutter)*.28;
        const fallY=.31+(1-Math.pow(phase,1.65))*tip[1]*scale*.99;
        leaf(mesh,fallX,fallY,fallZ,.11+variation(seed+31)*.063,flutter*.56,flutter,autumnLeaves[i%4]);
      }
    }
  }

  function dragonflies(mesh, time) {
    for (let i=0;i<2;i++) {
      const turn=time*(.89+i*.23)+i*2.4;
      const x=2.5+Math.cos(turn)*(1.34+i*.40), z=7.5+Math.sin(turn)*(1.44+i*.7);
      const y=.72+Math.sin(turn*2)*.21+i*.17;
      const angle=Math.atan2(Math.cos(turn),-Math.sin(turn));
      const at=(a,b,c) => [x+a*Math.cos(angle)-c*Math.sin(angle),y+b,z+a*Math.sin(angle)+c*Math.cos(angle)];
      mesh.beam(at(-.12,0,0),at(.13,0,0),.033,.035,i ? "546955" : "4e8181");
      const flap=Math.cos(time*51+i)*.095;
      for (const side of [-1,1]) {
        mesh.face([at(.055,0,0),at(.123,flap,side*.174),at(.045,flap*.84,side*.205),at(.005,0,0)],"b5d4c7");
        mesh.face([at(.015,0,0),at(-.02,flap*.72,side*.172),at(-.091,flap*.66,side*.149),at(-.028,0,0)],"ceddd0");
      }
    }
  }

  function kettleSteam(mesh, time) {
    for (let i=0;i<7;i++) {
      const phase=(time*.42+i/7)%1;
      const x=.84+phase*.48+Math.sin(time*1.65+i)*phase*.12;
      const y=.895+phase*1.42, z=.97+phase*.39;
      const w=.043+phase*.078;
      const pigment=["c8ccc0","d4d8cd","dce1d8"][Math.min(2,Math.floor(phase*3))];
      mesh.canopy(x,y,z,w,pigment,.55);
    }
  }

  function rainStreak(mesh, x, y, z, width, length, tone) {
    const tip=[x,y+length,z], end=[x,y,z];
    mesh.face([tip,[x-width,y+length*.16,z],end,[x+width,y+length*.16,z]],tone);
    mesh.face([tip,[x,y+length*.16,z-width],end,[x,y+length*.16,z+width]],tone);
  }

  function snowfall(mesh, time) {
    const {left,right,back,front} = footprint;
    for (let i=0;i<108;i++) {
      const phase=(time*(.12+variation(i+181)*.105)+variation(i+16))%1;
      const x=left-.55+variation(i+231)*(right-left+1.1)+Math.sin(phase*6+i)*.38+phase*.67;
      const z=back+.26+variation(i+376)*(front-back-.52);
      const y=.297+(1-phase)*5.8;
      const size=(.060+variation(i+560)*.081)*Math.min(1,(1-phase)*12);
      const tone=i%3 ? "f5f9f8" : "eff4f7";
      const spokes=i%4===0 ? 6 : 4;
      for (let j=0;j<spokes;j++) {
        const theta=j*2*Math.PI/spokes+time*.63+i;
        const at=(angle,radius)=>[x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,z+Math.cos(angle)*radius*.5];
        mesh.face([at(theta-.52,size*.25),at(theta,size),at(theta+.52,size*.25),[x,y,z]],tone);
      }
      mesh.face([[x-size*.38,y,z],[x,y,z-size*.38],[x+size*.38,y,z],[x,y,z+size*.38]],tone);
    }
  }

  function chickens(mesh, term, time) {
    const positions = term==="rain" ? [[.26,.45],[.98,.65]] : [[7.56,10.47],[7.28,11.38]];
    for (const [i,[x,z]] of positions.entries()) {
      const nod = (1-Math.cos(time*4.7+i*2.35))/2;
      const heading=i ? 2.21 : -.74;
      const at=(a,b,c)=>[x+a*Math.cos(heading)-c*Math.sin(heading),.25+b,z+a*Math.sin(heading)+c*Math.cos(heading)];
      const plumage=i ? "cfab7e" : "e2dabe";
      for (const spread of [-.052,.052]) {
        mesh.beam(at(0,.035,spread),at(-.016,.137,spread),.019,.018,"ab7c46");
        mesh.beam(at(-.024,.025,spread),at(.063,.025,spread),.016,.017,"ab7c46");
        mesh.beam(at(-.092,.165,spread),at(-.241,.262,spread*.63),.077,.056,i ? "8b684b" : "b2a998");
      }
      mesh.canopy(...at(-.033,.188,0),.164,plumage,.91);
      const head=at(.104+nod*.081,.314-nod*.19,0);
      mesh.beam(at(.066,.181,0),head,.107,.11,plumage);
      mesh.canopy(...head,.084,plumage,.92);
      const beak=at(.208+nod*.07,.299-nod*.208,0);
      mesh.beam(head,beak,.036,.038,"cc924e");
      mesh.canopy(head[0],head[1]+.065,head[2],.039,"b65f46",1.1);
    }
  }

  function waterRings(mesh, x, z, height, radius, width, tint) {
    for (let i=0;i<12;i++) {
      const a=i*Math.PI/6, b=(i+1)*Math.PI/6;
      const point=(angle,r)=>[x+Math.cos(angle)*r,height,z+Math.sin(angle)*r*.70];
      mesh.face([point(b,radius-width),point(a,radius-width),point(a,radius),point(b,radius)],tint);
    }
  }

  function farmer(mesh, term, time) {
    const clothes = {rain:"5b7f8e",grain:"758d91",dew:"a1815b",winter:"7d7d86"}[term];
    const group = {
      rain: [-2.79,.24,4.14,1.49],
      grain: [.65,.27,10.58,-.52],
      dew: [4.05,.25,1.34,.45],
      winter: [-1.10,.25,1.50,1.53]
    };
    const [x,y,z,angle] = group[term];
    const wave = (1 - Math.cos(time * (term === "winter" ? 3.7 : 4.35))) / 2;
    const lean = term === "grain" ? .34 + wave * .17 : .065 + wave * .09;
    const f = (a,b,c) => [x + a*Math.cos(angle) + c*Math.sin(angle), y + b, z - a*Math.sin(angle) + c*Math.cos(angle)];
    const piece = (a,b,w,d,c) => mesh.beam(f(...a),f(...b),w,d,c);
    const trousers = "6c6354", skin = "ca9e6d", straw = "b89557";
    for (const side of [-1,1]) {
      const off = side * .13;
      piece([off,.07,.09 + off *.31],[off,.39,0],.15,.15,trousers);
      piece([off,.075,.02],[off,.075,.20],.14,.11,"514b40");
    }
    piece([0,.38,0],[0,.76 - lean * .19,lean],.32,.23,clothes);
    const shoulderY = .69 - lean * .20;
    const head = f(0,shoulderY + .23,lean + .105);
    mesh.canopy(...head,.168,skin,1.08);
    for (const x of [-.069,.069]) {
      const eye=f(x,shoulderY+.219,lean+.252);
      mesh.canopy(...eye,.022,"4b3b32",1.09);
    }
    mesh.canopy(...f(.001,shoulderY+.184,lean+.263),.032,skin,.87);
    mesh.canopy(...f(0,shoulderY+.249,lean+.035),.153,"584333",.79);
    piece([-.145,.48,lean*.48],[.15,.49,lean*.49],.07,.055,"82674d");
    mesh.revolved(head[0],head[2],[[head[1]+.065,.26],[head[1]+.095,.26],[head[1]+.23,.105],[head[1]+.24,.038]],[straw,"d1af68","c0a060"],12);
    const arm = term === "grain" ? [.16,.24 - wave * .12,lean+.32] : term === "winter"
      ? [.18,.70 + wave * .42,.43 - wave * .15] : [.18,.40,lean + .34 + wave * .17];
    piece([.16,shoulderY,lean],arm,.103,.093,clothes);
    piece(arm,[arm[0],arm[1] - .08,arm[2] + .03],.075,.073,skin);
    piece([-.16,shoulderY,lean],[-.15,.43,lean+.22],.103,.093,clothes);
    piece([-.15,.43,lean+.22],[-.10,.43,lean+.31],.072,.072,skin);
    if (term === "grain") {
      piece([-.09,.38,lean+.31],[-.15,.55,lean+.31],.12,.11,"73904e");
      piece([arm[0],arm[1] - .08,arm[2]+.02],[arm[0],Math.max(.02,arm[1] - .23),arm[2]+.11],.033,.034,"91ad58");
    } else if (term === "winter") {
      const headHeight = .32 + wave * 1.01, headZ = .72 - wave * .34;
      piece([arm[0],arm[1] - .07,arm[2]],[.16,headHeight,headZ],.055,.055,"9a744d");
      piece([.08,headHeight,headZ],[.23,headHeight,headZ],.13,.073,"5d686a");
    } else {
      const tip = [.25 + (wave-.5)*.44,.06,lean+.64+wave*.13];
      piece([-.08,.46,lean+.15],tip,.045,.046,"96734d");
      piece([tip[0]-.12,.07,tip[2]],[tip[0]+.11,.07,tip[2] + .03],.13,.033,term === "dew" ? "b69b65" : "666863");
      if (term === "dew") {
        for (let i = 0; i < 4; i++) {
          const p = f(tip[0] + i * .083, .025 + wave * (.04 + .01*i),tip[2] + .09 * i);
          mesh.face([p,[p[0]+.11,p[1],p[2]+.04],[p[0]+.054,p[1]+.025,p[2]+.099]],"b67b4b");
        }
      }
    }
  }

  const framingPoints = [
    ...[footprint.left,footprint.right].flatMap(x => [footprint.back,footprint.front].flatMap(z => [[x,-.87,z],[x,.24,z]])),
    ...[-2.37,6.99].flatMap(x => [[x,2.64,-4.62],[x,4.36,-2.35],[x,2.6,.56]]),
    [-5,3.6,2.1],[-3.1,4.7,1.1],[8,5.69,-1.2],[10.4,4.72,-1.4],[8.82,2.45,8.5]
  ];
  const homeView = {yaw:-.53,pitch:.62,pivot:[2.44,1.11,4.98],verticalSpan:9.53};
  const orbitDiameter = 2*Math.max(...framingPoints.map(([x,,z]) =>
    Math.hypot(x-homeView.pivot[0],z-homeView.pivot[2])));

  function viewMatrix(yaw,pitch,width,height,zoom,panX,panZ) {
    const forward=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
    const right=unit(cross([0,1,0],forward)), up=cross(forward,right);
    // 竖屏（或窄窗口）画面横向变窄，需要整体后退才能装下整个院子。
    const aspect=width/height;
    const narrowFit=aspect<1.35 ? homeView.verticalSpan*(1.35/aspect)*.92 : 0;
    const span=Math.max(homeView.verticalSpan,narrowFit,orbitDiameter*height/(width*1.86))/zoom;
    const sx=height/(span*width), sy=1/span;
    const [x,y,z]=homeView.pivot;
    const target=[x+panX,y,z+panZ];
    return new Float32Array([
      right[0]*sx,up[0]*sy,-forward[0]/45,0,
      right[1]*sx,up[1]*sy,-forward[1]/45,0,
      right[2]*sx,up[2]*sy,-forward[2]/45,0,
      -dot(right,target)*sx,
      -dot(up,target)*sy,
      dot(forward,target)/45,1
    ]);
  }

  const lightGrid = {size:512,left:-7,back:-7,width:25,depth:32};

  // Store the highest surface along each light ray and each vertical ray.
  // The same light map serves WebGL and the Canvas fallback.
  function rasterLight(vertices, pixels, channel, shearX, shearZ) {
    const {size,left,back,width,depth}=lightGrid;
    const scaleX=size/width, scaleZ=size/depth;
    for (let i=0;i<vertices.length;i+=27) {
      const ay=vertices[i+1], by=vertices[i+10], cy=vertices[i+19];
      const ax=(vertices[i]-ay*shearX-left)*scaleX;
      const az=(vertices[i+2]-ay*shearZ-back)*scaleZ;
      const bx=(vertices[i+9]-by*shearX-left)*scaleX;
      const bz=(vertices[i+11]-by*shearZ-back)*scaleZ;
      const cx=(vertices[i+18]-cy*shearX-left)*scaleX;
      const cz=(vertices[i+20]-cy*shearZ-back)*scaleZ;
      const minX=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5));
      const maxX=Math.min(size-1,Math.floor(Math.max(ax,bx,cx)-.5));
      const minZ=Math.max(0,Math.ceil(Math.min(az,bz,cz)-.5));
      const maxZ=Math.min(size-1,Math.floor(Math.max(az,bz,cz)-.5));
      if (minX>maxX || minZ>maxZ) continue;
      const det=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
      if (Math.abs(det)<.0001) continue;
      const du=(cz-az)/det, dv=(az-bz)/det;
      for (let z=minZ;z<=maxZ;z++) {
        const offsetX=minX+.5-ax, offsetZ=z+.5-az;
        let u=(offsetX*(cz-az)-offsetZ*(cx-ax))/det;
        let v=((bx-ax)*offsetZ-(bz-az)*offsetX)/det;
        for (let x=minX,p=(z*size+x)*4+channel;x<=maxX;x++,p+=4,u+=du,v+=dv) {
          if (u<0 || v<0 || u+v>1) continue;
          const encoded=Math.round((ay+u*(by-ay)+v*(cy-ay)+1)*32);
          if (encoded>pixels[p]) pixels[p]=Math.min(255,encoded);
        }
      }
    }
  }

  function lightMap(world, shadowRatio, term) {
    const shearX=sunHeading[0]*shadowRatio, shearZ=sunHeading[1]*shadowRatio;
    const {size}=lightGrid;
    const pixels=new Uint8Array(size*size*4);
    rasterLight(world,pixels,0,shearX,shearZ);
    rasterLight(world,pixels,1,0,0);
    // Expand nearby blockers by two texels so contact shadows hug the edges of objects.
    const stride=size*4;
    for (let z=0;z<size;z++) {
      const above=Math.max(0,z-2)*stride, below=Math.min(size-1,z+2)*stride;
      const row=z*stride;
      for (let x=0;x<size;x++) {
        const column=x*4+1, p=row+column;
        const near=Math.max(pixels[above+column],pixels[below+column],
          pixels[row+Math.max(0,x-2)*4+1],pixels[row+Math.min(size-1,x+2)*4+1]);
        pixels[p+1]=Math.max(pixels[p],near-4);
      }
    }
    return {pixels,shearX,shearZ,opacity:shadeOpacity[term],sun:unit([shearX,1,shearZ]),
      haze:color(hazeColor[term])};
  }

  function shaderProgram(gl, api) {
    const modern=api==="webgl2";
    const version=modern ? "#version 300 es\n" : "";
    const readTexture=modern ? "texture" : "texture2D";
    const fragmentColor=modern ? "outputColor" : "gl_FragColor";
    const vertex = version+`
      ${modern ? "in" : "attribute"} vec3 position, normal, pigment;
      uniform mat4 camera;
      ${modern ? "out" : "varying"} mediump vec3 tint, faceNormal, worldPosition;
      ${modern ? "out" : "varying"} mediump float viewDepth;
      void main() {
        tint = pigment;
        faceNormal = normal;
        worldPosition = position;
        gl_Position = camera * vec4(position,1.0);
        viewDepth = gl_Position.z;
      }`;
    const fragment = version+`
      precision mediump float;
      ${modern ? "in" : "varying"} mediump vec3 tint, faceNormal, worldPosition;
      ${modern ? "in" : "varying"} mediump float viewDepth;
      ${modern ? "out vec4 outputColor;" : ""}
      uniform vec3 warmth;
      uniform vec3 hazeTint;
      uniform vec3 shadowInfo;
      uniform sampler2D shadowTexture;
      uniform float waterPass;
      vec2 lightUV(vec2 point) {
        return (point-vec2(${lightGrid.left.toFixed(1)},${lightGrid.back.toFixed(1)}))/
          vec2(${lightGrid.width.toFixed(1)},${lightGrid.depth.toFixed(1)});
      }
      float shadowAt(vec2 uv,float height) {
        float blocker=${readTexture}(shadowTexture,uv).r*(255.0/32.0)-1.0;
        return step(height,blocker);
      }
      void main() {
        vec3 n = normalize(faceNormal);
        vec3 sun = normalize(vec3(shadowInfo.x,1.0,shadowInfo.y));
        float diffuse = max(0.0,dot(n,sun));
        float sky = (n.y+1.0)*0.5;
        vec3 p = worldPosition;
        vec2 ray = lightUV(p.xz-shadowInfo.xy*p.y);
        float sampleStep=1.0/${lightGrid.size.toFixed(1)};
        float height=p.y+0.068;
        vec2 tap=vec2(sampleStep,sampleStep*.64);
        float shadowCoverage=(2.0*shadowAt(ray,height)+shadowAt(ray+tap,height)+shadowAt(ray-tap,height))*.25;
        float overhead=${readTexture}(shadowTexture,lightUV(p.xz)).b*(255.0/32.0)-1.0-p.y;
        float contact=smoothstep(.055,.19,overhead)*(1.0-.67*smoothstep(.18,1.65,overhead));
        float bounce = max(0.0,dot(n,normalize(vec3(0.76,0.10,-0.67))))*0.075;
        float brightness = (0.49+0.16*sky+bounce)*(1.0-.34*contact) +
          (0.10+0.35*diffuse)*(1.0-shadowInfo.z*shadowCoverage);
        float grain = sin(p.x*44.0+sin(p.z*9.0))*sin(p.z*37.0+sin(p.y*13.0));
        if (p.y<0.45) brightness *= 1.0+grain*0.013;
        if (p.y>0.4 && p.y<2.7 && tint.r-tint.g>0.11) {
          brightness *= 1.0+sin((p.x+p.z)*65.0+cos(p.y*6.0))*0.039;
        }
        vec3 paint = tint;
        if (waterPass>0.5) {
          float wave = sin(p.z*15.0+cos(p.x*2.8)*0.85);
          float ripple = smoothstep(0.91,0.99,wave)*(0.3+0.7*sin(p.x*3.8)*sin(p.x*3.8));
          float pool = 0.37+0.23*sin(p.z*0.71)+0.09*sin(p.x*1.35+p.z*0.53);
          float rim = max(max(0.0,abs(p.x-2.395)-3.43),max(0.0,abs(p.z-8.585)-5.37));
          paint = mix(tint,vec3(0.46,0.65,0.62),pool);
          paint = mix(paint,vec3(0.45,0.47,0.34),smoothstep(0.0,0.75,rim)*0.20);
          float reflection = 0.70 + 0.30*sin(p.z*0.65+p.x*0.39);
          paint = mix(paint,vec3(0.91,0.94,0.77),ripple*reflection*0.48*(1.0-shadowCoverage));
        }
        vec3 lit = paint*warmth*brightness;
        lit *= mix(vec3(1.0),vec3(.91,.97,1.035),shadowCoverage*shadowInfo.z);
        if (tint.r>.93 && tint.g>.95 && tint.b>.963) lit = mix(lit,paint,.78);
        float mist = smoothstep(.12,.34,viewDepth)*.055;
        ${fragmentColor} = vec4(mix(lit,hazeTint,mist),waterPass>0.5 ? ${shallowWater.opacity} : 1.0);
      }`;
    const program = gl.createProgram();
    for (const [source,kind] of [[vertex,gl.VERTEX_SHADER],[fragment,gl.FRAGMENT_SHADER]]) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const stage = kind === gl.VERTEX_SHADER ? "vertex" : "fragment";
        const details = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        gl.deleteProgram(program);
        throw Error("Yard " + stage + " shader: " + details);
      }
      gl.attachShader(program,shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      const details = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw Error("Yard shader link: " + details);
    }
    return program;
  }

  class CanvasYardRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      if (!this.context) throw Error("Canvas 2D unavailable");
    }

    render(matrix, cssWidth, cssHeight, world, actor, water, warmth, light) {
      const scale = Math.min(1,Math.sqrt(920000/(cssWidth*cssHeight)));
      const width = Math.max(1,Math.round(cssWidth*scale));
      const height = Math.max(1,Math.round(cssHeight*scale));
      if (!this.frame || this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.frame = this.context.createImageData(width,height);
        this.pixels = new Uint32Array(this.frame.data.buffer);
        this.depth = new Float32Array(width*height);
        this.worldPixels = new Uint32Array(width*height);
        this.worldDepth = new Float32Array(width*height);
        this.waterPixels = new Uint32Array(width*height);
        this.waterDepth = new Float32Array(width*height);
        this.world = null;
      }
      if (this.world !== world || this.matrix !== matrix) {
        this.pixels.fill(0);
        this.depth.fill(Infinity);
        this.draw(world,matrix,warmth,light);
        this.worldDepth.set(this.depth);
        this.waterDepth.fill(Infinity);
        if (water.length) this.draw(water,matrix,warmth,light,"water");
        this.world = world;
        this.matrix = matrix;
        this.worldPixels.set(this.pixels);
      }
      this.pixels.set(this.worldPixels);
      this.depth.set(this.worldDepth);
      this.draw(actor,matrix,warmth,light,water.length ? "actor" : "solid");
      this.context.putImageData(this.frame,0,0);
    }

    draw(vertices,m,warmth,light,layer="solid") {
      const {width,height} = this.canvas;
      const halfWidth = width/2, halfHeight = height/2;
      const [sunX,sunY,sunZ] = light.sun;
      const {size,left:lightLeft,back:lightBack,width:lightWidth,depth:lightDepth}=lightGrid;
      const lightX=size/lightWidth, lightZ=size/lightDepth;
      const readLight=(x,z,channel)=>light.pixels[
        (around(0,size-1,Math.floor(z))*size+around(0,size-1,Math.floor(x)))*4+channel
      ]/32-1;
      const {pixels,depth,waterDepth,waterPixels} = this;
      for (let i=0;i<vertices.length;i+=27) {
        const x0=vertices[i], y0=vertices[i+1], z0=vertices[i+2];
        const x1=vertices[i+9], y1=vertices[i+10], z1=vertices[i+11];
        const x2=vertices[i+18], y2=vertices[i+19], z2=vertices[i+20];
        const ax=(x0*m[0]+y0*m[4]+z0*m[8]+m[12]+1)*halfWidth;
        const ay=(1-x0*m[1]-y0*m[5]-z0*m[9]-m[13])*halfHeight;
        const az=x0*m[2]+y0*m[6]+z0*m[10]+m[14];
        const bx=(x1*m[0]+y1*m[4]+z1*m[8]+m[12]+1)*halfWidth;
        const by=(1-x1*m[1]-y1*m[5]-z1*m[9]-m[13])*halfHeight;
        const bz=x1*m[2]+y1*m[6]+z1*m[10]+m[14];
        const cx=(x2*m[0]+y2*m[4]+z2*m[8]+m[12]+1)*halfWidth;
        const cy=(1-x2*m[1]-y2*m[5]-z2*m[9]-m[13])*halfHeight;
        const cz=x2*m[2]+y2*m[6]+z2*m[10]+m[14];
        const left=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5));
        const right=Math.min(width-1,Math.floor(Math.max(ax,bx,cx)-.5));
        const top=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5));
        const bottom=Math.min(height-1,Math.floor(Math.max(ay,by,cy)-.5));
        if (left>right || top>bottom) continue;
        const det=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);
        if (Math.abs(det)<.0001) continue;

        const diffuse=Math.max(0,vertices[i+3]*sunX+vertices[i+4]*sunY+vertices[i+5]*sunZ);
        const ambient=.49+.08*(vertices[i+4]+1);
        const direct=.10+.35*diffuse;
        const red=vertices[i+6]*warmth[0]*255;
        const green=vertices[i+7]*warmth[1]*255;
        const blue=vertices[i+8]*warmth[2]*255;
        const flake=vertices[i+6]>.93 && vertices[i+7]>.95 && vertices[i+8]>.963;

        const du=(cy-ay)/det, dv=(ay-by)/det;
        for (let y=top;y<=bottom;y++) {
          const offsetY=y+.5-ay, offsetX=left+.5-ax;
          let u=(offsetX*(cy-ay)-offsetY*(cx-ax))/det;
          let v=((bx-ax)*offsetY-(by-ay)*offsetX)/det;
          for (let x=left,p=y*width+left;x<=right;x++,p++,u+=du,v+=dv) {
            if (u<0 || v<0 || u+v>1) continue;
            const z=az+u*(bz-az)+v*(cz-az);
            if (z>=depth[p]) continue;
            const worldX=x0+u*(x1-x0)+v*(x2-x0);
            const worldY=y0+u*(y1-y0)+v*(y2-y0);
            const worldZ=z0+u*(z1-z0)+v*(z2-z0);
            const lx=(worldX-lightLeft)*lightX, lz=(worldZ-lightBack)*lightZ;
            const blocker=readLight(lx-worldY*light.shearX*lightX,lz-worldY*light.shearZ*lightZ,0);
            const overhead=readLight(lx,lz,2)-worldY;
            const contact=around(0,1,(overhead-.055)/.135)*(1-.67*around(0,1,(overhead-.18)/1.47));
            const cast=blocker>=worldY+.068 ? light.opacity : 0;
            let shade=ambient*(1-.34*contact)+direct*(1-cast);
            if (flake) shade=shade*.22+.78;
            const mist=around(0,.055,(z-.12)*.25);
            const fogScale=255*mist, clearShade=shade*(1-mist);
            let r=Math.min(255,red*clearShade*(1-.09*cast)+light.haze[0]*fogScale);
            let g=Math.min(255,green*clearShade*(1-.03*cast)+light.haze[1]*fogScale);
            let b=Math.min(255,blue*clearShade*(1+.035*cast)+light.haze[2]*fogScale);
            let coverage=1;
            if (layer==="water") {
              waterDepth[p]=z;
              waterPixels[p]=(Math.round(b)<<16)|(Math.round(g)<<8)|Math.round(r);
              const behind=pixels[p];
              const opacity=shallowWater.opacity;
              const transmitted=(behind>>>24)/255*(1-opacity);
              coverage=opacity+transmitted;
              r=(r*opacity+(behind&255)*transmitted)/coverage;
              g=(g*opacity+((behind>>>8)&255)*transmitted)/coverage;
              b=(b*opacity+((behind>>>16)&255)*transmitted)/coverage;
            } else if (layer==="actor" && z>waterDepth[p]) {
              const surface=waterPixels[p], a=shallowWater.opacity;
              r=r*(1-a)+(surface&255)*a;
              g=g*(1-a)+((surface>>>8)&255)*a;
              b=b*(1-a)+((surface>>>16)&255)*a;
            }
            depth[p]=z;
            pixels[p]=(Math.round(coverage*255)<<24)|(Math.round(b)<<16)|(Math.round(g)<<8)|Math.round(r);
          }
        }
      }
    }
  }

  class YardScene {
    constructor(canvas, compatibilityCanvas, plinthShadow) {
      this.canvas = canvas;
      this.compatibilityCanvas = compatibilityCanvas;
      this.plinthShadow = plinthShadow;
      this.world = {handle:null,data:null};
      this.actor = {handle:null,data:null};
      this.actorMesh = new Mesh();
      this.onFrame = time => this.loop(time);
      try {
        const options={antialias:true,alpha:true,powerPreference:"high-performance",failIfMajorPerformanceCaveat:true};
        for (const api of ["webgl2","webgl"]) {
          const gl=canvas.getContext(api,options);
          if (!gl) continue;
          this.gpuContext=gl;
          this.gpuApi=api;
          break;
        }
        if (!this.gpuContext) throw Error("Hardware WebGL unavailable");
        this.initializeGraphics(this.gpuContext);
      } catch (error) {
        this.useSoftwareRenderer(error);
      }
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        this.useSoftwareRenderer(Error("WebGL context lost"));
        this.render();
      });
      canvas.addEventListener("webglcontextrestored", () => {
        try {
          this.initializeGraphics(this.gpuContext);
          if (this.state) {
            this.uploadGpuBuffer(this.world,false);
            this.uploadGpuBuffer(this.actor,true);
            this.uploadShadows();
          }
          this.software=null;
          this.compatibilityCanvas.hidden=true;
          this.canvas.classList.remove("compatibility-active");
          this.frameSample=undefined;
          delete this.canvas.dataset.frameRate;
        } catch (error) {
          this.useSoftwareRenderer(error);
        }
        this.render();
      });
      const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
      this.motion = !motionPreference.matches;
      motionPreference.addEventListener?.("change", () => {
        this.motion = !motionPreference.matches;
        this.lastActorFrame = undefined;
        if (this.motion) this.queueFrame();
        else delete this.canvas.dataset.frameRate;
      });
      this.reset();
      if (typeof ResizeObserver === "function") {
        const observer = new ResizeObserver(() => this.invalidateView());
        observer.observe(canvas);
      } else {
        window.addEventListener("resize", () => this.invalidateView());
      }
    }

    initializeGraphics(gl) {
      const program = shaderProgram(gl,this.gpuApi);
      this.gl = gl;
      gl.useProgram(program);
      this.locations = ["position","normal","pigment"].map(name => gl.getAttribLocation(program,name));
      this.camera = gl.getUniformLocation(program,"camera");
      this.warmth = gl.getUniformLocation(program,"warmth");
      this.shadowInfo = gl.getUniformLocation(program,"shadowInfo");
      this.hazeTint = gl.getUniformLocation(program,"hazeTint");
      this.waterPass = gl.getUniformLocation(program,"waterPass");
      this.shadowTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.world.handle = gl.createBuffer();
      this.actor.handle = gl.createBuffer();
      gl.clearColor(0,0,0,0);
      gl.enable(gl.DEPTH_TEST);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      const attributes = gl.getContextAttributes?.();
      const debug = gl.getExtension?.("WEBGL_debug_renderer_info");
      this.canvas.dataset.renderer = this.gpuApi==="webgl2" ? "WebGL 2" : "WebGL 1";
      this.canvas.dataset.antialias = attributes ? String(attributes.antialias) : "unknown";
      if (debug) this.canvas.dataset.renderDevice = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    }

    useSoftwareRenderer(error) {
      this.software ??= new CanvasYardRenderer(this.compatibilityCanvas);
      this.gl = null;
      this.compatibilityCanvas.hidden = false;
      this.canvas.classList.add("compatibility-active");
      this.canvas.dataset.renderer = "Canvas 2D";
      this.canvas.dataset.antialias = "false";
      delete this.canvas.dataset.renderDevice;
      delete this.canvas.dataset.frameRate;
      this.frameSample = undefined;
      console.warn("Yard switched to compatibility rendering:",error.message);
    }

    queueFrame() {
      if (this.frameQueued) return;
      this.frameQueued = true;
      requestAnimationFrame(this.onFrame);
    }

    invalidateView() {
      this.cameraDirty = true;
      this.queueFrame();
    }

    reset() {
      this.yaw = homeView.yaw;
      this.pitch = homeView.pitch;
      this.zoom = 1;
      this.panX = 0;
      this.panZ = 0;
      this.invalidateView();
    }
    rotate(dx, dy) {
      this.yaw += dx;
      this.pitch = around(0,Math.PI/2-.01,this.pitch + dy);
      this.invalidateView();
    }
    pan(dx, dy) {
      const scale = this.worldUnitsPerPixel;
      if (!scale) return;
      const depth = -dy*scale/Math.max(.28,Math.sin(this.pitch));
      this.panX = around(-9,9,this.panX - dx*scale*Math.cos(this.yaw) + depth*Math.sin(this.yaw));
      this.panZ = around(-9,9,this.panZ + dx*scale*Math.sin(this.yaw) + depth*Math.cos(this.yaw));
      this.invalidateView();
    }
    magnify(factor) {
      this.zoom = around(.72,1.9,this.zoom * factor);
      this.invalidateView();
    }
    useTerm(term, shadowLength) {
      this.term = term;
      this.state = seasonColors[term];
      const mesh = new Mesh();
      platform(mesh,this.state);
      field(mesh,term,this.state);
      farmhouse(mesh,this.state,term);
      plantsAndTools(mesh,term,this.state);
      sundialStand(mesh);
      porchSupplies(mesh,term);
      waterWell(mesh);
      bambooFence(mesh,-1.62,2.01,15.20);
      bambooFence(mesh,2.83,6.52,15.20);
      for (const tree of yardTrees) growTree(mesh,tree,term);
      seasonalDetails(mesh,term);
      this.landCount=mesh.data.length/9;
      if (term==="grain") {
        const {left,right,near,far}=plot, y=shallowWater.height;
        mesh.face([[left+.10,y,near+.10],[left+.10,y,far-.10],
          [right-.10,y,far-.10],[right-.10,y,near+.10]],"79b4ad");
      }
      this.upload(this.world,mesh,false);
      this.landData=this.world.data.subarray(0,this.landCount*9);
      this.waterData=this.world.data.subarray(this.landCount*9);
      this.shadows=lightMap(this.landData,shadowLength,term);
      this.uploadShadows();
      this.act(0);
      this.render();
      if (this.motion) this.queueFrame();
    }

    uploadShadows() {
      const gl=this.gl;
      if (!gl) return;
      const format=this.gpuApi==="webgl2" ? gl.RGBA8 : gl.RGBA;
      gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,format,lightGrid.size,lightGrid.size,0,gl.RGBA,
        gl.UNSIGNED_BYTE,this.shadows.pixels);
    }
    act(time) {
      const mesh = this.actorMesh;
      mesh.data.length = 0;
      farmer(mesh,this.term,time);
      chickens(mesh,this.term,time);
      if (this.term === "rain") {
        for (let i = 0; i < 86; i++) {
          const phase=(time*(1.34+variation(i+18)*.47)+variation(i+28))%1;
          const x=footprint.left-.25+variation(i+110)*(footprint.right-footprint.left+.58);
          const z=footprint.back+.21+variation(i+160)*(footprint.front-footprint.back-.42);
          const y=.29+(1-phase)*5.15;
          rainStreak(mesh,x,y,z,.027+variation(i+57)*.026,.29+variation(i+68)*.25,
            i%3 ? "c7e1dc" : "a2c5c6");
        }
        for (let i=0;i<13;i++) {
          const x=-2.15+i*.74, z=.59;
          const y=.39+(1-(time*1.63+variation(i+74))%1)*2.30;
          rainStreak(mesh,x,y-.08,z,.028,.16,"c2d6d2");
        }
        for (const [i,[x,z,poolRadius]] of rainPools.entries()) {
          const phase = (time*.96 + variation(i+180)) % 1;
          const radius = .070 + phase * poolRadius * .73;
          waterRings(mesh,x,z,.284,radius,.028*(1-phase)+.007,"c7dbcb");
          if (phase > .68) {
            const drop = .286 + (1-phase)*3.9;
            rainStreak(mesh,x,drop,z,.031,.20,"d3e4df");
          }
        }
      }
      if (this.term === "grain") {
        dragonflies(mesh,time);
        for (let i=0;i<2;i++) {
          const radius=.10+((time*.35+i*.5)%1)*.38;
          waterRings(mesh,.65,10.77,.283,radius,.016,"a3bfa9");
        }
      }
      if (this.term === "dew") driftingLeaves(mesh,time);
      if (this.term === "winter") {
        kettleSteam(mesh,time);
        snowfall(mesh,time);
      }
      this.upload(this.actor,mesh,true);
    }
    upload(buffer,mesh,dynamic) {
      if (dynamic) {
        if (!buffer.storage || buffer.storage.length<mesh.data.length) {
          buffer.storage = new Float32Array(mesh.data.length*2);
        }
        buffer.storage.set(mesh.data);
        buffer.data = buffer.storage.subarray(0,mesh.data.length);
      } else {
        buffer.data = new Float32Array(mesh.data);
      }
      buffer.count = buffer.data.length / 9;
      this.uploadGpuBuffer(buffer,dynamic);
    }
    uploadGpuBuffer(buffer,dynamic) {
      const gl = this.gl;
      if (!gl) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer.handle);
      gl.bufferData(gl.ARRAY_BUFFER,buffer.data,dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    }
    draw(buffer, first=0, count=buffer.count) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer.handle);
      for (const [i, location] of this.locations.entries()) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location,3,gl.FLOAT,false,36,i*12);
      }
      gl.drawArrays(gl.TRIANGLES,first,count);
    }
    render() {
      if (!this.state) return;
      const canvas = this.canvas;
      const {clientWidth,clientHeight} = canvas;
      if (clientWidth<=0 || clientHeight<=0) return;
      const changedView=this.cameraDirty || clientWidth!==this.viewWidth || clientHeight!==this.viewHeight;
      if (changedView) {
        this.cameraMatrix=viewMatrix(this.yaw,this.pitch,clientWidth,clientHeight,this.zoom,this.panX,this.panZ);
        this.worldUnitsPerPixel=2/(Math.hypot(this.cameraMatrix[0],this.cameraMatrix[8])*clientWidth);
        this.viewWidth=clientWidth;
        this.viewHeight=clientHeight;
        this.cameraDirty=false;
      }
      const matrix=this.cameraMatrix;
      if (changedView && this.plinthShadow) {
        const {left,right,back,front}=footprint;
        const rim=[[left,back],[right,back],[right,front],[left,front]];
        const points=rim.map(([x,z])=>{
          const sx=(x*matrix[0]-.87*matrix[4]+z*matrix[8]+matrix[12]+1)*clientWidth/2;
          const sy=(1-x*matrix[1]+.87*matrix[5]-z*matrix[9]-matrix[13])*clientHeight/2;
          return sx.toFixed(1)+","+sy.toFixed(1);
        }).join(" ");
        if (points!==this.lastPlinthShadow) {
          this.plinthShadow.setAttribute("points",points);
          this.lastPlinthShadow=points;
        }
      }
      if (this.software) {
        this.software.render(matrix,clientWidth,clientHeight,this.landData,this.actor.data,this.waterData,
          this.state.light,this.shadows);
        return;
      }
      const gl = this.gl;
      const ratio = Math.max(1,Math.min(devicePixelRatio || 1,2,Math.sqrt(2400000/(clientWidth*clientHeight))));
      const width = Math.max(1,Math.round(clientWidth*ratio)), height = Math.max(1,Math.round(clientHeight*ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(this.camera,false,matrix);
      gl.uniform3fv(this.shadowInfo,[this.shadows.shearX,this.shadows.shearZ,this.shadows.opacity]);
      gl.uniform3fv(this.hazeTint,this.shadows.haze);
      gl.uniform3fv(this.warmth,this.state.light);
      gl.uniform1f(this.waterPass,0);
      this.draw(this.world,0,this.landCount);
      this.draw(this.actor);
      if (this.waterData.length) {
        gl.enable(gl.BLEND);
        gl.uniform1f(this.waterPass,1);
        this.draw(this.world,this.landCount,this.world.count-this.landCount);
        gl.disable(gl.BLEND);
      }
    }
    loop(time) {
      this.frameQueued = false;
      if (!this.state) return;
      const animate=this.motion && (!this.software || this.lastActorFrame===undefined || time-this.lastActorFrame>=32);
      if (animate) {
        this.lastActorFrame=time;
        this.act(time/1000);
      }
      if (animate || this.cameraDirty) this.render();
      if (!this.motion) return;
      const sample=this.frameSample ??= {start:time,frames:0};
      if (animate) sample.frames++;
      if (time-sample.start>=1000) {
        this.canvas.dataset.frameRate=(sample.frames*1000/(time-sample.start)).toFixed(1);
        this.frameSample={start:time,frames:0};
      }
      this.queueFrame();
    }
  }
  window.YardScene = YardScene;
})();
