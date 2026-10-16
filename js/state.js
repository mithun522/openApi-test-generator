/* Shared state and tiny helpers used by every other module. */
"use strict";

let spec = null;
let RESULT = { cases: [], collection: null };
let currentTab = "browse";

const $ = s => document.querySelector(s);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const METHODS = ["get","post","put","patch","delete","head","options"];

function strVal(v){ return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v); }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" })[c]); }
