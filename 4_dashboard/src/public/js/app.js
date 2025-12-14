// WebSocket connection
let ws;
let workers = [];
let alerts = [];
let charts = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    initializeNavigation();
    updateTime();
    setInterval(updateTime, 1000);
    loadZones();
    
    // Set up automatic data refresh every 2 seconds
    setInterval(() => {
        fetchLatestData();
    }, 2000);
    
    // Add search input event listener
    const searchInput = document.getElementById('workerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterWorkers);
    }
    
    // Add filter select event listener
    const filterSelect = document.getElementById('workerFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', filterWorkers);
    }
});

// WebSocket initialization
function initializeWebSocket() {
    ws = new WebSocket('ws://localhost:8080');
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(initializeWebSocket, 3000);
    };
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'initial':
            workers = data.workers;
            alerts = data.alerts;
            updateDashboard();
            updateAlertsList();
            updateAlertBadge();
            break;
        case 'update':
            if (data.worker) {
                updateWorker(data.worker);
            } else if (data.workers) {
                workers = data.workers;
                updateDashboard();
            }
            break;
        case 'alert':
            addAlert(data.alert);
            playAlertSound();
            showNotification(data.alert);
            break;
        case 'alert_acknowledged':
            acknowledgeAlert(data.alertId);
            break;
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (connected) {
        statusElement.className = 'connection-status connected';
        statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Connected</span>';
    } else {
        statusElement.className = 'connection-status disconnected';
        statusElement.innerHTML = '<i class="fas fa-circle"></i><span>Disconnected</span>';
    }
}

// Update current time and date
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    document.getElementById('currentTime').textContent = timeString;
    document.getElementById('currentDate').textContent = dateString;
}

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function switchSection(section) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.classList.remove('active'));
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Initialize charts if history section
        if (section === 'history') {
            initializeCharts();
            // Set dropdown to "All Workers" by default and load data
            const select = document.getElementById('workerHistorySelect');
            if (select && select.value === '') {
                select.value = 'all';
                loadWorkerHistory();
            }
        }
        
        // Load alerts if alerts section
        if (section === 'alerts') {
            fetchAlerts();
        }
    }
}

// Update dashboard
function updateDashboard() {
    updateStats();
    updateWorkersGrid();
    updateWorkersTable();
    updateRecentAlerts();
}

// Fetch alerts from API
async function fetchAlerts() {
    try {
        const response = await fetch('http://localhost:3000/api/alerts');
        const fetchedAlerts = await response.json();
        alerts = fetchedAlerts;
        updateAlertsList();
        updateRecentAlerts();
        updateAlertBadge();
    } catch (error) {
        console.error('Error fetching alerts:', error);
    }
}

// Update stats cards
async function updateStats() {
    try {
        // Fetch stats from database with cache busting
        const response = await fetch('http://localhost:3000/api/stats?t=' + Date.now());
        const stats = await response.json();
        
        // Update total and active workers from database
        document.getElementById('totalWorkers').textContent = stats.totalWorkers;
        document.getElementById('activeWorkers').textContent = stats.activeWorkers;
        
        // Calculate warning and critical from current workers cache
        const warningCount = workers.filter(w => w.status === 'warning').length;
        const criticalCount = workers.filter(w => w.status === 'critical').length;
        
        document.getElementById('warningCount').textContent = warningCount;
        document.getElementById('criticalCount').textContent = criticalCount;
    } catch (error) {
        console.error('Error fetching stats:', error);
        // Fallback to cache-based calculation
        const totalWorkers = workers.length;
        const activeWorkers = workers.filter(w => w.status === 'normal').length;
        const warningCount = workers.filter(w => w.status === 'warning').length;
        const criticalCount = workers.filter(w => w.status === 'critical').length;
        
        document.getElementById('totalWorkers').textContent = totalWorkers;
        document.getElementById('activeWorkers').textContent = activeWorkers;
        document.getElementById('warningCount').textContent = warningCount;
        document.getElementById('criticalCount').textContent = criticalCount;
    }
}

