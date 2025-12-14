const { DataTypes } = require("sequelize");
const {sequelize} = require("../config/db.config");
const { Worker } = require("./workers");

const Measurement = sequelize.define(
  "Measurement",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    worker_id: { type: DataTypes.INTEGER, allowNull: false },
    body_temp: { type: DataTypes.FLOAT },
    pulse_rate: { type: DataTypes.FLOAT },
    spo2: { type: DataTypes.FLOAT },
    hrv: { type: DataTypes.FLOAT },
    prediction: { type: DataTypes.STRING },
    probability: { type: DataTypes.FLOAT },
  },
  {
    tableName: "measurements",
    timestamps: true,
  }
);

module.exports = {Measurement};
