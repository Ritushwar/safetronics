const socket = io();

// Keep previous alert counts so we can detect increases
let prevAlertCounts = {
    fallDetectedCount: 0,
    sosAlertsCount: 0,
    healthAlertsCount: 0,
    totalAlerts: 0
};
let alertsInitialized = false;

// Play an alert sound based on type using WebAudio API
function playAlertSound(type) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();

        const now = ctx.currentTime;

        // create nodes
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);

        // configure tone per type
        if (type === 'sos') {
            // urgent siren-like: rapid two-tone sequence
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(900, now);
            o.frequency.linearRampToValueAtTime(700, now + 0.15);
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
            o.start(now);
            o.stop(now + 0.5);
        } else if (type === 'fall_detected' || type === 'fall') {
            // lower alert
            o.type = 'triangle';
            o.frequency.setValueAtTime(600, now);
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            o.start(now);
            o.stop(now + 0.6);
        } else {
            // health or default - single short beep
            o.type = 'sine';
            o.frequency.setValueAtTime(750, now);
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            o.start(now);
            o.stop(now + 0.35);
        }
    } catch (e) {
        // fallback: try using simple Audio beep if available (no-op if not)
        console.warn('Audio API not available for alert sound', e.message);
    }
}

function flashStatCard(selectorId) {
    const el = document.getElementById(selectorId);
    if (!el) return;
    // find closest stat-card
    const card = el.closest('.stat-card') || el.parentElement;
    if (!card) return;
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 900);
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    updateTime();
    setInterval(updateTime, 1000);
    // Load workers to populate dropdowns
    loadWorkers();
});

// Navigation functionality
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

socket.on("workers", (data)=> {
    // Update stats in dashboard
    const total = document.getElementById("totalWorkers")
    const active = document.getElementById("activeWorkers")
    total.innerText = data.totalWorkers;
    active.innerText = data.activeWorkers;
    
    // Update workers table if data contains workers array
    if (data.workers && Array.isArray(data.workers)) {
        updateWorkersTable(data.workers);
    }
})