// Update workers grid
function updateWorkersGrid() {
    const grid = document.getElementById('workersGrid');
    grid.innerHTML = '';
    
    workers.forEach(worker => {
        const card = createWorkerCard(worker);
        grid.appendChild(card);
    });
    
    // Populate worker selector in History section
    populateWorkerSelector();
    
    // Populate worker list in sidebar
    populateWorkerList();
}

// Populate worker list in sidebar
function populateWorkerList() {
    const workerList = document.getElementById('workerList');
    if (!workerList) return;
    
    workerList.innerHTML = '';
    
    workers.forEach(worker => {
        const li = document.createElement('li');
        li.textContent = worker.name;
        li.onclick = () => showWorkerDetails(worker.id);
        workerList.appendChild(li);
    });
}

// Create worker card
function createWorkerCard(worker) {
    const card = document.createElement('div');
    card.className = `worker-card status-${worker.status}`;
    
    card.innerHTML = `
        <div class="worker-header">
            <div class="worker-info">
                <h3 style="cursor: pointer; text-decoration: underline;" onclick="showWorkerDetails(${worker.id})">${worker.name}</h3>
                <p>ID: ${worker.id}</p>
            </div>
            <span class="status-badge ${worker.status}">${worker.status}</span>
        </div>
        <div class="vitals-grid">
            <div class="vital-item">
                <div class="vital-icon heart">
                    <i class="fas fa-heartbeat"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.vitals.heartRate}</h4>
                    <p>Heart Rate (bpm)</p>
                </div>
            </div>
            <div class="vital-item">
                <div class="vital-icon oxygen">
                    <i class="fas fa-lungs"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.vitals.spo2}%</h4>
                    <p>SpO2</p>
                </div>
            </div>
            <div class="vital-item">
                <div class="vital-icon temp">
                    <i class="fas fa-thermometer-half"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.vitals.temperature}°C</h4>
                    <p>Temperature</p>
                </div>
            </div>
            <div class="vital-item">
                <div class="vital-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.probability ? (worker.probability * 100).toFixed(1) : '0.0'}%</h4>
                    <p>Risk Probability</p>
                </div>
            </div>
            <div class="vital-item">
                <div class="vital-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                    <i class="fas fa-wave-square"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.hrv ? worker.hrv.toFixed(3) : '0.000'}</h4>
                    <p>HRV</p>
                </div>
            </div>
            <div class="vital-item">
                <div class="vital-icon" style="background: linear-gradient(135deg, ${worker.prediction === 1 ? '#10b981' : '#ef4444'} 0%, ${worker.prediction === 1 ? '#34d399' : '#f87171'} 100%);">
                    <i class="fas fa-stethoscope"></i>
                </div>
                <div class="vital-data">
                    <h4>${worker.prediction === 1 ? 'Low Risk' : 'High Risk'}</h4>
                    <p>${worker.probability ? (worker.probability * 100).toFixed(1) + '% confidence' : 'Health Status'}</p>
                </div>
            </div>
        </div>
        <div class="worker-footer">
            <button class="btn-view" onclick="viewWorkerHistory(${worker.id}, '${worker.name}')">
                <i class="fas fa-history"></i> View History
            </button>
        </div>
    `;
    
    return card;
}

// Update worker
function updateWorker(updatedWorker) {
    const index = workers.findIndex(w => w.id === updatedWorker.id);
    if (index !== -1) {
        workers[index] = updatedWorker;
        updateDashboard();
    }
}

