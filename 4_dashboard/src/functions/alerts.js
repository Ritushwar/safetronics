const { Alert } = require("../models/alerts");
const { Worker } = require("../models/workers");

const getAlertStats = async () => {
    let result = {
        totalAlerts: 0,
        fallDetectedCount: 0,
        sosAlertsCount: 0,
        healthAlertsCount: 0,
        recentAlerts: []
    };
    
    try {
        // Try to fetch from database first - only unacknowledged alerts
        const allAlerts = await Alert.findAll({
            where: {
                acknowledged: false // Only count unacknowledged alerts (0)
            },
            order: [['createdAt', 'DESC']]
        });
        // If database returns rows, compute counts from DB rows.
        if (allAlerts && allAlerts.length > 0) {
            result.totalAlerts = allAlerts.length;
            result.fallDetectedCount = allAlerts.filter(alert => alert.type === 'fall_detected').length;
            result.sosAlertsCount = allAlerts.filter(alert => alert.type === 'sos').length;
            result.healthAlertsCount = allAlerts.filter(alert => alert.type === 'Health').length;
            result.recentAlerts = allAlerts.slice(0, 5).map(alert => ({
                id: alert.id,
                type: alert.type,
                workerId: alert.workerId || alert.worker_id,
                message: alert.message,
                severity: alert.severity,
                createdAt: alert.createdAt,
                acknowledged: alert.acknowledged
            }));
        } else {
            // No unacknowledged alerts found in DB - keep default zeros and empty arrays
            result.totalAlerts = 0;
            result.fallDetectedCount = 0;
            result.sosAlertsCount = 0;
            result.healthAlertsCount = 0;
            result.recentAlerts = [];
        }
        
    } catch (error) {
        console.error('Database error while fetching alerts:', error.message);
        // On error, return defaults (no mock data)
        result.totalAlerts = 0;
        result.fallDetectedCount = 0;
        result.sosAlertsCount = 0;
        result.healthAlertsCount = 0;
        result.recentAlerts = [];
    }
    
    return result;
};

const getUnacknowledgedAlerts = async () => {
    try {
        // Try to fetch from database first
        const unacknowledgedAlerts = await Alert.findAll({
            where: {
                acknowledged: false // equivalent to acknowledged = 0
            },
            // Temporarily remove the join to test
            order: [['createdAt', 'DESC']]
        });

        // If database is available and has data, format and return
        if (unacknowledgedAlerts && unacknowledgedAlerts.length > 0) {
            // console.log(`✅ Found ${unacknowledgedAlerts.length} unacknowledged alerts, fetching worker details...`);
            
            // Get worker details separately to avoid association issues
            const formattedAlerts = [];
            for (const alert of unacknowledgedAlerts) {
                try {
                    const worker = await Worker.findByPk(alert.worker_id);
                    formattedAlerts.push({
                        id: alert.id,
                        worker_id: alert.worker_id,
                        fname: worker ? worker.fname : 'Unknown',
                        lname: worker ? worker.lname : 'Worker',
                        type: alert.type,
                        createdAt: alert.createdAt,
                        acknowledged: alert.acknowledged
                    });
                } catch (workerError) {
                    console.warn(`Could not find worker ${alert.worker_id}:`, workerError.message);
                    formattedAlerts.push({
                        id: alert.id,
                        worker_id: alert.worker_id,
                        fname: 'Unknown',
                        lname: 'Worker',
                        type: alert.type,
                        createdAt: alert.createdAt,
                        acknowledged: alert.acknowledged
                    });
                }
            }
            
            return formattedAlerts;
        }

    // If database is empty, return empty array (no mock data)
    // console.log('🔄 No unacknowledged alerts found in database');
    return [];

    } catch (error) {
        console.error('Error fetching unacknowledged alerts:', error.message);
        // On error, return empty array instead of mock data
        return [];
    }
};

const acknowledgeAlert = async (alertId) => {
    try {
        const result = await Alert.update(
            { acknowledged: true },
            { where: { id: alertId } }
        );
        
        if (result[0] > 0) {
            console.debug(`Alert ${alertId} acknowledged successfully`);
            return { success: true, message: 'Alert acknowledged successfully' };
        } else {
            console.debug(`Alert ${alertId} not found or already acknowledged`);
            return { success: false, message: 'Alert not found or already acknowledged' };
        }
    } catch (error) {
        console.error('Error acknowledging alert:', error.message);
        return { success: false, message: 'Database error occurred' };
    }
};

const getRecentAlerts = async () => {
    try {
        // Fetch recent 3 alerts from database (all alerts, not just unacknowledged)
        const recentAlerts = await Alert.findAll({
            order: [['createdAt', 'DESC']],
            limit: 3
        });

    // If database has data, format and return with worker details
    if (recentAlerts && recentAlerts.length > 0) {
            // console.log(`✅ Found ${recentAlerts.length} recent alerts, fetching worker details...`);
            
            const formattedAlerts = [];
            for (const alert of recentAlerts) {
                try {
                    const worker = await Worker.findByPk(alert.worker_id);
                    formattedAlerts.push({
                        id: alert.id,
                        worker_id: alert.worker_id,
                        workerName: worker ? `${worker.fname} ${worker.lname}` : 'Unknown Worker',
                        acknowledged: alert.acknowledged ? 'Done' : 'Remaining',
                        time: alert.updatedAt || alert.createdAt,
                        type: alert.type
                    });
                } catch (workerError) {
                    console.warn(`Could not find worker ${alert.worker_id}:`, workerError.message);
                    formattedAlerts.push({
                        id: alert.id,
                        worker_id: alert.worker_id,
                        workerName: 'Unknown Worker',
                        acknowledged: alert.acknowledged ? 'Done' : 'Remaining',
                        time: alert.updatedAt || alert.createdAt,
                        type: alert.type
                    });
                }
            }
            
            return formattedAlerts;
        }
    // If database is empty, return empty array (no mock recent alerts)
    // console.log('🔄 No alerts found in database');
    return [];

    } catch (error) {
        console.error('❌ Error fetching recent alerts:', error.message);
        // On error return empty array
        return [];
    }
};


module.exports = {
    getAlertStats,
    getUnacknowledgedAlerts,
    acknowledgeAlert,
    getRecentAlerts
};