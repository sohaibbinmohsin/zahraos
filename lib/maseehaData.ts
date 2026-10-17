export interface Vitals {
  bp: string;
  pulse: number;
  spO2: number;
  temp: string;
  avpu: "Alert" | "Voice" | "Pain" | "Unresponsive";
}

export interface ConsumableUsed {
  name: string;
  qty: number;
}

export interface EmergencyCase {
  id: number;
  date: string;
  callTime: string;
  enRouteTime: string;
  sceneArrivalTime: string;
  hospitalArrivalTime: string;
  clearToBaseTime: string;
  patient: string;
  gender: "Male" | "Female";
  age: number;
  contactPhone: string;
  chapter: "pind_begwal" | "tumair" | "jheeng";
  location: string;
  gpsCoords?: { lat: number; lng: number };
  hospital: string;
  category: "Trauma" | "Cardiac" | "Medical" | "Gynae" | "Respiratory";
  severity: "Critical" | "Major" | "Minor";
  chiefComplaint: string;
  vitals: Vitals;
  emp1: string; // Lead Paramedic
  emp2: string; // Driver
  vin: string;  // Vehicle ID
  consumables: ConsumableUsed[];
  distanceKm: number;
  fareBilled: number;
  paymentStatus: "Paid" | "Partial" | "Zakat Requested" | "Zakat Approved";
  amtPaid: number;
  zakatReason?: string;
  reviewStatus: "Needs Review" | "Verified" | "Flagged";
  verifiedBy?: string;
  verifiedAt?: string;
  supervisorNotes?: string;
}

export interface AmbulanceVehicle {
  id: string;
  vin: string;
  model: string;
  hub: "pind_begwal" | "tumair" | "jheeng";
  status: "Ready on Standby" | "On Active Dispatch" | "Under Maintenance";
  activeLeadParamedic: string;
  activeDriver: string;
  mileageKm: number;
  fuelPercent: number;
  oxygenPsi: number;
  lastServiceDate: string;
  nextServiceKm: number;
}

export interface MedicalSupplyItem {
  id: string;
  name: string;
  category: "Trauma & Dressing" | "Airway & Oxygen" | "Diagnostics" | "Personal Protection" | "Splints & Immobilization";
  unit: string;
  hub: "pind_begwal" | "tumair" | "jheeng";
  currentStock: number;
  minThreshold: number;
  lastRestocked: string;
}