socket.on("alerts", (data)=> {
    // Update warning count (fall_detected alerts) - now "Fall Warning"
    const warningCount = document.getElementById("warningCount");
    if (warningCount) {
        const indicator = warningCount.querySelector('.alert-indicator');
        if (indicator) {
            if (warningCount.firstChild && warningCount.firstChild.nodeType === Node.TEXT_NODE) {
                warningCount.firstChild.nodeValue = (data.fallDetectedCount || 0) + ' ';
            } else {
                warningCount.innerHTML = `${data.fallDetectedCount || 0} <span class="alert-indicator" id="warningIndicator"></span>`;
            }
        } else {
            warningCount.innerText = data.fallDetectedCount || 0;
        }
    }
    
    // Update critical alerts count (SOS alerts) - now "SOS Alerts"
    const criticalCount = document.getElementById("criticalCount");
    if (criticalCount) {
        const indicator = criticalCount.querySelector('.alert-indicator');
        if (indicator) {
            if (criticalCount.firstChild && criticalCount.firstChild.nodeType === Node.TEXT_NODE) {
                criticalCount.firstChild.nodeValue = (data.sosAlertsCount || 0) + ' ';
            } else {
                criticalCount.innerHTML = `${data.sosAlertsCount || 0} <span class="alert-indicator" id="criticalIndicator"></span>`;
            }
        } else {
            criticalCount.innerText = data.sosAlertsCount || 0;
        }
    }
    
    // Update health alerts count (Health alerts) - new "Health Alerts"
    const healthCount = document.getElementById("healthCount");
    if (healthCount) {
        const indicator = healthCount.querySelector('.alert-indicator');
        if (indicator) {
            if (healthCount.firstChild && healthCount.firstChild.nodeType === Node.TEXT_NODE) {
                healthCount.firstChild.nodeValue = (data.healthAlertsCount || 0) + ' ';
            } else {
                healthCount.innerHTML = `${data.healthAlertsCount || 0} <span class="alert-indicator" id="healthIndicator"></span>`;
            }
        } else {
            healthCount.innerText = data.healthAlertsCount || 0;
        }
    }
    
    // Update alert badge in sidebar if exists
    const alertBadge = document.getElementById("alertBadge");
    if (alertBadge) {
        alertBadge.innerText = data.totalAlerts || 0;
    }

    // Detect increases and play sound + flash indicator
    try {
        // On first alerts packet, just initialize previous counts and don't play sounds
        if (!alertsInitialized) {
            prevAlertCounts.fallDetectedCount = data.fallDetectedCount || 0;
            prevAlertCounts.sosAlertsCount = data.sosAlertsCount || 0;
            prevAlertCounts.healthAlertsCount = data.healthAlertsCount || 0;
            prevAlertCounts.totalAlerts = data.totalAlerts || 0;
            alertsInitialized = true;
            // do not play sounds on initial load; continue to update UI
        }
        // Fall warnings
        if ((data.fallDetectedCount || 0) > (prevAlertCounts.fallDetectedCount || 0)) {
            playAlertSound('fall_detected');
            flashStatCard('warningCount');
            const ind = document.getElementById('warningIndicator'); if (ind) { ind.classList.add('warn'); }
            setTimeout(() => { if (ind) ind.classList.remove('warn'); }, 1200);
        }
        // SOS alerts
        if ((data.sosAlertsCount || 0) > (prevAlertCounts.sosAlertsCount || 0)) {
            playAlertSound('sos');
            flashStatCard('criticalCount');
            const ind = document.getElementById('criticalIndicator'); if (ind) { ind.classList.add('crit'); }
            setTimeout(() => { if (ind) ind.classList.remove('crit'); }, 1200);
        }
        // Health alerts
        if ((data.healthAlertsCount || 0) > (prevAlertCounts.healthAlertsCount || 0)) {
            playAlertSound('health');
            flashStatCard('healthCount');
            const ind = document.getElementById('healthIndicator'); if (ind) { ind.classList.add('health'); }
            setTimeout(() => { if (ind) ind.classList.remove('health'); }, 1200);
        }

        // update prev counts
        prevAlertCounts.fallDetectedCount = data.fallDetectedCount || 0;
        prevAlertCounts.sosAlertsCount = data.sosAlertsCount || 0;
        prevAlertCounts.healthAlertsCount = data.healthAlertsCount || 0;
        prevAlertCounts.totalAlerts = data.totalAlerts || 0;
    } catch (e) {
        console.error('Error handling alert sound/flash:', e);
    }
    
    // Update recent alerts section if needed
    if (data.recentAlerts && Array.isArray(data.recentAlerts)) {
        updateRecentAlerts(data.recentAlerts);
    }
})

socket.on("measurements", (data)=> {
    if (data && Array.isArray(data)) {
        updateMeasurementsTable(data);
    }
})

socket.on("allAlerts", (data)=> {
    if (data && Array.isArray(data)) {
        updateAllAlertsList(data);
    }
})

socket.on("recentAlerts", (data) => {
    if (data && Array.isArray(data)) {
        updateRecentAlertsDisplay(data);
    }
})

socket.on("acknowledgeResult", (result)=> {
    if (result.success) {
        console.log('Alert acknowledged successfully');
        // Could show a success message here
    } else {
        console.error('Failed to acknowledge alert:', result.message);
        // Could show an error message here
    }
})

// Function to update recent alerts display with new format
function updateRecentAlertsDisplay(alerts) {
    const recentAlertsContainer = document.getElementById('recentAlerts');
    if (!recentAlertsContainer) return;
    
    recentAlertsContainer.innerHTML = '';
    
    if (alerts.length === 0) {
        recentAlertsContainer.innerHTML = '<p class="no-alerts">No recent alerts</p>';
        return;
    }
    
    // Create table structure for recent alerts
    const tableHTML = `
        <table class="recent-alerts-table">
            <thead>
                <tr>
                    <th>Worker ID</th>
                    <th>Worker Name</th>
                    <th>Type</th>
                    <th>Acknowledged</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                ${alerts.map(alert => {
                    const time = new Date(alert.time);
                    const timeString = time.toLocaleTimeString('en-US', { 
                        hour12: true, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    const acknowledgedClass = alert.acknowledged === 'Done' ? 'ack-done' : 'ack-remaining';
                    const typeClass = alert.type === 'fall_detected' ? 'type-fall' : 
                                     alert.type === 'sos' ? 'type-sos' : 'type-health';
                    
                    return `
                        <tr>
                            <td>${alert.worker_id}</td>
                            <td>${alert.workerName}</td>
                            <td><span class="alert-type ${typeClass}">${alert.type.replace('_', ' ')}</span></td>
                            <td><span class="ack-status ${acknowledgedClass}">${alert.acknowledged}</span></td>
                            <td class="time-cell">${timeString}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    recentAlertsContainer.innerHTML = tableHTML;
}

