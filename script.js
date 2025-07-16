// 🗺️ Initialisation de la carte
const map = L.map('map').setView([53.0, 15.0], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];

const personHeader      = document.getElementById('person-header');
const personSelectorDiv = document.getElementById('person-selector');
const personListBlock   = document.getElementById('person-list-container');

personHeader.addEventListener('click', () => {
  const isOpen = personSelectorDiv.classList.toggle('open');
  personListBlock.style.display = isOpen ? 'block' : 'none';
});

// 🕷️ OverlappingMarkerSpiderfier
const oms = new OverlappingMarkerSpiderfier(map, {
  keepSpiderfied: true,
  nearbyDistance: 20
});

// 🎚️ Récupération des éléments du DOM
const yearInput  = document.getElementById('year');
const yearLabel  = document.getElementById('year-label');
const personList = document.getElementById('person-list');
const hideAllBtn = document.getElementById('hide-all');

// 📄 URLs des onglets Google Sheets (format CSV)
const dataSheetUrl  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?output=csv';
const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1436940582&single=true&output=csv';
const groupSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1406949721&single=true&output=csv';

// 🌐 Stockage global
let peopleData = [];
let photoMap    = {};
let groupMap    = {};

// 🔍 Fonction pour parser un CSV en tableau d’objets
function parseCSV(text) {
  const lines   = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj    = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = values[i] ? values[i].trim() : '';
    });
    obj.year = parseInt(obj.year, 10);
    obj.lat  = parseFloat(obj.lat);
    obj.lon  = parseFloat(obj.lon);
    return obj;
  });
}

// 🔍 Fonction pour créer le dictionnaire des photos
function loadPhotoMap(csvText) {
  const lines = csvText.trim().split('\n').slice(1);
  const map   = {};
  lines.forEach(line => {
    const [name, url] = line.split(',').map(s => s.trim());
    map[name] = url || 'images/default.jpg';
  });
  return map;
}

// 🔍 Fonction pour créer le dictionnaire des groupes
function loadGroupMap(csvText) {
  const lines = csvText.trim().split('\n').slice(1);
  const map   = {};
  lines.forEach(line => {
    const [group, members] = line.split(',').map(s => s.trim());
    if (!group || !members) return;
    map[group] = members.split(';').map(n => n.trim());
  });
  return map;
}

// 🔧 Vérifie si une URL d’image est valide, fallback sinon
function validateImage(url, fallback = 'images/default.jpg') {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve(url);
    img.onerror = () => resolve(fallback);
    img.src     = url;
  });
}

// 📦 Chargement des trois feuilles en parallèle
Promise.all([
  fetch(dataSheetUrl).then(r => r.text()),
  fetch(photoSheetUrl).then(r => r.text()),
  fetch(groupSheetUrl).then(r => r.text())
])
.then(([csvData, csvPhotos, csvGroups]) => {
  peopleData = parseCSV(csvData);
  photoMap   = loadPhotoMap(csvPhotos);
  groupMap   = loadGroupMap(csvGroups);

  // 📅 Configuration du slider
  const years   = peopleData.map(p => p.year).filter(y => !isNaN(y));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years, 2025);

  yearInput.min   = minYear;
  yearInput.max   = maxYear;
  yearInput.step  = 1;
  yearInput.value = minYear;
  yearLabel.textContent = minYear;

  // 👥 Génération des cases à cocher pour chaque groupe
  Object.keys(groupMap).forEach(groupName => {
    const label    = document.createElement('label');
    label.style.display     = 'block';
    label.style.marginBottom = '4px';

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.value   = groupName;
    checkbox.checked = true;
    checkbox.style.marginRight = '6px';

    // Au changement, on recharge la carte
    checkbox.addEventListener('change', () => {
      loadDataFromArray(parseInt(yearInput.value, 10));
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + groupName));
    personList.appendChild(label);
  });

  // Affichage initial de la carte
  loadDataFromArray(minYear);

  // ⏳ Événement du slider
  yearInput.addEventListener('input', () => {
    const y = parseInt(yearInput.value, 10);
    yearLabel.textContent = y;
    loadDataFromArray(y);
  });

  // 🛑 Bouton "Tout masquer"
  hideAllBtn.addEventListener('click', () => {
    Array.from(personList.querySelectorAll('input[type="checkbox"]'))
      .forEach(cb => cb.checked = false);
    loadDataFromArray(parseInt(yearInput.value, 10));
  });
})
.catch(err => console.error('Erreur chargement Google Sheets :', err));

