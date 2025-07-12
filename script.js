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

    // Configuration du slider
    yearInput.min = minYear;
    yearInput.max = maxYear;
    yearInput.step = 1;
    yearInput.value = minYear;
    yearLabel.textContent = minYear;

    // Chargement initial
    loadData(minYear);

    // Mise à jour de la carte quand le slider change
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

      // Dictionnaire des dernières positions connues
      const latestLocations = {};

      // Parcourir toutes les entrées du GeoJSON
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

      // Afficher les marqueurs à partir des dernières positions connues
      for (const name in latestLocations) {
        const { lat, lon, year: lastYear } = latestLocations[name];
        const photoUrl = photoMap[name] || 'images/default.jpg';

        const customIcon = L.icon({
          iconUrl: photoUrl,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        const marker = L.marker([lat, lon], { icon: customIcon })
          .addTo(map)
        .bindPopup(`
  <strong>${name}</strong><br>
  ${latestLocations[name].ville}<br>
  <em>${latestLocations[name].info || ''}</em>
`);
        markers.push(marker);
      }
    })
    .catch(error => {
      console.error("Erreur lors du chargement du fichier GeoJSON :", error);
    });
}

