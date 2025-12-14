const {DataTypes} = require("sequelize")
const {sequelize} = require("../config/db.config");
const { Worker } = require("./workers");

  const Alert = sequelize.define(
    "Alert",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      worker_id: { type: DataTypes.INTEGER, allowNull: false },
      acknowledged: { type: DataTypes.BOOLEAN, defaultValue: false },
      type: {
        type: DataTypes.ENUM("fall_detected", "sos","Health"),
        allowNull: false,
      },
    },
    {
      tableName: "alerts",
      timestamps: true,
    }
  );

  module.exports = {
    Alert,
    sequelize
  }