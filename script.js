// Dictionnaire des photos associées aux noms
const photoMap = {
  "Victor Fromentin": "images/victor.jpg",
  "Marc Dupont": "images/default.jpg",
  "Sophie Martin": "images/default.jpg"
};

// Initialisation de la carte
const map = L.map('map').setView([46.8, 2.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

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

        // Ignorer si l'entrée est dans le futur
        if (featureYear <= year) {
          const [lon, lat] = feature.geometry.coordinates;

          // Met à jour la dernière position connue
          latestLocations[name] = {
            lat,
            lon,
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
          .bindPopup(`<strong>${name}</strong><br>Dernière position : ${lastYear}`);
        markers.push(marker);
      }
    })
    .catch(error => {
      console.error("Erreur lors du chargement du fichier GeoJSON :", error);
    });
}

// Gestion du slider de l'année
const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');

yearInput.addEventListener('input', () => {
  const selectedYear = parseInt(yearInput.value);
  yearLabel.textContent = selectedYear;
  loadData(selectedYear);
});

// Chargement initial
loadData(parseInt(yearInput.value));
