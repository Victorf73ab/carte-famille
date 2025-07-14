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
    obj.lat = parseFloat(obj.lat);
    obj.lon = parseFloat(obj.lon);
    return obj;
  });
}

// 🔍 Fonction pour créer le dictionnaire des photos
function loadPhotoMap(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const map = {};
  lines.slice(1).forEach(line => {
    const values = line.split(',');
    const name = values[0].trim();
    const photo = values[1] ? values[1].trim() : 'images/default.jpg';
    map[name] = photo;
  });
  return map;
}

// 🔧 Vérifie si une image est valide, sinon retourne l’image par défaut
function validateImage(url, fallback = 'images/default.jpg') {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(fallback);
    img.src = url;
  });
}

// 📦 Chargement des deux feuilles en parallèle
Promise.all([
  fetch(dataSheetUrl).then(r => r.text()),
  fetch(photoSheetUrl).then(r => r.text())
])
.then(([csvData, csvPhotos]) => {
  const peopleData = parseCSV(csvData);
  const photoMap = loadPhotoMap(csvPhotos);

  const years = peopleData.map(p => p.year).filter(y => !isNaN(y));
  const minYear = Math.min(...years);
  const maxYear = 2025;

  yearInput.min = minYear;
  yearInput.max = maxYear;
  yearInput.step = 1;
  yearInput.value = minYear;
  yearLabel.textContent = minYear;

  loadDataFromArray(peopleData, photoMap, minYear);

  yearInput.addEventListener('input', () => {
    const selectedYear = parseInt(yearInput.value);
    yearLabel.textContent = selectedYear;
    loadDataFromArray(peopleData, photoMap, selectedYear);
  });
})
.catch(error => {
  console.error("Erreur lors du chargement des données Google Sheets :", error);
});

// 📍 Fonction principale pour afficher les points
function loadDataFromArray(data, photoMap, year) {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  oms.clearMarkers();

  const latestLocations = {};
  const personLines = {};

  // Regrouper toutes les lignes par personne
  data.forEach(person => {
    if (!person.name || isNaN(person.year)) return;
    if (!personLines[person.name]) personLines[person.name] = [];
    personLines[person.name].push(person);
  });

  for (const name in personLines) {
    const lines = personLines[name]
      .filter(p => p.year <= year)
      .sort((a, b) => a.year - b.year);

    if (lines.length === 0) continue;

    let lastValidLine = null;
    let hasStopped = false;

    for (const line of lines) {
      const info = line.info ? line.info.toLowerCase() : '';
      const isStop = info.includes("stop");
      const isFinal = info.includes("décès") || info.includes("divorce");

      if (isStop && line.year <= year) {
        hasStopped = true;
      }

      if (isFinal) {
        if (line.year === year) lastValidLine = line;
        if (line.year < year) hasStopped = true;
      }

      if (!hasStopped && !isFinal) {
        lastValidLine = line;
      }
    }

    if (lastValidLine && !hasStopped) {
      latestLocations[name] = {
        lat: lastValidLine.lat,
        lon: lastValidLine.lon,
        ville: lastValidLine.ville,
        info: lastValidLine.info,
        year: lastValidLine.year
      };
    }
  }

  const locationGroups = {};
  for (const name in latestLocations) {
    const { lat, lon } = latestLocations[name];
    const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
    if (!locationGroups[key]) locationGroups[key] = [];
    locationGroups[key].push(name);
  }

  for (const key in locationGroups) {
    const group = locationGroups[key];
    const { lat, lon } = latestLocations[group[0]];
    const ville = latestLocations[group[0]].ville;

    if (group.length === 1) {
      const name = group[0];
      const info = latestLocations[name].info || '';
      const rawPhotoUrl = photoMap[name] || 'images/default.jpg';

      validateImage(rawPhotoUrl).then(validPhotoUrl => {
        const customIcon = L.icon({
          iconUrl: validPhotoUrl,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        const marker = L.marker([lat, lon], { icon: customIcon })
          .bindPopup(`
            <strong>${name}</strong><br>
            ${ville}<br>
            <em>${info}</em>
          `);

        marker.addTo(map);
        oms.addMarker(marker);
        markers.push(marker);
      });
    } else {
      const rawGroupPhoto = photoMap["Groupe"] || 'images/group.jpg';

      validateImage(rawGroupPhoto).then(validGroupPhoto => {
        const groupIcon = L.icon({
          iconUrl: validGroupPhoto,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        const groupMarker = L.marker([lat, lon], { icon: groupIcon });
        groupMarker.addTo(map);
        oms.addMarker(groupMarker);
        markers.push(groupMarker);

        group.forEach((name, index) => {
          const info = latestLocations[name].info || '';
          const rawPhotoUrl = photoMap[name] || 'images/default.jpg';

          validateImage(rawPhotoUrl).then(validPhotoUrl => {
            const individualIcon = L.icon({
              iconUrl: validPhotoUrl,
              iconSize: [50, 50],
              iconAnchor: [25, 25],
              popupAnchor: [0, -25]
            });

            const offset = 0.00005 * index;
            const marker = L.marker([lat + offset, lon + offset], { icon: individualIcon })
              .bindPopup(`
                <strong>${name}</strong><br>
                ${ville}<br>
                <em>${info}</em>
              `);

            marker.addTo(map);
            oms.addMarker(marker);
            markers.push(marker);
          });
        });
      });
    }
  }

  oms.addListener('click', function(marker) {
    marker.openPopup();
  });

  // 🧭 Ajustement automatique de la carte après ajout des marqueurs
  setTimeout(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => m.getLatLng()));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, 600);
}
