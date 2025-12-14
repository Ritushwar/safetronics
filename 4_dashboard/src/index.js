const dotenv = require("dotenv");
const path = require("path")
const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');

dotenv.config();
const app = express();
const server = createServer(app);


const io = new Server(server);


const {sequelize} = require("./config/db.config")
const {Alert} = require("./models/alerts") 
const {Measurement} = require("./models/measurements") 
const {Worker} = require("./models/workers")
const {HealthHistory} = require("./models/health_history");  
const { getWorkerStats } = require("./functions/workers");
const { getAlertStats, getUnacknowledgedAlerts, acknowledgeAlert, getRecentAlerts } = require("./functions/alerts");
const { getMeasurementsData } = require("./functions/measurements");
const applyAssociations = require("./models/associations");
applyAssociations()

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", express.static(path.join(__dirname, "public")))

// API Routes
// Add worker endpoint
app.post('/api/workers', async (req, res) => {
  try {
    const { fname, lname, gender, height_m, weight_kg, age } = req.body;
    
    // Validate required fields
    if (!fname || !lname || !gender || !height_m || !weight_kg) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }
    
    // Calculate BMI
    const bmi = weight_kg / (height_m * height_m);
    
    // Create new worker
    const newWorker = await Worker.create({
      fname,
      lname,
      gender,
      height_m: parseFloat(height_m),
      weight_kg: parseFloat(weight_kg),
      bmi: parseFloat(bmi.toFixed(2)),
      age: age ? parseInt(age) : null
    });
    
    res.status(201).json({
      success: true,
      message: 'Worker added successfully',
      worker: newWorker
    });
    
  } catch (error) {
    console.error('Error adding worker:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding worker to database'
    });
  }
});

// Get all workers endpoint
app.get('/api/workers', async (req, res) => {
  try {
    const workers = await Worker.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      workers
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workers'
    });
  }
});

// Get health history endpoint
app.get('/api/health-history', async (req, res) => {
  try {
    const { getHealthHistory, getHealthStatsSummary } = require('./functions/health_history');
    const { worker_id, days } = req.query;
    
    const daysCount = parseInt(days) || 7;
    const workerId = worker_id && worker_id !== 'all' ? parseInt(worker_id) : null;
    
    const result = await getHealthHistory(workerId, daysCount);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error fetching health history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching health history',
      error: error.message
    });
  }
});

const initApp = async () => {
   console.log("Testing the database connection..");

   // Test the connection.
   // You can use the .authenticate() function to test if the connection works.

   try {
      await sequelize.authenticate();
      console.log("Connection has been established successfully.");

      // Syncronize the Book model.
      Alert.sync({ alter: true });
      Worker.sync({alter: true})
      Measurement.sync({alter: true})
      HealthHistory.sync({alter: true})

      // Start the web server on the specified port.
      server.listen(process.env.PORT, () => {
         console.log(`Server is running at: http://localhost:${process.env.PORT}`);
      });

      io.on("connection", (socket)=> {
        try {
          console.log( `Client connected: ${socket.id}`)

          // Send initial data immediately
          const sendLatestData = async () => {
            try {
              const workerData = await getWorkerStats();
              const alertData = await getAlertStats();
              const measurementsData = await getMeasurementsData();
              const unacknowledgedAlerts = await getUnacknowledgedAlerts();
              const recentAlerts = await getRecentAlerts();

              socket.emit("workers", workerData);
              socket.emit("alerts", alertData);
              socket.emit("measurements", measurementsData);
              socket.emit("allAlerts", unacknowledgedAlerts);
              socket.emit("recentAlerts", recentAlerts);
            } catch (error) {
              console.error('Error sending data:', error);
            }
          };

          // Send initial data
          sendLatestData();

          // Set up interval for this socket - but only if not already running
          let interval;
          if (!socket.interval) {
            interval = setInterval(sendLatestData, 10000); // Every 10 seconds (reduced frequency)
            socket.interval = interval;
          }

          // Handle alert acknowledgment
          socket.on('acknowledgeAlert', async (alertId) => {
            try {
              console.log(`Received acknowledgment request for alert ${alertId}`);
              const result = await acknowledgeAlert(alertId);
              socket.emit('acknowledgeResult', result);

              // Send updated alerts list immediately
              const updatedAlerts = await getUnacknowledgedAlerts();
              socket.emit("allAlerts", updatedAlerts);
            } catch (e) {
              console.error('Error in acknowledgeAlert handler:', e);
            }
          });

          socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            if (socket.interval) {
              clearInterval(socket.interval);
              socket.interval = null;
            }
          });
        } catch (err) {
          console.error('Error in connection handler:', err);
        }
      })
   } catch (error) {
      console.error("Unable to connect to the database:", error.message);
   }
};

// Global error handlers to prevent process crash
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
  // Don't exit; let nodemon restart if necessary
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize the application.
initApp();