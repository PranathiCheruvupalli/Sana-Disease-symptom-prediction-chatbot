/* ==========================================================
Sana — frontend logic (vanilla JS)
Modes:
- DEMO: set USE_DEMO = true to use a simple keyword matcher
- REAL: point API_BASE_URL to your backend that implements POST /predict
========================================================== */

const USE_DEMO = true; // Toggle to false when you have a backend
const API_BASE_URL = ""; // e.g., "https://your-backend.onrender.com" (no trailing slash)

// --- Cached elements ---
const chatWin = document.getElementById("chat-window");
const input = document.getElementById("message");
const sendBtn = document.getElementById("send");
const nameEl = document.getElementById("name");
const ageEl = document.getElementById("age");
const cityEl = document.getElementById("city");

const results = {
  box: document.getElementById("results"),
  name: document.getElementById("out-name"),
  age: document.getElementById("out-age"),
  disease: document.getElementById("out-disease"),
  severity: document.getElementById("out-severity"),
  desc: document.getElementById("out-desc"),
  prec: document.getElementById("out-precautions"),
  cta: document.getElementById("cta"),
};

// --- Simple demo knowledge base (replace with real API later) ---
const DEMO_DB = {
  flu: {
    keys: ["fever", "cough", "sore_throat", "fatigue"],
    desc: "Influenza is a viral infection that attacks your respiratory system.",
    precautions: [
      "Rest",
      "Hydrate well",
      "Paracetamol for fever",
      "Consult a doctor if it worsens",
    ],
  },
  migraine: {
    keys: ["headache", "nausea", "sensitivity_to_light", "throbbing"],
    desc: "Migraine is a neurological condition causing intense, debilitating headaches.",
    precautions: ["Dark, quiet room", "Hydrate", "Avoid triggers", "Consult a physician"],
  },
  covid_19: {
    keys: ["fever", "dry_cough", "loss_of_smell", "loss_of_taste"],
    desc: "COVID-19 is a contagious respiratory disease caused by SARS-CoV-2.",
    precautions: ["Mask", "Isolation", "Hydration", "Medical advice if severe"],
  },
};

// --- Utility functions ---
function msg(content, role = "bot") {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = content;
  chatWin.appendChild(el);
  chatWin.scrollTop = chatWin.scrollHeight;
}

function csvToArray(str) {
  return str
    .toLowerCase()
    .replaceAll(/\s+/g, "_")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function severityFromSymptoms(symptoms, age) {
  let base = symptoms.length >= 4 ? "High" : symptoms.length >= 2 ? "Moderate" : "Low";
  if (age > 60 && base !== "Unknown") base = "High";
  if (age < 12 && base === "Moderate") base = "High";
  return base;
}

// --- DEMO MODE prediction ---
function demoPredict({ name, age, city, symptoms }) {
  const sset = new Set(symptoms);
  let best = { disease: "Unknown", score: 0, key: null };

  for (const [k, v] of Object.entries(DEMO_DB)) {
    const score = v.keys.reduce((acc, key) => acc + (sset.has(key) ? 1 : 0), 0);
    if (score > best.score) best = { disease: k, score, key: k };
  }

  const disease = best.disease.replaceAll("_", " ");
  const info = DEMO_DB[best.key] || { desc: "No description.", precautions: [] };
  const severity = severityFromSymptoms(symptoms, age);

  return {
    name,
    age,
    city,
    disease: disease === "Unknown" ? "No confident match" : disease,
    severity,
    desc: info.desc,
    precautions: info.precautions,
  };
}

// --- REAL API MODE prediction ---
async function apiPredict({ name, age, city, symptoms }) {
  const res = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, age, city, symptoms }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return await res.json();
}

// --- Handle user input ---
async function handleSend() {
  const text = input.value.trim();
  if (!text) return;

  const name = nameEl.value.trim();
  const age = parseInt(ageEl.value, 10);
  const city = cityEl.value.trim();

  if (!name || !age || !city) {
    msg("Please fill name, age and city first.", "bot");
    return;
  }

  // user message
  msg(text, "user");
  input.value = "";

  // parse symptoms
  const symptoms = csvToArray(text);
  msg("Analyzing your symptoms…", "bot");

  try {
    const payload = { name, age, city, symptoms };
    const result = USE_DEMO ? demoPredict(payload) : await apiPredict(payload);
    showResults(result);
    msg(
      `Based on your input, I suspect ${result.disease} with ${result.severity} severity. See the side panel for details.`,
      "bot"
    );
  } catch (err) {
    console.error(err);
    msg("I couldn't get a prediction right now. Please try again.", "bot");
  }
}

// --- Display results ---
function showResults({ name, age, disease, severity, desc, precautions, city }) {
  results.name.textContent = name;
  results.age.textContent = age;
  results.disease.textContent = disease;
  results.severity.textContent = severity;
  results.desc.textContent = desc || "—";
  results.prec.innerHTML = "";

  (precautions || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    results.prec.appendChild(li);
  });

  results.cta.innerHTML =
    severity === "High"
      ? `🚨 Urgent: Please consult a doctor in <strong>${city}</strong> immediately.`
      : severity === "Moderate"
      ? `🙂 Monitor your condition and consult a doctor in <strong>${city}</strong> if symptoms persist.`
      : `✅ Low risk. Rest and hydrate. Stay healthy!`;

  results.box.hidden = false;
}

// --- Event listeners ---
sendBtn.addEventListener("click", handleSend);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

// --- Optional: voice input via Web Speech API ---
const micBtn = document.getElementById("mic-btn");
const micStatus = document.getElementById("mic-status");
let recognition = null;

try {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      micStatus.textContent = `Heard: ${transcript}`;
    };

    recognition.onend = () => {
      micBtn.textContent = "Start listening";
    };

    micBtn.addEventListener("click", () => {
      if (micBtn.textContent.includes("Start")) {
        recognition.start();
        micBtn.textContent = "Stop listening";
      } else {
        recognition.stop();
        micBtn.textContent = "Start listening";
      }
    });
  } else {
    micBtn.disabled = true;
    micStatus.textContent = "Speech recognition not supported in this browser.";
  }
} catch (e) {
  console.warn("Speech API error", e);
}

// --- Greeting ---
msg("Hi! I'm Sana. Tell me your symptoms as a comma-separated list (e.g., fever, cough, sore throat).", "bot");
