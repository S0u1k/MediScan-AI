// X-Ray analysis helpers: file validation, canvas-based body-region detection,
// and body-part classification. Pure/browser logic, no external API required.

export const XRAY_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export const XRAY_BODY_PARTS = [
  "Chest",
  "Hand",
  "Leg",
  "Knee",
  "Skull",
  "Spine",
  "Foot",
  "Shoulder",
  "Arm",
  "Pelvis",
  "Abdomen",
  "Dental",
  "Other",
] as const;
export type XRayBodyPart = (typeof XRAY_BODY_PARTS)[number];

export interface BoundingBox {
  // Fractions (0-1) of image dimensions.
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnatomicalCheckItem {
  structure: string;
  status: "Normal" | "Suspicious" | "Abnormal" | "Not Assessable" | string;
  details: string;
}

export interface SuspectedAbnormality {
  title: string;
  location: string;
  description: string;
  confidence: number;
}

export type XRayUrgency = "Routine" | "Moderate" | "Urgent" | "Emergency";

export interface XRayResult {
  bodyPart: string;
  confidence: number; // 0-100
  box: BoundingBox;
  boxFound: boolean;
  explanation: string;
  mode: "ai" | "demo";
  // Enhanced clinical radiological diagnostic attributes
  isXray?: boolean;
  subRegion?: string;
  projection?: string;
  modality?: string;
  imageQuality?: "Optimal" | "Adequate" | "Sub-optimal" | "Poor" | string;
  technicalFactors?: string;
  urgency?: XRayUrgency;
  fractureDetected?: boolean;
  anatomicalChecklist?: AnatomicalCheckItem[];
  findings?: string[];
  suspectedAbnormalities?: SuspectedAbnormality[];
  impression?: string;
  recommendations?: string[];
  disclaimer?: string;
}

export interface XRayLikeness {
  isXray: boolean;
  /** Mean per-pixel color saturation, 0 (grayscale) … 1 (very colorful). */
  saturation: number;
  reason: string;
}

export interface FileValidation {
  ok: boolean;
  error?: string;
}

/** Validates an uploaded X-ray file (presence, type, size). */
export function validateImageFile(file: File | null | undefined): FileValidation {
  if (!file) return { ok: false, error: "No file selected. Please upload an X-ray image." };
  const type = file.type.toLowerCase();
  if (!(XRAY_ACCEPTED_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      error: "Unsupported format. Please upload a PNG, JPG, JPEG, or WEBP image.",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is too large. Please upload a file under 10MB." };
  }
  return { ok: true };
}

/** Loads an image element from a data URL, rejecting if it cannot be decoded. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error("Image could not be loaded or is corrupted."));
      } else {
        resolve(img);
      }
    };
    img.onerror = () => reject(new Error("Image could not be loaded or is corrupted."));
    img.src = src;
  });
}

/**
 * Detects the largest bright (body) region in an X-ray using grayscale
 * brightness thresholding on a downscaled canvas. Returns a padded, clamped
 * bounding box in image-fraction coordinates.
 */
export function detectBodyRegion(img: HTMLImageElement): {
  box: BoundingBox;
  found: boolean;
  coverage: number; // fraction of pixels above threshold
} {
  // Downscale for speed and noise reduction.
  const maxDim = 200;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { box: { x: 0, y: 0, width: 1, height: 1 }, found: false, coverage: 0 };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale + mean brightness.
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g;
    sum += g;
  }
  const mean = sum / (w * h);
  // Threshold: a bit above the mean so the bright body separates from the
  // dark background, with a sensible floor.
  const threshold = Math.max(40, mean * 1.05);

  // Binary mask with a tiny erosion to ignore single-pixel noise.
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < gray.length; p++) mask[p] = gray[p] >= threshold ? 1 : 0;

  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1,
    count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!mask[p]) continue;
      // Noise rejection: require at least 4 bright neighbors.
      const neighbors =
        mask[p - 1] +
        mask[p + 1] +
        mask[p - w] +
        mask[p + w] +
        mask[p - w - 1] +
        mask[p - w + 1] +
        mask[p + w - 1] +
        mask[p + w + 1];
      if (neighbors < 4) continue;
      count++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const coverage = count / (w * h);
  if (maxX < 0 || coverage < 0.01) {
    // Nothing meaningful found — fall back to a centered box.
    return {
      box: { x: 0.15, y: 0.12, width: 0.7, height: 0.76 },
      found: false,
      coverage,
    };
  }

  // Padding (8% of each dimension) then clamp to [0,1].
  const padX = (maxX - minX) * 0.08 + 2;
  const padY = (maxY - minY) * 0.08 + 2;
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(w, maxX + padX);
  const y1 = Math.min(h, maxY + padY);

  return {
    box: {
      x: x0 / w,
      y: y0 / h,
      width: (x1 - x0) / w,
      height: (y1 - y0) / h,
    },
    found: true,
    coverage,
  };
}

