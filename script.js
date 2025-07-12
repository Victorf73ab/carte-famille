// Initialisation de la carte centrée sur la France
const map = L.map('map').setView([46.8, 2.5], 6);

// Ajout des tuiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Tableau pour stocker les marqueurs
let markers = [];
const photoMap = {
  "ALice Dupont": "images/victor.jpg",
  "Marc Dupont": "images/default.jpg",
  "Sophie Martin": "images/default.jpg"
};
// Fonction pour charger et afficher les données selon l'année
function loadData(year) {
  fetch('data/famille.geojson') // Assure-toi que le fichier est bien à la racine
    .then(response => response.json())
    .then(data => {
      // Supprimer les anciens marqueurs
      markers.forEach(marker => map.removeLayer(marker));
      markers = [];

      // Parcourir les données GeoJSON
data.features.forEach(feature => {
  const featureYear = parseInt(feature.properties.year);
  if (featureYear === year) {
    const [lon, lat] = feature.geometry.coordinates;
    const name = feature.properties.name;
   const photoUrl = photoMap[name] || 'images/default.jpg';

    // Créer une icône personnalisée avec la photo
    const customIcon = L.icon({
      iconUrl: photoUrl,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
      popupAnchor: [0, -25]
    });

    // Créer le marqueur avec l'icône personnalisée
    const marker = L.marker([lat, lon], { icon: customIcon })
      .addTo(map)
      .bindPopup(`<strong>${name}</strong><br>Année : ${year}`);
    markers.push(marker);
  }
});
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