// Update workers table
function updateWorkersTable() {
    const tbody = document.getElementById('workersTableBody');
    tbody.innerHTML = '';
    
    const filteredWorkers = getFilteredWorkers();
    
    filteredWorkers.forEach(worker => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${worker.id}</td>
            <td>${worker.name}</td>
            <td><span class="status-badge ${worker.status}">${worker.status}</span></td>
            <td>${worker.vitals.heartRate} bpm</td>
            <td>${worker.vitals.spo2}%</td>
            <td>${worker.vitals.temperature}°C</td>
            <td>${worker.probability ? (worker.probability * 100).toFixed(1) : '0.0'}%</td>
            <td>${worker.hrv ? worker.hrv.toFixed(3) : '0.000'}</td>
            <td><span class="status-badge ${worker.prediction === 1 ? 'success' : 'danger'}">${worker.prediction === 1 ? 'Low Risk' : 'High Risk'} (${worker.probability ? (worker.probability * 100).toFixed(0) : '0'}%)</span></td>
            <td>
                <button class="btn-view" onclick="viewWorkerHistory(${worker.id}, '${worker.name}')">
                    <i class="fas fa-history"></i> History
                </button>
            </td>
        `;
    });
}

// Add alert
function addAlert(alert) {
    alerts.unshift(alert);
    if (alerts.length > 50) alerts.pop();
    
    updateRecentAlerts();
    updateAlertsList();
    updateAlertBadge();
}

// Update recent alerts
function updateRecentAlerts() {
    const container = document.getElementById('recentAlerts');
    container.innerHTML = '';
    
    const recentAlerts = alerts.slice(0, 5);
    recentAlerts.forEach(alert => {
        const alertElement = createAlertElement(alert);
        container.appendChild(alertElement);
    });
}

// Update all alerts list
function updateAlertsList() {
    const container = document.getElementById('alertsList');
    container.innerHTML = '';
    
    alerts.forEach(alert => {
        const alertElement = createAlertElement(alert, true);
        container.appendChild(alertElement);
    });
}

// Create alert element
function createAlertElement(alert, showActions = false) {
    const div = document.createElement('div');
    div.className = `alert-item ${alert.type}`;
    if (alert.acknowledged) {
        div.style.opacity = '0.5';
    }
    
    const timeAgo = getTimeAgo(new Date(alert.timestamp));
    
    div.innerHTML = `
        <div class="alert-icon">
            <i class="fas fa-${getAlertIcon(alert.type)}"></i>
        </div>
        <div class="alert-content">
            <h4>${alert.workerName}</h4>
            <p>${alert.message}</p>
        </div>
        <div class="alert-time">${timeAgo}</div>
        ${showActions && !alert.acknowledged ? `
            <div class="alert-actions">
                <button class="btn-view" onclick="acknowledgeAlertById(${alert.id})">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        ` : ''}
    `;
    
    return div;
}

// Get alert icon
function getAlertIcon(type) {
    switch(type) {
        case 'fall_detected': return 'user-injured';
        case 'health_risk': return 'heart';
        case 'restricted_area': return 'exclamation-triangle';
        case 'low_battery': return 'battery-quarter';
        default: return 'exclamation-circle';
    }
}

// Get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// Update alert badge
function updateAlertBadge() {
    const unacknowledged = alerts.filter(a => !a.acknowledged).length;
    document.getElementById('alertBadge').textContent = unacknowledged;
}

// Acknowledge alert
function acknowledgeAlertById(alertId) {
    fetch(`http://localhost:3000/api/alerts/${alertId}/acknowledge`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        console.log('Alert acknowledged:', data);
    })
    .catch(error => console.error('Error acknowledging alert:', error));
}

function acknowledgeAlert(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.acknowledged = true;
        updateRecentAlerts();
        updateAlertsList();
        updateAlertBadge();
    }
}

// Filter workers based on search and status
function getFilteredWorkers() {
    const searchTerm = document.getElementById('workerSearch')?.value.toLowerCase() || '';
    
    console.log('Search term:', searchTerm);
    console.log('Total workers:', workers.length);
    
    const filtered = workers.filter(worker => {
        const workerName = (worker.name || '').toLowerCase();
        const workerId = String(worker.id || '').toLowerCase();
        
        const matchesSearch = searchTerm === '' || 
                            workerName.includes(searchTerm) || 
                            workerId.includes(searchTerm);
        
        return matchesSearch;
    });
    
    console.log('Filtered workers:', filtered.length);
    return filtered;
}

