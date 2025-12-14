const { Measurement } = require("../models/measurements");
const {Worker} = require("../models/workers")

// No mock data: when DB has no workers, return empty results (defaults)

const getWorkerStats =  async ()=> {
    let result = {
        totalWorkers : 0,
        activeWorkers: 0,
        workers: []
    }
    
    try {
        // Try to fetch from database first
        const allWorkers = await Worker.findAll({
            include: [Measurement],
            order: [['id', 'ASC']]
        });
        
        // If DB returned workers, process them; otherwise keep defaults (empty workers array)
        if (allWorkers && allWorkers.length > 0) {
            // Processing workers from database: quiet mode
            result.workers = allWorkers.map(worker => {
                // Quiet mode - removed debug logging
                const latestMeasurement = worker.Measurements && worker.Measurements.length > 0 
                    ? worker.Measurements[worker.Measurements.length - 1] 
                    : null;
                
                result.totalWorkers += 1;
                if (worker.Measurements && worker.Measurements.length) {
                    result.activeWorkers += 1;
                }

                const processedWorker = {
                    id: worker.id,
                    name: worker.fname && worker.lname 
                        ? `${worker.fname} ${worker.lname}` 
                        : worker.name || `Worker ${worker.id}`,
                    status: latestMeasurement ? determineStatus(latestMeasurement) : 'inactive',
                    heartRate: latestMeasurement ? latestMeasurement.heartRate : null,
                    spo2: latestMeasurement ? latestMeasurement.spo2 : null,
                    temperature: latestMeasurement ? latestMeasurement.temperature : null,
                    riskProbability: latestMeasurement ? latestMeasurement.riskProbability : null,
                    hrv: latestMeasurement ? latestMeasurement.hrv : null,
                    healthStatus: latestMeasurement ? determineHealthStatus(latestMeasurement) : 'unknown',
                    gender: worker.gender || 'unknown',
                    age: worker.age || null,
                    height: worker.height_m || worker.height || null,
                    weight: worker.weight_kg || worker.weight || null,
                    bmi: worker.bmi || (worker.height_m && worker.weight_kg ? 
                        (worker.weight_kg / (worker.height_m * worker.height_m)).toFixed(2) : null)
                };
                
                // Processed worker - quiet mode
                return processedWorker;
            });
        } else {
            // No workers found - leave defaults (0 counts and empty workers array)
            result.workers = [];
        }
        
    } catch (error) {
        console.error('Database error while fetching workers:', error.message);
        // On error, return defaults (no mock data)
        result.workers = [];
        result.totalWorkers = 0;
        result.activeWorkers = 0;
    }

    return result;

}

// Helper function to determine status based on measurements
function determineStatus(measurement) {
    if (!measurement) return 'inactive';
    
    const heartRate = measurement.heartRate;
    const spo2 = measurement.spo2;
    const temperature = measurement.temperature;
    
    // Critical conditions
    if (heartRate > 120 || heartRate < 50 || spo2 < 90 || temperature > 38.5) {
        return 'critical';
    }
    
    // Warning conditions
    if (heartRate > 100 || heartRate < 60 || spo2 < 95 || temperature > 37.5) {
        return 'warning';
    }
    
    return 'normal';
}

// Helper function to determine health status
function determineHealthStatus(measurement) {
    if (!measurement) return 'unknown';
    
    const riskProbability = measurement.riskProbability;
    
    if (riskProbability > 70) {
        return 'critical';
    } else if (riskProbability > 40) {
        return 'warning';
    }
    
    return 'good';
}

module.exports = {
    getWorkerStats
}