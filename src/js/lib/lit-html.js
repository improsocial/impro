// node_modules/lit-html/lit-html.js
var t = globalThis;
var i = (t4) => t4;
var s = t.trustedTypes;
var e = s ? s.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var h = "$lit$";
var o = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n = "?" + o;
var r = `<${n}>`;
var l = document;
var c = () => l.createComment("");
var a = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var u = Array.isArray;
var d = (t4) => u(t4) || "function" == typeof t4?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t4) => (i5, ...s4) => ({ _$litType$: t4, strings: i5, values: s4 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t4, i5) {
  if (!u(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i5) : i5;
}
var N = (t4, i5) => {
  const s4 = t4.length - 1, e3 = [];
  let n4, l2 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c4 = v;
  for (let i6 = 0; i6 < s4; i6++) {
    const s5 = t4[i6];
    let a2, u4, d2 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u4 = c4.exec(s5), null !== u4); ) f3 = c4.lastIndex, c4 === v ? "!--" === u4[1] ? c4 = _ : void 0 !== u4[1] ? c4 = m : void 0 !== u4[2] ? (y.test(u4[2]) && (n4 = RegExp("</" + u4[2], "g")), c4 = p) : void 0 !== u4[3] && (c4 = p) : c4 === p ? ">" === u4[0] ? (c4 = n4 ?? v, d2 = -1) : void 0 === u4[1] ? d2 = -2 : (d2 = c4.lastIndex - u4[2].length, a2 = u4[1], c4 = void 0 === u4[3] ? p : '"' === u4[3] ? $ : g) : c4 === $ || c4 === g ? c4 = p : c4 === _ || c4 === m ? c4 = v : (c4 = p, n4 = void 0);
    const x2 = c4 === p && t4[i6 + 1].startsWith("/>") ? " " : "";
    l2 += c4 === v ? s5 + r : d2 >= 0 ? (e3.push(a2), s5.slice(0, d2) + h + s5.slice(d2) + o + x2) : s5 + o + (-2 === d2 ? i6 : x2);
  }
  return [V(t4, l2 + (t4[s4] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e3];
};
var S = class _S {
  constructor({ strings: t4, _$litType$: i5 }, e3) {
    let r4;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u4 = t4.length - 1, d2 = this.parts, [f3, v3] = N(t4, i5);
    if (this.el = _S.createElement(f3, e3), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r4 = P.nextNode()) && d2.length < u4; ) {
      if (1 === r4.nodeType) {
        if (r4.hasAttributes()) for (const t5 of r4.getAttributeNames()) if (t5.endsWith(h)) {
          const i6 = v3[a2++], s4 = r4.getAttribute(t5).split(o), e4 = /([.?@])?(.*)/.exec(i6);
          d2.push({ type: 1, index: l2, name: e4[2], strings: s4, ctor: "." === e4[1] ? I : "?" === e4[1] ? L : "@" === e4[1] ? z : H }), r4.removeAttribute(t5);
        } else t5.startsWith(o) && (d2.push({ type: 6, index: l2 }), r4.removeAttribute(t5));
        if (y.test(r4.tagName)) {
          const t5 = r4.textContent.split(o), i6 = t5.length - 1;
          if (i6 > 0) {
            r4.textContent = s ? s.emptyScript : "";
            for (let s4 = 0; s4 < i6; s4++) r4.append(t5[s4], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r4.append(t5[i6], c());
          }
        }
      } else if (8 === r4.nodeType) if (r4.data === n) d2.push({ type: 2, index: l2 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r4.data.indexOf(o, t5 + 1)); ) d2.push({ type: 7, index: l2 }), t5 += o.length - 1;
      }
      l2++;
    }
  }
  static createElement(t4, i5) {
    const s4 = l.createElement("template");
    return s4.innerHTML = t4, s4;
  }
};
function M(t4, i5, s4 = t4, e3) {
  if (i5 === E) return i5;
  let h4 = void 0 !== e3 ? s4._$Co?.[e3] : s4._$Cl;
  const o4 = a(i5) ? void 0 : i5._$litDirective$;
  return h4?.constructor !== o4 && (h4?._$AO?.(false), void 0 === o4 ? h4 = void 0 : (h4 = new o4(t4), h4._$AT(t4, s4, e3)), void 0 !== e3 ? (s4._$Co ??= [])[e3] = h4 : s4._$Cl = h4), void 0 !== h4 && (i5 = M(t4, h4._$AS(t4, i5.values), h4, e3)), i5;
}
var R = class {
  constructor(t4, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i5 }, parts: s4 } = this._$AD, e3 = (t4?.creationScope ?? l).importNode(i5, true);
    P.currentNode = e3;
    let h4 = P.nextNode(), o4 = 0, n4 = 0, r4 = s4[0];
    for (; void 0 !== r4; ) {
      if (o4 === r4.index) {
        let i6;
        2 === r4.type ? i6 = new k(h4, h4.nextSibling, this, t4) : 1 === r4.type ? i6 = new r4.ctor(h4, r4.name, r4.strings, this, t4) : 6 === r4.type && (i6 = new Z(h4, this, t4)), this._$AV.push(i6), r4 = s4[++n4];
      }
      o4 !== r4?.index && (h4 = P.nextNode(), o4++);
    }
    return P.currentNode = l, e3;
  }
  p(t4) {
    let i5 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t4[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i5, s4, e3) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i5, this._$AM = s4, this.options = e3, this._$Cv = e3?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t4?.nodeType && (t4 = i5.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i5 = this) {
    t4 = M(this, t4, i5), a(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(l.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i5, _$litType$: s4 } = t4, e3 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = S.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e3) this._$AH.p(i5);
    else {
      const t5 = new R(e3, this), s5 = t5.u(this.options);
      t5.p(i5), this.T(s5), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i5 = C.get(t4.strings);
    return void 0 === i5 && C.set(t4.strings, i5 = new S(t4)), i5;
  }
  k(t4) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s4, e3 = 0;
    for (const h4 of t4) e3 === i5.length ? i5.push(s4 = new _k(this.O(c()), this.O(c()), this, this.options)) : s4 = i5[e3], s4._$AI(h4), e3++;
    e3 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e3), i5.length = e3);
  }
  _$AR(t4 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t4 !== this._$AB; ) {
      const s5 = i(t4).nextSibling;
      i(t4).remove(), t4 = s5;
    }
  }
  setConnected(t4) {
    void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t4, i5, s4, e3, h4) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i5, this._$AM = e3, this.options = h4, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t4, i5 = this, s4, e3) {
    const h4 = this.strings;
    let o4 = false;
    if (void 0 === h4) t4 = M(this, t4, i5, 0), o4 = !a(t4) || t4 !== this._$AH && t4 !== E, o4 && (this._$AH = t4);
    else {
      const e4 = t4;
      let n4, r4;
      for (t4 = h4[0], n4 = 0; n4 < h4.length - 1; n4++) r4 = M(this, e4[s4 + n4], i5, n4), r4 === E && (r4 = this._$AH[n4]), o4 ||= !a(r4) || r4 !== this._$AH[n4], r4 === A ? t4 = A : t4 !== A && (t4 += (r4 ?? "") + h4[n4 + 1]), this._$AH[n4] = r4;
    }
    o4 && !e3 && this.j(t4);
  }
  j(t4) {
    t4 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t4) {
    this.element[this.name] = t4 === A ? void 0 : t4;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t4) {
    this.element.toggleAttribute(this.name, !!t4 && t4 !== A);
  }
};
var z = class extends H {
  constructor(t4, i5, s4, e3, h4) {
    super(t4, i5, s4, e3, h4), this.type = 5;
  }
  _$AI(t4, i5 = this) {
    if ((t4 = M(this, t4, i5, 0) ?? A) === E) return;
    const s4 = this._$AH, e3 = t4 === A && s4 !== A || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h4 = t4 !== A && (s4 === A || e3);
    e3 && this.element.removeEventListener(this.name, this, s4), h4 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i5, s4) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    M(this, t4);
  }
};
var j = { M: h, P: o, A: n, C: 1, L: N, R, D: d, V: M, I: k, H, N: L, U: z, B: I, F: Z };
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.3");
var D = (t4, i5, s4) => {
  const e3 = s4?.renderBefore ?? i5;
  let h4 = e3._$litPart$;
  if (void 0 === h4) {
    const t5 = s4?.renderBefore ?? null;
    e3._$litPart$ = h4 = new k(i5.insertBefore(c(), t5), t5, void 0, s4 ?? {});
  }
  return h4._$AI(t4), h4;
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
  _$AT(t4, e3, i5) {
    this._$Ct = t4, this._$AM = e3, this._$Ci = i5;
  }
  _$AS(t4, e3) {
    return this.update(t4, e3);
  }
  update(t4, e3) {
    return this.render(...e3);
  }
};