// Filter workers function
function filterWorkers() {
    console.log('filterWorkers called');
    updateWorkersTable();
}

// Populate worker selector for history
function populateWorkerSelector() {
    const select = document.getElementById('workerHistorySelect');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select Worker</option><option value="all">All Workers (Compare)</option>';
    
    workers.forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = `${worker.name} (ID: ${worker.id})`;
        if (worker.id == currentValue) option.selected = true;
        select.appendChild(option);
    });
    
    // Restore "all" selection if it was selected
    if (currentValue === 'all') {
        select.value = 'all';
    }
    
    // If a worker was selected, load their data
    if (currentValue) {
        loadWorkerHistory();
    }
}

// Load worker history for charts
async function loadWorkerHistory() {
    const select = document.getElementById('workerHistorySelect');
    const workerId = select.value;
    
    if (!workerId) {
        // Clear charts if no worker selected
        return;
    }
    
    try {
        const days = getCurrentTimeRangeDays();
        
        if (workerId === 'all') {
            // Load all workers for comparison
            await loadAllWorkersHistory(days);
        } else {
            // Load single worker
            const response = await fetch(`http://localhost:3000/api/history-chart/${workerId}/${days}`);
            const result = await response.json();
            
            if (result.data && result.data.length > 0) {
                updateChartsWithData(result.data);
            } else {
                console.log('No history data available for this worker');
            }
        }
    } catch (error) {
        console.error('Error loading worker history:', error);
    }
}

// Load all workers history for comparison
async function loadAllWorkersHistory(days) {
    try {
        // Fetch data for all workers
        const promises = workers.map(worker => 
            fetch(`http://localhost:3000/api/history-chart/${worker.id}/${days}`)
                .then(res => res.json())
                .then(result => ({
                    workerId: worker.id,
                    workerName: worker.name,
                    data: result.data || []
                }))
                .catch(err => {
                    console.error(`Error loading data for worker ${worker.id}:`, err);
                    return {
                        workerId: worker.id,
                        workerName: worker.name,
                        data: []
                    };
                })
        );
        
        const allData = await Promise.all(promises);
        console.log('All workers data loaded:', allData);
        updateChartsWithAllWorkers(allData);
    } catch (error) {
        console.error('Error loading all workers history:', error);
    }
}

// Get current time range in days
function getCurrentTimeRangeDays() {
    const daysFilter = document.getElementById('daysFilter');
    return daysFilter ? parseInt(daysFilter.value) : 7;
}

// Update charts with real data from health_history
function updateChartsWithData(historyData) {
    if (!historyData || historyData.length === 0) return;
    
    // Sort by date ascending
    historyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Get selected worker name
    const select = document.getElementById('workerHistorySelect');
    const selectedOption = select.options[select.selectedIndex];
    const workerName = selectedOption ? selectedOption.textContent : 'Worker';
    
    // Extract labels and data
    const labels = historyData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const heartRateData = historyData.map(d => d.avg_pulse || 0);
    const spo2Data = historyData.map(d => d.avg_spo2 || 0);
    const tempData = historyData.map(d => d.avg_temp || 0);
    
    // Update Heart Rate Chart
    if (charts.heartRate) {
        charts.heartRate.data.labels = labels;
        charts.heartRate.data.datasets = [{
            label: workerName,
            data: heartRateData,
            borderColor: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
        }];
        charts.heartRate.options.plugins.legend.display = false;
        charts.heartRate.update();
    }
    
    // Update SpO2 Chart
    if (charts.spo2) {
        charts.spo2.data.labels = labels;
        charts.spo2.data.datasets = [{
            label: workerName,
            data: spo2Data,
            borderColor: '#2196f3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
        }];
        charts.spo2.options.plugins.legend.display = false;
        charts.spo2.update();
    }
    
    // Update Temperature Chart
    if (charts.temperature) {
        charts.temperature.data.labels = labels;
        charts.temperature.data.datasets = [{
            label: workerName,
            data: tempData,
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 2
        }];
        charts.temperature.options.plugins.legend.display = false;
        charts.temperature.update();
    }
}

