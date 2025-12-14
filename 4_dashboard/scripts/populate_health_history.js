const { HealthHistory } = require('../src/models/health_history');
const { Worker } = require('../src/models/workers');
const { sequelize } = require('../src/config/db.config');
const applyAssociations = require('../src/models/associations');

async function populateSampleHealthHistory() {
    try {
        console.log('🚀 Starting to populate sample health history data...');

        // Apply associations
        applyAssociations();
        console.log('🔗 Associations applied');

        // Sync the HealthHistory model to create table if it doesn't exist
        await HealthHistory.sync();
        console.log('✅ HealthHistory table synced');

        // Get all workers
        const workers = await Worker.findAll();
        if (workers.length === 0) {
            console.log('❌ No workers found. Please add workers first.');
            return;
        }

        console.log(`👥 Found ${workers.length} workers`);

        // Clear existing health history data (optional)
        await HealthHistory.destroy({ where: {} });
        console.log('🧹 Cleared existing health history data');

        // Generate sample data for the last 7 days
        const sampleData = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];

            for (const worker of workers) {
                // Generate realistic health data with some variation
                const baseTemp = 36.5 + (Math.random() - 0.5) * 2; // 35.5 - 37.5
                const basePulse = 70 + Math.random() * 30; // 70 - 100
                const baseSpo2 = 95 + Math.random() * 5; // 95 - 100
                
                const healthRecord = {
                    worker_id: worker.id,
                    date: dateString,
                    min_temp: parseFloat((baseTemp - 0.5).toFixed(1)),
                    max_temp: parseFloat((baseTemp + 0.5).toFixed(1)),
                    avg_temp: parseFloat(baseTemp.toFixed(1)),
                    min_pulse: Math.round(basePulse - 5),
                    max_pulse: Math.round(basePulse + 10),
                    avg_pulse: Math.round(basePulse),
                    min_spo2: Math.round(baseSpo2 - 2),
                    max_spo2: Math.round(baseSpo2 + 1),
                    avg_spo2: Math.round(baseSpo2),
                    fall_count: Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0, // 30% chance of falls
                    sos_count: Math.random() < 0.1 ? Math.floor(Math.random() * 2) : 0,  // 10% chance of SOS
                    risk_count: Math.random() < 0.2 ? Math.floor(Math.random() * 2) : 0, // 20% chance of risk
                    health_status: getRandomHealthStatus(basePulse, baseSpo2, baseTemp)
                };
                
                sampleData.push(healthRecord);
            }
        }

        // Bulk insert sample data
        const createdRecords = await HealthHistory.bulkCreate(sampleData);
        console.log(`✅ Successfully created ${createdRecords.length} health history records`);
        
        // Show sample of created data
        console.log('\n📊 Sample of created data:');
        const sampleRecords = await HealthHistory.findAll({
            limit: 5,
            include: [{
                model: Worker,
                as: 'worker',
                attributes: ['id', 'fname', 'lname', 'name']
            }],
            order: [['date', 'DESC'], ['worker_id', 'ASC']]
        });
        
        sampleRecords.forEach(record => {
            const workerName = record.worker ? 
                (record.worker.name || `${record.worker.fname} ${record.worker.lname}`) : 
                `Worker ${record.worker_id}`;
            console.log(`  📈 ${workerName} - ${record.date}: Temp ${record.avg_temp}°C, Pulse ${record.avg_pulse}bpm, SpO2 ${record.avg_spo2}%, Falls: ${record.fall_count}`);
        });
        
        console.log('\n🎉 Sample health history data population completed!');
        
    } catch (error) {
        console.error('❌ Error populating sample health history data:', error);
    }
}

function getRandomHealthStatus(pulse, spo2, temp) {
    if (pulse > 100 || spo2 < 95 || temp > 37.5) {
        return Math.random() < 0.7 ? 'warning' : 'critical';
    } else if (pulse < 60 || temp < 36.0) {
        return 'warning';
    } else {
        return Math.random() < 0.8 ? 'good' : 'warning';
    }
}

// Run the population if called directly
if (require.main === module) {
    populateSampleHealthHistory().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { populateSampleHealthHistory };