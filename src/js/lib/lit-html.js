// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = t.trustedTypes;
var s = i ? i.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var e = "$lit$";
var h = `lit$${Math.random().toFixed(9).slice(2)}$`;
var o = "?" + h;
var n = `<${o}>`;
var r = document;
var l = () => r.createComment("");
var c = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var a = Array.isArray;
var u = (t4) => a(t4) || "function" == typeof t4?.[Symbol.iterator];
var d = "[ 	\n\f\r]";
var f = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var v = /-->/g;
var _ = />/g;
var m = RegExp(`>|${d}(?:([^\\s"'>=/]+)(${d}*=${d}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var p = /'/g;
var g = /"/g;
var $ = /^(?:script|style|textarea|title)$/i;
var y = (t4) => (i4, ...s4) => ({ _$litType$: t4, strings: i4, values: s4 });
var x = y(1);
var b = y(2);
var w = y(3);
var T = Symbol.for("lit-noChange");
var E = Symbol.for("lit-nothing");
var A = /* @__PURE__ */ new WeakMap();
var C = r.createTreeWalker(r, 129);
function P(t4, i4) {
  if (!a(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== s ? s.createHTML(i4) : i4;
}
var V = (t4, i4) => {
  const s4 = t4.length - 1, o4 = [];
  let r4, l2 = 2 === i4 ? "<svg>" : 3 === i4 ? "<math>" : "", c4 = f;
  for (let i5 = 0; i5 < s4; i5++) {
    const s5 = t4[i5];
    let a2, u4, d2 = -1, y2 = 0;
    for (; y2 < s5.length && (c4.lastIndex = y2, u4 = c4.exec(s5), null !== u4); ) y2 = c4.lastIndex, c4 === f ? "!--" === u4[1] ? c4 = v : void 0 !== u4[1] ? c4 = _ : void 0 !== u4[2] ? ($.test(u4[2]) && (r4 = RegExp("</" + u4[2], "g")), c4 = m) : void 0 !== u4[3] && (c4 = m) : c4 === m ? ">" === u4[0] ? (c4 = r4 ?? f, d2 = -1) : void 0 === u4[1] ? d2 = -2 : (d2 = c4.lastIndex - u4[2].length, a2 = u4[1], c4 = void 0 === u4[3] ? m : '"' === u4[3] ? g : p) : c4 === g || c4 === p ? c4 = m : c4 === v || c4 === _ ? c4 = f : (c4 = m, r4 = void 0);
    const x2 = c4 === m && t4[i5 + 1].startsWith("/>") ? " " : "";
    l2 += c4 === f ? s5 + n : d2 >= 0 ? (o4.push(a2), s5.slice(0, d2) + e + s5.slice(d2) + h + x2) : s5 + h + (-2 === d2 ? i5 : x2);
  }
  return [P(t4, l2 + (t4[s4] || "<?>") + (2 === i4 ? "</svg>" : 3 === i4 ? "</math>" : "")), o4];
};
var N = class _N {
  constructor({ strings: t4, _$litType$: s4 }, n4) {
    let r4;
    this.parts = [];
    let c4 = 0, a2 = 0;
    const u4 = t4.length - 1, d2 = this.parts, [f4, v3] = V(t4, s4);
    if (this.el = _N.createElement(f4, n4), C.currentNode = this.el.content, 2 === s4 || 3 === s4) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r4 = C.nextNode()) && d2.length < u4; ) {
      if (1 === r4.nodeType) {
        if (r4.hasAttributes()) for (const t5 of r4.getAttributeNames()) if (t5.endsWith(e)) {
          const i4 = v3[a2++], s5 = r4.getAttribute(t5).split(h), e3 = /([.?@])?(.*)/.exec(i4);
          d2.push({ type: 1, index: c4, name: e3[2], strings: s5, ctor: "." === e3[1] ? H : "?" === e3[1] ? I : "@" === e3[1] ? L : k }), r4.removeAttribute(t5);
        } else t5.startsWith(h) && (d2.push({ type: 6, index: c4 }), r4.removeAttribute(t5));
        if ($.test(r4.tagName)) {
          const t5 = r4.textContent.split(h), s5 = t5.length - 1;
          if (s5 > 0) {
            r4.textContent = i ? i.emptyScript : "";
            for (let i4 = 0; i4 < s5; i4++) r4.append(t5[i4], l()), C.nextNode(), d2.push({ type: 2, index: ++c4 });
            r4.append(t5[s5], l());
          }
        }
      } else if (8 === r4.nodeType) if (r4.data === o) d2.push({ type: 2, index: c4 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r4.data.indexOf(h, t5 + 1)); ) d2.push({ type: 7, index: c4 }), t5 += h.length - 1;
      }
      c4++;
    }
  }
  static createElement(t4, i4) {
    const s4 = r.createElement("template");
    return s4.innerHTML = t4, s4;
  }
};
function S(t4, i4, s4 = t4, e3) {
  if (i4 === T) return i4;
  let h3 = void 0 !== e3 ? s4._$Co?.[e3] : s4._$Cl;
  const o4 = c(i4) ? void 0 : i4._$litDirective$;
  return h3?.constructor !== o4 && (h3?._$AO?.(false), void 0 === o4 ? h3 = void 0 : (h3 = new o4(t4), h3._$AT(t4, s4, e3)), void 0 !== e3 ? (s4._$Co ??= [])[e3] = h3 : s4._$Cl = h3), void 0 !== h3 && (i4 = S(t4, h3._$AS(t4, i4.values), h3, e3)), i4;
}
var M = class {
  constructor(t4, i4) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i4;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i4 }, parts: s4 } = this._$AD, e3 = (t4?.creationScope ?? r).importNode(i4, true);
    C.currentNode = e3;
    let h3 = C.nextNode(), o4 = 0, n4 = 0, l2 = s4[0];
    for (; void 0 !== l2; ) {
      if (o4 === l2.index) {
        let i5;
        2 === l2.type ? i5 = new R(h3, h3.nextSibling, this, t4) : 1 === l2.type ? i5 = new l2.ctor(h3, l2.name, l2.strings, this, t4) : 6 === l2.type && (i5 = new z(h3, this, t4)), this._$AV.push(i5), l2 = s4[++n4];
      }
      o4 !== l2?.index && (h3 = C.nextNode(), o4++);
    }
    return C.currentNode = r, e3;
  }
  p(t4) {
    let i4 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i4), i4 += s4.strings.length - 2) : s4._$AI(t4[i4])), i4++;
  }
};
var R = class _R {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i4, s4, e3) {
    this.type = 2, this._$AH = E, this._$AN = void 0, this._$AA = t4, this._$AB = i4, this._$AM = s4, this.options = e3, this._$Cv = e3?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i4 = this._$AM;
    return void 0 !== i4 && 11 === t4?.nodeType && (t4 = i4.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i4 = this) {
    t4 = S(this, t4, i4), c(t4) ? t4 === E || null == t4 || "" === t4 ? (this._$AH !== E && this._$AR(), this._$AH = E) : t4 !== this._$AH && t4 !== T && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : u(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== E && c(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(r.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i4, _$litType$: s4 } = t4, e3 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = N.createElement(P(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e3) this._$AH.p(i4);
    else {
      const t5 = new M(e3, this), s5 = t5.u(this.options);
      t5.p(i4), this.T(s5), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i4 = A.get(t4.strings);
    return void 0 === i4 && A.set(t4.strings, i4 = new N(t4)), i4;
  }
  k(t4) {
    a(this._$AH) || (this._$AH = [], this._$AR());
    const i4 = this._$AH;
    let s4, e3 = 0;
    for (const h3 of t4) e3 === i4.length ? i4.push(s4 = new _R(this.O(l()), this.O(l()), this, this.options)) : s4 = i4[e3], s4._$AI(h3), e3++;
    e3 < i4.length && (this._$AR(s4 && s4._$AB.nextSibling, e3), i4.length = e3);
  }
  _$AR(t4 = this._$AA.nextSibling, i4) {
    for (this._$AP?.(false, true, i4); t4 !== this._$AB; ) {
      const i5 = t4.nextSibling;
      t4.remove(), t4 = i5;
    }
  }
  setConnected(t4) {
    void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
  }
};
var k = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t4, i4, s4, e3, h3) {
    this.type = 1, this._$AH = E, this._$AN = void 0, this.element = t4, this.name = i4, this._$AM = e3, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = E;
  }
  _$AI(t4, i4 = this, s4, e3) {
    const h3 = this.strings;
    let o4 = false;
    if (void 0 === h3) t4 = S(this, t4, i4, 0), o4 = !c(t4) || t4 !== this._$AH && t4 !== T, o4 && (this._$AH = t4);
    else {
      const e4 = t4;
      let n4, r4;
      for (t4 = h3[0], n4 = 0; n4 < h3.length - 1; n4++) r4 = S(this, e4[s4 + n4], i4, n4), r4 === T && (r4 = this._$AH[n4]), o4 ||= !c(r4) || r4 !== this._$AH[n4], r4 === E ? t4 = E : t4 !== E && (t4 += (r4 ?? "") + h3[n4 + 1]), this._$AH[n4] = r4;
    }
    o4 && !e3 && this.j(t4);
  }
  j(t4) {
    t4 === E ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
  }
};
var H = class extends k {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t4) {
    this.element[this.name] = t4 === E ? void 0 : t4;
  }
};
var I = class extends k {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t4) {
    this.element.toggleAttribute(this.name, !!t4 && t4 !== E);
  }
};
var L = class extends k {
  constructor(t4, i4, s4, e3, h3) {
    super(t4, i4, s4, e3, h3), this.type = 5;
  }
  _$AI(t4, i4 = this) {
    if ((t4 = S(this, t4, i4, 0) ?? E) === T) return;
    const s4 = this._$AH, e3 = t4 === E && s4 !== E || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h3 = t4 !== E && (s4 === E || e3);
    e3 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var z = class {
  constructor(t4, i4, s4) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i4, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    S(this, t4);
  }
};
var Z = { M: e, P: h, A: o, C: 1, L: V, R: M, D: u, V: S, I: R, H: k, N: I, U: L, B: H, F: z };
var j = t.litHtmlPolyfillSupport;
j?.(N, R), (t.litHtmlVersions ??= []).push("3.3.1");
var B = (t4, i4, s4) => {
  const e3 = s4?.renderBefore ?? i4;
  let h3 = e3._$litPart$;
  if (void 0 === h3) {
    const t5 = s4?.renderBefore ?? null;
    e3._$litPart$ = h3 = new R(i4.insertBefore(l(), t5), t5, void 0, s4 ?? {});
  }
  return h3._$AI(t4), h3;
};

// node_modules/lit-html/directive.js
var t2 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e2 = (t4) => (...e3) => ({ _$litDirective$: t4, values: e3 });
var i2 = class {
  constructor(t4) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t4, e3, i4) {
    this._$Ct = t4, this._$AM = e3, this._$Ci = i4;
  }
  _$AS(t4, e3) {
    return this.update(t4, e3);
  }
  update(t4, e3) {
    return this.render(...e3);
  }
};

// node_modules/lit-html/directive-helpers.js
var { I: t3 } = Z;
var f2 = (o4) => void 0 === o4.strings;
var r2 = () => document.createComment("");
var s2 = (o4, i4, n4) => {
  const e3 = o4._$AA.parentNode, l2 = void 0 === i4 ? o4._$AB : i4._$AA;
  if (void 0 === n4) {
    const i5 = e3.insertBefore(r2(), l2), d2 = e3.insertBefore(r2(), l2);
    n4 = new t3(i5, d2, o4, o4.options);
  } else {
    const t4 = n4._$AB.nextSibling, i5 = n4._$AM, d2 = i5 !== o4;
    if (d2) {
      let t5;
      n4._$AQ?.(o4), n4._$AM = o4, void 0 !== n4._$AP && (t5 = o4._$AU) !== i5._$AU && n4._$AP(t5);
    }
    if (t4 !== l2 || d2) {
      let o5 = n4._$AA;
      for (; o5 !== t4; ) {
        const t5 = o5.nextSibling;
        e3.insertBefore(o5, l2), o5 = t5;
      }
    }
  }
  return n4;
};
var v2 = (o4, t4, i4 = o4) => (o4._$AI(t4, i4), o4);
var u2 = {};
var m2 = (o4, t4 = u2) => o4._$AH = t4;
var p2 = (o4) => o4._$AH;
var M2 = (o4) => {
  o4._$AR(), o4._$AA.remove();
};

// node_modules/lit-html/directives/keyed.js
var i3 = e2(class extends i2 {
  constructor() {
    super(...arguments), this.key = E;
  }
  render(r4, t4) {
    return this.key = r4, t4;
  }
  update(r4, [t4, e3]) {
    return t4 !== this.key && (m2(r4), this.key = t4), e3;
  }
});

// node_modules/lit-html/directives/repeat.js
var u3 = (e3, s4, t4) => {
  const r4 = /* @__PURE__ */ new Map();
  for (let l2 = s4; l2 <= t4; l2++) r4.set(e3[l2], l2);
  return r4;
};
var c2 = e2(class extends i2 {
  constructor(e3) {
    if (super(e3), e3.type !== t2.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e3, s4, t4) {
    let r4;
    void 0 === t4 ? t4 = s4 : void 0 !== s4 && (r4 = s4);
    const l2 = [], o4 = [];
    let i4 = 0;
    for (const s5 of e3) l2[i4] = r4 ? r4(s5, i4) : i4, o4[i4] = t4(s5, i4), i4++;
    return { values: o4, keys: l2 };
  }
  render(e3, s4, t4) {
    return this.dt(e3, s4, t4).values;
  }
  update(s4, [t4, r4, c4]) {
    const d2 = p2(s4), { values: p3, keys: a2 } = this.dt(t4, r4, c4);
    if (!Array.isArray(d2)) return this.ut = a2, p3;
    const h3 = this.ut ??= [], v3 = [];
    let m3, y2, x2 = 0, j2 = d2.length - 1, k2 = 0, w2 = p3.length - 1;
    for (; x2 <= j2 && k2 <= w2; ) if (null === d2[x2]) x2++;
    else if (null === d2[j2]) j2--;
    else if (h3[x2] === a2[k2]) v3[k2] = v2(d2[x2], p3[k2]), x2++, k2++;
    else if (h3[j2] === a2[w2]) v3[w2] = v2(d2[j2], p3[w2]), j2--, w2--;
    else if (h3[x2] === a2[w2]) v3[w2] = v2(d2[x2], p3[w2]), s2(s4, v3[w2 + 1], d2[x2]), x2++, w2--;
    else if (h3[j2] === a2[k2]) v3[k2] = v2(d2[j2], p3[k2]), s2(s4, d2[x2], d2[j2]), j2--, k2++;
    else if (void 0 === m3 && (m3 = u3(a2, k2, w2), y2 = u3(h3, x2, j2)), m3.has(h3[x2])) if (m3.has(h3[j2])) {
      const e3 = y2.get(a2[k2]), t5 = void 0 !== e3 ? d2[e3] : null;
      if (null === t5) {
        const e4 = s2(s4, d2[x2]);
        v2(e4, p3[k2]), v3[k2] = e4;
      } else v3[k2] = v2(t5, p3[k2]), s2(s4, d2[x2], t5), d2[e3] = null;
      k2++;
    } else M2(d2[j2]), j2--;
    else M2(d2[x2]), x2++;
    for (; k2 <= w2; ) {
      const e3 = s2(s4, v3[w2 + 1]);
      v2(e3, p3[k2]), v3[k2++] = e3;
    }
    for (; x2 <= j2; ) {
      const e3 = d2[x2++];
      null !== e3 && M2(e3);
    }
    return this.ut = a2, m2(s4, v3), T;
  }
});

// node_modules/lit-html/async-directive.js
var s3 = (i4, t4) => {
  const e3 = i4._$AN;
  if (void 0 === e3) return false;
  for (const i5 of e3) i5._$AO?.(t4, false), s3(i5, t4);
  return true;
};
var o2 = (i4) => {
  let t4, e3;
  do {
    if (void 0 === (t4 = i4._$AM)) break;
    e3 = t4._$AN, e3.delete(i4), i4 = t4;
  } while (0 === e3?.size);
};
var r3 = (i4) => {
  for (let t4; t4 = i4._$AM; i4 = t4) {
    let e3 = t4._$AN;
    if (void 0 === e3) t4._$AN = e3 = /* @__PURE__ */ new Set();
    else if (e3.has(i4)) break;
    e3.add(i4), c3(t4);
  }
};
function h2(i4) {
  void 0 !== this._$AN ? (o2(this), this._$AM = i4, r3(this)) : this._$AM = i4;
}
function n2(i4, t4 = false, e3 = 0) {
  const r4 = this._$AH, h3 = this._$AN;
  if (void 0 !== h3 && 0 !== h3.size) if (t4) if (Array.isArray(r4)) for (let i5 = e3; i5 < r4.length; i5++) s3(r4[i5], false), o2(r4[i5]);
  else null != r4 && (s3(r4, false), o2(r4));
  else s3(this, i4);
}
var c3 = (i4) => {
  i4.type == t2.CHILD && (i4._$AP ??= n2, i4._$AQ ??= h2);
};
var f3 = class extends i2 {
  constructor() {
    super(...arguments), this._$AN = void 0;
  }
  _$AT(i4, t4, e3) {
    super._$AT(i4, t4, e3), r3(this), this.isConnected = i4._$AU;
  }
  _$AO(i4, t4 = true) {
    i4 !== this.isConnected && (this.isConnected = i4, i4 ? this.reconnected?.() : this.disconnected?.()), t4 && (s3(this, i4), o2(this));
  }
  setValue(t4) {
    if (f2(this._$Ct)) this._$Ct._$AI(t4, this);
    else {
      const i4 = [...this._$Ct._$AH];
      i4[this._$Ci] = t4, this._$Ct._$AI(i4, this, 0);
    }
  }
  disconnected() {
  }
  reconnected() {
  }
};

// node_modules/lit-html/directives/ref.js
var o3 = /* @__PURE__ */ new WeakMap();
var n3 = e2(class extends f3 {
  render(i4) {
    return E;
  }
  update(i4, [s4]) {
    const e3 = s4 !== this.G;
    return e3 && void 0 !== this.G && this.rt(void 0), (e3 || this.lt !== this.ct) && (this.G = s4, this.ht = i4.options?.host, this.rt(this.ct = i4.element)), E;
  }
  rt(t4) {
    if (this.isConnected || (t4 = void 0), "function" == typeof this.G) {
      const i4 = this.ht ?? globalThis;
      let s4 = o3.get(i4);
      void 0 === s4 && (s4 = /* @__PURE__ */ new WeakMap(), o3.set(i4, s4)), void 0 !== s4.get(this.G) && this.G.call(this.ht, void 0), s4.set(this.G, t4), void 0 !== t4 && this.G.call(this.ht, t4);
    } else this.G.value = t4;
  }
  get lt() {
    return "function" == typeof this.G ? o3.get(this.ht ?? globalThis)?.get(this.G) : this.G?.value;
  }
  disconnected() {
    this.lt === this.ct && this.rt(void 0);
  }
  reconnected() {
    this.rt(this.ct);
  }
});
export {
  x as html,
  i3 as keyed,
  n3 as ref,
  B as render,
  c2 as repeat
};
/*! Bundled license information:

lit-html/lit-html.js:
lit-html/directive.js:
lit-html/directives/repeat.js:
lit-html/async-directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directive-helpers.js:
lit-html/directives/ref.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/keyed.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