// 📍 Fonction principale : afficher les marqueurs selon filtres
function loadDataFromArray(year) {
  // Nettoyage
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  oms.clearMarkers();

  // Récupération des groupes cochés
  const selectedGroups = Array.from(
    document.querySelectorAll('#person-list input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  // Conversion en liste de noms
  let selectedNames = [];
  selectedGroups.forEach(g => {
    if (groupMap[g]) selectedNames.push(...groupMap[g]);
  });
  selectedNames = [...new Set(selectedNames)];
  const filterActive = selectedNames.length > 0;

  // Regrouper les lignes par personne après filtre
  const personLines = {};
  peopleData.forEach(person => {
    if (!person.name || isNaN(person.year)) return;
    if (filterActive && !selectedNames.includes(person.name)) return;
    (personLines[person.name] = personLines[person.name] || []).push(person);
  });

  // Déterminer la dernière position valide
  const latestLocations = {};
  Object.keys(personLines).forEach(name => {
    const lines = personLines[name]
      .filter(p => p.year <= year)
      .sort((a, b) => a.year - b.year);
    if (!lines.length) return;

    let last = null, stopped = false;
    lines.forEach(line => {
      const info    = (line.info || '').toLowerCase();
      const isStop  = info.includes('stop');
      const isFinal = info.includes('décès') || info.includes('divorce');
      if (isStop) stopped = true;
      if (!stopped && !isFinal) last = line;
      if (isFinal) {
        if (line.year === year) last = line;
        if (line.year < year) stopped = true;
      }
    });
    if (last && !stopped) {
      latestLocations[name] = last;
    }
  });

  // Grouper par coordonnées pour éviter le chevauchement
  const locationGroups = {};
  Object.entries(latestLocations).forEach(([name, loc]) => {
    const key = `${loc.lat.toFixed(5)}_${loc.lon.toFixed(5)}`;
    (locationGroups[key] = locationGroups[key] || []).push(name);
  });

  // Création et ajout des marqueurs
  Object.values(locationGroups).forEach(group => {
    const loc   = latestLocations[group[0]];
    const ville = loc.ville;

    if (group.length === 1) {
      // Marqueur individuel
      const name = group[0];
      validateImage(photoMap[name]).then(url => {
        const icon = L.icon({
          iconUrl: url,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });
        const m = L.marker([loc.lat, loc.lon], { icon })
          .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${loc.info}</em>`);
        m.addTo(map); oms.addMarker(m); markers.push(m);
      });

    } else {
      // Marqueur de groupe
      validateImage(photoMap['Groupe'] || 'images/group.jpg').then(url => {
        const icon = L.icon({
          iconUrl: url,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });
        const groupM = L.marker([loc.lat, loc.lon], { icon });
        groupM.addTo(map); oms.addMarker(groupM); markers.push(groupM);

        group.forEach((name, i) => {
          validateImage(photoMap[name]).then(url2 => {
            const icon2 = L.icon({
              iconUrl: url2,
              iconSize: [50, 50],
              iconAnchor: [25, 25],
              popupAnchor: [0, -25]
            });
            const off = 0.00005 * i;
            const m2  = L.marker([loc.lat + off, loc.lon + off], { icon: icon2 })
              .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${latestLocations[name].info}</em>`);
            m2.addTo(map); oms.addMarker(m2); markers.push(m2);
          });
        });
      });
    }
  });

  // Permettre l’ouverture des popups via le spiderfier
  oms.addListener('click', marker => marker.openPopup());
}