export const INITIAL_CASES: EmergencyCase[] = [
  {
    id: 1466,
    date: "2026-02-26",
    callTime: "09:30",
    enRouteTime: "09:33",
    sceneArrivalTime: "09:44",
    hospitalArrivalTime: "10:14",
    clearToBaseTime: "10:48",
    patient: "Sameer Qazi",
    gender: "Male",
    age: 28,
    contactPhone: "+92 312 9841234",
    chapter: "pind_begwal",
    location: "Dhok Qaziyan, Simly Dam Rd",
    gpsCoords: { lat: 33.7412, lng: 73.2105 },
    hospital: "Razi Hospital",
    category: "Trauma",
    severity: "Critical",
    chiefComplaint: "Compound tibia-fibula fracture post motorcycle collision, active venous bleed",
    vitals: { bp: "95/60", pulse: 118, spO2: 96, temp: "36.8°C", avpu: "Alert" },
    emp1: "Zainab Nosheen",
    emp2: "Faizan Malik",
    vin: "LEA 7221",
    consumables: [
      { name: "4\" Crepe Bandage", qty: 2 },
      { name: "Sterile Gauze Pack", qty: 4 },
      { name: "IV Cannula 18G", qty: 1 },
      { name: "Normal Saline 500ml", qty: 1 }
    ],
    distanceKm: 42,
    fareBilled: 1500,
    paymentStatus: "Zakat Requested",
    amtPaid: 0,
    zakatReason: "Daily wage laborer family; verified destitute by local council member.",
    reviewStatus: "Needs Review",
  },
  {
    id: 1465,
    date: "2026-02-25",
    callTime: "15:20",
    enRouteTime: "15:22",
    sceneArrivalTime: "15:35",
    hospitalArrivalTime: "16:10",
    clearToBaseTime: "16:45",
    patient: "Riffat Shaheen",
    gender: "Female",
    age: 34,
    contactPhone: "+92 300 5518921",
    chapter: "tumair",
    location: "Tumair Main Bazaar",
    gpsCoords: { lat: 33.7198, lng: 73.2384 },
    hospital: "PIMS Hospital",
    category: "Gynae",
    severity: "Critical",
    chiefComplaint: "Third-trimester acute uterine hemorrhage with severe abdominal pain",
    vitals: { bp: "88/54", pulse: 124, spO2: 94, temp: "37.2°C", avpu: "Voice" },
    emp1: "Muhammad Faizan",
    emp2: "Aqib Younas",
    vin: "LT-326",
    consumables: [
      { name: "IV Cannula 16G", qty: 1 },
      { name: "Ringer Lactate 1000ml", qty: 2 },
      { name: "Oxygen (6L/min)", qty: 1 }
    ],
    distanceKm: 38,
    fareBilled: 1500,
    paymentStatus: "Zakat Approved",
    amtPaid: 0,
    zakatReason: "Emergency obstetrics for widow household without breadwinner.",
    reviewStatus: "Verified",
    verifiedBy: "Saima Sayyed (Director)",
    verifiedAt: "2026-02-25 18:30",
    supervisorNotes: "Subsidized 100% via Saving 9 Emergency Zakat Fund. Paramedic acted with utmost speed."
  },
  {
    id: 1464,
    date: "2026-02-24",
    callTime: "11:15",
    enRouteTime: "11:18",
    sceneArrivalTime: "11:29",
    hospitalArrivalTime: "11:58",
    clearToBaseTime: "12:30",
    patient: "Malik Jahangir",
    gender: "Male",
    age: 62,
    contactPhone: "+92 333 4108871",
    chapter: "pind_begwal",
    location: "Near Simly Water Works",
    gpsCoords: { lat: 33.7314, lng: 73.1982 },
    hospital: "Polyclinic Hospital",
    category: "Cardiac",
    severity: "Critical",
    chiefComplaint: "Crushing retrosternal chest pain radiating to left jaw, diaphoresis",
    vitals: { bp: "165/105", pulse: 92, spO2: 93, temp: "36.6°C", avpu: "Alert" },
    emp1: "Zainab Nosheen",
    emp2: "Faizan Malik",
    vin: "LEA 7221",
    consumables: [
      { name: "Aspirin 300mg", qty: 1 },
      { name: "Sublingual Nitrate", qty: 1 },
      { name: "High Flow Oxygen Mask", qty: 1 }
    ],
    distanceKm: 31,
    fareBilled: 1200,
    paymentStatus: "Paid",
    amtPaid: 1200,
    reviewStatus: "Verified",
    verifiedBy: "Zainab Nosheen (Lead)",
    verifiedAt: "2026-02-24 14:00"
  },
  {
    id: 1463,
    date: "2026-02-23",
    callTime: "19:40",
    enRouteTime: "19:42",
    sceneArrivalTime: "19:56",
    hospitalArrivalTime: "20:32",
    clearToBaseTime: "21:05",
    patient: "Safi Ullah",
    gender: "Male",
    age: 18,
    contactPhone: "+92 345 8192031",
    chapter: "jheeng",
    location: "Jheeng Village Hilltop",
    gpsCoords: { lat: 33.7541, lng: 73.2711 },
    hospital: "Holy Family Hospital",
    category: "Medical",
    severity: "Minor",
    chiefComplaint: "High grade viral pyrexia, dehydration and persistent emesis",
    vitals: { bp: "115/75", pulse: 84, spO2: 98, temp: "39.4°C", avpu: "Alert" },
    emp1: "Hamza Abbasi",
    emp2: "Tariq Mehmood",
    vin: "RWP-901",
    consumables: [
      { name: "Paracetamol IV Infusion", qty: 1 },
      { name: "Sterile Syringe 5ml", qty: 1 }
    ],
    distanceKm: 48,
    fareBilled: 1000,
    paymentStatus: "Paid",
    amtPaid: 1000,
    reviewStatus: "Verified",
    verifiedBy: "Hamza Abbasi (Lead)",
    verifiedAt: "2026-02-23 22:15"
  },
  {
    id: 1462,
    date: "2026-02-22",
    callTime: "08:10",
    enRouteTime: "08:12",
    sceneArrivalTime: "08:24",
    hospitalArrivalTime: "08:58",
    clearToBaseTime: "09:35",
    patient: "Bilquis Bibi",
    gender: "Female",
    age: 55,
    contactPhone: "+92 321 7741129",
    chapter: "pind_begwal",
    location: "Mohallah Sayyedan, Pind Begwal",
    gpsCoords: { lat: 33.7389, lng: 73.2045 },
    hospital: "PIMS Hospital",
    category: "Respiratory",
    severity: "Major",
    chiefComplaint: "Acute asthma exacerbation with severe wheezing, accessory muscle use",
    vitals: { bp: "135/88", pulse: 110, spO2: 89, temp: "37.0°C", avpu: "Alert" },
    emp1: "Zainab Nosheen",
    emp2: "Faizan Malik",
    vin: "LEA 7221",
    consumables: [
      { name: "Salbutamol Nebule 2.5mg", qty: 2 },
      { name: "Nebulizer Kit with Tubing", qty: 1 },
      { name: "Continuous Oxygen (4L/min)", qty: 1 }
    ],
    distanceKm: 34,
    fareBilled: 1200,
    paymentStatus: "Partial",
    amtPaid: 500,
    zakatReason: "Family had only Rs. 500 in cash. Remaining Rs. 700 submitted for Zakat waiver.",
    reviewStatus: "Needs Review",
  },
  {
    id: 1461,
    date: "2026-02-21",
    callTime: "14:05",
    enRouteTime: "14:08",
    sceneArrivalTime: "14:19",
    hospitalArrivalTime: "14:49",
    clearToBaseTime: "15:20",
    patient: "Kamran Akram",
    gender: "Male",
    age: 42,
    contactPhone: "+92 313 5590123",
    chapter: "tumair",
    location: "Korang River Crossing, Tumair",
    gpsCoords: { lat: 33.7125, lng: 73.2291 },
    hospital: "Razi Hospital",
    category: "Trauma",
    severity: "Major",
    chiefComplaint: "Fall from construction scaffolding (approx 12ft), head laceration and lumbar contusion",
    vitals: { bp: "128/82", pulse: 88, spO2: 97, temp: "36.9°C", avpu: "Alert" },
    emp1: "Muhammad Faizan",
    emp2: "Aqib Younas",
    vin: "LT-326",
    consumables: [
      { name: "Cervical Collar Adult", qty: 1 },
      { name: "Trauma Dressing 6\"", qty: 2 },
      { name: "Rigid Spineboard Straps", qty: 1 }
    ],
    distanceKm: 29,
    fareBilled: 1200,
    paymentStatus: "Paid",
    amtPaid: 1200,
    reviewStatus: "Verified",
    verifiedBy: "Muhammad Faizan",
    verifiedAt: "2026-02-21 16:30"
  },
  {
    id: 1460,
    date: "2026-02-20",
    callTime: "22:30",
    enRouteTime: "22:33",
    sceneArrivalTime: "22:48",
    hospitalArrivalTime: "23:25",
    clearToBaseTime: "00:05",
    patient: "Fatima Noor",
    gender: "Female",
    age: 7,
    contactPhone: "+92 301 9882310",
    chapter: "jheeng",
    location: "Lower Jheeng Settlement",
    gpsCoords: { lat: 33.7621, lng: 73.2649 },
    hospital: "PIMS Hospital",
    category: "Medical",
    severity: "Critical",
    chiefComplaint: "Febrile status epilepticus, active tonic-clonic convulsions > 10 minutes",
    vitals: { bp: "100/60", pulse: 140, spO2: 92, temp: "40.1°C", avpu: "Pain" },
    emp1: "Hamza Abbasi",
    emp2: "Tariq Mehmood",
    vin: "RWP-901",
    consumables: [
      { name: "Pediatric Oxygen Mask", qty: 1 },
      { name: "Diazepam Rectal Tube", qty: 1 },
      { name: "IV Cannula 22G", qty: 1 }
    ],
    distanceKm: 51,
    fareBilled: 1500,
    paymentStatus: "Zakat Approved",
    amtPaid: 0,
    zakatReason: "Orphan child under custody of elderly grandmother; no income source.",
    reviewStatus: "Verified",
    verifiedBy: "Saima Sayyed (Director)",
    verifiedAt: "2026-02-21 10:00",
    supervisorNotes: "Fully covered under Saving 9 Zakat Fund. Immediate lifesaving pediatric transport."
  },
  {
    id: 1459,
    date: "2026-02-19",
    callTime: "16:45",
    enRouteTime: "16:48",
    sceneArrivalTime: "17:02",
    hospitalArrivalTime: "17:35",
    clearToBaseTime: "18:10",
    patient: "Ghulam Rasool",
    gender: "Male",
    age: 71,
    contactPhone: "+92 334 2209182",
    chapter: "pind_begwal",
    location: "Near Pind Begwal Post Office",
    gpsCoords: { lat: 33.7371, lng: 73.2089 },
    hospital: "Polyclinic Hospital",
    category: "Cardiac",
    severity: "Major",
    chiefComplaint: "Congestive heart failure decompensation, severe orthopnea and bilateral pedal edema",
    vitals: { bp: "170/110", pulse: 96, spO2: 91, temp: "36.7°C", avpu: "Alert" },
    emp1: "Zainab Nosheen",
    emp2: "Faizan Malik",
    vin: "LEA 7221",
    consumables: [
      { name: "Oxygen Mask (6L/min)", qty: 1 },
      { name: "Furosemide Injection", qty: 1 }
    ],
    distanceKm: 33,
    fareBilled: 1200,
    paymentStatus: "Paid",
    amtPaid: 1200,
    reviewStatus: "Verified",
    verifiedBy: "Zainab Nosheen",
    verifiedAt: "2026-02-19 19:15"
  }
];

