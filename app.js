(() => {
  "use strict";

  const terms = {
    rain: {
      longitude: 330, name: "雨水", verse: "随风潜入夜，润物细无声。",
      palette: [["柳绿","#87AA62"],["青瓷","#A5C6B5"],["杏红","#DA927B"]],
      note: "柳梢刚冒嫩芽。细雨顺着瓦檐滴下，农夫沿田埂疏沟。"
    },
    grain: {
      longitude: 75, name: "芒种", verse: "家家麦饭美，处处菱歌长。",
      palette: [["竹青","#547B58"],["缥色","#79B4AD"],["麦黄","#D9C18D"]],
      note: "芒种忙栽秧。田里留一层浅水，透过水能看见泥底和刚栽下的稻秧。"
    },
    dew: {
      longitude: 195, name: "寒露", verse: "寒露惊秋晚，朝看菊渐黄。",
      palette: [["秋香","#A49A65"],["酡颜","#B77462"],["黛蓝","#4C6374"]],
      note: "「菊有黄华」，院前的秋菊开了。田里的稻穗已黄熟，收割前先从田埂缺口放掉积水。"
    },
    winter: {
      longitude: 240, name: "小雪", verse: "雪粉华，舞梨花。",
      palette: [["霜色","#EAF0EC"],["月白","#CFDEE3"],["玄青","#33485A"]],
      note: "这天，院里下起初冬的一场细雪。瓦面先积起薄白，落到湿石径上的雪花很快化开。"
    }
  };
  const canvas = document.querySelector("#yard");
  const sundial = document.querySelector("#sundial");
  const shadowReadout = document.querySelector("#shadow-ratio");
  const buttons = Array.from(document.querySelectorAll(".term"));
  const yardLinks = Array.from(document.querySelectorAll(".yard-links button"));
  const ruler = document.querySelector("#terms");
  const rulerWindow = document.querySelector(".ruler-window");
  const rulerCursor = document.querySelector(".ruler-cursor");
  const number = document.querySelector("#term-number");
  const marks = Array.from(ruler.children);
  const stops = buttons.map(button => marks.indexOf(button));
  const note = document.querySelector("#term-note");
  const interlude = document.querySelector("#season-interlude");
  const interludeText = document.querySelector(".interlude-text");
  const interludeName = document.querySelector("#interlude-name");
  const interludeEnglish = document.querySelector("#interlude-english");
  const interludeLongitude = document.querySelector("#interlude-longitude");
  const interludeVerse = document.querySelector("#interlude-verse");
  const dialRotor = document.querySelector("#dial-rotor");
  const dialFans = document.querySelector("#dial-fans");
  const swatches = document.querySelectorAll(".swatches li");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const degrees = Math.PI / 180;
  const dialStep = 360 / marks.length;
  const dialRadius = 166;
  const halfYear = marks.length / 2;
  const dialNames = marks.map(mark => (mark.querySelector(".term-name") || mark).textContent);
  const fanStart = dialNames.indexOf("小满");

  function dialPoint(index, radius) {
    const angle = index * dialStep * degrees;
    return [Math.sin(angle) * radius, -Math.cos(angle) * radius].map(value => Math.round(value * 100) / 100);
  }

  function svgElement(tag, attributes) {
    const element = document.createElementNS("http://www.w3.org/2000/svg",tag);
    for (const [name,value] of Object.entries(attributes)) element.setAttribute(name,value);
    return element;
  }

  // Draw two opposite fans, anchored by 小满 (60°) and 小雪 (240°).
  // Each dot lies on a 15° spoke, at its intersection with the corresponding fan chord.
  // A 10° offset on the rim separates the two sets of lines and sets the shape of the arcs.
  const fanOffset = 10 / dialStep;
  function fanRadius(offset) {
    const chordAngle = (offset + fanOffset) * dialStep * degrees / 2;
    const spokeAngle = offset * dialStep * degrees;
    return dialRadius * Math.cos(chordAngle) / Math.cos(spokeAngle - chordAngle);
  }

  const diameters = [];
  for (let index = 0; index < halfYear; index++) {
    diameters.push(`M${dialPoint(index,dialRadius).join(" ")} L${dialPoint(index + halfYear,dialRadius).join(" ")}`);
  }
  document.querySelector("#dial-diameters").setAttribute("d",diameters.join(" "));

  for (const [half,anchor] of [fanStart,fanStart + halfYear].entries()) {
    const origin = dialPoint(anchor,dialRadius).join(" ");
    const chords = [];
    const curve = [];
    for (let offset = 0; offset < halfYear; offset++) {
      const rim = dialPoint(anchor + offset + fanOffset,dialRadius).join(" ");
      chords.push(`M${origin} L${rim}`);
    }
    for (let offset = 0; offset <= halfYear - 1; offset += .125) {
      curve.push(dialPoint(anchor + offset,fanRadius(offset)).join(","));
    }
    const fan = svgElement("g",{class:half ? "dial-fan dial-fan-cool" : "dial-fan"});
    fan.append(
      svgElement("path",{d:chords.join(" "),class:"dial-chords"}),
      svgElement("polyline",{points:curve.join(" "),class:"dial-arc"})
    );
    dialFans.append(fan);
  }

  const dialMarks = dialNames.map((termName,index) => {
    const featured = stops.includes(index);
    const principal = index % 2 === 1;
    const fanOffsetIndex = (index - fanStart + marks.length) % halfYear;
    const offsetRadius = fanRadius(fanOffsetIndex);
    const [innerX,innerY] = dialPoint(index,featured ? 158 : 162);
    const [outerX,outerY] = dialPoint(index,172);
    const [x,y] = dialPoint(index,offsetRadius);
    const label = svgElement("g",{transform:`translate(${dialPoint(index,192).join(" ")})`});
    const name = svgElement("text",{class:"dial-label"});
    name.textContent = termName;
    label.append(name);

    const group = svgElement("g",{class:"dial-mark"});
    group.classList.toggle("dial-featured",featured);
    group.classList.toggle("dial-principal",principal);
    group.classList.toggle("dial-anchor",fanOffsetIndex === 0);
    group.append(
      svgElement("path",{d:`M${innerX} ${innerY} L${outerX} ${outerY}`,class:"dial-tick"}),
      svgElement("path",{d:`M${x} ${y} L${innerX} ${innerY}`,class:"dial-track"}),
      svgElement("circle",{cx:x,cy:y,r:fanOffsetIndex === 0 ? 5.1 : 3.6,class:"dial-node"}),
      label
    );
    dialRotor.append(group);
    return group;
  });
  // Reference latitude represents the central Jianghan Plain.
  const latitude = 30.4 * degrees;
  let scene;
  try {
    scene = new window.YardScene(canvas,document.querySelector("#yard-compatibility"),
      document.querySelector("#plinth-shadow"));
  } catch (error) {
    console.error(error);
    document.querySelector("#renderer-message").hidden = false;
    document.querySelector(".view-controls").hidden = true;
  }

  function showTerm(key) {
    const term = terms[key];
    const declination = Math.asin(Math.sin(23.44 * degrees) * Math.sin(term.longitude * degrees));
    const altitude = Math.PI / 2 - Math.abs(latitude - declination);
    const shadowRatio = 1 / Math.tan(altitude);
    const diagramHeight = 23;
    const sunDistance = 14;
    sundial.style.setProperty("--shadow-length", (diagramHeight * shadowRatio).toFixed(2) + "px");
    sundial.style.setProperty("--sun-dx", (-Math.cos(altitude) * sunDistance).toFixed(2) + "px");
    sundial.style.setProperty("--sun-dy", (-Math.sin(altitude) * sunDistance).toFixed(2) + "px");
    const ratio=shadowRatio.toFixed(2);
    shadowReadout.innerHTML = "<b>" + ratio + "</b><span>× 竿高</span>";
    sundial.setAttribute("aria-label", term.name + "正午日影，约为竿高的 " + ratio + " 倍");
    document.body.dataset.season = key;
    note.textContent = term.note;
    for (const [i,swatch] of swatches.entries()) {
      const [name,color] = term.palette[i];
      swatch.style.setProperty("--swatch",color);
      swatch.querySelector("span").textContent = name;
      swatch.title = name + " " + color;
    }
    const stop = stops[buttons.findIndex(button => button.dataset.season === key)];
    number.textContent = String(stop + 1).padStart(2,"0");
    for (const [index,mark] of dialMarks.entries()) mark.classList.toggle("dial-current",index === stop);
    for (const button of [...buttons,...yardLinks]) {
      if ((button.dataset.season || button.dataset.yard) === key) button.setAttribute("aria-current","true");
      else button.removeAttribute("aria-current");
    }
    scene?.useTerm(key,shadowRatio);
  }

  let targetIndex = buttons.findIndex(button => button.getAttribute("aria-current") === "true");
  if (targetIndex < 0) targetIndex = 1;
  interlude.style.setProperty("--dial-angle", -stops[targetIndex] * dialStep + "deg");
  let pendingIndex = null;
  let settleTimer;
  let interludeTimer;
  let textEntry;

  function revealYard() {
    clearTimeout(interludeTimer);
    textEntry?.cancel();
    interlude.dataset.phase = "";
  }

  function releaseInterlude() {
    interlude.dataset.phase = "exit";
    interludeTimer = setTimeout(revealYard,460);
  }

  function settleRuler() {
    if (pendingIndex === null) return;
    const index = pendingIndex;
    const button = buttons[index];
    const key = button.dataset.season;
    pendingIndex = null;
    clearTimeout(settleTimer);
    if (document.body.dataset.season === key) {
      revealYard();
      return;
    }
    showTerm(key);
    if (reduceMotion.matches || !scene) {
      revealYard();
      return;
    }
    interlude.dataset.phase = "verse";
    interludeTimer = setTimeout(releaseInterlude,850);
  }

  function selectTerm(index) {
    if (index === targetIndex) return;
    const button = buttons[index];
    const key = button.dataset.season;
    if (!reduceMotion.matches && scene && (key !== document.body.dataset.season || interlude.dataset.phase === "cover")) {
      const tick = button.getBoundingClientRect();
      const cursor = rulerCursor.getBoundingClientRect();
      // Sample the moving ruler before changing its destination.
      const offset = tick.top + tick.height / 2 - cursor.top - cursor.height / 2;
      const forward = Math.abs(offset) < .5 ? index > targetIndex : offset > 0;
      const term = terms[key];
      const termType = stops[index] % 2 ? "中气" : "节";
      interludeName.textContent = term.name;
      interludeEnglish.textContent = button.querySelector("small").textContent;
      interludeLongitude.textContent = "太阳黄经 " + term.longitude + "° · " + termType;
      interludeVerse.textContent = term.verse;
      interlude.dataset.term = key;
      interlude.dataset.direction = forward ? "forward" : "backward";
      interlude.dataset.phase = "cover";
      textEntry?.cancel();
      textEntry = interludeText.animate(
        [{transform:"translateY(var(--travel))"},{transform:"translateY(0)"}],
        {duration:520,easing:"cubic-bezier(.3,.61,.28,1)"}
      );
    }
    targetIndex = index;
    pendingIndex = index;
    clearTimeout(settleTimer);
    clearTimeout(interludeTimer);
    interlude.style.setProperty("--dial-angle", -stops[index] * dialStep + "deg");
    ruler.style.setProperty("--ruler-index",stops[index]);
    if (reduceMotion.matches) settleRuler();
    else settleTimer = setTimeout(settleRuler,290);
  }

  ruler.addEventListener("transitionend", event => {
    if (event.target === ruler && event.propertyName === "transform") settleRuler();
  });
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) {
      settleRuler();
      revealYard();
    }
  });

  for (const button of [...buttons,...yardLinks]) {
    const key = button.dataset.season || button.dataset.yard;
    const index = buttons.findIndex(entry => entry.dataset.season === key);
    button.addEventListener("click",() => selectTerm(index));
    button.addEventListener("keydown",event => {
      let next;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length-1;
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(0,index-1);
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(buttons.length-1,index+1);
      if (next === undefined) return;
      event.preventDefault();
      yardLinks[next].focus({preventScroll:true});
      selectTerm(next);
    });
  }

  // A wheel gesture can advance one courtyard even if the next major mark is offscreen.
  let wheelTime = -Infinity, wheelDistance = 0, wheelUsed = false;
  function stepYard(direction) {
    selectTerm(Math.max(0,Math.min(buttons.length - 1,targetIndex + direction)));
  }
  rulerWindow.addEventListener("wheel",event => {
    if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rulerWindow.clientHeight : 1);
    if (event.timeStamp - wheelTime > 160 || Math.sign(delta) !== Math.sign(wheelDistance)) {
      wheelUsed = false;
      wheelDistance = 0;
    }
    wheelTime = event.timeStamp;
    wheelDistance += delta;
    if (!wheelUsed && Math.abs(wheelDistance) >= 24) {
      stepYard(Math.sign(delta));
      wheelUsed = true;
    }
  },{passive:false});

  let swipe;
  rulerWindow.addEventListener("pointerdown",event => {
    if (!event.isPrimary || event.button !== 0) { swipe = null; return; }
    swipe = {id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  rulerWindow.addEventListener("pointermove",event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dy) < 32 || Math.abs(dy) <= Math.abs(event.clientX - swipe.x)) return;
    // Capture on the window so a swipe starting on a button cannot also click it.
    rulerWindow.setPointerCapture(event.pointerId);
    stepYard(-Math.sign(dy));
    swipe = null;
  });
  for (const eventName of ["pointerup","pointercancel","pointerleave"]) {
    rulerWindow.addEventListener(eventName,() => { swipe = null; });
  }
  showTerm("grain");
  if (!scene) return;

  const points = new Map();
  const distance = () => {
    const [a,b] = points.values();
    return Math.hypot(a.x - b.x,a.y - b.y);
  };

  canvas.addEventListener("pointerdown", event => {
    if ((event.button !== 0 && event.button !== 2) || points.size === 2) return;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY,pan:event.button===2});
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", event => {
    const old = points.get(event.pointerId);
    if (!old) return;
    const pinching = points.size === 2;
    const before = pinching ? distance() : 0;
    const dx=event.clientX-old.x, dy=event.clientY-old.y;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY,pan:old.pan});
    if (pinching && before > 1) {
      scene.magnify(distance()/before);
      scene.pan(dx/2,dy/2);
    } else if (old.pan) {
      scene.pan(dx,dy);
    } else {
      scene.rotate(-dx*.009,dy*.007);
    }
  });
  for (const type of ["pointerup","pointercancel","lostpointercapture"]) {
    canvas.addEventListener(type, event => {
      points.delete(event.pointerId);
      if (!points.size) canvas.classList.remove("dragging");
    });
  }
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    scene.magnify(Math.exp(-Math.max(-420, Math.min(420,event.deltaY)) * .0015));
  },{passive:false});
  canvas.addEventListener("keydown", event => {
    const rotations = {ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,.10],ArrowDown:[0,-.10]};
    if (event.key in rotations) {
      event.preventDefault();
      scene.rotate(...rotations[event.key]);
    } else if (event.key === "+" || event.key === "-") {
      event.preventDefault();
      scene.magnify(event.key === "+" ? 1.12 : 1/1.12);
    } else if (event.key === "Home") {
      event.preventDefault();
      scene.reset();
    }
  });

  document.querySelector("#zoom-in").addEventListener("click", () => scene.magnify(1.15));
  document.querySelector("#zoom-out").addEventListener("click", () => scene.magnify(1/1.15));
  document.querySelector("#reset-view").addEventListener("click", () => scene.reset());
})();