// Update charts with all workers data for comparison
function updateChartsWithAllWorkers(allWorkersData) {
    if (!allWorkersData || allWorkersData.length === 0) return;
    
    // Check which workers have data
    console.log('=== All Workers Data Analysis ===');
    allWorkersData.forEach((worker, idx) => {
        console.log(`Worker ${idx + 1}: ${worker.workerName}`);
        console.log(`  - Data points: ${worker.data.length}`);
        if (worker.data.length > 0) {
            console.log(`  - Date range: ${worker.data[0].date} to ${worker.data[worker.data.length - 1].date}`);
        } else {
            console.log(`  - ⚠️ NO DATA IN HEALTH_HISTORY TABLE`);
        }
    });
    
    // Get all unique dates across all workers
    const allDates = new Set();
    allWorkersData.forEach(worker => {
        worker.data.forEach(d => allDates.add(d.date));
    });
    
    if (allDates.size === 0) {
        console.error('No health history data available for any worker');
        alert('No health history data available. Please ensure data exists in the health_history table.');
        return;
    }
    
    const sortedDates = Array.from(allDates).sort();
    const labels = sortedDates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    // Create datasets for each worker with distinct colors
    const colors = [
        '#f44336', // Red - Worker 0
        '#2196f3', // Blue - Worker 1  
        '#4caf50', // Green - Worker 2
        '#ff9800', // Orange - Worker 3
        '#9c27b0', // Purple - Worker 4
        '#00bcd4', // Cyan - Worker 5
        '#ffeb3b', // Yellow - Worker 6
        '#e91e63'  // Pink - Worker 7
    ];
    
    console.log('Creating datasets for all workers...');
    
    // Heart Rate datasets - Include ALL workers, even with empty data
    const hrDatasets = allWorkersData.map((worker, index) => {
        const dataMap = new Map(worker.data.map(d => [d.date, d.avg_pulse || null]));
        const dataset = {
            label: worker.workerName + (worker.data.length === 0 ? ' (No Data)' : ''),
            data: sortedDates.map(date => dataMap.get(date)),
            borderColor: colors[index],
            backgroundColor: colors[index] + '30',
            tension: 0.4,
            fill: false,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: false,
            hidden: worker.data.length === 0 // Hide workers with no data
        };
        console.log(`HR Dataset: ${worker.workerName}, Color: ${colors[index]}, Points: ${worker.data.length}`);
        return dataset;
    });
    
    // SpO2 datasets - Include ALL workers
    const spo2Datasets = allWorkersData.map((worker, index) => {
        const dataMap = new Map(worker.data.map(d => [d.date, d.avg_spo2 || null]));
        return {
            label: worker.workerName + (worker.data.length === 0 ? ' (No Data)' : ''),
            data: sortedDates.map(date => dataMap.get(date)),
            borderColor: colors[index],
            backgroundColor: colors[index] + '30',
            tension: 0.4,
            fill: false,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: false,
            hidden: worker.data.length === 0
        };
    });
    
    // Temperature datasets - Include ALL workers
    const tempDatasets = allWorkersData.map((worker, index) => {
        const dataMap = new Map(worker.data.map(d => [d.date, d.avg_temp || null]));
        return {
            label: worker.workerName + (worker.data.length === 0 ? ' (No Data)' : ''),
            data: sortedDates.map(date => dataMap.get(date)),
            borderColor: colors[index],
            backgroundColor: colors[index] + '30',
            tension: 0.4,
            fill: false,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            spanGaps: false,
            hidden: worker.data.length === 0
        };
    });
    
    // Update charts
    if (charts.heartRate) {
        charts.heartRate.data.labels = labels;
        charts.heartRate.data.datasets = hrDatasets;
        charts.heartRate.options.plugins.legend.display = true;
        charts.heartRate.update();
    }
    
    if (charts.spo2) {
        charts.spo2.data.labels = labels;
        charts.spo2.data.datasets = spo2Datasets;
        charts.spo2.options.plugins.legend.display = true;
        charts.spo2.update();
    }
    
    if (charts.temperature) {
        charts.temperature.data.labels = labels;
        charts.temperature.data.datasets = tempDatasets;
        charts.temperature.options.plugins.legend.display = true;
        charts.temperature.update();
    }
}

