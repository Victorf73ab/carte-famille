document.addEventListener('DOMContentLoaded', () => {
  // 👆 Toggle du menu repliable
  const personHeader        = document.getElementById('person-header');
  const personSelectorDiv   = document.getElementById('person-selector');
  const personListContainer = document.getElementById('person-list-container');
  personListContainer.style.display = 'none';
  personHeader.addEventListener('click', () => {
    const isOpen = personSelectorDiv.classList.toggle('open');
    personListContainer.style.display = isOpen ? 'block' : 'none';
  });

  // 🗺️ Initialisation de la carte
  const map = L.map('map').setView([48.0, 15.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  let markers = [];
  const oms = new OverlappingMarkerSpiderfier(map, {
    keepSpiderfied: true,
    nearbyDistance: 20
  });

  // 🎚️ Récupération des éléments DOM
  const yearInput  = document.getElementById('year');
  const yearLabel  = document.getElementById('year-label');
  const personList = document.getElementById('person-list');
  const hideAllBtn = document.getElementById('hide-all');

  // 📄 URLs des Google Sheets (format CSV)
  const dataSheetUrl  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?output=csv';
  const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1436940582&single=true&output=csv';
  const groupSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1406949721&single=true&output=csv';

  // 🌐 Stockage global
  let peopleData = [];
  let photoMap    = {};
  let groupMap    = {};

  // 🔍 Parse un CSV en tableau d’objets
  function parseCSV(text) {
    const lines   = text.trim().split('\n');
    const headers = lines.shift().split(',');
    return lines.map(line => {
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

  // 🔍 Crée le dictionnaire des photos
  function loadPhotoMap(csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const map   = {};
    lines.forEach(line => {
      const [name, url] = line.split(',').map(s => s.trim());
      map[name] = url || 'images/default.jpg';
    });
    return map;
  }

  // 🔍 Crée le dictionnaire des groupes
  // Chaque ligne : Groupe,Membres (séparés par ;)
  function loadGroupMap(csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const map   = {};
    lines.forEach(line => {
      const [group, members] = line.split(',').map(s => s.trim());
      if (!group) return;
      map[group] = members
        .split(';')
        .map(n => n.trim())
        .filter(n => n);
    });
    return map;
  }

  // 🔧 Vérifie si une URL d’image est valide, fallback sinon
  function validateImage(url, fallback = 'images/default.jpg') {
    if (!url || url === 'undefined') return Promise.resolve(fallback);
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(url);
      img.onerror = () => resolve(fallback);
      img.src     = url;
    });
  }

  // 📦 Chargement parallèle des trois feuilles CSV
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
    const years = peopleData.map(p => p.year).filter(y => !isNaN(y));
    const today = new Date().getFullYear();
    const minY  = years.length ? Math.min(...years) : today;
    const maxY  = years.length ? Math.max(...years) : today;
    yearInput.min   = minY;
    yearInput.max   = maxY;
    yearInput.step  = 1;
    yearInput.value = minY;
    yearLabel.textContent = minY;

    // 👥 Génération des cases à cocher pour chaque groupe
    Object.keys(groupMap).sort().forEach(groupName => {
      const label = document.createElement('label');
      label.style.display      = 'block';
      label.style.marginBottom = '4px';
      label.style.cursor       = 'pointer';

      const checkbox = document.createElement('input');
      checkbox.type    = 'checkbox';
      checkbox.value   = groupName;
      checkbox.checked = true;
      checkbox.style.marginRight = '6px';

      checkbox.addEventListener('change', () => {
        loadDataFromArray(parseInt(yearInput.value, 10));
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(groupName));
      personList.appendChild(label);
    });

    // 🛑 Bouton "Tout masquer"
    hideAllBtn.addEventListener('click', () => {
      personList
        .querySelectorAll('input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
      loadDataFromArray(parseInt(yearInput.value, 10));
    });

    // ⏳ Événement du slider
    yearInput.addEventListener('input', () => {
      const y = parseInt(yearInput.value, 10);
      yearLabel.textContent = y;
      loadDataFromArray(y);
    });

    // Affichage initial
    loadDataFromArray(minY);
  })
  .catch(err => console.error('Erreur chargement Google Sheets :', err));

  // 📍 Fonction principale : afficher les marqueurs selon filtres
  function loadDataFromArray(year) {
    // nettoyage des anciens marqueurs
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    oms.clearMarkers();

    // 1) récupération des groupes cochés
    const selectedGroups = Array.from(
      document.querySelectorAll('#person-list input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    if (selectedGroups.length === 0) return;

    // 2) aplatissement en liste de noms uniques
    const selectedNames = [...new Set(
      selectedGroups.flatMap(g => groupMap[g] || [])
    )];
    if (selectedNames.length === 0) return;

    // 3) regroupement des données par personne
    const personLines = {};
    peopleData.forEach(person => {
      if (!person.name || isNaN(person.year)) return;
      if (!selectedNames.includes(person.name)) return;
      (personLines[person.name] = personLines[person.name] || []).push(person);
    });

    // 4) calcul de la dernière position valide par personne
    const latestLocations = {};
    Object.entries(personLines).forEach(([name, lines]) => {
      const filt = lines
        .filter(p => p.year <= year)
        .sort((a, b) => a.year - b.year);
      let last = null, stopped = false;
      filt.forEach(line => {
        const info    = (line.info || '').toLowerCase();
        const isStop  = info.includes('stop');
        const isFinal = /décès|divorce/.test(info);
        if (isStop) stopped = true;
        if (!stopped && !isFinal) last = line;
        if (isFinal) {
          if (line.year === year) last = line;
          if (line.year < year) stopped = true;
        }
      });
      if (last && !stopped) latestLocations[name] = last;
    });

    // 5) groupement par coordonnées « proches » pour éviter chevauchement
const threshold = 0.0005;        // ~ 50m
const locationGroups = {};

Object.entries(latestLocations).forEach(([name, loc]) => {
  // cherche un key existant à moins du seuil
  let foundKey = null;
  for (let key in locationGroups) {
    const [lat0, lon0] = key.split('_').map(Number);
    if (
      Math.abs(lat0 - loc.lat) <= threshold &&
      Math.abs(lon0 - loc.lon) <= threshold
    ) {
      foundKey = key;
      break;
    }
  }
  // si rien trouvé, crée un nouveau key arrondi à 4 décimales
  const key = foundKey || `${loc.lat.toFixed(4)}_${loc.lon.toFixed(4)}`;
  (locationGroups[key] = locationGroups[key] || []).push(name);
});

    // 6) création et ajout des marqueurs
   Object.entries(locationGroups).forEach(([key, group]) => {
  const [lat, lon] = key.split('_').map(Number);

  if (group.length === 1) {
    const name = group[0];
    const { ville, info } = latestLocations[name];
    validateImage(photoMap[name]).then(url => {
      const icon = L.icon({
        iconUrl: url,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
      });
      const m = L.marker([lat, lon], { icon })
        .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${info}</em>`);
      m.addTo(map); oms.addMarker(m); markers.push(m);
    });
  } else {
    // Affiche toujours l’image "Groupe" au point central
    const rawGroupPhoto = photoMap["Groupe"] || 'images/group.jpg';
    validateImage(rawGroupPhoto).then(url => {
      const icon = L.icon({
        iconUrl: url,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
      });

      const gm = L.marker([lat, lon], { icon })
        .bindPopup(`<strong>${group.length} personnes</strong><br><em>Cliquez pour les découvrir</em>`);
      gm.addTo(map); oms.addMarker(gm); markers.push(gm);

          // Puis on affiche les individus en décalé
          group.forEach((name, i) => {
            const ind = latestLocations[name];
            const infoInd = ind.info || '';
            validateImage(photoMap[name]).then(url2 => {
              const icon2 = L.icon({
                iconUrl:    url2,
                iconSize:   [50, 50],
                iconAnchor: [25, 25],
                popupAnchor:[0, -25]
              });
              const offset = 0.00005 * (i + 1);
              const m2 = L.marker([lat + offset, lon + offset], { icon: icon2 })
                .bindPopup(`<strong>${name}</strong><br>${ind.ville}<br><em>${infoInd}</em>`);
              m2.addTo(map); oms.addMarker(m2); markers.push(m2);
            });
          });
        });
      }
    });

    // ouverture des popups via Spiderfier
    oms.addListener('click', marker => marker.openPopup());
  }
});