export const INITIAL_VEHICLES: AmbulanceVehicle[] = [
  {
    id: "veh-1",
    vin: "LEA 7221",
    model: "Toyota HiAce High-Roof (Custom BLS Conversion)",
    hub: "pind_begwal",
    status: "Ready on Standby",
    activeLeadParamedic: "Zainab Nosheen (EMP #1)",
    activeDriver: "Faizan Malik (EMP #2)",
    mileageKm: 142380,
    fuelPercent: 88,
    oxygenPsi: 1850,
    lastServiceDate: "2026-02-10",
    nextServiceKm: 145000,
  },
  {
    id: "veh-2",
    vin: "LT-326",
    model: "Toyota HiAce Standard-Roof (Emergency Response)",
    hub: "tumair",
    status: "On Active Dispatch",
    activeLeadParamedic: "Muhammad Faizan (EMP #3)",
    activeDriver: "Aqib Younas (EMP #4)",
    mileageKm: 98120,
    fuelPercent: 74,
    oxygenPsi: 1600,
    lastServiceDate: "2026-01-28",
    nextServiceKm: 100000,
  },
  {
    id: "veh-3",
    vin: "RWP-901",
    model: "Toyota Hilux 4x4 Ambulance (Mountain Access)",
    hub: "jheeng",
    status: "Ready on Standby",
    activeLeadParamedic: "Hamza Abbasi (EMP #5)",
    activeDriver: "Tariq Mehmood (EMP #6)",
    mileageKm: 215400,
    fuelPercent: 92,
    oxygenPsi: 2000,
    lastServiceDate: "2026-02-15",
    nextServiceKm: 220000,
  }
];

