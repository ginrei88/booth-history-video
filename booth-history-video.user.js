// ==UserScript==
// @name         BOOTH履歴ムービー（非公式）
// @namespace    booth-history-video
// @version      0.8.1
// @description  BOOTHの購入・ギフト履歴を動画にします。データはあなたのブラウザから出ません。BOOTH/pixivの公式ツールではありません。
// @match        https://accounts.booth.pm/orders*
// @match        https://accounts.booth.pm/library*
// @icon         https://booth.pm/favicon.ico
// @license      MIT
// @homepageURL  https://github.com/ginrei88/booth-history-video
// @supportURL   https://github.com/ginrei88/booth-history-video/issues
// @updateURL    https://raw.githubusercontent.com/ginrei88/booth-history-video/main/booth-history-video.user.js
// @downloadURL  https://raw.githubusercontent.com/ginrei88/booth-history-video/main/booth-history-video.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_registerMenuCommand
// @connect      booth.pximg.net
// @connect      booth.pm
// @run-at       document-idle
// @noframes
// ==/UserScript==
/* 同梱：mp4-muxer v5.2.1 (MIT License, Copyright (c) 2023 Vanilagy)
              https://github.com/Vanilagy/mp4-muxer  ライセンス全文はこのファイルの中にあります。

   本ツールは BOOTH / pixiv の公式ツールではありません。ピクシブ株式会社とは関係ありません。
   BOOTH および pixiv はピクシブ株式会社の登録商標です。
   本ソフトウェアは現状有姿で提供されます。損害について作者は責任を負いません。 */