// node_modules/lit-html/directive-helpers.js
var { I: t3 } = j;
var i3 = (o4) => o4;
var r2 = (o4) => void 0 === o4.strings;
var s2 = () => document.createComment("");
var v2 = (o4, n4, e3) => {
  const l2 = o4._$AA.parentNode, d2 = void 0 === n4 ? o4._$AB : n4._$AA;
  if (void 0 === e3) {
    const i5 = l2.insertBefore(s2(), d2), n5 = l2.insertBefore(s2(), d2);
    e3 = new t3(i5, n5, o4, o4.options);
  } else {
    const t4 = e3._$AB.nextSibling, n5 = e3._$AM, c4 = n5 !== o4;
    if (c4) {
      let t5;
      e3._$AQ?.(o4), e3._$AM = o4, void 0 !== e3._$AP && (t5 = o4._$AU) !== n5._$AU && e3._$AP(t5);
    }
    if (t4 !== d2 || c4) {
      let o5 = e3._$AA;
      for (; o5 !== t4; ) {
        const t5 = i3(o5).nextSibling;
        i3(l2).insertBefore(o5, d2), o5 = t5;
      }
    }
  }
  return e3;
};
var u2 = (o4, t4, i5 = o4) => (o4._$AI(t4, i5), o4);
var m2 = {};
var p2 = (o4, t4 = m2) => o4._$AH = t4;
var M2 = (o4) => o4._$AH;
var h2 = (o4) => {
  o4._$AR(), o4._$AA.remove();
};

