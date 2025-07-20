document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map').setView([48.0, 15.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  let markers = [];
  let photoMap = {};
  let groupMap = {};

  const yearInput  = document.getElementById('year');
  const yearLabel  = document.getElementById('year-label');
  const personList = document.getElementById('person-list');
  const hideAllBtn = document.getElementById('hide-all');

  const dataSheetUrl  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?output=csv';
  const photoSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1436940582&single=true&output=csv';
  const groupSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZEa-I6uMMti1wpeSuNNqdXVN8BxR0QOhYKW9dbUEj88hM0xF5y-rXE5NikL3kipmOek5erQQxVuwI/pub?gid=1406949721&single=true&output=csv';

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines.shift().split(',');
    return lines.map(line => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = values[i] ? values[i].trim() : '';
      });
      obj.year = parseInt(obj.year, 10);
      obj.lat = parseFloat(obj.lat);
      obj.lon = parseFloat(obj.lon);
      return obj;
    });
  }

  function loadPhotoMap(csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const map = {};
    lines.forEach(line => {
      const [name, url] = line.split(',').map(s => s.trim());
      map[name] = url || 'images/default.jpg';
    });
    return map;
  }

  function loadGroupMap(csvText) {
    const lines = csvText.trim().split('\n').slice(1);
    const map = {};
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

  function validateImage(url, fallback = 'images/default.jpg') {
    if (!url || url === 'undefined') return Promise.resolve(fallback);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(fallback);
      img.src = url;
    });
  }

  Promise.all([
    fetch(dataSheetUrl).then(r => r.text()),
    fetch(photoSheetUrl).then(r => r.text()),
    fetch(groupSheetUrl).then(r => r.text())
  ])
  .then(([csvData, csvPhotos, csvGroups]) => {
    const peopleData = parseCSV(csvData);
    photoMap = loadPhotoMap(csvPhotos);
    groupMap = loadGroupMap(csvGroups);

    const years = peopleData.map(p => p.year).filter(y => !isNaN(y));
    const minY = years.length ? Math.min(...years) : new Date().getFullYear();
    const maxY = years.length ? Math.max(...years) : new Date().getFullYear();
    yearInput.min = minY;
    yearInput.max = maxY;
    yearInput.value = minY;
    yearLabel.textContent = minY;

    Object.keys(groupMap).sort().forEach(groupName => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.marginBottom = '4px';
      label.style.cursor = 'pointer';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = groupName;
      checkbox.checked = true;
      checkbox.style.marginRight = '6px';

      checkbox.addEventListener('change', () => {
        loadDataFromArray(parseInt(yearInput.value, 10));
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(groupName));
      personList.appendChild(label);
    });

    hideAllBtn.addEventListener('click', () => {
      personList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      loadDataFromArray(parseInt(yearInput.value, 10));
    });

    yearInput.addEventListener('input', () => {
      const y = parseInt(yearInput.value, 10);
      yearLabel.textContent = y;
      loadDataFromArray(y);
    });

    loadDataFromArray(minY);
  });

  function loadDataFromArray(year) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: function (cluster) {
        const photoUrl = photoMap["Groupe"] || 'images/group.jpg';
        return L.divIcon({
          html: `<img src="${photoUrl}" style="width:50px;height:50px;border-radius:50%;">`,
          className: 'custom-cluster-icon',
          iconSize: [50, 50]
        });
      }
    });

    const selectedGroups = Array.from(
      document.querySelectorAll('#person-list input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    if (selectedGroups.length === 0) return;

    const selectedNames = [...new Set(
      selectedGroups.flatMap(g => groupMap[g] || [])
    )];
    if (selectedNames.length === 0) return;

    const personLines = {};
    peopleData.forEach(person => {
      if (!person.name || isNaN(person.year)) return;
      if (!selectedNames.includes(person.name)) return;
      (personLines[person.name] = personLines[person.name] || []).push(person);
    });

    const latestLocations = {};
    Object.entries(personLines).forEach(([name, lines]) => {
      const filt = lines
        .filter(p => p.year <= year)
        .sort((a, b) => a.year - b.year);
      let last = null, stopped = false;
      filt.forEach(line => {
        const info = (line.info || '').toLowerCase();
        const isStop = info.includes('stop');
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

    Object.entries(latestLocations).forEach(([name, loc]) => {
      const photoUrl = photoMap[name] || 'images/default.jpg';
      validateImage(photoUrl).then(validPhoto => {
        const icon = L.icon({
          iconUrl: validPhoto,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25]
        });

        const marker = L.marker([loc.lat, loc.lon], { icon })
          .bindPopup(`<strong>${name}</strong><br>${loc.ville}<br><em>${loc.info}</em>`);
        clusterGroup.addLayer(marker);
        markers.push(marker);
      });
    });

    map.addLayer(clusterGroup);
  }
});

