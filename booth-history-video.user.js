// ==UserScript==
// @name         BOOTH履歴ムービー（非公式）
// @namespace    booth-history-video
// @version      0.6.0
// @description  BOOTHの購入・ギフト履歴を動画にします。データはあなたのブラウザから出ません。BOOTH/pixivの公式ツールではありません。
// @match        https://accounts.booth.pm/orders*
// @match        https://accounts.booth.pm/library*
// @icon         https://booth.pm/favicon.ico
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
#bhv-bar input[type=checkbox]{width:18px;height:18px;}
#bhv-bar input[type=range]{width:120px;vertical-align:middle;}
#bhv-status{margin-left:auto;font-size:13px;color:#8a8177;}
#bhv-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;}
#bhv-cv{max-width:100%;max-height:100%;background:#000;}
@media (max-width:820px){
  #bhv-bar{padding:8px;gap:6px;}
  #bhv-bar button{padding:12px 14px;font-size:15px;flex:1 1 auto;min-width:44%;}
  #bhv-bar button.wide{min-width:100%;}
  #bhv-status{margin-left:0;width:100%;order:99;font-size:12px;line-height:1.4;}
  #bhv-bar label,#bhv-bar .t{font-size:13px;}
  #bhv-bar input[type=range]{width:90px;}
  #bhv-stage{padding:6px;}
}`;
function build(){
  const st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);
  root=document.createElement('div'); root.id='bhv-root';
  root.innerHTML =
   '<div id="bhv-bar">'
  +  '<button id="bhv-grab" class="go wide">① まずこれを押す</button>'
  +  '<label><input id="bhv-thumb" type="checkbox" checked>サムネを使う</label>'
  +  '<label><input id="bhv-light" type="checkbox">軽くする(720p)</label>'
  +  '<span class="t">長さ <input id="bhv-dur" type="range" min="40" max="240" value="103"><b id="bhv-durv">103</b>秒</span>'
  +  '<button id="bhv-play">もう一度見る</button>'
  +  '<button id="bhv-rec" class="go">② 動画にする</button>'
  +  '<button id="bhv-close">閉じる</button>'
  +  '<span id="bhv-status"></span>'
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
"use strict";var Mp4Muxer=(()=>{var e=Object.defineProperty,t=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,s=Object.prototype.hasOwnProperty,a=(e,t,i)=>{if(!t.has(e))throw TypeError("Cannot "+i)},r=(e,t,i)=>(a(e,t,"read from private field"),i?i.call(e):t.get(e)),n=(e,t,i)=>{if(t.has(e))throw TypeError("Cannot add the same private member more than once");t instanceof WeakSet?t.add(e):t.set(e,i)},o=(e,t,i,s)=>(a(e,t,"write to private field"),s?s.call(e,i):t.set(e,i),i),h=(e,t,i)=>(a(e,t,"access private method"),i),l={};((t,i)=>{for(var s in i)e(t,s,{get:i[s],enumerable:!0})})(l,{ArrayBufferTarget:()=>Me,FileSystemWritableFileStreamTarget:()=>Oe,Muxer:()=>Rt,StreamTarget:()=>We});var d,f,u,m,p,c,w,g,b=new Uint8Array(8),y=new DataView(b.buffer),k=e=>[(e%256+256)%256],T=e=>(y.setUint16(0,e,!1),[b[0],b[1]]),C=e=>(y.setUint32(0,e,!1),[b[1],b[2],b[3]]),v=e=>(y.setUint32(0,e,!1),[b[0],b[1],b[2],b[3]]),S=e=>(y.setUint32(0,Math.floor(e/2**32),!1),y.setUint32(4,e,!1),[b[0],b[1],b[2],b[3],b[4],b[5],b[6],b[7]]),x=e=>(y.setInt16(0,256*e,!1),[b[0],b[1]]),z=e=>(y.setInt32(0,65536*e,!1),[b[0],b[1],b[2],b[3]]),E=e=>(y.setInt32(0,2**30*e,!1),[b[0],b[1],b[2],b[3]]),A=(e,t=!1)=>{let i=Array(e.length).fill(null).map(((t,i)=>e.charCodeAt(i)));return t&&i.push(0),i},M=e=>e&&e[e.length-1],W=e=>{let t;for(let i of e)(!t||i.presentationTimestamp>t.presentationTimestamp)&&(t=i);return t},O=(e,t,i=!0)=>{let s=e*t;return i?Math.round(s):s},B=e=>{let t=e*(Math.PI/180),i=Math.cos(t),s=Math.sin(t);return[i,s,0,-s,i,0,0,0,1]},U=B(0),D=e=>[z(e[0]),z(e[1]),E(e[2]),z(e[3]),z(e[4]),E(e[5]),z(e[6]),z(e[7]),E(e[8])],j=e=>e?"object"!=typeof e?e:Array.isArray(e)?e.map(j):Object.fromEntries(Object.entries(e).map((([e,t])=>[e,j(t)]))):e,R=e=>e>=0&&e<2**32,I=(e,t,i)=>({type:e,contents:t&&new Uint8Array(t.flat(10)),children:i}),N=(e,t,i,s,a)=>I(e,[k(t),C(i),s??[]],a),V=e=>({type:"mdat",largeSize:e}),F=(e,t,i=!1)=>I("moov",null,[L(t,e),...e.map((e=>$(e,t))),i?me(e):null]),L=(e,t)=>{let i=O(Math.max(0,...t.filter((e=>e.samples.length>0)).map((e=>{const t=W(e.samples);return t.presentationTimestamp+t.duration}))),Bt),s=Math.max(...t.map((e=>e.id)))+1,a=!R(e)||!R(i),r=a?S:v;return N("mvhd",+a,0,[r(e),r(e),v(Bt),r(i),z(1),x(1),Array(10).fill(0),D(U),Array(24).fill(0),v(s)])},$=(e,t)=>I("trak",null,[P(e,t),H(e,t)]),P=(e,t)=>{let i,s=W(e.samples),a=O(s?s.presentationTimestamp+s.duration:0,Bt),r=!R(t)||!R(a),n=r?S:v;return i="video"===e.info.type?"number"==typeof e.info.rotation?B(e.info.rotation):e.info.rotation:U,N("tkhd",+r,3,[n(t),n(t),v(e.id),v(0),n(a),Array(8).fill(0),T(0),T(0),x("audio"===e.info.type?1:0),T(0),D(i),z("video"===e.info.type?e.info.width:0),z("video"===e.info.type?e.info.height:0)])},H=(e,t)=>I("mdia",null,[_(e,t),q("video"===e.info.type?"vide":"soun"),G(e)]),_=(e,t)=>{let i=W(e.samples),s=O(i?i.presentationTimestamp+i.duration:0,e.timescale),a=!R(t)||!R(s),r=a?S:v;return N("mdhd",+a,0,[r(t),r(t),v(e.timescale),r(s),T(21956),T(0)])},q=e=>N("hdlr",0,0,[A("mhlr"),A(e),v(0),v(0),v(0),A("mp4-muxer-hdlr",!0)]),G=e=>I("minf",null,["video"===e.info.type?J():K(),Q(),Z(e)]),J=()=>N("vmhd",0,1,[T(0),T(0),T(0),T(0)]),K=()=>N("smhd",0,0,[T(0),T(0)]),Q=()=>I("dinf",null,[X()]),X=()=>N("dref",0,0,[v(1)],[Y()]),Y=()=>N("url ",0,1),Z=e=>{const t=e.compositionTimeOffsetTable.length>1||e.compositionTimeOffsetTable.some((e=>0!==e.sampleCompositionTimeOffset));return I("stbl",null,[ee(e),oe(e),he(e),le(e),de(e),fe(e),t?ue(e):null])},ee=e=>N("stsd",0,0,[v(1)],["video"===e.info.type?te(Se[e.info.codec],e):ne(ze[e.info.codec],e)]),te=(e,t)=>{return I(e,[Array(6).fill(0),T(1),T(0),T(0),Array(12).fill(0),T(t.info.width),T(t.info.height),v(4718592),v(4718592),v(0),T(1),Array(32).fill(0),T(24),(i=65535,y.setInt16(0,i,!1),[b[0],b[1]])],[xe[t.info.codec](t),t.info.decoderConfig.colorSpace?re(t):null]);var i},ie={bt709:1,bt470bg:5,smpte170m:6},se={bt709:1,smpte170m:6,"iec61966-2-1":13},ae={rgb:0,bt709:1,bt470bg:5,smpte170m:6},re=e=>I("colr",[A("nclx"),T(ie[e.info.decoderConfig.colorSpace.primaries]),T(se[e.info.decoderConfig.colorSpace.transfer]),T(ae[e.info.decoderConfig.colorSpace.matrix]),k((e.info.decoderConfig.colorSpace.fullRange?1:0)<<7)]),ne=(e,t)=>I(e,[Array(6).fill(0),T(1),T(0),T(0),v(0),T(t.info.numberOfChannels),T(16),T(0),T(0),z(t.info.sampleRate)],[Ee[t.info.codec](t)]),oe=e=>N("stts",0,0,[v(e.timeToSampleTable.length),e.timeToSampleTable.map((e=>[v(e.sampleCount),v(e.sampleDelta)]))]),he=e=>{if(e.samples.every((e=>"key"===e.type)))return null;let t=[...e.samples.entries()].filter((([,e])=>"key"===e.type));return N("stss",0,0,[v(t.length),t.map((([e])=>v(e+1)))])},le=e=>N("stsc",0,0,[v(e.compactlyCodedChunkTable.length),e.compactlyCodedChunkTable.map((e=>[v(e.firstChunk),v(e.samplesPerChunk),v(1)]))]),de=e=>N("stsz",0,0,[v(0),v(e.samples.length),e.samples.map((e=>v(e.size)))]),fe=e=>e.finalizedChunks.length>0&&M(e.finalizedChunks).offset>=2**32?N("co64",0,0,[v(e.finalizedChunks.length),e.finalizedChunks.map((e=>S(e.offset)))]):N("stco",0,0,[v(e.finalizedChunks.length),e.finalizedChunks.map((e=>v(e.offset)))]),ue=e=>N("ctts",0,0,[v(e.compositionTimeOffsetTable.length),e.compositionTimeOffsetTable.map((e=>[v(e.sampleCount),v(e.sampleCompositionTimeOffset)]))]),me=e=>I("mvex",null,e.map(pe)),pe=e=>N("trex",0,0,[v(e.id),v(1),v(0),v(0),v(0)]),ce=(e,t)=>I("moof",null,[we(e),...t.map(be)]),we=e=>N("mfhd",0,0,[v(e)]),ge=e=>{let t=0,i=0,s="delta"===e.type;return i|=+s,t|=s?1:2,t<<24|i<<16},be=e=>I("traf",null,[ye(e),ke(e),Te(e)]),ye=e=>{let t=0;t|=8,t|=16,t|=32,t|=131072;let i=e.currentChunk.samples[1]??e.currentChunk.samples[0],s={duration:i.timescaleUnitsToNextSample,size:i.size,flags:ge(i)};return N("tfhd",0,131128,[v(e.id),v(s.duration),v(s.size),v(s.flags)])},ke=e=>N("tfdt",1,0,[S(O(e.currentChunk.startTimestamp,e.timescale))]),Te=e=>{let t=e.currentChunk.samples.map((e=>e.timescaleUnitsToNextSample)),i=e.currentChunk.samples.map((e=>e.size)),s=e.currentChunk.samples.map(ge),a=e.currentChunk.samples.map((t=>O(t.presentationTimestamp-t.decodeTimestamp,e.timescale))),r=new Set(t),n=new Set(i),o=new Set(s),h=new Set(a),l=2===o.size&&s[0]!==s[1],d=r.size>1,f=n.size>1,u=!l&&o.size>1,m=h.size>1||[...h].some((e=>0!==e)),p=0;return p|=1,p|=4*+l,p|=256*+d,p|=512*+f,p|=1024*+u,p|=2048*+m,N("trun",1,p,[v(e.currentChunk.samples.length),v(e.currentChunk.offset-e.currentChunk.moofOffset||0),l?v(s[0]):[],e.currentChunk.samples.map(((e,r)=>{return[d?v(t[r]):[],f?v(i[r]):[],u?v(s[r]):[],m?(n=a[r],y.setInt32(0,n,!1),[b[0],b[1],b[2],b[3]]):[]];var n}))])},Ce=(e,t)=>N("tfra",1,0,[v(e.id),v(63),v(e.finalizedChunks.length),e.finalizedChunks.map((i=>[S(O(i.startTimestamp,e.timescale)),S(i.moofOffset),v(t+1),v(1),v(1)]))]),ve=()=>N("mfro",0,0,[v(0)]),Se={avc:"avc1",hevc:"hvc1",vp9:"vp09",av1:"av01"},xe={avc:e=>e.info.decoderConfig&&I("avcC",[...new Uint8Array(e.info.decoderConfig.description)]),hevc:e=>e.info.decoderConfig&&I("hvcC",[...new Uint8Array(e.info.decoderConfig.description)]),vp9:e=>{if(!e.info.decoderConfig)return null;let t=e.info.decoderConfig;if(!t.colorSpace)throw new Error("'colorSpace' is required in the decoder config for VP9.");let i=t.codec.split("."),s=Number(i[1]),a=Number(i[2]),r=0+(Number(i[3])<<4)+Number(t.colorSpace.fullRange);return N("vpcC",1,0,[k(s),k(a),k(r),k(2),k(2),k(2),T(0)])},av1:()=>I("av1C",[129,0,0,0])},ze={aac:"mp4a",opus:"Opus"},Ee={aac:e=>{let t=new Uint8Array(e.info.decoderConfig.description);return N("esds",0,0,[v(58753152),k(32+t.byteLength),T(1),k(0),v(75530368),k(18+t.byteLength),k(64),k(21),C(0),v(130071),v(130071),v(92307584),k(t.byteLength),...t,v(109084800),k(1),k(2)])},opus:e=>{let t=3840,i=0;const s=e.info.decoderConfig?.description;if(s){if(s.byteLength<18)throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");const e=ArrayBuffer.isView(s)?new DataView(s.buffer,s.byteOffset,s.byteLength):new DataView(s);t=e.getUint16(10,!0),i=e.getInt16(14,!0)}return I("dOps",[k(0),k(e.info.numberOfChannels),T(t),v(e.info.sampleRate),x(i),k(0)])}},Ae=(Symbol("isTarget"),class{}),Me=class extends Ae{constructor(){super(...arguments),this.buffer=null}},We=class extends Ae{constructor(e){if(super(),this.options=e,"object"!=typeof e)throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");if(e.onData){if("function"!=typeof e.onData)throw new TypeError("options.onData, when provided, must be a function.");if(e.onData.length<2)throw new TypeError("options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs.")}if(void 0!==e.chunked&&"boolean"!=typeof e.chunked)throw new TypeError("options.chunked, when provided, must be a boolean.");if(void 0!==e.chunkSize&&(!Number.isInteger(e.chunkSize)||e.chunkSize<1024))throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.")}},Oe=class extends Ae{constructor(e,t){if(super(),this.stream=e,this.options=t,!(e instanceof FileSystemWritableFileStream))throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");if(void 0!==t&&"object"!=typeof t)throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");if(t&&void 0!==t.chunkSize&&(!Number.isInteger(t.chunkSize)||t.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer")}},Be=class{constructor(){this.pos=0,n(this,d,new Uint8Array(8)),n(this,f,new DataView(r(this,d).buffer)),this.offsets=new WeakMap}seek(e){this.pos=e}writeU32(e){r(this,f).setUint32(0,e,!1),this.write(r(this,d).subarray(0,4))}writeU64(e){r(this,f).setUint32(0,Math.floor(e/2**32),!1),r(this,f).setUint32(4,e,!1),this.write(r(this,d).subarray(0,8))}writeAscii(e){for(let t=0;t<e.length;t++)r(this,f).setUint8(t%8,e.charCodeAt(t)),t%8==7&&this.write(r(this,d));e.length%8!=0&&this.write(r(this,d).subarray(0,e.length%8))}writeBox(e){if(this.offsets.set(e,this.pos),e.contents&&!e.children)this.writeBoxHeader(e,e.size??e.contents.byteLength+8),this.write(e.contents);else{let t=this.pos;if(this.writeBoxHeader(e,0),e.contents&&this.write(e.contents),e.children)for(let t of e.children)t&&this.writeBox(t);let i=this.pos,s=e.size??i-t;this.seek(t),this.writeBoxHeader(e,s),this.seek(i)}}writeBoxHeader(e,t){this.writeU32(e.largeSize?1:t),this.writeAscii(e.type),e.largeSize&&this.writeU64(t)}measureBoxHeader(e){return 8+(e.largeSize?8:0)}patchBox(e){let t=this.pos;this.seek(this.offsets.get(e)),this.writeBox(e),this.seek(t)}measureBox(e){if(e.contents&&!e.children){return this.measureBoxHeader(e)+e.contents.byteLength}{let t=this.measureBoxHeader(e);if(e.contents&&(t+=e.contents.byteLength),e.children)for(let i of e.children)i&&(t+=this.measureBox(i));return t}}};d=new WeakMap,f=new WeakMap;var Ue=class extends Be{constructor(e){super(),n(this,w),n(this,u,void 0),n(this,m,new ArrayBuffer(65536)),n(this,p,new Uint8Array(r(this,m))),n(this,c,0),o(this,u,e)}write(e){h(this,w,g).call(this,this.pos+e.byteLength),r(this,p).set(e,this.pos),this.pos+=e.byteLength,o(this,c,Math.max(r(this,c),this.pos))}finalize(){h(this,w,g).call(this,this.pos),r(this,u).buffer=r(this,m).slice(0,Math.max(r(this,c),this.pos))}};u=new WeakMap,m=new WeakMap,p=new WeakMap,c=new WeakMap,w=new WeakSet,g=function(e){let t=r(this,m).byteLength;for(;t<e;)t*=2;if(t===r(this,m).byteLength)return;let i=new ArrayBuffer(t),s=new Uint8Array(i);s.set(r(this,p),0),o(this,m,i),o(this,p,s)};var De,je,Re,Ie,Ne,Ve,Fe,Le,$e,Pe,He,_e,qe,Ge=class extends Be{constructor(e){super(),n(this,Ve),n(this,Le),n(this,Pe),n(this,_e),n(this,De,void 0),n(this,je,[]),n(this,Re,void 0),n(this,Ie,void 0),n(this,Ne,[]),o(this,De,e),o(this,Re,e.options?.chunked??!1),o(this,Ie,e.options?.chunkSize??16777216)}write(e){r(this,je).push({data:e.slice(),start:this.pos}),this.pos+=e.byteLength}flush(){if(0===r(this,je).length)return;let e=[],t=[...r(this,je)].sort(((e,t)=>e.start-t.start));e.push({start:t[0].start,size:t[0].data.byteLength});for(let i=1;i<t.length;i++){let s=e[e.length-1],a=t[i];a.start<=s.start+s.size?s.size=Math.max(s.size,a.start+a.data.byteLength-s.start):e.push({start:a.start,size:a.data.byteLength})}for(let t of e){t.data=new Uint8Array(t.size);for(let e of r(this,je))t.start<=e.start&&e.start<t.start+t.size&&t.data.set(e.data,e.start-t.start);r(this,Re)?(h(this,Ve,Fe).call(this,t.data,t.start),h(this,_e,qe).call(this)):r(this,De).options.onData?.(t.data,t.start)}r(this,je).length=0}finalize(){r(this,Re)&&h(this,_e,qe).call(this,!0)}};De=new WeakMap,je=new WeakMap,Re=new WeakMap,Ie=new WeakMap,Ne=new WeakMap,Ve=new WeakSet,Fe=function(e,t){let i=r(this,Ne).findIndex((e=>e.start<=t&&t<e.start+r(this,Ie)));-1===i&&(i=h(this,Pe,He).call(this,t));let s=r(this,Ne)[i],a=t-s.start,n=e.subarray(0,Math.min(r(this,Ie)-a,e.byteLength));s.data.set(n,a);let o={start:a,end:a+n.byteLength};if(h(this,Le,$e).call(this,s,o),0===s.written[0].start&&s.written[0].end===r(this,Ie)&&(s.shouldFlush=!0),r(this,Ne).length>2){for(let e=0;e<r(this,Ne).length-1;e++)r(this,Ne)[e].shouldFlush=!0;h(this,_e,qe).call(this)}n.byteLength<e.byteLength&&h(this,Ve,Fe).call(this,e.subarray(n.byteLength),t+n.byteLength)},Le=new WeakSet,$e=function(e,t){let i=0,s=e.written.length-1,a=-1;for(;i<=s;){let r=Math.floor(i+(s-i+1)/2);e.written[r].start<=t.start?(i=r+1,a=r):s=r-1}for(e.written.splice(a+1,0,t),(-1===a||e.written[a].end<t.start)&&a++;a<e.written.length-1&&e.written[a].end>=e.written[a+1].start;)e.written[a].end=Math.max(e.written[a].end,e.written[a+1].end),e.written.splice(a+1,1)},Pe=new WeakSet,He=function(e){let t={start:Math.floor(e/r(this,Ie))*r(this,Ie),data:new Uint8Array(r(this,Ie)),written:[],shouldFlush:!1};return r(this,Ne).push(t),r(this,Ne).sort(((e,t)=>e.start-t.start)),r(this,Ne).indexOf(t)},_e=new WeakSet,qe=function(e=!1){for(let t=0;t<r(this,Ne).length;t++){let i=r(this,Ne)[t];if(i.shouldFlush||e){for(let e of i.written)r(this,De).options.onData?.(i.data.subarray(e.start,e.end),i.start+e.start);r(this,Ne).splice(t--,1)}}};var Je,Ke,Qe,Xe,Ye,Ze,et,tt,it,st,at,rt,nt,ot,ht,lt,dt,ft,ut,mt,pt,ct,wt,gt,bt,yt,kt,Tt,Ct,vt,St,xt,zt,Et,At,Mt,Wt,Ot=class extends Ge{constructor(e){super(new We({onData:(t,i)=>e.stream.write({type:"write",data:t,position:i}),chunked:!0,chunkSize:e.options?.chunkSize}))}},Bt=1e3,Ut=["avc","hevc","vp9","av1"],Dt=["aac","opus"],jt=["strict","offset","cross-track-offset"],Rt=class{constructor(e){if(n(this,nt),n(this,ht),n(this,dt),n(this,ut),n(this,pt),n(this,wt),n(this,bt),n(this,kt),n(this,Ct),n(this,St),n(this,zt),n(this,At),n(this,Je,void 0),n(this,Ke,void 0),n(this,Qe,void 0),n(this,Xe,void 0),n(this,Ye,null),n(this,Ze,null),n(this,et,Math.floor(Date.now()/1e3)+2082844800),n(this,tt,[]),n(this,it,1),n(this,st,[]),n(this,at,[]),n(this,rt,!1),h(this,nt,ot).call(this,e),e.video=j(e.video),e.audio=j(e.audio),e.fastStart=j(e.fastStart),this.target=e.target,o(this,Je,{firstTimestampBehavior:"strict",...e}),e.target instanceof Me)o(this,Ke,new Ue(e.target));else if(e.target instanceof We)o(this,Ke,new Ge(e.target));else{if(!(e.target instanceof Oe))throw new Error(`Invalid target: ${e.target}`);o(this,Ke,new Ot(e.target))}h(this,ut,mt).call(this),h(this,ht,lt).call(this)}addVideoChunk(e,t,i,s){if(!(e instanceof EncodedVideoChunk))throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");if(t&&"object"!=typeof t)throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");if(void 0!==i&&(!Number.isFinite(i)||i<0))throw new TypeError("addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number.");if(void 0!==s&&!Number.isFinite(s))throw new TypeError("addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number.");let a=new Uint8Array(e.byteLength);e.copyTo(a),this.addVideoChunkRaw(a,e.type,i??e.timestamp,e.duration,t,s)}addVideoChunkRaw(e,t,i,s,a,n){if(!(e instanceof Uint8Array))throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");if("key"!==t&&"delta"!==t)throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(i)||i<0)throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(s)||s<0)throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");if(a&&"object"!=typeof a)throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");if(void 0!==n&&!Number.isFinite(n))throw new TypeError("addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number.");if(h(this,At,Mt).call(this),!r(this,Je).video)throw new Error("No video track declared.");if("object"==typeof r(this,Je).fastStart&&r(this,Ye).samples.length===r(this,Je).fastStart.expectedVideoChunks)throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${r(this,Je).fastStart.expectedVideoChunks}).`);let o=h(this,wt,gt).call(this,r(this,Ye),e,t,i,s,a,n);if("fragmented"===r(this,Je).fastStart&&r(this,Ze)){for(;r(this,at).length>0&&r(this,at)[0].decodeTimestamp<=o.decodeTimestamp;){let e=r(this,at).shift();h(this,bt,yt).call(this,r(this,Ze),e)}o.decodeTimestamp<=r(this,Ze).lastDecodeTimestamp?h(this,bt,yt).call(this,r(this,Ye),o):r(this,st).push(o)}else h(this,bt,yt).call(this,r(this,Ye),o)}addAudioChunk(e,t,i){if(!(e instanceof EncodedAudioChunk))throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");if(t&&"object"!=typeof t)throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");if(void 0!==i&&(!Number.isFinite(i)||i<0))throw new TypeError("addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number.");let s=new Uint8Array(e.byteLength);e.copyTo(s),this.addAudioChunkRaw(s,e.type,i??e.timestamp,e.duration,t)}addAudioChunkRaw(e,t,i,s,a){if(!(e instanceof Uint8Array))throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");if("key"!==t&&"delta"!==t)throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(i)||i<0)throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(s)||s<0)throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");if(a&&"object"!=typeof a)throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");if(h(this,At,Mt).call(this),!r(this,Je).audio)throw new Error("No audio track declared.");if("object"==typeof r(this,Je).fastStart&&r(this,Ze).samples.length===r(this,Je).fastStart.expectedAudioChunks)throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${r(this,Je).fastStart.expectedAudioChunks}).`);let n=h(this,wt,gt).call(this,r(this,Ze),e,t,i,s,a);if("fragmented"===r(this,Je).fastStart&&r(this,Ye)){for(;r(this,st).length>0&&r(this,st)[0].decodeTimestamp<=n.decodeTimestamp;){let e=r(this,st).shift();h(this,bt,yt).call(this,r(this,Ye),e)}n.decodeTimestamp<=r(this,Ye).lastDecodeTimestamp?h(this,bt,yt).call(this,r(this,Ze),n):r(this,at).push(n)}else h(this,bt,yt).call(this,r(this,Ze),n)}finalize(){if(r(this,rt))throw new Error("Cannot finalize a muxer more than once.");if("fragmented"===r(this,Je).fastStart){for(let e of r(this,st))h(this,bt,yt).call(this,r(this,Ye),e);for(let e of r(this,at))h(this,bt,yt).call(this,r(this,Ze),e);h(this,St,xt).call(this,!1)}else r(this,Ye)&&h(this,Ct,vt).call(this,r(this,Ye)),r(this,Ze)&&h(this,Ct,vt).call(this,r(this,Ze));let e=[r(this,Ye),r(this,Ze)].filter(Boolean);if("in-memory"===r(this,Je).fastStart){let t;for(let i=0;i<2;i++){let i=F(e,r(this,et)),s=r(this,Ke).measureBox(i);t=r(this,Ke).measureBox(r(this,Xe));let a=r(this,Ke).pos+s+t;for(let e of r(this,tt)){e.offset=a;for(let{data:i}of e.samples)a+=i.byteLength,t+=i.byteLength}if(a<2**32)break;t>=2**32&&(r(this,Xe).largeSize=!0)}let i=F(e,r(this,et));r(this,Ke).writeBox(i),r(this,Xe).size=t,r(this,Ke).writeBox(r(this,Xe));for(let e of r(this,tt))for(let t of e.samples)r(this,Ke).write(t.data),t.data=null}else if("fragmented"===r(this,Je).fastStart){let t=r(this,Ke).pos,i=(e=>I("mfra",null,[...e.map(Ce),ve()]))(e);r(this,Ke).writeBox(i);let s=r(this,Ke).pos-t;r(this,Ke).seek(r(this,Ke).pos-4),r(this,Ke).writeU32(s)}else{let t=r(this,Ke).offsets.get(r(this,Xe)),i=r(this,Ke).pos-t;r(this,Xe).size=i,r(this,Xe).largeSize=i>=2**32,r(this,Ke).patchBox(r(this,Xe));let s=F(e,r(this,et));if("object"==typeof r(this,Je).fastStart){r(this,Ke).seek(r(this,Qe)),r(this,Ke).writeBox(s);let e=t-r(this,Ke).pos;r(this,Ke).writeBox({type:"free",size:e})}else r(this,Ke).writeBox(s)}h(this,zt,Et).call(this),r(this,Ke).finalize(),o(this,rt,!0)}};return Je=new WeakMap,Ke=new WeakMap,Qe=new WeakMap,Xe=new WeakMap,Ye=new WeakMap,Ze=new WeakMap,et=new WeakMap,tt=new WeakMap,it=new WeakMap,st=new WeakMap,at=new WeakMap,rt=new WeakMap,nt=new WeakSet,ot=function(e){if("object"!=typeof e)throw new TypeError("The muxer requires an options object to be passed to its constructor.");if(!(e.target instanceof Ae))throw new TypeError("The target must be provided and an instance of Target.");if(e.video){if(!Ut.includes(e.video.codec))throw new TypeError(`Unsupported video codec: ${e.video.codec}`);if(!Number.isInteger(e.video.width)||e.video.width<=0)throw new TypeError(`Invalid video width: ${e.video.width}. Must be a positive integer.`);if(!Number.isInteger(e.video.height)||e.video.height<=0)throw new TypeError(`Invalid video height: ${e.video.height}. Must be a positive integer.`);const t=e.video.rotation;if("number"==typeof t&&![0,90,180,270].includes(t))throw new TypeError(`Invalid video rotation: ${t}. Has to be 0, 90, 180 or 270.`);if(Array.isArray(t)&&(9!==t.length||t.some((e=>"number"!=typeof e))))throw new TypeError(`Invalid video transformation matrix: ${t.join()}`);if(void 0!==e.video.frameRate&&(!Number.isInteger(e.video.frameRate)||e.video.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${e.video.frameRate}. Must be a positive integer.`)}if(e.audio){if(!Dt.includes(e.audio.codec))throw new TypeError(`Unsupported audio codec: ${e.audio.codec}`);if(!Number.isInteger(e.audio.numberOfChannels)||e.audio.numberOfChannels<=0)throw new TypeError(`Invalid number of audio channels: ${e.audio.numberOfChannels}. Must be a positive integer.`);if(!Number.isInteger(e.audio.sampleRate)||e.audio.sampleRate<=0)throw new TypeError(`Invalid audio sample rate: ${e.audio.sampleRate}. Must be a positive integer.`)}if(e.firstTimestampBehavior&&!jt.includes(e.firstTimestampBehavior))throw new TypeError(`Invalid first timestamp behavior: ${e.firstTimestampBehavior}`);if("object"==typeof e.fastStart){if(e.video){if(void 0===e.fastStart.expectedVideoChunks)throw new TypeError("'fastStart' is an object but is missing property 'expectedVideoChunks'.");if(!Number.isInteger(e.fastStart.expectedVideoChunks)||e.fastStart.expectedVideoChunks<0)throw new TypeError("'expectedVideoChunks' must be a non-negative integer.")}if(e.audio){if(void 0===e.fastStart.expectedAudioChunks)throw new TypeError("'fastStart' is an object but is missing property 'expectedAudioChunks'.");if(!Number.isInteger(e.fastStart.expectedAudioChunks)||e.fastStart.expectedAudioChunks<0)throw new TypeError("'expectedAudioChunks' must be a non-negative integer.")}}else if(![!1,"in-memory","fragmented"].includes(e.fastStart))throw new TypeError("'fastStart' option must be false, 'in-memory', 'fragmented' or an object.");if(void 0!==e.minFragmentDuration&&(!Number.isFinite(e.minFragmentDuration)||e.minFragmentDuration<0))throw new TypeError("'minFragmentDuration' must be a non-negative number.")},ht=new WeakSet,lt=function(){var e;if(r(this,Ke).writeBox((e={holdsAvc:"avc"===r(this,Je).video?.codec,fragmented:"fragmented"===r(this,Je).fastStart}).fragmented?I("ftyp",[A("iso5"),v(512),A("iso5"),A("iso6"),A("mp41")]):I("ftyp",[A("isom"),v(512),A("isom"),e.holdsAvc?A("avc1"):[],A("mp41")])),o(this,Qe,r(this,Ke).pos),"in-memory"===r(this,Je).fastStart)o(this,Xe,V(!1));else if("fragmented"===r(this,Je).fastStart);else{if("object"==typeof r(this,Je).fastStart){let e=h(this,dt,ft).call(this);r(this,Ke).seek(r(this,Ke).pos+e)}o(this,Xe,V(!0)),r(this,Ke).writeBox(r(this,Xe))}h(this,zt,Et).call(this)},dt=new WeakSet,ft=function(){if("object"!=typeof r(this,Je).fastStart)return;let e=0,t=[r(this,Je).fastStart.expectedVideoChunks,r(this,Je).fastStart.expectedAudioChunks];for(let i of t)i&&(e+=8*Math.ceil(2/3*i),e+=4*i,e+=12*Math.ceil(2/3*i),e+=4*i,e+=8*i);return e+=4096,e},ut=new WeakSet,mt=function(){if(r(this,Je).video&&o(this,Ye,{id:1,info:{type:"video",codec:r(this,Je).video.codec,width:r(this,Je).video.width,height:r(this,Je).video.height,rotation:r(this,Je).video.rotation??0,decoderConfig:null},timescale:r(this,Je).video.frameRate??57600,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),r(this,Je).audio&&(o(this,Ze,{id:r(this,Je).video?2:1,info:{type:"audio",codec:r(this,Je).audio.codec,numberOfChannels:r(this,Je).audio.numberOfChannels,sampleRate:r(this,Je).audio.sampleRate,decoderConfig:null},timescale:r(this,Je).audio.sampleRate,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),"aac"===r(this,Je).audio.codec)){let e=h(this,pt,ct).call(this,2,r(this,Je).audio.sampleRate,r(this,Je).audio.numberOfChannels);r(this,Ze).info.decoderConfig={codec:r(this,Je).audio.codec,description:e,numberOfChannels:r(this,Je).audio.numberOfChannels,sampleRate:r(this,Je).audio.sampleRate}}},pt=new WeakSet,ct=function(e,t,i){let s=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350].indexOf(t),a=i,r="";r+=e.toString(2).padStart(5,"0"),r+=s.toString(2).padStart(4,"0"),15===s&&(r+=t.toString(2).padStart(24,"0")),r+=a.toString(2).padStart(4,"0");let n=8*Math.ceil(r.length/8);r=r.padEnd(n,"0");let o=new Uint8Array(r.length/8);for(let e=0;e<r.length;e+=8)o[e/8]=parseInt(r.slice(e,e+8),2);return o},wt=new WeakSet,gt=function(e,t,i,s,a,r,n){let o=s/1e6,l=(s-(n??0))/1e6,d=a/1e6,f=h(this,kt,Tt).call(this,o,l,e);return o=f.presentationTimestamp,l=f.decodeTimestamp,r?.decoderConfig&&(null===e.info.decoderConfig?e.info.decoderConfig=r.decoderConfig:Object.assign(e.info.decoderConfig,r.decoderConfig)),{presentationTimestamp:o,decodeTimestamp:l,duration:d,data:t,size:t.byteLength,type:i,timescaleUnitsToNextSample:O(d,e.timescale)}},bt=new WeakSet,yt=function(e,t){"fragmented"!==r(this,Je).fastStart&&e.samples.push(t);const i=O(t.presentationTimestamp-t.decodeTimestamp,e.timescale);if(null!==e.lastTimescaleUnits){let s=O(t.decodeTimestamp,e.timescale,!1),a=Math.round(s-e.lastTimescaleUnits);if(e.lastTimescaleUnits+=a,e.lastSample.timescaleUnitsToNextSample=a,"fragmented"!==r(this,Je).fastStart){let t=M(e.timeToSampleTable);1===t.sampleCount?(t.sampleDelta=a,t.sampleCount++):t.sampleDelta===a?t.sampleCount++:(t.sampleCount--,e.timeToSampleTable.push({sampleCount:2,sampleDelta:a}));const s=M(e.compositionTimeOffsetTable);s.sampleCompositionTimeOffset===i?s.sampleCount++:e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:i})}}else e.lastTimescaleUnits=0,"fragmented"!==r(this,Je).fastStart&&(e.timeToSampleTable.push({sampleCount:1,sampleDelta:O(t.duration,e.timescale)}),e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:i}));e.lastSample=t;let s=!1;if(e.currentChunk){let i=t.presentationTimestamp-e.currentChunk.startTimestamp;if("fragmented"===r(this,Je).fastStart){let a=r(this,Ye)??r(this,Ze);const n=r(this,Je).minFragmentDuration??1;e===a&&"key"===t.type&&i>=n&&(s=!0,h(this,St,xt).call(this))}else s=i>=.5}else s=!0;s&&(e.currentChunk&&h(this,Ct,vt).call(this,e),e.currentChunk={startTimestamp:t.presentationTimestamp,samples:[]}),e.currentChunk.samples.push(t)},kt=new WeakSet,Tt=function(e,t,i){const s="strict"===r(this,Je).firstTimestampBehavior,a=-1===i.lastDecodeTimestamp;if(s&&a&&0!==t)throw new Error(`The first chunk for your media track must have a timestamp of 0 (received DTS=${t}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.\n\nIf you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.\n`);if("offset"===r(this,Je).firstTimestampBehavior||"cross-track-offset"===r(this,Je).firstTimestampBehavior){let s;void 0===i.firstDecodeTimestamp&&(i.firstDecodeTimestamp=t),s="offset"===r(this,Je).firstTimestampBehavior?i.firstDecodeTimestamp:Math.min(r(this,Ye)?.firstDecodeTimestamp??1/0,r(this,Ze)?.firstDecodeTimestamp??1/0),t-=s,e-=s}if(t<i.lastDecodeTimestamp)throw new Error(`Timestamps must be monotonically increasing (DTS went from ${1e6*i.lastDecodeTimestamp} to ${1e6*t}).`);return i.lastDecodeTimestamp=t,{presentationTimestamp:e,decodeTimestamp:t}},Ct=new WeakSet,vt=function(e){if("fragmented"===r(this,Je).fastStart)throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");if(e.currentChunk)if(e.finalizedChunks.push(e.currentChunk),r(this,tt).push(e.currentChunk),0!==e.compactlyCodedChunkTable.length&&M(e.compactlyCodedChunkTable).samplesPerChunk===e.currentChunk.samples.length||e.compactlyCodedChunkTable.push({firstChunk:e.finalizedChunks.length,samplesPerChunk:e.currentChunk.samples.length}),"in-memory"!==r(this,Je).fastStart){e.currentChunk.offset=r(this,Ke).pos;for(let t of e.currentChunk.samples)r(this,Ke).write(t.data),t.data=null;h(this,zt,Et).call(this)}else e.currentChunk.offset=0},St=new WeakSet,xt=function(e=!0){if("fragmented"!==r(this,Je).fastStart)throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");let t=[r(this,Ye),r(this,Ze)].filter((e=>e&&e.currentChunk));if(0===t.length)return;let i=(s=this,a=it,{set _(e){o(s,a,e,n)},get _(){return r(s,a,l)}})._++;var s,a,n,l;if(1===i){let e=F(t,r(this,et),!0);r(this,Ke).writeBox(e)}let d=r(this,Ke).pos,f=ce(i,t);r(this,Ke).writeBox(f);{let e=V(!1),i=0;for(let e of t)for(let t of e.currentChunk.samples)i+=t.size;let s=r(this,Ke).measureBox(e)+i;s>=2**32&&(e.largeSize=!0,s=r(this,Ke).measureBox(e)+i),e.size=s,r(this,Ke).writeBox(e)}for(let e of t){e.currentChunk.offset=r(this,Ke).pos,e.currentChunk.moofOffset=d;for(let t of e.currentChunk.samples)r(this,Ke).write(t.data),t.data=null}let u=r(this,Ke).pos;r(this,Ke).seek(r(this,Ke).offsets.get(f));let m=ce(i,t);r(this,Ke).writeBox(m),r(this,Ke).seek(u);for(let e of t)e.finalizedChunks.push(e.currentChunk),r(this,tt).push(e.currentChunk),e.currentChunk=null;e&&h(this,zt,Et).call(this)},zt=new WeakSet,Et=function(){r(this,Ke)instanceof Ge&&r(this,Ke).flush()},At=new WeakSet,Mt=function(){if(r(this,rt))throw new Error("Cannot add new video or audio chunks after the file has been finalized.")},Wt=l,((a,r,n,o)=>{if(r&&"object"==typeof r||"function"==typeof r)for(let h of i(r))s.call(a,h)||h===n||e(a,h,{get:()=>r[h],enumerable:!(o=t(r,h))||o.enumerable});return a})(e({},"__esModule",{value:!0}),Wt)})();"object"==typeof module&&"object"==typeof module.exports&&Object.assign(module.exports,Mp4Muxer);
//# sourceMappingURL=/sm/d72d5cf9845053fd379eb03c8aa0076e0f937f51c85e59b9c023ad3f33721c0b.map

const W=1920,H=1080, cv=document.getElementById('bhv-cv'), g=cv.getContext('2d');
const S=document.getElementById('bhv-status');
let items=[], buys=[], sents=[], received=[], meta=null, recorder=null, chunks=[], raf=0, t0=0, DUR=103;
const INTRO=2.5, TAIL=1.8, HOLD=3.0, SENT=9.0, RECV=11.5, OUTRO=12.0;
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
function normalize(raw){
  const src = Array.isArray(raw) ? {items:raw, received:[], meta:null} : raw;
  meta = src.meta||null;
  received = (src.received||[]).map(o=>({...o,_im:null}));
  const a=(src.items||[]).map(o=>({
    date:new Date((o.datetime||o.date||'').replace(/\//g,'-').replace(' ','T')),
    title:o.title||'(無題)', shop:o.shop||'', price:+o.price||0,
    type:o.type||'buy', img:o.img||null, _im:null
  })).filter(o=>!isNaN(o.date));
  a.sort((x,y)=>x.date-y.date);
  let loaded=0, need=0;
  const cache=new Map();          // 同じURLの画像は1枚だけ読む
  const hook=o=>{ if(!o.img) return;
    const hit=cache.get(o.img);
    if(hit){ if(hit.done) o._im=hit.im; else hit.waiting.push(o); return; }
    need++;
    const im=new Image(), rec={im:im,done:false,waiting:[o]};
    cache.set(o.img,rec);
    im.onload=()=>{ rec.done=true; for(const w of rec.waiting) w._im=im; rec.waiting.length=0;
      if(++loaded>=need) S.textContent='画像 '+loaded+'枚 読み込み済み'; };
    im.onerror=()=>{ need--; cache.delete(o.img); };
    im.src=o.img; };
  a.forEach(hook); received.forEach(hook);
  buys=a.filter(o=>o.type==='buy'); sents=a.filter(o=>o.type==='gift_sent');
  return a;
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

function drawIntro(sec,INTRO){
  bg();
  const k=ease(sec/1.2), out=sec>INTRO-0.7 ? 1-ease((sec-(INTRO-0.7))/0.7) : 1;
  g.globalAlpha=k*out;
  const x=W*0.13, y=H*0.60;
  if(items.length){
    const a=items[0].date, b=items[items.length-1].date;
    txt(`${a.getFullYear()} — ${b.getFullYear()}`, x, y-124, 29, C.dim,'left',300,3);
  }
  txt('BOOTH で買ったもの', x, y, 96, C.ink,'left',600,2,'m');
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
  const key=span.toFixed(3)+'/'+buys.length;
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
  const fixed=INTRO+TAIL+HOLD+(sents.length?SENT:0)+(received.length?RECV:0)+OUTRO;
  const need=Math.max(DUR*0.30,3);
  const k=(DUR-fixed)>=need ? 1 : Math.max((DUR-need)/fixed, 0.12);
  const t={intro:INTRO*k, tail:TAIL*k, hold:HOLD*k,
           sent:(sents.length?SENT:0)*k, recv:(received.length?RECV:0)*k, outro:OUTRO*k};
  t.span=Math.max(DUR-t.intro-t.tail-t.hold-t.sent-t.recv-t.outro, 0.5);
  return t;
}

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

function drawOutro(t){
  const q=Math.min(ease(t/0.9),1);
  if(q<0.08) return;
  const vg=g.createRadialGradient(W*0.44,H*0.46,120,W*0.5,H*0.5,W*0.50);
  vg.addColorStop(0,'rgba(6,5,5,0)'); vg.addColorStop(1,'rgba(6,5,5,1)');
  g.fillStyle=vg; g.fillRect(0,0,W,H);
  g.globalAlpha=q;

  const grand=(meta&&meta.paidTotal)?meta.paidTotal:items.reduce((a,b)=>a+b.price,0);
  const a=items[0].date, b=items[items.length-1].date;
  const x=W*0.13;
  txt(`${a.getFullYear()}.${String(a.getMonth()+1).padStart(2,'0')} — ${b.getFullYear()}.${String(b.getMonth()+1).padStart(2,'0')}`,
      x,318,28,C.dim,'left',300,3);
  txt('BOOTH で使った金額',x,392,40,C.ink2,'left',600,2,'m');
  txt(yen(grand*ease((t-0.4)/2.4)),x,540,140,C.ink,'left',600,0,'m');
  txt(`${shopsOf()} ショップ`,x,594,32,C.dim,'left',300,1);
  rule(x,646,W-x*2,'rgba(240,236,227,0.12)');
  g.globalAlpha=1;

  if(t>2.6){
    g.globalAlpha=q*ease((t-2.6)/0.8);
    const bs=buys.reduce((p,y)=>p+y.price,0), ss=sents.reduce((p,y)=>p+y.price,0);
    const Y=730, col=[x, x+330, x+660];
    const put=(i,label,num,color,sub)=>{
      txt(label,col[i],Y,25,C.dim,'left',300,1);
      txt(num,col[i],Y+60,46,color,'left',600,0,'m');
      if(sub) txt(sub,col[i],Y+104,25,C.faint,'left',300);
    };
    put(0,'買った',buys.length+' 点',C.ink,yen(bs));
    put(1,'贈った',sents.length+' 点',C.sent,yen(ss));
    /* もらった分は実額が存在しないので、いまの値段の目安。買った金額とは足さない */
    const rl=meta&&meta.receivedLow, rh=meta&&meta.receivedHigh;
    put(2,'もらった',received.length+' 点',C.recv,
        rl?('¥'+rl.toLocaleString('ja-JP')+'〜'+(rh||rl).toLocaleString('ja-JP')):null);
    if(rl) txt('いまの値段にすると',col[2],Y+134,22,C.faint,'left',300);
    g.globalAlpha=1;
  }
}
function shopsOf(){ return (meta&&meta.shops)||new Set(items.map(i=>i.shop)).size; }

function frame(sec){
  bg();
  if(!items.length){ note(HINT,HINT2); return; }
  const T=times();
  if(sec<T.intro){ drawIntro(sec,T.intro); return; }
  const m0=T.intro+T.span+T.tail+T.hold, m1=m0+T.sent, m2=m1+T.recv;
  drawMain(clamp((sec-T.intro)/T.span,0,1), sec<=m0+0.35, Math.max(0,sec-T.intro-T.span), T);
  if(sec<=m0) return;
  /* 暗幕は一度だけ。幕ごとに張ると前の幕が透ける（事故った）。
     締めだけ 0.92 にして、壁をわざと薄く残す */
  const veil = (sec>m2) ? 0.92 : 1.0;
  g.fillStyle=`rgba(6,5,5,${ease((sec-m0)/1.0)*veil})`; g.fillRect(0,0,W,H);
  if(T.sent && sec<=m1){ drawSentAct(sec-m0,T.sent); return; }
  if(T.recv && sec<=m2){ drawRecvAct(sec-m1,T.recv); return; }
  drawOutro(sec-m2);
}



/* ===== 再生 ===== */
function loop(ts){
  if(!t0) t0=ts;
  const sec=(ts-t0)/1000;
  frame(Math.min(sec,DUR));
  if(sec<DUR) raf=requestAnimationFrame(loop);
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
  const N=Math.round(DUR*BAKE_FPS), o=outSize(), scale=(o.w!==W);
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
  S.textContent='録画中… '+DUR+'秒かかります。この画面を開いたまま、消さないでください';
  start();
}

/* ===== ボタン ===== */
const el=id=>document.getElementById('bhv-'+id);
const on=(id,fn)=>{ const e=el(id); if(e) e.onclick=fn; };
function setBusy(b){ for(const id of ['rec','play','grab','demo','dur','thumb','light'])
  { const e=el(id); if(e) e.disabled=b; } }

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

let recOK=false;
on('rec',async()=>{
  if(!items.length){ S.textContent='先に履歴を読む'; return; }
  if(!recOK && items.some(o=>o.img)){
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
    note('この端末では mp4 を直接作れません','実時間で録画します。'+DUR+'秒かかります');
    recordRealtime(); return; }
  const t0=Date.now();
  try{
    const blob=await bake(codec,(i,n)=>{
      S.textContent='動画を作っています '+Math.floor(i/n*100)+'%（'+Math.round(i/BAKE_FPS)+'/'+DUR+'秒ぶん）';
    });
    saveBlob(blob,'booth_history.mp4');
    S.textContent='できた（mp4 '+(blob.size/1024/1024).toFixed(1)+'MB / '
                 +((Date.now()-t0)/1000).toFixed(0)+'秒で作成）';
  }catch(e){ S.textContent='だめだった：'+(e.message||e); }
  setBusy(false); frame(DUR);
});


/* ---- 取り出し（試作/取り出し.js から自動で持ってきている） ---- */
async function collectBooth(report){
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

  // 1) 注文ID
  const d1 = await get('/orders?page=1');
  const last = Math.max(1, ...[...d1.querySelectorAll('a[href*="/orders?page="]')]
    .map(a => +((a.getAttribute('href').match(/page=(\d+)/) || [])[1] || 0)));
  const ids = [];
  for (let p = 1; p <= last; p++) {
    const d = p === 1 ? d1 : await get('/orders?page=' + p);
    [...d.querySelectorAll('a[href^="/orders/"]')].forEach(a => {
      const m = a.getAttribute('href').match(/^\/orders\/(\d+)/); if (m) ids.push(m[1]);
    });
    log(`注文一覧 ${p}/${last}`); await sleep(120);
  }
  const list = [...new Set(ids)];
  if (!list.length) throw new Error('購入履歴が読めません。BOOTHにログインしてから、もう一度。');

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
  try {
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
  for (const o of orders) for (const s of o.shops) for (const it of s.items)
    items.push({ date: o.datetime ? o.datetime.slice(0, 10).replace(/\//g, '-') : null,
      datetime: o.datetime, title: it.title, shop: s.shop, shopUrl: s.shopUrl,
      price: (it.price || 0) + (it.boost || 0), basePrice: it.price || 0, boost: it.boost || 0,
      type: o.isGift ? 'gift_sent' : 'buy', url: it.url, img: it.img, orderId: o.id });
  items.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  const out = { meta: { source: 'booth', exportedAt: new Date().toISOString(),
      orders: orders.length, items: items.length,
      shops: new Set(items.map(i => i.shop)).size,
      itemTotal: items.reduce((a, b) => a + b.price, 0),
      // お支払金額が1件も取れなかった環境では、商品の合計で代用する
      paidTotal: orders.reduce((a, o) => a + (o.paid || 0), 0)
                 || items.reduce((a, b) => a + b.price, 0),
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
  const list=(data.received||[]).filter(o=>o && /^https:\/\/[a-z0-9.-]+\.?booth\.pm\//.test(o.url||''));
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
  step('はじめました');
  try{
    const data=await collectBooth(step);
    if((data.received||[]).length){
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
