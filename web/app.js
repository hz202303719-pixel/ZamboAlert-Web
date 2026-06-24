document.addEventListener('DOMContentLoaded', function(){
  // Default coordinates for Barangay Tumaga (placeholder)
  const defaultLat = 8.476;
  const defaultLng = 123.610;

  const barangayLocations = [
    {name: 'Zone 1', lat: 8.4782, lng: 123.6095},
    {name: 'Zone 2', lat: 8.4750, lng: 123.6130},
    {name: 'Zone 3', lat: 8.4771, lng: 123.6070},
    {name: 'Brgy. San Roque', lat: 8.4740, lng: 123.6080},
    {name: 'Highway 7', lat: 8.4728, lng: 123.6124}
  ];

  function initMap(containerId, lat=defaultLat, lng=defaultLng){
    const el = document.getElementById(containerId);
    if(!el) {
      console.error(`[ZamboAlert] Map container element '#${containerId}' not found in DOM.`);
      return null;
    }
    const placeholder = el.querySelector('.map-placeholder');
    if(placeholder) placeholder.style.display = 'none';

    try {
      const map = L.map(containerId, {zoomControl:true, attributionControl:false}).setView([lat,lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
      return {map, markers: []};
    } catch (err) {
      console.error(`[ZamboAlert] Failed to initialize map for '#${containerId}':`, err);
      return null;
    }
  }

  const dashboardMap = initMap('tumaga-map');
  if (!dashboardMap) {
    console.warn('[ZamboAlert] Dashboard map unavailable. Map-dependent features will be disabled.');
  }

  let selectedAlertId = null;

  function getAlertLocation(alert) {
    return barangayLocations.find(loc => loc.name === alert.location) || {lat: defaultLat, lng: defaultLng};
  }

  function clearMapMarkers() {
    if (!dashboardMap) return;
    dashboardMap.markers.forEach(({marker}) => {
      try {
        dashboardMap.map.removeLayer(marker);
      } catch (err) {
        console.warn('[ZamboAlert] Failed to remove map marker:', err);
      }
    });
    dashboardMap.markers.length = 0;
  }

  function renderMapMarkers(highlightId = null) {
    if(!dashboardMap) return;
    clearMapMarkers();

    alertSystem.alerts.forEach(alert => {
      const loc = getAlertLocation(alert);
      const isHighlighted = alert.id === highlightId;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: isHighlighted ? 14 : 10,
        color: '#ffffff',
        weight: isHighlighted ? 4 : 2,
        fillColor: alert.status === 'Active' ? '#dc2626' : '#059669',
        fillOpacity: 1
      }).addTo(dashboardMap.map);

      marker.bindPopup(`
        <div style="color:#000;font-weight:600;">
          ${alert.type} SOS<br>
          <strong>${alert.location}</strong><br>
          Respondent: ${alert.respondent.name}<br>
          Status: ${alert.status}
        </div>
      `);

      marker.on('click', () => {
        selectAlert(alert.id);
      });

      dashboardMap.markers.push({id: alert.id, marker});
    });
  }

  function selectAlert(alertId) {
    const selected = alertSystem.alerts.find(alert => alert.id === alertId);
    if(!selected) {
      console.warn(`[ZamboAlert] Alert '${alertId}' not found.`);
      return;
    }
    selectedAlertId = alertId;
    const loc = getAlertLocation(selected);
    if (dashboardMap) {
      dashboardMap.map.panTo([loc.lat, loc.lng]);
    }
    renderMapMarkers(alertId);

    const nameEl = document.getElementById('active-user-name');
    const statusEl = document.getElementById('active-user-status');
    const detailsEl = document.getElementById('active-sos-details');
    if (nameEl) nameEl.textContent = selected.reportedBy;
    if (statusEl) statusEl.textContent = selected.status;
    if (detailsEl) {
      detailsEl.innerHTML = `
        <strong>Alert ID:</strong> ${selected.id}<br>
        <strong>Type:</strong> ${selected.type}<br>
        <strong>Location:</strong> ${selected.location}<br>
        <strong>Respondent:</strong> ${selected.respondent.name} (${selected.respondent.role})<br>
        <strong>Reported At:</strong> ${formatTime(selected.timestamp)}<br>
        <strong>Barangay:</strong> Tumaga
      `;
    }
  }

  window.selectAlert = selectAlert;

  function getLocationOptions() {
    return barangayLocations.map(loc => `<option value="${loc.name}">${loc.name}</option>`).join('');
  }

  const alertSystem = {
    users: [
      {id: 'U01', name: 'Admin', role: 'Coordinator', online: true, location: 'Zone 2'},
      {id: 'U02', name: 'Maria Dela Cruz', role: 'Responder', online: true, location: 'Zone 3'},
      {id: 'U03', name: 'Juan Ramos', role: 'Responder', online: false, location: 'Brgy. San Roque'},
      {id: 'U04', name: 'Supervisor', role: 'Supervisor', online: true, location: 'Zone 1'}
    ],
    alerts: [
      {id: '#A102', type: 'Flood', location: 'Zone 3', status: 'Active', timestamp: new Date(), reportedBy: 'Community Member', respondent: {name: 'Maria Dela Cruz', role: 'Responder', location: 'Zone 3'}},
      {id: '#A101', type: 'Fire', location: 'Brgy. San Roque', status: 'Resolved', timestamp: new Date(Date.now() - 3600000), reportedBy: 'Witness', respondent: {name: 'Juan Ramos', role: 'Responder', location: 'Brgy. San Roque'}},
      {id: '#A100', type: 'Accident', location: 'Highway 7', status: 'Resolved', timestamp: new Date(Date.now() - 7200000), reportedBy: 'Traffic Watch', respondent: {name: 'Supervisor', role: 'Supervisor', location: 'Zone 1'}}
    ],
    addAlert: function(type, location, reportedBy) {
      if (!type || !location) {
        console.error('[ZamboAlert] Cannot create alert: type and location are required.');
        return null;
      }
      const respondent = this.users.find(u => u.online && u.location === location) || {name: 'Nearby responder', role: 'Responder', location};
      const newAlert = {
        id: '#A' + Math.floor(100 + Math.random() * 900),
        type,
        location,
        status: 'Active',
        timestamp: new Date(),
        reportedBy: reportedBy || 'Unknown',
        respondent
      };
      this.alerts.unshift(newAlert);
      renderAlerts();
      renderRespondents();
      updateSummary();
      window.selectAlert(newAlert.id);
      this.showNotification(type, location);
      return newAlert;
    },
    resolveAlert: function(alertId) {
      const alert = this.alerts.find(a => a.id === alertId);
      if(!alert) {
        console.warn(`[ZamboAlert] Cannot resolve: alert '${alertId}' not found.`);
        return;
      }
      alert.status = 'Resolved';
      updateSummary();
      renderAlerts();
      renderMapMarkers(selectedAlertId);
    },
    showNotification: function(type, location) {
      const msg = `New ${type} alert in ${location}`;
      if('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('ZamboAlert', {body: msg, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23dc2626"><polygon points="12,2 20,20 4,20"/></svg>'});
        } catch (err) {
          console.warn('[ZamboAlert] Browser notification failed:', err);
        }
      }
      console.log('[ZamboAlert] Alert:', msg);
    }
  };

  function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function updateSummary() {
    const activeCount = alertSystem.alerts.filter(alert => alert.status === 'Active').length;
    const resolvedCount = alertSystem.alerts.filter(alert => alert.status === 'Resolved').length;
    const avgMs = alertSystem.alerts.reduce((sum, alert) => {
      const delta = alert.status === 'Resolved' ? Date.now() - alert.timestamp.getTime() : 0;
      return sum + delta;
    }, 0);
    const avgMinutes = resolvedCount ? Math.round((avgMs / resolvedCount) / 60000) : 0;

    const activeEl = document.getElementById('active-alerts-count');
    const resolvedEl = document.getElementById('resolved-count');
    const avgEl = document.getElementById('avg-response');
    const usersEl = document.getElementById('users-count');

    if (activeEl) activeEl.textContent = activeCount;
    if (resolvedEl) resolvedEl.textContent = resolvedCount;
    if (avgEl) avgEl.textContent = `${avgMinutes}m`;
    if (usersEl) usersEl.textContent = alertSystem.users.length;
  }

  function renderAlerts() {
    const tbody = document.querySelector('#alerts-table tbody');
    if (!tbody) {
      console.warn('[ZamboAlert] Alerts table body not found; skipping render.');
      return;
    }
    tbody.innerHTML = alertSystem.alerts.map(alert => {
      return `
        <tr data-alert-id="${alert.id}">
          <td>${alert.id}</td>
          <td><i class="fas fa-bell-on"></i> ${alert.type}</td>
          <td>${alert.location}</td>
          <td><span class="pill ${alert.status === 'Active' ? 'warn' : 'ok'}">${alert.status}</span></td>
          <td><button class="btn" onclick="window.alertSystem.resolveAlert('${alert.id}')">Resolve</button></td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('#alerts-table tbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const alertId = tr.getAttribute('data-alert-id');
        selectAlert(alertId);
      });
    });
  }

  function renderRespondents() {
    const tbody = document.querySelector('#respondents-table tbody');
    if (!tbody) {
      console.warn('[ZamboAlert] Respondents table body not found; skipping render.');
      return;
    }
    tbody.innerHTML = alertSystem.users.map(user => {
      return `
        <tr>
          <td>${user.name}</td>
          <td>${user.role}</td>
          <td>${user.online ? 'Online' : 'Offline'}</td>
          <td>${user.location}</td>
          <td><button class="btn" onclick="alert('Contact ${user.name}');">Contact</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderLocationOptions() {
    const select = document.getElementById('alert-location');
    if (!select) return;
    select.innerHTML = getLocationOptions();
  }

  renderLocationOptions();
  renderAlerts();
  renderRespondents();
  renderMapMarkers();
  updateSummary();

  if('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(function(err) {
      console.warn('[ZamboAlert] Notification permission request failed:', err);
    });
  }

  window.alertSystem = alertSystem;
  window.makeCall = function(department) {
    const departments = {
      '911': 'Emergency Services (911)',
      'fire': 'Fire Department',
      'police': 'Police',
      'rescue': 'Rescue Team'
    };
    const dept = departments[department] || department;
    alert(`Initiating call to ${dept}...\n\nIn production, this would use a VoIP service to establish the call.`);
  };

  window.closeAlertModal = function() {
    const modal = document.getElementById('alert-modal');
    if (modal) modal.style.display = 'none';
  };

  const createAlertBtn = document.getElementById('create-alert-btn');
  if (createAlertBtn) {
    createAlertBtn.addEventListener('click', () => {
      const modal = document.getElementById('alert-modal');
      if (modal) modal.style.display = 'flex';
    });
  }

  const submitAlertBtn = document.getElementById('submit-alert-btn');
  if (submitAlertBtn) {
    submitAlertBtn.addEventListener('click', () => {
      const type = document.getElementById('alert-type');
      const location = document.getElementById('alert-location');
      const userInput = document.getElementById('alert-user');
      if (!type || !location) {
        console.error('[ZamboAlert] Alert form elements not found.');
        return;
      }
      const user = (userInput && userInput.value.trim()) || 'Community Member';
      window.alertSystem.addAlert(type.value, location.value, user);
      window.closeAlertModal();
    });
  }

});

