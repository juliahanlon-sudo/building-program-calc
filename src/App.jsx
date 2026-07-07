import { useState, useMemo } from "react";
import ScenarioManager from "./ScenarioManager.jsx";

// ── Salesforce Digital Palette ────────────────────────────────────────────────
const SF_NAVY       = "#001E5B";   // Electric Blue 15 — header bg
const SF_BLUE       = "#066AFE";   // Electric Blue 50 — primary accent
const SF_BLUE_DARK  = "#022AC0";   // Electric Blue 30 — hover/active
const SF_BLUE_LIGHT = "#EAF5FE";   // Cloud Blue 95 — subtle tint
const SF_CLOUD      = "#90D0FE";   // Cloud Blue 80 — light accent
const SF_TEAL       = "#04E1CB";   // Teal 80
const GREEN         = "#06A59A";   // Teal 60
const AMBER         = "#E4A201";   // Yellow 70
const RED           = "#B60554";   // Pink 40
const SF_GRAY_100   = "#F3F3F3";
const SF_GRAY_300   = "#DDDBDA";
const SF_GRAY_700   = "#3E3E3C";
const SF_LABEL      = "#514F4D";   // readable label gray (replaces #aaa/#bbb)
const SF_SUBTLE     = "#706E6B";   // secondary/sub text — still muted but legible

