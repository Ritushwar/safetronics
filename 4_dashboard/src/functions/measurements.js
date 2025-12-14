const { Measurement } = require('../models/measurements');
const { Worker } = require('../models/workers');
const { Sequelize } = require('sequelize');

async function getMeasurementsData() {
    try {
        // Fetch latest measurement per worker by querying each worker's latest row
        const workers = await Worker.findAll({ attributes: ['id'] });
        if (!workers || workers.length === 0) {
            console.log('No workers found in database');
            return [];
        }

        const measurementsData = [];
        // For each worker, fetch their latest measurement (ordered by createdAt DESC)
        for (const w of workers) {
            const measurement = await Measurement.findOne({
                where: { worker_id: w.id },
                order: [['createdAt', 'DESC']]
            });

            if (!measurement) continue;

            let riskLevel = 'Low Risk';
            if (measurement.prediction === "0" || measurement.prediction === 0) {
                riskLevel = 'High Risk';
            }

            // fetch worker details separately to avoid relying on associations being loaded
            let workerDetails = null;
            try {
                workerDetails = await Worker.findByPk(measurement.worker_id, { attributes: ['fname','lname','gender'] });
            } catch (e) {
                workerDetails = null;
            }

            measurementsData.push({
                worker_id: measurement.worker_id,
                body_temp: measurement.body_temp,
                pulse_rate: measurement.pulse_rate,
                spo2: measurement.spo2,
                prediction: measurement.prediction,
                riskLevel: riskLevel,
                fname: workerDetails ? workerDetails.fname : null,
                lname: workerDetails ? workerDetails.lname : null,
                gender: workerDetails ? workerDetails.gender : null,
                // send both ISO string and epoch ms to avoid timezone ambiguity on the client
                timestamp: measurement.createdAt ? measurement.createdAt.toISOString() : null,
                timestamp_ms: measurement.createdAt ? measurement.createdAt.getTime() : null
            });
        }

        // Reduced logging for production: provide debug info when needed
        try {
            const debugMap = measurementsData.map(m => ({ worker_id: m.worker_id, timestamp: m.timestamp }));
            console.debug && console.debug('Latest measurements timestamps per worker:', debugMap);
        } catch (e) {
            // ignore logging errors
        }

        return measurementsData;
    } catch (error) {
        console.error('Error fetching measurements data:', error);
        // On error, return empty array instead of mock data
        return [];
    }
}


module.exports = { getMeasurementsData };