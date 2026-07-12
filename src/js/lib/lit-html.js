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
var x = (t4) => (i4, ...s3) => ({ _$litType$: t4, strings: i4, values: s3 });
var b = x(1);
var w = x(2);
var T = x(3);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t4, i4) {
  if (!u(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i4) : i4;
}
var N = (t4, i4) => {
  const s3 = t4.length - 1, e3 = [];
  let n4, l2 = 2 === i4 ? "<svg>" : 3 === i4 ? "<math>" : "", c3 = v;
  for (let i5 = 0; i5 < s3; i5++) {
    const s4 = t4[i5];
    let a2, u2, d2 = -1, f3 = 0;
    for (; f3 < s4.length && (c3.lastIndex = f3, u2 = c3.exec(s4), null !== u2); ) f3 = c3.lastIndex, c3 === v ? "!--" === u2[1] ? c3 = _ : void 0 !== u2[1] ? c3 = m : void 0 !== u2[2] ? (y.test(u2[2]) && (n4 = RegExp("</" + u2[2], "g")), c3 = p) : void 0 !== u2[3] && (c3 = p) : c3 === p ? ">" === u2[0] ? (c3 = n4 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c3.lastIndex - u2[2].length, a2 = u2[1], c3 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c3 === $ || c3 === g ? c3 = p : c3 === _ || c3 === m ? c3 = v : (c3 = p, n4 = void 0);
    const x2 = c3 === p && t4[i5 + 1].startsWith("/>") ? " " : "";
    l2 += c3 === v ? s4 + r : d2 >= 0 ? (e3.push(a2), s4.slice(0, d2) + h + s4.slice(d2) + o + x2) : s4 + o + (-2 === d2 ? i5 : x2);
  }
  return [V(t4, l2 + (t4[s3] || "<?>") + (2 === i4 ? "</svg>" : 3 === i4 ? "</math>" : "")), e3];
};
var S = class _S {
  constructor({ strings: t4, _$litType$: i4 }, e3) {
    let r4;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t4.length - 1, d2 = this.parts, [f3, v2] = N(t4, i4);
    if (this.el = _S.createElement(f3, e3), P.currentNode = this.el.content, 2 === i4 || 3 === i4) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r4 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r4.nodeType) {
        if (r4.hasAttributes()) for (const t5 of r4.getAttributeNames()) if (t5.endsWith(h)) {
          const i5 = v2[a2++], s3 = r4.getAttribute(t5).split(o), e4 = /([.?@])?(.*)/.exec(i5);
          d2.push({ type: 1, index: l2, name: e4[2], strings: s3, ctor: "." === e4[1] ? I : "?" === e4[1] ? L : "@" === e4[1] ? z : H }), r4.removeAttribute(t5);
        } else t5.startsWith(o) && (d2.push({ type: 6, index: l2 }), r4.removeAttribute(t5));
        if (y.test(r4.tagName)) {
          const t5 = r4.textContent.split(o), i5 = t5.length - 1;
          if (i5 > 0) {
            r4.textContent = s ? s.emptyScript : "";
            for (let s3 = 0; s3 < i5; s3++) r4.append(t5[s3], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r4.append(t5[i5], c());
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
  static createElement(t4, i4) {
    const s3 = l.createElement("template");
    return s3.innerHTML = t4, s3;
  }
};
function M(t4, i4, s3 = t4, e3) {
  if (i4 === E) return i4;
  let h3 = void 0 !== e3 ? s3._$Co?.[e3] : s3._$Cl;
  const o4 = a(i4) ? void 0 : i4._$litDirective$;
  return h3?.constructor !== o4 && (h3?._$AO?.(false), void 0 === o4 ? h3 = void 0 : (h3 = new o4(t4), h3._$AT(t4, s3, e3)), void 0 !== e3 ? (s3._$Co ??= [])[e3] = h3 : s3._$Cl = h3), void 0 !== h3 && (i4 = M(t4, h3._$AS(t4, i4.values), h3, e3)), i4;
}
var R = class {
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
    const { el: { content: i4 }, parts: s3 } = this._$AD, e3 = (t4?.creationScope ?? l).importNode(i4, true);
    P.currentNode = e3;
    let h3 = P.nextNode(), o4 = 0, n4 = 0, r4 = s3[0];
    for (; void 0 !== r4; ) {
      if (o4 === r4.index) {
        let i5;
        2 === r4.type ? i5 = new k(h3, h3.nextSibling, this, t4) : 1 === r4.type ? i5 = new r4.ctor(h3, r4.name, r4.strings, this, t4) : 6 === r4.type && (i5 = new Z(h3, this, t4)), this._$AV.push(i5), r4 = s3[++n4];
      }
      o4 !== r4?.index && (h3 = P.nextNode(), o4++);
    }
    return P.currentNode = l, e3;
  }
  p(t4) {
    let i4 = 0;
    for (const s3 of this._$AV) void 0 !== s3 && (void 0 !== s3.strings ? (s3._$AI(t4, s3, i4), i4 += s3.strings.length - 2) : s3._$AI(t4[i4])), i4++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i4, s3, e3) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i4, this._$AM = s3, this.options = e3, this._$Cv = e3?.isConnected ?? true;
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
    t4 = M(this, t4, i4), a(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d(t4) ? this.k(t4) : this._(t4);
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
    const { values: i4, _$litType$: s3 } = t4, e3 = "number" == typeof s3 ? this._$AC(t4) : (void 0 === s3.el && (s3.el = S.createElement(V(s3.h, s3.h[0]), this.options)), s3);
    if (this._$AH?._$AD === e3) this._$AH.p(i4);
    else {
      const t5 = new R(e3, this), s4 = t5.u(this.options);
      t5.p(i4), this.T(s4), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i4 = C.get(t4.strings);
    return void 0 === i4 && C.set(t4.strings, i4 = new S(t4)), i4;
  }
  k(t4) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i4 = this._$AH;
    let s3, e3 = 0;
    for (const h3 of t4) e3 === i4.length ? i4.push(s3 = new _k(this.O(c()), this.O(c()), this, this.options)) : s3 = i4[e3], s3._$AI(h3), e3++;
    e3 < i4.length && (this._$AR(s3 && s3._$AB.nextSibling, e3), i4.length = e3);
  }
  _$AR(t4 = this._$AA.nextSibling, s3) {
    for (this._$AP?.(false, true, s3); t4 !== this._$AB; ) {
      const s4 = i(t4).nextSibling;
      i(t4).remove(), t4 = s4;
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
  constructor(t4, i4, s3, e3, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i4, this._$AM = e3, this.options = h3, s3.length > 2 || "" !== s3[0] || "" !== s3[1] ? (this._$AH = Array(s3.length - 1).fill(new String()), this.strings = s3) : this._$AH = A;
  }
  _$AI(t4, i4 = this, s3, e3) {
    const h3 = this.strings;
    let o4 = false;
    if (void 0 === h3) t4 = M(this, t4, i4, 0), o4 = !a(t4) || t4 !== this._$AH && t4 !== E, o4 && (this._$AH = t4);
    else {
      const e4 = t4;
      let n4, r4;
      for (t4 = h3[0], n4 = 0; n4 < h3.length - 1; n4++) r4 = M(this, e4[s3 + n4], i4, n4), r4 === E && (r4 = this._$AH[n4]), o4 ||= !a(r4) || r4 !== this._$AH[n4], r4 === A ? t4 = A : t4 !== A && (t4 += (r4 ?? "") + h3[n4 + 1]), this._$AH[n4] = r4;
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
  constructor(t4, i4, s3, e3, h3) {
    super(t4, i4, s3, e3, h3), this.type = 5;
  }
  _$AI(t4, i4 = this) {
    if ((t4 = M(this, t4, i4, 0) ?? A) === E) return;
    const s3 = this._$AH, e3 = t4 === A && s3 !== A || t4.capture !== s3.capture || t4.once !== s3.once || t4.passive !== s3.passive, h3 = t4 !== A && (s3 === A || e3);
    e3 && this.element.removeEventListener(this.name, this, s3), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i4, s3) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i4, this.options = s3;
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
var D = (t4, i4, s3) => {
  const e3 = s3?.renderBefore ?? i4;
  let h3 = e3._$litPart$;
  if (void 0 === h3) {
    const t5 = s3?.renderBefore ?? null;
    e3._$litPart$ = h3 = new k(i4.insertBefore(c(), t5), t5, void 0, s3 ?? {});
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
var { I: t3 } = j;
var r2 = (o4) => void 0 === o4.strings;
var m2 = {};
var p2 = (o4, t4 = m2) => o4._$AH = t4;

// node_modules/lit-html/directives/keyed.js
var i3 = e2(class extends i2 {
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
var s2 = (i4, t4) => {
  const e3 = i4._$AN;
  if (void 0 === e3) return false;
  for (const i5 of e3) i5._$AO?.(t4, false), s2(i5, t4);
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
    e3.add(i4), c2(t4);
  }
};
function h2(i4) {
  void 0 !== this._$AN ? (o2(this), this._$AM = i4, r3(this)) : this._$AM = i4;
}
function n2(i4, t4 = false, e3 = 0) {
  const r4 = this._$AH, h3 = this._$AN;
  if (void 0 !== h3 && 0 !== h3.size) if (t4) if (Array.isArray(r4)) for (let i5 = e3; i5 < r4.length; i5++) s2(r4[i5], false), o2(r4[i5]);
  else null != r4 && (s2(r4, false), o2(r4));
  else s2(this, i4);
}
var c2 = (i4) => {
  i4.type == t2.CHILD && (i4._$AP ??= n2, i4._$AQ ??= h2);
};
var f2 = class extends i2 {
  constructor() {
    super(...arguments), this._$AN = void 0;
  }
  _$AT(i4, t4, e3) {
    super._$AT(i4, t4, e3), r3(this), this.isConnected = i4._$AU;
  }
  _$AO(i4, t4 = true) {
    i4 !== this.isConnected && (this.isConnected = i4, i4 ? this.reconnected?.() : this.disconnected?.()), t4 && (s2(this, i4), o2(this));
  }
  setValue(t4) {
    if (r2(this._$Ct)) this._$Ct._$AI(t4, this);
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
var n3 = e2(class extends f2 {
  render(i4) {
    return A;
  }
  update(i4, [s3]) {
    const e3 = s3 !== this.G;
    return e3 && this.rt(void 0), (e3 || this.lt !== this.ct) && (this.G = s3, this.ht = i4.options?.host, this.rt(this.ct = i4.element)), A;
  }
  rt(t4) {
    if (void 0 !== this.G) if (this.isConnected || (t4 = void 0), "function" == typeof this.G) {
      const i4 = this.ht ?? globalThis;
      let s3 = o3.get(i4);
      void 0 === s3 && (s3 = /* @__PURE__ */ new WeakMap(), o3.set(i4, s3)), void 0 !== s3.get(this.G) && this.G.call(this.ht, void 0), s3.set(this.G, t4), void 0 !== t4 && this.G.call(this.ht, t4);
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
  b as html,
  i3 as keyed,
  n3 as ref,
  D as render
};
/*! Bundled license information:

lit-html/lit-html.js:
lit-html/directive.js:
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
