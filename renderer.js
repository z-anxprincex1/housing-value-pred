// Global Map Variables
let map;
let currentTileLayer;
let datasetCirclesLayerGroup;
let suggestionMarker;

// Map style configurations
const tileStyles = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};
const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Current active tab state
let activeTab = 'predictor'; // 'predictor' or 'locality'

// DOM Elements
const tabPredictor = document.getElementById('tab-predictor');
const tabLocality = document.getElementById('tab-locality');
const tabTitle = document.getElementById('tab-title');
const tabDesc = document.getElementById('tab-desc');
const groupIncome = document.getElementById('group-income');
const inputIncome = document.getElementById('input-income');
const form = document.getElementById('prediction-form');
const btnSubmit = document.getElementById('btn-submit');
const btnText = btnSubmit.querySelector('.btn-text');
const btnLoader = btnSubmit.querySelector('.btn-loader');
const resultsCard = document.getElementById('results-card');
const resultValue = document.getElementById('result-value');
const localityResults = document.getElementById('locality-results');
const resultLat = document.getElementById('result-lat');
const resultLng = document.getElementById('result-lng');
const btnLocate = document.getElementById('btn-locate');

const mapStyleDark = document.getElementById('map-style-dark');
const mapStyleLight = document.getElementById('map-style-light');
const mapStyleStreet = document.getElementById('map-style-street');
const toggleDataset = document.getElementById('toggle-dataset');

// Initialize App on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  loadDatasetPoints();
});

// Initialize Leaflet Map centered on California
function initMap() {
  // California Center Coordinates
  const caliCenter = [37.2, -119.5];
  map = L.map('map', {
    center: caliCenter,
    zoom: 6.2,
    zoomControl: true
  });

  // Default layer is Dark Matter
  currentTileLayer = L.tileLayer(tileStyles.dark, {
    attribution: tileAttribution,
    maxZoom: 19
  }).addTo(map);

  datasetCirclesLayerGroup = L.layerGroup().addTo(map);
}

// Setup all DOM and Tab listeners
function setupEventListeners() {
  // Tab Navigation: Predictor Tab
  tabPredictor.addEventListener('click', () => {
    if (activeTab === 'predictor') return;
    activeTab = 'predictor';
    
    tabPredictor.classList.add('active');
    tabPredictor.setAttribute('aria-selected', 'true');
    tabLocality.classList.remove('active');
    tabLocality.setAttribute('aria-selected', 'false');
    
    tabTitle.textContent = "Housing Value Predictor";
    tabDesc.textContent = "Predict median house value based on block demographic features.";
    
    groupIncome.classList.add('hidden');
    inputIncome.removeAttribute('required');
    
    // UI adjustment
    localityResults.classList.add('hidden');
    resultsCard.classList.add('hidden');
  });

  // Tab Navigation: Locality Finder Tab
  tabLocality.addEventListener('click', () => {
    if (activeTab === 'locality') return;
    activeTab = 'locality';
    
    tabLocality.classList.add('active');
    tabLocality.setAttribute('aria-selected', 'true');
    tabPredictor.classList.remove('active');
    tabPredictor.setAttribute('aria-selected', 'false');
    
    tabTitle.textContent = "Locality Finder";
    tabDesc.textContent = "Suggest housing values and map location coordinates based on user demographics and desired median income.";
    
    groupIncome.classList.remove('hidden');
    inputIncome.setAttribute('required', 'true');
    
    // UI adjustment
    resultsCard.classList.add('hidden');
  });

  // Map Tile layer switches
  mapStyleDark.addEventListener('click', () => switchMapStyle('dark', mapStyleDark));
  mapStyleLight.addEventListener('click', () => switchMapStyle('light', mapStyleLight));
  mapStyleStreet.addEventListener('click', () => switchMapStyle('street', mapStyleStreet));

  // Toggle Dataset Overlay checkbox
  toggleDataset.addEventListener('change', (e) => {
    if (e.target.checked) {
      map.addLayer(datasetCirclesLayerGroup);
    } else {
      map.removeLayer(datasetCirclesLayerGroup);
    }
  });

  // Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit();
  });

  // "Locate Suggested Neighborhood" click handler
  btnLocate.addEventListener('click', () => {
    if (suggestionMarker) {
      const latLng = suggestionMarker.getLatLng();
      map.setView(latLng, 12, { animate: true, duration: 1.5 });
      suggestionMarker.openPopup();
    }
  });
}

// Switch base map tile provider
function switchMapStyle(styleKey, buttonEl) {
  [mapStyleDark, mapStyleLight, mapStyleStreet].forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');

  map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(tileStyles[styleKey], {
    attribution: tileAttribution,
    maxZoom: 19
  }).addTo(map);
}

// Retrieve color based on house value scale
function getMarkerColor(value) {
  if (value >= 300000) return '#f59e0b'; // High: Yellow/Orange
  if (value >= 180000) return '#3b82f6'; // Mid: Blue
  return '#10b981';                     // Low: Green
}

