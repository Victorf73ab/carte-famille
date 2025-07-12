const map = L.map('map').setView([46.8, 2.5], 6); // Vue sur la France

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

function loadData(year) {
  fetch('data/family_locations.geojson')
    .then(response => response.json())
    .then(data => {
      // Supprimer les anciens marqueurs
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      data.features.forEach(feature => {
        if (parseInt(feature.properties.year) === year) {
          const [lon, lat] = feature.geometry.coordinates;
          const marker = L.marker([lat, lon])
            .addTo(map)
            .bindPopup(`<strong>${feature.properties.name}</strong><br>Année : ${year}`);
          markers.push(marker);
        }
      });
    });
}

const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');

yearInput.addEventListener('input', () => {
  const selectedYear = parseInt(yearInput.value);
  yearLabel.textContent = selectedYear;
  loadData(selectedYear);
});

// Charger les données initiales
loadData(parseInt(yearInput.value));
