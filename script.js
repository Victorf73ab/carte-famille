// 📸 Dictionnaire des photos associées aux noms
const photoMap = {
  "Victor Fromentin": "images/victorperso.jpg",
  "Nicolas Fromentin": "images/default.jpg",
  "Anouk Fromentin": "images/default.jpg"
};

// 🗺️ Initialisation de la carte
const map = L.map('map').setView([46.8, 2.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

// 🎚️ Récupération des éléments du slider
const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');

// 📅 Initialisation dynamique du slider
fetch('data/famille.geojson')
  .then(response => response.json())
  .then(data => {
    const years = data.features.map(f => parseInt(f.properties.year));
    const minYear = Math.min(...years);
    const maxYear = 2025;

    yearInput.min = minYear;
    yearInput.max = maxYear;
    yearInput.step = 1;
    yearInput.value = minYear;
    yearLabel.textContent = minYear;

    loadData(minYear);

    yearInput.addEventListener('input', () => {
      const selectedYear = parseInt(yearInput.value);
      yearLabel.textContent = selectedYear;
      loadData(selectedYear);
    });
  })
  .catch(error => {
    console.error("Erreur lors de l'initialisation du slider :", error);
  });

// 📍 Fonction principale pour afficher les points
function loadData(year) {
  fetch('data/famille.geojson')
    .then(response => response.json())
    .then(data => {
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      const latestLocations = {};

      // Récupérer la dernière position connue pour chaque personne
      data.features.forEach(feature => {
        const featureYear = parseInt(feature.properties.year);
        const name = feature.properties.name;

        if (featureYear <= year) {
          const [lon, lat] = feature.geometry.coordinates;
          latestLocations[name] = {
            lat,
            lon,
            ville: feature.properties.ville,
            info: feature.properties.info,
            year: featureYear
          };
        }
      });

      // Regrouper les personnes par position
      const locationGroups = {};
      for (const name in latestLocations) {
        const { lat, lon } = latestLocations[name];
        const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
        if (!locationGroups[key]) locationGroups[key] = [];
        locationGroups[key].push(name);
      }

      // Afficher les marqueurs avec décalage
      for (const key in locationGroups) {
        const group = locationGroups[key];

        group.forEach((name, index) => {
          const { lat, lon, ville, info } = latestLocations[name];
          const photoUrl = photoMap[name] || 'images/default.jpg';

          // Décalage léger en latitude et longitude
          const offset = 0.0005 * index;
          const adjustedLat = lat + offset;
          const adjustedLon = lon + offset;

          const customIcon = L.icon({
            iconUrl: photoUrl,
            iconSize: [50, 50],
            iconAnchor: [25, 25],
            popupAnchor: [0, -25]
          });

          const marker = L.marker([adjustedLat, adjustedLon], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
              <strong>${name}</strong><br>
              ${ville}<br>
              <em>${info || ''}</em>
            `);
          markers.push(marker);
        });
      }
    })
    .catch(error => {
      console.error("Erreur lors du chargement du fichier GeoJSON :", error);
    });
}
