require('dotenv').config();
const { sequelize } = require('../src/config/db.config');
const applyAssociations = require('../src/models/associations');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK');

    // Ensure associations are applied before syncing
    applyAssociations();

    // Sync all models (will create missing tables/columns without dropping data)
    await sequelize.sync({ alter: true });
    console.log('Sequelize sync complete (alter:true)');

    // List tables to confirm
    const [results] = await sequelize.query("SHOW TABLES");
    console.log('Tables in database:');
    console.table(results);

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during sync:', err);
    process.exit(1);
  }
}

run();
