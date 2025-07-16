document.addEventListener('DOMContentLoaded', () => {
  // ─── TOGGLE DU MENU ─────────────────────────────────────────────
  const personHeader        = document.getElementById('person-header');
  const personSelectorDiv   = document.getElementById('person-selector');
  const personListContainer = document.getElementById('person-list-container');
  personListContainer.style.display = 'none';
  personHeader.addEventListener('click', () => {
    const isOpen = personSelectorDiv.classList.toggle('open');
    personListContainer.style.display = isOpen ? 'block' : 'none';
  });

  // ─── INIT CARTE ET SPIDERFIER ───────────────────────────────────
  const map = L.map('map').setView([53.0, 15.0], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  let markers = [];
  const oms = new OverlappingMarkerSpiderfier(map, {
    keepSpiderfied: true,
    nearbyDistance: 20
  });

  // ─── RÉCUP DOM ───────────────────────────────────────────────────
  const yearInput  = document.getElementById('year');
  const yearLabel  = document.getElementById('year-label');
  const personList = document.getElementById('person-list');
  const hideAllBtn = document.getElementById('hide-all');

  // ─── URL DES CSV ────────────────────────────────────────────────
  const dataSheetUrl  = 'https://docs.google.com/spreadsheets/d/e/…/pub?output=csv';
  const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/…/gid=1436940582&single=true&output=csv';
  const groupSheetUrl = 'https://docs.google.com/spreadsheets/d/e/…/gid=1406949721&single=true&output=csv';

  // ─── STOCKAGE GLOBAL ────────────────────────────────────────────
  let peopleData = [];
  let photoMap    = {};
  let groupMap    = {};

  // ─── PARSEURS CSV ───────────────────────────────────────────────
  function parseCSV(text) {
    const lines   = text.trim().split('\n');
    const headers = lines.shift().split(',');
    return lines.map(line => {
      const obj = {}, vals = line.split(',');
      headers.forEach((h,i) => obj[h.trim()] = vals[i] ? vals[i].trim() : '');
      obj.year = parseInt(obj.year,10);
      obj.lat  = parseFloat(obj.lat);
      obj.lon  = parseFloat(obj.lon);
      return obj;
    });
  }

  function loadPhotoMap(csvText) {
    return csvText
      .trim()
      .split('\n')
      .slice(1)
      .reduce((m, line) => {
        const [name, url] = line.split(',').map(s => s.trim());
        m[name] = url || 'images/default.jpg';
        return m;
      }, {});
  }

  function loadGroupMap(csvText) {
    return csvText
      .trim()
      .split('\n')
      .slice(1)
      .reduce((m, line) => {
        const [group, members] = line.split(',').map(s => s.trim());
        if (group && members) {
          m[group] = members.split(';').map(n => n.trim()).filter(n => n);
        }
        return m;
      }, {});
  }

  function validateImage(url, fallback = 'images/default.jpg') {
    if (!url || url === 'undefined') return Promise.resolve(fallback);
    return new Promise(res => {
      const img = new Image();
      img.onload  = () => res(url);
      img.onerror = () => res(fallback);
      img.src     = url;
    });
  }

  // ─── CHARGEMENT PARALLELE ────────────────────────────────────────
  Promise.all([
    fetch(dataSheetUrl).then(r => r.text()),
    fetch(photoSheetUrl).then(r => r.text()),
    fetch(groupSheetUrl).then(r => r.text())
  ])
  .then(([csvData, csvPhotos, csvGroups]) => {
    // 1) parse data
    peopleData = parseCSV(csvData);
    photoMap   = loadPhotoMap(csvPhotos);
    groupMap   = loadGroupMap(csvGroups);

    // 2) config slider
    const years = peopleData.map(p => p.year).filter(y => !isNaN(y));
    if (years.length) {
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      yearInput.min   = minY;
      yearInput.max   = maxY;
      yearInput.step  = 1;
      yearInput.value = minY;
      yearLabel.textContent = minY;
    } else {
      // garde-fou si jamais pas de données
      const today = new Date().getFullYear();
      yearInput.min   = today;
      yearInput.max   = today;
      yearInput.value = today;
      yearLabel.textContent = today;
    }

    // 3) génère une checkbox par groupe
    Object.keys(groupMap).sort().forEach(groupName => {
      const label = document.createElement('label');
      label.style.display      = 'block';
      label.style.marginBottom = '4px';
      label.style.cursor       = 'pointer';

      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.value   = groupName;
      cb.checked = true;
      cb.style.marginRight = '6px';
      cb.addEventListener('change', () => {
        loadDataFromArray(parseInt(yearInput.value, 10));
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(groupName));
      personList.appendChild(label);
    });

    // 4) bouton Tout masquer
    hideAllBtn.addEventListener('click', () => {
      personList.querySelectorAll('input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
      loadDataFromArray(parseInt(yearInput.value, 10));
    });

    // 5) slider change
    yearInput.addEventListener('input', () => {
      const y = parseInt(yearInput.value, 10);
      yearLabel.textContent = y;
      loadDataFromArray(y);
    });

    // 6) premier affichage
    loadDataFromArray(parseInt(yearInput.value, 10));
  })
  .catch(err => console.error('Erreur chargement CSV :', err));

  // ─── AFFICHAGE DES MARQUEURS ─────────────────────────────────────
  function loadDataFromArray(year) {
    // clear
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    oms.clearMarkers();

    // 1) récupère les groupes cochés
    const groupsSel = Array.from(
      document.querySelectorAll('#person-list input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    if (groupsSel.length === 0) return;

    // 2) aplatit en liste de noms uniques
    const namesSel = [...new Set(groupsSel.flatMap(g => groupMap[g] || []))];

    // 3) regroupe les lignes par personne
    const personLines = {};
    peopleData.forEach(p => {
      if (!p.name || isNaN(p.year)) return;
      if (!namesSel.includes(p.name)) return;
      (personLines[p.name] = personLines[p.name] || []).push(p);
    });

    // 4) calcule la dernière position valide
    const latest = {};
    Object.entries(personLines).forEach(([name, lines]) => {
      const filt = lines
        .filter(p => p.year <= year)
        .sort((a, b) => a.year - b.year);
      let last = null, stopped = false;
      for (const ln of filt) {
        const info = (ln.info||'').toLowerCase();
        if (info.includes('stop')) stopped = true;
        if (!stopped && !info.match(/décès|divorce/)) last = ln;
        if (info.match(/décès|divorce/)) {
          if (ln.year === year) last = ln;
          if (ln.year < year) stopped = true;
        }
      }
      if (last && !stopped) latest[name] = last;
    });

    // 5) evite chevauchement
    const locGroups = {};
    Object.entries(latest).forEach(([name, loc]) => {
      const key = `${loc.lat.toFixed(5)}_${loc.lon.toFixed(5)}`;
      (locGroups[key] = locGroups[key]||[]).push(name);
    });

    // 6) crée les marqueurs
    Object.values(locGroups).forEach(group => {
      const { lat, lon, ville, info } = latest[group[0]];
      if (group.length === 1) {
        const name = group[0];
        validateImage(photoMap[name]).then(url => {
          const icon = L.icon({
            iconUrl:    url,
            iconSize:   [50, 50],
            iconAnchor: [25, 25],
            popupAnchor:[0, -25]
          });
          const m = L.marker([lat, lon], { icon })
            .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${info}</em>`);
          m.addTo(map); oms.addMarker(m); markers.push(m);
        });
      } else {
        // icône de groupe
        validateImage('images/group.jpg').then(url => {
          const icon = L.icon({
            iconUrl:    url,
            iconSize:   [50, 50],
            iconAnchor: [25, 25],
            popupAnchor:[0, -25]
          });
          const gm = L.marker([lat, lon], { icon });
          gm.addTo(map); oms.addMarker(gm); markers.push(gm);

          group.forEach((name, i) => {
            validateImage(photoMap[name]).then(url2 => {
              const icon2 = L.icon({
                iconUrl:    url2,
                iconSize:   [50, 50],
                iconAnchor: [25, 25],
                popupAnchor:[0, -25]
              });
              const offset = 0.00005 * i;
              const m2 = L.marker([lat + offset, lon + offset], { icon: icon2 })
                .bindPopup(`<strong>${name}</strong><br>${ville}<br><em>${latest[name].info}</em>`);
              m2.addTo(map); oms.addMarker(m2); markers.push(m2);
            });
          });
        });
      }
    });

    // 7) permet ouverture popups spiderfier
    oms.addListener('click', marker => marker.openPopup());
  }
});