// Initialize charts
function initializeCharts() {
    if (Object.keys(charts).length > 0) return; // Already initialized
    
    // Heart Rate Chart
    const hrCtx = document.getElementById('heartRateChart').getContext('2d');
    charts.heartRate = new Chart(hrCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Heart Rate',
                data: [],
                borderColor: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Heart Rate (bpm)')
    });
    
    // SpO2 Chart
    const spo2Ctx = document.getElementById('spo2Chart').getContext('2d');
    charts.spo2 = new Chart(spo2Ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'SpO2',
                data: [],
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('SpO2 (%)')
    });
    
    // Temperature Chart
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    charts.temperature = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature',
                data: [],
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: getChartOptions('Temperature (°C)')
    });
    
    // Alerts Chart
    const alertsCtx = document.getElementById('alertsChart').getContext('2d');
    charts.alerts = new Chart(alertsCtx, {
        type: 'doughnut',
        data: {
            labels: ['Fall Detected', 'Health Risk', 'Restricted Area', 'Low Battery'],
            datasets: [{
                data: [
                    alerts.filter(a => a.type === 'fall_detected').length,
                    alerts.filter(a => a.type === 'health_risk').length,
                    alerts.filter(a => a.type === 'restricted_area').length,
                    alerts.filter(a => a.type === 'low_battery').length
                ],
                backgroundColor: ['#f44336', '#ff9800', '#9c27b0', '#ffc107']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#ffffff' }
                }
            }
        }
    });
}

// Generate time labels with custom intervals
function generateTimeLabels(count = 12, intervalMinutes = 5) {
    const labels = [];
    for (let i = count - 1; i >= 0; i--) {
        const time = new Date(Date.now() - i * intervalMinutes * 60 * 1000);
        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    return labels;
}

// Generate day labels for weekly view
function generateDayLabels(count = 7) {
    const labels = [];
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }
    return labels;
}

// Generate random data
function generateRandomData(min, max, count) {
    const data = [];
    for (let i = 0; i < count; i++) {
        data.push(Math.random() * (max - min) + min);
    }
    return data;
}

// Get chart color
function getChartColor(index, alpha = 1) {
    const colors = [
        `rgba(33, 150, 243, ${alpha})`,
        `rgba(76, 175, 80, ${alpha})`,
        `rgba(255, 152, 0, ${alpha})`,
        `rgba(156, 39, 176, ${alpha})`,
        `rgba(244, 67, 54, ${alpha})`
    ];
    return colors[index % colors.length];
}

// Get chart options
function getChartOptions(yAxisLabel) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#ffffff' }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: yAxisLabel,
                    color: '#ffffff'
                },
                ticks: { color: '#b0b0b0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
                ticks: { color: '#b0b0b0' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        }
    };
}