// node_modules/lit-html/directives/keyed.js
var i4 = e2(class extends i2 {
  constructor() {
    super(...arguments), this.key = A;
  }
  render(r4, t4) {
    return this.key = r4, t4;
  }
  update(r4, [t4, e3]) {
    return t4 !== this.key && (p2(r4), this.key = t4), e3;
  }
});

// node_modules/lit-html/async-directive.js
var s3 = (i5, t4) => {
  const e3 = i5._$AN;
  if (void 0 === e3) return false;
  for (const i6 of e3) i6._$AO?.(t4, false), s3(i6, t4);
  return true;
};
var o2 = (i5) => {
  let t4, e3;
  do {
    if (void 0 === (t4 = i5._$AM)) break;
    e3 = t4._$AN, e3.delete(i5), i5 = t4;
  } while (0 === e3?.size);
};
var r3 = (i5) => {
  for (let t4; t4 = i5._$AM; i5 = t4) {
    let e3 = t4._$AN;
    if (void 0 === e3) t4._$AN = e3 = /* @__PURE__ */ new Set();
    else if (e3.has(i5)) break;
    e3.add(i5), c2(t4);
  }
};
function h3(i5) {
  void 0 !== this._$AN ? (o2(this), this._$AM = i5, r3(this)) : this._$AM = i5;
}
function n2(i5, t4 = false, e3 = 0) {
  const r4 = this._$AH, h4 = this._$AN;
  if (void 0 !== h4 && 0 !== h4.size) if (t4) if (Array.isArray(r4)) for (let i6 = e3; i6 < r4.length; i6++) s3(r4[i6], false), o2(r4[i6]);
  else null != r4 && (s3(r4, false), o2(r4));
  else s3(this, i5);
}
var c2 = (i5) => {
  i5.type == t2.CHILD && (i5._$AP ??= n2, i5._$AQ ??= h3);
};
var f2 = class extends i2 {
  constructor() {
    super(...arguments), this._$AN = void 0;
  }
  _$AT(i5, t4, e3) {
    super._$AT(i5, t4, e3), r3(this), this.isConnected = i5._$AU;
  }
  _$AO(i5, t4 = true) {
    i5 !== this.isConnected && (this.isConnected = i5, i5 ? this.reconnected?.() : this.disconnected?.()), t4 && (s3(this, i5), o2(this));
  }
  setValue(t4) {
    if (r2(this._$Ct)) this._$Ct._$AI(t4, this);
    else {
      const i5 = [...this._$Ct._$AH];
      i5[this._$Ci] = t4, this._$Ct._$AI(i5, this, 0);
    }
  }
  disconnected() {
  }
  reconnected() {
  }
};