// Helper function to format time
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
}

// Function to update workers table
function updateWorkersTable(workers) {
    const tableBody = document.getElementById('workersTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    workers.forEach(worker => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${worker.id || 'N/A'}</td>
            <td>${worker.name || 'Unknown'}</td>
            <td>${worker.gender || '--'}</td>
            <td>${worker.height ? worker.height.toFixed(2) : '--'}</td>
            <td>${worker.weight ? worker.weight.toFixed(1) : '--'}</td>
            <td>${worker.age || '--'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Function to update measurements table
function updateMeasurementsTable(measurements) {
    const tableBody = document.getElementById('measurementsBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    measurements.forEach(measurement => {
        const row = document.createElement('tr');
        
        // Determine risk level display based on prediction value and riskLevel
        let riskClass = 'status-normal'; // Default for Low Risk
        let riskText = 'Low Risk';
        
        if (measurement.riskLevel === 'High Risk' || measurement.prediction === "0" || measurement.prediction === 0) {
            riskClass = 'status-critical';
            riskText = 'High Risk';
        }
        
        // Format timestamp: use relative time for readability and put exact local time in tooltip
        const timestamp = measurement.timestamp ? new Date(measurement.timestamp) : (measurement.timestamp_ms ? new Date(measurement.timestamp_ms) : null);
    const localTimeString = timestamp ? timestamp.toLocaleString() : '--';
    // show exact local time (no relative label) per user request
    const displayTime = localTimeString;
        
        // body_temp may be null/undefined; format safely and display in Celsius
        const tempVal = (typeof measurement.body_temp === 'number') ? measurement.body_temp.toFixed(1) : '--';

        row.innerHTML = `
            <td>${measurement.worker_id}</td>
            <td>${measurement.fname || ''} ${measurement.lname || ''}</td>
            <td>${measurement.gender || '--'}</td>
            <td>${tempVal}°C</td>
            <td>${measurement.pulse_rate != null ? measurement.pulse_rate : '--'}</td>
            <td>${measurement.spo2 != null ? measurement.spo2 + '%' : '--'}</td>
            <td><span class="status-badge ${riskClass}">${riskText}</span></td>
            <td class="timestamp" title="${measurement.timestamp || measurement.timestamp_ms || ''}">${displayTime}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Function to update all alerts list
function updateAllAlertsList(alerts) {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) {
        return;
    }
    
    alertsList.innerHTML = '';
    
    if (alerts.length === 0) {
        alertsList.innerHTML = '<div class="no-alerts"><p>No unacknowledged alerts</p></div>';
        return;
    }
    
    alerts.forEach((alert, index) => {
        const alertCard = document.createElement('div');
        alertCard.className = 'alert-card';
        alertCard.classList.add(`alert-${alert.type}`);
        
        // Format timestamp
        const timestamp = new Date(alert.createdAt);
        const timeString = timestamp.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        // Determine alert type display name
        let typeDisplay = alert.type;
        switch(alert.type) {
            case 'fall_detected':
                typeDisplay = 'Fall Detection';
                break;
            case 'sos':
                typeDisplay = 'SOS Alert';
                break;
            case 'Health':
                typeDisplay = 'Health Alert';
                break;
        }
        
        alertCard.innerHTML = `
            <div class="alert-header">
                <div class="alert-type">${typeDisplay}</div>
                <div class="alert-time">${timeString}</div>
            </div>
            <div class="alert-content">
                <div class="alert-worker">
                    <strong>Worker ID:</strong> ${alert.worker_id} 
                    <span class="worker-name">(${alert.fname} ${alert.lname})</span>
                </div>
                <div class="alert-type-info">
                    <strong>Type:</strong> ${alert.type}
                </div>
            </div>
            <div class="alert-actions">
                <button class="acknowledge-btn" onclick="acknowledgeAlert(${alert.id})" title="Acknowledge Alert">
                    <i class="fas fa-check"></i> Acknowledge
                </button>
            </div>
        `;
        
        alertsList.appendChild(alertCard);
    });
}

// Function to acknowledge an alert
function acknowledgeAlert(alertId) {
    console.log(`Acknowledging alert ${alertId}`);
    socket.emit('acknowledgeAlert', alertId);
}

// Function to clear all alerts (placeholder for now)
function clearAllAlerts() {
    console.log('Clear all alerts functionality to be implemented');
    // This could send a request to acknowledge all alerts
}

// Search functionality for workers
function filterWorkers() {
    const searchInput = document.getElementById('workerSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#workersTableBody tr');
    
    rows.forEach(row => {
        const name = row.cells[1].textContent.toLowerCase();
        const id = row.cells[0].textContent.toLowerCase();
        const gender = row.cells[2].textContent.toLowerCase();
        
        if (name.includes(searchTerm) || id.includes(searchTerm) || gender.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}


socket.on("connect", ()=> {
    const connectionBadge = document.getElementById("connectionStatusText")
    const connectionDot = document.getElementById("connectionStatusDot")
    connectionBadge.innerText = "Connected"
    connectionDot.style.color = "green"
})

socket.on("disconnect", ()=> {
    const connectionBadge = document.getElementById("connectionStatusText")
    const connectionDot = document.getElementById("connectionStatusDot")
    connectionBadge.innerText = "Disconnected"
    connectionDot.style.color = "red"
})

// ===========================
// Add Worker Modal Functions
// ===========================

function openAddWorkerModal() {
    document.getElementById('addWorkerModal').style.display = 'block';
}

function closeAddWorkerModal() {
    document.getElementById('addWorkerModal').style.display = 'none';
    document.getElementById('addWorkerForm').reset();
    document.getElementById('bmiValue').textContent = 'Enter height and weight to calculate';
}

// Calculate BMI in real-time
function calculateBMI() {
    const height = parseFloat(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const bmiDisplay = document.getElementById('bmiValue');
    
    if (height && weight && height > 0) {
        const bmi = weight / (height * height);
        let bmiCategory = '';
        
        if (bmi < 18.5) bmiCategory = ' (Underweight)';
        else if (bmi < 25) bmiCategory = ' (Normal)';
        else if (bmi < 30) bmiCategory = ' (Overweight)';
        else bmiCategory = ' (Obese)';
        
        bmiDisplay.textContent = `${bmi.toFixed(2)}${bmiCategory}`;
        bmiDisplay.style.color = bmi < 18.5 || bmi >= 30 ? 'var(--warning-color)' : 'var(--success-color)';
    } else {
        bmiDisplay.textContent = 'Enter height and weight to calculate';
        bmiDisplay.style.color = 'var(--primary-color)';
    }
}

// Add event listeners for real-time BMI calculation
document.addEventListener('DOMContentLoaded', function() {
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    
    if (heightInput) heightInput.addEventListener('input', calculateBMI);
    if (weightInput) weightInput.addEventListener('input', calculateBMI);
    
    // Handle form submission
    const addWorkerForm = document.getElementById('addWorkerForm');
    if (addWorkerForm) {
        addWorkerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.querySelector('.btn-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            
            const formData = new FormData(this);
            const workerData = Object.fromEntries(formData);
            
            try {
                const response = await fetch('/api/workers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(workerData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Worker added successfully!');
                    closeAddWorkerModal();
                    // Refresh the workers table
                    loadWorkers();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error adding worker:', error);
                alert('Error adding worker. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Worker';
            }
        });
    }
});

// Load workers from API
async function loadWorkers() {
    try {
        const response = await fetch('/api/workers');
        const result = await response.json();
        
        if (result.success) {
            updateWorkersTable(result.workers);
            populateWorkerDropdown(result.workers);
        }
    } catch (error) {
        console.error('Error loading workers:', error);
    }
}

// Populate worker dropdown for health history
function populateWorkerDropdown(workers) {
    const dropdown = document.getElementById('workerHistorySelect');
    if (!dropdown) return;
    
    // Clear existing options except the default ones
    dropdown.innerHTML = `
        <option value="">Select Worker</option>
        <option value="all">All Workers (Compare)</option>
    `;
    
    // Add worker options
    workers.forEach(worker => {
        const workerName = worker.name || `${worker.fname} ${worker.lname}`;
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = workerName;
        dropdown.appendChild(option);
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const addWorkerModal = document.getElementById('addWorkerModal');
    if (event.target === addWorkerModal) {
        closeAddWorkerModal();
    }
}

// Health History Analysis Functions
let chartInstances = {}; // Store chart instances for cleanup
let isLoadingHistory = false; // Prevent multiple simultaneous calls

// Load worker health history data
async function loadWorkerHistory() {
    // Prevent multiple simultaneous calls
    if (isLoadingHistory) {
        console.log('History loading already in progress, skipping...');
        return;
    }
    
    const workerSelect = document.getElementById('workerHistorySelect');
    const daysSelect = document.getElementById('daysFilter');
    
    if (!workerSelect || !daysSelect) return;
    
    const workerId = workerSelect.value;
    const days = daysSelect.value;
    
    // Don't load if no worker is selected
    if (!workerId) {
        clearAllCharts();
        return;
    }
    
    isLoadingHistory = true;
    console.log(`Loading health history for worker ${workerId}, ${days} days...`);
    
    try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`/api/health-history?worker_id=${workerId}&days=${days}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const result = await response.json();
        
        if (result.success) {
            renderHealthHistoryCharts(result.data, result.dateRange);
            console.log('Health history loaded successfully');
        } else {
            console.error('Error loading health history:', result.error);
            clearAllCharts();
        }
    } catch (error) {
        console.error('Error fetching health history:', error);
        clearAllCharts();
    } finally {
        isLoadingHistory = false;
    }
}

// Clear all existing charts
function clearAllCharts() {
    console.log('Clearing all charts...');
    Object.keys(chartInstances).forEach(chartKey => {
        if (chartInstances[chartKey]) {
            try {
                chartInstances[chartKey].destroy();
            } catch (e) {
                console.warn(`Error destroying chart ${chartKey}:`, e);
            }
            delete chartInstances[chartKey];
        }
    });
    
    // Also clear canvas contexts and reset dimensions to prevent memory leaks
    ['heartRateChart', 'spo2Chart', 'temperatureChart', 'alertsChart'].forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Reset canvas dimensions to prevent huge sizing issues
            canvas.style.height = '300px';
            canvas.style.width = '100%';
            canvas.width = canvas.offsetWidth;
            canvas.height = 300;
        }
    });
}