/**
 * Local heuristic: does this image even look like an X-ray? X-rays are
 * essentially monochrome (R≈G≈B per pixel) with a bright-subject-on-dark
 * distribution, whereas ordinary color photos (a car, a face, etc.) have high
 * color saturation. We sample the downscaled image and measure average
 * per-pixel saturation; very colorful images are rejected as non-X-ray.
 */
export function looksLikeXray(img: HTMLImageElement): XRayLikeness {
  const maxDim = 120;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { isXray: true, saturation: 0, reason: "Could not inspect image; allowing." };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let satSum = 0;
  let colorfulPixels = 0;
  const total = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max; // HSV saturation
    satSum += sat;
    // Standard color photos have large differences between color channels (>65) with high saturation (>0.45)
    if (max - min > 65 && sat > 0.45) colorfulPixels++;
  }
  const meanSat = satSum / total;
  const colorfulRatio = colorfulPixels / total;

  // Real medical X-rays (even with blue lightbox glow or amber film tints) typically have
  // mean saturation < 0.38 and colorfulRatio < 0.45.
  // Everyday colorful photos (landscapes, selfies, clothes) easily exceed these.
  const isXray = meanSat < 0.38 && colorfulRatio < 0.45;

  return {
    isXray,
    saturation: meanSat,
    reason: isXray
      ? "Image is consistent with a medical radiograph."
      : "Image appears to be a color photograph rather than an X-ray scan.",
  };
}

/** Detects a body part hint from the file name, if present. */
export function bodyPartFromFileName(fileName: string): XRayBodyPart | null {
  const name = fileName.toLowerCase();
  const map: Record<string, XRayBodyPart> = {
    chest: "Chest",
    lung: "Chest",
    thorax: "Chest",
    hand: "Hand",
    wrist: "Hand",
    leg: "Leg",
    femur: "Leg",
    tibia: "Leg",
    knee: "Knee",
    skull: "Skull",
    head: "Skull",
    cranium: "Skull",
    spine: "Spine",
    vertebra: "Spine",
    back: "Spine",
    foot: "Foot",
    ankle: "Foot",
    shoulder: "Shoulder",
    arm: "Arm",
    elbow: "Arm",
    humerus: "Arm",
    pelvis: "Pelvis",
    hip: "Pelvis",
    abdomen: "Abdomen",
    stomach: "Abdomen",
    dental: "Dental",
    tooth: "Dental",
    teeth: "Dental",
    jaw: "Dental",
    orthopantomogram: "Dental",
  };
  for (const key of Object.keys(map)) {
    if (name.includes(key)) return map[key];
  }
  return null;
}

/**
 * Returns structured demonstration radiological findings for fallback / demo preview.
 */
