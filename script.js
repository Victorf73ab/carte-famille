// 🗺️ Initialisation de la carte
const map = L.map('map').setView([53.0, 15.0], 4); // Vue centrée sur l’Europe, zoom dézoommé

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];
let peopleData = [];   // données globales pour le filtrage
let photoMap = {};     // photos globales pour le filtrage

// 🕷️ Initialisation du plugin OverlappingMarkerSpiderfier
const oms = new OverlappingMarkerSpiderfier(map, {
  keepSpiderfied: true,
  nearbyDistance: 20
});

// 🎚️ Récupération des éléments du slider
const yearInput = document.getElementById('year');
const yearLabel = document.getElementById('year-label');

// 📄 URLs des deux onglets Google Sheets
const dataSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?output=csv';
const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1436940582&single=true&output=csv';

// 🔍 Fonction pour parser un CSV en tableau d’objets
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = values[i] ? values[i].trim() : '';
    });
    obj.year = parseInt(obj.year);
    obj.lat  = parseFloat(obj.lat);
    obj.lon  = parseFloat(obj.lon);
    return obj;
  });
}

// 🔍 Fonction pour créer le dictionnaire des photos
function loadPhotoMap(csvText) {
  const lines   = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const map     = {};
  lines.slice(1).forEach(line => {
    const values = line.split(',');
    const name   = values[0].trim();
    const photo  = values[1] ? values[1].trim() : 'images/default.jpg';
    map[name] = photo;
  });
  return map;
}

// 🔧 Vérifie si une image est valide, sinon retourne l’image par défaut
function validateImage(url, fallback = 'images/default.jpg') {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(url);
    img.onerror = () => resolve(fallback);
    img.src     = url;
  });
}

// 📦 Chargement des deux feuilles en parallèle
Promise.all([
  fetch(dataSheetUrl).then(r => r.text()),
  fetch(photoSheetUrl).then(r => r.text())
])
.then(([csvData, csvPhotos]) => {
  peopleData = parseCSV(csvData);
  photoMap   = loadPhotoMap(csvPhotos);

  // Configuration du slider
  const years   = peopleData.map(p => p.year).filter(y => !isNaN(y));
  const minYear = Math.min(...years);
  const maxYear = 2025;

  yearInput.min   = minYear;
  yearInput.max   = maxYear;
  yearInput.step  = 1;
  yearInput.value = minYear;
  yearLabel.textContent = minYear;

  // Remplissage du menu déroulant
  const selectElement = document.getElementById('person-select');
  const uniqueNames  = [...new Set(peopleData.map(p => p.name).filter(n => n))];
  uniqueNames.forEach(name => {
    const option = document.createElement('option');
    option.value   = name;
    option.text    = name;
    selectElement.appendChild(option);
  });

  // Affichage initial
  loadDataFromArray(peopleData, photoMap, minYear);

  // Rechargement au changement d’année
  yearInput.addEventListener('input', () => {
    const y = parseInt(yearInput.value);
    yearLabel.textContent = y;
    loadDataFromArray(peopleData, photoMap, y);
  });

  // Filtrage à chaque sélection dans la liste
  selectElement.addEventListener('change', () => {
    loadDataFromArray(peopleData, photoMap, parseInt(yearInput.value));
  });

  // Bouton "Tout masquer"
  document.getElementById('hide-all').addEventListener('click', () => {
    for (const opt of selectElement.options) {
      opt.selected = false;
    }
    loadDataFromArray(peopleData, photoMap, parseInt(yearInput.value));
  });
})
.catch(error => {
  console.error("Erreur lors du chargement des données Google Sheets :", error);
});

// 📍 Fonction principale pour afficher les points
function loadDataFromArray(data, photoMap, year) {
  // Nettoyage des anciens marqueurs
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  oms.clearMarkers();

  // Récupération des noms sélectionnés
  const selectElem      = document.getElementById('person-select');
  const selectedNames   = Array.from(selectElem.selectedOptions).map(o => o.value);
  const filterIsActive  = selectedNames.length > 0;

  // Regrouper les lignes par personne après filtre
  const latestLocations = {};
  const personLines     = {};

  data.forEach(person => {
    if (!person.name || isNaN(person.year)) return;
    if (filterIsActive && !selectedNames.includes(person.name)) return;
    if (!personLines[person.name]) personLines[person.name] = [];
    personLines[person.name].push(person);
  });

  // Détermination de la dernière position valide pour chaque personne
  for (const name in personLines) {
    const lines = personLines[name]
      .filter(p => p.year <= year)
      .sort((a, b) => a.year - b.year);

    if (!lines.length) continue;

    let lastValid = null, hasStopped = false;
    for (const line of lines) {
      const info    = (line.info || '').toLowerCase();
      const isStop  = info.includes('stop');
      const isFinal = info.includes('décès') || info.includes('divorce');

      if (isStop && line.year <= year) hasStopped = true;
      if (isFinal) {
        if (line.year === year) lastValid = line;
        if (line.year < year) hasStopped = true;
      }
      if (!hasStopped && !isFinal) lastValid = line;
    }

    if (lastValid && !hasStopped) {
      latestLocations[name] = {
        lat:  lastValid.lat,
        lon:  lastValid.lon,
        ville: lastValid.ville,
        info: lastValid.info,
        year: lastValid.year
      };
    }
  }

  // Grouper par coordonnées pour gérer les chevauchements
  const locationGroups = {};
  for (const name in latestLocations) {
    const { lat, lon } = latestLocations[name];
    const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
    if (!locationGroups[key]) locationGroups[key] = [];
    locationGroups[key].push(name);
  }

  // Création et affichage des marqueurs
  for (const key in locationGroups) {
    const group       = locationGroups[key];
    const { lat, lon } = latestLocations[group[0]];
    const ville       = latestLocations[group[0]].ville;

    if (group.length === 1) {
      // Personne seule
      const name        = group[0];
      const rawPhotoUrl = photoMap[name] || 'images/default.jpg';
      const info        = latestLocations[name].info || '';

      validateImage(rawPhotoUrl).then(validUrl => {
        const icon = L.icon({
          iconUrl, iconSize: [50, 50],
          iconAnchor: [25, 25], popupAnchor: [0, -25]
        });
        const marker = L.marker([lat, lon], { icon })
          .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${info}</em>`);
        marker.addTo(map);
        oms.addMarker(marker);
        markers.push(marker);
      });
    } else {
      // Groupe de personnes
      const rawGroupPhoto = photoMap['Groupe'] || 'images/group.jpg';
      validateImage(rawGroupPhoto).then(validUrl => {
        const icon = L.icon({
          iconUrl: validUrl, iconSize: [50, 50],
          iconAnchor: [25, 25], popupAnchor: [0, -25]
        });
        const groupMarker = L.marker([lat, lon], { icon });
        groupMarker.addTo(map);
        oms.addMarker(groupMarker);
        markers.push(groupMarker);

        group.forEach((name, idx) => {
          const rawPhoto = photoMap[name] || 'images/default.jpg';
          const info     = latestLocations[name].info || '';
          validateImage(rawPhoto).then(validUrl => {
            const indIcon = L.icon({
              iconUrl: validUrl, iconSize: [50, 50],
              iconAnchor: [25, 25], popupAnchor: [0, -25]
            });
            const offset = 0.00005 * idx;
            const m = L.marker([lat + offset, lon + offset], { icon: indIcon })
              .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${info}</em>`);
            m.addTo(map);
            oms.addMarker(m);
            markers.push(m);
          });
        });
      });
    }
  }

  // Assure l'ouverture du popup par le spiderfier
  oms.addListener('click', marker => marker.openPopup());
}
