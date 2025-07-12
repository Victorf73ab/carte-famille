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
      // Supprimer les anciens marqueurs
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];
      oms.clearMarkers();

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

      // Afficher les marqueurs avec spiderfier
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

      // Optionnel : ouvrir le popup au clic via OMS
      oms.addListener('click', function(marker) {
        marker.openPopup();
      });
    })
    .catch(error => {
      console.error("Erreur lors du chargement du fichier GeoJSON :", error);
    });
}
