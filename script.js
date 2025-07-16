window.addEventListener('DOMContentLoaded', () => {

  const map = L.map('map').setView([53.0, 15.0], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const oms = new OverlappingMarkerSpiderfier(map, {
    keepSpiderfied: true,
    nearbyDistance: 20
  });

  let markers = [];
  let peopleData = [];
  let photoMap = {};

  const yearInput     = document.getElementById('year');
  const yearLabel     = document.getElementById('year-label');
  const selectElement = document.getElementById('person-select');
  const hideAllBtn    = document.getElementById('hide-all');

  // ✅ lien corrigé vers l'onglet Google Sheet avec gid=1406949721
  const dataSheetUrl  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1406949721&single=true&output=csv';
  const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1436940582&single=true&output=csv';

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

  function loadPhotoMap(csvText) {
    const lines = csvText.trim().split('\n');
    const map = {};
    lines.slice(1).forEach(line => {
      const [name, url] = line.split(',').map(s => s.trim());
      map[name] = url || 'images/default.jpg';
    });
    return map;
  }

  function validateImage(url, fallback = 'images/default.jpg') {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(fallback);
      img.src = url;
    });
  }

  Promise.all([
    fetch(dataSheetUrl).then(r => r.text()),
    fetch(photoSheetUrl).then(r => r.text())
  ])
  .then(([csvData, csvPhotos]) => {
    peopleData = parseCSV(csvData);
    photoMap = loadPhotoMap(csvPhotos);

    const years = peopleData.map(p => p.year).filter(y => !isNaN(y));
    const minYear = Math.min(...years);
    const maxYear = 2025;

    yearInput.min = minYear;
    yearInput.max = maxYear;
    yearInput.step = 1;
    yearInput.value = minYear;
    yearLabel.textContent = minYear;

    const uniqueNames = [...new Set(peopleData.map(p => p.name).filter(n => n))];
    uniqueNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      selectElement.appendChild(option);
    });

    console.log('Menu déroulant peuplé avec :', uniqueNames);

    loadDataFromArray(peopleData, photoMap, minYear);

    yearInput.addEventListener('input', () => {
      const y = parseInt(yearInput.value);
      yearLabel.textContent = y;
      loadDataFromArray(peopleData, photoMap, y);
    });

    selectElement.addEventListener('change', () => {
      loadDataFromArray(peopleData, photoMap, parseInt(yearInput.value));
    });

    hideAllBtn.addEventListener('click', () => {
      Array.from(selectElement.options).forEach(o => o.selected = false);
      loadDataFromArray(peopleData, photoMap, parseInt(yearInput.value));
    });
  })
  .catch(error => console.error('Erreur chargement Google Sheets :', error));

  function loadDataFromArray(data, photoMap, year) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    oms.clearMarkers();

    const selected = Array.from(selectElement.selectedOptions).map(o => o.value);
    const filterOn = selected.length > 0;

    const latest = {};
    const byName = {};

    data.forEach(p => {
      if (!p.name || isNaN(p.year)) return;
      if (filterOn && !selected.includes(p.name)) return;
      (byName[p.name] = byName[p.name] || []).push(p);
    });

    Object.keys(byName).forEach(name => {
      const lines = byName[name]
        .filter(p => p.year <= year)
        .sort((a, b) => a.year - b.year);
      if (!lines.length) return;
      let last = null, stopped = false;
      lines.forEach(line => {
        const info = (line.info || '').toLowerCase();
        const isStop = info.includes('stop');
        const isFinal = info.includes('décès') || info.includes('divorce');
        if (isStop) stopped = true;
        if (!stopped && !isFinal) last = line;
        if (isFinal) {
          if (line.year === year) last = line;
          if (line.year < year) stopped = true;
        }
      });
      if (last && !stopped) latest[name] = last;
    });

    const groups = {};
    Object.entries(latest).forEach(([name, loc]) => {
      const key = `${loc.lat.toFixed(5)}_${loc.lon.toFixed(5)}`;
      (groups[key] = groups[key] || []).push(name);
    });

    Object.values(groups).forEach(group => {
      const loc = latest[group[0]];
      if (group.length === 1) {
        const name = group[0];
        validateImage(photoMap[name]).then(url => {
          const icon = L.icon({ iconUrl: url, iconSize: [50,50], iconAnchor: [25,25], popupAnchor: [0,-25] });
          const m = L.marker([loc.lat, loc.lon], { icon })
            .bindPopup(`<strong>${name}</strong><br>${loc.ville}<br><em>${loc.info}</em>`);
          m.addTo(map); oms.addMarker(m); markers.push(m);
        });
      } else {
        validateImage(photoMap['Groupe'] || 'images/group.jpg').then(url => {
          const icon = L.icon({ iconUrl: url, iconSize: [50,50], iconAnchor: [25,25], popupAnchor: [0,-25] });
          const gm = L.marker([loc.lat, loc.lon], { icon });
          gm.addTo(map); oms.addMarker(gm); markers.push(gm);
          group.forEach((name, i) => {
            validateImage(photoMap[name]).then(url2 => {
              const ico = L.icon({ iconUrl: url2, iconSize: [50,50], iconAnchor: [25,25], popupAnchor: [0,-25] });
              const off = 0.00005 * i;
              const m = L.marker([loc.lat + off, loc.lon + off], { icon: ico })
                .bindPopup(`<strong>${name}</strong><br>${loc.ville}<br><em>${loc.info}</em>`);
              m.addTo(map); oms.addMarker(m); markers.push(m);
            });
          });
        });
      }
    });

    oms.addListener('click', marker => marker.openPopup());
  }

});