// ── Building Program Calculator constants ──────────────────────────────────
const BPC_AMENITY_CAP_FACTOR = 0.75;
const BPC_REGION_DENSITY = {
  AMER:{min:85,max:110}, EMEA:{min:80,max:100}, JAPAC:{min:80,max:105},
  India:{min:75,max:100}, LATAM:{min:80,max:100},
};
const BPC_TIER_ALLOC = {
  T1:{ workspace:0.60, amenity:0.25, support:0.15 },
  T2:{ workspace:0.65, amenity:0.20, support:0.15 },
  T3:{ workspace:0.72, amenity:0.15, support:0.13 },
  T4:{ workspace:0.76, amenity:0.10, support:0.14 },
  T5:{ workspace:0.70, amenity:0.00, support:0.30 },
};
const BPC_FLOOR_MODES = [
  {id:"building",label:"Building Total"},
  {id:"perfloor_same",label:"Per Floor (same)"},
  {id:"perfloor_mixed",label:"Per Floor (varied)"},
];
function bpcCalc({baseSF,tierAlloc,amenitySeats,densityMin,densityMax}) {
  const wsSF  = baseSF * tierAlloc.workspace;
  const amSF  = baseSF * tierAlloc.amenity;
  const supSF = baseSF * tierAlloc.support;
  const mid   = (densityMin+densityMax)/2;
  const wsCapSeats      = mid>0 ? wsSF/mid : 0;
  const amenityCapSeats = amenitySeats * BPC_AMENITY_CAP_FACTOR;
  return {
    wsSF:Math.round(wsSF), amSF:Math.round(amSF), supSF:Math.round(supSF),
    wsCapSeats:Math.round(wsCapSeats),
    amenityCapSeats:Math.round(amenityCapSeats),
    capSeats:Math.round(wsCapSeats+amenityCapSeats),
  };
}
function BpcGroupBar({label,sf,pct,color,baseSF}) {
  if(pct===0) return null;
  return (
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
        <span style={{fontWeight:600,color:SF_NAVY}}>{label}</span>
        <span style={{color:"#6B7280"}}>{Math.round(sf).toLocaleString()} SF · {Math.round(pct*100)}%</span>
      </div>
      <div style={{height:8,background:"#F5F7FA",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(pct*100,100)}%`,background:color,borderRadius:4,transition:"width 0.4s ease"}}/>
      </div>
    </div>
  );
}

const REGIONS = [
  { id:"AMER", label:"AMER" },{ id:"EMEA", label:"EMEA" },{ id:"JAPAC", label:"JAPAC" },
  { id:"India", label:"India" },{ id:"LATAM", label:"LATAM" },
];

const SUPER_GROUPS = [
  { id:"workspace", label:"Workspace", color:"#0176D3", groupIds:["indiv","enclosed","wpspec","open"] },
  { id:"amenity",   label:"Amenity",   color:"#9C27B0", groupIds:["me","specialty","hospitality"] },
  { id:"support",   label:"Support",   color:"#90A4AE", groupIds:["support"] },
];

// Tier data sourced directly from uploaded spreadsheet
const DEFAULT_TIERS = [
  { id:"T1", label:"Tier 1 — Towers (Top Customer Markets)",
    description:"Long-term lease with Salesforce Standard Design and full amenities. Examples: New York, London, San Francisco, Tokyo.",
    superAlloc:{ workspace:0.65, amenity:0.25, support:0.10 },
    wsAlloc:{ indiv:0.45, enclosed:0.20, wpspec:0.10, open:0.25 },
    amAlloc:{ me:0.30, specialty:0.35, hospitality:0.35 },
    // Training rooms per 1,000 capacity seats — scales with building size.
    // These are M&E capacity seats (weighted ×0.75), so auto-fit balances desks around them.
    trainingPer1000:{ training_l:1, training_m:1, training_s:1 },
    densityMin:85, densityMax:110 },
  { id:"T2", label:"Tier 2 — Towers (Customer Hub)",
    description:"Long-term lease with Salesforce Standard Design, less dedicated amenity — prioritisation on multi-purpose spaces for internal/customer needs. Examples: Chicago, Sydney.",
    superAlloc:{ workspace:0.70, amenity:0.20, support:0.10 },
    wsAlloc:{ indiv:0.50, enclosed:0.22, wpspec:0.08, open:0.20 },
    amAlloc:{ me:0.35, specialty:0.40, hospitality:0.25 },
    trainingPer1000:{ training_m:1, training_s:1 },
    densityMin:85, densityMax:105 },
  { id:"T3", label:"Tier 3 — Hubs (Employee Hub)",
    description:"Mid-term lease, with more cost-efficient buildout and services. Flexible gathering spaces. Examples: Hyderabad.",
    superAlloc:{ workspace:0.78, amenity:0.14, support:0.08 },
    wsAlloc:{ indiv:0.58, enclosed:0.22, wpspec:0.05, open:0.15 },
    amAlloc:{ me:0.50, specialty:0.50, hospitality:0.00 },
    densityMin:75, densityMax:95 },
  { id:"T4", label:"Tier 4 — Leased Office",
    description:"Mid-term lease, \"build space first\" with at least a full floor plate (25K sqft) to achieve efficiency vs smaller floor plate buildouts. Examples: All other leased offices.",
    superAlloc:{ workspace:0.82, amenity:0.08, support:0.10 },
    wsAlloc:{ indiv:0.40, enclosed:0.25, wpspec:0.08, open:0.27 },
    amAlloc:{ me:0.00, specialty:0.60, hospitality:0.40 },
    densityMin:70, densityMax:90 },
  { id:"T5", label:"Tier 5 — Serviced Offices",
    description:"Flexible serviced offices in smaller markets, primarily to support distribution teams. Examples: All e-suites.",
    superAlloc:{ workspace:0.90, amenity:0.00, support:0.10 },
    wsAlloc:{ indiv:0.32, enclosed:0.25, wpspec:0.08, open:0.35 },
    amAlloc:{ me:0.00, specialty:0.00, hospitality:0.00 },
    densityMin:70, densityMax:85 },
];

function groupAlloc(tier, groupId) {
  const sg = SUPER_GROUPS.find(s => s.groupIds.includes(groupId));
  if (!sg) return 0;
  const sup = tier.superAlloc[sg.id] ?? 0;
  if (sg.id === "workspace") return sup * (tier.wsAlloc[groupId] ?? 0);
  if (sg.id === "amenity")   return sup * (tier.amAlloc[groupId] ?? 0);
  return sup;
}

// Space groups with ALL space types from the uploaded spreadsheet
// type: "capacity" | "non-capacity" | "none"
// isRoomType: true → 1:N ratio; isDeskPct: true → % of cap; else → group %
// regionMult: multipliers per region (from region multipliers sheet)
const SPACE_GROUPS = [
  // ── INDIVIDUAL WORK ─────────────────────────────────────────────────────
  { id:"indiv", label:"Individual Work", superGroup:"workspace", color:"#70BF75", spaces:[
    { id:"desks",                 label:"Desks",                  type:"capacity",     sf:50,  isDeskPct:true, baseRatio:0.90, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:0.95,JAPAC:0.90,India:1.05,LATAM:1.00} },
    { id:"private_office",        label:"Private Office",         type:"capacity",     sf:150, baseRatio:0, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.10,JAPAC:0.80,India:0.90,LATAM:0.90} },
    { id:"touchdown_seat",        label:"Touchdown Seat",         type:"capacity",     sf:36,  baseRatio:0.02, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.10,JAPAC:1.20,India:0.80,LATAM:0.90} },
    { id:"library",               label:"Library",                type:"capacity",     sf:60,  baseRatio:0.01, seatsPerSpace:14, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.10,India:0.70,LATAM:0.80} },
    { id:"work_room",             label:"Work Room",              type:"capacity",     sf:100, baseRatio:0.01, seatsPerSpace:6, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:0.80,LATAM:0.90} },
  ]},
  // ── ENCLOSED COLLABORATION ──────────────────────────────────────────────
  { id:"enclosed", label:"Enclosed Collaboration", superGroup:"workspace", color:"#0B5CAB", spaces:[
    { id:"micro_phone",   label:"Micro Phone Room",    type:"non-capacity", sf:25,  isRoomType:true, seatsPerRoom:1,  roomRatio:30,  regionMult:{AMER:1.00,EMEA:0.90,JAPAC:1.10,India:1.20,LATAM:0.80} },
    { id:"focus_pod",     label:"Focus Pod",            type:"non-capacity", sf:35,  isRoomType:true, seatsPerRoom:1,  roomRatio:30,  regionMult:{AMER:1.00,EMEA:1.10,JAPAC:1.20,India:0.90,LATAM:0.90} },
    { id:"meeting_pod",   label:"Meeting Pod",          type:"non-capacity", sf:50,  isRoomType:true, seatsPerRoom:2,  roomRatio:50,  regionMult:{AMER:1.00,EMEA:1.05,JAPAC:1.00,India:0.80,LATAM:0.90} },
    { id:"phone_room",    label:"Phone Room",           type:"non-capacity", sf:50,  isRoomType:true, seatsPerRoom:1,  roomRatio:15,  regionMult:{AMER:1.00,EMEA:0.95,JAPAC:1.00,India:1.10,LATAM:0.90} },
    { id:"phone_room_av", label:"Phone Room (AV)",      type:"non-capacity", sf:60,  isRoomType:true, seatsPerRoom:2,  roomRatio:15,  regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:0.90,LATAM:0.90} },
    { id:"huddle_room",   label:"Huddle Room",          type:"non-capacity", sf:120, isRoomType:true, seatsPerRoom:5,  roomRatio:25,  regionMult:{AMER:1.00,EMEA:1.10,JAPAC:0.95,India:1.10,LATAM:1.00} },
    { id:"conf_m",        label:"Conference Room (M)",  type:"non-capacity", sf:250, isRoomType:true, seatsPerRoom:8,  roomRatio:50,  regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.10,LATAM:1.00} },
    { id:"conf_l",        label:"Conference Room (L)",  type:"non-capacity", sf:400, isRoomType:true, seatsPerRoom:14, roomRatio:150, regionMult:{AMER:1.00,EMEA:0.95,JAPAC:0.90,India:0.90,LATAM:0.90} },
    { id:"conf_xl",       label:"Conference Room (XL)", type:"non-capacity", sf:600, isRoomType:true, seatsPerRoom:20, roomRatio:500, regionMult:{AMER:1.00,EMEA:0.90,JAPAC:0.85,India:0.80,LATAM:0.85} },
    { id:"conf_aloha",    label:"Conference Room (Aloha)", type:"non-capacity", sf:400, isRoomType:true, seatsPerRoom:14, roomRatio:150, regionMult:{AMER:1.00,EMEA:0.95,JAPAC:0.90,India:0.90,LATAM:0.90} },
  ]},
  // ── WORKPLACE SPECIALTY ─────────────────────────────────────────────────
  { id:"wpspec", label:"Workplace Specialty", superGroup:"workspace", color:"#FCC003", spaces:[
    { id:"social_lounge",   label:"Social Lounge",     type:"non-capacity", sf:400, baseRatio:1, fixedCount:1, seatsPerSpace:20, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"water_point",     label:"Water Point",       type:"none", sf:200, baseRatio:0.25, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"mindfulness",     label:"Mindfulness",       type:"non-capacity", sf:250, baseRatio:0.20, fixedCount:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"reflection_room", label:"Reflection Room",   type:"non-capacity", sf:500, baseRatio:0.15, fixedCount:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"catering_pantry", label:"Catering Pantry",   type:"non-capacity", sf:150, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"flex_room",       label:"Flex Room",         type:"non-capacity", sf:200, baseRatio:0.10, seatsPerSpace:6, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"multifaith_room", label:"Multifaith Room",   type:"non-capacity", sf:150, baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"parents_room",    label:"Parent's Room",     type:"non-capacity", sf:100, baseRatio:0.10, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"reception_ws",    label:"Reception",         type:"non-capacity", sf:200, baseRatio:0.10, fixedCount:1, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"reception_lounge",label:"Reception Lounge",  type:"non-capacity", sf:300, baseRatio:0.10, fixedCount:1, seatsPerSpace:8, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"treadmill_desk",  label:"Treadmill Desk",    type:"non-capacity", sf:40,  baseRatio:0.05, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"webinar_room",    label:"Webinar Room",      type:"non-capacity", sf:200, baseRatio:0.10, fixedCount:1, seatsPerSpace:3, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"wellness_room",   label:"Wellness Room",     type:"non-capacity", sf:350, baseRatio:0.10, fixedCount:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
  ]},
  // ── OPEN COLLABORATION ──────────────────────────────────────────────────
  { id:"open", label:"Open Collaboration", superGroup:"workspace", color:"#CDEFC4", spaces:[
    { id:"booth",            label:"Booth",                    type:"capacity",     sf:80,  baseRatio:0.15, seatsPerSpace:2, seatWeight:0.50, regionMult:{AMER:1.00,EMEA:1.05,JAPAC:0.90,India:0.80,LATAM:0.95} },
    { id:"cafe_collab",      label:"Cafe Collaboration Table", type:"capacity",     sf:60,  baseRatio:0.20, seatsPerSpace:4, seatWeight:0.50, regionMult:{AMER:1.00,EMEA:1.10,JAPAC:1.05,India:1.10,LATAM:1.00} },
    { id:"collab_space",     label:"Collaboration Space",      type:"capacity",     sf:120, baseRatio:0, seatsPerSpace:6, seatWeight:0.50, regionMult:{AMER:1.00,EMEA:0.95,JAPAC:0.95,India:0.85,LATAM:0.95} },
    { id:"community_table",  label:"Community Table",          type:"capacity",     sf:50,  baseRatio:0.20, seatsPerSpace:6, seatWeight:0.50, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.10,India:1.20,LATAM:1.00} },
    { id:"project_bay",      label:"Project Bay",              type:"capacity",     sf:150, baseRatio:0.10, seatsPerSpace:6, seatWeight:0.50, regionMult:{AMER:1.00,EMEA:0.90,JAPAC:0.85,India:0.70,LATAM:0.85} },
    { id:"soft_seating",     label:"Soft Seating",             type:"non-capacity", sf:40,  baseRatio:0.10, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:0.90,LATAM:1.00} },
  ]},
  // ── M&E ─────────────────────────────────────────────────────────────────
  { id:"me", label:"M&E", superGroup:"amenity", color:"#4DB6AC", spaces:[
    { id:"auditorium",       label:"Auditorium",           type:"capacity",     sf:2000, baseRatio:0, seatsPerSpace:150, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:0.90,JAPAC:0.85,India:0.90,LATAM:0.85} },
    { id:"pre_function",     label:"Pre-Function Space",   type:"capacity",     sf:1500, baseRatio:0, seatsPerSpace:50, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:0.95,JAPAC:0.90,India:0.85,LATAM:0.90} },
    { id:"training_l",       label:"Training Room (L)",    type:"capacity",     sf:1000, baseRatio:0, seatsPerSpace:50, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.10,LATAM:0.90} },
    { id:"training_m",       label:"Training Room (M)",    type:"capacity",     sf:700,  baseRatio:0, seatsPerSpace:32, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.10,LATAM:0.90} },
    { id:"training_s",       label:"Training Room (S)",    type:"capacity",     sf:500,  baseRatio:0, seatsPerSpace:24, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.10,LATAM:0.90} },
    { id:"project_room",     label:"Project Room",         type:"capacity",     sf:300,  baseRatio:0, seatsPerSpace:16, seatWeight:0.75, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
  ]},
  // ── BUILDING SPECIALTY ──────────────────────────────────────────────────
  { id:"specialty", label:"Building Specialty", superGroup:"amenity", color:"#E57373", spaces:[
    { id:"av_control",       label:"AV Control Room",          type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"badge_room",       label:"Badge Room",               type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"catering_bld",     label:"Catering",                 type:"none", sf:400, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"childcare_bld",    label:"Childcare",                type:"none", sf:600, baseRatio:0, seatsPerSpace:20, regionMult:{AMER:1.00,EMEA:0.70,JAPAC:0.60,India:0.50,LATAM:0.60} },
    { id:"command_center",   label:"Command Center",           type:"capacity", sf:400, baseRatio:0, seatsPerSpace:10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"critical_incident",label:"Critical Incident Center", type:"capacity", sf:300, baseRatio:0, seatsPerSpace:12, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"csirt",            label:"CSIRT",                    type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:12, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"fitness_bld",      label:"Fitness Center",           type:"none", sf:800, baseRatio:0, seatsPerSpace:15, regionMult:{AMER:1.00,EMEA:0.80,JAPAC:0.70,India:0.60,LATAM:0.70} },
    { id:"game_room",        label:"Game Room",                type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"go_center",        label:"Go Center",                type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"it_provisioning",  label:"IT Provisioning",          type:"non-capacity", sf:150, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"lab",              label:"Lab",                      type:"non-capacity", sf:400, baseRatio:0, seatsPerSpace:10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"media_room",       label:"Media Room",               type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:3, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"medical_room",     label:"Medical Room",             type:"non-capacity", sf:150, baseRatio:0, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"mobility_lab",     label:"Mobility Lab",             type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:3, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"outdoor_terrace",  label:"Outdoor / Terrace",        type:"non-capacity", sf:500, baseRatio:0, regionMult:{AMER:1.00,EMEA:0.60,JAPAC:0.70,India:0.80,LATAM:1.20} },
    { id:"pantry_bld",       label:"Pantry",                   type:"none", sf:200, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"sre",              label:"Site Reliability Eng.",    type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:8, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"staging_room",     label:"Staging / Green Room",     type:"none", sf:100, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"techforce",        label:"Techforce",                type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"techforce_lab",    label:"Techforce Lab",            type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:6, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ux_lab",           label:"UX Lab",                   type:"non-capacity", sf:100, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
  ]},
  // ── HOSPITALITY ─────────────────────────────────────────────────────────
  { id:"hospitality", label:"Hospitality", superGroup:"amenity", color:"#BA68C8", spaces:[
    { id:"ai_learning",         label:"AI - Learning",                    type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:8, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"barista_bar",         label:"Barista Bar",                      type:"non-capacity", sf:150, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"cafeteria",           label:"Cafeteria",                        type:"non-capacity", sf:800, baseRatio:0, seatsPerSpace:60, regionMult:{AMER:1.00,EMEA:1.10,JAPAC:1.10,India:1.20,LATAM:1.10} },
    { id:"trailblazer_hub",     label:"Community Trailblazer Hub",        type:"non-capacity", sf:400, baseRatio:0, seatsPerSpace:20, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"customer_conf",       label:"Customer - Conference Room",       type:"non-capacity", sf:250, baseRatio:0, seatsPerSpace:22, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"customer_huddle",     label:"Customer - Huddle Room",           type:"non-capacity", sf:120, baseRatio:0, seatsPerSpace:5, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"customer_phone",      label:"Customer - Phone Room",            type:"non-capacity", sf:50,  baseRatio:0, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"customer_work_room",  label:"Customer Work Room",               type:"non-capacity", sf:150, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"demo_area",           label:"Demo Area",                        type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:8, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_conf",          label:"Ohana - Conference Room",          type:"non-capacity", sf:250, baseRatio:0, seatsPerSpace:16, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_dining",        label:"Ohana - Exhibition Dining",        type:"non-capacity", sf:600, baseRatio:0, seatsPerSpace:22, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_kitchen",       label:"Ohana - Exhibition Kitchen (FOH)", type:"non-capacity", sf:400, baseRatio:0, seatsPerSpace:5, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_huddle",        label:"Ohana - Huddle Room",              type:"non-capacity", sf:500, baseRatio:0, seatsPerSpace:5, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"lounge",              label:"Lounge",                           type:"non-capacity", sf:400, baseRatio:0, seatsPerSpace:20, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_piano",         label:"Ohana - Piano",                    type:"non-capacity", sf:100, baseRatio:0, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"ohana_production",    label:"Ohana - Production Room",          type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:4, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"salon",               label:"Salon",                            type:"non-capacity", sf:200, baseRatio:0, seatsPerSpace:8, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"sic_conf",            label:"SIC - Conference Room",            type:"non-capacity", sf:250, baseRatio:0, seatsPerSpace:22, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"sic_phone",           label:"SIC - Phone Room",                 type:"non-capacity", sf:50,  baseRatio:0, seatsPerSpace:1, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"sic_dining",          label:"SIC Private Dining",               type:"non-capacity", sf:300, baseRatio:0, seatsPerSpace:16, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
  ]},
  // ── SUPPORT ─────────────────────────────────────────────────────────────
  { id:"support", label:"Support", superGroup:"support", color:"#90A4AE", spaces:[
    { id:"av_rack",       label:"AV Rack Room",               type:"non-capacity", sf:200, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"av_storage",    label:"AV Storage",                 type:"none", sf:200, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"bike_room",     label:"Bike Room",                  type:"none", sf:80,  baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"bomb_shelter",  label:"Bomb Shelter",               type:"none", sf:200, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"built_out",     label:"Built Out Zone",             type:"none", sf:200, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"coat_closet",   label:"Coat Closet",                type:"none", sf:50,  baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"comm_stair",    label:"Communicating Stair",        type:"none", sf:300, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"copy_print",    label:"Copy Print Center",          type:"none", sf:80,  baseRatio:0.15, regionMult:{AMER:1.00,EMEA:0.90,JAPAC:0.85,India:1.20,LATAM:0.90} },
    { id:"cubbies",       label:"Cubbies",                    type:"none", sf:20,  baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"idf",           label:"IDF",                        type:"none", sf:100, baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"irrigation",    label:"Irrigation Room",            type:"none", sf:80,  baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"janitor",       label:"Janitor Closet",             type:"none", sf:50,  baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"lobby",         label:"Lobby",                      type:"none", sf:300, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"locker_room",   label:"Locker Room",                type:"none", sf:150, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"mail_center",   label:"Mail Center",                type:"non-capacity", sf:150, baseRatio:0, seatsPerSpace:2, regionMult:{AMER:1.00,EMEA:0.80,JAPAC:0.70,India:0.80,LATAM:0.80} },
    { id:"mdf",           label:"MDF",                        type:"none", sf:150, baseRatio:0.05, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"millwork",      label:"Millwork & Trash/Recycling", type:"none", sf:7,   baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"office_svc",    label:"Office Services Supply Rm",  type:"none", sf:100, baseRatio:0, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"restroom",      label:"Restroom",                   type:"none", sf:200, baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"staff_room",    label:"Staff Room",                 type:"non-capacity", sf:100, baseRatio:0, seatsPerSpace:6, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"storage_sup",   label:"Storage",                    type:"none", sf:150, baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
    { id:"team_storage",  label:"Team Storage",               type:"none", sf:7,   baseRatio:0.10, regionMult:{AMER:1.00,EMEA:1.00,JAPAC:1.00,India:1.00,LATAM:1.00} },
  ]},
];

const WORKSPACE_IDS = ["indiv","enclosed","wpspec","open"];
// M&E training rooms that tiers can seed via trainingPer1000. When a tier seeds
// them, at least one of each is guaranteed even for a small plan.
const TRAINING_IDS = ["training_l","training_m","training_s"];

function allSpaces() {
  return SPACE_GROUPS.flatMap(g => g.spaces.map(sp => ({...sp, groupId:g.id, superGroup:g.superGroup})));
}

function computeRatios(tierId, regionId, tiers=DEFAULT_TIERS) {
  const tier = tiers.find(t => t.id === tierId);
  const r = {};
  SPACE_GROUPS.forEach(g => {
    const gAlloc = groupAlloc(tier, g.id);
    g.spaces.forEach(sp => {
      const mult = sp.regionMult?.[regionId] ?? 1.0;
      const trainingN = tier?.trainingPer1000?.[sp.id];
      if (sp.isDeskPct)      r[sp.id] = Math.min(1, Math.max(0, sp.baseRatio * mult));
      else if (sp.isRoomType) r[sp.id] = Math.max(1, Math.round(sp.roomRatio / mult));
      // Training rooms seeded per-tier as "rooms per 1,000 capacity seats" — the
      // planRef × ratio count math then yields that many rooms as the plan scales.
      else if (trainingN)     r[sp.id] = (trainingN / 1000) * mult;
      else                    r[sp.id] = gAlloc * sp.baseRatio * mult;
    });
  });
  return r;
}

function densityStatus(actual, dMax, dMin) {
  if (!actual) return "neutral";
  if (actual >= dMin && actual <= dMax) return "good";
  return actual < dMin ? "under" : "over";
}
function sColor(st) { return st==="good"?GREEN:st==="under"?RED:st==="over"?AMBER:"#aaa"; }
function sLabel(st)  { return st==="good"?"Within target":st==="under"?"Too dense":st==="over"?"Too sparse":"—"; }

// ── UI helpers ───────────────────────────────────────────────────────────────
function StatCard({label,value,accent,sub}) {
  return (
    <div style={{background:"#fff",border:`1px solid ${accent}55`,borderRadius:8,padding:"10px 16px",minWidth:100}}>
      <div style={{fontSize:11,letterSpacing:"0.1em",color:accent,fontWeight:700,marginBottom:4,textTransform:"uppercase"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",color:SF_NAVY,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:SF_SUBTLE,marginTop:4}}>{sub}</div>}
    </div>
  );
}
function Panel({title,children}) {
  return (
    <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div style={{fontSize:11,letterSpacing:"0.12em",color:SF_LABEL,fontWeight:700,marginBottom:14,textTransform:"uppercase"}}>{title}</div>
      {children}
    </div>
  );
}
function Field({label,children,style:st}) {
  return (
    <div style={{marginBottom:12,...st}}>
      <label style={{display:"block",fontSize:12,color:SF_GRAY_700,fontWeight:600,marginBottom:5}}>{label}</label>
      {children}
    </div>
  );
}
function CalcRow({label,value,bold,accent}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:12.5,color:bold?"#181818":SF_GRAY_700,fontWeight:bold?700:500}}>{label}</span>
      <span style={{fontSize:13,color:accent??SF_NAVY,fontVariantNumeric:"tabular-nums",fontWeight:bold?700:600}}>{value}</span>
    </div>
  );
}
// Small inline cell for the Tiers & Regions page. When `locked` it renders as
// plain text (indistinguishable from a normal read-only table); when unlocked
// it becomes an editable number input. `active` tints it for the selected tier.
function TierCell({value,onChange,suffix,active,color,step=1,width=48,locked}) {
  if(locked){
    return <span style={{fontSize:active?14:12,fontWeight:active?700:600,color:active?SF_BLUE:(color??SF_NAVY),fontVariantNumeric:"tabular-nums"}}>{value}{suffix}</span>;
  }
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:2,justifyContent:"center"}}>
      <input type="number" value={value} min={0} step={step}
        onChange={e=>onChange(e.target.value)}
        style={{width,padding:"3px 4px",textAlign:"center",border:`1px solid ${active?SF_BLUE:"#ddd"}`,
          borderRadius:5,fontSize:12,fontWeight:active?700:600,color:active?SF_BLUE:(color??SF_NAVY),
          background:"#fff",outline:"none",fontVariantNumeric:"tabular-nums",MozAppearance:"textfield"}}/>
      {suffix&&<span style={{fontSize:10,color:SF_SUBTLE}}>{suffix}</span>}
    </span>
  );
}

function SeatStat({label,value,color,bold,sub,subColor}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3,flex:1,minWidth:0}}>
      <div style={{fontSize:11,letterSpacing:"0.08em",color:SF_LABEL,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</div>
      <div style={{fontSize:20,fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",color,fontVariantNumeric:"tabular-nums",fontWeight:700,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:subColor??SF_SUBTLE,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

// Shared column widths for consistent alignment across all row types
const COL = { ratio:130, pct:44, spaces:56, seats:56 };

function ColVal({label,value,color,bg,bold}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,width:COL.spaces}}>
      <span style={{fontSize:10,color:SF_LABEL,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{label}</span>
      <span style={{background:bg??"#f0f0f0",padding:"3px 8px",borderRadius:20,fontSize:13,color:color??SF_NAVY,fontWeight:bold?700:600,textAlign:"center",minWidth:32,fontVariantNumeric:"tabular-nums"}}>{value}</span>
    </div>
  );
}

function RoomRow({sp,results,ratios,setRatios,roomSeats,setRoomSeats,locked,baseRatios}) {
  const res     = results.find(r=>r.id===sp.id);
  const rooms   = res?.rooms ?? 0;
  const seatsPer= roomSeats[sp.id] ?? sp.seatsPerRoom ?? 1;
  const effN    = ratios[sp.id] ?? sp.roomRatio;
  const seats   = rooms * seatsPer;
  const defaultN = baseRatios?.[sp.id] ?? sp.roomRatio;
  const modified = ratios[sp.id] !== undefined && ratios[sp.id] !== defaultN;
  return (
    <div style={{display:"flex",alignItems:"center",padding:"8px 20px",gap:12,borderBottom:"1px solid #f5f5f5",background:locked?"transparent":"#fffdf0"}}>
      {/* Label */}
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
        <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,background:"#0B5CAB22",color:"#0B5CAB",flexShrink:0}}>NON</span>
        <span style={{fontSize:13,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sp.label}</span>
      </div>
      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        {/* Seats/room input */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,width:60}}>
          <span style={{fontSize:9,color:SF_LABEL,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>Seats/Rm</span>
          <input type="number" min={1} max={100} value={seatsPer} disabled={locked}
            onChange={e=>setRoomSeats(r=>({...r,[sp.id]:parseInt(e.target.value)||1}))}
            style={{width:46,padding:"3px 4px",border:"1px solid #ddd",borderRadius:6,fontSize:12,fontWeight:700,color:locked?"#bbb":SF_NAVY,textAlign:"center",background:locked?"#f5f5f5":"#fff"}}/>
        </div>
        {/* Ratio */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,width:COL.ratio}}>
          <span style={{fontSize:9,color:SF_LABEL,textTransform:"uppercase",letterSpacing:"0.08em"}}>Ratio</span>
          {locked ? (
            <span style={{fontSize:14,fontWeight:700,color:"#0B5CAB",background:"#0B5CAB0D",border:"1px solid #0B5CAB33",borderRadius:6,padding:"3px 10px",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
              1 : {effN}
            </span>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:12,color:"#888"}}>1 :</span>
              <input type="number" min={1} max={500} value={effN}
                onChange={e=>setRatios(r=>({...r,[sp.id]:parseInt(e.target.value)||sp.roomRatio}))}
                style={{width:52,padding:"3px 6px",border:`1.5px solid ${modified?"#e6a817":"#0B5CAB44"}`,borderRadius:6,fontSize:13,fontWeight:700,color:modified?"#b45309":"#0B5CAB",textAlign:"center"}}/>
              {modified && <button onClick={()=>setRatios(r=>({...r,[sp.id]:defaultN}))}
                style={{background:"#fef9e7",border:"none",cursor:"pointer",color:"#b45309",fontSize:10,padding:"2px 6px",borderRadius:4,fontWeight:600}}>reset</button>}
            </div>
          )}
        </div>
        {/* Spaces */}
        <ColVal label="Spaces" value={rooms} color="#0B5CAB" bg="#0B5CAB15" bold/>
        {/* Seats */}
        <ColVal label="Seats" value={seats} color={SF_NAVY} bg="#e8f4fd" bold/>
      </div>
    </div>
  );
}

function SpaceRow({sp,results,ratios,baseRatios,setRatios,spaceSeats,setSpaceSeats,fixedExcluded,toggleFixed,capShareDenom}) {
  const res      = results.find(r=>r.id===sp.id);
  const base     = baseRatios[sp.id] ?? 0;
  const modified = Math.abs((ratios[sp.id]??0) - base) > 0.0005;
  const bc  = sp.type==="capacity"?"#70BF75":sp.type==="non-capacity"?"#7B68EE":"#90A4AE";
  const bb  = sp.type==="capacity"?"#70BF7522":sp.type==="non-capacity"?"#7B68EE22":"#f0f0f0";
  const spaces = res?.spaces ?? res?.count ?? 0;
  const seats  = res?.count ?? 0;
  const isNone = sp.type === "none";
  // % is only meaningful for capacity spaces in Individual Work / Open Collaboration —
  // it shows each space's share of total workspace capacity seats (column sums to 100%).
  const groupId  = res?.groupId;
  const showPct  = sp.type==="capacity" && (groupId==="indiv"||groupId==="open");
  const wSeats   = Math.round((res?.count??0)*(sp.seatWeight??1));
  const sharePct = capShareDenom>0 ? (wSeats/capShareDenom)*100 : 0;
  return (
    <div style={{display:"flex",alignItems:"center",padding:"7px 20px",gap:12,borderBottom:"1px solid #f5f5f5",background:"transparent",transition:"background 0.5s"}}>
      {/* Label */}
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
        <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,background:bb,color:bc,flexShrink:0}}>
          {sp.type==="capacity"?"CAP":sp.type==="non-capacity"?"NON":"—"}
        </span>
        <span style={{fontSize:13,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sp.label}</span>
        {sp.seatWeight && sp.seatWeight < 1 && <span style={{fontSize:9,fontWeight:700,color:"#4DB6AC",background:"#4DB6AC15",border:"1px solid #4DB6AC44",borderRadius:4,padding:"1px 5px",flexShrink:0}}>×{sp.seatWeight}</span>}
        {sp.seatsPerSpace && (
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            <span style={{fontSize:9,color:SF_LABEL}}>seats/space</span>
            <input type="number" min={1} max={2000} value={spaceSeats[sp.id]??sp.seatsPerSpace}
              onChange={e=>setSpaceSeats(s=>({...s,[sp.id]:parseInt(e.target.value)||1}))}
              style={{width:52,padding:"2px 5px",border:`1px solid ${spaceSeats[sp.id]&&spaceSeats[sp.id]!==sp.seatsPerSpace?SF_BLUE:"#7B68EE55"}`,borderRadius:5,fontSize:12,fontWeight:700,color:spaceSeats[sp.id]&&spaceSeats[sp.id]!==sp.seatsPerSpace?SF_BLUE:"#7B68EE",textAlign:"center",background:"#7B68EE0A"}}/>
            {spaceSeats[sp.id]&&spaceSeats[sp.id]!==sp.seatsPerSpace&&
              <button onClick={()=>setSpaceSeats(s=>{const n={...s};delete n[sp.id];return n;})} style={{background:"#e8f4fd",border:"none",cursor:"pointer",color:SF_BLUE,fontSize:10,padding:"2px 6px",borderRadius:4,fontWeight:600,flexShrink:0}}>reset</button>}
          </div>
        )}
        {modified && <button onClick={()=>setRatios(r=>({...r,[sp.id]:base}))} style={{background:"#e8f4fd",border:"none",cursor:"pointer",color:SF_BLUE,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:600,flexShrink:0}}>reset</button>}
      </div>
      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        {/* Slider + % — hidden for fixed-count spaces */}
        {sp.fixedCount ? (
          <div style={{display:"flex",alignItems:"center",gap:8,width:COL.ratio+COL.pct+10}}>
            <button onClick={()=>toggleFixed(sp.id)} style={{
              padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
              background:fixedExcluded.has(sp.id)?"#f0f0f0":"#E8F4FD",
              color:fixedExcluded.has(sp.id)?"#aaa":SF_BLUE
            }}>
              {fixedExcluded.has(sp.id)?"Excluded":"Included"}
            </button>
            <span style={{fontSize:10,color:SF_LABEL,fontStyle:"italic"}}>1 per floor</span>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:6,width:COL.ratio+COL.pct+10}}>
            <input type="range" min={0} max={sp.isDeskPct?1:0.5} step={sp.isDeskPct?0.01:0.005}
              value={ratios[sp.id]??(sp.isDeskPct?0.90:0)}
              onChange={e=>setRatios(r=>({...r,[sp.id]:parseFloat(e.target.value)}))}
              style={{flex:1,accentColor:SF_BLUE,cursor:"pointer"}}/>
            <span style={{fontSize:12,width:COL.pct,textAlign:"right",fontVariantNumeric:"tabular-nums",color:showPct?SF_NAVY:SF_GRAY_700,fontWeight:showPct?700:600,flexShrink:0}}>
              {showPct ? `${sharePct.toFixed(1)}%` : ""}
            </span>
          </div>
        )}
        {/* Spaces */}
        <ColVal label="Spaces" value={spaces} color={bc} bg={bb} bold/>
        {/* Seats */}
        <ColVal label="Seats" value={isNone ? "—" : seats} color={isNone?"#ccc":SF_NAVY} bg={isNone?"#f7f7f7":"#e8f4fd"} bold={!isNone}/>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [showScenarios,     setShowScenarios]     = useState(false);

  const [asf,         setAsf]         = useState(25000);
  const [pinnedSeats, setPinnedSeats] = useState(200);
  const [inputMode,   setInputMode]   = useState("asf");
  const [city,        setCity]        = useState("");
  const [region,      setRegion]      = useState("AMER");
  const [tierId,      setTierId]      = useState("T1");
  // Editable tier definitions (allocations + density) — seeded from the defaults.
  const [TIERS,       setTIERS]       = useState(()=>JSON.parse(JSON.stringify(DEFAULT_TIERS)));
  const [tiersLocked, setTiersLocked] = useState(true); // tier table read-only until unlocked
  const [ratios,      setRatios]      = useState(()=>computeRatios("T1","AMER"));
  const [sfOver,      setSfOver]      = useState({});
  const [roomSeats,   setRoomSeats]   = useState({});
  const [spaceSeats,  setSpaceSeats]  = useState({});  // seats per space overrides (e.g. Social Lounge)
  const [tab,         setTab]         = useState("program");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (id) => setCollapsedGroups(s=>({...s,[id]:!s[id]}));
  const [sharedDensityMin, setSharedDensityMin] = useState(85);
  const [sharedDensityMax, setSharedDensityMax] = useState(110);

  // ── Floor selection for Calculator ────────────────────────────────────────
  const [floorSel,      setFloorSel]      = useState("all");
  const [selectedFloors,setSelectedFloors]= useState([]);
  const [asfOverride,   setAsfOverride]   = useState(null);
  const [fixedExcluded, setFixedExcluded] = useState(new Set(["reflection_room","reception_ws","reception_lounge","wellness_room","webinar_room"]));
  const toggleFixed = (id) => setFixedExcluded(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const [lockedRooms, setLockedRooms] = useState(true); // all room types locked by default
  const toggleRoomLock = () => setLockedRooms(v => !v);
  const [compData,    setCompData]    = useState(null);  // { id -> {spaces, seats} }
  const [compName,    setCompName]    = useState("");

  // ── Building Program Calculator state ─────────────────────────────────────
  const [bpcSfBase,      setBpcSfBase]      = useState("asf");
  const [bpcAsfValue,    setBpcAsfValue]    = useState(42500);
  const [bpcFloorMode,   setBpcFloorMode]   = useState("building");
  const [bpcBuildingRSF, setBpcBuildingRSF] = useState(50000);
  const [bpcPerFloorRSF, setBpcPerFloorRSF] = useState(10000);
  const [bpcFloors,      setBpcFloors]      = useState(5);
  const [bpcFloorRSFs,   setBpcFloorRSFs]   = useState(Array(5).fill(10000));
  const [bpcOtherSF,     setBpcOtherSF]     = useState(50000);
  const [bpcAmenitySeats,setBpcAmenitySeats]= useState(50);
  // bpcDensityMin/Max unified into sharedDensityMin/Max above

  const syncBpcFloors = (n) => {
    setBpcFloors(n);
    setBpcFloorRSFs(prev => Array.from({length:n},(_,i)=>prev[i]??10000));
  };
  const updateBpcFloorRSF = (i,val) =>
    setBpcFloorRSFs(prev=>{const next=[...prev];next[i]=val;return next;});

  const [saveSlots,    setSaveSlots]    = useState([]);
  const [saveName,     setSaveName]     = useState("");
  const [showSaveUI,   setShowSaveUI]   = useState(false);
  const [storageMsg,   setStorageMsg]   = useState("");

  // Load slot list on mount from localStorage
  useState(()=>{
    try {
      const keys = Object.keys(localStorage).filter(k=>k.startsWith("spaceplan:"));
      setSaveSlots(keys.map(k=>k.replace("spaceplan:","")));
    } catch(_){}
  });

  const currentSettings = () => ({
    tiers:TIERS,
    asf,pinnedSeats,inputMode,city,region,tierId,ratios,sfOver,roomSeats,spaceSeats,collapsedGroups,
    sharedDensityMin,sharedDensityMax,floorSel,selectedFloors,asfOverride,fixedExcluded:[...fixedExcluded],
    bpcSfBase,bpcAsfValue,bpcFloorMode,bpcBuildingRSF,bpcPerFloorRSF,bpcFloors,bpcFloorRSFs,
    bpcOtherSF,bpcAmenitySeats,
  });

  const handleSave = () => {
    const name = saveName.trim() || city.trim() || "Untitled";
    const key  = `spaceplan:${name}`;
    try {
      localStorage.setItem(key, JSON.stringify({...currentSettings(), savedAt: new Date().toLocaleString()}));
      const keys = Object.keys(localStorage).filter(k=>k.startsWith("spaceplan:"));
      setSaveSlots(keys.map(k=>k.replace("spaceplan:","")));
      setStorageMsg(`Saved "${name}"`);
      setSaveName("");
      setTimeout(()=>setStorageMsg(""),2500);
    } catch(e){ setStorageMsg("Save failed"); }
  };

  const handleLoad = (name) => {
    try {
      const raw = localStorage.getItem(`spaceplan:${name}`);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s.tiers       !== undefined) setTIERS(s.tiers);
      if(s.asf         !== undefined) setAsf(s.asf);
      if(s.pinnedSeats !== undefined) setPinnedSeats(s.pinnedSeats);
      if(s.inputMode   !== undefined) setInputMode(s.inputMode);
      if(s.city        !== undefined) setCity(s.city);
      if(s.region      !== undefined) setRegion(s.region);
      if(s.tierId      !== undefined) setTierId(s.tierId);
      if(s.ratios      !== undefined) setRatios(s.ratios);
      if(s.sfOver      !== undefined) setSfOver(s.sfOver);
      if(s.roomSeats   !== undefined) setRoomSeats(s.roomSeats);
      if(s.spaceSeats  !== undefined) setSpaceSeats(s.spaceSeats);
      if(s.collapsedGroups  !== undefined) setCollapsedGroups(s.collapsedGroups);
      if(s.sharedDensityMin !== undefined) setSharedDensityMin(s.sharedDensityMin);
      if(s.sharedDensityMax !== undefined) setSharedDensityMax(s.sharedDensityMax);
      if(s.floorSel         !== undefined) setFloorSel(s.floorSel);
      if(s.selectedFloors   !== undefined) setSelectedFloors(s.selectedFloors);
      if(s.asfOverride      !== undefined) setAsfOverride(s.asfOverride);
      if(s.fixedExcluded    !== undefined) setFixedExcluded(new Set(s.fixedExcluded));
      if(s.bpcSfBase       !== undefined) setBpcSfBase(s.bpcSfBase);
      if(s.bpcAsfValue     !== undefined) setBpcAsfValue(s.bpcAsfValue);
      if(s.bpcFloorMode    !== undefined) setBpcFloorMode(s.bpcFloorMode);
      if(s.bpcBuildingRSF  !== undefined) setBpcBuildingRSF(s.bpcBuildingRSF);
      if(s.bpcPerFloorRSF  !== undefined) setBpcPerFloorRSF(s.bpcPerFloorRSF);
      if(s.bpcFloors       !== undefined) setBpcFloors(s.bpcFloors);
      if(s.bpcFloorRSFs    !== undefined) setBpcFloorRSFs(s.bpcFloorRSFs);
      if(s.bpcOtherSF      !== undefined) setBpcOtherSF(s.bpcOtherSF);
      if(s.bpcAmenitySeats !== undefined) setBpcAmenitySeats(s.bpcAmenitySeats);

      setShowSaveUI(false);
      setStorageMsg(`Loaded "${name}"`);
      setTimeout(()=>setStorageMsg(""),2500);
    } catch(e){ setStorageMsg("Load failed"); }
  };

  const handleLoadScenario = (s) => {
    if(s.tiers       !== undefined) setTIERS(s.tiers);
    if(s.asf         !== undefined) setAsf(s.asf);
    if(s.pinnedSeats !== undefined) setPinnedSeats(s.pinnedSeats);
    if(s.inputMode   !== undefined) setInputMode(s.inputMode);
    if(s.city        !== undefined) setCity(s.city);
    if(s.region      !== undefined) setRegion(s.region);
    if(s.tierId      !== undefined) setTierId(s.tierId);
    if(s.ratios      !== undefined) setRatios(s.ratios);
    if(s.sfOver      !== undefined) setSfOver(s.sfOver);
    if(s.roomSeats   !== undefined) setRoomSeats(s.roomSeats);
    if(s.spaceSeats  !== undefined) setSpaceSeats(s.spaceSeats);
    if(s.collapsedGroups  !== undefined) setCollapsedGroups(s.collapsedGroups);
    if(s.sharedDensityMin !== undefined) setSharedDensityMin(s.sharedDensityMin);
    if(s.sharedDensityMax !== undefined) setSharedDensityMax(s.sharedDensityMax);
    if(s.floorSel         !== undefined) setFloorSel(s.floorSel);
    if(s.selectedFloors   !== undefined) setSelectedFloors(s.selectedFloors);
    if(s.asfOverride      !== undefined) setAsfOverride(s.asfOverride);
    if(s.fixedExcluded    !== undefined) setFixedExcluded(new Set(s.fixedExcluded));
    if(s.bpcSfBase       !== undefined) setBpcSfBase(s.bpcSfBase);
    if(s.bpcAsfValue     !== undefined) setBpcAsfValue(s.bpcAsfValue);
    if(s.bpcFloorMode    !== undefined) setBpcFloorMode(s.bpcFloorMode);
    if(s.bpcBuildingRSF  !== undefined) setBpcBuildingRSF(s.bpcBuildingRSF);
    if(s.bpcPerFloorRSF  !== undefined) setBpcPerFloorRSF(s.bpcPerFloorRSF);
    if(s.bpcFloors       !== undefined) setBpcFloors(s.bpcFloors);
    if(s.bpcFloorRSFs    !== undefined) setBpcFloorRSFs(s.bpcFloorRSFs);
    if(s.bpcOtherSF      !== undefined) setBpcOtherSF(s.bpcOtherSF);
    if(s.bpcAmenitySeats !== undefined) setBpcAmenitySeats(s.bpcAmenitySeats);
  };



  const tier = TIERS.find(t=>t.id===tierId);
  const densityMin = sharedDensityMin;
  const densityMax = sharedDensityMax;

  function changeTier(id)   { const t=TIERS.find(x=>x.id===id); setTierId(id); setRatios(computeRatios(id,region,TIERS)); if(t){setSharedDensityMin(t.densityMin);setSharedDensityMax(t.densityMax);} }
  function changeRegion(id) {
    setRegion(id);
    setRatios(computeRatios(tierId,id,TIERS));
    const d = BPC_REGION_DENSITY[id];
    if(d) { setSharedDensityMin(d.min); setSharedDensityMax(d.max); }
  }

  // ── Editable tier definitions (Tiers & Regions page) ────────────────────
  // group: "superAlloc" | "wsAlloc" | "amAlloc" (stored as 0–1 fractions) or
  // "density" (stored as raw SF ints). Recomputes ratios when the edited tier
  // is the active one so the calculator stays in sync.
  function updateTier(tId, group, key, rawValue){
    setTIERS(prev=>{
      const next = prev.map(t=>{
        if(t.id!==tId) return t;
        if(group==="density"){
          const v = Math.max(0, parseInt(rawValue)||0);
          return {...t, [key]: v};
        }
        const v = Math.max(0, Math.min(100, parseFloat(rawValue)||0))/100;
        return {...t, [group]: {...t[group], [key]: v}};
      });
      if(tId===tierId) setRatios(computeRatios(tierId,region,next));
      return next;
    });
    if(tId===tierId && group==="density"){
      const v = Math.max(0, parseInt(rawValue)||0);
      if(key==="densityMin") setSharedDensityMin(v);
      if(key==="densityMax") setSharedDensityMax(v);
    }
  }

  function resetTiers(){
    const fresh = JSON.parse(JSON.stringify(DEFAULT_TIERS));
    setTIERS(fresh);
    setRatios(computeRatios(tierId,region,fresh));
    const t = fresh.find(x=>x.id===tierId);
    if(t){ setSharedDensityMin(t.densityMin); setSharedDensityMax(t.densityMax); }
  }

  // ── Derive per-floor RSF array from BPC inputs ─────────────────────────
  const bpcFloorRsfList = useMemo(()=>{
    if(bpcFloorMode==="building")      return Array(bpcFloors).fill(Math.round(bpcBuildingRSF/bpcFloors));
    if(bpcFloorMode==="perfloor_same") return Array(bpcFloors).fill(bpcPerFloorRSF);
    return Array.from({length:bpcFloors},(_,i)=>bpcFloorRSFs[i]??bpcPerFloorRSF);
  },[bpcFloorMode,bpcFloors,bpcBuildingRSF,bpcPerFloorRSF,bpcFloorRSFs]);

  // ── Compute effective ASF from floor selection ─────────────────────────
  const derivedAsf = useMemo(()=>{
    return asfOverride ?? bpcAsfValue;
  },[asfOverride,bpcAsfValue]);

  const effectiveAsf  = derivedAsf;
  const wsFrac        = tier?.superAlloc?.workspace ?? 0.65;
  const workspaceAsf  = inputMode==="asf" ? Math.round(effectiveAsf*wsFrac) : Math.round(pinnedSeats*((densityMin+densityMax)/2));
  const targetCapMax  = densityMin>0 ? Math.floor(workspaceAsf/densityMin) : 0;
  const targetCapMin  = densityMax>0 ? Math.floor(workspaceAsf/densityMax) : 0;
  const planRef       = inputMode==="seats" ? pinnedSeats : Math.round((targetCapMin+targetCapMax)/2);

  const results = useMemo(()=>{
    const allSp = allSpaces();
    const pass1 = allSp.map(sp=>{
      if (sp.isDeskPct||sp.isRoomType) return {...sp,count:0,spaces:0,sf:sfOver[sp.id]??sp.sf,totalSf:0,rooms:0};
      const rawR = ratios[sp.id]??0;
      let spaces = sp.fixedCount ? (fixedExcluded.has(sp.id) ? 0 : sp.fixedCount) : Math.round(planRef*rawR);
      // Seeded training rooms: guarantee at least one so small T1/T2 plans still have M&E.
      if(TRAINING_IDS.includes(sp.id) && rawR>0 && spaces<1) spaces = 1;
      const seatsPer = sp.seatsPerSpace ? (spaceSeats[sp.id] ?? sp.seatsPerSpace) : 1;
      const count  = sp.seatsPerSpace ? spaces * seatsPer : spaces;
      const sf = sfOver[sp.id]??sp.sf;
      return {...sp,spaces,count,sf,totalSf:spaces*sf,rooms:0};
    });
    // wsCap for desk calculation = number of non-desk workspace capacity spaces (not multiplied by seatsPerSpace)
    const wsCap = pass1.filter(r=>r.type==="capacity"&&!r.isDeskPct&&WORKSPACE_IDS.includes(r.groupId)).reduce((a,r)=>a+(r.spaces??r.count),0);
    const pass2 = pass1.map(sp=>{
      if (!sp.isDeskPct) return sp;
      const pct = ratios[sp.id]??0.90;
      const count = pct<1 ? Math.round((pct*wsCap)/(1-pct)) : 0;
      const sf = sfOver[sp.id]??sp.sf;
      return {...sp,count,sf,totalSf:count*sf,rooms:0};
    });
    const totalWsCap = pass2.filter(r=>r.type==="capacity"&&WORKSPACE_IDS.includes(r.groupId)).reduce((a,r)=>a+r.count,0);
    return pass2.map(sp=>{
      if (!sp.isRoomType) return sp;
      const effN = ratios[sp.id]??sp.roomRatio;
      const rooms = effN>0 ? Math.round(totalWsCap/effN) : 0;
      const seatsPer = roomSeats[sp.id]??sp.seatsPerRoom??1;
      const sf = sfOver[sp.id]??sp.sf;
      return {...sp,count:rooms*seatsPer,sf,totalSf:rooms*sf,rooms,seatsPer,effectiveN:effN};
    });
  },[planRef,ratios,sfOver,roomSeats,spaceSeats,fixedExcluded]);

  const summary = useMemo(()=>{
    // Apply seatWeight to all capacity spaces (defaults to 1.0 if not set)
    const capResults = results.filter(r=>r.type==="capacity");
    const wsCap    = capResults.filter(r=>WORKSPACE_IDS.includes(r.groupId)&&r.groupId!=="open")
                       .reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
    const openCap  = capResults.filter(r=>r.groupId==="open")
                       .reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
    const meCap    = capResults.filter(r=>r.groupId==="me")
                       .reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
    const cap    = wsCap + openCap + meCap;
    const noncap = results.filter(r=>r.type==="non-capacity").reduce((a,r)=>a+r.count,0);
    const refCap = inputMode==="seats" ? pinnedSeats : cap;
    const actualDensity = refCap>0 ? Math.round(workspaceAsf/refCap) : 0;
    return {cap,wsCap,openCap,meCap,noncap,total:cap+noncap,asfMin:cap*densityMin,asfMax:cap*densityMax,actualDensity,dStatus:densityStatus(actualDensity,densityMax,densityMin)};
  },[results,workspaceAsf,densityMin,densityMax,inputMode,pinnedSeats]);

  // ── Auto-fit ───────────────────────────────────────────────────────────
  // Solve the desk % so capacity seats land inside the target density range
  // (aims at the midpoint). Manual only — triggered by the "Auto-fit to range"
  // button — so hand-tuned counts are never silently overwritten. Only the
  // "desks" ratio is balanced; every other space stays exactly as set.
  function handleAutoFit(){
    if(workspaceAsf<=0||densityMin<=0||densityMax<=0) return;
    const allSp = allSpaces();
    const pRef  = planRef;
    const densityMid = (densityMin+densityMax)/2;
    const exactCapTarget = Math.floor(workspaceAsf/densityMid);
    // capacity seats produced for a given desk %, mirroring the summary math
    const simulateCap = (dPct)=>{
      const p1 = allSp.map(sp=>{
        if(sp.isDeskPct||sp.isRoomType) return {...sp,spaces:0,count:0};
        const rawR = ratios[sp.id]??0;
        let spaces = sp.fixedCount ? (fixedExcluded.has(sp.id)?0:sp.fixedCount) : Math.round(pRef*rawR);
        if(TRAINING_IDS.includes(sp.id) && rawR>0 && spaces<1) spaces = 1;
        const seatsPer = spaceSeats[sp.id] ?? sp.seatsPerSpace ?? 1;
        const count = sp.seatsPerSpace ? spaces*seatsPer : spaces;
        return {...sp,spaces,count};
      });
      const wsCap2 = p1.filter(r=>r.type==="capacity"&&!r.isDeskPct&&WORKSPACE_IDS.includes(r.groupId)).reduce((a,r)=>a+(r.spaces??r.count),0);
      const deskCount = dPct<1 ? Math.round((dPct*wsCap2)/(1-dPct)) : 0;
      const p2 = p1.map(sp=>sp.isDeskPct?{...sp,count:deskCount}:sp);
      const capR = p2.filter(r=>r.type==="capacity");
      const wsCapSum   = capR.filter(r=>WORKSPACE_IDS.includes(r.groupId)&&r.groupId!=="open").reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
      const openCapSum = capR.filter(r=>r.groupId==="open").reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
      const meCapSum   = capR.filter(r=>r.groupId==="me").reduce((a,r)=>a+Math.round(r.count*(r.seatWeight??1)),0);
      return wsCapSum+openCapSum+meCapSum;
    };
    // Binary search the desk % that hits exactCapTarget.
    let lo=0.50, hi=0.99;
    for(let i=0;i<60;i++){ const mid=(lo+hi)/2; if(simulateCap(mid)>exactCapTarget) hi=mid; else lo=mid; }
    const solved = parseFloat(((lo+hi)/2).toFixed(4));
    setRatios(r=>({...r,desks:solved}));
  }

  const baseRatios = useMemo(()=>computeRatios(tierId,region,TIERS),[tierId,region,TIERS]);
  const dsc = sColor(summary.dStatus);
  const iStyle = {width:"100%",padding:"8px 12px",border:`1px solid ${SF_GRAY_300}`,borderRadius:4,fontSize:14,color:SF_NAVY,fontWeight:700,boxSizing:"border-box",outline:"none",background:"#fff"};
  const selStyle = {width:"100%",padding:"9px 34px 9px 12px",border:"1px solid #ddd",borderRadius:8,background:"#fff",color:SF_NAVY,fontSize:13,fontWeight:600,appearance:"none",WebkitAppearance:"none",cursor:"pointer",outline:"none",boxSizing:"border-box"};

  const SECTIONS = [
    { superLabel:"Workspace", superColor:"#0176D3", superId:"workspace", groups:[
      {groupId:"indiv",    rowType:"space"},
      {groupId:"open",     rowType:"space"},
      {groupId:"enclosed", rowType:"room"},
      {groupId:"wpspec",   rowType:"space"},
    ]},
    { superLabel:"Amenity", superColor:"#9C27B0", superId:"amenity", groups:[
      {groupId:"me",          rowType:"space"},
      {groupId:"specialty",   rowType:"space"},
      {groupId:"hospitality", rowType:"space"},
    ]},
    { superLabel:"Support", superColor:"#90A4AE", superId:"support", groups:[
      {groupId:"support", rowType:"space"},
    ]},
  ];

  return (
    <div style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",background:"#f3f3f3",minHeight:"100vh"}}>
      <style>{`@media print{.no-print{display:none!important}.print-only{display:block!important}body{background:#fff}}`}</style>
      {/* Header */}
      <div className="no-print" style={{background:SF_NAVY,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,30,0.25)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"16px 24px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,minHeight:56}}>
          {/* Logo + title */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:32,height:32,background:SF_BLUE,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {/* Office tower with window grid */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Salesforce Workplace Design">
                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"/>
                <path d="M3 21h18" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
                <rect x="9" y="6" width="2" height="2" rx="0.4" fill="#fff"/>
                <rect x="13" y="6" width="2" height="2" rx="0.4" fill="#fff"/>
                <rect x="9" y="10" width="2" height="2" rx="0.4" fill="#fff"/>
                <rect x="13" y="10" width="2" height="2" rx="0.4" fill="#fff"/>
                <rect x="9" y="14" width="2" height="2" rx="0.4" fill="#fff"/>
                <rect x="13" y="14" width="2" height="2" rx="0.4" fill="#fff"/>
                <path d="M11 21v-3h2v3" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:15,letterSpacing:"0.14em",color:SF_CLOUD,fontWeight:600,textTransform:"uppercase",lineHeight:1.1}}>Salesforce Workplace Design</div>
              <div style={{fontSize:16,fontWeight:700,color:"#fff",lineHeight:1.2,marginTop:2}}>Space Planning Calculator</div>
            </div>
            {city&&<div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginLeft:8,paddingLeft:12,borderLeft:"1px solid rgba(255,255,255,0.2)"}}>{city}</div>}
          </div>
          {/* Right actions */}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>setShowScenarios(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.08)",cursor:"pointer",fontSize:12,fontWeight:600,color:"#fff"}}>
              📂 Scenarios
            </button>
            <button onClick={()=>window.print()} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:9999,border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.08)",cursor:"pointer",fontSize:12,fontWeight:600,color:"#fff"}}>
              🖨️ Print
            </button>
          </div>
        </div>
        {/* Tab navigation */}
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 24px",display:"flex",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          {[["program","Building Program"],["calc","Calculator"],["results","Results"],["comparison","Comparison"],["tiers","Tiers & Regions"],["bu","Business Units"],["db","Space Types"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{background:"none",border:"none",color:tab===id?"#fff":"rgba(255,255,255,0.55)",padding:"10px 16px",cursor:"pointer",fontSize:13,borderBottom:tab===id?`2px solid ${SF_BLUE}`:"2px solid transparent",fontWeight:tab===id?700:400,letterSpacing:tab===id?"0.01em":"normal",transition:"color 0.15s"}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 24px",background:SF_GRAY_100}}>

        {/* Print-only header */}
        <div className="print-only" style={{display:"none",marginBottom:20}}>
          <div style={{fontSize:10,letterSpacing:"0.2em",color:SF_BLUE}}>SALESFORCE WORKPLACE DESIGN — SPACE PLANNING CALCULATOR</div>
          {city && <div style={{fontSize:16,fontWeight:700,color:SF_NAVY,marginTop:4}}>{city}</div>}
          <div style={{fontSize:12,color:"#888",marginTop:2}}>Generated {new Date().toLocaleDateString()}</div>
        </div>

        {/* Stat cards — visible on all tabs except Building Program */}
        {tab!=="program" && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          <StatCard label="Capacity Seats" value={summary.cap.toLocaleString()} accent="#70BF75" sub={<>Target: <span style={{color:dsc,fontWeight:700}}>{targetCapMin}–{targetCapMax}</span></>}/>
          <StatCard label="Total Seats" value={summary.total.toLocaleString()} accent="#7B68EE" sub="Cap + Non-Cap"/>
          <StatCard label="SF / Cap Seat" value={summary.actualDensity||"—"} accent={dsc} sub={<span style={{color:dsc}}>{sLabel(summary.dStatus)}</span>}/>
          <StatCard label="Total ASF" value={effectiveAsf>=1000?`${(effectiveAsf/1000).toFixed(0)}k`:effectiveAsf} accent="#F4A460" sub={`Workspace: ${workspaceAsf>=1000?(workspaceAsf/1000).toFixed(0)+"k":workspaceAsf} SF`}/>
        </div>
        )}
        {tab==="calc" && (
          <div style={{display:"grid",gridTemplateColumns:"275px 1fr",gap:16,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Panel title="Configuration">
                <Field label="City / Location"><input type="text" value={city} placeholder="e.g. San Francisco, CA" onChange={e=>setCity(e.target.value)} style={{...iStyle,fontWeight:400}}/></Field>
                <Field label="Region">
                  <div style={{position:"relative"}}>
                    <select value={region} onChange={e=>changeRegion(e.target.value)} style={selStyle}>{REGIONS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select>
                    <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#999",fontSize:12}}>▾</span>
                  </div>
                </Field>
                <Field label="Office Tier">
                  <div style={{position:"relative"}}>
                    <select value={tierId} onChange={e=>changeTier(e.target.value)} style={selStyle}>{TIERS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select>
                    <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#999",fontSize:12}}>▾</span>
                  </div>
                  {tier&&<div style={{fontSize:11,color:SF_SUBTLE,marginTop:5}}>{tier.description}</div>}
                </Field>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:"#666",marginBottom:6}}>Workspace Density Range</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {[["Min",sharedDensityMin,setSharedDensityMin],["Max",sharedDensityMax,setSharedDensityMax]].map(([lbl,val,setter])=>(
                      <div key={lbl} style={{flex:1}}>
                        <div style={{fontSize:10,color:SF_SUBTLE,marginBottom:3}}>{lbl} SF/seat</div>
                        <input type="number" min={1} value={val}
                          onChange={e=>setter(parseInt(e.target.value)||1)}
                          style={{width:"100%",padding:"7px 10px",border:"1px solid #ddd",borderRadius:7,fontSize:13,fontWeight:700,color:SF_NAVY,outline:"none",background:"#fff",boxSizing:"border-box",fontVariantNumeric:"tabular-nums"}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:SF_SUBTLE,marginTop:5}}>
                    Midpoint: <strong style={{color:SF_NAVY}}>{Math.round((densityMin+densityMax)/2)} SF/seat</strong>
                    {tier&&(sharedDensityMin!==tier.densityMin||sharedDensityMax!==tier.densityMax)&&<button onClick={()=>{setSharedDensityMin(tier.densityMin);setSharedDensityMax(tier.densityMax);}} style={{marginLeft:8,background:"#e8f4fd",border:"none",cursor:"pointer",color:SF_BLUE,fontSize:10,padding:"1px 7px",borderRadius:4,fontWeight:600}}>reset</button>}
                  </div>
                </div>
                {tier&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
                    <div style={{fontSize:10,letterSpacing:"0.1em",color:SF_LABEL,textTransform:"uppercase",marginBottom:10}}>Allocation</div>
                    {SUPER_GROUPS.map(sg=>{
                      const pct = Math.round((tier.superAlloc[sg.id]??0)*100);
                      return (
                        <div key={sg.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,fontSize:11}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:sg.color,flexShrink:0}}/>
                          <span style={{flex:1,color:"#444",fontWeight:600}}>{sg.label}</span>
                          <span style={{color:SF_NAVY,fontWeight:700,width:26,textAlign:"right",flexShrink:0}}>{pct}%</span>
                          <div style={{width:50,height:5,background:"#eee",borderRadius:3,overflow:"hidden",flexShrink:0}}>
                            <div style={{width:`${pct}%`,height:"100%",background:sg.color,borderRadius:3}}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel title="Floor Selection">
                {/* Synced ASF field — shared with Building Program */}
                <Field label="Assignable SF (ASF)">
                  <input type="number" min={0} step={500}
                    value={bpcAsfValue}
                    onChange={e=>{ setBpcAsfValue(Number(e.target.value)); setAsfOverride(null); }}
                    style={iStyle}/>
                  <div style={{fontSize:11,color:SF_SUBTLE,marginTop:4}}>Synced with Building Program tab</div>
                </Field>

                {/* Enter seats instead */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:"#666",marginBottom:6}}>Or enter by seats</div>
                  <div style={{display:"flex",background:"#f0f0f0",borderRadius:8,padding:3,gap:3}}>
                    {[["asf","Use ASF"],["seats","Enter Seats"]].map(([m,l])=>(
                      <button key={m} onClick={()=>setInputMode(m)} style={{flex:1,padding:"7px 12px",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,color:inputMode===m?SF_NAVY:"#888",background:inputMode===m?"#fff":"transparent",boxShadow:inputMode===m?"0 1px 3px rgba(0,0,0,0.12)":"none"}}>{l}</button>
                    ))}
                  </div>
                </div>
                {inputMode==="seats" && (
                  <Field label="Capacity Seats (target)">
                    <input type="number" value={pinnedSeats} min={1} max={10000} step={1} onChange={e=>setPinnedSeats(parseInt(e.target.value)||0)} style={iStyle}/>
                    <div style={{fontSize:11,color:SF_SUBTLE,marginTop:5}}>Implied: <strong>{(pinnedSeats*densityMin).toLocaleString()}–{(pinnedSeats*densityMax).toLocaleString()} SF</strong></div>
                  </Field>
                )}

                <div style={{background:"#f0f8ff",border:"1px solid #0176D322",borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                  <div style={{fontSize:10,letterSpacing:"0.1em",color:SF_BLUE,textTransform:"uppercase",fontWeight:700,marginBottom:8}}>Workspace SF ({Math.round(wsFrac*100)}% of total)</div>
                  <CalcRow label="Workspace ASF" value={`${workspaceAsf.toLocaleString()} SF`} bold accent={SF_BLUE}/>
                  <CalcRow label={`÷ ${densityMax} SF/seat`} value={`${targetCapMin} seats`}/>
                  <CalcRow label={`÷ ${densityMin} SF/seat`} value={`${targetCapMax} seats`}/>
                  <CalcRow label="Cap seat target" value={`${targetCapMin}–${targetCapMax}`} bold accent={SF_BLUE}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",borderRadius:8,border:"1px solid",background:`${dsc}12`,borderColor:`${dsc}44`}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:dsc,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:dsc}}>{summary.actualDensity?`${summary.actualDensity} SF / cap seat`:"No capacity seats yet"}</div>
                    <div style={{fontSize:11,color:"#666"}}>{sLabel(summary.dStatus)} · Target {densityMin}–{densityMax} SF/seat</div>
                  </div>
                </div>
                {summary.cap>0 && summary.dStatus!=="ok" && (
                  <button onClick={handleAutoFit}
                    style={{marginTop:8,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px 14px",borderRadius:8,border:"none",background:SF_BLUE,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,boxShadow:"0 2px 8px rgba(1,118,211,0.35)"}}>
                    ⇅ Auto-fit desks to range
                  </button>
                )}
              </Panel>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* Seat summary bar */}
              <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"14px 20px",display:"flex",alignItems:"flex-start",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <SeatStat label="Capacity Seats" value={summary.cap} color="#70BF75" sub={(()=>{
                  const parts = [];
                  if(summary.wsCap>0)   parts.push(`${summary.wsCap} ws`);
                  if(summary.openCap>0) parts.push(`${summary.openCap} open`);
                  if(summary.meCap>0)   parts.push(`${summary.meCap} M&E (×0.75)`);
                  return parts.length>0 ? parts.join(" + ") : `Target ${targetCapMin}–${targetCapMax}`;
                })()} subColor={dsc}/>
                <div style={{width:1,background:"#e0e0e0",alignSelf:"stretch",margin:"0 12px"}}/>
                <SeatStat label="Non-Capacity" value={summary.noncap} color="#7B68EE"/>
                <div style={{width:1,background:"#e0e0e0",alignSelf:"stretch",margin:"0 12px"}}/>
                <SeatStat label="Total Seats" value={summary.total} color={SF_NAVY} bold/>
                <div style={{width:1,background:"#e0e0e0",alignSelf:"stretch",margin:"0 12px"}}/>
                <SeatStat label="SF / Cap Seat" value={summary.actualDensity?`${summary.actualDensity} SF`:"—"} color={dsc} sub={sLabel(summary.dStatus)} subColor={dsc}/>
                <div style={{width:1,background:"#e0e0e0",alignSelf:"stretch",margin:"0 12px"}}/>
                <SeatStat label="Workspace ASF" value={workspaceAsf>=1000?`${(workspaceAsf/1000).toFixed(0)}k`:workspaceAsf} color="#F4A460" sub={`${Math.round(wsFrac*100)}% of total`}/>
              </div>

              {summary.cap>0&&(
                <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"12px 18px"}}>
                  <div style={{fontSize:11,color:"#888",marginBottom:6}}>Density gauge (workspace SF) — target {densityMin}–{densityMax} SF/cap seat</div>
                  <div style={{position:"relative",height:10,background:"#f0f0f0",borderRadius:5}}>
                    <div style={{position:"absolute",left:`${Math.min((densityMin/200)*100,100)}%`,width:`${Math.min(((densityMax-densityMin)/200)*100,100)}%`,height:"100%",background:`${GREEN}33`,borderRadius:3}}/>
                    <div style={{position:"absolute",left:`${Math.min((summary.actualDensity/200)*100,99)}%`,top:"-3px",width:3,height:"calc(100% + 6px)",background:dsc,borderRadius:2}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:SF_SUBTLE,marginTop:4}}>
                    <span>0</span><span style={{color:dsc,fontWeight:700}}>{summary.actualDensity} SF/seat</span><span>200</span>
                  </div>
                </div>
              )}

              {SECTIONS.map(({superLabel,superColor,superId,groups})=>(
                <div key={superId}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingLeft:4}}>
                    <div style={{width:4,height:18,background:superColor,borderRadius:2}}/>
                    <span style={{fontSize:11,fontWeight:700,color:superColor,letterSpacing:"0.1em",textTransform:"uppercase"}}>{superLabel}</span>
                    <div style={{flex:1,height:1,background:`${superColor}30`}}/>
                    {tier&&<span style={{fontSize:11,color:SF_SUBTLE}}>{Math.round((tier.superAlloc[superId]??0)*100)}% of total ASF</span>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {groups.map(({groupId,rowType})=>{
                      const g   = SPACE_GROUPS.find(x=>x.id===groupId);
                      const gR      = results.filter(r=>r.groupId===groupId);
                      const gSpaces = gR.reduce((a,r)=>a+(r.rooms>0?r.rooms:r.count>0?1:0),0);
                      const gCap    = gR.filter(r=>r.type==="capacity").reduce((a,r)=>a+r.count,0);
                      const gNonCap = gR.filter(r=>r.type==="non-capacity").reduce((a,r)=>a+r.count,0);
                      const gRooms  = gR.reduce((a,r)=>a+(r.rooms??0),0);
                      const gTotalSeats = gCap + gNonCap;
                      const gTotalSpaces = rowType==="room" ? gRooms : gR.filter(r=>r.count>0).length;
                      const isCollapsed = !!collapsedGroups[groupId];
                      return (
                        <div key={groupId} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                          <div onClick={()=>toggleGroup(groupId)} style={{padding:"11px 20px",borderBottom:isCollapsed?"none":"1px solid #e0e0e0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafafa",cursor:"pointer",userSelect:"none"}}
                            onMouseEnter={e=>e.currentTarget.style.background="#f0f0f0"}
                            onMouseLeave={e=>e.currentTarget.style.background="#fafafa"}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:10,height:10,borderRadius:"50%",background:g.color}}/>
                              <span style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:16,color:SF_NAVY}}>{g.label}</span>
                            </div>
                            <div style={{display:"flex",gap:10,alignItems:"center",fontSize:11,color:"#888"}}>
                              {isCollapsed
                                ? <span style={{color:SF_LABEL,fontStyle:"italic"}}>hidden</span>
                                : <><span><b style={{color:g.color}}>{gTotalSpaces}</b> spaces</span><span><b style={{color:SF_NAVY}}>{gTotalSeats}</b> seats</span></>
                              }
                              {rowType==="room" && !isCollapsed && (
                                <button onClick={e=>{e.stopPropagation();toggleRoomLock();}}
                                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:9999,
                                    border:`1px solid ${lockedRooms?"#DDDBDA":"#e6a817"}`,
                                    background:lockedRooms?"#fff":"#fef9e7",
                                    color:lockedRooms?"#3E3E3C":"#b45309",
                                    cursor:"pointer",fontSize:11,fontWeight:600,boxShadow:"0 1px 2px rgba(0,0,0,0.08)"}}>
                                  {lockedRooms ? "🔒 Locked" : "🔓 Unlocked"}
                                </button>
                              )}
                              <span style={{fontSize:14,color:SF_LABEL,lineHeight:1}}>{isCollapsed?"▸":"▾"}</span>
                            </div>
                          </div>
                          {!isCollapsed && <>
                          {/* Column header row — consistent across room and space types */}
                          <div style={{display:"flex",alignItems:"center",padding:"4px 20px",background:"#f7f7f7",borderBottom:"1px solid #eee",fontSize:9,letterSpacing:"0.08em",color:SF_LABEL,textTransform:"uppercase"}}>
                            <span style={{flex:1}}>Space Type</span>
                            <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
                              {rowType==="room"
                                ? <span style={{width:60,textAlign:"center"}}>Seats/Rm</span>
                                : <span style={{width:COL.ratio+COL.pct+10,textAlign:"center"}}>Ratio / %</span>
                              }
                              <span style={{width:COL.ratio,textAlign:"center"}}>{rowType==="room"?"Ratio":""}</span>
                              <span style={{width:COL.spaces,textAlign:"center"}}>Spaces</span>
                              <span style={{width:COL.seats,textAlign:"center"}}>Seats</span>
                            </div>
                          </div>
                          {g.spaces.map(sp=>
                            rowType==="room"
                              ? <RoomRow key={sp.id} sp={sp} results={results} ratios={ratios} setRatios={setRatios} roomSeats={roomSeats} setRoomSeats={setRoomSeats} locked={lockedRooms} baseRatios={baseRatios}/>
                              : <SpaceRow key={sp.id} sp={sp} results={results} ratios={ratios} baseRatios={baseRatios} setRatios={setRatios} spaceSeats={spaceSeats} setSpaceSeats={setSpaceSeats} fixedExcluded={fixedExcluded} toggleFixed={toggleFixed} capShareDenom={summary.wsCap+summary.openCap}/>
                          )}
                          </>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab==="results" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
              {[["Capacity Seats",summary.cap.toLocaleString(),"#70BF75",`Target ${targetCapMin}–${targetCapMax}`,dsc],["Non-Capacity",summary.noncap.toLocaleString(),"#7B68EE","Rooms, amenity, support",SF_SUBTLE],["Total Seats",summary.total.toLocaleString(),SF_NAVY,"Cap + Non-Cap",SF_SUBTLE],["SF / Cap Seat",summary.actualDensity?`${summary.actualDensity} SF`:"—",dsc,sLabel(summary.dStatus),dsc]].map(([l,v,a,sub,sc])=>(
                <div key={l} style={{background:"#fff",border:`1px solid ${a}44`,borderRadius:12,padding:"16px 20px"}}>
                  <div style={{fontSize:12,letterSpacing:"0.08em",color:a,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>{l}</div>
                  <div style={{fontSize:28,fontWeight:700,fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",color:SF_NAVY}}>{v}</div>
                  <div style={{fontSize:11,color:sc??SF_SUBTLE,fontWeight:600,marginTop:6}}>{sub}</div>
                </div>
              ))}
            </div>
            {SUPER_GROUPS.map(sg=>{
              const sgGroups = SPACE_GROUPS.filter(g=>g.superGroup===sg.id);
              const sgRows = results.filter(r=>sgGroups.some(g=>g.id===r.groupId)&&r.count>0);
              if (!sgRows.length) return null;
              return (
                <div key={sg.id}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:4,height:18,background:sg.color,borderRadius:2}}/>
                    <span style={{fontSize:13,fontWeight:700,color:sg.color,textTransform:"uppercase",letterSpacing:"0.08em"}}>{sg.label}</span>
                    {tier&&<span style={{fontSize:12,color:SF_SUBTLE}}>— {Math.round((tier.superAlloc[sg.id]??0)*100)}% of total ASF</span>}
                  </div>
                  {sgGroups.map(g=>{
                    const gr = results.filter(r=>r.groupId===g.id&&r.count>0);
                    if (!gr.length) return null;
                    return (
                      <div key={g.id} style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden",marginBottom:8}}>
                        <div style={{padding:"10px 20px",borderBottom:"1px solid #e0e0e0",display:"flex",justifyContent:"space-between",background:"#fafafa"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:4,height:20,background:g.color,borderRadius:2}}/>
                            <span style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:15,color:SF_NAVY}}>{g.label}</span>
                          </div>
                          <div style={{display:"flex",gap:12,fontSize:12,color:"#888"}}>
                            {gr.filter(r=>r.type==="capacity").reduce((a,r)=>a+r.count,0)>0&&<span><b style={{color:"#70BF75"}}>{gr.filter(r=>r.type==="capacity").reduce((a,r)=>a+r.count,0)}</b> cap</span>}
                            {gr.filter(r=>r.type==="non-capacity").reduce((a,r)=>a+r.count,0)>0&&<span><b style={{color:"#7B68EE"}}>{gr.filter(r=>r.type==="non-capacity").reduce((a,r)=>a+r.count,0)}</b> non-cap</span>}
                            {gr.reduce((a,r)=>a+(r.rooms??0),0)>0&&<span><b style={{color:SF_NAVY}}>{gr.reduce((a,r)=>a+(r.rooms??0),0)}</b> rooms</span>}
                            <span style={{color:SF_SUBTLE}}>{gr.reduce((a,r)=>a+r.totalSf,0).toLocaleString()} SF</span>
                          </div>
                        </div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead><tr>
                            {["Space Type","Type","Count","SF/Unit","Total SF"].map(h=>(
                              <th key={h} style={{padding:"7px 12px",textAlign:h==="Space Type"?"left":"right",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>{h}</th>
                            ))}
                            {gr.some(r=>r.isRoomType)&&<><th style={{padding:"7px 12px",textAlign:"center",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>Ratio</th><th style={{padding:"7px 12px",textAlign:"right",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>Rooms</th></>}
                          </tr></thead>
                          <tbody>
                            {gr.map((r,i)=>(
                              <tr key={r.id} style={{borderBottom:"1px solid #f5f5f5",background:i%2===0?"#fff":"#fafafa"}}>
                                <td style={{padding:"7px 12px"}}>{r.label}</td>
                                <td style={{padding:"7px 12px",textAlign:"right"}}><span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,background:r.type==="capacity"?"#70BF7522":r.type==="non-capacity"?"#7B68EE22":"#f0f0f0",color:r.type==="capacity"?"#70BF75":r.type==="non-capacity"?"#7B68EE":"#aaa"}}>{r.type==="capacity"?"Cap":r.type==="non-capacity"?"Non-Cap":"—"}</span></td>
                                <td style={{padding:"7px 12px",textAlign:"right",fontWeight:700,color:SF_NAVY}}>{r.count}</td>
                                <td style={{padding:"7px 12px",textAlign:"right"}}>
                                  <input type="number" value={sfOver[r.id]??r.sf} onChange={e=>setSfOver(o=>({...o,[r.id]:parseInt(e.target.value)||0}))} style={{background:"#f7f7f7",border:"1px solid #ddd",borderRadius:4,color:"#333",padding:"2px 6px",width:56,textAlign:"right",fontSize:12}}/>
                                </td>
                                <td style={{padding:"7px 12px",textAlign:"right"}}>{r.totalSf.toLocaleString()}</td>
                                {r.isRoomType&&<><td style={{padding:"7px 12px",textAlign:"center",color:"#7B68EE",fontWeight:700}}>1:{r.effectiveN}</td><td style={{padding:"7px 12px",textAlign:"right",color:"#7B68EE",fontWeight:700}}>{r.rooms}</td></>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ── BUILDING PROGRAM ── */}
        {tab==="program" && (()=>{
          // Derived BPC values (uses shared tier/region from main app)
          const bpcTierAlloc = BPC_TIER_ALLOC[tierId] ?? BPC_TIER_ALLOC.T1;
          const hasAmenity   = bpcTierAlloc.amenity > 0;
          const bpcFloorTotal = bpcFloorRsfList.reduce((a,b)=>a+b,0);
          const bpcBaseSF    = bpcSfBase==="asf" ? bpcAsfValue : bpcFloorTotal;
          const bpcInfoLabel = bpcSfBase==="asf" ? "RSF (informational)" : "ASF (informational)";
          const bpcRes = bpcCalc({baseSF:bpcBaseSF,tierAlloc:bpcTierAlloc,amenitySeats:bpcAmenitySeats,densityMin:sharedDensityMin,densityMax:sharedDensityMax});
          const iStyle2 = {width:"100%",padding:"9px 12px",border:"1px solid #ddd",borderRadius:8,fontSize:14,fontWeight:600,color:SF_NAVY,outline:"none",background:"#fff",boxSizing:"border-box"};
          const labelStyle = {fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:"0.07em",textTransform:"uppercase",display:"block",marginBottom:6};
          return (
            <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"start"}}>

              {/* LEFT — Config */}
              <div style={{flex:"0 0 300px",minWidth:260,display:"flex",flexDirection:"column",gap:12}}>
                <div style={{background:"#fff",border:`1px solid ${SF_GRAY_300}`,borderRadius:8,padding:"20px",boxShadow:"0 1px 3px rgba(0,0,30,0.08)"}}>
                  <div style={{fontSize:12,fontWeight:800,color:SF_NAVY,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:16,paddingBottom:12,borderBottom:"1px solid #eee"}}>
                    Configuration
                  </div>

                  {/* Region selector */}
                  <div style={{marginBottom:16}}>
                    <label style={labelStyle}>Region</label>
                    <select value={region} onChange={e=>changeRegion(e.target.value)} style={{...iStyle2}}>
                      {REGIONS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>

                  {/* Tier selector */}
                  <div style={{marginBottom:16}}>
                    <label style={labelStyle}>Office Tier</label>
                    <select value={tierId} onChange={e=>changeTier(e.target.value)} style={{...iStyle2}}>
                      {TIERS.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Density range */}
                  <div style={{marginBottom:16}}>
                    <label style={labelStyle}>Workspace Density Range</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["Min",sharedDensityMin,setSharedDensityMin],["Max",sharedDensityMax,setSharedDensityMax]].map(([lbl,val,setter])=>(
                        <div key={lbl} style={{flex:1}}>
                          <div style={{fontSize:10,color:"#888",marginBottom:3}}>{lbl}</div>
                          <div style={{display:"flex",border:"1px solid #ddd",borderRadius:7,overflow:"hidden"}}>
                            <input type="number" min={1} value={val} onChange={e=>setter(Number(e.target.value))} style={{flex:1,padding:"8px 8px",border:"none",outline:"none",fontSize:13,fontWeight:600,color:SF_NAVY,background:"transparent",minWidth:0,width:0,fontVariantNumeric:"tabular-nums"}}/>
                            <span style={{padding:"0 8px",fontSize:11,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>SF</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:"#888",marginTop:6}}>Midpoint: <strong style={{color:SF_NAVY}}>{Math.round((sharedDensityMin+sharedDensityMax)/2)} SF/seat</strong></div>
                  </div>

                  <div style={{borderTop:"1px solid #eee",margin:"12px 0"}}/>

                  <div style={{marginBottom:4}}>
                    <span style={{fontSize:10,fontWeight:700,color:SF_BLUE,letterSpacing:"0.07em",textTransform:"uppercase",display:"block",marginBottom:6}}>Building Setup</span>
                    <div style={{fontSize:11,color:"#888",marginBottom:12}}>Floor data feeds the Calculator tab</div>

                    {/* ASF input */}
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <label style={labelStyle}>Assignable SF (ASF)</label>
                        <button onClick={()=>setBpcSfBase("asf")} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"none",cursor:"pointer",background:bpcSfBase==="asf"?"#0176D3":"#eee",color:bpcSfBase==="asf"?"#fff":"#aaa"}}>
                          {bpcSfBase==="asf"?"BASE ✓":"Set as base"}
                        </button>
                      </div>
                      <div style={{display:"flex",border:`1.5px solid ${bpcSfBase==="asf"?SF_BLUE:"#ddd"}`,borderRadius:8,overflow:"hidden",boxShadow:bpcSfBase==="asf"?`0 0 0 3px ${SF_BLUE}18`:"none"}}>
                        <input type="number" min={0} value={bpcAsfValue} onChange={e=>setBpcAsfValue(Number(e.target.value))} style={{flex:1,padding:"9px 12px",border:"none",outline:"none",fontSize:14,fontWeight:600,color:SF_NAVY,background:"transparent",fontVariantNumeric:"tabular-nums"}}/>
                        <span style={{padding:"0 12px",fontSize:12,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>SF</span>
                      </div>
                    </div>

                    {/* RSF input */}
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <label style={labelStyle}>Rentable SF (RSF)</label>
                        <button onClick={()=>setBpcSfBase("rsf")} style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,border:"none",cursor:"pointer",background:bpcSfBase==="rsf"?"#0176D3":"#eee",color:bpcSfBase==="rsf"?"#fff":"#aaa"}}>
                          {bpcSfBase==="rsf"?"BASE ✓":"Set as base"}
                        </button>
                      </div>
                      <div style={{display:"flex",border:`1.5px solid ${bpcSfBase==="rsf"?SF_BLUE:"#ddd"}`,borderRadius:8,overflow:"hidden",boxShadow:bpcSfBase==="rsf"?`0 0 0 3px ${SF_BLUE}18`:"none"}}>
                        <input type="number" min={0} value={bpcBuildingRSF} onChange={e=>setBpcBuildingRSF(Number(e.target.value))} style={{flex:1,padding:"9px 12px",border:"none",outline:"none",fontSize:14,fontWeight:600,color:SF_NAVY,background:"transparent",fontVariantNumeric:"tabular-nums"}}/>
                        <span style={{padding:"0 12px",fontSize:12,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>SF</span>
                      </div>
                    </div>

                    {/* Number of floors */}
                    <div style={{marginBottom:12}}>
                      <span style={labelStyle}>Number of Floors</span>
                      <select value={bpcFloors} onChange={e=>syncBpcFloors(Number(e.target.value))} style={{...iStyle2}}>
                        {Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1} Floor{i>0?"s":""}</option>)}
                      </select>
                    </div>

                    {/* Floor breakdown (per floor same / varied) — only if >1 floor */}
                    {bpcFloors>1 && (
                    <div style={{marginBottom:12}}>
                      <span style={labelStyle}>Floor Breakdown</span>
                      <div style={{display:"flex",border:"1px solid #ddd",borderRadius:7,overflow:"hidden",marginBottom:10}}>
                        {BPC_FLOOR_MODES.filter(o=>o.id!=="building").map(o=>(
                          <button key={o.id} onClick={()=>setBpcFloorMode(o.id)} style={{flex:1,padding:"7px 4px",fontSize:10,fontWeight:600,cursor:"pointer",border:"none",background:bpcFloorMode===o.id?SF_BLUE:"#fff",color:bpcFloorMode===o.id?"#fff":"#888",lineHeight:1.3,textAlign:"center"}}>{o.label}</button>
                        ))}
                      </div>

                      {bpcFloorMode==="perfloor_same" && (
                        <div>
                          <label style={{...labelStyle,color:SF_BLUE}}>{bpcSfBase==="asf"?"ASF":"RSF"} Per Floor</label>
                          <div style={{display:"flex",border:`1.5px solid ${SF_BLUE}`,borderRadius:8,overflow:"hidden",boxShadow:`0 0 0 3px ${SF_BLUE}18`}}>
                            <input type="number" min={0} value={bpcPerFloorRSF} onChange={e=>setBpcPerFloorRSF(Number(e.target.value))} style={{flex:1,padding:"9px 12px",border:"none",outline:"none",fontSize:14,fontWeight:600,color:SF_NAVY,background:"transparent"}}/>
                            <span style={{padding:"0 12px",fontSize:12,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>SF</span>
                          </div>
                          <div style={{fontSize:11,color:SF_SUBTLE,marginTop:4}}>Total: {(bpcPerFloorRSF*bpcFloors).toLocaleString()} SF</div>
                        </div>
                      )}

                      {bpcFloorMode==="perfloor_mixed" && (
                        <div>
                          <label style={{...labelStyle,color:SF_BLUE}}>{bpcSfBase==="asf"?"ASF":"RSF"} Per Floor</label>
                          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
                            {Array.from({length:bpcFloors},(_,i)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontSize:11,fontWeight:700,color:SF_BLUE,width:52,flexShrink:0}}>Floor {i+1}</span>
                                <div style={{display:"flex",flex:1,border:`1.5px solid ${SF_BLUE}`,borderRadius:6,overflow:"hidden"}}>
                                  <input type="number" min={0} value={bpcFloorRSFs[i]??10000} onChange={e=>updateBpcFloorRSF(i,Number(e.target.value))} style={{flex:1,padding:"6px 10px",border:"none",outline:"none",fontSize:13,fontWeight:600,color:SF_NAVY,background:"transparent"}}/>
                                  <span style={{padding:"0 8px",fontSize:11,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>SF</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{fontSize:11,color:SF_SUBTLE,marginTop:6}}>Total: {bpcFloorRsfList.reduce((a,b)=>a+b,0).toLocaleString()} SF</div>
                        </div>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Amenity seats */}
                  <div style={{borderTop:"1px solid #eee",paddingTop:14,marginTop:4}}>
                    <div style={{marginBottom:12}}>
                      <label style={labelStyle}>Amenity Seats (manual)</label>
                      <div style={{display:"flex",border:"1px solid #ddd",borderRadius:8,overflow:"hidden"}}>
                        <input type="number" min={0} value={bpcAmenitySeats} onChange={e=>setBpcAmenitySeats(Number(e.target.value))} style={{flex:1,padding:"9px 12px",border:"none",outline:"none",fontSize:14,fontWeight:600,color:SF_NAVY,background:"transparent"}}/>
                        <span style={{padding:"0 12px",fontSize:12,color:"#888",borderLeft:"1px solid #ddd",display:"flex",alignItems:"center",background:"#fafafa"}}>seats</span>
                      </div>
                      <div style={{fontSize:11,color:"#888",marginTop:5}}>{Math.round(bpcAmenitySeats*BPC_AMENITY_CAP_FACTOR)} count toward capacity ({Math.round(BPC_AMENITY_CAP_FACTOR*100)}% factor)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT — Results */}
              <div style={{flex:1,minWidth:300,display:"flex",flexDirection:"column",gap:16}}>

                {/* KPI cards */}
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {[
                    ["Capacity Seats", bpcRes.capSeats.toLocaleString(), `${bpcRes.wsCapSeats} workspace + ${bpcRes.amenityCapSeats} amenity`, SF_BLUE],
                    [bpcSfBase==="asf"?"Assignable SF":"Rentable SF", bpcBaseSF.toLocaleString(), `Total RSF: ${bpcFloorRsfList.reduce((a,b)=>a+b,0).toLocaleString()} SF`, SF_NAVY],
                  ].map(([label,value,sub,accent])=>(
                    <div key={label} style={{background:"#fff",border:`1px solid ${SF_GRAY_300}`,borderTop:`3px solid ${accent}`,borderRadius:8,padding:"18px 22px",boxShadow:"0 1px 3px rgba(0,0,30,0.07)",flex:1,minWidth:160}}>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"#6B7280",textTransform:"uppercase",marginBottom:6}}>{label}</div>
                      <div style={{fontSize:30,fontWeight:800,color:SF_NAVY,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
                      <div style={{fontSize:12,color:"#6B7280",marginTop:6}}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Group breakdown */}
                <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"22px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                  <div style={{fontSize:12,fontWeight:800,color:SF_NAVY,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4}}>Space Group Breakdown</div>
                  <div style={{fontSize:11,color:"#888",marginBottom:16}}>% of {bpcSfBase.toUpperCase()} · total = {bpcBaseSF.toLocaleString()} SF</div>
                  <BpcGroupBar label="Workspace" sf={bpcRes.wsSF}  pct={bpcTierAlloc.workspace} color="#078744"  baseSF={bpcBaseSF}/>
                  {hasAmenity && <BpcGroupBar label="Amenity" sf={bpcRes.amSF} pct={bpcTierAlloc.amenity} color="#ff8000" baseSF={bpcBaseSF}/>}
                  <BpcGroupBar label="Support"   sf={bpcRes.supSF} pct={bpcTierAlloc.support}   color="#94A3B8"  baseSF={bpcBaseSF}/>
                  <div style={{borderTop:"1px solid #eee",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,color:SF_NAVY}}>
                    <span>Total</span>
                    <span>{(bpcRes.wsSF+bpcRes.amSF+bpcRes.supSF).toLocaleString()} SF</span>
                  </div>
                </div>

                {/* Summary table */}
                <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                  <div style={{fontSize:12,fontWeight:800,color:SF_NAVY,letterSpacing:"0.06em",textTransform:"uppercase",padding:"14px 22px",borderBottom:"1px solid #eee",background:"#fafafa"}}>
                    Summary
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <tbody>
                      {[
                        [bpcSfBase==="asf"?"Assignable SF (base)":"Rentable SF (base)", `${bpcBaseSF.toLocaleString()} SF`, false, true],
                        ["Total Building RSF", `${bpcFloorRsfList.reduce((a,b)=>a+b,0).toLocaleString()} SF`, false, false],
                        ["Workspace SF", `${bpcRes.wsSF.toLocaleString()} SF (${Math.round(bpcTierAlloc.workspace*100)}% of ${bpcSfBase.toUpperCase()})`, false, false],
                        ...(hasAmenity?[["Amenity SF", `${bpcRes.amSF.toLocaleString()} SF (${Math.round(bpcTierAlloc.amenity*100)}% of ${bpcSfBase.toUpperCase()})`, false, false]]:[]),
                        ["Support SF", `${bpcRes.supSF.toLocaleString()} SF (${Math.round(bpcTierAlloc.support*100)}% of ${bpcSfBase.toUpperCase()})`, false, false],
                        ["Workspace Cap Seats", bpcRes.wsCapSeats.toLocaleString(), false, false],
                        ["Amenity Cap Seats", `${bpcRes.amenityCapSeats} (${Math.round(BPC_AMENITY_CAP_FACTOR*100)}% of ${bpcAmenitySeats})`, false, false],
                        ["Total Capacity Seats", bpcRes.capSeats.toLocaleString(), true, false],
                        ["Density Used", `${sharedDensityMin}–${sharedDensityMax} SF/seat`, false, false],
                        ["SF per Cap Seat", `${Math.round(bpcBaseSF/(bpcRes.capSeats||1))} SF`, false, false],
                      ].map(([label,val,bold,isBase],i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #eee",background:bold?"#E8F4FD":isBase?"#EEF6FF":i%2===0?"#fff":"#fafbfc"}}>
                          <td style={{padding:"10px 22px",color:bold?SF_NAVY:isBase?SF_BLUE:"#6B7280",fontWeight:bold||isBase?700:400}}>{label}</td>
                          <td style={{padding:"10px 22px",textAlign:"right",fontWeight:bold?800:600,color:bold?SF_NAVY:"#1A1A2E",fontVariantNumeric:"tabular-nums"}}>{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── COMPARISON ── */}
        {tab==="comparison" && (()=>{
          const handleDownloadTemplate = async () => {
            // Load SheetJS if needed
            if(!window.XLSX) {
              await new Promise((res,rej)=>{
                const s=document.createElement("script");
                s.src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
                s.onload=res; s.onerror=rej;
                document.head.appendChild(s);
              });
            }
            const XLSX = window.XLSX;
            const wb = XLSX.utils.book_new();
            // Build rows: header + one row per space type
            const header = ["Group","Space Type ID","Space Type Name","Actual # of Spaces","Actual Seats","Notes"];
            const rows = [header];
            const sp = allSpaces();
            sp.forEach(s => {
              if(s.isRoomType || s.isDeskPct) return; // skip calculated types
              const grp = SPACE_GROUPS.find(g=>g.id===s.groupId);
              rows.push([grp?.label??s.groupId, s.id, s.label, "", "", ""]);
            });
            const ws = XLSX.utils.aoa_to_sheet(rows);
            // Column widths
            ws["!cols"] = [{wch:22},{wch:22},{wch:34},{wch:20},{wch:16},{wch:30}];
            XLSX.utils.book_append_sheet(wb, ws, "Actual Space Data");
            XLSX.writeFile(wb, "space_comparison_template.xlsx");
          };

          const handleUpload = async (e) => {
            const file = e.target.files?.[0];
            if(!file) return;
            setCompName(file.name);
            const buf = await file.arrayBuffer();
            try {
              if(!window.XLSX) {
                await new Promise((res,rej)=>{
                  const s=document.createElement("script");
                  s.src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
                  s.onload=res; s.onerror=rej;
                  document.head.appendChild(s);
                });
              }
              const XLSX = window.XLSX;
              const wb   = XLSX.read(buf, {type:"array"});
              const ws   = wb.Sheets[wb.SheetNames[0]];
              const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
              let hdrIdx = rows.findIndex(r=>r.some(c=>String(c).includes("Space Type ID")));
              if(hdrIdx<0) hdrIdx=0;
              const hdrs      = rows[hdrIdx].map(h=>String(h).trim().toLowerCase());
              const idCol     = hdrs.findIndex(h=>h.includes("id"));
              const spacesCol = hdrs.findIndex(h=>h.includes("spaces")||h.includes("count"));
              const seatsCol  = hdrs.findIndex(h=>h.includes("seat"));
              const parsed = {};
              for(let i=hdrIdx+1;i<rows.length;i++){
                const row = rows[i];
                const id = String(row[idCol]||"").trim();
                if(!id||id.length<2) continue;
                parsed[id] = {spaces:parseInt(row[spacesCol])||0, seats:parseInt(row[seatsCol])||0};
              }
              setCompData(parsed);
            } catch(err){
              alert("Could not parse file. Please use the provided template.");
            }
          };

          const allSp = allSpaces();
          const SUPER_GROUP_ORDER = ["workspace","amenity","support"];

          return (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Upload bar */}
              <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"20px 24px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:18,color:SF_NAVY,marginBottom:4}}>Design Comparison</div>
                  <div style={{fontSize:12,color:"#888"}}>Download the template, fill in your actual space counts, then upload it to compare against the planned program.</div>
                </div>
                <button onClick={handleDownloadTemplate}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:8,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:600,color:SF_NAVY,whiteSpace:"nowrap"}}>
                  📥 Download Template
                </button>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:8,border:`1px solid ${SF_BLUE}`,background:"#E8F4FD",cursor:"pointer",fontSize:13,fontWeight:600,color:SF_BLUE,whiteSpace:"nowrap"}}>
                  📂 Upload Actual Design
                  <input type="file" accept=".xlsx" onChange={handleUpload} style={{display:"none"}}/>
                </label>
                {compData && <div style={{fontSize:12,color:"#2e7d32",fontWeight:600}}>✓ {compName}</div>}
              </div>

              {!compData ? (
                <div style={{background:"#fff",border:"2px dashed #ddd",borderRadius:12,padding:"48px 24px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📋</div>
                  <div style={{fontSize:16,color:SF_NAVY,fontWeight:600,marginBottom:8}}>No comparison data loaded</div>
                  <div style={{fontSize:13,color:"#888",marginBottom:20}}>Download the template, fill in your actual space counts and seats, then upload it above.</div>
                </div>
              ) : (()=>{
                // Build comparison rows
                const rows = allSp.map(sp=>{
                  const res = results.find(r=>r.id===sp.id);
                  const plannedSpaces = res?.rooms>0 ? res.rooms : (res?.spaces??0);
                  const plannedSeats  = res?.count??0;
                  const actual        = compData[sp.id]??{spaces:0,seats:0};
                  const diffSeats     = actual.seats - plannedSeats;
                  const pctDiff       = plannedSeats>0 ? diffSeats/plannedSeats : null;
                  return {sp, plannedSpaces, plannedSeats, actualSpaces:actual.spaces, actualSeats:actual.seats, diffSeats, pctDiff};
                }).filter(r=>r.plannedSeats>0||r.actualSeats>0||r.actualSpaces>0);

                const totalPlanned = rows.reduce((a,r)=>a+r.plannedSeats,0);
                const totalActual  = rows.reduce((a,r)=>a+r.actualSeats,0);
                const totalDiff    = totalActual - totalPlanned;

                const statusColor = (pct) => {
                  if(pct===null) return "#aaa";
                  if(Math.abs(pct)<0.05) return "#2e7d32";
                  if(Math.abs(pct)<0.15) return "#e65100";
                  return "#c62828";
                };

                return (
                  <div style={{display:"flex",flexDirection:"column",gap:16}}>
                    {/* Summary cards */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                      {[
                        ["Planned Seats",  totalPlanned.toLocaleString(), SF_NAVY,   "From calculator program"],
                        ["Actual Seats",   totalActual.toLocaleString(),  SF_BLUE,   `From ${compName}`],
                        ["Difference",     `${totalDiff>0?"+":""}${totalDiff.toLocaleString()}`,
                          totalDiff===0?"#2e7d32":totalDiff>0?"#e65100":"#c62828",
                          totalDiff===0?"On target":totalDiff>0?"Over program":"Under program"],
                      ].map(([label,value,color,sub])=>(
                        <div key={label} style={{background:"#fff",border:`1px solid #e0e0e0`,borderTop:`3px solid ${color}`,borderRadius:10,padding:"18px 22px"}}>
                          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"#888",textTransform:"uppercase",marginBottom:6}}>{label}</div>
                          <div style={{fontSize:30,fontWeight:800,color,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
                          <div style={{fontSize:12,color:"#888",marginTop:6}}>{sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Comparison table */}
                    <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                        <thead>
                          <tr style={{background:"#fafafa",borderBottom:"2px solid #e0e0e0"}}>
                            {["Space Type","Group","Planned Spaces","Actual Spaces","Planned Seats","Actual Seats","Difference","% Over/Under"].map(h=>(
                              <th key={h} style={{padding:"10px 14px",textAlign:h==="Space Type"||h==="Group"?"left":"center",fontSize:10,color:"#888",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({sp,plannedSpaces,plannedSeats,actualSpaces,actualSeats,diffSeats,pctDiff},i)=>{
                            const sc = statusColor(pctDiff);
                            const sg = SUPER_GROUPS.find(s=>s.groupIds.includes(sp.groupId));
                            return (
                              <tr key={sp.id} style={{borderBottom:"1px solid #f0f0f0",background:i%2===0?"#fff":"#fafbfc"}}>
                                <td style={{padding:"8px 14px",fontWeight:600,color:SF_NAVY}}>{sp.label}</td>
                                <td style={{padding:"8px 14px"}}>
                                  <span style={{fontSize:10,fontWeight:700,color:sg?.color??"#888",background:`${sg?.color??"#888"}18`,padding:"2px 7px",borderRadius:4}}>{sg?.label??""}</span>
                                </td>
                                <td style={{padding:"8px 14px",textAlign:"center",color:"#555"}}>{plannedSpaces||"—"}</td>
                                <td style={{padding:"8px 14px",textAlign:"center",color:actualSpaces!==plannedSpaces&&actualSpaces>0?SF_BLUE:"#555",fontWeight:actualSpaces!==plannedSpaces&&actualSpaces>0?700:400}}>{actualSpaces||"—"}</td>
                                <td style={{padding:"8px 14px",textAlign:"center",color:"#555"}}>{plannedSeats||"—"}</td>
                                <td style={{padding:"8px 14px",textAlign:"center",fontWeight:700,color:SF_NAVY}}>{actualSeats||"—"}</td>
                                <td style={{padding:"8px 14px",textAlign:"center",fontWeight:700,color:sc}}>
                                  {diffSeats!==0?`${diffSeats>0?"+":""}${diffSeats}`:"—"}
                                </td>
                                <td style={{padding:"8px 14px",textAlign:"center"}}>
                                  {pctDiff!==null ? (
                                    <span style={{background:`${sc}18`,color:sc,fontWeight:700,fontSize:11,padding:"2px 8px",borderRadius:4,whiteSpace:"nowrap"}}>
                                      {pctDiff>0?"+":""}{(pctDiff*100).toFixed(1)}%
                                    </span>
                                  ) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── TIERS & REGIONS ── */}
        {tab==="tiers" && (()=>{
          const pct = v => Math.round((v??0)*100);
          const superSum = t => pct(t.superAlloc.workspace)+pct(t.superAlloc.amenity)+pct(t.superAlloc.support);
          const wsSum    = t => ["indiv","enclosed","wpspec","open"].reduce((a,k)=>a+pct(t.wsAlloc[k]),0);
          const amSum    = t => ["me","specialty","hospitality"].reduce((a,k)=>a+pct(t.amAlloc[k]),0);
          const sumTag = (sum) => <span style={{fontSize:10,fontWeight:700,color:sum===100?GREEN:"#E57373"}}>{sum}%{sum===100?"":" ⚠"}</span>;
          const tiersModified = JSON.stringify(TIERS)!==JSON.stringify(DEFAULT_TIERS);
          return (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid #e0e0e0",background:"#fafafa",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div>
                  <span style={{fontFamily:"Inter, 'Salesforce Sans', Arial, sans-serif",fontSize:18,color:SF_NAVY}}>Allocation by Tier</span>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>
                    {tiersLocked
                      ? "Standard tier breakdowns. Unlock to customize."
                      : "Editing enabled — each group should total 100%. Changes apply to the selected tier."}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {!tiersLocked && tiersModified && (
                    <button onClick={resetTiers}
                      style={{padding:"7px 14px",borderRadius:8,border:"1px solid #ddd",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#888",whiteSpace:"nowrap"}}>
                      ↺ Reset to defaults
                    </button>
                  )}
                  <button onClick={()=>setTiersLocked(v=>!v)} title={tiersLocked?"Unlock to edit tier allocations":"Lock tier allocations"}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:"1px solid",
                      borderColor:tiersLocked?"#ddd":SF_BLUE,background:tiersLocked?"#fff":"#e8f4fd",
                      cursor:"pointer",fontSize:12,fontWeight:600,color:tiersLocked?"#888":SF_BLUE,whiteSpace:"nowrap"}}>
                    {tiersLocked?"🔒 Locked":"🔓 Editing"}
                  </button>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>
                  <th style={{padding:"8px 12px",textAlign:"left",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>Category</th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>Sub-%</th>
                  {TIERS.map(t=><th key={t.id} style={{padding:"8px 12px",textAlign:"center",fontSize:11,borderBottom:"1px solid #e0e0e0",background:tierId===t.id?"#e8f4fd":"#f7f7f7",color:tierId===t.id?SF_BLUE:"#888"}}>{t.label}{tierId===t.id?" ★":""}</th>)}
                </tr></thead>
                <tbody>
                  {SUPER_GROUPS.map((sg)=>[
                    <tr key={sg.id} style={{background:"#fafafa"}}>
                      <td style={{padding:"8px 12px",fontWeight:700,color:sg.color,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",borderBottom:"1px solid #eee"}}>{sg.label} — % of Total ASF</td>
                      <td style={{padding:"8px 6px",textAlign:"center",borderBottom:"1px solid #eee"}}/>
                      {TIERS.map(t=>(
                        <td key={t.id} style={{padding:"6px 12px",textAlign:"center",background:tierId===t.id?"#f0f8ff":"transparent",borderBottom:"1px solid #eee"}}>
                          <TierCell value={pct(t.superAlloc[sg.id])} onChange={v=>updateTier(t.id,"superAlloc",sg.id,v)} suffix="%" active={tierId===t.id} color={sg.color} locked={tiersLocked}/>
                        </td>
                      ))}
                    </tr>,
                    ...( sg.id==="workspace"?["indiv","enclosed","wpspec","open"]:sg.id==="amenity"?["me","specialty","hospitality"]:[] ).map((gid,i)=>{
                      const g = SPACE_GROUPS.find(x=>x.id===gid);
                      const grp = sg.id==="workspace"?"wsAlloc":"amAlloc";
                      return (
                        <tr key={gid} style={{borderBottom:"1px solid #f5f5f5",background:i%2===0?"#f9f9ff":"#fff"}}>
                          <td style={{padding:"6px 12px 6px 24px",fontSize:12,color:g.color,fontWeight:600}}>{g.label}</td>
                          <td style={{padding:"6px 12px",fontSize:11,color:SF_SUBTLE,fontStyle:"italic"}}>within →</td>
                          {TIERS.map(t=>(
                            <td key={t.id} style={{padding:"6px 12px",textAlign:"center",background:tierId===t.id?"#eef5ff":"transparent"}}>
                              <TierCell value={pct(t[grp][gid])} onChange={v=>updateTier(t.id,grp,gid,v)} suffix="%" active={tierId===t.id} color={g.color} locked={tiersLocked}/>
                            </td>
                          ))}
                        </tr>
                      );
                    }),
                    (!tiersLocked && (sg.id==="workspace"||sg.id==="amenity")) ? (
                      <tr key={sg.id+"-sum"} style={{background:"#fff"}}>
                        <td style={{padding:"3px 12px 8px 24px",fontSize:10,color:SF_SUBTLE}}>sub-total</td>
                        <td/>
                        {TIERS.map(t=><td key={t.id} style={{padding:"3px 12px 8px",textAlign:"center",background:tierId===t.id?"#eef5ff":"transparent"}}>{sumTag(sg.id==="workspace"?wsSum(t):amSum(t))}</td>)}
                      </tr>
                    ) : null
                  ])}
                  {!tiersLocked && (
                  <tr style={{background:"#fff"}}>
                    <td style={{padding:"3px 12px 8px",fontSize:10,color:SF_SUBTLE,fontWeight:600}}>Total ASF allocation</td>
                    <td/>
                    {TIERS.map(t=><td key={t.id} style={{padding:"3px 12px 8px",textAlign:"center",background:tierId===t.id?"#f0f8ff":"transparent"}}>{sumTag(superSum(t))}</td>)}
                  </tr>
                  )}
                  <tr style={{background:"#f7f7f7"}}>
                    <td colSpan={2} style={{padding:"8px 12px",fontWeight:700,color:"#555",fontSize:11,borderTop:"2px solid #e0e0e0"}}>Density Target (SF / Cap Seat)</td>
                    {TIERS.map(t=>(
                      <td key={t.id} style={{padding:"8px 12px",textAlign:"center",background:tierId===t.id?"#f0f8ff":"transparent",borderTop:"2px solid #e0e0e0"}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:3,justifyContent:"center"}}>
                          <TierCell value={t.densityMin} onChange={v=>updateTier(t.id,"density","densityMin",v)} active={tierId===t.id} width={42} locked={tiersLocked}/>
                          <span style={{fontSize:11,color:SF_SUBTLE}}>–</span>
                          <TierCell value={t.densityMax} onChange={v=>updateTier(t.id,"density","densityMax",v)} active={tierId===t.id} width={42} locked={tiersLocked}/>
                          <span style={{fontSize:10,color:SF_SUBTLE}}>SF</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── BUSINESS UNITS ── */}
        {tab==="bu" && (
          <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,padding:"64px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{width:56,height:56,borderRadius:14,background:SF_BLUE_LIGHT,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18}}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="3" y="10" width="7" height="11" rx="1" stroke={SF_BLUE} strokeWidth="1.6"/>
                <rect x="14" y="4" width="7" height="17" rx="1" stroke={SF_BLUE} strokeWidth="1.6"/>
                <path d="M2 21h20" stroke={SF_BLUE} strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M6 14h1M6 17h1M17 8h1M17 11h1M17 14h1" stroke={SF_BLUE} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{fontSize:22,fontWeight:700,color:SF_NAVY}}>Coming Soon</div>
          </div>
        )}

        {/* ── SPACE TYPES ── */}
        {tab==="db" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {SUPER_GROUPS.map(sg=>(
              <div key={sg.id}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:4,height:18,background:sg.color,borderRadius:2}}/>
                  <span style={{fontSize:12,fontWeight:700,color:sg.color,letterSpacing:"0.1em",textTransform:"uppercase"}}>{sg.label}</span>
                  {tier&&<span style={{fontSize:12,color:SF_SUBTLE}}>— {Math.round((tier.superAlloc[sg.id]??0)*100)}% of total ASF</span>}
                </div>
                <div style={{background:"#fff",border:"1px solid #e0e0e0",borderRadius:12,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead><tr>
                      {["Group","Space Type","Type","SF/Unit","Ratio","Count"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,color:"#888",borderBottom:"1px solid #e0e0e0",background:"#f7f7f7"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {SPACE_GROUPS.filter(g=>g.superGroup===sg.id).flatMap(g=>g.spaces.map((sp,i)=>{
                        const r = results.find(x=>x.id===sp.id);
                        const effN = ratios[sp.id]??sp.roomRatio;
                        return (
                          <tr key={sp.id} style={{borderBottom:"1px solid #f5f5f5",background:i%2===0?"#fff":"#fafafa"}}>
                            <td style={{padding:"7px 12px"}}><span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:g.color,display:"inline-block"}}/><span style={{fontSize:11,color:"#666"}}>{g.label}</span></span></td>
                            <td style={{padding:"7px 12px",fontWeight:600}}>{sp.label}</td>
                            <td style={{padding:"7px 12px"}}><span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,background:sp.type==="capacity"?"#70BF7522":sp.type==="non-capacity"?"#7B68EE22":"#f0f0f0",color:sp.type==="capacity"?"#70BF75":sp.type==="non-capacity"?"#7B68EE":"#aaa"}}>{sp.type==="capacity"?"Cap":sp.type==="non-capacity"?"Non-Cap":"—"}</span></td>
                            <td style={{padding:"7px 12px",textAlign:"right"}}>{sp.sf??""} SF</td>
                            <td style={{padding:"7px 12px",color:SF_BLUE,fontWeight:600}}>{sp.isRoomType?`1 : ${effN}`:sp.isDeskPct?`${((ratios[sp.id]??0)*100).toFixed(0)}% of cap`:`${((ratios[sp.id]??0)*100).toFixed(1)}%`}</td>
                            <td style={{padding:"7px 12px",textAlign:"right",fontWeight:700,color:SF_NAVY}}>{r?.isRoomType?`${r.rooms} rooms / ${r.count} seats`:r?.count??0}</td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

      {showScenarios && (
        <ScenarioManager
          currentState={currentSettings()}
          onLoad={handleLoadScenario}
          onClose={()=>setShowScenarios(false)}
        />
      )}
      </div>
    </div>
  );
}
