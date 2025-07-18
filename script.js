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
  const map = L.map('map').setView([48.0, 15.0], 6);
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

    // 📅 Configuration du slider (garde-fou si vide)
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

    // 5) groupement par coordonnées pour éviter chevauchement
    const locationGroups = {};
    Object.entries(latestLocations).forEach(([name, loc]) => {
      const key = `${loc.lat.toFixed(5)}_${loc.lon.toFixed(5)}`;
      (locationGroups[key] = locationGroups[key] || []).push(name);
    });

    // 6) création et ajout des marqueurs
    Object.values(locationGroups).forEach(group => {
      const { lat, lon, ville, info } = latestLocations[group[0]];
      if (group.length === 1) {
        const n = group[0];
        validateImage(photoMap[n]).then(url => {
          const icon = L.icon({
            iconUrl:    url,
            iconSize:   [50, 50],
            iconAnchor: [25, 25],
            popupAnchor:[0, -25]
          });
          const m = L.marker([lat, lon], { icon })
            .bindPopup(`<strong>${n}</strong><br>${ville}<br><em>${info}</em>`);
          m.addTo(map); oms.addMarker(m); markers.push(m);
        });
      } else {
        // photo de groupe personnalisée depuis Google Sheets
        const rawGroupPhoto = photoMap["Groupe"] || 'images/group.jpg';
        validateImage(rawGroupPhoto).then(url => {
          const icon = L.icon({
            iconUrl:    url,
            iconSize:   [50, 50],
            iconAnchor: [25, 25],
            popupAnchor:[0, -25]
          });
          const gm = L.marker([lat, lon], { icon });
          gm.addTo(map); oms.addMarker(gm); markers.push(gm);

          group.forEach((n, i) => {
            validateImage(photoMap[n]).then(url2 => {
              const icon2 = L.icon({
                iconUrl:    url2,
                iconSize:   [50, 50],
                iconAnchor: [25, 25],
                popupAnchor:[0, -25]
              });
              const offset = 0.00005 * i;
              const m2     = L.marker([lat + offset, lon + offset], { icon: icon2 })
                .bindPopup(`<strong>${n}</strong><br>${ville}<br><em>${latestLocations[n].info}</em>`);
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