(function(){
'use strict';
if (window.__bhv) return; window.__bhv = true;

/* ---- 呼び出しボタン ----
   浮かせる場所が無い。右下はBOOTHの「上に戻る」と「?」、
   左下は「Booth購入金額集計ツール」が先に使っている。
   だから、まずページの中（購入履歴の見出しの下）に置く。それが無理なときだけ浮かせる。
   どちらも駄目でも、Tampermonkeyのメニューから開ける */
let root=null;
const btn = document.createElement('button');
btn.textContent = '履歴を動画にする';
const BTN_LOOK = 'background:#c9503f;color:#fff;border:0;border-radius:4px;padding:11px 20px;'
               + 'font-size:14px;font-weight:700;cursor:pointer;'
               + 'font-family:"Hiragino Sans","Yu Gothic UI",sans-serif';

function placeInPage(){
  const head = [...document.querySelectorAll('h1,h2,h3')]
    .find(e => /購入履歴|ライブラリ/.test((e.textContent||'').trim()));
  if(!head || !head.parentElement) return false;
  const box = document.createElement('div');
  box.setAttribute('style','text-align:center;margin:14px 0 4px');
  btn.setAttribute('style', BTN_LOOK);
  box.appendChild(btn);
  head.parentElement.insertBefore(box, head.nextSibling);
  return true;
}
function placeFloating(){
  // 最後の逃げ道。右下だが、BOOTHの丸ボタンより上に置く
  btn.setAttribute('style', BTN_LOOK
    + ';position:fixed;right:18px;bottom:104px;z-index:2147483646;box-shadow:0 4px 18px rgba(0,0,0,.35)');
  document.body.appendChild(btn);
}
if(!placeInPage()) placeFloating();

const open = () => { if(!root) build(); root.style.display='flex'; document.body.style.overflow='hidden'; };
btn.onclick = open;
if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('履歴を動画にする', open);


/* ---- 作業台。BOOTHのCSSに影響されないよう、見た目は自分で全部書く。
       スマホでも使えるように、狭い画面では字とボタンを大きくして折り返す ---- */
const CSS = `
#bhv-root{position:fixed;inset:0;z-index:2147483647;background:#0a0908;display:none;
  flex-direction:column;color:#e6e1d8;
  font-family:"Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif;
  -webkit-text-size-adjust:100%;}
#bhv-root *{box-sizing:border-box;}
#bhv-bar{padding:10px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;
  background:#1a1817;border-bottom:1px solid #2a2725;}
#bhv-bar button{background:#332f2c;color:#fff;border:0;border-radius:6px;
  padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
  -webkit-appearance:none;touch-action:manipulation;}
#bhv-bar button.go{background:#c9503f;}
#bhv-bar button:disabled{opacity:.5;}
#bhv-bar label,#bhv-bar .t{font-size:13px;color:#8a8177;display:flex;align-items:center;gap:6px;}
#bhv-bar .pick{gap:10px;padding:0 4px;flex-wrap:wrap;}
#bhv-bar .pick label{color:#e6e1d8;}
#bhv-bar input[type=checkbox]{width:18px;height:18px;}
#bhv-bar input[type=range]{width:120px;vertical-align:middle;}
#bhv-bar select{background:#332f2c;color:#fff;border:0;border-radius:6px;padding:8px 6px;
  font-size:13px;font-family:inherit;-webkit-appearance:none;appearance:none;}
#bhv-bar select:disabled{opacity:.45;}
#bhv-bar #bhv-pnote{width:100%;font-size:12px;color:#8a8177;line-height:1.4;}
#bhv-status{margin-left:auto;font-size:13px;color:#8a8177;}
#bhv-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;}
#bhv-cv{max-width:100%;max-height:100%;background:#000;}
@media (max-width:820px){
  #bhv-bar{padding:8px;gap:6px;}
  #bhv-bar button{padding:12px 14px;font-size:15px;flex:1 1 auto;min-width:44%;}
  #bhv-bar button.wide{min-width:100%;}
  #bhv-status{margin-left:0;width:100%;order:99;font-size:12px;line-height:1.4;}
  #bhv-bar label,#bhv-bar .t{font-size:13px;}
  #bhv-bar .pick,#bhv-bar .range{width:100%;justify-content:space-between;gap:4px;}
  #bhv-bar select{flex:1 1 auto;font-size:15px;padding:10px 6px;}
  #bhv-bar input[type=range]{width:90px;}
  #bhv-stage{padding:6px;}
}`;
function build(){
  const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  root=document.createElement('div'); root.id='bhv-root';
  root.innerHTML =
   '<div id="bhv-bar">'
  +  '<button id="bhv-grab" class="go wide">① まずこれを押す</button>'
  +  '<span class="t pick">出すもの'
  +    '<label><input id="bhv-pbuy" type="checkbox" checked>買った</label>'
  +    '<label><input id="bhv-psent" type="checkbox" checked>贈った</label>'
  +    '<label><input id="bhv-precv" type="checkbox" checked>もらった</label>'
  +  '</span>'
  +  '<span class="t range">期間'
  +    '<select id="bhv-yfrom" disabled><option value="">最初から</option></select>—'
  +    '<select id="bhv-yto" disabled><option value="">最後まで</option></select>'
  +  '</span>'
  +  '<label><input id="bhv-thumb" type="checkbox" checked>サムネを使う</label>'
  +  '<label><input id="bhv-light" type="checkbox">軽くする(720p)</label>'
  +  '<span class="t">長さ <input id="bhv-dur" type="range" min="40" max="240" value="40"><b id="bhv-durv">40</b>秒</span>'
  +  '<button id="bhv-play">もう一度見る</button>'
  +  '<button id="bhv-rec" class="go">② 動画にする</button>'
  +  '<button id="bhv-close">閉じる</button>'
  +  '<span id="bhv-status"></span>'
  +  '<span class="t" id="bhv-pnote" style="display:none"></span>'
  +'</div>'
  +'<div id="bhv-stage"><canvas id="bhv-cv" width="1920" height="1080"></canvas></div>';
  document.body.appendChild(root);
  root.querySelector('#bhv-close').onclick=()=>{ root.style.display='none'; document.body.style.overflow=''; };
  // 画面が狭い＝スマホとみなして、最初から軽い方にしておく（メモリで落ちないように）
  if(Math.min(screen.width,screen.height)<600) root.querySelector('#bhv-light').checked=true;
  boot();
}

/* ---- ここから動画の中身。試作/booth_video.html から自動で持ってきている ---- */
function boot(){
/* mp4-muxer v5.2.1 — https://github.com/Vanilagy/mp4-muxer
   ブラウザの中で mp4 を組み立てるためのライブラリ。同梱している。改変なし。
   取得元 https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js （圧縮していない版）
   ⚠️ 圧縮版（.min.js）は Greasy Fork の規約（読めないコードの禁止）に触れるので使わない。
   MITライセンスなので、著作権表示とライセンス全文を残す義務がある。以下がその全文。

   MIT License
   
   Copyright (c) 2023 Vanilagy
   
   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:
   
   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.
   
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
*/
"use strict";
var Mp4Muxer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __accessCheck = (obj, member, msg) => {
    if (!member.has(obj))
      throw TypeError("Cannot " + msg);
  };
  var __privateGet = (obj, member, getter) => {
    __accessCheck(obj, member, "read from private field");
    return getter ? getter.call(obj) : member.get(obj);
  };
  var __privateAdd = (obj, member, value) => {
    if (member.has(obj))
      throw TypeError("Cannot add the same private member more than once");
    member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  };
  var __privateSet = (obj, member, value, setter) => {
    __accessCheck(obj, member, "write to private field");
    setter ? setter.call(obj, value) : member.set(obj, value);
    return value;
  };
  var __privateWrapper = (obj, member, setter, getter) => ({
    set _(value) {
      __privateSet(obj, member, value, setter);
    },
    get _() {
      return __privateGet(obj, member, getter);
    }
  });
  var __privateMethod = (obj, member, method) => {
    __accessCheck(obj, member, "access private method");
    return method;
  };

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    ArrayBufferTarget: () => ArrayBufferTarget,
    FileSystemWritableFileStreamTarget: () => FileSystemWritableFileStreamTarget,
    Muxer: () => Muxer,
    StreamTarget: () => StreamTarget
  });

  // src/misc.ts
  var bytes = new Uint8Array(8);
  var view = new DataView(bytes.buffer);
  var u8 = (value) => {
    return [(value % 256 + 256) % 256];
  };
  var u16 = (value) => {
    view.setUint16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var i16 = (value) => {
    view.setInt16(0, value, false);
    return [bytes[0], bytes[1]];
  };
  var u24 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[1], bytes[2], bytes[3]];
  };
  var u32 = (value) => {
    view.setUint32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var i32 = (value) => {
    view.setInt32(0, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var u64 = (value) => {
    view.setUint32(0, Math.floor(value / 2 ** 32), false);
    view.setUint32(4, value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]];
  };
  var fixed_8_8 = (value) => {
    view.setInt16(0, 2 ** 8 * value, false);
    return [bytes[0], bytes[1]];
  };
  var fixed_16_16 = (value) => {
    view.setInt32(0, 2 ** 16 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var fixed_2_30 = (value) => {
    view.setInt32(0, 2 ** 30 * value, false);
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  };
  var ascii = (text, nullTerminated = false) => {
    let bytes2 = Array(text.length).fill(null).map((_, i) => text.charCodeAt(i));
    if (nullTerminated)
      bytes2.push(0);
    return bytes2;
  };
  var last = (arr) => {
    return arr && arr[arr.length - 1];
  };
  var lastPresentedSample = (samples) => {
    let result = void 0;
    for (let sample of samples) {
      if (!result || sample.presentationTimestamp > result.presentationTimestamp) {
        result = sample;
      }
    }
    return result;
  };
  var intoTimescale = (timeInSeconds, timescale, round = true) => {
    let value = timeInSeconds * timescale;
    return round ? Math.round(value) : value;
  };
  var rotationMatrix = (rotationInDegrees) => {
    let theta = rotationInDegrees * (Math.PI / 180);
    let cosTheta = Math.cos(theta);
    let sinTheta = Math.sin(theta);
    return [
      cosTheta,
      sinTheta,
      0,
      -sinTheta,
      cosTheta,
      0,
      0,
      0,
      1
    ];
  };
  var IDENTITY_MATRIX = rotationMatrix(0);
  var matrixToBytes = (matrix) => {
    return [
      fixed_16_16(matrix[0]),
      fixed_16_16(matrix[1]),
      fixed_2_30(matrix[2]),
      fixed_16_16(matrix[3]),
      fixed_16_16(matrix[4]),
      fixed_2_30(matrix[5]),
      fixed_16_16(matrix[6]),
      fixed_16_16(matrix[7]),
      fixed_2_30(matrix[8])
    ];
  };
  var deepClone = (x) => {
    if (!x)
      return x;
    if (typeof x !== "object")
      return x;
    if (Array.isArray(x))
      return x.map(deepClone);
    return Object.fromEntries(Object.entries(x).map(([key, value]) => [key, deepClone(value)]));
  };
  var isU32 = (value) => {
    return value >= 0 && value < 2 ** 32;
  };

  // src/box.ts
  var box = (type, contents, children) => ({
    type,
    contents: contents && new Uint8Array(contents.flat(10)),
    children
  });
  var fullBox = (type, version, flags, contents, children) => box(
    type,
    [u8(version), u24(flags), contents ?? []],
    children
  );
  var ftyp = (details) => {
    let minorVersion = 512;
    if (details.fragmented)
      return box("ftyp", [
        ascii("iso5"),
        // Major brand
        u32(minorVersion),
        // Minor version
        // Compatible brands
        ascii("iso5"),
        ascii("iso6"),
        ascii("mp41")
      ]);
    return box("ftyp", [
      ascii("isom"),
      // Major brand
      u32(minorVersion),
      // Minor version
      // Compatible brands
      ascii("isom"),
      details.holdsAvc ? ascii("avc1") : [],
      ascii("mp41")
    ]);
  };
  var mdat = (reserveLargeSize) => ({ type: "mdat", largeSize: reserveLargeSize });
  var free = (size) => ({ type: "free", size });
  var moov = (tracks, creationTime, fragmented = false) => box("moov", null, [
    mvhd(creationTime, tracks),
    ...tracks.map((x) => trak(x, creationTime)),
    fragmented ? mvex(tracks) : null
  ]);
  var mvhd = (creationTime, tracks) => {
    let duration = intoTimescale(Math.max(
      0,
      ...tracks.filter((x) => x.samples.length > 0).map((x) => {
        const lastSample = lastPresentedSample(x.samples);
        return lastSample.presentationTimestamp + lastSample.duration;
      })
    ), GLOBAL_TIMESCALE);
    let nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1;
    let needsU64 = !isU32(creationTime) || !isU32(duration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mvhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(GLOBAL_TIMESCALE),
      // Timescale
      u32OrU64(duration),
      // Duration
      fixed_16_16(1),
      // Preferred rate
      fixed_8_8(1),
      // Preferred volume
      Array(10).fill(0),
      // Reserved
      matrixToBytes(IDENTITY_MATRIX),
      // Matrix
      Array(24).fill(0),
      // Pre-defined
      u32(nextTrackId)
      // Next track ID
    ]);
  };
  var trak = (track, creationTime) => box("trak", null, [
    tkhd(track, creationTime),
    mdia(track, creationTime)
  ]);
  var tkhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let durationInGlobalTimescale = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      GLOBAL_TIMESCALE
    );
    let needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale);
    let u32OrU64 = needsU64 ? u64 : u32;
    let matrix;
    if (track.info.type === "video") {
      matrix = typeof track.info.rotation === "number" ? rotationMatrix(track.info.rotation) : track.info.rotation;
    } else {
      matrix = IDENTITY_MATRIX;
    }
    return fullBox("tkhd", +needsU64, 3, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.id),
      // Track ID
      u32(0),
      // Reserved
      u32OrU64(durationInGlobalTimescale),
      // Duration
      Array(8).fill(0),
      // Reserved
      u16(0),
      // Layer
      u16(0),
      // Alternate group
      fixed_8_8(track.info.type === "audio" ? 1 : 0),
      // Volume
      u16(0),
      // Reserved
      matrixToBytes(matrix),
      // Matrix
      fixed_16_16(track.info.type === "video" ? track.info.width : 0),
      // Track width
      fixed_16_16(track.info.type === "video" ? track.info.height : 0)
      // Track height
    ]);
  };
  var mdia = (track, creationTime) => box("mdia", null, [
    mdhd(track, creationTime),
    hdlr(track.info.type === "video" ? "vide" : "soun"),
    minf(track)
  ]);
  var mdhd = (track, creationTime) => {
    let lastSample = lastPresentedSample(track.samples);
    let localDuration = intoTimescale(
      lastSample ? lastSample.presentationTimestamp + lastSample.duration : 0,
      track.timescale
    );
    let needsU64 = !isU32(creationTime) || !isU32(localDuration);
    let u32OrU64 = needsU64 ? u64 : u32;
    return fullBox("mdhd", +needsU64, 0, [
      u32OrU64(creationTime),
      // Creation time
      u32OrU64(creationTime),
      // Modification time
      u32(track.timescale),
      // Timescale
      u32OrU64(localDuration),
      // Duration
      u16(21956),
      // Language ("und", undetermined)
      u16(0)
      // Quality
    ]);
  };
  var hdlr = (componentSubtype) => fullBox("hdlr", 0, 0, [
    ascii("mhlr"),
    // Component type
    ascii(componentSubtype),
    // Component subtype
    u32(0),
    // Component manufacturer
    u32(0),
    // Component flags
    u32(0),
    // Component flags mask
    ascii("mp4-muxer-hdlr", true)
    // Component name
  ]);
  var minf = (track) => box("minf", null, [
    track.info.type === "video" ? vmhd() : smhd(),
    dinf(),
    stbl(track)
  ]);
  var vmhd = () => fullBox("vmhd", 0, 1, [
    u16(0),
    // Graphics mode
    u16(0),
    // Opcolor R
    u16(0),
    // Opcolor G
    u16(0)
    // Opcolor B
  ]);
  var smhd = () => fullBox("smhd", 0, 0, [
    u16(0),
    // Balance
    u16(0)
    // Reserved
  ]);
  var dinf = () => box("dinf", null, [
    dref()
  ]);
  var dref = () => fullBox("dref", 0, 0, [
    u32(1)
    // Entry count
  ], [
    url()
  ]);
  var url = () => fullBox("url ", 0, 1);
  var stbl = (track) => {
    const needsCtts = track.compositionTimeOffsetTable.length > 1 || track.compositionTimeOffsetTable.some((x) => x.sampleCompositionTimeOffset !== 0);
    return box("stbl", null, [
      stsd(track),
      stts(track),
      stss(track),
      stsc(track),
      stsz(track),
      stco(track),
      needsCtts ? ctts(track) : null
    ]);
  };
  var stsd = (track) => fullBox("stsd", 0, 0, [
    u32(1)
    // Entry count
  ], [
    track.info.type === "video" ? videoSampleDescription(
      VIDEO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    ) : soundSampleDescription(
      AUDIO_CODEC_TO_BOX_NAME[track.info.codec],
      track
    )
  ]);
  var videoSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Pre-defined
    u16(0),
    // Reserved
    Array(12).fill(0),
    // Pre-defined
    u16(track.info.width),
    // Width
    u16(track.info.height),
    // Height
    u32(4718592),
    // Horizontal resolution
    u32(4718592),
    // Vertical resolution
    u32(0),
    // Reserved
    u16(1),
    // Frame count
    Array(32).fill(0),
    // Compressor name
    u16(24),
    // Depth
    i16(65535)
    // Pre-defined
  ], [
    VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
    track.info.decoderConfig.colorSpace ? colr(track) : null
  ]);
  var COLOR_PRIMARIES_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // ITU-R BT.601 525 - SMPTE 170M
  };
  var TRANSFER_CHARACTERISTICS_MAP = {
    "bt709": 1,
    // ITU-R BT.709
    "smpte170m": 6,
    // SMPTE 170M
    "iec61966-2-1": 13
    // IEC 61966-2-1
  };
  var MATRIX_COEFFICIENTS_MAP = {
    "rgb": 0,
    // Identity
    "bt709": 1,
    // ITU-R BT.709
    "bt470bg": 5,
    // ITU-R BT.470BG
    "smpte170m": 6
    // SMPTE 170M
  };
  var colr = (track) => box("colr", [
    ascii("nclx"),
    // Colour type
    u16(COLOR_PRIMARIES_MAP[track.info.decoderConfig.colorSpace.primaries]),
    // Colour primaries
    u16(TRANSFER_CHARACTERISTICS_MAP[track.info.decoderConfig.colorSpace.transfer]),
    // Transfer characteristics
    u16(MATRIX_COEFFICIENTS_MAP[track.info.decoderConfig.colorSpace.matrix]),
    // Matrix coefficients
    u8((track.info.decoderConfig.colorSpace.fullRange ? 1 : 0) << 7)
    // Full range flag
  ]);
  var avcC = (track) => track.info.decoderConfig && box("avcC", [
    // For AVC, description is an AVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var hvcC = (track) => track.info.decoderConfig && box("hvcC", [
    // For HEVC, description is a HEVCDecoderConfigurationRecord, so nothing else to do here
    ...new Uint8Array(track.info.decoderConfig.description)
  ]);
  var vpcC = (track) => {
    if (!track.info.decoderConfig) {
      return null;
    }
    let decoderConfig = track.info.decoderConfig;
    if (!decoderConfig.colorSpace) {
      throw new Error(`'colorSpace' is required in the decoder config for VP9.`);
    }
    let parts = decoderConfig.codec.split(".");
    let profile = Number(parts[1]);
    let level = Number(parts[2]);
    let bitDepth = Number(parts[3]);
    let chromaSubsampling = 0;
    let thirdByte = (bitDepth << 4) + (chromaSubsampling << 1) + Number(decoderConfig.colorSpace.fullRange);
    let colourPrimaries = 2;
    let transferCharacteristics = 2;
    let matrixCoefficients = 2;
    return fullBox("vpcC", 1, 0, [
      u8(profile),
      // Profile
      u8(level),
      // Level
      u8(thirdByte),
      // Bit depth, chroma subsampling, full range
      u8(colourPrimaries),
      // Colour primaries
      u8(transferCharacteristics),
      // Transfer characteristics
      u8(matrixCoefficients),
      // Matrix coefficients
      u16(0)
      // Codec initialization data size
    ]);
  };
  var av1C = () => {
    let marker = 1;
    let version = 1;
    let firstByte = (marker << 7) + version;
    return box("av1C", [
      firstByte,
      0,
      0,
      0
    ]);
  };
  var soundSampleDescription = (compressionType, track) => box(compressionType, [
    Array(6).fill(0),
    // Reserved
    u16(1),
    // Data reference index
    u16(0),
    // Version
    u16(0),
    // Revision level
    u32(0),
    // Vendor
    u16(track.info.numberOfChannels),
    // Number of channels
    u16(16),
    // Sample size (bits)
    u16(0),
    // Compression ID
    u16(0),
    // Packet size
    fixed_16_16(track.info.sampleRate)
    // Sample rate
  ], [
    AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track)
  ]);
  var esds = (track) => {
    let description = new Uint8Array(track.info.decoderConfig.description);
    return fullBox("esds", 0, 0, [
      // https://stackoverflow.com/a/54803118
      u32(58753152),
      // TAG(3) = Object Descriptor ([2])
      u8(32 + description.byteLength),
      // length of this OD (which includes the next 2 tags)
      u16(1),
      // ES_ID = 1
      u8(0),
      // flags etc = 0
      u32(75530368),
      // TAG(4) = ES Descriptor ([2]) embedded in above OD
      u8(18 + description.byteLength),
      // length of this ESD
      u8(64),
      // MPEG-4 Audio
      u8(21),
      // stream type(6bits)=5 audio, flags(2bits)=1
      u24(0),
      // 24bit buffer size
      u32(130071),
      // max bitrate
      u32(130071),
      // avg bitrate
      u32(92307584),
      // TAG(5) = ASC ([2],[3]) embedded in above OD
      u8(description.byteLength),
      // length
      ...description,
      u32(109084800),
      // TAG(6)
      u8(1),
      // length
      u8(2)
      // data
    ]);
  };
  var dOps = (track) => {
    let preskip = 3840;
    let gain = 0;
    const description = track.info.decoderConfig?.description;
    if (description) {
      if (description.byteLength < 18) {
        throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");
      }
      const view2 = ArrayBuffer.isView(description) ? new DataView(description.buffer, description.byteOffset, description.byteLength) : new DataView(description);
      preskip = view2.getUint16(10, true);
      gain = view2.getInt16(14, true);
    }
    return box("dOps", [
      u8(0),
      // Version
      u8(track.info.numberOfChannels),
      // OutputChannelCount
      u16(preskip),
      u32(track.info.sampleRate),
      // InputSampleRate
      fixed_8_8(gain),
      // OutputGain
      u8(0)
      // ChannelMappingFamily
    ]);
  };
  var stts = (track) => {
    return fullBox("stts", 0, 0, [
      u32(track.timeToSampleTable.length),
      // Number of entries
      track.timeToSampleTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleDelta)
        // Sample duration
      ])
    ]);
  };
  var stss = (track) => {
    if (track.samples.every((x) => x.type === "key"))
      return null;
    let keySamples = [...track.samples.entries()].filter(([, sample]) => sample.type === "key");
    return fullBox("stss", 0, 0, [
      u32(keySamples.length),
      // Number of entries
      keySamples.map(([index]) => u32(index + 1))
      // Sync sample table
    ]);
  };
  var stsc = (track) => {
    return fullBox("stsc", 0, 0, [
      u32(track.compactlyCodedChunkTable.length),
      // Number of entries
      track.compactlyCodedChunkTable.map((x) => [
        // Sample-to-chunk table
        u32(x.firstChunk),
        // First chunk
        u32(x.samplesPerChunk),
        // Samples per chunk
        u32(1)
        // Sample description index
      ])
    ]);
  };
  var stsz = (track) => fullBox("stsz", 0, 0, [
    u32(0),
    // Sample size (0 means non-constant size)
    u32(track.samples.length),
    // Number of entries
    track.samples.map((x) => u32(x.size))
    // Sample size table
  ]);
  var stco = (track) => {
    if (track.finalizedChunks.length > 0 && last(track.finalizedChunks).offset >= 2 ** 32) {
      return fullBox("co64", 0, 0, [
        u32(track.finalizedChunks.length),
        // Number of entries
        track.finalizedChunks.map((x) => u64(x.offset))
        // Chunk offset table
      ]);
    }
    return fullBox("stco", 0, 0, [
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((x) => u32(x.offset))
      // Chunk offset table
    ]);
  };
  var ctts = (track) => {
    return fullBox("ctts", 0, 0, [
      u32(track.compositionTimeOffsetTable.length),
      // Number of entries
      track.compositionTimeOffsetTable.map((x) => [
        // Time-to-sample table
        u32(x.sampleCount),
        // Sample count
        u32(x.sampleCompositionTimeOffset)
        // Sample offset
      ])
    ]);
  };
  var mvex = (tracks) => {
    return box("mvex", null, tracks.map(trex));
  };
  var trex = (track) => {
    return fullBox("trex", 0, 0, [
      u32(track.id),
      // Track ID
      u32(1),
      // Default sample description index
      u32(0),
      // Default sample duration
      u32(0),
      // Default sample size
      u32(0)
      // Default sample flags
    ]);
  };
  var moof = (sequenceNumber, tracks) => {
    return box("moof", null, [
      mfhd(sequenceNumber),
      ...tracks.map(traf)
    ]);
  };
  var mfhd = (sequenceNumber) => {
    return fullBox("mfhd", 0, 0, [
      u32(sequenceNumber)
      // Sequence number
    ]);
  };
  var fragmentSampleFlags = (sample) => {
    let byte1 = 0;
    let byte2 = 0;
    let byte3 = 0;
    let byte4 = 0;
    let sampleIsDifferenceSample = sample.type === "delta";
    byte2 |= +sampleIsDifferenceSample;
    if (sampleIsDifferenceSample) {
      byte1 |= 1;
    } else {
      byte1 |= 2;
    }
    return byte1 << 24 | byte2 << 16 | byte3 << 8 | byte4;
  };
  var traf = (track) => {
    return box("traf", null, [
      tfhd(track),
      tfdt(track),
      trun(track)
    ]);
  };
  var tfhd = (track) => {
    let tfFlags = 0;
    tfFlags |= 8;
    tfFlags |= 16;
    tfFlags |= 32;
    tfFlags |= 131072;
    let referenceSample = track.currentChunk.samples[1] ?? track.currentChunk.samples[0];
    let referenceSampleInfo = {
      duration: referenceSample.timescaleUnitsToNextSample,
      size: referenceSample.size,
      flags: fragmentSampleFlags(referenceSample)
    };
    return fullBox("tfhd", 0, tfFlags, [
      u32(track.id),
      // Track ID
      u32(referenceSampleInfo.duration),
      // Default sample duration
      u32(referenceSampleInfo.size),
      // Default sample size
      u32(referenceSampleInfo.flags)
      // Default sample flags
    ]);
  };
  var tfdt = (track) => {
    return fullBox("tfdt", 1, 0, [
      u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale))
      // Base Media Decode Time
    ]);
  };
  var trun = (track) => {
    let allSampleDurations = track.currentChunk.samples.map((x) => x.timescaleUnitsToNextSample);
    let allSampleSizes = track.currentChunk.samples.map((x) => x.size);
    let allSampleFlags = track.currentChunk.samples.map(fragmentSampleFlags);
    let allSampleCompositionTimeOffsets = track.currentChunk.samples.map((x) => intoTimescale(x.presentationTimestamp - x.decodeTimestamp, track.timescale));
    let uniqueSampleDurations = new Set(allSampleDurations);
    let uniqueSampleSizes = new Set(allSampleSizes);
    let uniqueSampleFlags = new Set(allSampleFlags);
    let uniqueSampleCompositionTimeOffsets = new Set(allSampleCompositionTimeOffsets);
    let firstSampleFlagsPresent = uniqueSampleFlags.size === 2 && allSampleFlags[0] !== allSampleFlags[1];
    let sampleDurationPresent = uniqueSampleDurations.size > 1;
    let sampleSizePresent = uniqueSampleSizes.size > 1;
    let sampleFlagsPresent = !firstSampleFlagsPresent && uniqueSampleFlags.size > 1;
    let sampleCompositionTimeOffsetsPresent = uniqueSampleCompositionTimeOffsets.size > 1 || [...uniqueSampleCompositionTimeOffsets].some((x) => x !== 0);
    let flags = 0;
    flags |= 1;
    flags |= 4 * +firstSampleFlagsPresent;
    flags |= 256 * +sampleDurationPresent;
    flags |= 512 * +sampleSizePresent;
    flags |= 1024 * +sampleFlagsPresent;
    flags |= 2048 * +sampleCompositionTimeOffsetsPresent;
    return fullBox("trun", 1, flags, [
      u32(track.currentChunk.samples.length),
      // Sample count
      u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0),
      // Data offset
      firstSampleFlagsPresent ? u32(allSampleFlags[0]) : [],
      track.currentChunk.samples.map((_, i) => [
        sampleDurationPresent ? u32(allSampleDurations[i]) : [],
        // Sample duration
        sampleSizePresent ? u32(allSampleSizes[i]) : [],
        // Sample size
        sampleFlagsPresent ? u32(allSampleFlags[i]) : [],
        // Sample flags
        // Sample composition time offsets
        sampleCompositionTimeOffsetsPresent ? i32(allSampleCompositionTimeOffsets[i]) : []
      ])
    ]);
  };
  var mfra = (tracks) => {
    return box("mfra", null, [
      ...tracks.map(tfra),
      mfro()
    ]);
  };
  var tfra = (track, trackIndex) => {
    let version = 1;
    return fullBox("tfra", version, 0, [
      u32(track.id),
      // Track ID
      u32(63),
      // This specifies that traf number, trun number and sample number are 32-bit ints
      u32(track.finalizedChunks.length),
      // Number of entries
      track.finalizedChunks.map((chunk) => [
        u64(intoTimescale(chunk.startTimestamp, track.timescale)),
        // Time
        u64(chunk.moofOffset),
        // moof offset
        u32(trackIndex + 1),
        // traf number
        u32(1),
        // trun number
        u32(1)
        // Sample number
      ])
    ]);
  };
  var mfro = () => {
    return fullBox("mfro", 0, 0, [
      // This value needs to be overwritten manually from the outside, where the actual size of the enclosing mfra box
      // is known
      u32(0)
      // Size
    ]);
  };
  var VIDEO_CODEC_TO_BOX_NAME = {
    "avc": "avc1",
    "hevc": "hvc1",
    "vp9": "vp09",
    "av1": "av01"
  };
  var VIDEO_CODEC_TO_CONFIGURATION_BOX = {
    "avc": avcC,
    "hevc": hvcC,
    "vp9": vpcC,
    "av1": av1C
  };
  var AUDIO_CODEC_TO_BOX_NAME = {
    "aac": "mp4a",
    "opus": "Opus"
  };
  var AUDIO_CODEC_TO_CONFIGURATION_BOX = {
    "aac": esds,
    "opus": dOps
  };

  // src/target.ts
  var isTarget = Symbol("isTarget");
  var Target = class {
  };
  isTarget;
  var ArrayBufferTarget = class extends Target {
    constructor() {
      super(...arguments);
      this.buffer = null;
    }
  };
  var StreamTarget = class extends Target {
    constructor(options) {
      super();
      this.options = options;
      if (typeof options !== "object") {
        throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");
      }
      if (options.onData) {
        if (typeof options.onData !== "function") {
          throw new TypeError("options.onData, when provided, must be a function.");
        }
        if (options.onData.length < 2) {
          throw new TypeError(
            "options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs."
          );
        }
      }
      if (options.chunked !== void 0 && typeof options.chunked !== "boolean") {
        throw new TypeError("options.chunked, when provided, must be a boolean.");
      }
      if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)) {
        throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.");
      }
    }
  };
  var FileSystemWritableFileStreamTarget = class extends Target {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.options = options;
      if (!(stream instanceof FileSystemWritableFileStream)) {
        throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");
      }
      if (options !== void 0 && typeof options !== "object") {
        throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");
      }
      if (options) {
        if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) {
          throw new TypeError("options.chunkSize, when provided, must be a positive integer");
        }
      }
    }
  };

  // src/writer.ts
  var _helper, _helperView;
  var Writer = class {
    constructor() {
      this.pos = 0;
      __privateAdd(this, _helper, new Uint8Array(8));
      __privateAdd(this, _helperView, new DataView(__privateGet(this, _helper).buffer));
      /**
       * Stores the position from the start of the file to where boxes elements have been written. This is used to
       * rewrite/edit elements that were already added before, and to measure sizes of things.
       */
      this.offsets = /* @__PURE__ */ new WeakMap();
    }
    /** Sets the current position for future writes to a new one. */
    seek(newPos) {
      this.pos = newPos;
    }
    writeU32(value) {
      __privateGet(this, _helperView).setUint32(0, value, false);
      this.write(__privateGet(this, _helper).subarray(0, 4));
    }
    writeU64(value) {
      __privateGet(this, _helperView).setUint32(0, Math.floor(value / 2 ** 32), false);
      __privateGet(this, _helperView).setUint32(4, value, false);
      this.write(__privateGet(this, _helper).subarray(0, 8));
    }
    writeAscii(text) {
      for (let i = 0; i < text.length; i++) {
        __privateGet(this, _helperView).setUint8(i % 8, text.charCodeAt(i));
        if (i % 8 === 7)
          this.write(__privateGet(this, _helper));
      }
      if (text.length % 8 !== 0) {
        this.write(__privateGet(this, _helper).subarray(0, text.length % 8));
      }
    }
    writeBox(box2) {
      this.offsets.set(box2, this.pos);
      if (box2.contents && !box2.children) {
        this.writeBoxHeader(box2, box2.size ?? box2.contents.byteLength + 8);
        this.write(box2.contents);
      } else {
        let startPos = this.pos;
        this.writeBoxHeader(box2, 0);
        if (box2.contents)
          this.write(box2.contents);
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              this.writeBox(child);
        }
        let endPos = this.pos;
        let size = box2.size ?? endPos - startPos;
        this.seek(startPos);
        this.writeBoxHeader(box2, size);
        this.seek(endPos);
      }
    }
    writeBoxHeader(box2, size) {
      this.writeU32(box2.largeSize ? 1 : size);
      this.writeAscii(box2.type);
      if (box2.largeSize)
        this.writeU64(size);
    }
    measureBoxHeader(box2) {
      return 8 + (box2.largeSize ? 8 : 0);
    }
    patchBox(box2) {
      let endPos = this.pos;
      this.seek(this.offsets.get(box2));
      this.writeBox(box2);
      this.seek(endPos);
    }
    measureBox(box2) {
      if (box2.contents && !box2.children) {
        let headerSize = this.measureBoxHeader(box2);
        return headerSize + box2.contents.byteLength;
      } else {
        let result = this.measureBoxHeader(box2);
        if (box2.contents)
          result += box2.contents.byteLength;
        if (box2.children) {
          for (let child of box2.children)
            if (child)
              result += this.measureBox(child);
        }
        return result;
      }
    }
  };
  _helper = new WeakMap();
  _helperView = new WeakMap();
  var _target, _buffer, _bytes, _maxPos, _ensureSize, ensureSize_fn;
  var ArrayBufferTargetWriter = class extends Writer {
    constructor(target) {
      super();
      __privateAdd(this, _ensureSize);
      __privateAdd(this, _target, void 0);
      __privateAdd(this, _buffer, new ArrayBuffer(2 ** 16));
      __privateAdd(this, _bytes, new Uint8Array(__privateGet(this, _buffer)));
      __privateAdd(this, _maxPos, 0);
      __privateSet(this, _target, target);
    }
    write(data) {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos + data.byteLength);
      __privateGet(this, _bytes).set(data, this.pos);
      this.pos += data.byteLength;
      __privateSet(this, _maxPos, Math.max(__privateGet(this, _maxPos), this.pos));
    }
    finalize() {
      __privateMethod(this, _ensureSize, ensureSize_fn).call(this, this.pos);
      __privateGet(this, _target).buffer = __privateGet(this, _buffer).slice(0, Math.max(__privateGet(this, _maxPos), this.pos));
    }
  };
  _target = new WeakMap();
  _buffer = new WeakMap();
  _bytes = new WeakMap();
  _maxPos = new WeakMap();
  _ensureSize = new WeakSet();
  ensureSize_fn = function(size) {
    let newLength = __privateGet(this, _buffer).byteLength;
    while (newLength < size)
      newLength *= 2;
    if (newLength === __privateGet(this, _buffer).byteLength)
      return;
    let newBuffer = new ArrayBuffer(newLength);
    let newBytes = new Uint8Array(newBuffer);
    newBytes.set(__privateGet(this, _bytes), 0);
    __privateSet(this, _buffer, newBuffer);
    __privateSet(this, _bytes, newBytes);
  };
  var DEFAULT_CHUNK_SIZE = 2 ** 24;
  var MAX_CHUNKS_AT_ONCE = 2;
  var _target2, _sections, _chunked, _chunkSize, _chunks, _writeDataIntoChunks, writeDataIntoChunks_fn, _insertSectionIntoChunk, insertSectionIntoChunk_fn, _createChunk, createChunk_fn, _flushChunks, flushChunks_fn;
  var StreamTargetWriter = class extends Writer {
    constructor(target) {
      super();
      __privateAdd(this, _writeDataIntoChunks);
      __privateAdd(this, _insertSectionIntoChunk);
      __privateAdd(this, _createChunk);
      __privateAdd(this, _flushChunks);
      __privateAdd(this, _target2, void 0);
      __privateAdd(this, _sections, []);
      __privateAdd(this, _chunked, void 0);
      __privateAdd(this, _chunkSize, void 0);
      /**
       * The data is divided up into fixed-size chunks, whose contents are first filled in RAM and then flushed out.
       * A chunk is flushed if all of its contents have been written.
       */
      __privateAdd(this, _chunks, []);
      __privateSet(this, _target2, target);
      __privateSet(this, _chunked, target.options?.chunked ?? false);
      __privateSet(this, _chunkSize, target.options?.chunkSize ?? DEFAULT_CHUNK_SIZE);
    }
    write(data) {
      __privateGet(this, _sections).push({
        data: data.slice(),
        start: this.pos
      });
      this.pos += data.byteLength;
    }
    flush() {
      if (__privateGet(this, _sections).length === 0)
        return;
      let chunks = [];
      let sorted = [...__privateGet(this, _sections)].sort((a, b) => a.start - b.start);
      chunks.push({
        start: sorted[0].start,
        size: sorted[0].data.byteLength
      });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1];
        let section = sorted[i];
        if (section.start <= lastChunk.start + lastChunk.size) {
          lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);
        } else {
          chunks.push({
            start: section.start,
            size: section.data.byteLength
          });
        }
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of __privateGet(this, _sections)) {
          if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {
            chunk.data.set(section.data, section.start - chunk.start);
          }
        }
        if (__privateGet(this, _chunked)) {
          __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, chunk.data, chunk.start);
          __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
        } else {
          __privateGet(this, _target2).options.onData?.(chunk.data, chunk.start);
        }
      }
      __privateGet(this, _sections).length = 0;
    }
    finalize() {
      if (__privateGet(this, _chunked)) {
        __privateMethod(this, _flushChunks, flushChunks_fn).call(this, true);
      }
    }
  };
  _target2 = new WeakMap();
  _sections = new WeakMap();
  _chunked = new WeakMap();
  _chunkSize = new WeakMap();
  _chunks = new WeakMap();
  _writeDataIntoChunks = new WeakSet();
  writeDataIntoChunks_fn = function(data, position) {
    let chunkIndex = __privateGet(this, _chunks).findIndex((x) => x.start <= position && position < x.start + __privateGet(this, _chunkSize));
    if (chunkIndex === -1)
      chunkIndex = __privateMethod(this, _createChunk, createChunk_fn).call(this, position);
    let chunk = __privateGet(this, _chunks)[chunkIndex];
    let relativePosition = position - chunk.start;
    let toWrite = data.subarray(0, Math.min(__privateGet(this, _chunkSize) - relativePosition, data.byteLength));
    chunk.data.set(toWrite, relativePosition);
    let section = {
      start: relativePosition,
      end: relativePosition + toWrite.byteLength
    };
    __privateMethod(this, _insertSectionIntoChunk, insertSectionIntoChunk_fn).call(this, chunk, section);
    if (chunk.written[0].start === 0 && chunk.written[0].end === __privateGet(this, _chunkSize)) {
      chunk.shouldFlush = true;
    }
    if (__privateGet(this, _chunks).length > MAX_CHUNKS_AT_ONCE) {
      for (let i = 0; i < __privateGet(this, _chunks).length - 1; i++) {
        __privateGet(this, _chunks)[i].shouldFlush = true;
      }
      __privateMethod(this, _flushChunks, flushChunks_fn).call(this);
    }
    if (toWrite.byteLength < data.byteLength) {
      __privateMethod(this, _writeDataIntoChunks, writeDataIntoChunks_fn).call(this, data.subarray(toWrite.byteLength), position + toWrite.byteLength);
    }
  };
  _insertSectionIntoChunk = new WeakSet();
  insertSectionIntoChunk_fn = function(chunk, section) {
    let low = 0;
    let high = chunk.written.length - 1;
    let index = -1;
    while (low <= high) {
      let mid = Math.floor(low + (high - low + 1) / 2);
      if (chunk.written[mid].start <= section.start) {
        low = mid + 1;
        index = mid;
      } else {
        high = mid - 1;
      }
    }
    chunk.written.splice(index + 1, 0, section);
    if (index === -1 || chunk.written[index].end < section.start)
      index++;
    while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {
      chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);
      chunk.written.splice(index + 1, 1);
    }
  };
  _createChunk = new WeakSet();
  createChunk_fn = function(includesPosition) {
    let start = Math.floor(includesPosition / __privateGet(this, _chunkSize)) * __privateGet(this, _chunkSize);
    let chunk = {
      start,
      data: new Uint8Array(__privateGet(this, _chunkSize)),
      written: [],
      shouldFlush: false
    };
    __privateGet(this, _chunks).push(chunk);
    __privateGet(this, _chunks).sort((a, b) => a.start - b.start);
    return __privateGet(this, _chunks).indexOf(chunk);
  };
  _flushChunks = new WeakSet();
  flushChunks_fn = function(force = false) {
    for (let i = 0; i < __privateGet(this, _chunks).length; i++) {
      let chunk = __privateGet(this, _chunks)[i];
      if (!chunk.shouldFlush && !force)
        continue;
      for (let section of chunk.written) {
        __privateGet(this, _target2).options.onData?.(
          chunk.data.subarray(section.start, section.end),
          chunk.start + section.start
        );
      }
      __privateGet(this, _chunks).splice(i--, 1);
    }
  };
  var FileSystemWritableFileStreamTargetWriter = class extends StreamTargetWriter {
    constructor(target) {
      super(new StreamTarget({
        onData: (data, position) => target.stream.write({
          type: "write",
          data,
          position
        }),
        chunked: true,
        chunkSize: target.options?.chunkSize
      }));
    }
  };

  // src/muxer.ts
  var GLOBAL_TIMESCALE = 1e3;
  var SUPPORTED_VIDEO_CODECS = ["avc", "hevc", "vp9", "av1"];
  var SUPPORTED_AUDIO_CODECS = ["aac", "opus"];
  var TIMESTAMP_OFFSET = 2082844800;
  var FIRST_TIMESTAMP_BEHAVIORS = ["strict", "offset", "cross-track-offset"];
  var _options, _writer, _ftypSize, _mdat, _videoTrack, _audioTrack, _creationTime, _finalizedChunks, _nextFragmentNumber, _videoSampleQueue, _audioSampleQueue, _finalized, _validateOptions, validateOptions_fn, _writeHeader, writeHeader_fn, _computeMoovSizeUpperBound, computeMoovSizeUpperBound_fn, _prepareTracks, prepareTracks_fn, _generateMpeg4AudioSpecificConfig, generateMpeg4AudioSpecificConfig_fn, _createSampleForTrack, createSampleForTrack_fn, _addSampleToTrack, addSampleToTrack_fn, _validateTimestamp, validateTimestamp_fn, _finalizeCurrentChunk, finalizeCurrentChunk_fn, _finalizeFragment, finalizeFragment_fn, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn, _ensureNotFinalized, ensureNotFinalized_fn;
  var Muxer = class {
    constructor(options) {
      __privateAdd(this, _validateOptions);
      __privateAdd(this, _writeHeader);
      __privateAdd(this, _computeMoovSizeUpperBound);
      __privateAdd(this, _prepareTracks);
      // https://wiki.multimedia.cx/index.php/MPEG-4_Audio
      __privateAdd(this, _generateMpeg4AudioSpecificConfig);
      __privateAdd(this, _createSampleForTrack);
      __privateAdd(this, _addSampleToTrack);
      __privateAdd(this, _validateTimestamp);
      __privateAdd(this, _finalizeCurrentChunk);
      __privateAdd(this, _finalizeFragment);
      __privateAdd(this, _maybeFlushStreamingTargetWriter);
      __privateAdd(this, _ensureNotFinalized);
      __privateAdd(this, _options, void 0);
      __privateAdd(this, _writer, void 0);
      __privateAdd(this, _ftypSize, void 0);
      __privateAdd(this, _mdat, void 0);
      __privateAdd(this, _videoTrack, null);
      __privateAdd(this, _audioTrack, null);
      __privateAdd(this, _creationTime, Math.floor(Date.now() / 1e3) + TIMESTAMP_OFFSET);
      __privateAdd(this, _finalizedChunks, []);
      // Fields for fragmented MP4:
      __privateAdd(this, _nextFragmentNumber, 1);
      __privateAdd(this, _videoSampleQueue, []);
      __privateAdd(this, _audioSampleQueue, []);
      __privateAdd(this, _finalized, false);
      __privateMethod(this, _validateOptions, validateOptions_fn).call(this, options);
      options.video = deepClone(options.video);
      options.audio = deepClone(options.audio);
      options.fastStart = deepClone(options.fastStart);
      this.target = options.target;
      __privateSet(this, _options, {
        firstTimestampBehavior: "strict",
        ...options
      });
      if (options.target instanceof ArrayBufferTarget) {
        __privateSet(this, _writer, new ArrayBufferTargetWriter(options.target));
      } else if (options.target instanceof StreamTarget) {
        __privateSet(this, _writer, new StreamTargetWriter(options.target));
      } else if (options.target instanceof FileSystemWritableFileStreamTarget) {
        __privateSet(this, _writer, new FileSystemWritableFileStreamTargetWriter(options.target));
      } else {
        throw new Error(`Invalid target: ${options.target}`);
      }
      __privateMethod(this, _prepareTracks, prepareTracks_fn).call(this);
      __privateMethod(this, _writeHeader, writeHeader_fn).call(this);
    }
    addVideoChunk(sample, meta, timestamp, compositionTimeOffset) {
      if (!(sample instanceof EncodedVideoChunk)) {
        throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addVideoChunkRaw(
        data,
        sample.type,
        timestamp ?? sample.timestamp,
        sample.duration,
        meta,
        compositionTimeOffset
      );
    }
    addVideoChunkRaw(data, type, timestamp, duration, meta, compositionTimeOffset) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      if (compositionTimeOffset !== void 0 && !Number.isFinite(compositionTimeOffset)) {
        throw new TypeError(
          "addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number."
        );
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).video)
        throw new Error("No video track declared.");
      if (typeof __privateGet(this, _options).fastStart === "object" && __privateGet(this, _videoTrack).samples.length === __privateGet(this, _options).fastStart.expectedVideoChunks) {
        throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${__privateGet(this, _options).fastStart.expectedVideoChunks}).`);
      }
      let videoSample = __privateMethod(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet(this, _videoTrack), data, type, timestamp, duration, meta, compositionTimeOffset);
      if (__privateGet(this, _options).fastStart === "fragmented" && __privateGet(this, _audioTrack)) {
        while (__privateGet(this, _audioSampleQueue).length > 0 && __privateGet(this, _audioSampleQueue)[0].decodeTimestamp <= videoSample.decodeTimestamp) {
          let audioSample = __privateGet(this, _audioSampleQueue).shift();
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        }
        if (videoSample.decodeTimestamp <= __privateGet(this, _audioTrack).lastDecodeTimestamp) {
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        } else {
          __privateGet(this, _videoSampleQueue).push(videoSample);
        }
      } else {
        __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
      }
    }
    addAudioChunk(sample, meta, timestamp) {
      if (!(sample instanceof EncodedAudioChunk)) {
        throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");
      }
      if (timestamp !== void 0 && (!Number.isFinite(timestamp) || timestamp < 0)) {
        throw new TypeError(
          "addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number."
        );
      }
      let data = new Uint8Array(sample.byteLength);
      sample.copyTo(data);
      this.addAudioChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta);
    }
    addAudioChunkRaw(data, type, timestamp, duration, meta) {
      if (!(data instanceof Uint8Array)) {
        throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");
      }
      if (type !== "key" && type !== "delta") {
        throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");
      }
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");
      }
      if (!Number.isFinite(duration) || duration < 0) {
        throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");
      }
      if (meta && typeof meta !== "object") {
        throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");
      }
      __privateMethod(this, _ensureNotFinalized, ensureNotFinalized_fn).call(this);
      if (!__privateGet(this, _options).audio)
        throw new Error("No audio track declared.");
      if (typeof __privateGet(this, _options).fastStart === "object" && __privateGet(this, _audioTrack).samples.length === __privateGet(this, _options).fastStart.expectedAudioChunks) {
        throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${__privateGet(this, _options).fastStart.expectedAudioChunks}).`);
      }
      let audioSample = __privateMethod(this, _createSampleForTrack, createSampleForTrack_fn).call(this, __privateGet(this, _audioTrack), data, type, timestamp, duration, meta);
      if (__privateGet(this, _options).fastStart === "fragmented" && __privateGet(this, _videoTrack)) {
        while (__privateGet(this, _videoSampleQueue).length > 0 && __privateGet(this, _videoSampleQueue)[0].decodeTimestamp <= audioSample.decodeTimestamp) {
          let videoSample = __privateGet(this, _videoSampleQueue).shift();
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        }
        if (audioSample.decodeTimestamp <= __privateGet(this, _videoTrack).lastDecodeTimestamp) {
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        } else {
          __privateGet(this, _audioSampleQueue).push(audioSample);
        }
      } else {
        __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
      }
    }
    /** Finalizes the file, making it ready for use. Must be called after all video and audio chunks have been added. */
    finalize() {
      if (__privateGet(this, _finalized)) {
        throw new Error("Cannot finalize a muxer more than once.");
      }
      if (__privateGet(this, _options).fastStart === "fragmented") {
        for (let videoSample of __privateGet(this, _videoSampleQueue))
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _videoTrack), videoSample);
        for (let audioSample of __privateGet(this, _audioSampleQueue))
          __privateMethod(this, _addSampleToTrack, addSampleToTrack_fn).call(this, __privateGet(this, _audioTrack), audioSample);
        __privateMethod(this, _finalizeFragment, finalizeFragment_fn).call(this, false);
      } else {
        if (__privateGet(this, _videoTrack))
          __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet(this, _videoTrack));
        if (__privateGet(this, _audioTrack))
          __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, __privateGet(this, _audioTrack));
      }
      let tracks = [__privateGet(this, _videoTrack), __privateGet(this, _audioTrack)].filter(Boolean);
      if (__privateGet(this, _options).fastStart === "in-memory") {
        let mdatSize;
        for (let i = 0; i < 2; i++) {
          let movieBox2 = moov(tracks, __privateGet(this, _creationTime));
          let movieBoxSize = __privateGet(this, _writer).measureBox(movieBox2);
          mdatSize = __privateGet(this, _writer).measureBox(__privateGet(this, _mdat));
          let currentChunkPos = __privateGet(this, _writer).pos + movieBoxSize + mdatSize;
          for (let chunk of __privateGet(this, _finalizedChunks)) {
            chunk.offset = currentChunkPos;
            for (let { data } of chunk.samples) {
              currentChunkPos += data.byteLength;
              mdatSize += data.byteLength;
            }
          }
          if (currentChunkPos < 2 ** 32)
            break;
          if (mdatSize >= 2 ** 32)
            __privateGet(this, _mdat).largeSize = true;
        }
        let movieBox = moov(tracks, __privateGet(this, _creationTime));
        __privateGet(this, _writer).writeBox(movieBox);
        __privateGet(this, _mdat).size = mdatSize;
        __privateGet(this, _writer).writeBox(__privateGet(this, _mdat));
        for (let chunk of __privateGet(this, _finalizedChunks)) {
          for (let sample of chunk.samples) {
            __privateGet(this, _writer).write(sample.data);
            sample.data = null;
          }
        }
      } else if (__privateGet(this, _options).fastStart === "fragmented") {
        let startPos = __privateGet(this, _writer).pos;
        let mfraBox = mfra(tracks);
        __privateGet(this, _writer).writeBox(mfraBox);
        let mfraBoxSize = __privateGet(this, _writer).pos - startPos;
        __privateGet(this, _writer).seek(__privateGet(this, _writer).pos - 4);
        __privateGet(this, _writer).writeU32(mfraBoxSize);
      } else {
        let mdatPos = __privateGet(this, _writer).offsets.get(__privateGet(this, _mdat));
        let mdatSize = __privateGet(this, _writer).pos - mdatPos;
        __privateGet(this, _mdat).size = mdatSize;
        __privateGet(this, _mdat).largeSize = mdatSize >= 2 ** 32;
        __privateGet(this, _writer).patchBox(__privateGet(this, _mdat));
        let movieBox = moov(tracks, __privateGet(this, _creationTime));
        if (typeof __privateGet(this, _options).fastStart === "object") {
          __privateGet(this, _writer).seek(__privateGet(this, _ftypSize));
          __privateGet(this, _writer).writeBox(movieBox);
          let remainingBytes = mdatPos - __privateGet(this, _writer).pos;
          __privateGet(this, _writer).writeBox(free(remainingBytes));
        } else {
          __privateGet(this, _writer).writeBox(movieBox);
        }
      }
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
      __privateGet(this, _writer).finalize();
      __privateSet(this, _finalized, true);
    }
  };
  _options = new WeakMap();
  _writer = new WeakMap();
  _ftypSize = new WeakMap();
  _mdat = new WeakMap();
  _videoTrack = new WeakMap();
  _audioTrack = new WeakMap();
  _creationTime = new WeakMap();
  _finalizedChunks = new WeakMap();
  _nextFragmentNumber = new WeakMap();
  _videoSampleQueue = new WeakMap();
  _audioSampleQueue = new WeakMap();
  _finalized = new WeakMap();
  _validateOptions = new WeakSet();
  validateOptions_fn = function(options) {
    if (typeof options !== "object") {
      throw new TypeError("The muxer requires an options object to be passed to its constructor.");
    }
    if (!(options.target instanceof Target)) {
      throw new TypeError("The target must be provided and an instance of Target.");
    }
    if (options.video) {
      if (!SUPPORTED_VIDEO_CODECS.includes(options.video.codec)) {
        throw new TypeError(`Unsupported video codec: ${options.video.codec}`);
      }
      if (!Number.isInteger(options.video.width) || options.video.width <= 0) {
        throw new TypeError(`Invalid video width: ${options.video.width}. Must be a positive integer.`);
      }
      if (!Number.isInteger(options.video.height) || options.video.height <= 0) {
        throw new TypeError(`Invalid video height: ${options.video.height}. Must be a positive integer.`);
      }
      const videoRotation = options.video.rotation;
      if (typeof videoRotation === "number" && ![0, 90, 180, 270].includes(videoRotation)) {
        throw new TypeError(`Invalid video rotation: ${videoRotation}. Has to be 0, 90, 180 or 270.`);
      } else if (Array.isArray(videoRotation) && (videoRotation.length !== 9 || videoRotation.some((value) => typeof value !== "number"))) {
        throw new TypeError(`Invalid video transformation matrix: ${videoRotation.join()}`);
      }
      if (options.video.frameRate !== void 0 && (!Number.isInteger(options.video.frameRate) || options.video.frameRate <= 0)) {
        throw new TypeError(
          `Invalid video frame rate: ${options.video.frameRate}. Must be a positive integer.`
        );
      }
    }
    if (options.audio) {
      if (!SUPPORTED_AUDIO_CODECS.includes(options.audio.codec)) {
        throw new TypeError(`Unsupported audio codec: ${options.audio.codec}`);
      }
      if (!Number.isInteger(options.audio.numberOfChannels) || options.audio.numberOfChannels <= 0) {
        throw new TypeError(
          `Invalid number of audio channels: ${options.audio.numberOfChannels}. Must be a positive integer.`
        );
      }
      if (!Number.isInteger(options.audio.sampleRate) || options.audio.sampleRate <= 0) {
        throw new TypeError(
          `Invalid audio sample rate: ${options.audio.sampleRate}. Must be a positive integer.`
        );
      }
    }
    if (options.firstTimestampBehavior && !FIRST_TIMESTAMP_BEHAVIORS.includes(options.firstTimestampBehavior)) {
      throw new TypeError(`Invalid first timestamp behavior: ${options.firstTimestampBehavior}`);
    }
    if (typeof options.fastStart === "object") {
      if (options.video) {
        if (options.fastStart.expectedVideoChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedVideoChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedVideoChunks) || options.fastStart.expectedVideoChunks < 0) {
          throw new TypeError(`'expectedVideoChunks' must be a non-negative integer.`);
        }
      }
      if (options.audio) {
        if (options.fastStart.expectedAudioChunks === void 0) {
          throw new TypeError(`'fastStart' is an object but is missing property 'expectedAudioChunks'.`);
        } else if (!Number.isInteger(options.fastStart.expectedAudioChunks) || options.fastStart.expectedAudioChunks < 0) {
          throw new TypeError(`'expectedAudioChunks' must be a non-negative integer.`);
        }
      }
    } else if (![false, "in-memory", "fragmented"].includes(options.fastStart)) {
      throw new TypeError(`'fastStart' option must be false, 'in-memory', 'fragmented' or an object.`);
    }
    if (options.minFragmentDuration !== void 0 && (!Number.isFinite(options.minFragmentDuration) || options.minFragmentDuration < 0)) {
      throw new TypeError(`'minFragmentDuration' must be a non-negative number.`);
    }
  };
  _writeHeader = new WeakSet();
  writeHeader_fn = function() {
    __privateGet(this, _writer).writeBox(ftyp({
      holdsAvc: __privateGet(this, _options).video?.codec === "avc",
      fragmented: __privateGet(this, _options).fastStart === "fragmented"
    }));
    __privateSet(this, _ftypSize, __privateGet(this, _writer).pos);
    if (__privateGet(this, _options).fastStart === "in-memory") {
      __privateSet(this, _mdat, mdat(false));
    } else if (__privateGet(this, _options).fastStart === "fragmented") {
    } else {
      if (typeof __privateGet(this, _options).fastStart === "object") {
        let moovSizeUpperBound = __privateMethod(this, _computeMoovSizeUpperBound, computeMoovSizeUpperBound_fn).call(this);
        __privateGet(this, _writer).seek(__privateGet(this, _writer).pos + moovSizeUpperBound);
      }
      __privateSet(this, _mdat, mdat(true));
      __privateGet(this, _writer).writeBox(__privateGet(this, _mdat));
    }
    __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _computeMoovSizeUpperBound = new WeakSet();
  computeMoovSizeUpperBound_fn = function() {
    if (typeof __privateGet(this, _options).fastStart !== "object")
      return;
    let upperBound = 0;
    let sampleCounts = [
      __privateGet(this, _options).fastStart.expectedVideoChunks,
      __privateGet(this, _options).fastStart.expectedAudioChunks
    ];
    for (let n of sampleCounts) {
      if (!n)
        continue;
      upperBound += (4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += (4 + 4 + 4) * Math.ceil(2 / 3 * n);
      upperBound += 4 * n;
      upperBound += 8 * n;
    }
    upperBound += 4096;
    return upperBound;
  };
  _prepareTracks = new WeakSet();
  prepareTracks_fn = function() {
    if (__privateGet(this, _options).video) {
      __privateSet(this, _videoTrack, {
        id: 1,
        info: {
          type: "video",
          codec: __privateGet(this, _options).video.codec,
          width: __privateGet(this, _options).video.width,
          height: __privateGet(this, _options).video.height,
          rotation: __privateGet(this, _options).video.rotation ?? 0,
          decoderConfig: null
        },
        // The fallback contains many common frame rates as factors
        timescale: __privateGet(this, _options).video.frameRate ?? 57600,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
    }
    if (__privateGet(this, _options).audio) {
      __privateSet(this, _audioTrack, {
        id: __privateGet(this, _options).video ? 2 : 1,
        info: {
          type: "audio",
          codec: __privateGet(this, _options).audio.codec,
          numberOfChannels: __privateGet(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet(this, _options).audio.sampleRate,
          decoderConfig: null
        },
        timescale: __privateGet(this, _options).audio.sampleRate,
        samples: [],
        finalizedChunks: [],
        currentChunk: null,
        firstDecodeTimestamp: void 0,
        lastDecodeTimestamp: -1,
        timeToSampleTable: [],
        compositionTimeOffsetTable: [],
        lastTimescaleUnits: null,
        lastSample: null,
        compactlyCodedChunkTable: []
      });
      if (__privateGet(this, _options).audio.codec === "aac") {
        let guessedCodecPrivate = __privateMethod(this, _generateMpeg4AudioSpecificConfig, generateMpeg4AudioSpecificConfig_fn).call(
          this,
          2,
          // Object type for AAC-LC, since it's the most common
          __privateGet(this, _options).audio.sampleRate,
          __privateGet(this, _options).audio.numberOfChannels
        );
        __privateGet(this, _audioTrack).info.decoderConfig = {
          codec: __privateGet(this, _options).audio.codec,
          description: guessedCodecPrivate,
          numberOfChannels: __privateGet(this, _options).audio.numberOfChannels,
          sampleRate: __privateGet(this, _options).audio.sampleRate
        };
      }
    }
  };
  _generateMpeg4AudioSpecificConfig = new WeakSet();
  generateMpeg4AudioSpecificConfig_fn = function(objectType, sampleRate, numberOfChannels) {
    let frequencyIndices = [96e3, 88200, 64e3, 48e3, 44100, 32e3, 24e3, 22050, 16e3, 12e3, 11025, 8e3, 7350];
    let frequencyIndex = frequencyIndices.indexOf(sampleRate);
    let channelConfig = numberOfChannels;
    let configBits = "";
    configBits += objectType.toString(2).padStart(5, "0");
    configBits += frequencyIndex.toString(2).padStart(4, "0");
    if (frequencyIndex === 15)
      configBits += sampleRate.toString(2).padStart(24, "0");
    configBits += channelConfig.toString(2).padStart(4, "0");
    let paddingLength = Math.ceil(configBits.length / 8) * 8;
    configBits = configBits.padEnd(paddingLength, "0");
    let configBytes = new Uint8Array(configBits.length / 8);
    for (let i = 0; i < configBits.length; i += 8) {
      configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);
    }
    return configBytes;
  };
  _createSampleForTrack = new WeakSet();
  createSampleForTrack_fn = function(track, data, type, timestamp, duration, meta, compositionTimeOffset) {
    let presentationTimestampInSeconds = timestamp / 1e6;
    let decodeTimestampInSeconds = (timestamp - (compositionTimeOffset ?? 0)) / 1e6;
    let durationInSeconds = duration / 1e6;
    let adjusted = __privateMethod(this, _validateTimestamp, validateTimestamp_fn).call(this, presentationTimestampInSeconds, decodeTimestampInSeconds, track);
    presentationTimestampInSeconds = adjusted.presentationTimestamp;
    decodeTimestampInSeconds = adjusted.decodeTimestamp;
    if (meta?.decoderConfig) {
      if (track.info.decoderConfig === null) {
        track.info.decoderConfig = meta.decoderConfig;
      } else {
        Object.assign(track.info.decoderConfig, meta.decoderConfig);
      }
    }
    let sample = {
      presentationTimestamp: presentationTimestampInSeconds,
      decodeTimestamp: decodeTimestampInSeconds,
      duration: durationInSeconds,
      data,
      size: data.byteLength,
      type,
      // Will be refined once the next sample comes in
      timescaleUnitsToNextSample: intoTimescale(durationInSeconds, track.timescale)
    };
    return sample;
  };
  _addSampleToTrack = new WeakSet();
  addSampleToTrack_fn = function(track, sample) {
    if (__privateGet(this, _options).fastStart !== "fragmented") {
      track.samples.push(sample);
    }
    const sampleCompositionTimeOffset = intoTimescale(sample.presentationTimestamp - sample.decodeTimestamp, track.timescale);
    if (track.lastTimescaleUnits !== null) {
      let timescaleUnits = intoTimescale(sample.decodeTimestamp, track.timescale, false);
      let delta = Math.round(timescaleUnits - track.lastTimescaleUnits);
      track.lastTimescaleUnits += delta;
      track.lastSample.timescaleUnitsToNextSample = delta;
      if (__privateGet(this, _options).fastStart !== "fragmented") {
        let lastTableEntry = last(track.timeToSampleTable);
        if (lastTableEntry.sampleCount === 1) {
          lastTableEntry.sampleDelta = delta;
          lastTableEntry.sampleCount++;
        } else if (lastTableEntry.sampleDelta === delta) {
          lastTableEntry.sampleCount++;
        } else {
          lastTableEntry.sampleCount--;
          track.timeToSampleTable.push({
            sampleCount: 2,
            sampleDelta: delta
          });
        }
        const lastCompositionTimeOffsetTableEntry = last(track.compositionTimeOffsetTable);
        if (lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset === sampleCompositionTimeOffset) {
          lastCompositionTimeOffsetTableEntry.sampleCount++;
        } else {
          track.compositionTimeOffsetTable.push({
            sampleCount: 1,
            sampleCompositionTimeOffset
          });
        }
      }
    } else {
      track.lastTimescaleUnits = 0;
      if (__privateGet(this, _options).fastStart !== "fragmented") {
        track.timeToSampleTable.push({
          sampleCount: 1,
          sampleDelta: intoTimescale(sample.duration, track.timescale)
        });
        track.compositionTimeOffsetTable.push({
          sampleCount: 1,
          sampleCompositionTimeOffset
        });
      }
    }
    track.lastSample = sample;
    let beginNewChunk = false;
    if (!track.currentChunk) {
      beginNewChunk = true;
    } else {
      let currentChunkDuration = sample.presentationTimestamp - track.currentChunk.startTimestamp;
      if (__privateGet(this, _options).fastStart === "fragmented") {
        let mostImportantTrack = __privateGet(this, _videoTrack) ?? __privateGet(this, _audioTrack);
        const chunkDuration = __privateGet(this, _options).minFragmentDuration ?? 1;
        if (track === mostImportantTrack && sample.type === "key" && currentChunkDuration >= chunkDuration) {
          beginNewChunk = true;
          __privateMethod(this, _finalizeFragment, finalizeFragment_fn).call(this);
        }
      } else {
        beginNewChunk = currentChunkDuration >= 0.5;
      }
    }
    if (beginNewChunk) {
      if (track.currentChunk) {
        __privateMethod(this, _finalizeCurrentChunk, finalizeCurrentChunk_fn).call(this, track);
      }
      track.currentChunk = {
        startTimestamp: sample.presentationTimestamp,
        samples: []
      };
    }
    track.currentChunk.samples.push(sample);
  };
  _validateTimestamp = new WeakSet();
  validateTimestamp_fn = function(presentationTimestamp, decodeTimestamp, track) {
    const strictTimestampBehavior = __privateGet(this, _options).firstTimestampBehavior === "strict";
    const noLastDecodeTimestamp = track.lastDecodeTimestamp === -1;
    const timestampNonZero = decodeTimestamp !== 0;
    if (strictTimestampBehavior && noLastDecodeTimestamp && timestampNonZero) {
      throw new Error(
        `The first chunk for your media track must have a timestamp of 0 (received DTS=${decodeTimestamp}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`
      );
    } else if (__privateGet(this, _options).firstTimestampBehavior === "offset" || __privateGet(this, _options).firstTimestampBehavior === "cross-track-offset") {
      if (track.firstDecodeTimestamp === void 0) {
        track.firstDecodeTimestamp = decodeTimestamp;
      }
      let baseDecodeTimestamp;
      if (__privateGet(this, _options).firstTimestampBehavior === "offset") {
        baseDecodeTimestamp = track.firstDecodeTimestamp;
      } else {
        baseDecodeTimestamp = Math.min(
          __privateGet(this, _videoTrack)?.firstDecodeTimestamp ?? Infinity,
          __privateGet(this, _audioTrack)?.firstDecodeTimestamp ?? Infinity
        );
      }
      decodeTimestamp -= baseDecodeTimestamp;
      presentationTimestamp -= baseDecodeTimestamp;
    }
    if (decodeTimestamp < track.lastDecodeTimestamp) {
      throw new Error(
        `Timestamps must be monotonically increasing (DTS went from ${track.lastDecodeTimestamp * 1e6} to ${decodeTimestamp * 1e6}).`
      );
    }
    track.lastDecodeTimestamp = decodeTimestamp;
    return { presentationTimestamp, decodeTimestamp };
  };
  _finalizeCurrentChunk = new WeakSet();
  finalizeCurrentChunk_fn = function(track) {
    if (__privateGet(this, _options).fastStart === "fragmented") {
      throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");
    }
    if (!track.currentChunk)
      return;
    track.finalizedChunks.push(track.currentChunk);
    __privateGet(this, _finalizedChunks).push(track.currentChunk);
    if (track.compactlyCodedChunkTable.length === 0 || last(track.compactlyCodedChunkTable).samplesPerChunk !== track.currentChunk.samples.length) {
      track.compactlyCodedChunkTable.push({
        firstChunk: track.finalizedChunks.length,
        // 1-indexed
        samplesPerChunk: track.currentChunk.samples.length
      });
    }
    if (__privateGet(this, _options).fastStart === "in-memory") {
      track.currentChunk.offset = 0;
      return;
    }
    track.currentChunk.offset = __privateGet(this, _writer).pos;
    for (let sample of track.currentChunk.samples) {
      __privateGet(this, _writer).write(sample.data);
      sample.data = null;
    }
    __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
  };
  _finalizeFragment = new WeakSet();
  finalizeFragment_fn = function(flushStreamingWriter = true) {
    if (__privateGet(this, _options).fastStart !== "fragmented") {
      throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");
    }
    let tracks = [__privateGet(this, _videoTrack), __privateGet(this, _audioTrack)].filter((track) => track && track.currentChunk);
    if (tracks.length === 0)
      return;
    let fragmentNumber = __privateWrapper(this, _nextFragmentNumber)._++;
    if (fragmentNumber === 1) {
      let movieBox = moov(tracks, __privateGet(this, _creationTime), true);
      __privateGet(this, _writer).writeBox(movieBox);
    }
    let moofOffset = __privateGet(this, _writer).pos;
    let moofBox = moof(fragmentNumber, tracks);
    __privateGet(this, _writer).writeBox(moofBox);
    {
      let mdatBox = mdat(false);
      let totalTrackSampleSize = 0;
      for (let track of tracks) {
        for (let sample of track.currentChunk.samples) {
          totalTrackSampleSize += sample.size;
        }
      }
      let mdatSize = __privateGet(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      if (mdatSize >= 2 ** 32) {
        mdatBox.largeSize = true;
        mdatSize = __privateGet(this, _writer).measureBox(mdatBox) + totalTrackSampleSize;
      }
      mdatBox.size = mdatSize;
      __privateGet(this, _writer).writeBox(mdatBox);
    }
    for (let track of tracks) {
      track.currentChunk.offset = __privateGet(this, _writer).pos;
      track.currentChunk.moofOffset = moofOffset;
      for (let sample of track.currentChunk.samples) {
        __privateGet(this, _writer).write(sample.data);
        sample.data = null;
      }
    }
    let endPos = __privateGet(this, _writer).pos;
    __privateGet(this, _writer).seek(__privateGet(this, _writer).offsets.get(moofBox));
    let newMoofBox = moof(fragmentNumber, tracks);
    __privateGet(this, _writer).writeBox(newMoofBox);
    __privateGet(this, _writer).seek(endPos);
    for (let track of tracks) {
      track.finalizedChunks.push(track.currentChunk);
      __privateGet(this, _finalizedChunks).push(track.currentChunk);
      track.currentChunk = null;
    }
    if (flushStreamingWriter) {
      __privateMethod(this, _maybeFlushStreamingTargetWriter, maybeFlushStreamingTargetWriter_fn).call(this);
    }
  };
  _maybeFlushStreamingTargetWriter = new WeakSet();
  maybeFlushStreamingTargetWriter_fn = function() {
    if (__privateGet(this, _writer) instanceof StreamTargetWriter) {
      __privateGet(this, _writer).flush();
    }
  };
  _ensureNotFinalized = new WeakSet();
  ensureNotFinalized_fn = function() {
    if (__privateGet(this, _finalized)) {
      throw new Error("Cannot add new video or audio chunks after the file has been finalized.");
    }
  };
  return __toCommonJS(src_exports);
})();
if (typeof module === "object" && typeof module.exports === "object") Object.assign(module.exports, Mp4Muxer)


const W=1920,H=1080, cv=document.getElementById('bhv-cv'), g=cv.getContext('2d');
const S=document.getElementById('bhv-status');
let items=[], buys=[], sents=[], received=[], meta=null, recorder=null, chunks=[], raf=0, t0=0, DUR=40;
/* 初期値は40秒＝つまみの下限。長いと最後まで見てもらえない。
   伸ばしたい人はつまみを動かせばいい（240秒まで） */
const INTRO=2.5, TAIL=1.8, HOLD=3.0, SENT=9.0, RECV=11.5, YEAR1=2.6, YEAR2=0.62, OUTRO=12.0;
/* 何を動画に出すか。使う人が選ぶ。
   贈ったもの・もらったものは、人に見られたくないことがある（逆に、それだけ出したい人もいる）。
   取り込みのときも同じ選択を使う＝選ばなかったものは、そもそも読みに行かない */
const PICK={buy:true,sent:true,recv:true};
/* 期間。買った日・贈った日の「年」で絞る。null＝端まで。
   絞るのは normalize のところ1か所だけ。壁も年の幕も締めも、そこから作られるので勝手についてくる。
   ⚠️ もらったものだけは絞れない。受け取った日をBOOTHが持っていないから。
      黙って全期間ぶんを混ぜると「2024年の記録」に10年ぶんのギフトが並ぶ。だから期間中は出さない */
const RANGE={from:null,to:null};
let dataYears=[];      // 絞る前の年ぜんぶ。プルダウンの中身と「絞っているか」の判定に使う
const inRange=d=>{ const y=d.getFullYear();
  return (RANGE.from===null||y>=RANGE.from) && (RANGE.to===null||y<=RANGE.to); };
/* 「絞っている」＝手元にある年のうち1つでも外に落ちること。
   最初〜最後をわざわざ選んだだけなら絞っていない扱いにする（もらったものが消えないように） */
function narrowed(){
  if(RANGE.from===null && RANGE.to===null) return false;
  if(!dataYears.length) return true;
  return dataYears.some(y=>(RANGE.from!==null&&y<RANGE.from)||(RANGE.to!==null&&y>RANGE.to));
}
function useRecv(){ return PICK.recv && !narrowed(); }
function rangeLabel(){ return (RANGE.from||'最初')+'〜'+(RANGE.to||'最後'); }
let rawData=null;      // 読み込んだそのまま。チェックを変えたら、ここから作り直す
let dataGen=0;         // 作り直した回数。中で作った表（時刻表・年の集計）を捨てる合図
/* TAIL＝最後のタイルが出きるまで。HOLD＝出きってから次へ行くまでの間。
   TAIL を数に入れないと、最後の数枚がフェード途中のまま3秒固まる（実際に固まった） */

/* 色。青と紫をやめて、紙と墨に寄せた暖かい黒にする。
   差し色はふたつだけ（贈った＝朱 / もらった＝黄土）。増やすと途端に既製品の顔になる */
const C = {
  ink   : '#f0ece3',  // 文字の白（少し黄色い）
  ink2  : '#a9a094',  // 見出しの下
  dim   : '#6d6559',  // 説明
  faint : '#453f37',  // ほぼ見えない
  sent  : '#e8604c',  // 朱
  recv  : '#d9a84a',  // 黄土
  line  : 'rgba(240,236,227,0.26)'
};

/* ===== 小物 ===== */
function hashHue(s){let h=0;for(const c of (s||'x'))h=(h*31+c.charCodeAt(0))|0;return ((h%360)+360)%360;}
const yen=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const ease=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const FG='"Hiragino Sans","Yu Gothic UI","Noto Sans JP",sans-serif';
const FM='"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
const fnt=(size,weight,fam)=>`${weight} ${size}px ${fam==='m'?FM:FG}`;
function txt(s,x,y,size,color,align='left',weight=700,track=0,fam='g'){
  g.font=fnt(size,weight,fam);
  if(g.letterSpacing!==undefined) g.letterSpacing=track+'px';
  g.fillStyle=color; g.textAlign=align; g.textBaseline='alphabetic'; g.fillText(s,x,y);
  if(g.letterSpacing!==undefined) g.letterSpacing='0px';
}
function measure(s,size,weight=700,track=0,fam='g'){
  g.font=fnt(size,weight,fam);
  if(g.letterSpacing!==undefined) g.letterSpacing=track+'px';
  const w=g.measureText(s).width;
  if(g.letterSpacing!==undefined) g.letterSpacing='0px';
  return w;
}
function ellipsis(s,size,maxW,weight=700){
  g.font=`${weight} ${size}px "Hiragino Sans","Yu Gothic UI",sans-serif`;
  if(g.measureText(s).width<=maxW) return s;
  let t=s; while(t.length>1 && g.measureText(t+'…').width>maxW) t=t.slice(0,-1);
  return t+'…';
}
function rule(x,y,w,color,h=1){ g.fillStyle=color; g.fillRect(x,y,w,h); }
/* サムネの上に出す小さい字。縁を取らないと絵に負けて読めない */
function outlined(s,x,y,size,color,align='center',weight=600){
  g.font=fnt(size,weight,'g'); g.textAlign=align; g.textBaseline='alphabetic'; g.lineJoin='round';
  g.lineWidth=Math.max(size*0.30,3); g.strokeStyle='rgba(0,0,0,0.85)'; g.strokeText(s,x,y);
  g.fillStyle=color; g.fillText(s,x,y);
}

/* ===== データ ===== */
/* 同じURLの画像は1枚だけ読む。normalize の外に置くのは、
   チェックを切り替えて作り直したときに、読み込み済みの画像をそのまま使えるようにするため */
const imgCache=new Map();
/* 絞る前の年を数える。中身が変わったときだけプルダウンを作り直す
   （毎回作り直すと、選んでいる途中で選択が飛ぶ） */
function scanYears(src){
  const s=new Set();
  for(const o of (src.items||[])){
    const d=new Date((o.datetime||o.date||'').replace(/\//g,'-').replace(' ','T'));
    if(!isNaN(d)) s.add(d.getFullYear());
  }
  const next=[...s].sort((a,b)=>a-b);
  if(next.join()!==dataYears.join()){ dataYears=next; fillYears(); }
}
function normalize(raw){
  const src = Array.isArray(raw) ? {items:raw, received:[], meta:null} : raw;
  rawData = src;
  meta = src.meta||null;
  scanYears(src);
  received = (useRecv() ? (src.received||[]) : []).map(o=>({...o,_im:null}));
  const a=(src.items||[]).map(o=>({
    date:new Date((o.datetime||o.date||'').replace(/\//g,'-').replace(' ','T')),
    title:o.title||'(無題)', shop:o.shop||'', price:+o.price||0,
    type:o.type||'buy', img:o.img||null, _im:null
  })).filter(o=>!isNaN(o.date))
     .filter(o=> inRange(o.date))
     .filter(o=> o.type==='gift_sent' ? PICK.sent : PICK.buy);
  a.sort((x,y)=>x.date-y.date);
  let loaded=0, need=0;
  const hook=o=>{ if(!o.img) return;
    const hit=imgCache.get(o.img);
    if(hit){ if(hit.done) o._im=hit.im; else hit.waiting.push(o); return; }
    need++;
    const im=new Image(), rec={im:im,done:false,waiting:[o]};
    imgCache.set(o.img,rec);
    im.onload=()=>{ rec.done=true; for(const w of rec.waiting) w._im=im; rec.waiting.length=0;
      if(++loaded>=need) S.textContent='画像 '+loaded+'枚 読み込み済み'; };
    im.onerror=()=>{ need--; imgCache.delete(o.img); };
    im.src=o.img; };
  a.forEach(hook); received.forEach(hook);
  buys=a.filter(o=>o.type==='buy'); sents=a.filter(o=>o.type==='gift_sent');
  dataGen++;
  return a;
}

/* 年ごとの合計。日付と金額が両方あるもの＝「買った」と「贈った」だけを数える。
   もらったものは受け取り日が残っていないので、この表には入れられない（BOOTHが持っていない） */
let yrCache=null, yrGen=-1;
function yearRows(){
  if(yrGen===dataGen && yrCache) return yrCache;
  const m=new Map();
  for(const o of items){
    const y=o.date.getFullYear();
    let r=m.get(y); if(!r){ r={year:y,buy:0,sent:0,n:0}; m.set(y,r); }
    if(o.type==='gift_sent') r.sent+=o.price; else r.buy+=o.price;
    r.n++;
  }
  let out=[...m.values()].sort((x,y)=>x.year-y.year);
  /* 買っていない年を飛ばすと「2016 → 2018」と並んで、間が空いたことが読めない。
     ⚠️ 変な日付が1件混じると何百行にもなるので、30年より長いときは埋めない */
  if(out.length>1 && out[out.length-1].year-out[0].year<=30){
    const full=[];
    for(let y=out[0].year; y<=out[out.length-1].year; y++)
      full.push(m.get(y)||{year:y,buy:0,sent:0,n:0});
    out=full;
  }
  for(const r of out) r.total=r.buy+r.sent;
  yrCache=out; yrGen=dataGen; return out;
}
function demo(){
  const shops=['ぽんデザイン','しっぽ工房','Moonlit Atelier','くらげ屋','VRC素材店','あかりスタジオ'];
  const out=[]; const s=new Date('2019-04-01').getTime(), e=new Date('2026-08-01').getTime();
  for(let i=0;i<300;i++){ const r=Math.random();
    out.push({date:new Date(s+Math.pow(Math.random(),.65)*(e-s)).toISOString().slice(0,10),
      shop:shops[i%shops.length], title:'サンプル商品 '+(100+i),
      price:[500,800,1000,1500,2000,3000,5000][Math.floor(Math.random()*7)],
      type: r<0.09?'gift_sent':'buy'});}
  return out;
}

/* ===== 壁 =====
   仕切り：月が変わったら細い縦線。年が変わったらマス目をひとつ空けて年号を置く。
   だから「並んだ順番のどこが何月か」が、止めた画でも分かる */
let cols=1, cell=100, wallX=0, wallY=0, wallW=0, wallH=0;
let slots=[], marksY=[], marksM=[], totalSlots=0;
function buildSlots(){
  slots=[]; marksY=[]; marksM=[];
  let pos=0, py=null, pm=null;
  for(let i=0;i<buys.length;i++){
    const d=buys[i].date, y=d.getFullYear(), m=d.getMonth();
    if(py!==null && y!==py){ marksY.push({pos:pos, year:y, i:i}); pos+=2; }
    else if(pm!==null && m!==pm){ marksM.push({pos:pos, i:i}); }
    slots[i]=pos++; py=y; pm=m;
  }
  totalSlots=pos;
}
function layout(){
  buildSlots();
  wallX=96; wallY=196; wallW=W-192; wallH=H-196-320;   // 下に「日付＋金額」の列を置くぶん詰める
  const n=Math.max(totalSlots,1);
  cols=Math.max(1,Math.ceil(Math.sqrt(n*(wallW/wallH))));
  cell=Math.min(wallW/cols,200);
  /* 収まるまで詰める。何千点持っている人でも溢れないように、下限は決めない */
  for(let i=0;i<60 && Math.ceil(n/cols)*cell>wallH; i++){
    cell*=0.94; cols=Math.max(1,Math.floor(wallW/cell));
  }
  cell=Math.max(cell,8);   // これ以上小さいと点にしか見えない
}
const slotX=p=>wallX+(p%cols)*cell;
const slotY=p=>wallY+Math.floor(p/cols)*cell;
function tile(o,p,pop){
  const cx=slotX(p), cy=slotY(p);
  const pad=Math.max(cell*0.05,1.2), s=cell-pad*2;
  const k=ease(pop), sc=0.5+0.5*k, off=(1-k)*cell*1.1;
  const w=s*sc, x=cx+pad+(s-w)/2, y=cy+pad+(s-w)/2-off;
  g.globalAlpha=k;
  if(o._im){ g.drawImage(o._im,x,y,w,w); }
  else{
    const hue=hashHue(o.shop||o.title);
    const lg=g.createLinearGradient(x,y,x+w,y+w);
    lg.addColorStop(0,`hsl(${hue} 42% ${24+clamp(o.price/6000,0,1)*20}%)`);
    lg.addColorStop(1,`hsl(${(hue+30)%360} 48% ${14+clamp(o.price/6000,0,1)*16}%)`);
    g.fillStyle=lg; g.fillRect(x,y,w,w);
  }
  if(pop<1.3){ const a=Math.max(0,1-Math.abs(pop-0.3)*1.7);
    g.strokeStyle=`rgba(240,236,227,${a*0.9})`; g.lineWidth=Math.max(w*0.05,1.5); g.strokeRect(x,y,w,w); }
  g.globalAlpha=1;
}
/* 月の仕切り。行の頭に来たときは、前の行の右端に引く */
function monthLine(p,a){
  let x,y;
  if(p%cols===0){ x=wallX+cols*cell; y=slotY(p)-cell; }
  else { x=slotX(p); y=slotY(p); }
  if(y<wallY-cell) return;
  g.globalAlpha=a*0.55;
  rule(x-1,y+cell*0.02,2,C.ink,cell*0.96);
  g.globalAlpha=1;
}
/* 年は、マス目を2つ空けてそこに置く。止めた画でも「どこから何年か」が読める */
function yearMark(m,a){
  const wide=(m.pos%cols)<=cols-2;
  const p=wide?m.pos:m.pos+1;
  const x=slotX(p), y=slotY(p), w=(wide?2:1)*cell;
  if(y<wallY-cell) return;
  g.globalAlpha=a;
  rule(x+2,y+cell*0.02,2,C.sent,cell*0.96);
  const size=Math.max(Math.min(wide?cell*0.5:cell*0.34,30),17);
  outlined(String(m.year),x+w/2+2,y+cell*0.5+size*0.36,size,C.ink,'center',700);
  g.globalAlpha=1;
}

/* ===== 各パート ===== */
function bg(){
  g.fillStyle='#0a0908'; g.fillRect(0,0,W,H);
  const rg=g.createRadialGradient(W*0.42,H*0.40,80,W*0.5,H*0.5,W*0.78);
  rg.addColorStop(0,'rgba(60,52,44,0.34)'); rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg; g.fillRect(0,0,W,H);
}

/* 押す前と、読み込み中に出す案内。小さい字の状態表示だけだと気づかれない */
let HINT='JSONを読ませてください', HINT2='';
function note(t1,t2){
  bg();
  txt(t1,W/2,H/2-6,54,C.ink,'center',600,1,'m');
  if(t2) txt(t2,W/2,H/2+62,32,C.dim,'center',300,1);
}

/* 表題。買ったものを出さない人に「買ったもの」と出すと嘘になる */
function headline(){
  if(buys.length) return 'BOOTH で買ったもの';
  if(sents.length && received.length) return 'BOOTH のギフト';
  if(sents.length) return 'BOOTH で贈ったもの';
  if(received.length) return 'BOOTH でもらったもの';
  return 'BOOTH の記録';
}
function drawIntro(sec,INTRO){
  bg();
  const k=ease(sec/1.2), out=sec>INTRO-0.7 ? 1-ease((sec-(INTRO-0.7))/0.7) : 1;
  g.globalAlpha=k*out;
  const x=W*0.13, y=H*0.60;
  if(items.length){
    const a=items[0].date, b=items[items.length-1].date;
    txt(a.getFullYear()===b.getFullYear() ? String(a.getFullYear())
        : `${a.getFullYear()} — ${b.getFullYear()}`, x, y-124, 29, C.dim,'left',300,3);
  }
  txt(headline(), x, y, 96, C.ink,'left',600,2,'m');
  rule(x, y+42, 148*ease((sec-0.35)/1.0), C.sent, 3);
  g.globalAlpha=1;
}

function drawMain(p,hud,extra,T){
  if(!buys.length) return;
  const T0=buys[0].date.getTime(), T1=buys[buys.length-1].date.getTime();
  const now=T0+(T1-T0)*p;
  const span=T.span;
  const tk=buildTicks(span), tnow=p*span+(extra||0);
  let shown=0,total=0;
  for(let i=0;i<buys.length;i++){ if(tk[i]<=tnow){shown=i+1; total+=buys[i].price;} else break; }

  const used=shown?slots[shown-1]+1:0;
  const rows=Math.ceil(used/cols), overflow=Math.max(0,rows*cell-wallH);
  const popDur=clamp(span/buys.length*6,0.25,1.1);
  const popOf=i=>(tnow-tk[i])/popDur;

  g.save(); g.beginPath(); g.rect(wallX,wallY-6,wallW+2,wallH+12); g.clip(); g.translate(0,-overflow);
  for(let i=0;i<shown;i++) tile(buys[i],slots[i],popOf(i));
  for(const m of marksM) if(m.i<shown) monthLine(m.pos,clamp(ease(popOf(m.i)),0,1));
  for(const m of marksY) if(m.i<shown) yearMark(m,clamp(ease(popOf(m.i)),0,1));
  g.restore();

  if(!hud) return;
  const d=new Date(now), ys=d.getFullYear()+'年';
  txt(ys,96,116,56,C.dim,'left',300,0,'m');
  txt(String(d.getMonth()+1).padStart(2,'0')+'月',96+measure(ys,56,300,0,'m')+20,116,56,C.ink,'left',600,0,'m');
  rule(96,150,W-192,'rgba(240,236,227,0.10)',2);
  rule(96,150,(W-192)*p,C.sent,2);

  txt(yen(total),96,H-44,90,C.ink,'left',600,0,'m');
  /* 増えるたびに「+いくら」。1件ずつ、下から上へ積み上がる。
     置き場所は固定。金額の桁で動かすとガタつく。重ならないよう1行ぶんずつ上へ逃がす */
  const lastTick=shown-1;
  const TX=96, TBASE=H-152, TLH=34, TMAX=5, TAX=176;   // 金額のすぐ上に積む。TAX＝金額を置く横位置
  for(let a=0;a<TMAX;a++){
    const i=lastTick-a; if(i<0) break;
    if(!buys[i].price) continue;
    const age=tnow-tk[i];
    const al=(1-a/(TMAX+1))*(1-clamp((age-0.9)/0.6,0,1))*Math.min(age/0.07,1);
    if(al<=0.02) continue;
    const y=TBASE-a*TLH, d=buys[i].date;
    const ds=d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0');
    g.globalAlpha=al;
    txt(ds, TX, y, 26, C.ink2,'left',300,0,'m');               // 買った日
    txt('+'+yen(buys[i].price), TX+TAX, y, 34, C.ink,'left',600,0,'m');
    g.globalAlpha=1;
  }
  txt(shown+' 点',W-96,H-44,44,C.dim,'right',300,0,'m');
  const lastBuy=buys[Math.max(shown-1,0)];
  if(shown) txt(ellipsis(lastBuy.shop+' / '+lastBuy.title,26,W-700),W-96,H-128,26,C.faint,'right',400);
}

function grid(list,cx,top,cols,cell,gap,t,delay,step,ring,base){
  const rows=Math.ceil(list.length/cols), gw=cols*(cell+gap)-gap, gx=cx-gw/2;
  let shown=0;
  for(let i=0;i<list.length;i++){
    const k=ease((t-delay-i*step)/0.45); if(k<=0) continue; shown=i+1;
    const x=gx+(i%cols)*(cell+gap), y=top+Math.floor(i/cols)*(cell+gap), w=cell*(0.45+0.55*k);
    const ox=x+(cell-w)/2, oy=y+(cell-w)/2;
    g.globalAlpha=base*Math.min(k,1);
    const o=list[i];
    if(o._im) g.drawImage(o._im,ox,oy,w,w);
    else{ const hue=hashHue(o.shop||o.title); g.fillStyle=`hsl(${hue} 40% 28%)`; g.fillRect(ox,oy,w,w); }
    if(k<1.3){ const a=Math.max(0,1-Math.abs(k-0.35)*1.8);
      g.strokeStyle=ring.replace('ALPHA',a.toFixed(2)); g.lineWidth=Math.max(w*0.07,1.5);
      g.strokeRect(ox,oy,w,w); }
    g.globalAlpha=base;
  }
  g.globalAlpha=1;
  return {shown, bottom: top+rows*(cell+gap)-gap};
}


/* 「+いくら」を1件ずつ出すための時刻表。
   買った日をそのまま使うと、一番混むところで 0.5秒に25件が同時に出て読めない。
   そこで「最低でも 0.055秒はあける」だけ後ろにずらす。ずれたぶんは次の空き時間で戻る。
   270件なら最低15秒あれば流しきれる（本編は63秒）。だから追いつかなくならない */
let ticks=null, ticksKey='';
function buildTicks(span){
  const key=span.toFixed(3)+'/'+buys.length+'/'+dataGen;
  if(ticksKey===key && ticks) return ticks;
  const T0=buys[0].date.getTime(), T1=buys[buys.length-1].date.getTime();
  const real=buys.map(o=>((o.date.getTime()-T0)/((T1-T0)||1))*span);
  const pack=min=>{ const out=new Array(real.length); let prev=-1e9;
    for(let i=0;i<real.length;i++){ out[i]=Math.max(real[i],prev+min); prev=out[i]; }
    return out; };
  /* ⚠️ 0.055秒で固定すると、点数が多い人や、買った日が一箇所に固まっている人で
     本編の長さを食いつぶし、**壁が最後まで埋まらない**（3倍のデータで実際に起きた）。
     入りきるまで間隔を詰める。全部出しきることを、読みやすさより優先する */
  const budget=span+TAIL*0.9;
  let min=0.055, out=pack(min);
  for(let k=0;k<10 && out[out.length-1]>budget;k++){
    min*=Math.max(budget/out[out.length-1]*0.98,0.05);
    out=pack(min);
  }
  ticks=out; ticksKey=key; return ticks;
}

/* 長さのつまみを短くすると、幕の合計が全体より長くなって本編が負の秒数になる。
   そうなる前に、幕のほうを一緒に縮める */
function times(){
  const hasB=buys.length>0, ny=yearRows().length;
  /* 年が1つしか無い＝期間で1年に絞った人。棒が1本だけの幕は、締めと同じ数字が並ぶだけなので出さない */
  const YEARS=ny>1 ? clamp(YEAR1+ny*YEAR2, 4.5, 14) : 0;
  const fixed=INTRO+(hasB?TAIL+HOLD:0)+(sents.length?SENT:0)+(received.length?RECV:0)+YEARS+OUTRO;
  const need=hasB?Math.max(DUR*0.30,3):0;
  const k=(DUR-fixed)>=need ? 1 : Math.max((DUR-need)/fixed, 0.12);
  const t={intro:INTRO*k, tail:(hasB?TAIL:0)*k, hold:(hasB?HOLD:0)*k,
           sent:(sents.length?SENT:0)*k, recv:(received.length?RECV:0)*k,
           years:YEARS*k, outro:OUTRO*k};
  /* 買ったものを出さない人は本編そのものが無い。
     壁が無いのに本編の秒数を取ると、真っ暗な画が何十秒も続く。だから幕のほうを伸ばす */
  if(!hasB){
    t.span=0;
    const rest=t.sent+t.recv+t.years+t.outro, gap=DUR-t.intro-rest;
    /* ⚠️ 余った時間を全部幕に流し込むと、240秒のつまみ×ギフト40点で
       1枚ずつが数秒かかる「止まって見える」動画になった。伸ばすのは1.8倍まで。
       それでも余るなら、水増しせずに動画そのものを短くする */
    if(gap>0 && rest>0){ const sc=Math.min(1+gap/rest, 1.8);
      t.sent*=sc; t.recv*=sc; t.years*=sc; t.outro*=sc; }
  } else {
    t.span=Math.max(DUR-t.intro-t.tail-t.hold-t.sent-t.recv-t.years-t.outro, 0.5);
  }
  /* 実際の長さ。買ったものがある人は DUR ちょうど。無い人はこれより短くなることがある */
  t.total=t.intro+t.span+t.tail+t.hold+t.sent+t.recv+t.years+t.outro;
  return t;
}
/* 焼く長さ・再生の長さは、つまみではなく「実際に中身がある長さ」を使う */
function runLen(){ return Math.max(times().total, 1); }

/* 幕。買ったものとは混ぜない */
function drawAct(t,o){
  const fade=Math.min(ease(t/0.7),1);
  if(fade<0.05) return;
  g.globalAlpha=fade;
  txt(o.title,W/2,150,70,C.ink,'center',600,3,'m');
  txt(o.sub,W/2,200,25,C.dim,'center',300,1);
  rule(W/2-40,222,80,o.accent,2);
  g.globalAlpha=1;

  const n=o.list.length;
  const cols=Math.ceil(Math.sqrt(n*1.85)), rows=Math.ceil(n/cols);
  const cell=Math.min((W-360)/cols/1.1,(H-462)/rows/1.1,152), gap=cell*0.10;
  const flow=Math.max(o.dur-3.6,0.8), step=flow/Math.max(n,1);
  const top=286+Math.max(0,((H-462)-rows*cell*1.1)/2);
  const r=grid(o.list,W/2,top,cols,cell,gap,t,1.0,step,o.ring,fade);

  if(r.shown){
    g.globalAlpha=fade;
    const cnt=r.shown+' 点';
    if(o.money){
      let sum=0; for(let i=0;i<r.shown;i++) sum+=o.money(o.list[i])||0;
      const money=yen(sum);
      const wc=measure(cnt,58,600,0,'m'), wm=measure(money,58,600,0,'m'), GAP=52;
      const x0=W/2-(wc+GAP+wm)/2;
      txt(cnt,x0,H-96,58,o.accent,'left',600,0,'m');
      txt(money,x0+wc+GAP,H-96,58,C.ink,'left',600,0,'m');
    } else {
      txt(cnt,W/2,H-96,58,o.accent,'center',600,0,'m');
    }
    g.globalAlpha=1;
  }
  if(o.foot && t>flow+1.4){
    g.globalAlpha=fade*ease((t-flow-1.4)/0.8);
    txt(o.foot,W/2,H-46,25,C.dim,'center',300);
    g.globalAlpha=1;
  }
}

function drawSentAct(t,dur){
  drawAct(t,{list:sents, title:'贈ったもの', sub:'贈った日の順',
    ring:'rgba(232,96,76,ALPHA)', accent:C.sent, dur:dur,
    money:x=>x.price, foot:null});
}
function drawRecvAct(t,dur){
  const lo=meta&&meta.receivedLow, hi=meta&&meta.receivedHigh;
  drawAct(t,{list:received.slice().reverse(), title:'もらったもの',
    sub:'受け取った順',
    ring:'rgba(217,168,74,ALPHA)', accent:C.recv, dur:dur, money:null,
    foot: lo?`いまの値段にすると ¥${lo.toLocaleString('ja-JP')} 〜 ¥${hi.toLocaleString('ja-JP')} ぶん`:null});
}

/* 年ごとに使った金額。締めの前に置く。
   総額だけだと「10年でこれだけ」としか分からない。年で割ると、
   買い方が変わった年（増えた年・止まった年）が見える */
function drawYearsAct(t,dur){
  const rows=yearRows(); if(!rows.length) return;
  const fade=Math.min(ease(t/0.7),1); if(fade<0.05) return;
  g.globalAlpha=fade;
  txt('年ごとに使った金額',W/2,150,70,C.ink,'center',600,3,'m');
  txt(sents.length?'買ったもの＋贈ったもの':(PICK.buy?'買ったもの':'贈ったもの'),
      W/2,200,25,C.dim,'center',300,1);
  rule(W/2-40,222,80,C.sent,2);
  g.globalAlpha=1;

  const n=rows.length, top=278, bottom=H-136;
  /* 行の高さの上限。年が少ない人（期間で絞った人）は大きくする。
     74のままだと3年で画面の下半分が空く */
  const rh=Math.min((bottom-top)/n, n>=8 ? 74 : 74+(8-n)*9);
  const y0=top+((bottom-top)-rh*n)/2;
  const fs=clamp(rh*0.50,13,36);
  const max=Math.max.apply(null,rows.map(r=>r.total).concat([1]));
  const LX=W*0.17, RX=W-W*0.17;
  let mw=0; for(const r of rows) mw=Math.max(mw,measure(yen(r.total),fs,600,0,'m'));
  const lw=measure('0000年',fs,300,0,'m')+fs*0.6;
  const bx=LX+lw, bw=Math.max(RX-mw-fs*0.9-bx, 40);
  const flow=Math.max(dur-2.4,0.6), step=flow/Math.max(n,1);

  for(let i=0;i<n;i++){
    const r=rows[i], k=ease((t-0.85-i*step)/0.55);
    if(k<=0) continue;
    const cy=y0+rh*i+rh*0.5, base=cy+fs*0.36;
    g.globalAlpha=fade*Math.min(k,1);
    txt(r.year+'年',LX,base,fs,C.ink2,'left',300,0,'m');
    /* 帯。買ったぶんは白、贈ったぶんは朱。積み上げると「その年に何をしたか」まで出る */
    const bh=Math.max(rh*0.34,4), by=cy-bh/2, full=bw*(r.total/max)*k;
    g.fillStyle='rgba(240,236,227,0.07)'; g.fillRect(bx,by,bw,bh);
    const sw=r.total?full*(r.sent/r.total):0;
    g.fillStyle='rgba(240,236,227,0.80)'; g.fillRect(bx,by,full-sw,bh);
    if(sw>0){ g.fillStyle=C.sent; g.fillRect(bx+full-sw,by,sw,bh); }
    txt(yen(r.total),RX,base,fs,r.total>=max?C.ink:C.ink2,'right',600,0,'m');
    g.globalAlpha=1;
  }
  if(received.length && t>flow+1.2){
    g.globalAlpha=fade*ease((t-flow-1.2)/0.8);
    txt('もらったものは、受け取った日がBOOTHに残っていないので入れていません',
        W/2,H-46,25,C.dim,'center',300);
    g.globalAlpha=1;
  }
}

function drawOutro(t){
  const q=Math.min(ease(t/0.9),1);
  if(q<0.08) return;
  const vg=g.createRadialGradient(W*0.44,H*0.46,120,W*0.5,H*0.5,W*0.50);
  vg.addColorStop(0,'rgba(6,5,5,0)'); vg.addColorStop(1,'rgba(6,5,5,1)');
  g.fillStyle=vg; g.fillRect(0,0,W,H);
  g.globalAlpha=q;

  const x=W*0.13, sh=shopsOf();
  if(items.length){
    const a=items[0].date, b=items[items.length-1].date;
    txt(`${a.getFullYear()}.${String(a.getMonth()+1).padStart(2,'0')} — ${b.getFullYear()}.${String(b.getMonth()+1).padStart(2,'0')}`,
        x,318,28,C.dim,'left',300,3);
  }
  if(items.length){
    txt(buys.length?'BOOTH で使った金額':'BOOTH で贈った金額',x,392,40,C.ink2,'left',600,2,'m');
    txt(yen(grandTotal()*ease((t-0.4)/2.4)),x,540,140,C.ink,'left',600,0,'m');
  } else {
    /* もらったものだけを出す人。金額は実額が存在しないので、点数を主役にする */
    const lo=meta&&meta.receivedLow, hi=meta&&meta.receivedHigh;
    txt('BOOTH でもらったもの',x,392,40,C.ink2,'left',600,2,'m');
    txt(Math.round(received.length*ease((t-0.4)/2.4))+' 点',x,540,140,C.ink,'left',600,0,'m');
    if(lo) txt(`いまの値段にすると ¥${lo.toLocaleString('ja-JP')} 〜 ¥${(hi||lo).toLocaleString('ja-JP')} ぶん`,
               x,594,32,C.dim,'left',300,1);
  }
  if(items.length && sh) txt(`${sh} ショップ`,x,594,32,C.dim,'left',300,1);
  rule(x,646,W-x*2,'rgba(240,236,227,0.12)');
  g.globalAlpha=1;

  if(t>2.6){
    g.globalAlpha=q*ease((t-2.6)/0.8);
    const bs=buys.reduce((p,y)=>p+y.price,0), ss=sents.reduce((p,y)=>p+y.price,0);
    /* もらった分は実額が存在しないので、いまの値段の目安。買った金額とは足さない */
    const rl=meta&&meta.receivedLow, rh=meta&&meta.receivedHigh;
    /* 選ばれていない欄は、空けずに詰める。空欄が残ると「取れなかった」ように見える */
    const ent=[];
    if(buys.length)  ent.push({l:'買った',  n:buys.length+' 点',  c:C.ink,  s:yen(bs)});
    if(sents.length) ent.push({l:'贈った',  n:sents.length+' 点', c:C.sent, s:yen(ss)});
    if(received.length) ent.push({l:'もらった', n:received.length+' 点', c:C.recv,
        s:rl?('¥'+rl.toLocaleString('ja-JP')+'〜'+(rh||rl).toLocaleString('ja-JP')):null, note:!!rl});
    /* 1種類しか出していないと、見出しと内訳がまったく同じ数字になる（実際になった）。
       金額は上に出ているので、下は点数だけにする。もらったものだけの人は内訳ごと消す */
    if(ent.length===1){
      if(!items.length) ent.length=0;
      else { ent[0].s=null; ent[0].note=false; }
    }
    const Y=730;
    ent.forEach((e,i)=>{
      const cx=x+i*330;
      txt(e.l,cx,Y,25,C.dim,'left',300,1);
      txt(e.n,cx,Y+60,46,e.c,'left',600,0,'m');
      if(e.s) txt(e.s,cx,Y+104,25,C.faint,'left',300);
      if(e.note) txt('いまの値段にすると',cx,Y+134,22,C.faint,'left',300);
    });
    g.globalAlpha=1;
  }
}
function shopsOf(){ return new Set(items.map(i=>i.shop).filter(Boolean)).size; }
/* 合計金額。全部を出すときだけ「お支払金額」（送料込み）を使う。
   一部だけを出しているのに送料込みの総額を出すと、足し算が合わなくなる */
function grandTotal(){
  const mp=meta&&meta.pick;
  const whole = PICK.buy && PICK.sent && !narrowed()
             && (!mp || (mp.buy!==false && mp.sent!==false));
  if(whole && meta && meta.paidTotal) return meta.paidTotal;
  return items.reduce((a,b)=>a+b.price,0);
}

function frame(sec){
  bg();
  if(!items.length && !received.length){ note(HINT,HINT2); return; }
  const T=times();
  if(sec<T.intro){ drawIntro(sec,T.intro); return; }
  const m0=T.intro+T.span+T.tail+T.hold, m1=m0+T.sent, m2=m1+T.recv, m3=m2+T.years;
  if(T.span>0) drawMain(clamp((sec-T.intro)/T.span,0,1), sec<=m0+0.35,
                        Math.max(0,sec-T.intro-T.span), T);
  if(sec<=m0) return;
  /* 暗幕は一度だけ。幕ごとに張ると前の幕が透ける（事故った）。
     締めだけ 0.92 にして、壁をわざと薄く残す */
  const veil = (sec>m3) ? 0.92 : 1.0;
  g.fillStyle=`rgba(6,5,5,${ease((sec-m0)/1.0)*veil})`; g.fillRect(0,0,W,H);
  if(T.sent && sec<=m1){ drawSentAct(sec-m0,T.sent); return; }
  if(T.recv && sec<=m2){ drawRecvAct(sec-m1,T.recv); return; }
  if(T.years && sec<=m3){ drawYearsAct(sec-m2,T.years); return; }
  drawOutro(sec-m3);
}



/* ===== 再生 ===== */
function loop(ts){
  if(!t0) t0=ts;
  const sec=(ts-t0)/1000, L=runLen();
  frame(Math.min(sec,L));
  if(sec<L) raf=requestAnimationFrame(loop);
  else{ raf=0; if(recorder&&recorder.state==='recording') recorder.stop(); }
}
function start(){ cancelAnimationFrame(raf); t0=0; layout(); raf=requestAnimationFrame(loop); }

/* ===== 焼く =====
   MediaRecorder は「実時間で1回再生しながら録る」しかできない。103秒待たされるし、
   タブを離れると止まる。WebCodecs なら1コマずつ自分で送れるので、速いし裏でも進む。 */
const BAKE_FPS=30;
/* 裏のタブでも止まらない待ち。setTimeout は裏だと1秒に1回まで絞られる */
const yieldNow = () => new Promise(r=>{ const ch=new MessageChannel();
  ch.port1.onmessage=()=>r(); ch.port2.postMessage(0); });

/* 出す大きさ。スマホは1080pだとメモリが持たないことがあるので720pに落とせる */
function outSize(){
  const e=document.getElementById('bhv-light');
  return (e && e.checked) ? {w:1280,h:720,rate:3.2e6} : {w:W,h:H,rate:6e6};
}
async function pickCodec(){
  if(typeof VideoEncoder==='undefined' || typeof Mp4Muxer==='undefined') return null;
  const o=outSize();
  for(const c of ['avc1.640028','avc1.4D4028','avc1.42E01F','avc1.4D401F','avc1.640020','avc1.42001f']){
    try{ const r=await VideoEncoder.isConfigSupported(
      {codec:c,width:o.w,height:o.h,bitrate:o.rate,framerate:BAKE_FPS});
      if(r.supported) return c; }catch(e){}
  }
  return null;
}
let shrinkCv=null;
async function bake(codec,onProgress){
  const L=runLen(), N=Math.round(L*BAKE_FPS), o=outSize(), scale=(o.w!==W);
  if(scale){ shrinkCv=shrinkCv||document.createElement('canvas');
             shrinkCv.width=o.w; shrinkCv.height=o.h; }
  const src=scale?shrinkCv:cv, sg=scale?shrinkCv.getContext('2d'):null;
  const muxer=new Mp4Muxer.Muxer({ target:new Mp4Muxer.ArrayBufferTarget(),
    video:{codec:'avc',width:o.w,height:o.h,frameRate:BAKE_FPS}, fastStart:'in-memory' });
  let err=null;
  const enc=new VideoEncoder({ output:(c,m)=>muxer.addVideoChunk(c,m), error:e=>{err=e;} });
  enc.configure({codec:codec,width:o.w,height:o.h,bitrate:o.rate,framerate:BAKE_FPS});
  for(let i=0;i<N;i++){
    if(err) throw err;
    frame(i/BAKE_FPS);
    if(scale) sg.drawImage(cv,0,0,o.w,o.h);
    const vf=new VideoFrame(src,{timestamp:Math.round(i*1e6/BAKE_FPS),
                                duration:Math.round(1e6/BAKE_FPS)});
    enc.encode(vf,{keyFrame: i%(BAKE_FPS*2)===0}); vf.close();
    if(i%15===0) onProgress(i,N);
    while(enc.encodeQueueSize>8) await yieldNow();
    if(i%3===0) await yieldNow();
  }
  await enc.flush(); muxer.finalize();
  if(err) throw err;
  return new Blob([muxer.target.buffer],{type:'video/mp4'});
}
function saveBlob(b,name){
  const u=URL.createObjectURL(b), a=document.createElement('a');
  a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),8000);
}

/* WebCodecs が無い環境のための逃げ道。実時間で録る昔のやり方 */
function recordRealtime(){
  const stream=cv.captureStream(60); chunks=[];
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:16e6});
  recorder.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  recorder.onstop=()=>{ saveBlob(new Blob(chunks,{type:'video/webm'}),'booth_history.webm');
    S.textContent='保存した（webm）'; setBusy(false); };
  recorder.start();
  S.textContent='録画中… '+Math.round(runLen())+'秒かかります。この画面を開いたまま、消さないでください';
  start();
}

/* ===== ボタン ===== */
const el=id=>document.getElementById('bhv-'+id);
const on=(id,fn)=>{ const e=el(id); if(e) e.onclick=fn; };
function setBusy(b){ for(const id of ['rec','play','grab','demo','dur','thumb','light',
                                      'pbuy','psent','precv','yfrom','yto'])
  { const e=el(id); if(e) e.disabled=b; }
  if(!b){ syncRecvBox(); const y=el('yfrom'); if(y&&dataYears.length<2){ y.disabled=true; el('yto').disabled=true; } } }

on('demo',()=>{ items=normalize(demo()); S.textContent=items.length+'点（デモ）'; start(); });
if(el('file')) el('file').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  S.textContent='読み込み中…';
  const r=new FileReader();
  r.onload=()=>{ try{ items=normalize(JSON.parse(r.result));
      S.textContent=`${items.length}点 / もらった${received.length}点`; start(); }
    catch(err){ S.textContent='JSONが読めない：'+err.message; } };
  r.readAsText(f);
};
on('play',start);
if(el('dur')) el('dur').oninput=e=>{ DUR=+e.target.value; el('durv').textContent=DUR; };

/* ===== 出すものを選ぶ =====
   読み込んだあとに切り替えたときは、読み直さずにその場で作り直す。
   ただし「読みに行かなかったもの」は手元に無いので、そのときだけ読み直してもらう */
function readPick(){
  const q=id=>{ const e=el(id); return e ? !!e.checked : true; };
  PICK.buy=q('pbuy'); PICK.sent=q('psent'); PICK.recv=q('precv');
  if(!PICK.buy && !PICK.sent && !PICK.recv){       // 全部外すと何も無くなる
    PICK.buy=true; const e=el('pbuy'); if(e) e.checked=true;
    S.textContent='ひとつは選んでください';
  }
}
function missingPick(){
  const mp=meta&&meta.pick; if(!mp) return null;
  const ng=[];
  if(PICK.buy && mp.buy===false) ng.push('買ったもの');
  if(PICK.sent && mp.sent===false) ng.push('贈ったもの');
  if(PICK.recv && mp.recv===false) ng.push('もらったもの');
  return ng.length?ng.join('と'):null;
}
/* ===== 期間を選ぶ =====
   プルダウンの中身は、読み込んだデータに実際にある年だけ。
   存在しない年を選ばせて「0点でした」と言われるのが一番腹立たしい */
function readRange(){
  const v=id=>{ const e=el(id); const n=e?+e.value:0; return n?n:null; };
  let a=v('yfrom'), b=v('yto');
  if(a!==null && b!==null && a>b){            // 逆に選ばれたら、黙って入れ替える
    const t=a; a=b; b=t;
    const ea=el('yfrom'), eb=el('yto'); if(ea) ea.value=a; if(eb) eb.value=b;
  }
  RANGE.from=a; RANGE.to=b;
}
function fillYears(){
  for(const q of [['yfrom','最初から','from'],['yto','最後まで','to']]){
    const e=el(q[0]); if(!e) continue;
    const cur=RANGE[q[2]];
    e.innerHTML='<option value="">'+q[1]+'</option>'
      +dataYears.map(y=>'<option value="'+y+'">'+y+'年</option>').join('');
    if(cur!==null && dataYears.indexOf(cur)>=0) e.value=String(cur);
    else { e.value=''; RANGE[q[2]]=null; }    // 読み直して消えた年は、選択ごと落とす
    e.disabled=dataYears.length<2;            // 1年しか無い人に選ばせても意味が無い
  }
  syncRecvBox();
}
/* 期間で絞っているあいだ、「もらった」は押せなくする。
   チェックは外さない（期間を戻したら、そのまま戻ってくるように） */
function syncRecvBox(){
  const e=el('precv'), n=el('pnote'), on=narrowed();
  if(e){ e.disabled=on; if(e.parentElement) e.parentElement.style.opacity=on?'.45':''; }
  if(n){ n.textContent=on?'※「もらったもの」は受け取った日がBOOTHに残っていないので、期間では絞れません':'';
         n.style.display=on?'':'none'; }
}

function applyPick(){
  readPick(); readRange(); syncRecvBox();
  if(!rawData){ frame(0); return; }
  items=normalize(rawData);
  const miss=missingPick();
  if(!items.length && !received.length){       // 選んだものが手元に1件も無い
    if(narrowed()){
      HINT='その期間には、1件もありませんでした';
      HINT2='「期間」を広げてください';
    } else {
      HINT='選んだものは、1件もありませんでした';
      HINT2=miss ? miss+'は読み込んでいません。もう一度読んでください'
                 : '「出すもの」のチェックを見直してください';
    }
    S.textContent=HINT2; frame(0); return;
  }
  S.textContent = miss ? miss+'は読み込んでいません。もう一度読んでください'
                       : items.length+'点 / もらった'+received.length+'点'
                         +(narrowed()?'（'+rangeLabel()+'）':'');
  start();
}
for(const id of ['pbuy','psent','precv','yfrom','yto']){
  const e=el(id); if(e) e.onchange=applyPick;
}

let recOK=false;
on('rec',async()=>{
  if(!items.length && !received.length){ S.textContent='先に履歴を読む'; return; }
  if(!recOK && [...items,...received].some(o=>o.img)){
    if(!confirm('この動画には、あなたが買った商品のサムネイル画像が入ります。\n'
               +'それぞれの画像は、出品者の方の著作物です。\n\n'
               +'SNSなどに公開するかどうかは、ご自身でご判断ください。\n'
               +'（サムネなしで作りたいときは「サムネを使う」のチェックを外して読み直してください）\n\n'
               +'動画を作りますか？')) { S.textContent='やめました'; return; }
    recOK=true;
  }
  cancelAnimationFrame(raf); raf=0;
  setBusy(true);
  const codec=await pickCodec();
  if(!codec){
    S.textContent='この環境では速く作れません。実時間で録ります（webm）';
    note('この端末では mp4 を直接作れません','実時間で録画します。'+Math.round(runLen())+'秒かかります');
    recordRealtime(); return; }
  const t0=Date.now();
  try{
    const blob=await bake(codec,(i,n)=>{
      S.textContent='動画を作っています '+Math.floor(i/n*100)+'%（'+Math.round(i/BAKE_FPS)+'/'+Math.round(runLen())+'秒ぶん）';
    });
    saveBlob(blob,'booth_history.mp4');
    S.textContent='できた（mp4 '+(blob.size/1024/1024).toFixed(1)+'MB / '
                 +((Date.now()-t0)/1000).toFixed(0)+'秒で作成）';
  }catch(e){ S.textContent='だめだった：'+(e.message||e); }
  setBusy(false); frame(runLen());
});


/* ---- 取り出し（試作/取り出し.js から自動で持ってきている） ---- */
async function collectBooth(report, opt){
  /* 何を読むか。拡張・userscript から BHV_OPT で渡す。コンソールに貼ったときは全部読む。
     選ばなかったものは「読みに行かない」。時間が減るだけでなく、
     見られたくないものを手元にも作らない、という意味がある */
  opt = opt || {};
  const wantBuy = opt.buy !== false, wantSent = opt.sent !== false, wantRecv = opt.recv !== false;

  const P = new DOMParser(), sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = e => e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '';
  const get = async u => P.parseFromString(await (await fetch(u, {credentials:'include'})).text(), 'text/html');
  const log = m => { console.log('[booth]', m); report(m); };

  // 金額はDOMの要素から取る。テキスト連結だとショップ名と桁がつながって壊れる
  const money = (doc, label) => {
    const l = [...doc.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === label);
    if (!l) return null;
    const n = l.nextElementSibling || (l.parentElement && l.parentElement.nextElementSibling);
    return n ? (+n.textContent.replace(/[^\d]/g, '') || null) : null;
  };

  // 1) 注文ID（買ったもの・贈ったものを出さないなら、そもそも開かない）
  const ids = [];
  if (wantBuy || wantSent) {
    const d1 = await get('/orders?page=1');
    const last = Math.max(1, ...[...d1.querySelectorAll('a[href*="/orders?page="]')]
      .map(a => +((a.getAttribute('href').match(/page=(\d+)/) || [])[1] || 0)));
    for (let p = 1; p <= last; p++) {
      const d = p === 1 ? d1 : await get('/orders?page=' + p);
      [...d.querySelectorAll('a[href^="/orders/"]')].forEach(a => {
        const m = a.getAttribute('href').match(/^\/orders\/(\d+)/); if (m) ids.push(m[1]);
      });
      log(`注文一覧 ${p}/${last}`); await sleep(120);
    }
    // ログインしていないと0件になる。そこで止めて理由を返す
    if (!ids.length) throw new Error('購入履歴が読めません。BOOTHにログインしてから、もう一度。');
  }
  const list = [...new Set(ids)];

  // 2) 明細
  const orders = [];
  for (let i = 0; i < list.length; i++) {
    const id = list[i];
    try {
      const d = await get('/orders/' + id);
      const all = txt(d.querySelector('.manage-page-body') || d.body);
      // 表示言語が日本語とは限らない。見出しで拾えなければ、日付の形そのものを探す
      const dm = all.match(/注文日時\s*(20\d\d\/\d\d\/\d\d \d\d:\d\d:\d\d)/)
              || all.match(/(20\d\d\/\d\d\/\d\d \d\d:\d\d:\d\d)/);
      const shops = [...d.querySelectorAll('.l-order-detail-by-shop')].map(sec => {
        const sa = [...sec.querySelectorAll('a')]
          .find(x => /^https?:\/\/[a-z0-9-]+\.booth\.pm\/?$/.test(x.getAttribute('href') || ''));
        const items = [...sec.querySelectorAll('.sheet')].map(sh => {
          // 商品ページへのリンクは2本ある。1本目はサムネ（文字が無い）、2本目が商品名。
          // querySelector で先頭を取ると「(無題)」になる（2026-08-21に実際に空になった）
          const links = [...sh.querySelectorAll('a[href*="/items/"]')];
          const ia = links.find(x => !x.querySelector('img') && txt(x))
                  || links.find(x => txt(x)) || links[0];
          if (!ia) return null;
          const t = txt(sh);
          const ps = (t.match(/¥\s*[\d,]+/g) || []).map(s => +s.replace(/[^\d]/g, ''));
          const im = sh.querySelector('img');
          return { title: txt(ia) || (im && (im.getAttribute('alt') || '').trim()) || '', url: ia.getAttribute('href'),
                   price: ps[0] || 0, boost: ps[1] || 0,
                   img: im ? im.getAttribute('src').replace('/c/72x72_a2_g5/', '/c/300x300_a2_g5/') : null };
        }).filter(Boolean);
        return { shop: sa ? txt(sa) : null, shopUrl: sa ? sa.getAttribute('href') : null, items };
      });
      orders.push({ id, datetime: dm ? dm[1] : null,
                    paid: money(d, 'お支払金額') || money(d, 'Payment amount'),
                    isGift: /ギフト|\bGift\b/.test(all), shops });
    } catch (e) { console.warn('[booth] skip', id, e.message); }
    if ((i + 1) % 20 === 0) log(`明細 ${i + 1}/${list.length}`);
    await sleep(110);
  }

  // 3) もらったギフト（日付も金額も無い）
  const received = [];
  if (wantRecv) try {
    const g1 = await get('/library/gifts?page=1');
    const gl = Math.max(1, ...[...g1.querySelectorAll('a[href*="/library/gifts?page="]')]
      .map(a => +((a.getAttribute('href').match(/page=(\d+)/) || [])[1] || 0)));
    for (let p = 1; p <= gl; p++) {
      const d = p === 1 ? g1 : await get('/library/gifts?page=' + p);
      const seen = new Set();
      [...d.querySelectorAll('a[href*="/items/"]')].forEach(a => {
        const url = a.getAttribute('href'); if (seen.has(url)) return; seen.add(url);
        const box = a.parentElement.parentElement, im = box.querySelector('img');
        const sa = [...box.querySelectorAll('a')]
          .find(x => /^https?:\/\/[a-z0-9-]+\.booth\.pm\/?$/.test(x.getAttribute('href') || ''));
        const tl = [...box.querySelectorAll('a[href*="/items/"]')];
        const ta = tl.find(x => !x.querySelector('img') && txt(x)) || tl.find(x => txt(x));
        received.push({ url, title: txt(ta) || (im && (im.getAttribute('alt') || '').trim()) || null,
                        shop: sa ? txt(sa) : null,
                        img: im ? im.getAttribute('src') : null });
      });
      log(`ギフト ${p}/${gl}`); await sleep(150);
    }
  } catch (e) { console.warn('[booth] ギフトは取れなかった', e.message); }

  // 4) 動画用に平らにする
  const items = [];
  for (const o of orders) {
    if (o.isGift ? !wantSent : !wantBuy) continue;      // 選ばなかった種類は持ち帰らない
    for (const s of o.shops) for (const it of s.items)
    items.push({ date: o.datetime ? o.datetime.slice(0, 10).replace(/\//g, '-') : null,
      datetime: o.datetime, title: it.title, shop: s.shop, shopUrl: s.shopUrl,
      price: (it.price || 0) + (it.boost || 0), basePrice: it.price || 0, boost: it.boost || 0,
      type: o.isGift ? 'gift_sent' : 'buy', url: it.url, img: it.img, orderId: o.id });
  }
  items.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  const out = { meta: { source: 'booth', exportedAt: new Date().toISOString(),
      orders: orders.length, items: items.length,
      shops: new Set(items.map(i => i.shop)).size,
      itemTotal: items.reduce((a, b) => a + b.price, 0),
      // お支払金額が1件も取れなかった環境では、商品の合計で代用する
      paidTotal: orders.filter(o => o.isGift ? wantSent : wantBuy)
                       .reduce((a, o) => a + (o.paid || 0), 0)
                 || items.reduce((a, b) => a + b.price, 0),
      pick: { buy: wantBuy, sent: wantSent, recv: wantRecv },
      first: items[0] && items[0].date, last: items[items.length - 1] && items[items.length - 1].date,
      giftSent: items.filter(i => i.type === 'gift_sent').length, giftReceived: received.length },
    orders: orders.map(o => ({ id: o.id, datetime: o.datetime, paid: o.paid, isGift: o.isGift })),
    items, received };

  console.log('[booth] できた', out.meta);
  return out;
}


/* ---- もらったものの「いまの値段」----
   BOOTHは、もらったギフトの受け取り日も実際の金額も持っていない（何度も確かめた）。
   だから商品ページの「いまの販売価格」を拾って“相当額”として出す。実額ではない。
   値段に幅があるのは、色違いなどで価格帯があるから。
   商品ページは booth.pm（別オリジン）なので、ここも GM_xmlhttpRequest でないと取れない */
/* 取りに行く口。名前が2つある。
   PCのTampermonkey＝GM_xmlhttpRequest ／ iOSのUserscriptsアプリ＝GM.xmlHttpRequest。
   どちらか有る方を使う（iPhoneで動かす余地を残すため） */
const GMX = (typeof GM_xmlhttpRequest==='function') ? GM_xmlhttpRequest
          : (typeof GM!=='undefined' && GM && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM)
          : null;
const gmText = url => new Promise((res,rej)=>{
  if(!GMX) return rej(new Error('この環境では外のページを読めません'));
  GMX({ method:'GET', url:url, timeout:20000,
    onload: r => (r.status>=200 && r.status<300) ? res(r.responseText) : rej(new Error('HTTP '+r.status)),
    onerror: () => rej(new Error('通信できません')), ontimeout: () => rej(new Error('時間切れ')) });
});
async function addReceivedPrices(data, report){
  const list=(data.received||[]).filter(o=>o && /^https:\/\/([a-z0-9-]+\.)?booth\.pm\//.test(o.url||''));
  if(!list.length) return;
  let lo=0, hi=0, ok=0, gone=0, n=0;
  const one=async o=>{
    try{
      const h=await gmText(o.url);
      const m=h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if(m){
        const off=(JSON.parse(m[1])||{}).offers||{};
        const a=off.lowPrice!=null?+off.lowPrice:(off.price!=null?+off.price:null);
        const b=off.highPrice!=null?+off.highPrice:a;
        if(a!=null && !isNaN(a)){ o.priceLow=a; o.priceHigh=b; lo+=a; hi+=(b||a); ok++; }
        else gone++;
      } else gone++;
    }catch(e){ gone++; }                      // 消えた商品は数えるだけ
    if(++n%10===0||n===list.length) report('もらったものの値段 '+n+'/'+list.length);
  };
  for(let i=0;i<list.length;i+=4) await Promise.all(list.slice(i,i+4).map(one));
  if(ok){
    data.meta=data.meta||{};
    data.meta.receivedLow=lo; data.meta.receivedHigh=hi;
    data.meta.receivedPriced=ok; data.meta.receivedGone=gone;
  }
}

/* ---- サムネ。GM_xmlhttpRequest なら CORS の外で取れる ---- */
const SAFE_IMG = u => typeof u==='string' && u.startsWith('https://booth.pximg.net/');
const gmBlob = url => new Promise((res,rej)=>{
  if(!GMX) return rej(new Error('この環境ではサムネを取れません'));
  GMX({ method:'GET', url:url, responseType:'blob', timeout:20000,
    onload: r => (r.status>=200 && r.status<300) ? res(r.response) : rej(new Error('HTTP '+r.status)),
    onerror: () => rej(new Error('通信できません')), ontimeout: () => rej(new Error('時間切れ')) });
});
async function attachImages(data){
  const all=[...(data.items||[]),...(data.received||[])];
  for(const o of all) if(o.img && !SAFE_IMG(o.img)) o.img=null;   // よそのURLは踏まない
  const urls=[...new Set(all.map(o=>o.img).filter(Boolean))];
  const map=new Map(); let n=0, ng=0;
  const one=async u=>{ try{ map.set(u,URL.createObjectURL(await gmBlob(u))); }catch(e){ ng++; }
    if(++n%20===0||n===urls.length) S.textContent='サムネ '+n+'/'+urls.length; };
  for(let i=0;i<urls.length;i+=6) await Promise.all(urls.slice(i,i+6).map(one));
  for(const o of all) if(o.img&&map.has(o.img)) o.img=map.get(o.img);
  if(ng) console.warn('[booth] サムネ取れず', ng, '件');
}

HINT='左上の「① まずこれを押す」から';
HINT2='あなたの購入履歴を読み込みます。1〜2分かかります';
const gb=document.getElementById('bhv-grab');
gb.onclick=async()=>{
  gb.disabled=true; gb.textContent='読み込み中…'; gb.style.opacity='.55'; gb.style.cursor='default';
  const step=m=>{ S.textContent=m; note('BOOTHを読んでいます…', m); };   // 画面の真ん中に大きく出す
  readPick(); readRange();          // 選ばなかったものは、そもそも読みに行かない
  /* 期間で絞っているときは「もらったもの」を出せない＝読む必要も無い。
     読まなければ、そのぶん速く終わるし、手元にも作らない */
  step('はじめました');
  try{
    const data=await collectBooth(step, {buy:PICK.buy, sent:PICK.sent, recv:useRecv()});
    if(useRecv() && (data.received||[]).length){
      note('BOOTHを読んでいます…','もらったものの値段を調べています');
      await addReceivedPrices(data, m=>{ S.textContent=m; note('BOOTHを読んでいます…', m); });
    }
    if(document.getElementById('bhv-thumb').checked){
      note('BOOTHを読んでいます…','サムネイルを取っています');
      await attachImages(data);
    } else for(const o of [...(data.items||[]),...(data.received||[])]) o.img=null;
    items=normalize(data);
    S.textContent=items.length+'点 / もらった'+received.length+'点';
    gb.textContent='もう一度読む'; gb.disabled=false; gb.style.opacity=''; gb.style.cursor='pointer';
    start();
  }catch(e){
    note('だめだった', e.message);
    S.textContent='だめだった：'+e.message;
    gb.textContent='① まずこれを押す'; gb.disabled=false; gb.style.opacity=''; gb.style.cursor='pointer';
  }
};
frame(0);
}
})();
