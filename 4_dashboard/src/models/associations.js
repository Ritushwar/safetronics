const { Worker } = require("./workers");
const { Alert } = require("./alerts");
const { Measurement } = require("./measurements");
const { HealthHistory } = require("./health_history");

function applyAssociations() {
  Worker.hasMany(Alert, { foreignKey: "worker_id" });
  Worker.hasMany(Measurement, { foreignKey: "worker_id" });
  Worker.hasMany(HealthHistory, { foreignKey: "worker_id" });

  Measurement.belongsTo(Worker, { foreignKey: "worker_id", as: "worker" });
  Alert.belongsTo(Worker, { foreignKey: "worker_id", as: "worker" });
  HealthHistory.belongsTo(Worker, { foreignKey: "worker_id", as: "worker" });
}

module.exports = applyAssociations;