export function getDemoDiagnosticDetails(bodyPart: string): Partial<XRayResult> {
  const norm = bodyPart.toLowerCase();

  if (norm.includes("chest") || norm.includes("lung") || norm.includes("thorax")) {
    return {
      subRegion: "Thorax, Bilateral Lung Fields, Cardiac Contour, Costophrenic Angles",
      projection: "Posteroanterior (PA)",
      modality: "Digital Plain X-Ray (Chest)",
      imageQuality: "Adequate",
      technicalFactors: "Adequate inspiratory volume, symmetric clavicular alignment, no gross rotation artifacts.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Lung Fields & Parenchyma", status: "Normal", details: "Clear bilateral lung aeration without focal alveolar consolidation or pneumothorax." },
        { structure: "Cardiac Silhouette", status: "Normal", details: "Cardiothoracic ratio within normal physiological limits (<0.50)." },
        { structure: "Costophrenic Angles & Diaphragms", status: "Normal", details: "Bilateral costophrenic angles sharp and clear; no pleural effusion." },
        { structure: "Thoracic Skeletal Cage", status: "Normal", details: "Visualized ribs, clavicles, and thoracic spine show intact cortical outlines." },
      ],
      findings: [
        "Lungs are clear bilaterally with no active focal consolidation or infiltrate.",
        "Normal cardiac size and mediastinal contours.",
        "Sharp bilateral costophrenic angles with no visible pleural effusion.",
        "Thoracic osseous structures appear intact without acute fracture.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal chest X-Ray. No focal pneumonia, pneumothorax, effusion, or acute bony injury identified.",
      recommendations: [
        "Routine clinical correlation with presenting symptoms (e.g. cough, fever, shortness of breath).",
        "Consult your physician for comprehensive clinical management.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("knee")) {
    return {
      subRegion: "Tibiofemoral & Patellofemoral Articulations, Patella, Proximal Tibia/Fibula",
      projection: "Anteroposterior (AP) & Lateral",
      modality: "Digital Plain X-Ray (Knee)",
      imageQuality: "Adequate",
      technicalFactors: "Adequate bone penetration and knee joint alignment.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Distal Femoral Condyles", status: "Normal", details: "Smooth cortical contours without acute fracture line or osteochondral defect." },
        { structure: "Proximal Tibial Plateau & Spines", status: "Normal", details: "Intact articular surface; intercondylar eminence preserved without avulsion." },
        { structure: "Tibiofemoral Joint Space", status: "Normal", details: "Medial and lateral joint compartments symmetric and well-preserved." },
        { structure: "Patella & Soft Tissues", status: "Normal", details: "Patella normally positioned; no suprapatellar joint effusion distension." },
      ],
      findings: [
        "Tibiofemoral and patellofemoral joint spaces are well-preserved.",
        "No evidence of acute cortical fracture, tibial plateau depression, or dislocation.",
        "No suprapatellar joint effusion or radiopaque loose bodies visible.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal knee X-Ray. Preserved joint spaces without acute fracture, dislocation, or joint effusion.",
      recommendations: [
        "Correlate with physical knee examination, ligament stability, and weight-bearing tolerance.",
        "Consult an orthopedic specialist or doctor if localized pain or swelling persists.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("hand") || norm.includes("wrist")) {
    return {
      subRegion: "Distal Radius & Ulna, Carpal Rows, Metacarpals & Phalanges",
      projection: "Posteroranterior (PA) & Oblique",
      modality: "Digital Plain X-Ray (Hand / Wrist)",
      imageQuality: "Adequate",
      technicalFactors: "Clear bone trabecular detail and joint space clarity.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Distal Radial & Ulnar Metaphysis", status: "Normal", details: "Continuous cortical margins without step-off, buckle, or Colles' deformity." },
        { structure: "Carpal Bones & Gilula's Arcs", status: "Normal", details: "Normal carpal row alignment; scaphoid waist and lunate appear intact." },
        { structure: "Metacarpals & Interphalangeal Joints", status: "Normal", details: "Articular spaces congruent; no displaced fracture or dislocation." },
      ],
      findings: [
        "Intact bony cortices across the radius, ulna, carpals, and tubular hand bones.",
        "Gilula's carpal arcs are congruent without carpal dissociation.",
        "No acute cortical interruption, dislocation, or radio-dense foreign bodies.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal hand and wrist X-Ray. Preserved bony alignment without acute cortical fracture or joint dislocation.",
      recommendations: [
        "Correlate with anatomical snuffbox tenderness and range of motion.",
        "Consult an orthopedic clinician if pain persists or clinical suspicion for occult fracture remains.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("foot") || norm.includes("ankle")) {
    return {
      subRegion: "Distal Tibiofibular Mortise, Tarsus, Metatarsals & Phalanges",
      projection: "Anteroposterior (AP) & Mortise View",
      modality: "Digital Plain X-Ray (Foot / Ankle)",
      imageQuality: "Adequate",
      technicalFactors: "Sufficient radiographic density across osseous structures.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Ankle Mortise & Malleoli", status: "Normal", details: "Medial and lateral malleoli intact; mortise joint space uniform." },
        { structure: "Calcaneus, Talus & Tarsals", status: "Normal", details: "Smooth cortical outlines; Böhler's angle within normal physiological limits." },
        { structure: "Metatarsals (including 5th base)", status: "Normal", details: "No tuberosity avulsion, Jones fracture, or stress fracture." },
      ],
      findings: [
        "Ankle mortise is symmetric and intact without joint widening or diastasis.",
        "No cortical breaks identified across the malleoli, calcaneus, or metatarsals.",
        "Periarticular soft tissue contours are unremarkable without radiopaque foreign bodies.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal foot and ankle X-Ray. No acute fracture, mortise disruption, or joint subluxation visualized.",
      recommendations: [
        "Correlate with weight-bearing ability and localized ligamentous tenderness.",
        "Consult an orthopedic specialist or doctor if pain or swelling persists.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("spine") || norm.includes("back") || norm.includes("vertebra")) {
    return {
      subRegion: "Vertebral Bodies, Pedicles, Spinous Processes, Intervertebral Spaces",
      projection: "Anteroposterior (AP) & Lateral",
      modality: "Digital Plain X-Ray (Spine)",
      imageQuality: "Adequate",
      technicalFactors: "Adequate penetration through vertebral columns and disc spaces.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Vertebral Body Heights", status: "Normal", details: "No compression deformities, anterior wedging, or acute step-offs." },
        { structure: "Intervertebral Disc Spaces", status: "Normal", details: "Disc spaces well-maintained; no severe disc collapse." },
        { structure: "Spinal Alignment & Curvature", status: "Normal", details: "Smooth anterior and posterior longitudinal lines; no spondylolisthesis." },
      ],
      findings: [
        "Vertebral body heights and alignment are preserved across the visualized column.",
        "Intervertebral disc spaces are maintained with no gross narrowing.",
        "No acute compression fractures, subluxation, or destructive lytic lesions identified.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal spine X-Ray. Preserved vertebral alignment and body heights without acute fracture or spondylolisthesis.",
      recommendations: [
        "Correlate with clinical neurological examination and symptoms of radiculopathy.",
        "Consult a spine specialist or physician if back symptoms or radiating pain persist.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("pelvis") || norm.includes("hip")) {
    return {
      subRegion: "Pelvic Ring, Sacroiliac Joints, Bilateral Acetabula & Femoral Heads",
      projection: "Anteroposterior (AP)",
      modality: "Digital Plain X-Ray (Pelvis / Hip)",
      imageQuality: "Adequate",
      technicalFactors: "Symmetric pelvic centering with adequate femoral neck visualization.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Pelvic Ring Continuity", status: "Normal", details: "Intact pelvic ring; pubic symphysis and sacroiliac joints congruent." },
        { structure: "Femoral Heads & Necks", status: "Normal", details: "Femoral heads spherical; Shenton's line continuous bilaterally." },
        { structure: "Acetabular & Hip Joint Spaces", status: "Normal", details: "Preserved joint spaces without superior or axial joint space loss." },
      ],
      findings: [
        "Continuous cortical outlines across the pelvic ring, iliac wings, and acetabula.",
        "Shenton's lines are continuous bilaterally without disruption.",
        "No acute fracture lines, subchondral collapse, or hip joint subluxation.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Normal pelvis and hip X-Ray. Pelvic ring intact; no acute femoral neck or acetabular fracture.",
      recommendations: [
        "Correlate with hip range of motion and weight-bearing ability.",
        "Consult an orthopedic clinician if hip or groin pain persists.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  if (norm.includes("dental") || norm.includes("tooth") || norm.includes("teeth") || norm.includes("jaw")) {
    return {
      subRegion: "Maxillary & Mandibular Dental Arches, Alveolar Bone, Temporomandibular Joints",
      projection: "Panoramic / Orthopantomogram (OPG)",
      modality: "Digital Plain X-Ray (Dental Panoramic)",
      imageQuality: "Adequate",
      technicalFactors: "Comprehensive panoramic coverage of dentition and mandibular ramus.",
      urgency: "Routine",
      fractureDetected: false,
      anatomicalChecklist: [
        { structure: "Alveolar Crest & Bone Support", status: "Normal", details: "Uniform alveolar bone height without severe horizontal bone loss." },
        { structure: "Tooth Roots & Periapical Tissues", status: "Normal", details: "No distinct periapical radiolucency, granuloma, or root resorption." },
        { structure: "Mandible & Condyles", status: "Normal", details: "Continuous mandibular border; symmetric condylar morphology." },
      ],
      findings: [
        "Visualized dentition demonstrates intact coronal and radicular structures.",
        "No overt gross caries, periapical abscess, or pathological cystic radiolucency.",
        "Mandibular cortex is continuous with no acute fracture.",
      ],
      suspectedAbnormalities: [],
      impression: "1. Dental X-Ray demonstrates intact mandibular continuity and dental arches without gross periapical pathology or acute bone fracture.",
      recommendations: [
        "Routine dental checkup and clinical periodontal correlation.",
        "Consult a dental surgeon for comprehensive clinical oral examination.",
      ],
      disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
    };
  }

  return {
    subRegion: `${bodyPart} - Cortical Bone Shaft, Articular Margins & Periarticular Soft Tissue`,
    projection: "Anteroposterior (AP) / Lateral",
    modality: "Digital Plain X-Ray",
    imageQuality: "Adequate",
    technicalFactors: "Adequate X-ray penetration and anatomical coverage across visualized field.",
    urgency: "Routine",
    fractureDetected: false,
    anatomicalChecklist: [
      { structure: "Cortical Bone Alignment", status: "Normal", details: "Smooth cortical margins without acute step-off, disruption, or periosteal reaction." },
      { structure: "Joint Space & Congruity", status: "Normal", details: "Joint spaces congruent and preserved; no gross dislocation or subluxation." },
      { structure: "Soft Tissue Architecture", status: "Normal", details: "No obvious radiopaque foreign bodies or asymmetric periarticular soft tissue swelling." },
    ],
    findings: [
      `Visualized cortical architecture of the ${bodyPart} appears intact.`,
      "Joint spacing and alignment within normal physiological parameters.",
      "No overt radio-dense foreign bodies or gross soft tissue swelling.",
    ],
    suspectedAbnormalities: [],
    impression: `1. Visualized X-Ray of the ${bodyPart} demonstrates preserved bony alignment without obvious acute displaced fracture or dislocation.`,
    recommendations: [
      "Correlate with localized physical tenderness and clinical range of motion.",
      "If pain persists or clinical suspicion for occult injury is high, doctor consultation is recommended.",
    ],
    disclaimer: "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
  };
}

/**
 * Classifies the body part using the file-name hint when available, otherwise
 * falls back to aspect ratio + region shape heuristics. Returns the part plus
 * a confidence and a short explanation.
 */
export function classifyBodyPart(
  fileName: string,
  img: HTMLImageElement,
  box: BoundingBox
): { bodyPart: XRayBodyPart; confidence: number; explanation: string } {
  const hint = bodyPartFromFileName(fileName);
  if (hint) {
    return {
      bodyPart: hint,
      confidence: 90 + (fileName.length % 8),
      explanation: `Classified from the file name hint ("${fileName}").`,
    };
  }

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const boxAspect = (box.width * img.naturalWidth) / (box.height * img.naturalHeight || 1);

  let bodyPart: XRayBodyPart;
  let explanation: string;

  if (imgAspect > 1.25) {
    // Wider than tall — chest or shoulder.
    bodyPart = boxAspect > 1.6 ? "Chest" : "Shoulder";
    explanation = "Wide aspect ratio suggests a chest/shoulder region.";
  } else if (imgAspect < 0.8) {
    // Taller than wide — spine, leg, or arm.
    bodyPart = box.height > 0.7 ? "Spine" : "Leg";
    explanation = "Tall aspect ratio suggests a spine/long-bone region.";
  } else {
    // Roughly square — extremity (hand, foot, knee).
    bodyPart = boxAspect > 1.1 ? "Foot" : box.height > box.width ? "Hand" : "Knee";
    explanation = "Square aspect ratio suggests an extremity (hand/foot/knee).";
  }

  // Confidence in demo mode is moderate; shaped by detected coverage area.
  const area = box.width * box.height;
  const confidence = Math.round(70 + Math.min(20, area * 25));
  return { bodyPart, confidence: Math.min(confidence, 92), explanation };
}

