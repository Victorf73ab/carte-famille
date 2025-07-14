// 📸 Dictionnaire des photos associées aux noms
const photoMap = {
  "Victor Fromentin": "images/victorperso.jpg",
  "Nicolas Fromentin": "images/nico.jpg",
  "Anouk Fromentin": "images/default.jpg"
};

// 🗺️ Initialisation de la carte
const map = L.map('map').setView([46.8, 2.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

// 🕷️ Initialisation du plugin OverlappingMarkerSpiderfier
const oms = new OverlappingMarkerSpiderfier(map, {
  keepSpiderfied: true,
  nearbyDistance: 20
});

// 🎚️ Récupération des éléments du slider
const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');

// 📄 URL de la Google Sheets publiée en CSV
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?output=csv';

// 🔍 Fonction pour parser le CSV
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = values[i].trim();
    });
    obj.year = parseInt(obj.year);
    obj.lat = parseFloat(obj.lat);
    obj.lon = parseFloat(obj.lon);
    return obj;
  });
}

// 📅 Chargement des données depuis Google Sheets
fetch(sheetUrl)
  .then(response => response.text())
  .then(csv => {
    const peopleData = parseCSV(csv);
    const years = peopleData.map(p => p.year);
    const minYear = Math.min(...years);
    const maxYear = 2025;

    yearInput.min = minYear;
    yearInput.max = maxYear;
    yearInput.step = 1;
    yearInput.value = minYear;
    yearLabel.textContent = minYear;

    loadDataFromArray(peopleData, minYear);

    yearInput.addEventListener('input', () => {
      const selectedYear = parseInt(yearInput.value);
      yearLabel.textContent = selectedYear;
      loadDataFromArray(peopleData, selectedYear);
    });
  })
  .catch(error => {
    console.error("Erreur lors du chargement des données Google Sheets :", error);
  });

// 📍 Fonction principale pour afficher les points
function loadDataFromArray(data, year) {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  oms.clearMarkers();

  const latestLocations = {};

  data.forEach(person => {
    if (person.year <= year) {
      latestLocations[person.name] = {
        lat: person.lat,
        lon: person.lon,
        ville: person.ville,
        info: person.info,
        year: person.year
      };
    }
  });

  const locationGroups = {};
  for (const name in latestLocations) {
    const { lat, lon } = latestLocations[name];
    const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
    if (!locationGroups[key]) locationGroups[key] = [];
    locationGroups[key].push(name);
  }

  for (const key in locationGroups) {
    const group = locationGroups[key];

    group.forEach((name) => {
      const { lat, lon, ville, info } = latestLocations[name];
      const photoUrl = photoMap[name] || 'images/default.jpg';

      const customIcon = L.icon({
        iconUrl: photoUrl,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
      });

      const marker = L.marker([lat, lon], { icon: customIcon })
        .bindPopup(`
          <strong>${name}</strong><br>
          ${ville}<br>
          <em>${info || ''}</em>
        `);

      marker.addTo(map);
      oms.addMarker(marker);
      markers.push(marker);
    });
  }

  oms.addListener('click', function(marker) {
    marker.openPopup();
  });
}
