require('dotenv').config();
const { getAlertStats, getUnacknowledgedAlerts, getRecentAlerts } = require('../src/functions/alerts');
const { getMeasurementsData } = require('../src/functions/measurements');
const { getWorkerStats } = require('../src/functions/workers');

async function runTests() {
  try {
    console.log('\n=== getAlertStats ===');
    const alertStats = await getAlertStats();
    console.log(alertStats);

    console.log('\n=== getUnacknowledgedAlerts ===');
    const unack = await getUnacknowledgedAlerts();
    console.log(unack);

    console.log('\n=== getRecentAlerts ===');
    const recent = await getRecentAlerts();
    console.log(recent);

    console.log('\n=== getMeasurementsData ===');
    const measurements = await getMeasurementsData();
    console.log(measurements);

    console.log('\n=== getWorkerStats ===');
    const workers = await getWorkerStats();
    console.log(workers);

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