// node_modules/lit-html/directives/ref.js
var o3 = /* @__PURE__ */ new WeakMap();
var n3 = e2(class extends f2 {
  render(i5) {
    return A;
  }
  update(i5, [s4]) {
    const e3 = s4 !== this.G;
    return e3 && this.rt(void 0), (e3 || this.lt !== this.ct) && (this.G = s4, this.ht = i5.options?.host, this.rt(this.ct = i5.element)), A;
  }
  rt(t4) {
    if (void 0 !== this.G) if (this.isConnected || (t4 = void 0), "function" == typeof this.G) {
      const i5 = this.ht ?? globalThis;
      let s4 = o3.get(i5);
      void 0 === s4 && (s4 = /* @__PURE__ */ new WeakMap(), o3.set(i5, s4)), void 0 !== s4.get(this.G) && this.G.call(this.ht, void 0), s4.set(this.G, t4), void 0 !== t4 && this.G.call(this.ht, t4);
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

// node_modules/lit-html/directives/repeat.js
var u3 = (e3, s4, t4) => {
  const r4 = /* @__PURE__ */ new Map();
  for (let l2 = s4; l2 <= t4; l2++) r4.set(e3[l2], l2);
  return r4;
};
var c3 = e2(class extends i2 {
  constructor(e3) {
    if (super(e3), e3.type !== t2.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e3, s4, t4) {
    let r4;
    void 0 === t4 ? t4 = s4 : void 0 !== s4 && (r4 = s4);
    const l2 = [], o4 = [];
    let i5 = 0;
    for (const s5 of e3) l2[i5] = r4 ? r4(s5, i5) : i5, o4[i5] = t4(s5, i5), i5++;
    return { values: o4, keys: l2 };
  }
  render(e3, s4, t4) {
    return this.dt(e3, s4, t4).values;
  }
  update(s4, [t4, r4, c4]) {
    const d2 = M2(s4), { values: p3, keys: a2 } = this.dt(t4, r4, c4);
    if (!Array.isArray(d2)) return this.ut = a2, p3;
    const h4 = this.ut ??= [], v3 = [];
    let m3, y2, x2 = 0, j2 = d2.length - 1, k2 = 0, w2 = p3.length - 1;
    for (; x2 <= j2 && k2 <= w2; ) if (null === d2[x2]) x2++;
    else if (null === d2[j2]) j2--;
    else if (h4[x2] === a2[k2]) v3[k2] = u2(d2[x2], p3[k2]), x2++, k2++;
    else if (h4[j2] === a2[w2]) v3[w2] = u2(d2[j2], p3[w2]), j2--, w2--;
    else if (h4[x2] === a2[w2]) v3[w2] = u2(d2[x2], p3[w2]), v2(s4, v3[w2 + 1], d2[x2]), x2++, w2--;
    else if (h4[j2] === a2[k2]) v3[k2] = u2(d2[j2], p3[k2]), v2(s4, d2[x2], d2[j2]), j2--, k2++;
    else if (void 0 === m3 && (m3 = u3(a2, k2, w2), y2 = u3(h4, x2, j2)), m3.has(h4[x2])) if (m3.has(h4[j2])) {
      const e3 = y2.get(a2[k2]), t5 = void 0 !== e3 ? d2[e3] : null;
      if (null === t5) {
        const e4 = v2(s4, d2[x2]);
        u2(e4, p3[k2]), v3[k2] = e4;
      } else v3[k2] = u2(t5, p3[k2]), v2(s4, d2[x2], t5), d2[e3] = null;
      k2++;
    } else h2(d2[j2]), j2--;
    else h2(d2[x2]), x2++;
    for (; k2 <= w2; ) {
      const e3 = v2(s4, v3[w2 + 1]);
      u2(e3, p3[k2]), v3[k2++] = e3;
    }
    for (; x2 <= j2; ) {
      const e3 = d2[x2++];
      null !== e3 && h2(e3);
    }
    return this.ut = a2, p2(s4, v3), E;
  }
});
export {
  b as html,
  i4 as keyed,
  n3 as ref,
  D as render,
  c3 as repeat
};
/*! Bundled license information:

lit-html/lit-html.js:
lit-html/directive.js:
lit-html/async-directive.js:
lit-html/directives/repeat.js:
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