// Render health history charts
function renderHealthHistoryCharts(data, dateRange) {
    clearAllCharts();
    
    const workers = Object.keys(data);
    if (workers.length === 0) {
        console.log('No health history data found for the selected criteria');
        return;
    }
    
    // Prepare chart data
    const chartData = prepareChartData(data, workers);
    
    // Render individual charts
    renderTemperatureChart(chartData);
    renderHeartRateChart(chartData);
    renderSpo2Chart(chartData);
    renderAlertsChart(chartData);
}

// Prepare chart data from health history
function prepareChartData(data, workers) {
    const chartData = {
        labels: [],
        temperature: { datasets: [] },
        heartRate: { datasets: [] },
        spo2: { datasets: [] },
        alerts: { datasets: [] }
    };
    
    // Get all unique dates and sort them
    const allDates = new Set();
    workers.forEach(workerId => {
        data[workerId].dates.forEach(date => {
            allDates.add(new Date(date).toLocaleDateString());
        });
    });
    chartData.labels = Array.from(allDates).sort();
    
    // Generate colors for each worker
    const colors = [
        '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', 
        '#00bcd4', '#8bc34a', '#ffeb3b', '#e91e63', '#607d8b'
    ];
    
    workers.forEach((workerId, index) => {
        const workerData = data[workerId];
        const color = colors[index % colors.length];
        const workerName = workerData.workerName;
        
        // Temperature datasets
        chartData.temperature.datasets.push({
            label: `${workerName} - Min Temp`,
            data: workerData.temperature.min,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            borderDash: [5, 5]
        });
        chartData.temperature.datasets.push({
            label: `${workerName} - Max Temp`,
            data: workerData.temperature.max,
            borderColor: color,
            backgroundColor: color + '40',
            borderWidth: 2,
            fill: false
        });
        chartData.temperature.datasets.push({
            label: `${workerName} - Avg Temp`,
            data: workerData.temperature.avg,
            borderColor: color,
            backgroundColor: color + '60',
            borderWidth: 3,
            fill: false,
            tension: 0.1
        });
        
        // Heart Rate datasets
        chartData.heartRate.datasets.push({
            label: `${workerName} - Min HR`,
            data: workerData.heartRate.min,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            borderDash: [5, 5]
        });
        chartData.heartRate.datasets.push({
            label: `${workerName} - Max HR`,
            data: workerData.heartRate.max,
            borderColor: color,
            backgroundColor: color + '40',
            borderWidth: 2,
            fill: false
        });
        chartData.heartRate.datasets.push({
            label: `${workerName} - Avg HR`,
            data: workerData.heartRate.avg,
            borderColor: color,
            backgroundColor: color + '60',
            borderWidth: 3,
            fill: false,
            tension: 0.1
        });
        
        // SpO2 datasets
        chartData.spo2.datasets.push({
            label: `${workerName} - Min SpO2`,
            data: workerData.spo2.min,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            borderDash: [5, 5]
        });
        chartData.spo2.datasets.push({
            label: `${workerName} - Max SpO2`,
            data: workerData.spo2.max,
            borderColor: color,
            backgroundColor: color + '40',
            borderWidth: 2,
            fill: false
        });
        chartData.spo2.datasets.push({
            label: `${workerName} - Avg SpO2`,
            data: workerData.spo2.avg,
            borderColor: color,
            backgroundColor: color + '60',
            borderWidth: 3,
            fill: false,
            tension: 0.1
        });
        
        // Alert counts datasets
        chartData.alerts.datasets.push({
            label: `${workerName} - Fall Counts`,
            data: workerData.counts.fall,
            borderColor: '#ff9800',
            backgroundColor: '#ff980040',
            borderWidth: 2,
            fill: false
        });
        chartData.alerts.datasets.push({
            label: `${workerName} - SOS Counts`,
            data: workerData.counts.sos,
            borderColor: '#f44336',
            backgroundColor: '#f4433640',
            borderWidth: 2,
            fill: false
        });
        chartData.alerts.datasets.push({
            label: `${workerName} - Risk Counts`,
            data: workerData.counts.risk,
            borderColor: '#9c27b0',
            backgroundColor: '#9c27b040',
            borderWidth: 2,
            fill: false
        });
    });
    
    return chartData;
}