export const INITIAL_SUPPLIES: MedicalSupplyItem[] = [
  { id: "sup-1", name: "IV Cannula 18G (Green)", category: "Trauma & Dressing", unit: "pieces", hub: "pind_begwal", currentStock: 34, minThreshold: 15, lastRestocked: "2026-02-18" },
  { id: "sup-2", name: "IV Cannula 20G (Pink)", category: "Trauma & Dressing", unit: "pieces", hub: "pind_begwal", currentStock: 42, minThreshold: 15, lastRestocked: "2026-02-18" },
  { id: "sup-3", name: "4\" Elastic Crepe Bandages", category: "Trauma & Dressing", unit: "rolls", hub: "pind_begwal", currentStock: 18, minThreshold: 20, lastRestocked: "2026-02-10" },
  { id: "sup-4", name: "Sterile Trauma Dressing Packs", category: "Trauma & Dressing", unit: "packs", hub: "pind_begwal", currentStock: 12, minThreshold: 10, lastRestocked: "2026-02-12" },
  { id: "sup-5", name: "Medical Oxygen 40L Cylinders", category: "Airway & Oxygen", unit: "cylinders", hub: "pind_begwal", currentStock: 4, minThreshold: 2, lastRestocked: "2026-02-20" },
  { id: "sup-6", name: "Rigid Cervical Collars (Adult)", category: "Splints & Immobilization", unit: "units", hub: "pind_begwal", currentStock: 6, minThreshold: 4, lastRestocked: "2026-01-20" },
  { id: "sup-7", name: "Rigid Cervical Collars (Pediatric)", category: "Splints & Immobilization", unit: "units", hub: "pind_begwal", currentStock: 3, minThreshold: 2, lastRestocked: "2026-01-20" },
  { id: "sup-8", name: "Nitrile Gloves Size M (Box of 100)", category: "Personal Protection", unit: "boxes", hub: "pind_begwal", currentStock: 8, minThreshold: 5, lastRestocked: "2026-02-15" },
  { id: "sup-9", name: "Normal Saline 0.9% 500ml", category: "Trauma & Dressing", unit: "bottles", hub: "tumair", currentStock: 22, minThreshold: 12, lastRestocked: "2026-02-14" },
  { id: "sup-10", name: "Portable Pulse Oximeters", category: "Diagnostics", unit: "units", hub: "tumair", currentStock: 3, minThreshold: 2, lastRestocked: "2026-01-10" },
  { id: "sup-11", name: "Digital Sphygmomanometer", category: "Diagnostics", unit: "units", hub: "jheeng", currentStock: 2, minThreshold: 2, lastRestocked: "2026-01-15" },
  { id: "sup-12", name: "Medical Oxygen 40L Cylinders", category: "Airway & Oxygen", unit: "cylinders", hub: "jheeng", currentStock: 3, minThreshold: 2, lastRestocked: "2026-02-19" },
];

export const CHAPTER_NAMES: Record<string, string> = {
  pind_begwal: "Pind Begwal Hub",
  tumair: "Tumair Hub",
  jheeng: "Jheeng Hub",
};