// View worker details
function viewWorkerDetails(workerId) {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;
    
    const modal = document.getElementById('workerModal');
    const details = document.getElementById('workerDetails');
    
    details.innerHTML = `
        <h2>${worker.name}</h2>
        <div class="worker-details-grid">
            <div class="detail-section">
                <h3>Basic Information</h3>
                <p><strong>Worker ID:</strong> ${worker.id}</p>
                <p><strong>Helmet ID:</strong> ${worker.helmetId}</p>
                <p><strong>Status:</strong> <span class="status-badge ${worker.status}">${worker.status}</span></p>
                <p><strong>Battery:</strong> ${worker.battery}%</p>
                <p><strong>Last Update:</strong> ${new Date(worker.lastUpdate).toLocaleString()}</p>
            </div>
            <div class="detail-section">
                <h3>Vital Signs</h3>
                <p><strong>Heart Rate:</strong> ${worker.vitals.heartRate} bpm</p>
                <p><strong>SpO2:</strong> ${worker.vitals.spo2}%</p>
                <p><strong>Temperature:</strong> ${worker.vitals.temperature}°C</p>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('workerModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('workerModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Fetch latest data from server
async function fetchLatestData() {
    try {
        // Fetch workers
        const workersResponse = await fetch('http://localhost:3000/api/workers?t=' + Date.now());
        const workersData = await workersResponse.json();
        workers = workersData;
        
        // Fetch alerts
        await fetchAlerts();
        
        // Update dashboard
        updateDashboard();
        
        console.log('Data refreshed successfully');
    } catch (error) {
        console.error('Error fetching latest data:', error);
    }
}

// Refresh data (triggered by button)
function refreshData() {
    console.log('Manual refresh triggered...');
    fetchLatestData();
    
    // Show feedback
    const btn = event?.target?.closest('button');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.add('fa-spin');
            setTimeout(() => icon.classList.remove('fa-spin'), 1000);
        }
    }
}

// Clear all alerts
function clearAllAlerts() {
    alerts.forEach(alert => {
        if (!alert.acknowledged) {
            acknowledgeAlertById(alert.id);
        }
    });
}

// Global variable for time range
let currentTimeRange = '1h';

// Update charts based on time range
function updateChartsWithTimeRange(range) {
    let dataPoints, timeLabels;
    
    switch(range) {
        case '1h':
            dataPoints = 12; // 5-minute intervals
            timeLabels = generateTimeLabels(12, 5);
            break;
        case '24h':
            dataPoints = 24; // hourly
            timeLabels = generateTimeLabels(24, 60);
            break;
        case '7d':
            dataPoints = 7; // daily
            timeLabels = generateDayLabels(7);
            break;
    }
    
    // Update each chart
    if (charts.heartRate) {
        charts.heartRate.data.labels = timeLabels;
        charts.heartRate.data.datasets.forEach(dataset => {
            dataset.data = generateRandomData(60, 100, dataPoints);
        });
        charts.heartRate.update();
    }
    
    if (charts.spo2) {
        charts.spo2.data.labels = timeLabels;
        charts.spo2.data.datasets.forEach(dataset => {
            dataset.data = generateRandomData(95, 100, dataPoints);
        });
        charts.spo2.update();
    }
    
    if (charts.temperature) {
        charts.temperature.data.labels = timeLabels;
        charts.temperature.data.datasets.forEach(dataset => {
            dataset.data = generateRandomData(36.5, 37.5, dataPoints);
        });
        charts.temperature.update();
    }
}

// Play alert sound
function playAlertSound() {
    // You can add audio file here
    // const audio = new Audio('alert-sound.mp3');
    // audio.play();
}

// Show notification
function showNotification(alert) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('SafeTonics Alert', {
            body: alert.message,
            icon: '/favicon.ico'
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification(alert);
            }
        });
    }
}

// View worker history
async function viewWorkerHistory(workerId, workerName) {
    try {
        const response = await fetch(`http://localhost:3000/api/historical/${workerId}`);
        const data = await response.json();
        
        const modal = document.getElementById('workerHistoryModal');
        const content = document.getElementById('workerHistoryContent');
        
        // Create history display
        let historyHTML = `
            <h2>${workerName} - Health History (Last 30 Days)</h2>
            <button class="btn-refresh" onclick="viewWorkerHistory(${workerId}, '${workerName}')">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <div class="history-container">
        `;
        
        if (data.history && data.history.length > 0) {
            historyHTML += `
                <div class="history-table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Heart Rate (bpm)</th>
                                <th>SpO2 (%)</th>
                                <th>Temperature (°C)</th>
                            </tr>
                            <tr class="subheader">
                                <th></th>
                                <th>Min / Avg / Max</th>
                                <th>Min / Avg / Max</th>
                                <th>Min / Avg / Max</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.history.forEach(day => {
                const date = new Date(day.date);
                const formattedDate = date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                
                historyHTML += `
                    <tr>
                        <td><strong>${formattedDate}</strong></td>
                        <td>
                            <span class="stat-min">${day.min_pulse || '-'}</span> / 
                            <span class="stat-avg">${day.avg_pulse ? Math.round(day.avg_pulse) : '-'}</span> / 
                            <span class="stat-max">${day.max_pulse || '-'}</span>
                        </td>
                        <td>
                            <span class="stat-min">${day.min_spo2 || '-'}</span> / 
                            <span class="stat-avg">${day.avg_spo2 ? Math.round(day.avg_spo2) : '-'}</span> / 
                            <span class="stat-max">${day.max_spo2 || '-'}</span>
                        </td>
                        <td>
                            <span class="stat-min">${day.min_temp ? day.min_temp.toFixed(1) : '-'}</span> / 
                            <span class="stat-avg">${day.avg_temp ? day.avg_temp.toFixed(1) : '-'}</span> / 
                            <span class="stat-max">${day.max_temp ? day.max_temp.toFixed(1) : '-'}</span>
                        </td>
                    </tr>
                `;
            });
            
            historyHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            historyHTML += '<p class="no-data">No historical data available for this worker.</p>';
        }
        
        historyHTML += '</div>';
        
        content.innerHTML = historyHTML;
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching worker history:', error);
        alert('Failed to load worker history');
    }
}

// Close history modal
function closeHistoryModal() {
    const modal = document.getElementById('workerHistoryModal');
    modal.style.display = 'none';
}

// Close modal on outside click
window.onclick = function(event) {
    const historyModal = document.getElementById('workerHistoryModal');
    const detailsModal = document.getElementById('workerDetailsModal');
    if (event.target === historyModal) {
        historyModal.style.display = 'none';
    }
    if (event.target === detailsModal) {
        detailsModal.style.display = 'none';
    }
}

// Show worker details modal
async function showWorkerDetails(workerId) {
    try {
        const response = await fetch(`http://localhost:3000/api/worker/${workerId}`);
        const worker = await response.json();
        
        const modal = document.getElementById('workerDetailsModal');
        const content = document.getElementById('workerDetailsContent');
        
        const bmi = worker.bmi ? worker.bmi.toFixed(1) : 'N/A';
        const bmiCategory = getBMICategory(worker.bmi);
        
        content.innerHTML = `
            <h2>${worker.fname} ${worker.lname}</h2>
            <div class="worker-details-grid">
                <div class="detail-card">
                    <h3><i class="fas fa-user"></i> Personal Information</h3>
                    <div class="detail-row">
                        <span class="detail-label">Worker ID:</span>
                        <span class="detail-value">${worker.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Full Name:</span>
                        <span class="detail-value">${worker.fname} ${worker.lname}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Gender:</span>
                        <span class="detail-value">${worker.gender || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Age:</span>
                        <span class="detail-value">${worker.age || 'N/A'} years</span>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h3><i class="fas fa-ruler-vertical"></i> Physical Stats</h3>
                    <div class="detail-row">
                        <span class="detail-label">Height:</span>
                        <span class="detail-value">${worker.height_m ? worker.height_m + ' m' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Weight:</span>
                        <span class="detail-value">${worker.weight_kg ? worker.weight_kg + ' kg' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">BMI:</span>
                        <span class="detail-value">${bmi} <span class="bmi-category ${bmiCategory.toLowerCase()}">(${bmiCategory})</span></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Registered:</span>
                        <span class="detail-value">${new Date(worker.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error fetching worker details:', error);
        alert('Failed to load worker details');
    }
}

// Get BMI category
function getBMICategory(bmi) {
    if (!bmi) return 'N/A';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
}

// Close worker details modal
function closeWorkerDetailsModal() {
    const modal = document.getElementById('workerDetailsModal');
    modal.style.display = 'none';
}