// Fetch downsampled housing points and render them as circles
async function loadDatasetPoints() {
  try {
    const response = await fetch('./cali_housing_points.json');
    if (!response.ok) throw new Error("Failed to load historical points file");
    
    const points = await response.json();
    
    points.forEach(p => {
      const color = getMarkerColor(p.val);
      const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.val);
      
      const circle = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        fillColor: color,
        color: '#ffffff',
        weight: 0.8,
        opacity: 0.7,
        fillOpacity: 0.4
      });

      const popupContent = `
        <div class="map-popup-card">
          <strong style="color: ${color}; font-size: 0.95rem; display: block; margin-bottom: 4px;">Demographic Data Point</strong>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; color: #fff;">
            <tr><td style="padding: 2px 0; color: #9ea0b0;">Median Value:</td><td style="font-weight: 600; text-align: right;">${formattedValue}</td></tr>
            <tr><td style="padding: 2px 0; color: #9ea0b0;">Block Age:</td><td style="font-weight: 600; text-align: right;">${p.age} years</td></tr>
            <tr><td style="padding: 2px 0; color: #9ea0b0;">Ocean Proximity:</td><td style="font-weight: 600; text-align: right;">${p.ocean}</td></tr>
          </table>
        </div>
      `;

      circle.bindPopup(popupContent, {
        className: 'leaflet-popup-dark'
      });
      circle.addTo(datasetCirclesLayerGroup);
    });
  } catch (error) {
    console.error("Could not load calibration dataset onto the map:", error);
  }
}

// Perform calculation process
async function handleFormSubmit() {
  // Toggle UI calculating state
  setCalculating(true);
  resultsCard.classList.add('hidden');
  
  // Extract inputs
  const population = parseFloat(document.getElementById('input-population').value);
  const avgBed = parseFloat(document.getElementById('input-avg-bed').value);
  const oceanEncoded = parseInt(document.getElementById('input-ocean').value);
  const age = parseFloat(document.getElementById('input-age').value);
  
  const payload = {
    population: population,
    avg_bed: avgBed,
    ocean_proximity_encoded: oceanEncoded,
    housing_median_age: age
  };

  if (activeTab === 'predictor') {
    payload.type = 'rf1';
  } else {
    payload.type = 'rf2';
    payload.median_income = parseFloat(inputIncome.value);
  }

  try {
    // Send prediction request through IPC Bridge
    const response = await window.api.predict(payload);
    
    if (response.status === 'success') {
      // 1. Format value
      const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(response.value);
      resultValue.textContent = formattedValue;
      
      // 2. Adjust tab specific details
      if (activeTab === 'predictor') {
        localityResults.classList.add('hidden');
      } else {
        localityResults.classList.remove('hidden');
        resultLat.textContent = response.latitude.toFixed(4);
        resultLng.textContent = response.longitude.toFixed(4);
        
        // Render Marker on Map
        updateMapSuggestion(response.latitude, response.longitude, response.value, formattedValue);
      }
      
      // 3. Show Card
      resultsCard.classList.remove('hidden');
      setTimeout(() => {
        resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } else {
      alert("Error calculating prediction: " + response.message);
    }
  } catch (err) {
    alert("Unexpected communication error: " + err.message);
  } finally {
    setCalculating(false);
  }
}

// Handle submit button loading state
function setCalculating(isCalculating) {
  if (isCalculating) {
    btnSubmit.setAttribute('disabled', 'true');
    btnText.textContent = "Calculating Model...";
    btnLoader.classList.remove('hidden');
  } else {
    btnSubmit.removeAttribute('disabled');
    btnText.textContent = "Run Prediction";
    btnLoader.classList.add('hidden');
  }
}

// Add or update suggested locality marker on Leaflet map
function updateMapSuggestion(lat, lng, val, formattedVal) {
  if (suggestionMarker) {
    map.removeLayer(suggestionMarker);
  }

  // Create custom marker icon
  const accentColor = getMarkerColor(val);
  
  // Custom glowing DivIcon
  const suggestionIcon = L.divIcon({
    className: 'suggested-div-icon',
    html: `<div class="pulse-marker" style="background-color: ${accentColor}; box-shadow: 0 0 15px ${accentColor};"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  suggestionMarker = L.marker([lat, lng], { icon: suggestionIcon }).addTo(map);

  const popupHtml = `
    <div class="map-popup-card suggestion-popup">
      <strong style="color: #c084fc; font-size: 1rem; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Suggested Neighborhood</strong>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #fff;">
        <tr><td style="padding: 4px 0; color: #9ea0b0;">Estimated Value:</td><td style="font-weight: 700; text-align: right; color: #4ade80;">${formattedVal}</td></tr>
        <tr><td style="padding: 4px 0; color: #9ea0b0;">Coordinates:</td><td style="font-weight: 600; text-align: right;">${lat.toFixed(4)}, ${lng.toFixed(4)}</td></tr>
      </table>
    </div>
  `;

  suggestionMarker.bindPopup(popupHtml, {
    className: 'leaflet-popup-dark',
    offset: [0, -5]
  });

  // Centering focus on marker
  map.setView([lat, lng], 11, { animate: true, duration: 1.5 });
  
  // Delay popup slightly to allow pan animation to finish smoothly
  setTimeout(() => {
    suggestionMarker.openPopup();
  }, 1600);
}