// Render temperature monitoring chart
function renderTemperatureChart(chartData) {
    const ctx = document.getElementById('temperatureChart');
    if (!ctx) return;
    
    // Set explicit canvas dimensions to prevent huge size issues
    ctx.style.height = '300px';
    ctx.style.width = '100%';
    
    chartInstances.temperature = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.temperature.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 10
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Monitoring (°C)',
                    color: '#fff'
                },
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' },
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: '#fff'
                    }
                }
            }
        }
    });
}

// Render heart rate trends chart
function renderHeartRateChart(chartData) {
    const ctx = document.getElementById('heartRateChart');
    if (!ctx) return;
    
    // Set explicit canvas dimensions to prevent huge size issues
    ctx.style.height = '300px';
    ctx.style.width = '100%';
    
    chartInstances.heartRate = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.heartRate.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 10
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Heart Rate Trends (BPM)',
                    color: '#fff'
                },
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' },
                    title: {
                        display: true,
                        text: 'Heart Rate (BPM)',
                        color: '#fff'
                    }
                }
            }
        }
    });
}

// Render SpO2 levels chart
function renderSpo2Chart(chartData) {
    const ctx = document.getElementById('spo2Chart');
    if (!ctx) return;
    
    // Set explicit canvas dimensions to prevent huge size issues
    ctx.style.height = '300px';
    ctx.style.width = '100%';
    
    chartInstances.spo2 = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.spo2.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'SpO2 Levels (%)',
                    color: '#fff'
                },
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' },
                    title: {
                        display: true,
                        text: 'SpO2 (%)',
                        color: '#fff'
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

// Render alerts distribution chart
function renderAlertsChart(chartData) {
    const ctx = document.getElementById('alertsChart');
    if (!ctx) return;
    
    // Set explicit canvas dimensions to prevent huge size issues
    ctx.style.height = '300px';
    ctx.style.width = '100%';
    
    chartInstances.alerts = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.alerts.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Alert Counts Distribution',
                    color: '#fff'
                },
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#fff' },
                    grid: { color: '#444' }
                },
                y: {
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    },
                    grid: { color: '#444' },
                    title: {
                        display: true,
                        text: 'Alert Count',
                        color: '#fff'
                    },
                    min: 0
                }
            }
        }
    });
}