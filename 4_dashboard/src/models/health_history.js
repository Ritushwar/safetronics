const {DataTypes} = require("sequelize")
const {sequelize} = require("../config/db.config");

  const HealthHistory = sequelize.define(
    "HealthHistory",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      worker_id: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      min_temp: { type: DataTypes.FLOAT },
      max_temp: { type: DataTypes.FLOAT },
      avg_temp: { type: DataTypes.FLOAT },
      min_pulse: { type: DataTypes.FLOAT },
      max_pulse: { type: DataTypes.FLOAT },
      avg_pulse: { type: DataTypes.FLOAT },
      min_spo2: { type: DataTypes.FLOAT },
      max_spo2: { type: DataTypes.FLOAT },
      avg_spo2: { type: DataTypes.FLOAT },
      sos_count: { type: DataTypes.INTEGER, defaultValue: 0 },
      fall_count: { type: DataTypes.INTEGER, defaultValue: 0 },
      risk_count: {type: DataTypes.INTEGER, defaultValue: 0},
      health_status: { type: DataTypes.STRING },
    },
    {
      tableName: "health_history",
      timestamps: true,
    }
  );


module.exports ={
    HealthHistory,
    sequelize
}
