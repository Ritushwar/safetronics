const { HealthHistory } = require('../models/health_history');
const { Worker } = require('../models/workers');
const { Op } = require('sequelize');

// Simple cache for health history queries to avoid repeated heavy DB calls
const _historyCache = new Map(); // key: `${workerId||'all'}:${days}` -> {ts, data}
const HISTORY_TTL_MS = 15000; // 15 seconds

/**
 * Get health history data for a specific worker or all workers within a date range
 * @param {number|null} workerId - Worker ID (null for all workers)
 * @param {number} days - Number of days to look back
 * @returns {Object} Health history data organized by worker
 */
async function getHealthHistory(workerId, days = 7) {
    try {
        const cacheKey = `${workerId || 'all'}:${days}`;
        const now = Date.now();
        const cached = _historyCache.get(cacheKey);
        if (cached && (now - cached.ts) < HISTORY_TTL_MS) {
            return cached.data;
        }
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const whereCondition = {
            date: {
                [Op.between]: [startDate, endDate]
            }
        };

        if (workerId && workerId !== 'all') {
            whereCondition.worker_id = workerId;
        }

        const healthData = await HealthHistory.findAll({
            where: whereCondition,
            // Temporarily remove include to test if association causes issues
            // include: [{
            //     model: Worker,
            //     as: 'worker',
            //     attributes: ['id', 'fname', 'lname', 'name']
            // }],
            order: [['date', 'ASC']],
            limit: 100 // Add limit to prevent massive responses
        });

        // Process and group data by worker
        const processedData = {};

        healthData.forEach(record => {
            const workerId = record.worker_id;
            // Simplified worker name since we removed the association
            const workerName = `Worker ${workerId}`;

            if (!processedData[workerId]) {
                processedData[workerId] = {
                    workerId: workerId,
                    workerName: workerName,
                    dates: [],
                    temperature: {
                        min: [],
                        max: [],
                        avg: []
                    },
                    heartRate: {
                        min: [],
                        max: [],
                        avg: []
                    },
                    spo2: {
                        min: [],
                        max: [],
                        avg: []
                    },
                    counts: {
                        fall: [],
                        sos: [],
                        risk: []
                    }
                };
            }

            const data = processedData[workerId];
            data.dates.push(record.date);
            
            // Temperature data
            data.temperature.min.push(record.min_temp || 0);
            data.temperature.max.push(record.max_temp || 0);
            data.temperature.avg.push(record.avg_temp || 0);
            
            // Heart rate data
            data.heartRate.min.push(record.min_pulse || 0);
            data.heartRate.max.push(record.max_pulse || 0);
            data.heartRate.avg.push(record.avg_pulse || 0);
            
            // SpO2 data
            data.spo2.min.push(record.min_spo2 || 0);
            data.spo2.max.push(record.max_spo2 || 0);
            data.spo2.avg.push(record.avg_spo2 || 0);
            
            // Count data
            data.counts.fall.push(record.fall_count || 0);
            data.counts.sos.push(record.sos_count || 0);
            data.counts.risk.push(record.risk_count || 0);
        });

        const result = {
            success: true,
            data: processedData,
            dateRange: {
                start: startDate,
                end: endDate,
                days: days
            }
        };

        _historyCache.set(cacheKey, { ts: Date.now(), data: result });
        return result;

    } catch (error) {
        console.error('Error fetching health history:', error);
        return {
            success: false,
            error: error.message,
            data: {}
        };
    }
}

/**
 * Get health statistics summary for a worker
 * @param {number} workerId - Worker ID
 * @param {number} days - Number of days to look back
 * @returns {Object} Health statistics summary
 */
async function getHealthStatsSummary(workerId, days = 7) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const healthData = await HealthHistory.findAll({
            where: {
                worker_id: workerId,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['date', 'DESC']]
        });

        if (healthData.length === 0) {
            return {
                success: true,
                summary: {
                    totalDays: 0,
                    averages: {
                        temperature: 0,
                        heartRate: 0,
                        spo2: 0
                    },
                    totals: {
                        fallCounts: 0,
                        sosCounts: 0,
                        riskCounts: 0
                    }
                }
            };
        }

        // Calculate averages and totals
        const totals = healthData.reduce((acc, record) => {
            acc.avgTemp += (record.avg_temp || 0);
            acc.avgPulse += (record.avg_pulse || 0);
            acc.avgSpo2 += (record.avg_spo2 || 0);
            acc.fallCounts += (record.fall_count || 0);
            acc.sosCounts += (record.sos_count || 0);
            acc.riskCounts += (record.risk_count || 0);
            return acc;
        }, {
            avgTemp: 0,
            avgPulse: 0,
            avgSpo2: 0,
            fallCounts: 0,
            sosCounts: 0,
            riskCounts: 0
        });

        const summary = {
            totalDays: healthData.length,
            averages: {
                temperature: (totals.avgTemp / healthData.length).toFixed(1),
                heartRate: Math.round(totals.avgPulse / healthData.length),
                spo2: Math.round(totals.avgSpo2 / healthData.length)
            },
            totals: {
                fallCounts: totals.fallCounts,
                sosCounts: totals.sosCounts,
                riskCounts: totals.riskCounts
            }
        };

        return {
            success: true,
            summary: summary
        };

    } catch (error) {
        console.error('Error getting health stats summary:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getHealthHistory,
    getHealthStatsSummary
};